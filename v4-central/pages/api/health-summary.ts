import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Devolve o health check de PROJETO mais recente de cada cliente — usado
// pro dashboard (card do cliente + KPI strip) sem ter que buscar tudo.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const { data, error } = await supabase
    .from('health_checks')
    .select('cliente_id, status, score, data, dominio')
    .eq('dominio', 'projeto')
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const latestPorCliente: Record<string, any> = {}
  for (const row of data || []) {
    if (!latestPorCliente[row.cliente_id]) latestPorCliente[row.cliente_id] = row
  }

  const { data: pendentes } = await supabase
    .from('action_plans')
    .select('cliente_id')
    .eq('status', 'pendente')
    .lt('prazo', new Date().toISOString().slice(0, 10))

  const planosAtrasadosPorCliente: Record<string, number> = {}
  for (const p of pendentes || []) planosAtrasadosPorCliente[p.cliente_id] = (planosAtrasadosPorCliente[p.cliente_id] || 0) + 1

  return res.status(200).json({ porCliente: latestPorCliente, planosAtrasados: planosAtrasadosPorCliente })
}
