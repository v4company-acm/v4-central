import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  return date.toISOString().slice(0, 10)
}

// Aplica um template de roteiro a um cliente: cria o registro do roadmap e gera de uma
// vez todas as tarefas datadas a partir da data_inicio (semana 1 = data_inicio), em vez
// de alguém preencher célula por célula como na planilha.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })
  if (req.method !== 'POST') return res.status(405).end()

  const { cliente_id, template_id, data_inicio, criado_por } = req.body
  if (!cliente_id || !template_id || !data_inicio) return res.status(400).json({ error: 'Campos obrigatórios faltando' })

  const { data: template, error: eT } = await supabase.from('playbook_templates').select('*').eq('id', template_id).single()
  if (eT || !template) return res.status(404).json({ error: 'Template não encontrado' })

  const { data: fases, error: eF } = await supabase.from('playbook_template_fases').select('*').eq('template_id', template_id).order('ordem')
  if (eF) return res.status(500).json({ error: eF.message })
  const faseIds = (fases || []).map((f: any) => f.id)
  const { data: tarefas, error: eTa } = await supabase.from('playbook_template_tarefas').select('*').in('fase_id', faseIds)
  if (eTa) return res.status(500).json({ error: eTa.message })
  const nomePorFase: Record<number, string> = Object.fromEntries((fases || []).map((f: any) => [f.id, f.nome]))

  const { data: roadmap, error: eR } = await supabase
    .from('playbook_roadmaps')
    .insert({ cliente_id, template_id, template_nome: template.nome, data_inicio, criado_por: criado_por || null })
    .select().single()
  if (eR) return res.status(500).json({ error: eR.message })

  const itensParaInserir = (tarefas || []).map((t: any) => ({
    cliente_id, regra_id: null, roadmap_id: roadmap.id, fase: nomePorFase[t.fase_id] || null,
    titulo: t.titulo, tipo: t.tipo, data_prevista: addDays(data_inicio, (t.semana - 1) * 7),
    responsavel: t.papel || null, criado_por: criado_por || null,
  }))

  if (itensParaInserir.length > 0) {
    const { error: eI } = await supabase.from('playbook_itens').insert(itensParaInserir)
    if (eI) return res.status(500).json({ error: eI.message })
  }

  return res.status(201).json({ roadmap, criados: itensParaInserir.length })
}
