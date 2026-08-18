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

async function fetchWindsor(kind: 'google_ads' | 'facebook', fields: string[], dateFrom: string, dateTo: string) {
  const url = `${WINDSOR_BASE}/${kind}?api_key=${WINDSOR_API_KEY}&date_from=${dateFrom}&date_to=${dateTo}&fields=${fields.join(',')}`
  const r = await fetch(url)
  if (!r.ok) return []
  const json = await r.json()
  return json.data || []
}

function agregarPorDia(rows: any[], valueKeys: string[]) {
  const map: Record<string, any> = {}
  for (const r of rows) {
    const d = r.date
    if (!map[d]) { map[d] = { date: d }; valueKeys.forEach(k => (map[d][k] = 0)) }
    valueKeys.forEach(k => (map[d][k] += parseFloat(r[k]) || 0))
  }
  return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date))
}

function agregarPorCampanha(rows: any[], valueKeys: string[]) {
  const map: Record<string, any> = {}
  for (const r of rows) {
    const k = r.campaign_name || 'Sem nome'
    if (!map[k]) { map[k] = { campaign_name: k }; valueKeys.forEach(vk => (map[k][vk] = 0)) }
    valueKeys.forEach(vk => (map[k][vk] += parseFloat(r[vk]) || 0))
  }
  return Object.values(map)
}

