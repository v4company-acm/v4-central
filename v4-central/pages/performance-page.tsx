// pages/performance.tsx
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

// ── Tipos ──────────────────────────────────────────────────────
interface DayData {
  date: string
  impressions: number
  clicks: number
  ctr: number
  cost: number
  conversions: number
  conversion_rate: number
  cost_per_conversion: number
  search_impression_share: number
  search_top_impression_share: number
  search_absolute_top_impression_share: number
  search_lost_impression_share_rank: number
  search_lost_impression_share_budget: number
}

// ── Helpers ────────────────────────────────────────────────────
function sum(rows: DayData[], key: keyof DayData): number {
  return rows.reduce((a, r) => a + (Number(r[key]) || 0), 0)
}
function avg(rows: DayData[], key: keyof DayData): number {
  if (!rows.length) return 0
  return sum(rows, key) / rows.length
}
function fmt(n: number, dec = 0) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function pct(n: number) { return `${fmt(n * 100, 1)}%` }
function brl(n: number) { return `R$ ${fmt(n, 2)}` }
function delta(cur: number, cmp: number) {
  if (!cmp) return null
  const d = ((cur - cmp) / cmp) * 100
  return d
}
function toISO(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ── Presets ────────────────────────────────────────────────────
const PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
]

// ── Componente Delta ───────────────────────────────────────────
function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return null
  const good = invert ? value < 0 : value > 0
  const color = good ? '#16a34a' : '#dc2626'
  const arrow = value > 0 ? '▲' : '▼'
  return (
    <span style={{ color, fontSize: 11, fontWeight: 600, marginLeft: 6 }}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({
  label, value, sub, delta: d, invert = false, alert,
}: {
  label: string; value: string; sub?: string; delta?: number | null; invert?: boolean; alert?: string
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '16px 20px', minWidth: 0,
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: '#111' }}>
        {value}
        {d !== undefined && <Delta value={d ?? null} invert={invert} />}
      </p>
      {sub && <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>{sub}</p>}
      {alert && <p style={{ fontSize: 11, color: '#dc2626', margin: '6px 0 0', fontWeight: 600 }}>⚠ {alert}</p>}
    </div>
  )
}

// ── Barra de funil ─────────────────────────────────────────────
function FunnelBar({ label, value, pctOfTop, color }: { label: string; value: string; pctOfTop: number; color: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#6b7280' }}>{value}</span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: 6, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pctOfTop, 100)}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.6s ease' }} />
      </div>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0' }}>{pctOfTop.toFixed(1)}% do topo</p>
    </div>
  )
}

// ── Mini spark (SVG simples) ───────────────────────────────────
function Spark({ data, color = '#D32F2F' }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const max = Math.max(...data) || 1
  const w = 120, h = 36, pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2)
    const y = h - pad - (v / max) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Página principal ───────────────────────────────────────────
