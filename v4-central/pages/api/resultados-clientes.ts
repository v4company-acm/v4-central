import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Lista os clientes elegíveis pra tela de Resultados, com o "nível" de dado disponível pra cada um:
// full  = tem um webhook de dashboard dedicado (Kommo + Windsor, ex. Midas)
// ads   = tem só Google e/ou Meta Ads via Windsor
// none  = sem fonte de mídia configurada (não aparece na lista)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, tipo, ativo, windsor_account_id_google, windsor_account_id_meta, dashboard_webhook_url')
    .order('nome')

  if (error) return res.status(500).json({ error: error.message })

  const clientes = (data || [])
    .filter(c => c.dashboard_webhook_url || c.windsor_account_id_google || c.windsor_account_id_meta)
    .map(c => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      ativo: c.ativo,
      nivel: c.dashboard_webhook_url ? 'full' : 'ads',
      temGoogle: !!c.windsor_account_id_google,
      temMeta: !!c.windsor_account_id_meta,
    }))

  return res.status(200).json({ clientes })
}
