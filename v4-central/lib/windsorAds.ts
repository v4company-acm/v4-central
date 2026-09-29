// Lógica de leitura do Windsor.ai (Google Ads + Meta Ads) compartilhada entre
// a tela de detalhe de um cliente (pages/api/resultados.ts) e a visão geral
// de portfólio (pages/api/resultados-overview.ts). Extraído pra não duplicar
// a mesma lógica duas vezes — e pra corrigir os dois bugs abaixo num lugar só.

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY!
const WINDSOR_BASE = 'https://connectors.windsor.ai'

export interface ClienteAdsConfig {
  windsor_account_id_google?: string | null
  windsor_account_id_meta?: string | null
  campaign_filter?: string | null
  meta_campaign_filter?: string | null
  tipo?: string | null
}

export const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

export function filtrarPorConta(data: any[], accountId?: string | null) {
  if (!accountId) return data
  const alvo = onlyDigits(accountId)
  return data.filter(r => onlyDigits(r.account_id) === alvo)
}

export function filtrarCampanhas(data: any[], filtro?: string | null) {
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

export function agregarPorDia(rows: any[], valueKeys: string[]) {
  const map: Record<string, any> = {}
  for (const r of rows) {
    const d = r.date
    if (!map[d]) { map[d] = { date: d }; valueKeys.forEach(k => (map[d][k] = 0)) }
    valueKeys.forEach(k => (map[d][k] += parseFloat(r[k]) || 0))
  }
  return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date))
}

// Windsor não documenta um nome único de campo pra "grupo de anúncio" por canal —
// tentamos os candidatos mais comuns e usamos o primeiro que vier populado.
function normAdGroup(r: any): string | null {
  return r.ad_group || r.adgroup_name || r.ad_group_name || r.adset_name || r.adset || null
}

export function agregarPorCampanha(rows: any[], valueKeys: string[]) {
  const map: Record<string, any> = {}
  for (const r of rows) {
    const k = r.campaign_name || 'Sem nome'
    if (!map[k]) { map[k] = { campaign_name: k, adGroups: {} }; valueKeys.forEach(vk => (map[k][vk] = 0)) }
    valueKeys.forEach(vk => (map[k][vk] += parseFloat(r[vk]) || 0))

    const ag = normAdGroup(r)
    if (ag) {
      if (!map[k].adGroups[ag]) { map[k].adGroups[ag] = { name: ag }; valueKeys.forEach(vk => (map[k].adGroups[ag][vk] = 0)) }
      valueKeys.forEach(vk => (map[k].adGroups[ag][vk] += parseFloat(r[vk]) || 0))
    }
  }
  return Object.values(map).map((c: any) => ({ ...c, adGroups: Object.values(c.adGroups).sort((a: any, b: any) => b.spend - a.spend) }))
}

function metaActionValue(actions: any, type: string) {
  if (!actions || !Array.isArray(actions)) return 0
  const a = actions.find((x: any) => x.action_type === type)
  return a ? parseFloat(a.value) || 0 : 0
}

// FIX: clientes tipo 'is' que captam por clique-pra-WhatsApp/Messenger nunca disparam
// o evento 'lead' clássico (formulário) — o resultado real deles é
// 'onsite_conversion.messaging_conversation_started_7d' ("Conversas iniciadas" no
// Gerenciador de Anúncios). Somamos os dois em vez de só reconhecer 'lead', senão
// contas como Óticas Vejja e Clínica Angioprime aparecem pra sempre com CPL/leads
// zerados aqui, mesmo convertendo de verdade. Mesmo ajuste já aplicado no nó
// "Guarda META" do workflow n8n RELATORIO DE TRAFEGO em 24/09.
function metaConversions(actions: any, tipo?: string | null) {
  if (tipo === 'is') {
    return metaActionValue(actions, 'lead') + metaActionValue(actions, 'onsite_conversion.messaging_conversation_started_7d')
  }
  return metaActionValue(actions, 'purchase')
}

