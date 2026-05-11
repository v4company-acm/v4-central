import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import authOptions from '../../lib/authOptions'
import { readJSON, writeJSON } from '../../lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Não autorizado' })
    const metrics = await readJSON('metrics')
    return res.status(200).json(metrics)
  }

  if (req.method === 'POST') {
    const secret = req.headers['x-api-secret']
    if (secret !== process.env.METRICS_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' })
    }
    const data = req.body
    await writeJSON('metrics', data)
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
