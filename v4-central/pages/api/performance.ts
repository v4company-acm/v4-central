// pages/api/performance.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY!
const WINDSOR_BASE    = 'https://connectors.windsor.ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function filterCampaigns(data: any[], filter?: string | null) {
  if (!filter) return data
  const filters = filter.split(',').map(f => f.toLowerCase().trim())
  return data.filter(r =>
    filters.some(f => (r.campaign_name || '').toLowerCase().includes(f))
  )
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { cliente_id, date_from, date_to, compare_from, compare_to } = req.query

  // Busca dados do cliente no Supabase
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('nome, windsor_account_id_google, campaign_filter')
    .eq('id', cliente_id as string)
    .single()

  if (error || !cliente) {
    return res.status(400).json({ error: 'Cliente não encontrado' })
  }

  if (!cliente.windsor_account_id_google) {
    return res.status(400).json({ error: 'Cliente não tem conta Google Ads configurada' })
  }

  const fields = [
    'date',
    'campaign_name',
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'conversions',
    'search_impression_share',
    'search_top_impression_share',
    'search_rank_lost_impression_share',
    'search_budget_lost_impression_share',
  ].join(',')

  async function fetchWindsor(from: string, to: string) {
    const url = `${WINDSOR_BASE}/google_ads?api_key=${WINDSOR_API_KEY}&date_from=${from}&date_to=${to}&customer_id=${cliente.windsor_account_id_google}&fields=${fields}`
    const r    = await fetch(url)
    if (!r.ok) throw new Error(`Windsor error: ${r.status}`)
    const json = await r.json()
    return filterCampaigns(json.data || [], cliente.campaign_filter)
  }

  try {
    const [current, compare] = await Promise.all([
      fetchWindsor(date_from as string, date_to as string),
      compare_from && compare_to
        ? fetchWindsor(compare_from as string, compare_to as string)
        : Promise.resolve([]),
    ])
    res.json({ current, compare, cliente_nome: cliente.nome })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
