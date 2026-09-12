import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'
import { gerarDatas } from '../../lib/playbook'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Chamado ao abrir a aba de Playbook de um cliente — rola a janela dos próximos ~3 meses
// pra frente pra todas as regras ativas dele (idempotente: só insere o que ainda não existe).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })
  if (req.method !== 'POST') return res.status(405).end()

  const { cliente_id } = req.body
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id obrigatório' })

  const { data: regras, error } = await supabase
    .from('playbook_regras')
    .select('*')
    .eq('cliente_id', cliente_id)
    .eq('ativo', true)
  if (error) return res.status(500).json({ error: error.message })

  let criados = 0
  for (const regra of regras || []) {
    const datas = gerarDatas(regra)
    if (datas.length === 0) continue
    const { data: existentes } = await supabase
      .from('playbook_itens')
      .select('data_prevista')
      .eq('regra_id', regra.id)
      .in('data_prevista', datas)
    const jaExistem = new Set((existentes || []).map((r: any) => r.data_prevista))
    const novos = datas.filter(d => !jaExistem.has(d))
    if (novos.length === 0) continue
    const { error: insErr } = await supabase.from('playbook_itens').insert(
      novos.map(data_prevista => ({
        cliente_id: regra.cliente_id, regra_id: regra.id, titulo: regra.titulo,
        descricao: regra.descricao, tipo: regra.tipo, data_prevista,
        responsavel: regra.responsavel, criado_por: regra.criado_por,
      }))
    )
    if (!insErr) criados += novos.length
  }

  return res.status(200).json({ criados })
}
