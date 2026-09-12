// ─────────────────────────────────────────────────────────────────────────
// Playbook — calendário de compromissos recorrentes por cliente. Regras
// definem a cadência (ex: "toda sexta, relatório de performance"); a partir
// delas geramos as entregas datadas dos próximos ~3 meses (janela rolante,
// sempre olhando pra frente — nunca preenche datas passadas). O objetivo é
// dar visibilidade antecipada real pra cobrar prazo com rigidez.
// ─────────────────────────────────────────────────────────────────────────

export type PlaybookTipo = 'criativo' | 'relatorio' | 'reuniao' | 'otimizacao' | 'conteudo' | 'financeiro' | 'outro'
export type PlaybookFrequencia = 'semanal' | 'quinzenal' | 'mensal' | 'unico'
export type PlaybookStatus = 'pendente' | 'entregue' | 'cancelado'

export const TIPOS_ORDENADOS: PlaybookTipo[] = ['relatorio', 'otimizacao', 'criativo', 'conteudo', 'reuniao', 'financeiro', 'outro']

export const TIPO_META: Record<PlaybookTipo, { label: string; color: string; bg: string }> = {
  relatorio:  { label: 'Relatório',  color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  otimizacao: { label: 'Otimização', color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  criativo:   { label: 'Criativo',   color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  conteudo:   { label: 'Conteúdo',   color: '#DB2777', bg: 'rgba(219,39,119,0.1)' },
  reuniao:    { label: 'Reunião',    color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  financeiro: { label: 'Financeiro', color: '#0891B2', bg: 'rgba(8,145,178,0.1)' },
  outro:      { label: 'Outro',      color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
}
export const FREQ_LABEL: Record<PlaybookFrequencia, string> = {
  semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal', unico: 'Avulso',
}
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export interface RegraBase {
  frequencia: PlaybookFrequencia
  dia_semana: number | null
  dia_mes: number | null
  data_inicio: string
}

function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function parseISO(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function lastDayOfMonth(year: number, monthIdx0: number) { return new Date(year, monthIdx0 + 1, 0).getDate() }

/** Gera as datas previstas (hoje <= data <= horizonte) pra uma regra recorrente — nunca datas passadas. */
export function gerarDatas(regra: RegraBase, horizonteDias = 92): string[] {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const horizonte = addDays(hoje, horizonteDias)
  const inicio = parseISO(regra.data_inicio)
  const datas: string[] = []

  if (regra.frequencia === 'unico') {
    if (inicio >= hoje && inicio <= horizonte) datas.push(toISO(inicio))
    return datas
  }

  if (regra.frequencia === 'mensal') {
    const dia = regra.dia_mes ?? inicio.getDate()
    let cursor = new Date(Math.max(hoje.getFullYear(), inicio.getFullYear()), hoje.getMonth(), 1)
    for (let i = 0; i < 5; i++) {
      const diaClamp = Math.min(dia, lastDayOfMonth(cursor.getFullYear(), cursor.getMonth()))
      const data = new Date(cursor.getFullYear(), cursor.getMonth(), diaClamp)
      if (data >= hoje && data <= horizonte && data >= inicio) datas.push(toISO(data))
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
    return datas
  }

  // semanal / quinzenal — anda em passos de 7 ou 14 dias a partir da âncora (data_inicio
  // ajustada pro dia da semana escolhido), listando só as ocorrências dentro da janela.
  const passo = regra.frequencia === 'quinzenal' ? 14 : 7
  const diaAlvo = regra.dia_semana ?? inicio.getDay()
  let ancora = new Date(inicio)
  while (ancora.getDay() !== diaAlvo) ancora = addDays(ancora, 1)

  let cursor = new Date(ancora)
  if (cursor < hoje) {
    const diff = Math.floor((hoje.getTime() - cursor.getTime()) / 86400000)
    const saltos = Math.floor(diff / passo)
    cursor = addDays(cursor, saltos * passo)
    while (cursor < hoje) cursor = addDays(cursor, passo)
  }
  while (cursor <= horizonte) {
    datas.push(toISO(cursor))
    cursor = addDays(cursor, passo)
  }
  return datas
}

export interface PresetSugestao { titulo: string; tipo: PlaybookTipo; frequencia: PlaybookFrequencia; dia_semana?: number; dia_mes?: number }

export const PLAYBOOK_PRESETS: PresetSugestao[] = [
  { titulo: 'Relatório Semanal de Performance', tipo: 'relatorio', frequencia: 'semanal', dia_semana: 5 },
  { titulo: 'Otimização de Campanhas', tipo: 'otimizacao', frequencia: 'semanal', dia_semana: 1 },
  { titulo: 'Entrega de Criativos', tipo: 'criativo', frequencia: 'quinzenal' },
  { titulo: 'Conteúdo para Social Media', tipo: 'conteudo', frequencia: 'mensal', dia_mes: 1 },
  { titulo: 'Reunião Quinzenal de Alinhamento', tipo: 'reuniao', frequencia: 'quinzenal' },
  { titulo: 'Reunião Mensal de Resultados', tipo: 'reuniao', frequencia: 'mensal', dia_mes: 5 },
  { titulo: 'Fechamento Financeiro / Fee', tipo: 'financeiro', frequencia: 'mensal', dia_mes: 10 },
]

/** Sugere presets relevantes com base nos Serviços Contratados do cliente — reduz digitação na hora de montar o playbook de cada cliente (tem ~24 pra fazer). */
export function sugerirPresets(servicos: string[]): PresetSugestao[] {
  const texto = (servicos || []).join(' ').toLowerCase()
  const tem = (re: RegExp) => re.test(texto)
  const sugeridos: PresetSugestao[] = []
  if (tem(/tr[aá]fego|ads|m[ií]dia|google|meta\b/)) sugeridos.push(PLAYBOOK_PRESETS[0], PLAYBOOK_PRESETS[1])
  if (tem(/criativ/)) sugeridos.push(PLAYBOOK_PRESETS[2])
  if (tem(/social|conte[uú]do|copy/)) sugeridos.push(PLAYBOOK_PRESETS[3])
  sugeridos.push(PLAYBOOK_PRESETS[4], PLAYBOOK_PRESETS[5])
  if (tem(/financeiro|fee|cobran/)) sugeridos.push(PLAYBOOK_PRESETS[6])
  const vistos = new Set<string>()
  return sugeridos.filter(p => (vistos.has(p.titulo) ? false : (vistos.add(p.titulo), true)))
}

export function fmtCadencia(regra: RegraBase) {
  if (regra.frequencia === 'semanal') return regra.dia_semana != null ? `Toda ${DIAS_SEMANA[regra.dia_semana]}` : 'Semanal'
  if (regra.frequencia === 'quinzenal') return regra.dia_semana != null ? `A cada 2 semanas (${DIAS_SEMANA[regra.dia_semana]})` : 'A cada 2 semanas'
  if (regra.frequencia === 'mensal') return regra.dia_mes != null ? `Dia ${regra.dia_mes} de cada mês` : 'Mensal'
  return 'Data única'
}

export function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` } catch { return d }
}
export function todayISO() { return new Date().toISOString().slice(0, 10) }
export function isAtrasado(item: { status: PlaybookStatus; data_prevista: string }) {
  return item.status === 'pendente' && item.data_prevista < todayISO()
}
