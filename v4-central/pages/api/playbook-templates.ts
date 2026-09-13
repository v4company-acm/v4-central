import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Biblioteca de templates de roteiro (fases + tarefas por semana) — pra montagem do
// picker "Aplicar Template" no Playbook do cliente.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })
  if (req.method !== 'GET') return res.status(405).end()

  const { data: templates, error: e1 } = await supabase
    .from('playbook_templates').select('*').eq('ativo', true).order('horizonte_semanas', { ascending: true })
  if (e1) return res.status(500).json({ error: e1.message })

  const templateIds = (templates || []).map((t: any) => t.id)
  const { data: fases, error: e2 } = await supabase
    .from('playbook_template_fases').select('*').in('template_id', templateIds).order('ordem', { ascending: true })
  if (e2) return res.status(500).json({ error: e2.message })

  const faseIds = (fases || []).map((f: any) => f.id)
  const { data: tarefas, error: e3 } = await supabase
    .from('playbook_template_tarefas').select('*').in('fase_id', faseIds).order('semana', { ascending: true }).order('ordem', { ascending: true })
  if (e3) return res.status(500).json({ error: e3.message })

  const tarefasPorFase: Record<number, any[]> = {}
  for (const t of tarefas || []) (tarefasPorFase[t.fase_id] ||= []).push(t)

  const fasesPorTemplate: Record<number, any[]> = {}
  for (const f of fases || []) (fasesPorTemplate[f.template_id] ||= []).push({ ...f, tarefas: tarefasPorFase[f.id] || [] })

  const resultado = (templates || []).map((t: any) => ({ ...t, fases: fasesPorTemplate[t.id] || [] }))
  return res.status(200).json({ templates: resultado })
}
