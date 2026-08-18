import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })
  if (req.method !== 'GET') return res.status(405).end()

  const { data, error } = await supabase
    .from('gestao_projetos_status')
    .select('*')
    .order('cliente', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const syncedAt = (data || []).reduce((max: string | null, r: any) =>
    !max || (r.synced_at && r.synced_at > max) ? r.synced_at : max, null)

  return res.status(200).json({ rows: data || [], syncedAt })
}
