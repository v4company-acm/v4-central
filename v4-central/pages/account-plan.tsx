import { useState, useEffect, useMemo } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'

interface Row {
  id: number
  cliente: string
  fee: string | null
  flag: string | null
  coordenador: string | null
  account: string | null
  prioridade_produto: string | null
  valor_prioridade: number | null
  timing_prioridade: string | null
  situacao_atual: string | null
  plano_acao: string | null
  deadline_plano_acao: string | null
  responsavel: string | null
  dores_desafios: string | null
  impacto: string | null
  decisao: string | null
}

const C = {
  card: 'var(--card-color)', border: 'var(--border-color)', border2: 'var(--border-light)',
  text: 'var(--text-main)', text2: 'var(--text-secondary)', text3: 'var(--text-muted)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.1)',
  amber: '#D97706', amberBg: 'rgba(217,119,6,0.1)',
  red: '#FB2E0A',
}

const COLUNAS = [
  { key: 'Quente', label: '🔥 Quente', color: '#FB2E0A', bg: 'rgba(251,46,10,0.06)' },
  { key: 'Morno', label: '🌤 Morno', color: '#D97706', bg: 'rgba(217,119,6,0.06)' },
  { key: 'Frio', label: '❄️ Frio', color: '#2563EB', bg: 'rgba(37,99,235,0.06)' },
]

function fmtR(v: number | null) { if (v === null || v === undefined) return '—'; return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtSyncedAt(v: string | null) {
  if (!v) return 'ainda não sincronizado'
  const d = new Date(v)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AccountPlanPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('todos')

  useEffect(() => {
    fetch('/api/account-plan').then(r => r.json()).then(d => {
      setRows(d.rows || []); setSyncedAt(d.syncedAt || null); setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const accounts = useMemo(() => [...new Set(rows.map(r => r.account).filter(Boolean))] as string[], [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r =>
      (!q || r.cliente.toLowerCase().includes(q) || (r.prioridade_produto || '').toLowerCase().includes(q)) &&
      (accountFilter === 'todos' || r.account === accountFilter)
    )
  }, [rows, search, accountFilter])

  const outros = filtered.filter(r => !COLUNAS.some(c => c.key === r.timing_prioridade))
  const totalGeral = filtered.reduce((s, r) => s + (r.valor_prioridade || 0), 0)

  return (
    <>
      <Head><title>Account Plan — V4 Central de Clientes</title></Head>
      <Layout title="Account Plan">
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: C.text3 }}>
              Espelho automático da planilha "Account Plan" (aba Pipeline) · sincronizado a cada 4h via n8n
            </div>
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>
              🔄 Última sincronização: {fmtSyncedAt(syncedAt)}
            </div>
          </div>

          {/* KPI STRIP */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Oportunidades no Pipe</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{filtered.length}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Valor Total em Pipe</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{fmtR(totalGeral)}</div>
            </div>
            {COLUNAS.map(c => {
              const items = filtered.filter(r => r.timing_prioridade === c.key)
              const val = items.reduce((s, r) => s + (r.valor_prioridade || 0), 0)
              return (
                <div key={c.key} style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{items.length} <span style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>· {fmtR(val)}</span></div>
                </div>
              )
            })}
          </div>

          {/* FILTROS */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ flex: 1, minWidth: 200, height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 15px', fontSize: 13, outline: 'none' }}
              placeholder="Pesquisar cliente ou produto..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none', cursor: 'pointer' }}
              value={accountFilter} onChange={e => setAccountFilter(e.target.value)}>
              <option value="todos">Todos os Accounts</option>
              {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* KANBAN */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>Carregando...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUNAS.length + (outros.length ? 1 : 0)}, 1fr)`, gap: 16, alignItems: 'start' }}>
              {COLUNAS.map(col => {
                const items = filtered.filter(r => r.timing_prioridade === col.key)
                return (
                  <div key={col.key} style={{ background: col.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, minHeight: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: col.color, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                      {col.label} <span style={{ fontWeight: 600, color: C.text3 }}>({items.length})</span>
                    </div>
                    {items.length === 0 ? (
                      <div style={{ fontSize: 12, color: C.text3, textAlign: 'center', padding: 20 }}>Sem oportunidades</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {items.map(r => (
                          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{r.cliente}</div>
                              {r.flag && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                                  background: r.flag === 'Care' ? C.amberBg : C.greenBg,
                                  color: r.flag === 'Care' ? C.amber : C.green,
                                }}>{r.flag === 'Care' ? '⚠ Care' : '✓ Safe'}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>{r.prioridade_produto || '—'}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{fmtR(r.valor_prioridade)}</span>
                              <span style={{ fontSize: 10, color: C.text3 }}>{r.account || '—'}</span>
                            </div>
                            {r.situacao_atual && (
                              <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', display: 'inline-block', padding: '2px 6px', borderRadius: 4 }}>
                                {r.situacao_atual}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {outros.length > 0 && (
                <div style={{ background: 'var(--hover-bg)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, minHeight: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text3, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                    Sem Timing <span style={{ fontWeight: 600 }}>({outros.length})</span>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {outros.map(r => (
                      <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>{r.cliente}</div>
                        <div style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>{r.prioridade_produto || '—'}</div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{fmtR(r.valor_prioridade)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
