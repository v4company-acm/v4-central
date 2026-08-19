import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import authOptions from '../../../lib/authOptions'
import { readJSON, writeJSON } from '../../../lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const { id } = req.query
  const clients = await readJSON('clients')
  const idx = clients.findIndex((c: any) => c.id === id)

  if (req.method === 'GET') {
    if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado' })
    return res.status(200).json(clients[idx])
  }

  if (req.method === 'PUT') {
    if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado' })
    clients[idx] = { ...clients[idx], ...req.body }
    await writeJSON('clients', clients)
    return res.status(200).json(clients[idx])
  }

  if (req.method === 'DELETE') {
    if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado' })
    const removed = clients.splice(idx, 1)
    await writeJSON('clients', clients)
    return res.status(200).json(removed[0])
  }

  res.status(405).end()
}
