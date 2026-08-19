import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  if (req.method === 'GET') {
    const { cliente_id } = req.query
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id obrigatório' })
    const { data, error } = await supabase
      .from('action_plans')
      .select('*')
      .eq('cliente_id', cliente_id as string)
      .order('prazo', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ plans: data || [] })
  }

  if (req.method === 'POST') {
    const { cliente_id, health_check_id, dominio, descricao, responsavel, prazo, criado_por } = req.body
    if (!cliente_id || !dominio || !descricao || !responsavel || !prazo || !criado_por) return res.status(400).json({ error: 'Campos obrigatórios faltando' })
    const { data: row, error } = await supabase
      .from('action_plans')
      .insert({ cliente_id, health_check_id: health_check_id || null, dominio, descricao, responsavel, prazo, criado_por, status: 'pendente' })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ plan: row })
  }

  if (req.method === 'PATCH') {
    const { id, status, resultado, confirmado_por } = req.body
    if (!id || !status || !confirmado_por) return res.status(400).json({ error: 'Campos obrigatórios faltando' })
    const { data: row, error } = await supabase
      .from('action_plans')
      .update({ status, resultado: resultado || null, confirmado_por, confirmado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ plan: row })
  }

  res.status(405).end()
}
