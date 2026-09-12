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
      .from('playbook_itens')
      .select('*')
      .eq('cliente_id', cliente_id as string)
      .order('data_prevista', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ itens: data || [] })
  }

  // Compromisso avulso — não vem de uma regra recorrente (ex: "Apresentação de resultados Q3").
  if (req.method === 'POST') {
    const { cliente_id, titulo, descricao, tipo, data_prevista, responsavel, criado_por } = req.body
    if (!cliente_id || !titulo || !tipo || !data_prevista) return res.status(400).json({ error: 'Campos obrigatórios faltando' })
    const { data: item, error } = await supabase
      .from('playbook_itens')
      .insert({ cliente_id, regra_id: null, titulo, descricao: descricao || null, tipo, data_prevista, responsavel: responsavel || null, criado_por: criado_por || null })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ item })
  }

  if (req.method === 'PATCH') {
    const { id, status, data_entrega, observacao } = req.body
    if (!id || !status) return res.status(400).json({ error: 'Campos obrigatórios faltando' })
    const patch: any = { status, observacao: observacao ?? null }
    if (status === 'entregue') patch.data_entrega = data_entrega || new Date().toISOString().slice(0, 10)
    if (status === 'pendente') patch.data_entrega = null
    const { data: item, error } = await supabase.from('playbook_itens').update(patch).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ item })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obrigatório' })
    const { error } = await supabase.from('playbook_itens').delete().eq('id', id as string)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
