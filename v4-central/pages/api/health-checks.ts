import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Dados mudam a cada registro/exclusão — nunca serve uma resposta em cache (evita
  // ficar mostrando um histórico velho/vazio depois de salvar ou excluir um check).
  res.setHeader('Cache-Control', 'no-store, must-revalidate')

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  if (req.method === 'GET') {
    const { cliente_id } = req.query
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id obrigatório' })
    const { data, error } = await supabase
      .from('health_checks')
      .select('*')
      .eq('cliente_id', cliente_id as string)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ checks: data || [] })
  }

  if (req.method === 'POST') {
    const { cliente_id, dominio, data, autor, score, status, metricas, playbook_em_dia, observacao } = req.body
    if (!cliente_id || !dominio || !data || !autor || !status) return res.status(400).json({ error: 'Campos obrigatórios faltando' })
    const { data: row, error } = await supabase
      .from('health_checks')
      .insert({ cliente_id, dominio, data, autor, score, status, metricas: metricas || [], playbook_em_dia: playbook_em_dia || null, observacao: observacao || null })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ check: row })
  }

  if (req.method === 'DELETE') {
    if ((session.user as any)?.role !== 'admin') return res.status(403).json({ error: 'Só administradores podem excluir registros de Health Score' })
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obrigatório' })
    const { error } = await supabase.from('health_checks').delete().eq('id', id as string)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
