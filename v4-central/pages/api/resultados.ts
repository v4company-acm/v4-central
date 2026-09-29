import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'
import { buildGoogle, buildMeta } from '../../lib/windsorAds'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Casa o utm_source de um lead com o canal de mídia paga correspondente — string matching
// simples e explícito (não é atribuição multi-touch, é só pra montar a tabela comparativa).
function canalDoUtm(utmSource: string | null | undefined): 'google' | 'meta' | 'outro' {
  const s = (utmSource || '').toLowerCase()
  if (/google|adwords|gclid/.test(s)) return 'google'
  if (/meta|facebook|instagram|^fb$|^ig$/.test(s)) return 'meta'
  return 'outro'
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
  // Importante: a tabela `leads` não tem coluna de motivo de perda nem de estágio
  // intermediário — só orçamento (bool) e venda (bool). O funil abaixo reflete
  // exatamente isso (Lead -> Orçado -> Vendido); "perdido" aqui é inferido como
  // "foi orçado mas não venceu", sem detalhar o motivo, porque a fonte não registra isso.
  let crmBasico: any = null
  try {
    let q = supabase.from('leads').select('data, orcamento, venda, valor_orcado, em_aberto, fechado, utm_source, produto').eq('cliente_id', cliente_id as string)
    if (date_from) q = q.gte('data', date_from as string)
    if (date_to) q = q.lte('data', date_to as string)
    const { data: leadsRows } = await q
    if (leadsRows && leadsRows.length > 0) {
      const orcados = leadsRows.filter(l => l.orcamento)
      const vendidos = leadsRows.filter(l => l.venda)
      const perdidos = orcados.filter(l => !l.venda)

      function resumoDoGrupo(rows: typeof leadsRows) {
        const orc = rows.filter(l => l.orcamento)
        const vend = rows.filter(l => l.venda)
        return {
          leads: rows.length,
          orcados: orc.length,
          vendidos: vend.length,
          valorOrcado: orc.reduce((s, l) => s + (Number(l.valor_orcado) || 0), 0),
          valorFechado: vend.reduce((s, l) => s + (Number(l.fechado) || 0), 0),
          taxaFechamento: orc.length ? (vend.length / orc.length) * 100 : 0,
        }
      }

      const porOrigemMap: Record<string, typeof leadsRows> = {}
      leadsRows.forEach(l => { const src = l.utm_source || 'direto'; (porOrigemMap[src] = porOrigemMap[src] || []).push(l) })
      const porOrigem = Object.entries(porOrigemMap)
        .map(([origem, rows]) => ({ origem, ...resumoDoGrupo(rows) }))
        .sort((a, b) => b.leads - a.leads)

      const porCanalMap: Record<string, typeof leadsRows> = { google: [], meta: [], outro: [] }
      leadsRows.forEach(l => porCanalMap[canalDoUtm(l.utm_source)].push(l))
      const porCanal = {
        google: resumoDoGrupo(porCanalMap.google),
        meta: resumoDoGrupo(porCanalMap.meta),
        outro: resumoDoGrupo(porCanalMap.outro),
      }

      crmBasico = {
        totalLeads: leadsRows.length,
        orcados: orcados.length,
        vendidos: vendidos.length,
        perdidos: perdidos.length,
        valorOrcado: orcados.reduce((s, l) => s + (Number(l.valor_orcado) || 0), 0),
        valorFechado: vendidos.reduce((s, l) => s + (Number(l.fechado) || 0), 0),
        valorEmAberto: leadsRows.reduce((s, l) => s + (Number(l.em_aberto) || 0), 0),
        taxaLeadParaOrcado: leadsRows.length ? (orcados.length / leadsRows.length) * 100 : 0,
        taxaFechamento: orcados.length ? (vendidos.length / orcados.length) * 100 : 0,
        porOrigem,
        porCanal,
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

  try {
    const [google, meta, googleCmp, metaCmp] = await Promise.all([
      buildGoogle(cliente, from, to),
      buildMeta(cliente, from, to),
      compare_from && compare_to ? buildGoogle(cliente, compare_from as string, compare_to as string) : Promise.resolve(null),
      compare_from && compare_to ? buildMeta(cliente, compare_from as string, compare_to as string) : Promise.resolve(null),
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

    // ── Comparativo de canais: mídia (Windsor) + resultado real de vendas (CRM), lado a lado.
    // O "vendas/faturamento" aqui vem do CRM (fonte de verdade sobre o que realmente fechou),
    // não do pixel de conversão da plataforma — por isso pode diferir das "conversões" acima.
    const comparativoCanais = [
      google && { canal: 'Google Ads', spend: google.totals.spend, clicks: google.totals.clicks, impressions: google.totals.impressions, conversoesPlataforma: google.totals.conversions, vendasCrm: crmBasico?.porCanal?.google?.vendidos ?? null, faturamentoCrm: crmBasico?.porCanal?.google?.valorFechado ?? null, roasCrm: crmBasico?.porCanal?.google?.valorFechado && google.totals.spend ? crmBasico.porCanal.google.valorFechado / google.totals.spend : null },
      meta && { canal: 'Meta Ads', spend: meta.totals.spend, clicks: meta.totals.clicks, impressions: meta.totals.impressions, conversoesPlataforma: meta.totals.conversions, vendasCrm: crmBasico?.porCanal?.meta?.vendidos ?? null, faturamentoCrm: crmBasico?.porCanal?.meta?.valorFechado ?? null, roasCrm: crmBasico?.porCanal?.meta?.valorFechado && meta.totals.spend ? crmBasico.porCanal.meta.valorFechado / meta.totals.spend : null },
    ].filter(Boolean)

    return res.status(200).json({
      mode: 'ads', clienteNome: cliente.nome, clienteTipo: cliente.tipo,
      google, meta, blended, comparativoCanais,
      compare: (compare_from && compare_to) ? { cost: costCmp, conversions: convCmp } : null,
      crmBasico,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
