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
  status: string | null
  ee_pontual: number | null
  recorrente: number | null
  midia: number | null
  jornada: string | null
  gmv_mensal: number | null
  flag: string | null
  okrs: string | null
  inicio_contrato: string | null
  lt: number | null
  step: string | null
  disc_pagador: string | null
  data_pgt: string | null
  freq_checkin: string | null
  take_rate: number | null
  roi_maior_1: string | null
  replanejamento: string | null
  contrato: string | null
}

interface OppRow {
  id: number; cliente: string; flag: string | null; account: string | null
  prioridade_produto: string | null; valor_prioridade: number | null; timing_prioridade: string | null
  situacao_atual: string | null
}

const C = {
  card: 'var(--card-color)', border: 'var(--border-color)', border2: 'var(--border-light)',
  text: 'var(--text-main)', text2: 'var(--text-secondary)', text3: 'var(--text-muted)',
  red: '#FB2E0A', redLight: 'rgba(251,46,10,0.1)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.1)',
  amber: '#D97706', amberBg: 'rgba(217,119,6,0.1)',
}

const FLAG_META: Record<string, { label: string; color: string }> = {
  '🟢': { label: 'Saudável', color: C.green },
  '🟡': { label: 'Atenção', color: C.amber },
  '⚫️': { label: 'Frio / Inativo', color: C.text3 },
}
const STEP_ORDER = ['E.E', 'V0', 'V1', 'V2']

