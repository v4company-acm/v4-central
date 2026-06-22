import type { NextApiRequest, NextApiResponse } from 'next'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY!
const WINDSOR_BASE = 'https://connectors.windsor.ai'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    customer_id = '1568340447',
    campaign_filter,
    date_from,
    date_to,
    compare_from,
    compare_to,
  } = req.query

  const fields = [
    'date',
    'campaign_name',
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'conversions',
    'conversion_rate',
    'search_impression_share',
    'search_top_impression_share',
    'search_rank_lost_impression_share',
    'average_cpm',
  ].join(',')

  function filterCampaigns(data: any[], filter?: string) {
    if (!filter) return data
    const filters = filter.split(',').map(f => f.toLowerCase().trim())
    return data.filter(r =>
      filters.some(f => (r.campaign_name || '').toLowerCase().includes(f))
    )
  }

  async function fetchWindsor(from: string, to: string) {
    const url = `${WINDSOR_BASE}/google_ads?api_key=${WINDSOR_API_KEY}&date_from=${from}&date_to=${to}&customer_id=${customer_id}&fields=${fields}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Windsor error: ${r.status}`)
    const json = await r.json()
    return filterCampaigns(json.data || [], campaign_filter as string)
  }

  try {
    const [current, compare] = await Promise.all([
      fetchWindsor(date_from as string, date_to as string),
      compare_from && compare_to
        ? fetchWindsor(compare_from as string, compare_to as string)
        : Promise.resolve([]),
    ])
    res.json({ current, compare })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
