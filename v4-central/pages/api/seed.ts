import { NextApiRequest, NextApiResponse } from 'next'
import { kv } from '@vercel/kv'
import bcrypt from 'bcryptjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const existing = await kv.get('users')
  if (existing) return res.status(400).json({ error: 'Seed já executado' })

  const hashed = await bcrypt.hash('admin123', 10)
  const users = [{
    id: '1',
    name: 'Admin',
    email: 'admin@v4company.com',
    password: hashed,
    role: 'admin'
  }]

  await kv.set('users', users)
  return res.status(200).json({ ok: true })
}
