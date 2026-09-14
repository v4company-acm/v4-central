import { useMemo, useState, CSSProperties } from 'react'
import { PlaybookTipo, TIPOS_ORDENADOS, TIPO_META, fmtDate, isAtrasado } from '../lib/playbook'
import { semanaDoItem, normalizarLink } from './PlaybookKanban'

// Visão "de cima" inspirada no calendário por semana/mês que a V4 já usa em planilha —
// só que com os dados reais (não célula pintada à mão), e sem sumir quando algo é
// entregue: o grid inclui pendente E entregue dentro do horizonte, então funciona
// também como um raio-x rápido do que já foi feito. Linhas por tipo de entrega
// (reaproveita a mesma taxonomia usada no resto do Playbook), colunas por semana.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function segundaAtual() {
  const d = new Date()
  const dia = d.getDay()
  const offset = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

const COL_TIPO_W = 132
const COL_ATRASADO_W = 78
const COL_SEMANA_W = 46

const thBase: CSSProperties = { padding: '7px 4px', textAlign: 'center', fontSize: 10, borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }
const tdBase: CSSProperties = { padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }

interface Props {
  itens: any[]
  horizonSemanas?: number
  onMarcarEntregue: (id: number) => void
  onReabrir: (id: number) => void
  mostrarCliente?: boolean
  onClickCliente?: (clienteId: string) => void
}

