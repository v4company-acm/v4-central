import { useState, useEffect, useMemo, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '../components/Layout'
import FilterPopover from '../components/FilterPopover'
import DetailDrawer from '../components/DetailDrawer'

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

interface HealthRow { id: number; cliente: string; status: string | null; flag: string | null; recorrente: number | null }

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
function fmtSyncedAt(v: string | null) { if (!v) return 'ainda não sincronizado'; return new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function norm(s: string | null | undefined) { return (s || '').trim().toLowerCase() }
function qArr(v: any): string[] { if (!v) return []; return Array.isArray(v) ? v : String(v).split(',').filter(Boolean) }

export default function AccountPlanPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [health, setHealth] = useState<HealthRow[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<'kanban' | 'tabela'>('kanban')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [account, setAccount] = useState<string[]>([])
  const [flag, setFlag] = useState<string[]>([])
  const [minValor, setMinValor] = useState('')
  const [sortKey, setSortKey] = useState<'cliente' | 'valor_prioridade' | 'timing_prioridade'>('valor_prioridade')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [selected, setSelected] = useState<Row | null>(null)

  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 220); return () => clearTimeout(t) }, [searchInput])

  useEffect(() => {
    if (!router.isReady) return
    setAccount(qArr(router.query.account)); setFlag(qArr(router.query.flag))
    if (typeof router.query.q === 'string') setSearchInput(router.query.q)
    if (typeof router.query.min === 'string') setMinValor(router.query.min)
    if (router.query.view === 'tabela') setView('tabela')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  useEffect(() => {
    if (!router.isReady) return
    const q: Record<string, string> = {}
    if (account.length) q.account = account.join(',')
    if (flag.length) q.flag = flag.join(',')
    if (search) q.q = search
    if (minValor) q.min = minValor
    if (view === 'tabela') q.view = 'tabela'
    router.replace({ pathname: '/account-plan', query: q }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, flag, search, minValor, view, router.isReady])

  useEffect(() => {
    Promise.all([
      fetch('/api/account-plan').then(r => r.json()),
      fetch('/api/gestao-projetos').then(r => r.json()),
    ]).then(([a, g]) => {
      setRows(a.rows || []); setSyncedAt(a.syncedAt || null)
      setHealth(g.rows || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const facet = useCallback((key: keyof Row) => {
    const counts = new Map<string, number>()
    rows.forEach(r => { const v = r[key]; if (v) counts.set(String(v), (counts.get(String(v)) || 0) + 1) })
    return [...counts.entries()].map(([value, count]) => ({ value, label: value, count })).sort((a, b) => b.count - a.count)
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const min = parseFloat(minValor) || 0
    return rows.filter(r =>
      (!q || r.cliente.toLowerCase().includes(q) || (r.prioridade_produto || '').toLowerCase().includes(q)) &&
      (account.length === 0 || account.includes(r.account || '')) &&
      (flag.length === 0 || flag.includes(r.flag || '')) &&
      (min === 0 || (r.valor_prioridade || 0) >= min)
    )
  }, [rows, search, account, flag, minValor])

  const sortedTable = useMemo(() => [...filtered].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string' || typeof bv === 'string') return sortDir * String(av ?? '').localeCompare(String(bv ?? ''))
    return sortDir * ((av as number ?? 0) - (bv as number ?? 0))
  }), [filtered, sortKey, sortDir])

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(k); setSortDir(-1) }
  }

  const outros = filtered.filter(r => !COLUNAS.some(c => c.key === r.timing_prioridade))
  const totalGeral = filtered.reduce((s, r) => s + (r.valor_prioridade || 0), 0)
  const hasFilters = account.length || flag.length || search || minValor
  function clearAll() { setAccount([]); setFlag([]); setSearchInput(''); setMinValor('') }

  const healthDoCliente = selected ? health.find(h => norm(h.cliente) === norm(selected.cliente)) : null

  function Card({ r }: { r: Row }) {
    return (
      <div onClick={() => setSelected(r)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)} onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{r.cliente}</div>
          {r.flag && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', background: r.flag === 'Care' ? C.amberBg : C.greenBg, color: r.flag === 'Care' ? C.amber : C.green }}>{r.flag === 'Care' ? '⚠ Care' : '✓ Safe'}</span>}
        </div>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>{r.prioridade_produto || '—'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{fmtR(r.valor_prioridade)}</span>
          <span style={{ fontSize: 10, color: C.text3 }}>{r.account || '—'}</span>
        </div>
        {r.situacao_atual && <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', display: 'inline-block', padding: '2px 6px', borderRadius: 4 }}>{r.situacao_atual}</div>}
      </div>
    )
  }

  return (
    <>
      <Head><title>Account Plan — V4 Central de Clientes</title></Head>
      <Layout title="Account Plan">
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: C.text3 }}>Pipeline de upsell por cliente · sincronizado da planilha a cada 4h via n8n</div>
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>🔄 {fmtSyncedAt(syncedAt)}</div>
          </div>

          {/* KPI STRIP */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Oportunidades</div>
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

          {/* FILTROS + VIEW TOGGLE */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ flex: 1, minWidth: 180, height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 15px', fontSize: 13, outline: 'none' }}
              placeholder="Pesquisar cliente ou produto..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            <FilterPopover label="Account" options={facet('account')} selected={account} onChange={setAccount} />
            <FilterPopover label="Flag" options={facet('flag')} selected={flag} onChange={setFlag} />
            <input type="number" placeholder="Valor mín. (R$)" value={minValor} onChange={e => setMinValor(e.target.value)}
              style={{ width: 140, height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none' }} />
            {!!hasFilters && <button onClick={clearAll} className="btn btn-sm">Limpar tudo</button>}
            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', background: 'var(--hover-bg)', borderRadius: 8, padding: 3 }}>
              {(['kanban', 'tabela'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: view === v ? C.card : 'transparent', color: view === v ? C.text : C.text3,
                  boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>{v === 'kanban' ? '▦ Kanban' : '☰ Tabela'}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>Carregando...</div>
          ) : view === 'kanban' ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUNAS.length + (outros.length ? 1 : 0)}, 1fr)`, gap: 16, alignItems: 'start' }}>
              {COLUNAS.map(col => {
                const items = filtered.filter(r => r.timing_prioridade === col.key)
                return (
                  <div key={col.key} style={{ background: col.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, minHeight: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: col.color, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                      {col.label} <span style={{ fontWeight: 600, color: C.text3 }}>({items.length})</span>
                    </div>
                    {items.length === 0 ? <div style={{ fontSize: 12, color: C.text3, textAlign: 'center', padding: 20 }}>Sem oportunidades</div> : (
                      <div style={{ display: 'grid', gap: 10 }}>{items.map(r => <Card key={r.id} r={r} />)}</div>
                    )}
                  </div>
                )
              })}
              {outros.length > 0 && (
                <div style={{ background: 'var(--hover-bg)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, minHeight: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text3, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>Sem Timing <span style={{ fontWeight: 600 }}>({outros.length})</span></div>
                  <div style={{ display: 'grid', gap: 10 }}>{outros.map(r => <Card key={r.id} r={r} />)}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--hover-bg)', borderBottom: `1px solid ${C.border}` }}>
                      {[{ l: 'Cliente', k: 'cliente' }, { l: 'Flag', k: null }, { l: 'Produto Priorizado', k: null }, { l: 'Valor', k: 'valor_prioridade' }, { l: 'Timing', k: 'timing_prioridade' }, { l: 'Account', k: null }, { l: 'Situação', k: null }]
                        .map(h => (
                          <th key={h.l} onClick={() => h.k && toggleSort(h.k as any)} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', cursor: h.k ? 'pointer' : 'default' }}>
                            {h.l}{h.k && sortKey === h.k ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTable.map(r => (
                      <tr key={r.id} onClick={() => setSelected(r)} style={{ borderBottom: `1px solid ${C.border2}`, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>{r.cliente}</td>
                        <td style={{ padding: '10px 14px' }}>{r.flag && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: r.flag === 'Care' ? C.amberBg : C.greenBg, color: r.flag === 'Care' ? C.amber : C.green }}>{r.flag}</span>}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{r.prioridade_produto || '—'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>{fmtR(r.valor_prioridade)}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{r.timing_prioridade || '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{r.account || '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.text3, fontSize: 12 }}>{r.situacao_atual || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={selected?.cliente || ''} subtitle={selected?.prioridade_produto || undefined}>
          {selected && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <div className="sec-title" style={{ fontSize: 11 }}>Oportunidade</div>
                <div className="info-row"><span className="info-key">Produto Priorizado</span><span className="info-val">{selected.prioridade_produto || '—'}</span></div>
                <div className="info-row"><span className="info-key">Valor</span><span className="info-val">{fmtR(selected.valor_prioridade)}</span></div>
                <div className="info-row"><span className="info-key">Timing</span><span className="info-val">{selected.timing_prioridade || '—'}</span></div>
                <div className="info-row"><span className="info-key">Account</span><span className="info-val">{selected.account || '—'}</span></div>
                <div className="info-row"><span className="info-key">Coordenador</span><span className="info-val">{selected.coordenador || '—'}</span></div>
                <div className="info-row"><span className="info-key">Situação Atual</span><span className="info-val">{selected.situacao_atual || '—'}</span></div>
              </div>
              {(selected.plano_acao || selected.deadline_plano_acao || selected.responsavel) && (
                <div>
                  <div className="sec-title" style={{ fontSize: 11 }}>Plano de Ação</div>
                  <div className="info-row"><span className="info-key">Responsável</span><span className="info-val">{selected.responsavel || '—'}</span></div>
                  <div className="info-row"><span className="info-key">Deadline</span><span className="info-val">{selected.deadline_plano_acao || '—'}</span></div>
                  {selected.plano_acao && <div className="note-block">{selected.plano_acao}</div>}
                </div>
              )}
              {(selected.dores_desafios || selected.impacto || selected.decisao) && (
                <div>
                  <div className="sec-title" style={{ fontSize: 11 }}>Contexto</div>
                  {selected.dores_desafios && <div className="note-block"><strong>Dores/Desafios:</strong> {selected.dores_desafios}</div>}
                  {selected.impacto && <div className="note-block"><strong>Impacto:</strong> {selected.impacto}</div>}
                  {selected.decisao && <div className="note-block"><strong>Decisão:</strong> {selected.decisao}</div>}
                </div>
              )}
              <div>
                <div className="sec-title" style={{ fontSize: 11 }}>Saúde do Cliente</div>
                {healthDoCliente ? (
                  <div style={{ background: 'var(--hover-bg)', border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{healthDoCliente.flag}</span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{healthDoCliente.status || '—'}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{fmtR(healthDoCliente.recorrente)}/mês</span>
                  </div>
                ) : <div className="empty" style={{ padding: 20 }}>Não encontrado na Gestão de Projetos.</div>}
              </div>
            </div>
          )}
        </DetailDrawer>
      </Layout>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
