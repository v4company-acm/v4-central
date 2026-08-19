import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import authOptions from '../../lib/authOptions'
import { readJSON, writeJSON } from '../../lib/db'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  if (req.method === 'GET') {
    const clients = await readJSON('clients')
    return res.status(200).json(clients)
  }

  if (req.method === 'POST') {
    const clients = await readJSON('clients')
    const newClient = {
      id: uuidv4(),
      ...req.body,
      otimizacoes: [],
      reunioes: [],
      anotacoes: [],
      arquivos: [],
      metricas: {},
    }
    clients.push(newClient)
    await writeJSON('clients', clients)
    return res.status(201).json(newClient)
  }

  res.status(405).end()
}
