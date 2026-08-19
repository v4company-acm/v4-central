import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY!
const WINDSOR_BASE = 'https://connectors.windsor.ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

function filtrarPorConta(data: any[], accountId?: string | null) {
  if (!accountId) return data
  const alvo = onlyDigits(accountId)
  return data.filter(r => onlyDigits(r.account_id) === alvo)
}
function filtrarCampanhas(data: any[], filtro?: string | null) {
  if (!filtro) return data
  const filtros = filtro.split(',').map(f => f.toLowerCase().trim())
  return data.filter(r => filtros.some(f => (r.campaign_name || '').toLowerCase().includes(f)))
}
function metaActionValue(actions: any, type: string) {
  if (!actions || !Array.isArray(actions)) return 0
  const a = actions.find((x: any) => x.action_type === type)
  return a ? parseFloat(a.value) || 0 : 0
}

async function fetchWindsor(kind: 'google_ads' | 'facebook', fields: string[], dateFrom: string, dateTo: string) {
  const url = `${WINDSOR_BASE}/${kind}?api_key=${WINDSOR_API_KEY}&date_from=${dateFrom}&date_to=${dateTo}&fields=${fields.join(',')}`
  const r = await fetch(url)
  if (!r.ok) return []
  const json = await r.json()
  return json.data || []
}

// Puxa ROAS/CPL/Investimento reais pra pré-preencher o check de Tráfego do Health Score —
// mesma fonte de dados da tela de Resultados (webhook dedicado quando existe, senão Windsor
// direto), só que resumido em 3 números em vez do payload completo da tela.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const { resultados_cliente_id, dias } = req.query
  if (!resultados_cliente_id) return res.status(400).json({ error: 'resultados_cliente_id obrigatório' })

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, nome, tipo, campaign_filter, meta_campaign_filter, windsor_account_id_google, windsor_account_id_meta, dashboard_webhook_url')
    .eq('id', resultados_cliente_id as string)
    .single()

  if (error || !cliente) return res.status(404).json({ error: 'Vínculo de Windsor/Resultados não encontrado' })

  const janela = Math.max(1, Math.min(90, parseInt((dias as string) || '30') || 30))
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - janela * 864e5).toISOString().slice(0, 10)

  // ── Modo full: webhook dedicado (ex. Midas) já devolve blended pronto ──
  if (cliente.dashboard_webhook_url) {
    try {
      const qs = new URLSearchParams({ date_from: from, date_to: to })
      const r = await fetch(`${cliente.dashboard_webhook_url}?${qs.toString()}`)
      if (!r.ok) throw new Error(`Webhook respondeu ${r.status}`)
      const payload = await r.json()
      const b = payload.blended || {}
      return res.status(200).json({
        roas: b.roas ?? null, cpl: b.cpl ?? null, investimento: b.cost ?? null,
        periodo: { date_from: payload.date_from || from, date_to: payload.date_to || to },
        fonte: 'webhook', clienteNome: cliente.nome,
      })
    } catch (err: any) {
      // se o webhook falhar, cai pro Windsor direto como fallback (se tiver conta configurada)
    }
  }

  // ── Modo Windsor direto (Google/Meta) ──
  if (!cliente.windsor_account_id_google && !cliente.windsor_account_id_meta) {
    return res.status(200).json({ roas: null, cpl: null, investimento: null, periodo: { date_from: from, date_to: to }, fonte: 'nenhuma', clienteNome: cliente.nome })
  }

  try {
    let cost = 0, conv = 0, convValue = 0

    if (cliente.windsor_account_id_google) {
      const fields = ['date', 'campaign_name', 'account_id', 'spend', 'conversions', 'conversion_value']
      const raw = filtrarCampanhas(filtrarPorConta(await fetchWindsor('google_ads', fields, from, to), cliente.windsor_account_id_google), cliente.campaign_filter)
      raw.forEach((r: any) => { cost += parseFloat(r.spend) || 0; conv += parseFloat(r.conversions) || 0; convValue += parseFloat(r.conversion_value) || 0 })
    }
    if (cliente.windsor_account_id_meta) {
      const fields = ['date', 'campaign_name', 'account_id', 'spend', 'actions', 'action_values']
      const raw = filtrarCampanhas(filtrarPorConta(await fetchWindsor('facebook', fields, from, to), cliente.windsor_account_id_meta), cliente.meta_campaign_filter || cliente.campaign_filter)
      const actionType = cliente.tipo === 'is' ? 'lead' : 'purchase'
      raw.forEach((r: any) => {
        cost += parseFloat(r.spend) || 0
        conv += metaActionValue(r.actions, actionType)
        convValue += metaActionValue(r.action_values, 'purchase')
      })
    }

    const cpl = conv > 0 ? cost / conv : null
    const roas = cost > 0 && convValue > 0 ? convValue / cost : null
    return res.status(200).json({ roas, cpl, investimento: cost, periodo: { date_from: from, date_to: to }, fonte: 'windsor', clienteNome: cliente.nome })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
