import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Resumo por cliente pra tela unificada de Playbook: quantas regras ativas, quantas
// entregas atrasadas/pendentes, e a próxima data prevista — sem precisar buscar
// cliente por cliente.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const hoje = new Date().toISOString().slice(0, 10)

  const [{ data: regras, error: e1 }, { data: itens, error: e2 }] = await Promise.all([
    supabase.from('playbook_regras').select('cliente_id, ativo'),
    supabase.from('playbook_itens').select('cliente_id, data_prevista, status'),
  ])
  if (e1) return res.status(500).json({ error: e1.message })
  if (e2) return res.status(500).json({ error: e2.message })

  const porCliente: Record<string, { regrasAtivas: number; pendentes: number; atrasados: number; proxima: string | null }> = {}
  const slot = (id: string) => (porCliente[id] ||= { regrasAtivas: 0, pendentes: 0, atrasados: 0, proxima: null })

  for (const r of regras || []) if (r.ativo) slot(r.cliente_id).regrasAtivas++

  for (const it of itens || []) {
    if (it.status !== 'pendente') continue
    const s = slot(it.cliente_id)
    s.pendentes++
    if (it.data_prevista < hoje) s.atrasados++
    else if (!s.proxima || it.data_prevista < s.proxima) s.proxima = it.data_prevista
  }

  return res.status(200).json({ porCliente })
}
