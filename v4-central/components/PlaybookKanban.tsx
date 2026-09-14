import { useState } from 'react'
import { PlaybookTipo, TIPOS_ORDENADOS, TIPO_META, fmtDate, isAtrasado, diasAtraso } from '../lib/playbook'

// Quadro kanban por SEMANA (não por status) — a previsibilidade que importa aqui é
// "o que vence quando", não um fluxo de trabalho. Atrasado sempre na 1ª coluna,
// depois Esta Semana / Semana que Vem / +2 / +3 — cobre o próximo mês de relance.
const COLUNAS = [
  { key: 'atrasado', label: 'Atrasado' },
  { key: 0, label: 'Esta Semana' },
  { key: 1, label: 'Semana que Vem' },
  { key: 2, label: 'Em 2 Semanas' },
  { key: 3, label: 'Em 3 Semanas' },
] as const

function segundaFeira(d: Date) {
  const r = new Date(d)
  const dia = r.getDay() // 0=domingo
  const offset = dia === 0 ? -6 : 1 - dia
  r.setDate(r.getDate() + offset)
  r.setHours(0, 0, 0, 0)
  return r
}

/** Semana relativa a hoje (0 = essa semana, 1 = semana que vem...), ou null se estiver além da janela do quadro. */
export function semanaDoItem(dataISO: string): number {
  const [y, m, d] = dataISO.split('-').map(Number)
  const data = new Date(y, m - 1, d)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const segHoje = segundaFeira(hoje)
  const segData = segundaFeira(data)
  return Math.round((segData.getTime() - segHoje.getTime()) / (7 * 86400000))
}

export interface PlaybookItemEdit {
  titulo: string
  tipo: PlaybookTipo
  data_prevista: string
  responsavel: string | null
  descricao: string | null
  link: string | null
}

interface Props {
  itens: any[]
  onMarcarEntregue: (id: number) => void
  onReabrir: (id: number) => void
  onEditar?: (id: number, patch: PlaybookItemEdit) => void
  mostrarCliente?: boolean
  onClickCliente?: (clienteId: string) => void
  janelaSemanas?: number // quantas colunas de semana mostrar além de "Atrasado" (default 4)
}

const EDIT_FORM_VAZIO = { titulo: '', tipo: 'outro' as PlaybookTipo, data_prevista: '', responsavel: '', descricao: '', link: '' }