function fmtR(v: number | null) { if (v === null || v === undefined) return '—'; return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(v: string | null) { if (!v) return '—'; const [y, m, d] = v.split('-'); return `${d}/${m}/${y}` }
function fmtLt(v: number | null) { if (v === null || v === undefined) return '—'; return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' meses' }
function fmtSyncedAt(v: string | null) {
  if (!v) return 'ainda não sincronizado'
  return new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function norm(s: string | null | undefined) { return (s || '').trim().toLowerCase() }
function qArr(v: any): string[] { if (!v) return []; return Array.isArray(v) ? v : String(v).split(',').filter(Boolean) }

const STATUS_COLOR: Record<string, string> = { 'Ativo': C.green, 'Inativo': C.text3, 'Churn antes de entrar': C.red }

export default function GestaoProjetosPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [opps, setOpps] = useState<OppRow[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string[]>([])
  const [flag, setFlag] = useState<string[]>([])
  const [jornada, setJornada] = useState<string[]>([])
  const [step, setStep] = useState<string[]>([])
  const [minRecorrente, setMinRecorrente] = useState('')
  const [onlyRisco, setOnlyRisco] = useState(false)

  const [sortKey, setSortKey] = useState<'cliente' | 'recorrente' | 'gmv_mensal' | 'lt'>('recorrente')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [selected, setSelected] = useState<Row | null>(null)

  // debounce da busca — evita re-filtrar a cada tecla
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 220); return () => clearTimeout(t) }, [searchInput])

  // hidrata filtros a partir da URL (view compartilhável/favoritável)
  useEffect(() => {
    if (!router.isReady) return
    setStatus(qArr(router.query.status)); setFlag(qArr(router.query.flag))
    setJornada(qArr(router.query.jornada)); setStep(qArr(router.query.step))
    if (typeof router.query.q === 'string') setSearchInput(router.query.q)
    if (typeof router.query.min === 'string') setMinRecorrente(router.query.min)
    if (router.query.risco === '1') setOnlyRisco(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  // reflete filtros na URL
  useEffect(() => {
    if (!router.isReady) return
    const q: Record<string, string> = {}
    if (status.length) q.status = status.join(',')
    if (flag.length) q.flag = flag.join(',')
    if (jornada.length) q.jornada = jornada.join(',')
    if (step.length) q.step = step.join(',')
    if (search) q.q = search
    if (minRecorrente) q.min = minRecorrente
    if (onlyRisco) q.risco = '1'
    router.replace({ pathname: '/gestao-projetos', query: q }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, flag, jornada, step, search, minRecorrente, onlyRisco, router.isReady])

  useEffect(() => {
    Promise.all([
      fetch('/api/gestao-projetos').then(r => r.json()),
      fetch('/api/account-plan').then(r => r.json()),
    ]).then(([g, a]) => {
      setRows(g.rows || []); setSyncedAt(g.syncedAt || null)
      setOpps(a.rows || [])
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
    const min = parseFloat(minRecorrente) || 0
    let out = rows.filter(r =>
      (!q || r.cliente.toLowerCase().includes(q)) &&
      (status.length === 0 || status.includes(r.status || '')) &&
      (flag.length === 0 || flag.includes(r.flag || '')) &&
      (jornada.length === 0 || jornada.includes(r.jornada || '')) &&
      (step.length === 0 || step.includes(r.step || '')) &&
      (min === 0 || (r.recorrente || 0) >= min) &&
      (!onlyRisco || r.flag === '⚫️' || r.flag === '🟡' || norm(r.roi_maior_1) === 'não')
    )
    out = [...out].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'string' || typeof bv === 'string') return sortDir * String(av ?? '').localeCompare(String(bv ?? ''))
      return sortDir * ((av as number ?? -Infinity) - (bv as number ?? -Infinity))
    })
    return out
  }, [rows, search, status, flag, jornada, step, minRecorrente, onlyRisco, sortKey, sortDir])

  const kpis = useMemo(() => {
    const ativos = rows.filter(r => r.status === 'Ativo')
    return {
      total: rows.length, ativos: ativos.length,
      recorrenteTotal: ativos.reduce((s, r) => s + (r.recorrente || 0), 0),
      emRisco: rows.filter(r => r.flag === '⚫️' || r.flag === '🟡').length,
    }
  }, [rows])

  const flagSegments = useMemo(() => {
    const total = rows.length || 1
    return ['🟢', '🟡', '⚫️'].map(f => ({ flag: f, ...FLAG_META[f], count: rows.filter(r => r.flag === f).length, pct: rows.filter(r => r.flag === f).length / total * 100 }))
  }, [rows])

  const stepSegments = useMemo(() => {
    const present = STEP_ORDER.filter(s => rows.some(r => r.step === s))
    return present.map(s => ({ step: s, count: rows.filter(r => r.step === s).length }))
  }, [rows])

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(k); setSortDir(-1) }
  }

  function clearAll() { setStatus([]); setFlag([]); setJornada([]); setStep([]); setSearchInput(''); setMinRecorrente(''); setOnlyRisco(false) }
  const hasFilters = status.length || flag.length || jornada.length || step.length || search || minRecorrente || onlyRisco

  const oppsDoCliente = selected ? opps.filter(o => norm(o.cliente) === norm(selected.cliente)) : []

  return (
    <>
      <Head><title>Gestão de Projetos — V4 Central de Clientes</title></Head>
      <Layout title="Gestão de Projetos">
        <div style={{ maxWidth: 1500, margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: C.text3 }}>Health board de clientes · sincronizado da planilha a cada 4h via n8n</div>
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>🔄 {fmtSyncedAt(syncedAt)}</div>
          </div>

          {/* KPI + SEGMENTAÇÃO DE SAÚDE */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Recorrente Ativo</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{fmtR(kpis.recorrenteTotal)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{kpis.ativos} de {kpis.total} clientes ativos</div>
            </div>
            <button onClick={() => setOnlyRisco(v => !v)} style={{
              textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: 16,
              background: onlyRisco ? C.red : C.redLight, border: onlyRisco ? 'none' : `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: onlyRisco ? 'rgba(255,255,255,0.8)' : C.red, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Clientes em Risco</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: onlyRisco ? '#fff' : C.red }}>{kpis.emRisco}</div>
              <div style={{ fontSize: 11, color: onlyRisco ? 'rgba(255,255,255,0.75)' : C.text3, marginTop: 4 }}>{onlyRisco ? 'clique pra ver todos' : 'clique pra filtrar'}</div>
            </button>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Distribuição de Saúde</div>
              <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                {flagSegments.map(s => s.count > 0 && (
                  <div key={s.flag} title={`${s.label}: ${s.count}`} style={{ width: `${s.pct}%`, background: s.color }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {flagSegments.map(s => (
                  <div key={s.flag} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.text2 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />{s.label} ({s.count})
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FUNIL DE MATURIDADE (Step) */}
          {stepSegments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'stretch' }}>
              {stepSegments.map((s, i) => (
                <button key={s.step} onClick={() => setStep(p => p.includes(s.step) ? p.filter(x => x !== s.step) : [...p, s.step])} style={{
                  flex: 1, cursor: 'pointer', textAlign: 'center', padding: '10px 8px', borderRadius: 8,
                  border: step.includes(s.step) ? `1.5px solid ${C.red}` : `1px solid ${C.border}`,
                  background: step.includes(s.step) ? C.redLight : C.card,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' }}>{s.step}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{s.count}</div>
                </button>
              ))}
            </div>
          )}

          {/* FILTROS FACETADOS */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ flex: 1, minWidth: 180, height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 15px', fontSize: 13, outline: 'none' }}
              placeholder="Pesquisar cliente..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            <FilterPopover label="Status" options={facet('status')} selected={status} onChange={setStatus} />
            <FilterPopover label="Flag" options={facet('flag')} selected={flag} onChange={setFlag} />
            <FilterPopover label="Jornada" options={facet('jornada')} selected={jornada} onChange={setJornada} />
            <FilterPopover label="Step" options={facet('step')} selected={step} onChange={setStep} />
            <input type="number" placeholder="Recorrente mín. (R$)" value={minRecorrente} onChange={e => setMinRecorrente(e.target.value)}
              style={{ width: 160, height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none' }} />
            {!!hasFilters && <button onClick={clearAll} className="btn btn-sm">Limpar tudo</button>}
            <span style={{ fontSize: 11, color: C.text3, marginLeft: 'auto' }}>{filtered.length} de {rows.length}</span>
          </div>

          {/* TABELA (colunas essenciais — resto fica no drawer de detalhe) */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: C.card, borderRadius: 12, border: `1px dashed ${C.border2}`, color: C.text2 }}>Nenhum cliente encontrado com esses filtros.</div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--hover-bg)', borderBottom: `1px solid ${C.border}` }}>
                      {[
                        { l: '', k: null }, { l: 'Cliente', k: 'cliente' }, { l: 'Status', k: null }, { l: 'Jornada / Step', k: null },
                        { l: 'Recorrente', k: 'recorrente' }, { l: 'GMV Mensal', k: 'gmv_mensal' }, { l: 'LT', k: 'lt' },
                        { l: 'Check-in', k: null }, { l: 'ROI > 1', k: null }, { l: 'Oportunidades', k: null },
                      ].map(h => (
                        <th key={h.l || 'flag'} onClick={() => h.k && toggleSort(h.k as any)} style={{
                          textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.text3,
                          textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
                          cursor: h.k ? 'pointer' : 'default', userSelect: 'none',
                        }}>{h.l}{h.k && sortKey === h.k ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const nOpps = opps.filter(o => norm(o.cliente) === norm(r.cliente)).length
                      return (
                        <tr key={r.id} onClick={() => setSelected(r)} style={{ borderBottom: `1px solid ${C.border2}`, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '10px 14px', fontSize: 16 }}>{r.flag || '—'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>{r.cliente}</td>
                          <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status || ''] || C.text3 }}>{r.status || '—'}</span></td>
                          <td style={{ padding: '10px 14px', color: C.text2 }}>{r.jornada || '—'}{r.step ? ` · ${r.step}` : ''}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: C.text }}>{fmtR(r.recorrente)}</td>
                          <td style={{ padding: '10px 14px', color: C.text2 }}>{fmtR(r.gmv_mensal)}</td>
                          <td style={{ padding: '10px 14px', color: C.text2 }}>{fmtLt(r.lt)}</td>
                          <td style={{ padding: '10px 14px', color: C.text2 }}>{r.freq_checkin || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {r.roi_maior_1 ? (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: r.roi_maior_1.toLowerCase() === 'sim' ? C.greenBg : C.redLight, color: r.roi_maior_1.toLowerCase() === 'sim' ? C.green : C.red }}>{r.roi_maior_1}</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {nOpps > 0 ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB' }}>{nOpps} no pipe</span> : <span style={{ color: C.text3 }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={selected?.cliente || ''} subtitle={selected?.status || undefined}>
          {selected && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{selected.flag}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: FLAG_META[selected.flag || '']?.color || C.text2 }}>{FLAG_META[selected.flag || '']?.label || 'Sem classificação'}</span>
              </div>

              <div>
                <div className="sec-title" style={{ fontSize: 11 }}>Financeiro</div>
                <div className="info-row"><span className="info-key">Recorrente</span><span className="info-val">{fmtR(selected.recorrente)}</span></div>
                <div className="info-row"><span className="info-key">Mídia</span><span className="info-val">{fmtR(selected.midia)}</span></div>
                <div className="info-row"><span className="info-key">E.E / Pontual</span><span className="info-val">{fmtR(selected.ee_pontual)}</span></div>
                <div className="info-row"><span className="info-key">GMV Mensal</span><span className="info-val">{fmtR(selected.gmv_mensal)}</span></div>
                <div className="info-row"><span className="info-key">Take Rate</span><span className="info-val">{selected.take_rate ? (selected.take_rate * 100).toFixed(2) + '%' : '—'}</span></div>
              </div>

              <div>
                <div className="sec-title" style={{ fontSize: 11 }}>Jornada</div>
                <div className="info-row"><span className="info-key">Jornada / Step</span><span className="info-val">{selected.jornada || '—'} {selected.step ? `· ${selected.step}` : ''}</span></div>
                <div className="info-row"><span className="info-key">Início do Contrato</span><span className="info-val">{fmtDate(selected.inicio_contrato)}</span></div>
                <div className="info-row"><span className="info-key">Lifetime</span><span className="info-val">{fmtLt(selected.lt)}</span></div>
                <div className="info-row"><span className="info-key">Frequência de Check-in</span><span className="info-val">{selected.freq_checkin || '—'}</span></div>
                <div className="info-row"><span className="info-key">Dia de Pagamento</span><span className="info-val">{selected.data_pgt || '—'}</span></div>
                <div className="info-row"><span className="info-key">DISC do Pagador</span><span className="info-val">{selected.disc_pagador || '—'}</span></div>
                <div className="info-row"><span className="info-key">OKRs</span><span className="info-val">{selected.okrs || '—'}</span></div>
                <div className="info-row"><span className="info-key">ROI &gt; 1</span><span className="info-val">{selected.roi_maior_1 || '—'}</span></div>
              </div>

              {(selected.replanejamento || selected.contrato) && (
                <div>
                  <div className="sec-title" style={{ fontSize: 11 }}>Notas</div>
                  {selected.replanejamento && <div className="note-block">{selected.replanejamento}</div>}
                  {selected.contrato && <div style={{ fontSize: 12, color: C.text3, wordBreak: 'break-word' }}>📄 {selected.contrato}</div>}
                </div>
              )}

              <div>
                <div className="sec-title" style={{ fontSize: 11 }}>Oportunidades no Account Plan ({oppsDoCliente.length})</div>
                {oppsDoCliente.length === 0 ? (
                  <div className="empty" style={{ padding: 20 }}>Nenhuma oportunidade registrada.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {oppsDoCliente.map(o => (
                      <div key={o.id} style={{ background: 'var(--hover-bg)', border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{o.prioridade_produto || '—'}</span>
                          <span style={{ fontWeight: 800, fontSize: 13 }}>{fmtR(o.valor_prioridade)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.text3 }}>{o.timing_prioridade || '—'} · {o.account || '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
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