function metaActionValue(actions: any, type: string) {
  if (!actions || !Array.isArray(actions)) return 0
  const a = actions.find((x: any) => x.action_type === type)
  return a ? parseFloat(a.value) || 0 : 0
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const { cliente_id, date_from, date_to, compare_from, compare_to } = req.query
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id obrigatório' })

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, nome, tipo, campaign_filter, meta_campaign_filter, windsor_account_id_google, windsor_account_id_meta, dashboard_webhook_url')
    .eq('id', cliente_id as string)
    .single()

  if (error || !cliente) return res.status(404).json({ error: 'Cliente não encontrado' })

  // ── LEADS (CRM básico, disponível pra qualquer cliente com dados na tabela leads) ──
  let crmBasico: any = null
  try {
    let q = supabase.from('leads').select('data, orcamento, venda, valor_orcado, fechado, utm_source, produto').eq('cliente_id', cliente_id as string)
    if (date_from) q = q.gte('data', date_from as string)
    if (date_to) q = q.lte('data', date_to as string)
    const { data: leadsRows } = await q
    if (leadsRows && leadsRows.length > 0) {
      const orcados = leadsRows.filter(l => l.orcamento)
      const vendidos = leadsRows.filter(l => l.venda)
      const porOrigem: Record<string, number> = {}
      leadsRows.forEach(l => { const src = l.utm_source || 'direto'; porOrigem[src] = (porOrigem[src] || 0) + 1 })
      crmBasico = {
        totalLeads: leadsRows.length,
        orcados: orcados.length,
        vendidos: vendidos.length,
        valorOrcado: orcados.reduce((s, l) => s + (Number(l.valor_orcado) || 0), 0),
        valorFechado: vendidos.reduce((s, l) => s + (Number(l.fechado) || 0), 0),
        taxaFechamento: orcados.length ? (vendidos.length / orcados.length) * 100 : 0,
        porOrigem: Object.entries(porOrigem).map(([origem, count]) => ({ origem, count })).sort((a, b) => b.count - a.count),
      }
    }
  } catch { /* leads é opcional — segue sem CRM básico se der erro */ }

  // ── MODO FULL: cliente tem webhook de dashboard dedicado (Kommo + Windsor, ex. Midas) ──
  if (cliente.dashboard_webhook_url) {
    try {
      const qs = new URLSearchParams()
      if (date_from) qs.set('date_from', date_from as string)
      if (date_to) qs.set('date_to', date_to as string)
      const r = await fetch(`${cliente.dashboard_webhook_url}${qs.toString() ? '?' + qs.toString() : ''}`)
      if (!r.ok) throw new Error(`Webhook respondeu ${r.status}`)
      const payload = await r.json()
      return res.status(200).json({ mode: 'full', clienteNome: cliente.nome, clienteTipo: cliente.tipo, payload, crmBasico })
    } catch (err: any) {
      // se o webhook falhar, cai pro modo 'ads' via Windsor direto como fallback
    }
  }

  // ── MODO ADS: Google/Meta via Windsor direto ──
  if (!cliente.windsor_account_id_google && !cliente.windsor_account_id_meta) {
    return res.status(200).json({ mode: 'none', clienteNome: cliente.nome, crmBasico })
  }

  const from = (date_from as string) || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const to = (date_to as string) || new Date().toISOString().slice(0, 10)

  const googleFields = ['date', 'campaign_name', 'account_id', 'spend', 'impressions', 'clicks', 'ctr', 'conversions', 'conversion_value', 'search_impression_share', 'search_top_impression_share', 'search_rank_lost_impression_share', 'average_cpm']
  const metaFields = ['date', 'campaign_name', 'account_id', 'spend', 'impressions', 'clicks', 'reach', 'frequency', 'actions', 'action_values']

  async function buildGoogle(f: string, t: string) {
    if (!cliente.windsor_account_id_google) return null
    const raw = filtrarCampanhas(filtrarPorConta(await fetchWindsor('google_ads', googleFields, f, t), cliente.windsor_account_id_google), cliente.campaign_filter)
    const daily = agregarPorDia(raw, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value'])
    const campaigns = agregarPorCampanha(raw, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value']).sort((a: any, b: any) => b.spend - a.spend)
    const totals = daily.reduce((acc: any, d: any) => {
      acc.spend += d.spend; acc.impressions += d.impressions; acc.clicks += d.clicks; acc.conversions += d.conversions; acc.conversion_value += d.conversion_value
      return acc
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 })
    const impShare = raw.length ? raw.reduce((s: number, r: any) => s + (parseFloat(r.search_impression_share) || 0), 0) / raw.length : 0
    const lostRank = raw.length ? raw.reduce((s: number, r: any) => s + (parseFloat(r.search_rank_lost_impression_share) || 0), 0) / raw.length : 0
    return { status: raw.length ? 'ativo' : 'sem_entrega', totals, daily, campaigns, auction: { impression_share: impShare, lost_rank: lostRank } }
  }

  async function buildMeta(f: string, t: string) {
    if (!cliente.windsor_account_id_meta) return null
    const raw = filtrarCampanhas(filtrarPorConta(await fetchWindsor('facebook', metaFields, f, t), cliente.windsor_account_id_meta), cliente.meta_campaign_filter || cliente.campaign_filter)
    const actionType = cliente.tipo === 'is' ? 'lead' : 'purchase'
    const withDerived = raw.map((r: any) => ({ ...r, conversions: metaActionValue(r.actions, actionType), conversion_value: metaActionValue(r.action_values, 'purchase') }))
    const daily = agregarPorDia(withDerived, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value'])
    const campaigns = agregarPorCampanha(withDerived, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value']).sort((a: any, b: any) => b.spend - a.spend)
    const totals = daily.reduce((acc: any, d: any) => {
      acc.spend += d.spend; acc.impressions += d.impressions; acc.clicks += d.clicks; acc.conversions += d.conversions; acc.conversion_value += d.conversion_value
      return acc
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 })
    return { status: raw.length ? 'ativo' : 'sem_entrega', totals, daily, campaigns }
  }

  try {
    const [google, meta, googleCmp, metaCmp] = await Promise.all([
      buildGoogle(from, to),
      buildMeta(from, to),
      compare_from && compare_to ? buildGoogle(compare_from as string, compare_to as string) : Promise.resolve(null),
      compare_from && compare_to ? buildMeta(compare_from as string, compare_to as string) : Promise.resolve(null),
    ])

    const cost = (google?.totals.spend || 0) + (meta?.totals.spend || 0)
    const conv = (google?.totals.conversions || 0) + (meta?.totals.conversions || 0)
    const convValue = (google?.totals.conversion_value || 0) + (meta?.totals.conversion_value || 0)
    const blended: any = {
      cost, conversions: conv, conversion_value: convValue,
      cpl: conv > 0 ? cost / conv : null,
      roas: cost > 0 && convValue > 0 ? convValue / cost : null,
    }
    if (crmBasico && crmBasico.vendidos > 0) blended.cac = cost / crmBasico.vendidos
    const costCmp = (googleCmp?.totals.spend || 0) + (metaCmp?.totals.spend || 0)
    const convCmp = (googleCmp?.totals.conversions || 0) + (metaCmp?.totals.conversions || 0)

    return res.status(200).json({
      mode: 'ads', clienteNome: cliente.nome, clienteTipo: cliente.tipo,
      google, meta, blended,
      compare: (compare_from && compare_to) ? { cost: costCmp, conversions: convCmp } : null,
      crmBasico,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
