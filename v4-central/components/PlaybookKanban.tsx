import { PlaybookTipo, TIPO_META, fmtDate, isAtrasado } from '../lib/playbook'

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

interface Props {
  itens: any[]
  onMarcarEntregue: (id: number) => void
  onReabrir: (id: number) => void
  mostrarCliente?: boolean
  onClickCliente?: (clienteId: string) => void
  janelaSemanas?: number // quantas colunas de semana mostrar além de "Atrasado" (default 4)
}

export default function PlaybookKanban({ itens, onMarcarEntregue, onReabrir, mostrarCliente, onClickCliente, janelaSemanas = 4 }: Props) {
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
          <div key={col.key} style={{ minWidth: 240, maxWidth: 260, flexShrink: 0, background: 'var(--hover-bg)', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px', borderBottom: `2px solid ${atrasadoCol ? '#FB2E0A' : 'var(--border-color)'}`, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: atrasadoCol ? '#FB2E0A' : 'var(--text-secondary)' }}>{col.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{lista.length}</span>
            </div>
            {lista.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 4px' }}>Nada por aqui.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lista.map(item => {
                  const meta = TIPO_META[item.tipo as PlaybookTipo]
                  const entregue = item.status === 'entregue'
                  return (
                    <div key={item.id} style={{
                      background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
                      borderTop: `3px solid ${entregue ? '#16A34A' : meta.color}`, opacity: entregue ? 0.65 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: meta.bg, color: meta.color, textTransform: 'uppercase' }}>{meta.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: atrasadoCol && !entregue ? '#FB2E0A' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(item.data_prevista)}</span>
                      </div>
                      {mostrarCliente && (
                        <div onClick={() => onClickCliente?.(item.cliente_id)} style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', marginBottom: 3, cursor: onClickCliente ? 'pointer' : 'default' }}>
                          {item.cliente_nome || 'Cliente'}
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', textDecoration: entregue ? 'line-through' : 'none', marginBottom: item.responsavel ? 4 : 0 }}>{item.titulo}</div>
                      {item.responsavel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{item.responsavel}</div>}
                      {entregue ? (
                        <button onClick={() => onReabrir(item.id)} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✓ Entregue · reabrir</button>
                      ) : (
                        <button onClick={() => onMarcarEntregue(item.id)} style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: 'none', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 14, padding: '3px 10px', cursor: 'pointer' }}>Marcar Entregue</button>
                      )}
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
