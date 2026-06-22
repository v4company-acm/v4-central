// pages/api/performance.ts
import type { NextApiRequest, NextApiResponse } from 'next'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY!
const WINDSOR_BASE = 'https://connectors.windsor.ai'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    account_id = '1568340447',
    date_from,
    date_to,
    compare_from,
    compare_to,
  } = req.query

  const fields = [
    'date',
    'impressions',
    'clicks',
    'ctr',
    'spend',
    'conversions',
    'conversion_rate',
    'cost_per_conversion',
    'search_impression_share',
    'search_top_impression_share',
    'search_absolute_top_impression_share',
    'search_lost_impression_share_rank',
    'search_lost_impression_share_budget',
  ].join(',')

  async function fetchWindsor(from: string, to: string) {
    const url = `${WINDSOR_BASE}/google_ads?api_key=${WINDSOR_API_KEY}&fields=${fields}&date_from=${from}&date_to=${to}&account_id=${account_id}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Windsor error: ${r.status}`)
    const json = await r.json()
    return json.data || []
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
