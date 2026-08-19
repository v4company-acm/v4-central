import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Converte objeto camelCase do frontend → snake_case do banco
function toRow(c: any) {
  return {
    id:                c.id,
    nome:              c.nome,
    stakeholder:       c.stakeholder,
    telefone:          c.telefone,
    mrr:               c.mrr,
    valor_total:       c.valorTotal,
    fidelidade:        c.fidelidade,
    data_entrada:      c.dataEntrada   || null,
    inicio_proj:       c.inicioProj    || null,
    fim_contrato:      c.fimContrato   || null,
    status:            c.status        || 'ativo',
    estrategista:      c.estrategista,
    gestor:            c.gestor,
    account:           c.account,
    closer:            c.closer,
    sdr:               c.sdr,
    link_contrato:     c.linkContrato,
    link_call:         c.linkCall,
    link_transcricao:  c.linkTranscricao,
    link_v4:           c.linkV4,
    link_bant:         c.linkBant,
    canal_origem:      c.canalOrigem,
    instagram:         c.instagram,
    site:              c.site,
    cohort:            c.cohort,
    promessa:          c.promessa,
    descricao:         c.descricao,
    cat_saber:         c.catSaber      ?? false,
    cat_ter:           c.catTer        ?? false,
    cat_executar:      c.catExecutar   ?? false,
    otimizacoes:       c.otimizacoes   ?? [],
    reunioes:          c.reunioes      ?? [],
    anotacoes:         c.anotacoes     ?? [],
    arquivos:          c.arquivos      ?? [],
    metricas:          c.metricas      ?? {},
    metricas_historico: c.metricasHistorico ?? [],
    roi_roas_checks:   c.roiRoasChecks ?? [],
    metas:             c.metas         ?? {},
    resultados_cliente_id: c.resultadosClienteId || null,
  }
}

// Converte snake_case do banco → camelCase do frontend
function fromRow(r: any) {
  return {
    id:                r.id,
    nome:              r.nome,
    stakeholder:       r.stakeholder,
    telefone:          r.telefone,
    mrr:               r.mrr,
    valorTotal:        r.valor_total,
    fidelidade:        r.fidelidade,
    dataEntrada:       r.data_entrada,
    inicioProj:        r.inicio_proj,
    fimContrato:       r.fim_contrato,
    status:            r.status,
    estrategista:      r.estrategista,
    gestor:            r.gestor,
    account:           r.account,
    closer:            r.closer,
    sdr:               r.sdr,
    linkContrato:      r.link_contrato,
    linkCall:          r.link_call,
    linkTranscricao:   r.link_transcricao,
    linkV4:            r.link_v4,
    linkBant:          r.link_bant,
    canalOrigem:       r.canal_origem,
    instagram:         r.instagram,
    site:              r.site,
    cohort:            r.cohort,
    promessa:          r.promessa,
    descricao:         r.descricao,
    catSaber:          r.cat_saber,
    catTer:            r.cat_ter,
    catExecutar:       r.cat_executar,
    otimizacoes:       r.otimizacoes       ?? [],
    reunioes:          r.reunioes          ?? [],
    anotacoes:         r.anotacoes         ?? [],
    arquivos:          r.arquivos          ?? [],
    metricas:          r.metricas          ?? {},
    metricasHistorico: r.metricas_historico ?? [],
    roiRoasChecks:     r.roi_roas_checks    ?? [],
    metas:             r.metas             ?? {},
    resultadosClienteId: r.resultados_cliente_id || null,
  }
}

export async function readJSON(key: string): Promise<any[]> {
  if (key === 'users') {
    const { data } = await supabase.from('users').select('*')
    return data || []
  }
  if (key === 'clients') {
    const { data } = await supabase.from('clients').select('*')
    return (data || []).map(fromRow)
  }
  return []
}

export async function writeJSON(key: string, data: any[]): Promise<void> {
  if (key === 'clients') {
    const { data: existing } = await supabase.from('clients').select('id')
    const existingIds = new Set((existing || []).map((r: any) => r.id))
    const incomingIds = new Set(data.map((r: any) => r.id))

    // DELETE registros removidos
    const toDelete = [...existingIds].filter(id => !incomingIds.has(id))
    if (toDelete.length > 0) {
      await supabase.from('clients').delete().in('id', toDelete)
    }

    // UPSERT com mapeamento correto
    if (data.length > 0) {
      await supabase.from('clients').upsert(data.map(toRow), { onConflict: 'id' })
    }
  }
}
