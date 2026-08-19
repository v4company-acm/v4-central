// ─────────────────────────────────────────────────────────────────────────
// Health Score do projeto — 3 domínios (Tráfego, Comercial, Projeto) que
// se alimentam de NÚMEROS reais comparados com metas combinadas, não de
// escolha livre. "Projeto" agrega Tráfego + Comercial e aplica um gate de
// aderência ao playbook. Planos de ação exigem confirmação de resultado.
// ─────────────────────────────────────────────────────────────────────────

export type Dominio = 'trafego' | 'comercial' | 'projeto'
export type HealthStatusKey = 'saudavel' | 'atencao' | 'critico' | 'implantacao'

export const HEALTH_STATUSES: { key: HealthStatusKey; label: string; color: string; bg: string; dot: string }[] = [
  { key: 'saudavel',    label: 'Saudável',        color: '#16A34A', bg: 'rgba(22,163,74,0.1)',   dot: '#16A34A' },
  { key: 'atencao',     label: 'Atenção',         color: '#D97706', bg: 'rgba(217,119,6,0.1)',   dot: '#D97706' },
  { key: 'critico',     label: 'Crítico',         color: '#FB2E0A', bg: 'rgba(251,46,10,0.1)',   dot: '#FB2E0A' },
  { key: 'implantacao', label: 'Em Implantação',  color: '#64748B', bg: 'rgba(100,116,139,0.1)', dot: '#64748B' },
]
export function healthMeta(status?: string | null) {
  return HEALTH_STATUSES.find(s => s.key === status) || HEALTH_STATUSES[3]
}
export function statusFromScore(score: number): HealthStatusKey {
  if (score >= 70) return 'saudavel'
  if (score >= 35) return 'atencao'
  return 'critico'
}

export interface MetricDef {
  key: string
  label: string
  unidade: 'moeda' | 'x' | 'pct' | 'qtd'
  metaField: string        // chave em clients.metas
  modo: 'maior_melhor' | 'menor_melhor' | 'proximidade'
  auto?: boolean            // true = valor "atual" vem de metricasHistorico automaticamente
}

export const DOMINIO_CONFIG: Record<'trafego' | 'comercial', { label: string; metrics: MetricDef[] }> = {
  trafego: {
    label: 'Tráfego',
    metrics: [
      { key: 'roas', label: 'ROAS', unidade: 'x', metaField: 'metaRoas', modo: 'maior_melhor', auto: true },
      { key: 'cpl', label: 'CPL', unidade: 'moeda', metaField: 'metaCpl', modo: 'menor_melhor', auto: true },
      { key: 'investimento', label: 'Investimento (aderência ao planejado)', unidade: 'moeda', metaField: 'metaInvestimentoSemanal', modo: 'proximidade', auto: true },
    ],
  },
  comercial: {
    label: 'Comercial',
    metrics: [
      { key: 'vendas', label: 'Vendas no Período', unidade: 'qtd', metaField: 'metaVendasSemana', modo: 'maior_melhor' },
      { key: 'taxaFechamento', label: 'Taxa de Fechamento', unidade: 'pct', metaField: 'metaTaxaFechamento', modo: 'maior_melhor' },
      { key: 'ticketMedio', label: 'Ticket Médio', unidade: 'moeda', metaField: 'metaTicketMedio', modo: 'maior_melhor' },
      { key: 'cac', label: 'CAC (Custo de Aquisição)', unidade: 'moeda', metaField: 'metaCac', modo: 'menor_melhor' },
    ],
  },
}

export interface MetricResult {
  key: string; label: string; unidade: MetricDef['unidade']
  atual: number | null; meta: number | null; atingimento: number | null
}

/** Calcula o % de atingimento de UMA métrica (null = sem meta OU sem número lançado ainda — não entra no score, não vira "crítico" por ausência de dado). */
export function calcAtingimento(atual: number | null, meta: number | null, modo: MetricDef['modo']): number | null {
  if (meta == null || meta === 0) return null
  if (atual == null) return null
  if (modo === 'proximidade') return Math.max(0, 100 - (Math.abs(atual - meta) / meta) * 100)
  if (modo === 'menor_melhor') return atual > 0 ? (meta / atual) * 100 : 0
  return (atual / meta) * 100
}

