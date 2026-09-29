import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { createClient } from '@supabase/supabase-js'
import authOptions from '../../lib/authOptions'
import { buildGoogle, buildMeta } from '../../lib/windsorAds'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Visão de portfólio pra tela de Resultados: um resumo por cliente (não o detalhe
// completo), pra dar em segundos a mesma leitura que hoje só saía de abrir cliente
// por cliente à mão — mesma régua de status usada no diagnóstico manual de 24/09
// ("Raio-X de Tráfego"): clique real sem nenhuma conversão = crítico (suspeita de
// rastreamento quebrado, não desempenho); leilão perdendo muito por orçamento ou
// por rank/qualidade = atenção; resto = saudável.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Não autorizado' })

  const days = Math.max(1, Number(req.query.days) || 7)
  const dateTo = new Date().toISOString().slice(0, 10)
  const dateFrom = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, tipo, ativo, windsor_account_id_google, windsor_account_id_meta, campaign_filter, meta_campaign_filter')
    .eq('ativo', true)
    .order('nome')

  if (error) return res.status(500).json({ error: error.message })

  const clientes = data || []

  const resultados = await Promise.all(clientes.map(async (cliente) => {
    const temWindsor = !!(cliente.windsor_account_id_google || cliente.windsor_account_id_meta)
    if (!temWindsor) {
      return { id: cliente.id, nome: cliente.nome, tipo: cliente.tipo, status: 'sem_dado' as const }
    }

    try {
      const [google, meta] = await Promise.all([
        buildGoogle(cliente, dateFrom, dateTo),
        buildMeta(cliente, dateFrom, dateTo),
      ])

      const spend = (google?.totals.spend || 0) + (meta?.totals.spend || 0)
      const clicks = (google?.totals.clicks || 0) + (meta?.totals.clicks || 0)
      const impressions = (google?.totals.impressions || 0) + (meta?.totals.impressions || 0)
      const conversions = (google?.totals.conversions || 0) + (meta?.totals.conversions || 0)
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpl = conversions > 0 ? spend / conversions : null

      const semEntrega = (!google || google.status === 'sem_entrega') && (!meta || meta.status === 'sem_entrega')

      let status: 'critico' | 'atencao' | 'saudavel' | 'sem_entrega'
      if (semEntrega) {
        status = 'sem_entrega'
      } else if (clicks >= 20 && conversions === 0) {
        // volume real de clique sem nenhuma conversão — mesmo padrão achado na
        // Óticas Vejja (306 cliques / 0 conversões): mais provável ser ação de
        // conversão mal configurada do que desempenho ruim.
        status = 'critico'
      } else {
        const budgetAlto = (google?.auction?.lost_budget || 0) > 40
        const rankAlto = (google?.auction?.lost_rank || 0) > 60
        status = (budgetAlto || rankAlto) ? 'atencao' : 'saudavel'
      }

      return {
        id: cliente.id, nome: cliente.nome, tipo: cliente.tipo, status,
        spend, clicks, impressions, conversions, ctr, cpl,
        temGoogle: !!google, temMeta: !!meta,
        auction: google?.auction || null,
      }
    } catch (err: any) {
      return { id: cliente.id, nome: cliente.nome, tipo: cliente.tipo, status: 'erro' as const, erro: err.message }
    }
  }))

  return res.status(200).json({ dateFrom, dateTo, resultados })
}
