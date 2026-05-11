import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import authOptions from '../../lib/authOptions'
import { kv } from '@vercel/kv'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Não autorizado' })
    const { clienteId } = req.query
    const clients = await kv.get<any[]>('clients') || []
    const client = clients.find((c: any) => c.id === clienteId)
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
    return res.status(200).json(client.metricasHistorico || [])
  }

  if (req.method === 'POST') {
    const secret = req.headers['x-api-secret']
    if (secret !== process.env.METRICS_SECRET)
      return res.status(401).json({ error: 'Não autorizado' })
    const { clienteNome, metrica } = req.body
    const clients = await kv.get<any[]>('clients') || []
    const idx = clients.findIndex((c: any) => c.nome === clienteNome)
    if (idx === -1) return res.status(200).json({ ok: false, error: 'Cliente ' + clienteNome + ' nao cadastrado no v4-central' })
    const historico = Array.isArray(clients[idx].metricasHistorico) ? clients[idx].metricasHistorico : []
    const filtered = historico.filter((m: any) => m.data !== metrica.data)
    clients[idx].metricasHistorico = [metrica, ...filtered]
    clients[idx].metricas = metrica
    await kv.set('clients', clients)
    return res.status(200).json({ ok: true, cliente: clients[idx].nome })
  }

  res.status(405).end()
}