/** Garante que um link salvo sem protocolo (ex: "drive.google.com/...") ainda abra certo. */
export function normalizarLink(url: string) {
  if (!/^https?:\/\//i.test(url)) return `https://${url}`
  return url
}

export default function PlaybookKanban({ itens, onMarcarEntregue, onReabrir, onEditar, mostrarCliente, onClickCliente, janelaSemanas = 4 }: Props) {
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EDIT_FORM_VAZIO)

  function abrirEdicao(item: any) {
    setEditForm({
      titulo: item.titulo, tipo: item.tipo, data_prevista: item.data_prevista,
      responsavel: item.responsavel || '', descricao: item.descricao || '', link: item.link || '',
    })
    setEditandoId(item.id)
  }
  function salvarEdicao() {
    if (!editForm.titulo.trim() || editandoId == null) return
    onEditar?.(editandoId, {
      titulo: editForm.titulo.trim(), tipo: editForm.tipo, data_prevista: editForm.data_prevista,
      responsavel: editForm.responsavel.trim() || null, descricao: editForm.descricao.trim() || null,
      link: editForm.link.trim() ? normalizarLink(editForm.link.trim()) : null,
    })
    setEditandoId(null)
  }

  const colunas = COLUNAS.filter(c => c.key === 'atrasado' || (c.key as number) < janelaSemanas)

  const porColuna: Record<string, any[]> = {}
  colunas.forEach(c => (porColuna[c.key] = []))
  itens.forEach(item => {
    if (item.status === 'pendente' && isAtrasado(item)) { porColuna['atrasado'].push(item); return }
    const sem = semanaDoItem(item.data_prevista)
    if (sem >= 0 && sem < janelaSemanas) (porColuna[sem] = porColuna[sem] || []).push(item)
  })
  Object.values(porColuna).forEach(lista => lista.sort((a, b) => a.data_prevista.localeCompare(b.data_prevista)))

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {colunas.map(col => {
        const lista = porColuna[col.key] || []
        const atrasadoCol = col.key === 'atrasado'
        return (
          <div key={col.key} style={{ minWidth: 250, maxWidth: 270, flexShrink: 0, background: 'var(--hover-bg)', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px', borderBottom: `2px solid ${atrasadoCol ? '#FB2E0A' : 'var(--border-color)'}`, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: atrasadoCol ? '#FB2E0A' : 'var(--text-secondary)' }}>{col.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: atrasadoCol && lista.length > 0 ? '#fff' : 'var(--text-muted)', background: atrasadoCol && lista.length > 0 ? '#FB2E0A' : 'transparent', padding: atrasadoCol && lista.length > 0 ? '1px 7px' : 0, borderRadius: 10 }}>{lista.length}</span>
            </div>
            {lista.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 4px' }}>Nada por aqui.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lista.map(item => {
                  const meta = TIPO_META[item.tipo as PlaybookTipo]
                  const entregue = item.status === 'entregue'
                  const dias = atrasadoCol ? diasAtraso(item.data_prevista) : 0

                  if (editandoId === item.id) {
                    return (
                      <div key={item.id} style={{ background: 'var(--card-color)', border: '1.5px solid var(--red)', borderRadius: 8, padding: '10px 12px' }}>
                        <input value={editForm.titulo} onChange={e => setEditForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título" style={{ width: '100%', fontSize: 12, marginBottom: 6, height: 30 }} />
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <select value={editForm.tipo} onChange={e => setEditForm(p => ({ ...p, tipo: e.target.value as PlaybookTipo }))} style={{ flex: 1, fontSize: 11, height: 30 }}>
                            {TIPOS_ORDENADOS.map(t => <option key={t} value={t}>{TIPO_META[t].label}</option>)}
                          </select>
                          <input type="date" value={editForm.data_prevista} onChange={e => setEditForm(p => ({ ...p, data_prevista: e.target.value }))} style={{ flex: 1, fontSize: 11, height: 30 }} />
                        </div>
                        <input value={editForm.responsavel} onChange={e => setEditForm(p => ({ ...p, responsavel: e.target.value }))} placeholder="Responsável" style={{ width: '100%', fontSize: 12, marginBottom: 6, height: 30 }} />
                        <textarea value={editForm.descricao} onChange={e => setEditForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes / observações (o que é, o que falta, combinados...)" rows={2}
                          style={{ width: '100%', fontSize: 11, marginBottom: 6, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-color)', color: 'var(--text-main)' }} />
                        <input value={editForm.link} onChange={e => setEditForm(p => ({ ...p, link: e.target.value }))} placeholder="Link do material (Drive, Figma, LP, Ekyte...)"
                          style={{ width: '100%', fontSize: 11, marginBottom: 8, height: 30 }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditandoId(null)} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-color)', borderRadius: 14, padding: '4px 10px', cursor: 'pointer' }}>Cancelar</button>
                          <button onClick={salvarEdicao} style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--red)', border: 'none', borderRadius: 14, padding: '4px 10px', cursor: 'pointer' }}>Salvar</button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={item.id} style={{
                      background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
                      borderTop: `3px solid ${entregue ? '#16A34A' : meta.color}`, opacity: entregue ? 0.65 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: meta.bg, color: meta.color, textTransform: 'uppercase' }}>{meta.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: atrasadoCol && !entregue ? '#FB2E0A' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(item.data_prevista)}</span>
                      </div>
                      {atrasadoCol && !entregue && (
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#FB2E0A', display: 'inline-block', padding: '2px 8px', borderRadius: 4, marginBottom: 6 }}>
                          {dias === 0 ? 'Vence hoje' : `${dias} dia${dias > 1 ? 's' : ''} de atraso`}
                        </div>
                      )}
                      {mostrarCliente && (
                        <div onClick={() => onClickCliente?.(item.cliente_id)} style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', marginBottom: 3, cursor: onClickCliente ? 'pointer' : 'default' }}>
                          {item.cliente_nome || 'Cliente'}
                        </div>
                      )}
                      {item.fase && <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 2 }}>{item.fase}</div>}
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', textDecoration: entregue ? 'line-through' : 'none', marginBottom: item.responsavel ? 4 : 0 }}>{item.titulo}</div>
                      {item.responsavel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{item.responsavel}</div>}
                      {item.descricao && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.descricao}
                        </div>
                      )}
                      {item.link && (
                        <a href={normalizarLink(item.link)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8, textDecoration: 'none' }}>
                          🔗 Ver material
                        </a>
                      )}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {entregue ? (
                          <button onClick={() => onReabrir(item.id)} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✓ Entregue · reabrir</button>
                        ) : (
                          <button onClick={() => onMarcarEntregue(item.id)} style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: 'none', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 14, padding: '3px 10px', cursor: 'pointer' }}>Marcar Entregue</button>
                        )}
                        {onEditar && (
                          <button onClick={() => abrirEdicao(item)} title="Editar" style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', marginLeft: 'auto' }}>✎</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
