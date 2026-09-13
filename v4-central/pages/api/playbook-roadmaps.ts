import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Roteiros (templates aplicados) de um cliente — só pra mostrar "já tem isso aplicado" e evitar duplicar sem querer.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })
  if (req.method !== 'GET') return res.status(405).end()

  const { cliente_id } = req.query
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id obrigatório' })
  const { data, error } = await supabase
    .from('playbook_roadmaps').select('*').eq('cliente_id', cliente_id as string).order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ roadmaps: data || [] })
}
