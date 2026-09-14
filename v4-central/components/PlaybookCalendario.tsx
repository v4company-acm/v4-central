import { useMemo, useState, CSSProperties } from 'react'
import { PlaybookTipo, TIPO_META, fmtDate, isAtrasado, todayISO } from '../lib/playbook'
import { normalizarLink } from './PlaybookKanban'

// Calendário de verdade (mês por mês, dia a dia) — não um heatmap abstrato. A ideia
// é que dê pra entender o que tem em cada dia só de bater o olho, do jeito que
// qualquer agenda (Google Calendar etc.) já mostra: dia com os títulos das entregas
// daquele dia, coloridos por tipo, "+N mais" quando não cabe tudo. Clica no dia pra
// ver a lista completa com ação (marcar entregue, abrir link do material).

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MAX_CHIPS_VISIVEIS = 3

function pad2(n: number) { return String(n).padStart(2, '0') }
function toISO(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

interface Props {
  itens: any[]
  onMarcarEntregue: (id: number) => void
  onReabrir: (id: number) => void
  mostrarCliente?: boolean
  onClickCliente?: (clienteId: string) => void
}

export default function PlaybookCalendario({ itens, onMarcarEntregue, onReabrir, mostrarCliente, onClickCliente }: Props) {
  const hojeISO = useMemo(() => todayISO(), [])
  const [cursor, setCursor] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1) })
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  const porDia = useMemo(() => {
    const m: Record<string, any[]> = {}
    itens.forEach(item => { (m[item.data_prevista] = m[item.data_prevista] || []).push(item) })
    Object.values(m).forEach(lista => lista.sort((a, b) => a.status === b.status ? 0 : a.status === 'entregue' ? 1 : -1))
    return m
  }, [itens])

  const celulas = useMemo(() => {
    const primeiroDiaSemana = cursor.getDay()
    const diasNoMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const totalCelulas = Math.ceil((primeiroDiaSemana + diasNoMes) / 7) * 7
    const inicioGrid = addDays(cursor, -primeiroDiaSemana)
    return Array.from({ length: totalCelulas }, (_, i) => {
      const d = addDays(inicioGrid, i)
      return { iso: toISO(d), dia: d.getDate(), noMesAtual: d.getMonth() === cursor.getMonth() }
    })
  }, [cursor])

  function mesAnterior() { setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1)); setDiaSelecionado(null) }
  function proximoMes() { setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1)); setDiaSelecionado(null) }
  function irHoje() { const h = new Date(); setCursor(new Date(h.getFullYear(), h.getMonth(), 1)); setDiaSelecionado(hojeISO) }

  const itensSelecionados = diaSelecionado ? (porDia[diaSelecionado] || []) : []
  const cursorEhMesAtual = cursor.getFullYear() === new Date().getFullYear() && cursor.getMonth() === new Date().getMonth()

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="sec-title" style={{ fontSize: 16 }}>Calendário de Entregas</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        O que está previsto ou já foi entregue, dia a dia. Clique num dia pra ver o detalhe completo.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={mesAnterior} style={navBtnStyle} aria-label="Mês anterior">‹</button>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', minWidth: 150, textAlign: 'center' }}>
            {MESES[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button onClick={proximoMes} style={navBtnStyle} aria-label="Próximo mês">›</button>
        </div>
        {!cursorEhMesAtual && (
          <button onClick={irHoje} style={{ ...navBtnStyle, width: 'auto', padding: '0 14px', fontSize: 11, fontWeight: 700 }}>Hoje</button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
        {tiposComItens(itens).map(t => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: TIPO_META[t].color, display: 'inline-block' }} />
            {TIPO_META[t].label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#FB2E0A', fontWeight: 700 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: '#FB2E0A', display: 'inline-block' }} /> Atrasado
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textDecoration: 'line-through' }}>
          ✓ Entregue
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: 'var(--hover-bg)' }}>
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-color)' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {celulas.map((cel, i) => {
            const itensDoDia: any[] = porDia[cel.iso] || []
            const ehHoje = cel.iso === hojeISO
            const selecionado = cel.iso === diaSelecionado
            const visiveis = itensDoDia.slice(0, MAX_CHIPS_VISIVEIS)
            const resto = itensDoDia.length - visiveis.length
            return (
              <div key={i}
                onClick={() => itensDoDia.length > 0 && setDiaSelecionado(prev => prev === cel.iso ? null : cel.iso)}
                style={{
                  minHeight: 92, padding: '6px 5px', borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border-color)' : 'none',
                  borderBottom: '1px solid var(--border-color)', background: selecionado ? 'var(--hover-bg)' : 'var(--card-color)',
                  opacity: cel.noMesAtual ? 1 : 0.4, cursor: itensDoDia.length > 0 ? 'pointer' : 'default',
                  boxShadow: selecionado ? 'inset 0 0 0 2px #2563EB' : 'none',
                }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: ehHoje ? '#fff' : 'var(--text-secondary)', marginBottom: 5,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%',
                  background: ehHoje ? '#2563EB' : 'transparent',
                }}>{cel.dia}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {visiveis.map(item => {
                    const meta = TIPO_META[item.tipo as PlaybookTipo]
                    const entregue = item.status === 'entregue'
                    const atrasado = !entregue && isAtrasado(item)
                    return (
                      <div key={item.id} title={item.titulo} style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        color: entregue ? 'var(--text-muted)' : atrasado ? '#FB2E0A' : meta.color,
                        background: entregue ? 'var(--hover-bg)' : atrasado ? 'rgba(251,46,10,0.12)' : meta.bg,
                        textDecoration: entregue ? 'line-through' : 'none',
                      }}>
                        {entregue ? '✓ ' : ''}{item.titulo}
                      </div>
                    )
                  })}
                  {resto > 0 && <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', padding: '0 5px' }}>+{resto} mais</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {diaSelecionado && itensSelecionados.length > 0 && (
        <div style={{ marginTop: 12, background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {fmtDate(diaSelecionado)}{diaSelecionado === hojeISO ? ' · Hoje' : ''}
            </span>
            <button onClick={() => setDiaSelecionado(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {itensSelecionados.map((item: any) => {
              const meta = TIPO_META[item.tipo as PlaybookTipo]
              const entregue = item.status === 'entregue'
              const atrasado = !entregue && isAtrasado(item)
              return (
                <div key={item.id} style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: meta.bg, color: meta.color, textTransform: 'uppercase', flexShrink: 0 }}>{meta.label}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    {mostrarCliente && (
                      <div onClick={() => onClickCliente?.(item.cliente_id)} style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', cursor: onClickCliente ? 'pointer' : 'default' }}>{item.cliente_nome || 'Cliente'}</div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', textDecoration: entregue ? 'line-through' : 'none' }}>{item.titulo}</div>
                    {item.responsavel && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.responsavel}</div>}
                    {atrasado && <div style={{ fontSize: 10, fontWeight: 800, color: '#FB2E0A' }}>Atrasado</div>}
                    {item.link && <a href={normalizarLink(item.link)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', display: 'inline-block', marginTop: 2 }}>🔗 Ver material</a>}
                  </div>
                  {entregue ? (
                    <button onClick={() => onReabrir(item.id)} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✓ Entregue · reabrir</button>
                  ) : (
                    <button onClick={() => onMarcarEntregue(item.id)} style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: 'none', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 14, padding: '3px 10px', cursor: 'pointer' }}>Marcar Entregue</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function tiposComItens(itens: any[]): PlaybookTipo[] {
  const vistos = new Set<string>()
  itens.forEach(i => vistos.add(i.tipo))
  return (Object.keys(TIPO_META) as PlaybookTipo[]).filter(t => vistos.has(t))
}

const navBtnStyle: CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-color)',
  color: 'var(--text-main)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