/** Monta os resultados de cada métrica do domínio + o score final 0-100 (ou null se nenhuma meta definida). */
export function computeDomainScore(
  dominio: 'trafego' | 'comercial',
  atuais: Record<string, number | null>,
  metas: Record<string, any>
): { metrics: MetricResult[]; score: number | null; status: HealthStatusKey } {
  const cfg = DOMINIO_CONFIG[dominio]
  const metrics: MetricResult[] = cfg.metrics.map(m => {
    const atual = atuais[m.key] ?? null
    const meta = metas?.[m.metaField] != null && metas[m.metaField] !== '' ? parseFloat(metas[m.metaField]) : null
    const atingimento = calcAtingimento(atual, meta, m.modo)
    return { key: m.key, label: m.label, unidade: m.unidade, atual, meta, atingimento }
  })
  const comMeta = metrics.filter(m => m.atingimento != null)
  if (comMeta.length === 0) return { metrics, score: null, status: 'implantacao' }
  const media = comMeta.reduce((s, m) => s + Math.min(130, m.atingimento as number), 0) / comMeta.length
  const score = Math.round(Math.max(0, Math.min(100, media)))
  return { metrics, score, status: statusFromScore(score) }
}

/** Agrega Tráfego + Comercial no score de Projeto, com gate de playbook. */
export function computeProjetoScore(
  trafegoScore: number | null, comercialScore: number | null, playbook: 'sim' | 'parcial' | 'nao' | null
): { score: number | null; status: HealthStatusKey } {
  const parts = [trafegoScore, comercialScore].filter((v): v is number => v != null)
  if (parts.length === 0) return { score: null, status: 'implantacao' }
  const score = Math.round(parts.reduce((s, v) => s + v, 0) / parts.length)
  let status = statusFromScore(score)
  // Playbook atrasado é um gate — não deixa o projeto ler como Saudável mesmo com números bons.
  if (playbook === 'nao' && status === 'saudavel') status = 'atencao'
  return { score, status }
}

// ─────────────────────────────────────────────────────────────────────────
// Checklist qualitativo de Projeto — os mesmos critérios que o time já usa
// na planilha de Health Score (ROI, CSAT, NPS, geração de demanda, conta
// de anúncios, CRM, check-in, fee, growth) trazidos pro app como registro
// estruturado. NÃO tentamos reproduzir o % de "Probabilidade de Churn"
// ponderado da planilha (os pesos por critério não estão documentados em
// lugar nenhum e inventar um número aqui seria pior que não ter nenhum) —
// em vez disso mostramos uma contagem transparente e auditável de sinais
// de atenção, que é honesta sobre o que está sendo medido.
// ─────────────────────────────────────────────────────────────────────────
export interface ChecklistItem { key: string; label: string }
export const PROJETO_CHECKLIST: ChecklistItem[] = [
  { key: 'roi', label: 'ROI acima de 1x?' },
  { key: 'csat', label: 'CSAT igual ou superior a 4?' },
  { key: 'nps', label: 'NPS igual ou superior a 7?' },
  { key: 'demandaDiaria', label: 'Geração de demanda diária?' },
  { key: 'stakeholderConsciente', label: 'Stakeholder pagador consciente dos avanços?' },
  { key: 'contaAtiva', label: 'Conta de anúncios ativa e com saldo OK?' },
  { key: 'crmEmUso', label: 'CRM em uso pelo cliente?' },
  { key: 'checkin', label: 'Pelo menos 1 check-in realizado no período?' },
  { key: 'feeEmDia', label: 'Fee em dia?' },
  { key: 'growth', label: 'Teve growth/upsell no período?' },
]
export type ChecklistAnswers = Record<string, 'sim' | 'nao' | null>

/** Conta quantos critérios (checklist + playbook) estão em "Não" — sinal de atenção transparente, sem pesos inventados. */
export function computeAlertSignals(checklist: ChecklistAnswers, playbook: 'sim' | 'parcial' | 'nao' | null) {
  const total = PROJETO_CHECKLIST.length + 1 // +1 = playbook, que já tem seletor próprio
  let alertas = 0
  PROJETO_CHECKLIST.forEach(c => { if (checklist?.[c.key] === 'nao') alertas++ })
  if (playbook === 'nao' || playbook === 'parcial') alertas++
  return { alertas, total }
}

export function fmtMetricValue(v: number | null, unidade: MetricDef['unidade']) {
  if (v == null || isNaN(v)) return '—'
  if (unidade === 'moeda') return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (unidade === 'x') return v.toFixed(1) + 'x'
  if (unidade === 'pct') return v.toFixed(1) + '%'
  return v.toLocaleString('pt-BR')
}
