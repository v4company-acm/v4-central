// pages/performance.tsx
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

interface DayData {
  date: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  search_impression_share: number
  search_top_impression_share: number
  search_rank_lost_impression_share: number
  search_budget_lost_impression_share: number
}

// Benchmarks WordStream 2026 — Dental Services
const BENCH = { ctr: 0.0566, cvr: 0.1077, imp_share: 0.60, lost_rank: 0.20, lost_budget: 0.10 }

function sumF(rows: DayData[], key: keyof DayData) {
  return rows.reduce((a, r) => a + (Number(r[key]) || 0), 0)
}
function avgF(rows: DayData[], key: keyof DayData) {
  return rows.length ? sumF(rows, key) / rows.length : 0
}
function fmt(n: number, dec = 0) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function pct(n: number) { return `${(n * 100).toFixed(1)}%` }
function brl(n: number) { return `R$ ${fmt(n, 2)}` }
function toISO(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function deltaV(cur: number, cmp: number) { return cmp ? ((cur - cmp) / cmp) * 100 : null }

function status(val: number, bench: number, invert = false): 'green' | 'yellow' | 'red' {
  const r = val / bench
  if (invert) return r <= 0.7 ? 'green' : r <= 1.0 ? 'yellow' : 'red'
  return r >= 0.9 ? 'green' : r >= 0.6 ? 'yellow' : 'red'
}
const C = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' }
const BG = { green: '#f0fdf4', yellow: '#fffbeb', red: '#fef2f2' }
const BD = { green: '#bbf7d0', yellow: '#fde68a', red: '#fecaca' }

const PRESETS = [{ l: '7d', d: 7 }, { l: '14d', d: 14 }, { l: '30d', d: 30 }, { l: '60d', d: 60 }]

// Clientes com Google Ads
const CLIENTES = [
  { id: '3070f334-1ff5-468c-bb06-29cfb05f6a71', nome: 'Midas OdontoMed' },
  { id: '56e9a96d-b6af-49c0-b04f-354c0c5aa3bb', nome: 'Cupido do Prazer' },
  { id: '709ca941-21aa-429a-891d-1a8bbb133122', nome: 'Botica de Rossi' },
]

export default function PerformancePage() {
  const today = new Date()
  const [clienteId, setClienteId] = useState(CLIENTES[0].id)
  const [preset, setPreset] = useState(30)
  const [dateFrom, setDateFrom] = useState(toISO(addDays(today, -30)))
  const [dateTo,   setDateTo]   = useState(toISO(today))
  const [compare,  setCompare]  = useState(false)
  const [current,  setCurrent]  = useState<DayData[]>([])
  const [cmp,      setCmp]      = useState<DayData[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [tab,      setTab]      = useState<'funil' | 'campanha' | 'impressao' | 'debug'>('funil')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const days    = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000)
      const cmpTo   = toISO(addDays(new Date(dateFrom), -1))
      const cmpFrom = toISO(addDays(new Date(dateFrom), -days - 1))
      const params  = new URLSearchParams({ cliente_id: clienteId, date_from: dateFrom, date_to: dateTo })
      if (compare) { params.set('compare_from', cmpFrom); params.set('compare_to', cmpTo) }
      const res  = await fetch(`/api/performance?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCurrent(json.current || [])
      setCmp(json.compare || [])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [clienteId, dateFrom, dateTo, compare])

  useEffect(() => { load() }, [load])

  function applyPreset(days: number) {
    setPreset(days)
    setDateFrom(toISO(addDays(today, -days)))
    setDateTo(toISO(today))
  }

  // ── Agregados ──
  const imp      = sumF(current, 'impressions')
  const clk      = sumF(current, 'clicks')
  const conv     = sumF(current, 'conversions')
  const spend    = sumF(current, 'spend')
  const ctrV     = imp  ? clk  / imp  : 0
  const cvr      = clk  ? conv / clk  : 0
  const cpc      = clk  ? spend / clk  : 0
  const cpa      = conv ? spend / conv : 0
  const impShare = avgF(current, 'search_impression_share')
  const topShare = avgF(current, 'search_top_impression_share')
  const lostRank = avgF(current, 'search_rank_lost_impression_share')
  const lostBudg = avgF(current, 'search_budget_lost_impression_share')

  const cImp  = sumF(cmp, 'impressions')
  const cClk  = sumF(cmp, 'clicks')
  const cConv = sumF(cmp, 'conversions')
  const cSpend = sumF(cmp, 'spend')
  const cCtr  = cImp ? cClk  / cImp  : 0
  const cCvr  = cClk ? cConv / cClk  : 0
  const cCpa  = cConv ? cSpend / cConv : 0

  // ── Campanhas agrupadas ──
  const campanhas = Object.values(
    current.reduce((acc: any, r) => {
      const k = r.campaign_name
      if (!acc[k]) acc[k] = { name: k, spend: 0, impressions: 0, clicks: 0, conversions: 0 }
      acc[k].spend       += r.spend
      acc[k].impressions += r.impressions
      acc[k].clicks      += r.clicks
      acc[k].conversions += r.conversions
      return acc
    }, {})
  ).sort((a: any, b: any) => b.spend - a.spend) as any[]

  // ── Tendência diária ──
  const porDia = Object.values(
    current.reduce((acc: any, r) => {
      if (!acc[r.date]) acc[r.date] = { date: r.date, spend: 0, impressions: 0, clicks: 0, conversions: 0 }
      acc[r.date].spend       += r.spend
      acc[r.date].impressions += r.impressions
      acc[r.date].clicks      += r.clicks
      acc[r.date].conversions += r.conversions
      return acc
    }, {})
  ).sort((a: any, b: any) => a.date.localeCompare(b.date)) as any[]

  // ── Estilos ──
  const btnS = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 8,
    border: `1.5px solid ${active ? '#FB2E0A' : '#e5e7eb'}`,
    background: active ? '#FB2E0A' : '#fff',
    color: active ? '#fff' : '#374151',
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
  })
  const tabS = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
    color: active ? '#FB2E0A' : '#6b7280', background: 'none', border: 'none',
    borderBottom: `2px solid ${active ? '#FB2E0A' : 'transparent'}`,
  })
  const th: React.CSSProperties = { padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: 12, borderBottom: '1px solid #f9fafb', color: '#111' }

  function DeltaBadge({ val, inv }: { val: number | null; inv?: boolean }) {
    if (val === null) return null
    const good = inv ? val < 0 : val > 0
    return <span style={{ fontSize: 10, fontWeight: 700, color: good ? '#16a34a' : '#dc2626', marginLeft: 4 }}>{val > 0 ? '▲' : '▼'} {Math.abs(val).toFixed(1)}%</span>
  }

  function KpiCard({ label, val, d, inv, s, sub }: { label: string; val: string; d?: number | null; inv?: boolean; s?: 'green' | 'yellow' | 'red' | null; sub?: string }) {
    return (
      <div style={{ background: s ? BG[s] : '#fff', border: `1px solid ${s ? BD[s] : '#e5e7eb'}`, borderRadius: 10, padding: '12px 16px', minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{label}</p>
        <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: s ? C[s] : '#111' }}>
          {val}{d !== undefined && <DeltaBadge val={d ?? null} inv={inv} />}
        </p>
        {s && <p style={{ fontSize: 10, color: C[s], margin: '3px 0 0', fontWeight: 600 }}>{s === 'green' ? '✓ ok' : s === 'yellow' ? '~ atenção' : '✗ gap'}{sub ? ` · ${sub}` : ''}</p>}
        {!s && sub && <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>{sub}</p>}
      </div>
    )
  }

  // Mini spark SVG
  function Spark({ vals, color = '#FB2E0A' }: { vals: number[]; color?: string }) {
    if (vals.length < 2) return null
    const max = Math.max(...vals) || 1
    const W = 100, H = 28
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - (v / max) * H}`).join(' ')
    return <svg width={W} height={H} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
  }

  return (
    <>
      <Head><title>Performance | {CLIENTES.find(c => c.id === clienteId)?.nome}</title></Head>
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'IBM Plex Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ background: '#111', color: '#fff', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 14 }}>
            <div style={{ background: '#FB2E0A', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>V4</div>
            Performance Analytics
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: 20, color: 'rgba(255,255,255,0.7)' }}>GOOGLE ADS</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Benchmark: WordStream 2026 · Dental</span>
          </div>
        </div>

        <div style={{ maxWidth: 1260, margin: '0 auto', padding: '20px 20px' }}>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>

            {/* Seletor de cliente */}
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontWeight: 600, background: '#fff', cursor: 'pointer' }}
            >
              {CLIENTES.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>

            <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />

            {PRESETS.map(p => <button key={p.d} style={btnS(preset === p.d)} onClick={() => applyPreset(p.d)}>{p.l}</button>)}

            <input type="date" style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 12 }} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(0) }} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>até</span>
            <input type="date" style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 12 }} value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(0) }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              vs anterior
            </label>

            <button onClick={load} style={{ ...btnS(false), background: '#111', color: '#fff', border: '1.5px solid #111' }}>
              {loading ? '⟳ Carregando...' : '⟳ Atualizar'}
            </button>
          </div>

          {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#991b1b', marginBottom: 14, fontSize: 12 }}>⚠ {error}</div>}

          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            <KpiCard label="Impressões"  val={fmt(imp)}   d={deltaV(imp,   cImp)}  sub={compare && cmp.length ? `ant: ${fmt(cImp)}` : undefined} />
            <KpiCard label="Cliques"     val={fmt(clk)}   d={deltaV(clk,   cClk)}  sub={compare && cmp.length ? `ant: ${fmt(cClk)}` : undefined} />
            <KpiCard label="CTR"         val={pct(ctrV)}  d={deltaV(ctrV,  cCtr)}  s={status(ctrV, BENCH.ctr)}    sub={`bench ${pct(BENCH.ctr)}`} />
            <KpiCard label="Conversões"  val={fmt(conv)}  d={deltaV(conv,  cConv)} sub={compare && cmp.length ? `ant: ${fmt(cConv)}` : undefined} />
            <KpiCard label="Taxa Conv."  val={pct(cvr)}   d={deltaV(cvr,   cCvr)}  s={status(cvr,  BENCH.cvr)}    sub={`bench ${pct(BENCH.cvr)}`} />
            <KpiCard label="Imp. Share"  val={pct(impShare)} d={compare && cmp.length ? deltaV(impShare, avgF(cmp, 'search_impression_share')) : undefined} s={status(impShare, BENCH.imp_share)} sub={`bench ${pct(BENCH.imp_share)}`} />
            <KpiCard label="Investido"   val={brl(spend)} d={deltaV(spend, cSpend)} inv sub={compare && cmp.length ? `ant: ${brl(cSpend)}` : undefined} />
            <KpiCard label="CPC"         val={brl(cpc)}  inv />
            <KpiCard label="CPA"         val={conv ? brl(cpa) : '—'} d={cCpa ? deltaV(cpa, cCpa) : undefined} inv sub={compare && cmp.length && cConv ? `ant: ${brl(cCpa)}` : undefined} />
          </div>

          {/* Tabs */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
              <button style={tabS(tab === 'funil')}     onClick={() => setTab('funil')}>🎯 Funil & Drop-off</button>
              <button style={tabS(tab === 'campanha')}  onClick={() => setTab('campanha')}>📋 Por Campanha</button>
              <button style={tabS(tab === 'impressao')} onClick={() => setTab('impressao')}>📊 Impression Share</button>
              <button style={tabS(tab === 'debug')}     onClick={() => setTab('debug')}>🔍 Debug Diário</button>
            </div>

            {/* ═══ FUNIL ═══ */}
            {tab === 'funil' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: '#111' }}>Funil com drop-off em cada etapa</h3>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 20px' }}>Onde está vazando o volume?</p>

                  {[
                    { label: 'Impressões', val: imp, pctVal: 100, note: `IS: ${pct(impShare)} — potencial: ${fmt(imp / (impShare || 1))}`, color: '#FB2E0A' },
                    { label: 'Cliques', val: clk, pctVal: imp ? (clk / imp) * 100 : 0, note: `CTR ${pct(ctrV)} (bench ${pct(BENCH.ctr)}) — drop-off: ${fmt(imp - clk)} impressões sem clique`, color: '#ef4444' },
                    { label: 'Conversões', val: conv, pctVal: imp ? (conv / imp) * 100 : 0, note: `CVR ${pct(cvr)} (bench ${pct(BENCH.cvr)}) — drop-off: ${fmt(clk - conv)} cliques sem converter`, color: '#b91c1c' },
                  ].map((item, i) => (
                    <div key={i} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 700 }}>{item.label}</span>
                        <span style={{ fontWeight: 800 }}>{i === 0 ? fmt(item.val) : i === 1 ? fmt(item.val) : fmt(item.val)}</span>
                      </div>
                      <div style={{ background: '#f3f4f6', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${Math.min(item.pctVal, 100)}%`, height: '100%', background: item.color, borderRadius: 6, transition: 'width .5s' }} />
                      </div>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{item.note}</p>
                    </div>
                  ))}

                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px', marginTop: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#9a3412' }}>📈 Potencial não realizado</p>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
                      Com CVR no benchmark dental ({pct(BENCH.cvr)}): <strong>+{fmt(Math.round(clk * BENCH.cvr) - conv)} conversões adicionais</strong> com o mesmo investimento.<br />
                      Com IS em 60%: <strong>+{fmt(Math.round((imp / (impShare || 1)) * 0.60 * ctrV * cvr) - conv)} conversões</strong> capturando mais impressões.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: '#111' }}>Eficiência por etapa vs benchmark</h3>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 20px' }}>Fonte: WordStream 2026 · Dental Services</p>

                  {[
                    { label: 'CTR', val: ctrV, bench: BENCH.ctr, fmt: pct, inv: false, note: 'Impressões → Cliques' },
                    { label: 'Taxa de Conversão', val: cvr, bench: BENCH.cvr, fmt: pct, inv: false, note: 'Cliques → Conversões' },
                    { label: 'Impression Share', val: impShare, bench: BENCH.imp_share, fmt: pct, inv: false, note: 'Visibilidade no leilão' },
                    { label: 'Perdida por Rank', val: lostRank, bench: BENCH.lost_rank, fmt: pct, inv: true, note: 'Quality Score / Lance' },
                    { label: 'Perdida por Budget', val: lostBudg, bench: BENCH.lost_budget, fmt: pct, inv: true, note: 'Orçamento insuficiente' },
                  ].map(item => {
                    const s     = status(item.val, item.bench, item.inv)
                    const ratio = Math.min((item.val / item.bench) * 100, 100)
                    return (
                      <div key={item.label} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</span>
                            <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 6 }}>{item.note}</span>
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C[s] }}>{item.fmt(item.val)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${ratio}%`, height: '100%', background: C[s], borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>{ratio.toFixed(0)}% · bench {item.fmt(item.bench)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ═══ POR CAMPANHA ═══ */}
            {tab === 'campanha' && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: '#111' }}>Desempenho por Campanha</h3>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 20px' }}>Ordenado por investimento.</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Campanha', 'Investido', 'Impressões', 'Cliques', 'CTR', 'Conversões', 'CVR', 'CPA'].map(h => <th key={h} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {campanhas.map((c: any, i: number) => {
                        const cCtr = c.impressions ? c.clicks / c.impressions : 0
                        const cCvr = c.clicks ? c.conversions / c.clicks : 0
                        const cCpa = c.conversions ? c.spend / c.conversions : 0
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ ...td, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{c.name}</td>
                            <td style={td}>{brl(c.spend)}</td>
                            <td style={td}>{fmt(c.impressions)}</td>
                            <td style={td}>{fmt(c.clicks)}</td>
                            <td style={{ ...td, color: C[status(cCtr, BENCH.ctr)], fontWeight: 700 }}>{pct(cCtr)}</td>
                            <td style={td}>{fmt(c.conversions, 1)}</td>
                            <td style={{ ...td, color: C[status(cCvr, BENCH.cvr)], fontWeight: 700 }}>{pct(cCvr)}</td>
                            <td style={td}>{c.conversions > 0 ? brl(cCpa) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f3f4f6', fontWeight: 800 }}>
                        <td style={td}>TOTAL</td>
                        <td style={td}>{brl(spend)}</td>
                        <td style={td}>{fmt(imp)}</td>
                        <td style={td}>{fmt(clk)}</td>
                        <td style={{ ...td, color: C[status(ctrV, BENCH.ctr)] }}>{pct(ctrV)}</td>
                        <td style={td}>{fmt(conv, 1)}</td>
                        <td style={{ ...td, color: C[status(cvr, BENCH.cvr)] }}>{pct(cvr)}</td>
                        <td style={td}>{conv > 0 ? brl(cpa) : '—'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ IMPRESSION SHARE ═══ */}
            {tab === 'impressao' && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: '#111' }}>Parcela de Impressão</h3>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 20px' }}>Qual % das impressões disponíveis no leilão você está capturando — e onde está perdendo.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Parcela Ganha',     val: impShare, bench: BENCH.imp_share, inv: false },
                    { label: 'Topo de Página',    val: topShare, bench: 0.5,             inv: false },
                    { label: 'Perdida por Rank',  val: lostRank, bench: BENCH.lost_rank,  inv: true  },
                    { label: 'Perdida p/ Budget', val: lostBudg, bench: BENCH.lost_budget,inv: true  },
                  ].map(item => {
                    const s = status(item.val, item.bench, item.inv)
                    return (
                      <div key={item.label} style={{ background: BG[s], border: `1px solid ${BD[s]}`, borderRadius: 10, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{item.label}</p>
                        <p style={{ fontSize: 28, fontWeight: 900, margin: 0, color: C[s] }}>{pct(item.val)}</p>
                        <p style={{ fontSize: 10, color: C[s], margin: '4px 0 0', fontWeight: 600 }}>bench: {pct(item.bench)}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Barra visual */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Distribuição de impressões disponíveis</p>
                  <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
                    <div style={{ width: `${impShare * 100}%`, background: '#FB2E0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                      {impShare > 0.08 ? `✓ ${pct(impShare)}` : ''}
                    </div>
                    <div style={{ width: `${lostRank * 100}%`, background: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                      {lostRank > 0.06 ? `Rank ${pct(lostRank)}` : ''}
                    </div>
                    <div style={{ width: `${lostBudg * 100}%`, background: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7f1d1d', fontSize: 10, fontWeight: 700 }}>
                      {lostBudg > 0.06 ? `Budget ${pct(lostBudg)}` : ''}
                    </div>
                    <div style={{ flex: 1, background: '#f3f4f6' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 10, color: '#6b7280' }}>
                    <span>🔴 Ganhas</span><span>🟠 Perdidas Rank/QS</span><span>🟡 Perdidas Budget</span><span>⬜ Não disputadas</span>
                  </div>
                </div>

                {/* Diagnóstico */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>Gap por Rank/QS ({pct(lostRank)}) → ação:</p>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#78350f', lineHeight: 1.9 }}>
                      <li>Aumentar relevância do anúncio vs keyword</li>
                      <li>Melhorar Ad Strength para "Excelente"</li>
                      <li>Adicionar extensões (sitelink, callout)</li>
                      <li>Revisar lance ou mudar estratégia de bid</li>
                    </ul>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#991b1b' }}>Gap por Budget ({pct(lostBudg)}) → ação:</p>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#7f1d1d', lineHeight: 1.9 }}>
                      <li>Aumentar orçamento diário</li>
                      <li>Concentrar budget nos horários de pico</li>
                      <li>Pausar keywords de baixa intenção</li>
                      <li>Segmentar por região para reduzir competição</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ DEBUG DIÁRIO ═══ */}
            {tab === 'debug' && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: '#111' }}>Tendência Diária</h3>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 16px' }}>Dados agregados por dia (todas as campanhas filtradas).</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Data','Investido','Impressões','Cliques','CTR','Conversões','CVR','CPA'].map(h => <th key={h} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {porDia.length === 0 && (
                        <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#9ca3af', padding: 32 }}>Nenhum dado no período.</td></tr>
                      )}
                      {porDia.map((r: any, i: number) => {
                        const rCtr = r.impressions ? r.clicks / r.impressions : 0
                        const rCvr = r.clicks ? r.conversions / r.clicks : 0
                        const rCpa = r.conversions ? r.spend / r.conversions : 0
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ ...td, fontWeight: 700 }}>{r.date}</td>
                            <td style={td}>{brl(r.spend)}</td>
                            <td style={td}>{fmt(r.impressions)}</td>
                            <td style={td}>{fmt(r.clicks)}</td>
                            <td style={{ ...td, color: C[status(rCtr, BENCH.ctr)], fontWeight: 700 }}>{pct(rCtr)}</td>
                            <td style={td}>{fmt(r.conversions, 1)}</td>
                            <td style={{ ...td, color: C[status(rCvr, BENCH.cvr)], fontWeight: 700 }}>{pct(rCvr)}</td>
                            <td style={td}>{r.conversions > 0 ? brl(rCpa) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {porDia.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#f3f4f6', fontWeight: 800 }}>
                          <td style={td}>TOTAL/MÉD.</td>
                          <td style={td}>{brl(spend)}</td>
                          <td style={td}>{fmt(imp)}</td>
                          <td style={td}>{fmt(clk)}</td>
                          <td style={{ ...td, color: C[status(ctrV, BENCH.ctr)] }}>{pct(ctrV)}</td>
                          <td style={td}>{fmt(conv, 1)}</td>
                          <td style={{ ...td, color: C[status(cvr, BENCH.cvr)] }}>{pct(cvr)}</td>
                          <td style={td}>{conv > 0 ? brl(cpa) : '—'}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 12 }}>
                  ✓ verde = dentro do benchmark · ~ amarelo = atenção · ✗ vermelho = gap · Fonte: WordStream 2026
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