export default function PerformancePage() {
  const today = new Date()
  const [preset, setPreset] = useState(30)
  const [dateFrom, setDateFrom] = useState(toISO(addDays(today, -30)))
  const [dateTo, setDateTo] = useState(toISO(today))
  const [compare, setCompare] = useState(true)
  const [current, setCurrent] = useState<DayData[]>([])
  const [cmp, setCmp] = useState<DayData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'funil' | 'impressao' | 'debug'>('funil')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const days = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000)
      const cmpTo = toISO(addDays(new Date(dateFrom), -1))
      const cmpFrom = toISO(addDays(new Date(dateFrom), -days - 1))
      const url = `/api/performance?date_from=${dateFrom}&date_to=${dateTo}${compare ? `&compare_from=${cmpFrom}&compare_to=${cmpTo}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCurrent(json.current || [])
      setCmp(json.compare || [])
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [dateFrom, dateTo, compare])

  useEffect(() => { load() }, [load])

  function applyPreset(days: number) {
    setPreset(days)
    setDateFrom(toISO(addDays(today, -days)))
    setDateTo(toISO(today))
  }

  // Agregados período atual
  const imp   = sum(current, 'impressions')
  const clk   = sum(current, 'clicks')
  const conv  = sum(current, 'conversions')
  const cost  = sum(current, 'cost')
  const ctrV  = imp ? clk / imp : 0
  const cvr   = clk ? conv / clk : 0
  const cpc   = clk ? cost / clk : 0
  const cpa   = conv ? cost / conv : 0
  const impShare = avg(current, 'search_impression_share')
  const topShare = avg(current, 'search_top_impression_share')
  const absTop   = avg(current, 'search_absolute_top_impression_share')
  const lostRank = avg(current, 'search_lost_impression_share_rank')
  const lostBudg = avg(current, 'search_lost_impression_share_budget')

  // Agregados período comparativo
  const cImp  = sum(cmp, 'impressions')
  const cClk  = sum(cmp, 'clicks')
  const cConv = sum(cmp, 'conversions')
  const cCost = sum(cmp, 'cost')
  const cCtr  = cImp ? cClk / cImp : 0
  const cCvr  = cClk ? cConv / cClk : 0
  const cCpa  = cConv ? cCost / cConv : 0

  // Gaps de funil
  const gapCTR  = ctrV < 0.02 ? `CTR abaixo de 2% (${pct(ctrV)}) — anúncios podem não ser relevantes` : null
  const gapCVR  = cvr < 0.05 ? `Taxa de conversão abaixo de 5% (${pct(cvr)}) — LP pode estar com atrito` : null
  const gapImp  = impShare < 0.5 ? `Parcela de impressão baixa (${pct(impShare)}) — perdendo visibilidade` : null
  const gapRank = lostRank > 0.2 ? `${pct(lostRank)} das impressões perdidas por qualidade/lance` : null
  const gapBudg = lostBudg > 0.1 ? `${pct(lostBudg)} das impressões perdidas por orçamento` : null

  const presetBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${active ? '#D32F2F' : '#e5e7eb'}`,
    background: active ? '#D32F2F' : '#fff', color: active ? '#fff' : '#374151',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  })
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
    borderBottom: `2px solid ${active ? '#D32F2F' : 'transparent'}`,
    color: active ? '#D32F2F' : '#6b7280', background: 'none', border: 'none',
    borderBottom: `2px solid ${active ? '#D32F2F' : 'transparent'}`,
  })
  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#f9fafb', fontFamily: "'DM Sans', sans-serif" },
    header: { background: '#111', color: '#fff', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    logo: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em' },
    logoMark: { background: '#D32F2F', borderRadius: 6, width: 30, height: 30, display: 'grid', placeItems: 'center' as any, fontSize: 13, fontWeight: 800 },
    inner: { maxWidth: 1200, margin: '0 auto', padding: '28px 24px' },
    controls: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as any, marginBottom: 24 },
    input: { padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, background: '#fff' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
    card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 20 },
    tabBar: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 },
    th: { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as any, letterSpacing: '0.06em', textAlign: 'left' as any, borderBottom: '1px solid #f3f4f6' },
    td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f9fafb', color: '#111' },
  }

  return (
    <>
      <Head><title>Performance | Midas Odontomed</title></Head>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.logo}>
            <div style={s.logoMark}>V4</div>
            Performance — Midas Odontomed
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Google Ads</span>
        </div>

        <div style={s.inner}>
          {/* Controls */}
          <div style={s.controls}>
            {PRESETS.map(p => (
              <button key={p.days} style={presetBtn(preset === p.days)} onClick={() => applyPreset(p.days)}>{p.label}</button>
            ))}
            <input type="date" style={s.input} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(0) }} />
            <span style={{ color: '#9ca3af', fontSize: 13 }}>até</span>
            <input type="date" style={s.input} value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(0) }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              Comparar período anterior
            </label>
            <button onClick={load} style={{ ...s.presetBtn(false), background: '#111', color: '#fff', borderColor: '#111' }}>
              {loading ? 'Carregando...' : '↻ Atualizar'}
            </button>
          </div>

          {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#991b1b', marginBottom: 20, fontSize: 13 }}>⚠ {error}</div>}

          {/* KPI Grid */}
          <div style={s.grid}>
            <KpiCard label="Impressões" value={fmt(imp)} delta={delta(imp, cImp)} sub={compare && cmp.length ? `Ant: ${fmt(cImp)}` : undefined} />
            <KpiCard label="Cliques" value={fmt(clk)} delta={delta(clk, cClk)} sub={compare && cmp.length ? `Ant: ${fmt(cClk)}` : undefined} />
            <KpiCard label="CTR" value={pct(ctrV)} delta={delta(ctrV, cCtr)} sub={compare && cmp.length ? `Ant: ${pct(cCtr)}` : undefined} alert={gapCTR || undefined} />
            <KpiCard label="Conversões" value={fmt(conv, 0)} delta={delta(conv, cConv)} sub={compare && cmp.length ? `Ant: ${fmt(cConv, 0)}` : undefined} />
            <KpiCard label="Taxa Conv." value={pct(cvr)} delta={delta(cvr, cCvr)} sub={compare && cmp.length ? `Ant: ${pct(cCvr)}` : undefined} alert={gapCVR || undefined} />
            <KpiCard label="Custo" value={brl(cost)} delta={delta(cost, cCost)} invert sub={compare && cmp.length ? `Ant: ${brl(cCost)}` : undefined} />
            <KpiCard label="CPC" value={brl(cpc)} invert />
            <KpiCard label="CPA" value={conv ? brl(cpa) : '—'} delta={cConv ? delta(cpa, cCpa) : null} invert />
          </div>

          {/* Tabs */}
          <div style={s.card}>
            <div style={s.tabBar}>
              {(['funil', 'impressao', 'debug'] as const).map(t => (
                <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
                  {t === 'funil' ? '🎯 Funil & Gaps' : t === 'impressao' ? '📊 Parcela de Impressão' : '🔍 Debug Diário'}
                </button>
              ))}
            </div>

            {/* FUNIL */}
            {tab === 'funil' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: '#111' }}>Funil de Performance</h3>
                  <FunnelBar label="Impressões" value={fmt(imp)} pctOfTop={100} color="#D32F2F" />
                  <FunnelBar label="Cliques" value={fmt(clk)} pctOfTop={imp ? (clk / imp) * 100 : 0} color="#ef4444" />
                  <FunnelBar label="Conversões" value={fmt(conv, 0)} pctOfTop={imp ? (conv / imp) * 100 : 0} color="#b91c1c" />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: '#111' }}>Gaps Identificados</h3>
                  {[gapCTR, gapCVR, gapImp, gapRank, gapBudg].filter(Boolean).length === 0 ? (
                    <p style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>✓ Nenhum gap crítico identificado no período.</p>
                  ) : (
                    [gapCTR, gapCVR, gapImp, gapRank, gapBudg].filter(Boolean).map((g, i) => (
                      <div key={i} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#9a3412' }}>
                        ⚠ {g}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* IMPRESSÃO */}
            {tab === 'impressao' && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: '#111' }}>Parcela de Impressão — Google Search</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'Parcela de Impressão', value: pct(impShare), color: impShare > 0.5 ? '#16a34a' : '#dc2626' },
                    { label: 'Topo de Página', value: pct(topShare), color: topShare > 0.5 ? '#16a34a' : '#f59e0b' },
                    { label: 'Topo Absoluto', value: pct(absTop), color: '#6b7280' },
                    { label: 'Perdida por Rank', value: pct(lostRank), color: lostRank > 0.2 ? '#dc2626' : '#16a34a' },
                    { label: 'Perdida por Orçamento', value: pct(lostBudg), color: lostBudg > 0.1 ? '#dc2626' : '#16a34a' },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{item.label}</p>
                      <p style={{ fontSize: 28, fontWeight: 800, margin: 0, color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Barra visual de distribuição */}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Distribuição das impressões disponíveis</p>
                  <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
                    <div style={{ width: `${impShare * 100}%`, background: '#D32F2F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      {impShare > 0.1 ? `Ganhas ${pct(impShare)}` : ''}
                    </div>
                    <div style={{ width: `${lostRank * 100}%`, background: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      {lostRank > 0.08 ? `Rank ${pct(lostRank)}` : ''}
                    </div>
                    <div style={{ width: `${lostBudg * 100}%`, background: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7f1d1d', fontSize: 11, fontWeight: 700 }}>
                      {lostBudg > 0.08 ? `Budget ${pct(lostBudg)}` : ''}
                    </div>
                    <div style={{ flex: 1, background: '#f3f4f6' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                    <span>🔴 Ganhas</span><span>🟠 Perdidas por Rank</span><span>🟡 Perdidas por Orçamento</span><span>⬜ Não disputadas</span>
                  </div>
                </div>
              </div>
            )}

            {/* DEBUG */}
            {tab === 'debug' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Data','Impr.','Cliques','CTR','Conv.','Taxa Conv.','Custo','CPA','Imp. Share','Perdida Rank','Perdida Budget'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.length === 0 && (
                      <tr><td colSpan={11} style={{ ...s.td, textAlign: 'center', color: '#9ca3af', padding: 32 }}>Nenhum dado no período selecionado.</td></tr>
                    )}
                    {current.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{r.date}</td>
                        <td style={s.td}>{fmt(r.impressions)}</td>
                        <td style={s.td}>{fmt(r.clicks)}</td>
                        <td style={{ ...s.td, color: r.ctr < 0.02 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{pct(r.ctr)}</td>
                        <td style={s.td}>{fmt(r.conversions, 1)}</td>
                        <td style={{ ...s.td, color: r.conversion_rate < 0.05 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{pct(r.conversion_rate)}</td>
                        <td style={s.td}>{brl(r.cost)}</td>
                        <td style={s.td}>{r.conversions > 0 ? brl(r.cost / r.conversions) : '—'}</td>
                        <td style={{ ...s.td, color: r.search_impression_share < 0.5 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{pct(r.search_impression_share)}</td>
                        <td style={{ ...s.td, color: r.search_lost_impression_share_rank > 0.2 ? '#dc2626' : '#374151' }}>{pct(r.search_lost_impression_share_rank)}</td>
                        <td style={{ ...s.td, color: r.search_lost_impression_share_budget > 0.1 ? '#dc2626' : '#374151' }}>{pct(r.search_lost_impression_share_budget)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {current.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                        <td style={s.td}>TOTAL / MÉD.</td>
                        <td style={s.td}>{fmt(imp)}</td>
                        <td style={s.td}>{fmt(clk)}</td>
                        <td style={s.td}>{pct(ctrV)}</td>
                        <td style={s.td}>{fmt(conv, 1)}</td>
                        <td style={s.td}>{pct(cvr)}</td>
                        <td style={s.td}>{brl(cost)}</td>
                        <td style={s.td}>{conv > 0 ? brl(cpa) : '—'}</td>
                        <td style={s.td}>{pct(impShare)}</td>
                        <td style={s.td}>{pct(lostRank)}</td>
                        <td style={s.td}>{pct(lostBudg)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