const googleFields = ['date', 'campaign_name', 'account_id', 'spend', 'impressions', 'clicks', 'ctr', 'conversions', 'conversion_value', 'search_impression_share', 'search_top_impression_share', 'search_rank_lost_impression_share', 'average_cpm', 'ad_group', 'adgroup_name', 'ad_group_name']
const metaFields = ['date', 'campaign_name', 'account_id', 'spend', 'impressions', 'clicks', 'reach', 'frequency', 'actions', 'action_values', 'adset_name', 'adset']

export async function buildGoogle(cliente: ClienteAdsConfig, f: string, t: string) {
  if (!cliente.windsor_account_id_google) return null
  const raw = filtrarCampanhas(filtrarPorConta(await fetchWindsor('google_ads', googleFields, f, t), cliente.windsor_account_id_google), cliente.campaign_filter)
  const daily = agregarPorDia(raw, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value'])
  const campaigns = agregarPorCampanha(raw, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value']).sort((a: any, b: any) => b.spend - a.spend)
  const totals = daily.reduce((acc: any, d: any) => {
    acc.spend += d.spend; acc.impressions += d.impressions; acc.clicks += d.clicks; acc.conversions += d.conversions; acc.conversion_value += d.conversion_value
    return acc
  }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 })

  // FIX: os campos do Windsor (search_impression_share, search_rank_lost_impression_share)
  // vêm como fração de 1 (ex. 0.2381 = 23,81%), mas a UI (fmtPct/largura de barra) já
  // espera número em escala de 0-100 — sem multiplicar por 100 as barras de leilão
  // ficavam ilegíveis (largura ~0,2% em vez de ~24%). Multiplicamos aqui, na origem.
  // FIX: 'Perdido por orçamento' nunca era calculado nem devolvido (só impression_share
  // e lost_rank existiam) — a UI já tinha o bloco pronto pra essa barra, só faltava o
  // dado. Estimamos como o resto: 100% − parcela ganha − perdida por rank (mesmo método
  // usado no diagnóstico manual de 24/09, "Raio-X de Tráfego").
  const impShare = raw.length ? (raw.reduce((s: number, r: any) => s + (parseFloat(r.search_impression_share) || 0), 0) / raw.length) * 100 : 0
  const lostRank = raw.length ? (raw.reduce((s: number, r: any) => s + (parseFloat(r.search_rank_lost_impression_share) || 0), 0) / raw.length) * 100 : 0
  const lostBudget = raw.length ? Math.max(0, 100 - impShare - lostRank) : 0

  return {
    status: raw.length ? 'ativo' : 'sem_entrega', totals, daily, campaigns,
    auction: { impression_share: impShare, lost_rank: lostRank, lost_budget: lostBudget },
  }
}

export async function buildMeta(cliente: ClienteAdsConfig, f: string, t: string) {
  if (!cliente.windsor_account_id_meta) return null
  const raw = filtrarCampanhas(filtrarPorConta(await fetchWindsor('facebook', metaFields, f, t), cliente.windsor_account_id_meta), cliente.meta_campaign_filter || cliente.campaign_filter)
  const withDerived = raw.map((r: any) => ({ ...r, conversions: metaConversions(r.actions, cliente.tipo), conversion_value: metaActionValue(r.action_values, 'purchase') }))
  const daily = agregarPorDia(withDerived, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value'])
  const campaigns = agregarPorCampanha(withDerived, ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value']).sort((a: any, b: any) => b.spend - a.spend)
  const totals = daily.reduce((acc: any, d: any) => {
    acc.spend += d.spend; acc.impressions += d.impressions; acc.clicks += d.clicks; acc.conversions += d.conversions; acc.conversion_value += d.conversion_value
    return acc
  }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 })
  return { status: raw.length ? 'ativo' : 'sem_entrega', totals, daily, campaigns }
}
