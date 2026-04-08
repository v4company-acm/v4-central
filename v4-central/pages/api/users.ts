import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import authOptions from '../../lib/authOptions'
import { readJSON, writeJSON } from '../../lib/db'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })
  const isAdmin = (session.user as any).role === 'admin'

  if (req.method === 'GET') {
    const users = readJSON('users.json').map((u: any) => ({
      id: u.id, name: u.name, email: u.email, role: u.role
    }))
    return res.status(200).json(users)
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Apenas admins podem criar usuários' })
    const { name, email, password, role } = req.body
    const users = readJSON('users.json')
    if (users.find((u: any) => u.email === email))
      return res.status(400).json({ error: 'Email já cadastrado' })
    const hashed = await bcrypt.hash(password, 10)
    const newUser = { id: uuidv4(), name, email, password: hashed, role: role || 'member' }
    users.push(newUser)
    writeJSON('users.json', users)
    const { password: _, ...safe } = newUser
    return res.status(201).json(safe)
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Apenas admins podem remover usuários' })
    const { id } = req.body
    const users = readJSON('users.json')
    const filtered = users.filter((u: any) => u.id !== id)
    writeJSON('users.json', filtered)
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
