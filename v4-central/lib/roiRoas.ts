// ─────────────────────────────────────────────────────────────────────────
// Status de ROI/ROAS — lógica compartilhada entre o card do dashboard,
// o cockpit do cliente e o painel de registro na aba "Status ROI/ROAS".
//
// Modelo tipo growthpack/health-score: o account não escolhe o status
// livremente — ele preenche 5 critérios objetivos de growth (cada um com
// 3 opções, valendo 0/10/20 pontos) e o status (Saudável/Atenção/Crítico)
// sai de um score 0-100 calculado a partir disso. "Em Implantação" é um
// estado à parte, pra quando ainda não há dado suficiente pra pontuar.
// ─────────────────────────────────────────────────────────────────────────

export type RoiRoasStatusKey = 'saudavel' | 'atencao' | 'critico' | 'implantacao'

// ── Critérios do health score ──────────────────────────────────────────
export const HEALTH_CRITERIA = [
  {
    key: 'metaRoasRoi',
    label: 'ROAS/ROI vs. Meta Combinada',
    hint: 'O resultado da semana está batendo a meta acordada com o cliente?',
    options: [
      { key: 'acima', label: 'Acima da meta', points: 20 },
      { key: 'na_meta', label: 'Na meta', points: 12 },
      { key: 'abaixo', label: 'Abaixo da meta', points: 0 },
    ],
  },
  {
    key: 'tendencia',
    label: 'Tendência (últimas semanas)',
    hint: 'O resultado está melhorando, estável ou piorando ao longo do tempo?',
    options: [
      { key: 'subindo', label: 'Subindo', points: 20 },
      { key: 'estavel', label: 'Estável', points: 12 },
      { key: 'caindo', label: 'Caindo', points: 0 },
    ],
  },
  {
    key: 'execucaoInvestimento',
    label: 'Execução do Investimento Planejado',
    hint: 'A verba de mídia combinada está sendo executada no ritmo certo?',
    options: [
      { key: 'em_dia', label: 'Em dia', points: 20 },
      { key: 'parcial', label: 'Parcial', points: 10 },
      { key: 'atrasado', label: 'Atrasado / Pausado', points: 0 },
    ],
  },
  {
    key: 'planoAcao',
    label: 'Plano de Ação Ativo',
    hint: 'Existe uma próxima otimização definida pra essa semana/mês?',
    options: [
      { key: 'definido', label: 'Definido', points: 20 },
      { key: 'em_definicao', label: 'Em definição', points: 10 },
      { key: 'nao_ha', label: 'Não há', points: 0 },
    ],
  },
  {
    key: 'riscoChurn',
    label: 'Risco de Churn Percebido',
    hint: 'Na sua leitura, qual o risco desse cliente cancelar no curto prazo?',
    options: [
      { key: 'baixo', label: 'Baixo', points: 20 },
      { key: 'medio', label: 'Médio', points: 10 },
      { key: 'alto', label: 'Alto', points: 0 },
    ],
  },
] as const

export type HealthCriteriaKey = typeof HEALTH_CRITERIA[number]['key']
export type HealthAnswers = Partial<Record<HealthCriteriaKey, string>>

/** Soma os pontos dos critérios preenchidos e devolve o score (0-100) + status resultante. */
export function computeHealthScore(answers: HealthAnswers): { score: number; status: RoiRoasStatusKey; answered: number } {
  let score = 0
  let answered = 0
  for (const crit of HEALTH_CRITERIA) {
    const chosen = answers[crit.key]
    const opt = crit.options.find(o => o.key === chosen)
    if (opt) { score += opt.points; answered++ }
  }
  if (answered === 0) return { score: 0, status: 'implantacao', answered: 0 }
  let status: RoiRoasStatusKey = 'critico'
  if (score >= 70) status = 'saudavel'
  else if (score >= 35) status = 'atencao'
  return { score, status, answered }
}

export interface RoiRoasCheck {
  status: RoiRoasStatusKey
  data: string          // YYYY-MM-DD — semana de referência
  autor: string          // quem registrou
  observacao?: string    // contexto/justificativa
  roasRef?: number | null // ROAS na hora do registro (snapshot)
  roiRef?: number | null  // ROI na hora do registro (snapshot)
  savedAt: string         // ISO timestamp de quando foi salvo
  answers?: HealthAnswers // respostas dos 5 critérios do health score
  score?: number          // score 0-100 calculado a partir de `answers`
  emImplantacao?: boolean // true = pulou o scorecard, ainda sem dado suficiente
}

export const ROI_ROAS_STATUSES: { key: RoiRoasStatusKey; label: string; color: string; bg: string; dot: string }[] = [
  { key: 'saudavel',    label: 'ROI Saudável',     color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  dot: '#16A34A' },
  { key: 'atencao',     label: 'Atenção',          color: '#D97706', bg: 'rgba(217,119,6,0.1)',  dot: '#D97706' },
  { key: 'critico',     label: 'Crítico',          color: '#FB2E0A', bg: 'rgba(251,46,10,0.1)',  dot: '#FB2E0A' },
  { key: 'implantacao', label: 'Em Implantação',   color: '#64748B', bg: 'rgba(100,116,139,0.1)', dot: '#64748B' },
]

export function roiRoasMeta(status?: string | null) {
  return ROI_ROAS_STATUSES.find(s => s.key === status) || ROI_ROAS_STATUSES[3]
}

/** Ordena o histórico de checks por data de registro, mais recente primeiro. */
export function sortedRoiChecks(checks: RoiRoasCheck[] | undefined | null): RoiRoasCheck[] {
  return [...(checks || [])].sort((a, b) => (b.savedAt || b.data || '').localeCompare(a.savedAt || a.data || ''))
}

/** Retorna o check mais recente registrado manualmente por um account (ou null). */
export function currentRoiCheck(checks: RoiRoasCheck[] | undefined | null): RoiRoasCheck | null {
  const sorted = sortedRoiChecks(checks)
  return sorted[0] || null
}

/**
 * Sugestão objetiva de status com base no lançamento mais recente de
 * `metricasHistorico`. Critério (ajustável):
 *  - ROAS ≥ 3x  e ROI ≥ 20%  → Saudável
 *  - ROAS ≥ 1x  e ROI ≥ 0%   → Atenção (cobre custos, mas margem apertada)
 *  - Qualquer outro caso com dado disponível → Crítico
 *  - Sem nenhum lançamento ainda → Em Implantação
 */
export function suggestRoiRoasStatus(historico: any[] | undefined | null): { status: RoiRoasStatusKey; roas: number | null; roi: number | null; data: string | null } {
  const list = historico || []
  if (list.length === 0) return { status: 'implantacao', roas: null, roi: null, data: null }

  const sorted = [...list].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
  const latest = sorted[0]
  const roas = parseFloat(latest.roas) || 0
  const roi = parseFloat(latest.roi) || 0

  let status: RoiRoasStatusKey = 'critico'
  if (roas >= 3 && roi >= 20) status = 'saudavel'
  else if (roas >= 1 && roi >= 0) status = 'atencao'

  return { status, roas, roi, data: latest.data || null }
}

/** Série (mais antiga → mais recente) de ROAS para o sparkline, últimas N semanas. */
export function roasSeries(historico: any[] | undefined | null, n = 12): number[] {
  const list = [...(historico || [])].sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
  return list.slice(-n).map(d => parseFloat(d.roas) || 0)
}
