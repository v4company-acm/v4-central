// ─────────────────────────────────────────────────────────────────────────
// Status de ROI/ROAS — lógica compartilhada entre o card do dashboard,
// o cockpit do cliente e o painel de registro na aba "Status ROI/ROAS".
//
// Ideia: os accounts registram, semana a semana, um veredito objetivo
// (Saudável / Atenção / Crítico / Em Implantação) para cada cliente.
// O sistema sugere automaticamente um veredito com base no último
// lançamento em `metricasHistorico`, mas quem decide e registra é o
// account — com uma observação de contexto. O registro mais recente
// em `roiRoasChecks` é sempre o status "atual" do cliente.
// ─────────────────────────────────────────────────────────────────────────

export type RoiRoasStatusKey = 'saudavel' | 'atencao' | 'critico' | 'implantacao'

export interface RoiRoasCheck {
  status: RoiRoasStatusKey
  data: string          // YYYY-MM-DD — semana de referência
  autor: string          // quem registrou
  observacao?: string    // contexto/justificativa
  roasRef?: number | null // ROAS na hora do registro (snapshot)
  roiRef?: number | null  // ROI na hora do registro (snapshot)
  savedAt: string         // ISO timestamp de quando foi salvo
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
