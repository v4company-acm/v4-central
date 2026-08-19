import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Devolve o health check mais recente de CADA domínio (trafego/comercial/projeto)
// por cliente — usado pro dashboard e pra tela unificada de Health Score, sem
// precisar buscar o histórico completo de cada cliente um por um.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const { data, error } = await supabase
    .from('health_checks')
    .select('cliente_id, status, score, data, dominio, metricas')
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const porCliente: Record<string, { trafego: any; comercial: any; projeto: any }> = {}
  for (const row of data || []) {
    if (!porCliente[row.cliente_id]) porCliente[row.cliente_id] = { trafego: null, comercial: null, projeto: null }
    const slot = porCliente[row.cliente_id]
    if (row.dominio === 'trafego' && !slot.trafego) slot.trafego = row
    if (row.dominio === 'comercial' && !slot.comercial) slot.comercial = row
    if (row.dominio === 'projeto' && !slot.projeto) slot.projeto = row
  }

  const { data: pendentes } = await supabase
    .from('action_plans')
    .select('cliente_id')
    .eq('status', 'pendente')
    .lt('prazo', new Date().toISOString().slice(0, 10))

  const planosAtrasadosPorCliente: Record<string, number> = {}
  for (const p of pendentes || []) planosAtrasadosPorCliente[p.cliente_id] = (planosAtrasadosPorCliente[p.cliente_id] || 0) + 1

  return res.status(200).json({ porCliente, planosAtrasados: planosAtrasadosPorCliente })
}
