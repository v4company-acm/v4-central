import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'
import { gerarDatas } from '../../lib/playbook'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Gera (idempotente) os itens datados dos próximos ~3 meses pra uma regra —
// insere só o que ainda não existe pra (regra_id, data_prevista).
async function gerarItensDaRegra(regra: any) {
  const datas = gerarDatas(regra)
  if (datas.length === 0) return 0
  const { data: existentes } = await supabase
    .from('playbook_itens')
    .select('data_prevista')
    .eq('regra_id', regra.id)
    .in('data_prevista', datas)
  const jaExistem = new Set((existentes || []).map(r => r.data_prevista))
  const novos = datas.filter(d => !jaExistem.has(d))
  if (novos.length === 0) return 0
  const { error } = await supabase.from('playbook_itens').insert(
    novos.map(data_prevista => ({
      cliente_id: regra.cliente_id, regra_id: regra.id, titulo: regra.titulo,
      descricao: regra.descricao || null, tipo: regra.tipo, data_prevista,
      responsavel: regra.responsavel || null, criado_por: regra.criado_por || null,
    }))
  )
  return error ? 0 : novos.length
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  if (req.method === 'GET') {
    const { cliente_id } = req.query
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id obrigatório' })
    const { data, error } = await supabase
      .from('playbook_regras')
      .select('*')
      .eq('cliente_id', cliente_id as string)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ regras: data || [] })
  }

  if (req.method === 'POST') {
    const { cliente_id, titulo, descricao, tipo, frequencia, dia_semana, dia_mes, responsavel, data_inicio, criado_por } = req.body
    if (!cliente_id || !titulo || !tipo || !frequencia) return res.status(400).json({ error: 'Campos obrigatórios faltando' })
    const { data: regra, error } = await supabase
      .from('playbook_regras')
      .insert({
        cliente_id, titulo, descricao: descricao || null, tipo, frequencia,
        dia_semana: dia_semana ?? null, dia_mes: dia_mes ?? null,
        responsavel: responsavel || null, data_inicio: data_inicio || new Date().toISOString().slice(0, 10),
        criado_por: criado_por || null,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    await gerarItensDaRegra(regra)
    return res.status(201).json({ regra })
  }

  if (req.method === 'PATCH') {
    const { id, ...campos } = req.body
    if (!id) return res.status(400).json({ error: 'id obrigatório' })
    const { data: regra, error } = await supabase
      .from('playbook_regras')
      .update(campos)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })

    if (regra.ativo === false) {
      // Regra desativada — cancela as entregas futuras ainda pendentes dela (mantém o histórico já entregue).
      await supabase.from('playbook_itens').update({ status: 'cancelado' })
        .eq('regra_id', id).eq('status', 'pendente').gte('data_prevista', new Date().toISOString().slice(0, 10))
    } else {
      await gerarItensDaRegra(regra)
    }
    return res.status(200).json({ regra })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obrigatório' })
    const { error } = await supabase.from('playbook_regras').delete().eq('id', id as string)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
