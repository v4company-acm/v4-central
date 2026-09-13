import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Todos os itens pendentes de todos os clientes, com o nome do cliente já resolvido —
// alimenta o quadro kanban unificado (visão de portfólio) sem precisar buscar cliente
// por cliente.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const { data: itens, error } = await supabase
    .from('playbook_itens')
    .select('*')
    .eq('status', 'pendente')
    .order('data_prevista', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })

  const clienteIds = [...new Set((itens || []).map((i: any) => i.cliente_id))]
  let nomePorCliente: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: clientesRows } = await supabase.from('clients').select('id, nome').in('id', clienteIds)
    nomePorCliente = Object.fromEntries((clientesRows || []).map((c: any) => [c.id, c.nome]))
  }

  const itensComNome = (itens || []).map((i: any) => ({ ...i, cliente_nome: nomePorCliente[i.cliente_id] || 'Cliente' }))
  return res.status(200).json({ itens: itensComNome })
}