export default function PlaybookCalendario({ itens, horizonSemanas = 13, onMarcarEntregue, onReabrir, mostrarCliente, onClickCliente }: Props) {
  const semanas = useMemo(() => {
    const seg0 = segundaAtual()
    return Array.from({ length: horizonSemanas }, (_, i) => {
      const seg = addDays(seg0, i * 7)
      return { offset: i, mes: MESES[seg.getMonth()], ano: seg.getFullYear() }
    })
  }, [horizonSemanas])

  const gruposMes = useMemo(() => {
    const grupos: { mes: string; ano: number; count: number }[] = []
    semanas.forEach(s => {
      const ultimo = grupos[grupos.length - 1]
      if (ultimo && ultimo.mes === s.mes && ultimo.ano === s.ano) ultimo.count++
      else grupos.push({ mes: s.mes, ano: s.ano, count: 1 })
    })
    return grupos
  }, [semanas])

  const tiposPresentes = useMemo(() => {
    const vistos = new Set<string>()
    itens.forEach(i => {
      const atrasado = i.status === 'pendente' && isAtrasado(i)
      const off = semanaDoItem(i.data_prevista)
      if (atrasado || (off >= 0 && off < horizonSemanas)) vistos.add(i.tipo)
    })
    return TIPOS_ORDENADOS.filter(t => vistos.has(t))
  }, [itens, horizonSemanas])

  // matriz[tipo]['atrasado' | offsetString] = itens[]
  const matriz = useMemo(() => {
    const m: Record<string, Record<string, any[]>> = {}
    tiposPresentes.forEach(t => (m[t] = {}))
    itens.forEach(item => {
      if (!tiposPresentes.includes(item.tipo)) return
      if (item.status === 'pendente' && isAtrasado(item)) {
        (m[item.tipo]['atrasado'] = m[item.tipo]['atrasado'] || []).push(item)
        return
      }
      const off = semanaDoItem(item.data_prevista)
      if (off >= 0 && off < horizonSemanas) {
        const key = String(off)
        ;(m[item.tipo][key] = m[item.tipo][key] || []).push(item)
      }
    })
    return m
  }, [itens, tiposPresentes, horizonSemanas])

  const [selecionado, setSelecionado] = useState<{ tipo: string; key: string } | null>(null)

  function toggleCell(tipo: string, key: string) {
    setSelecionado(prev => (prev && prev.tipo === tipo && prev.key === key) ? null : { tipo, key })
  }

  if (tiposPresentes.length === 0) return null

  const itensSelecionados = selecionado ? (matriz[selecionado.tipo]?.[selecionado.key] || []) : []
  const mesesAprox = Math.max(1, Math.round(horizonSemanas / 4.33))

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="sec-title" style={{ fontSize: 16 }}>Visão Geral — Próximos {mesesAprox} Meses</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Tudo que está previsto ou já foi entregue nesse período, por tipo de entrega e semana. Clique numa célula pra ver o detalhe.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
        {tiposPresentes.map(t => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: TIPO_META[t as PlaybookTipo].color, display: 'inline-block' }} />
            {TIPO_META[t as PlaybookTipo].label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#FB2E0A', fontWeight: 700 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: '#FB2E0A', display: 'inline-block' }} /> Atrasado
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#16A34A', fontWeight: 700 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: '#16A34A', display: 'inline-block' }} /> Entregue
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...thBase, position: 'sticky', left: 0, zIndex: 3, width: COL_TIPO_W, minWidth: COL_TIPO_W, background: 'var(--card-color)' }} />
                <th rowSpan={2} style={{ ...thBase, position: 'sticky', left: COL_TIPO_W, zIndex: 3, width: COL_ATRASADO_W, minWidth: COL_ATRASADO_W, background: 'var(--card-color)', color: '#FB2E0A', fontWeight: 800 }}>Atrasado</th>
                {gruposMes.map((g, i) => (
                  <th key={i} colSpan={g.count} style={{ ...thBase, background: i % 2 === 0 ? 'var(--hover-bg)' : 'var(--card-color)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    {g.mes}{g.ano !== new Date().getFullYear() ? ` ’${String(g.ano).slice(2)}` : ''}
                  </th>
                ))}
              </tr>
              <tr>
                {semanas.map((s, i) => (
                  <th key={i} style={{ ...thBase, width: COL_SEMANA_W, minWidth: COL_SEMANA_W, fontWeight: 600, color: 'var(--text-muted)' }}>S{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiposPresentes.map(tipo => {
                const meta = TIPO_META[tipo as PlaybookTipo]
                return (
                  <tr key={tipo}>
                    <td style={{ ...tdBase, position: 'sticky', left: 0, zIndex: 2, background: 'var(--card-color)', textAlign: 'left', paddingLeft: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: meta.bg, color: meta.color, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{meta.label}</span>
                    </td>
                    <CelulaCalendario itens={matriz[tipo]['atrasado']} atrasado sticky={COL_TIPO_W} selecionado={selecionado?.tipo === tipo && selecionado.key === 'atrasado'} onClick={() => toggleCell(tipo, 'atrasado')} />
                    {semanas.map(s => {
                      const key = String(s.offset)
                      return (
                        <CelulaCalendario key={key} itens={matriz[tipo][key]} meta={meta} selecionado={selecionado?.tipo === tipo && selecionado.key === key} onClick={() => toggleCell(tipo, key)} />
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selecionado && itensSelecionados.length > 0 && (
        <div style={{ marginTop: 12, background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {TIPO_META[selecionado.tipo as PlaybookTipo].label} · {selecionado.key === 'atrasado' ? 'Atrasado' : `Semana ${parseInt(selecionado.key, 10) + 1}`}
            </span>
            <button onClick={() => setSelecionado(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {itensSelecionados.map((item: any) => {
              const entregue = item.status === 'entregue'
              return (
                <div key={item.id} style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ width: 74, flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{fmtDate(item.data_prevista)}</div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    {mostrarCliente && (
                      <div onClick={() => onClickCliente?.(item.cliente_id)} style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', cursor: onClickCliente ? 'pointer' : 'default' }}>{item.cliente_nome || 'Cliente'}</div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', textDecoration: entregue ? 'line-through' : 'none' }}>{item.titulo}</div>
                    {item.responsavel && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.responsavel}</div>}
                    {item.link && <a href={normalizarLink(item.link)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, color: '#2563EB' }}>🔗 Ver material</a>}
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

function CelulaCalendario({ itens, meta, atrasado, sticky, selecionado, onClick }: {
  itens?: any[]; meta?: { color: string; bg: string }; atrasado?: boolean; sticky?: number; selecionado?: boolean; onClick: () => void
}) {
  const count = itens?.length || 0
  const vazio = count === 0
  const todosEntregues = !vazio && itens!.every(i => i.status === 'entregue')
  const cor = atrasado ? '#FB2E0A' : todosEntregues ? '#16A34A' : meta?.color || 'var(--text-muted)'
  const bg = vazio ? 'transparent' : atrasado ? 'rgba(251,46,10,0.12)' : todosEntregues ? 'rgba(22,163,74,0.12)' : (meta?.bg || 'var(--hover-bg)')

  const style: CSSProperties = { ...tdBase, cursor: vazio ? 'default' : 'pointer', background: sticky != null && vazio ? 'var(--card-color)' : bg }
  if (sticky != null) { style.position = 'sticky'; style.left = sticky; style.zIndex = 2 }

  return (
    <td onClick={vazio ? undefined : onClick} style={style}>
      {!vazio && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, borderRadius: 6,
          fontSize: 10, fontWeight: 800, color: cor, border: selecionado ? `1.5px solid ${cor}` : 'none',
          boxShadow: selecionado ? `0 0 0 2px ${cor}33` : 'none',
        }}>
          {todosEntregues ? '✓' : count}
        </span>
      )}
    </td>
  )
}
