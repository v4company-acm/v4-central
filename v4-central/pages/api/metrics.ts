import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import authOptions from '../../lib/authOptions'
import { kv } from '@vercel/kv'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Não autorizado' })
    const { clienteId } = req.query
    const key = clienteId ? `metrics_${clienteId}` : 'metrics'
    const data = await kv.get(key)
    return res.status(200).json(data || {})
  }

  if (req.method === 'POST') {
    const secret = req.headers['x-api-secret']
    if (secret !== process.env.METRICS_SECRET)
      return res.status(401).json({ error: 'Não autorizado' })
    const { clienteId, metrics } = req.body
    const key = `metrics_${clienteId}`
    await kv.set(key, metrics)
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
