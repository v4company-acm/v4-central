import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

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

// Benchmarks WordStream 2026 — Dentistas e Serviços Odontológicos
const BENCH = {
  ctr:         0.0566,  // 5.66%
  cvr:         0.1077,  // 10.77% (AgencyAnalytics median dental)
  imp_share:   0.60,    // 60%+ considerado saudável
  lost_rank:   0.20,    // abaixo de 20% ok
  lost_budget: 0.10,    // abaixo de 10% ok
  cpc_usd:     6.82,    // USD — referência global
}

function sum(rows: DayData[], key: keyof DayData) {
  return rows.reduce((a, r) => a + (Number(r[key]) || 0), 0)
}
function avg(rows: DayData[], key: keyof DayData) {
  return rows.length ? sum(rows, key) / rows.length : 0
}
function fmt(n: number, dec = 0) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function pct(n: number, dec = 1) { return `${(n * 100).toFixed(dec)}%` }
function brl(n: number) { return `R$ ${fmt(n, 2)}` }
function delta(cur: number, cmp: number) {
  if (!cmp) return null
  return ((cur - cmp) / cmp) * 100
}
function toISO(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function status(val: number, bench: number, invert = false): 'green' | 'yellow' | 'red' {
  const ratio = val / bench
  if (invert) {
    if (ratio <= 0.7) return 'green'
    if (ratio <= 1.0) return 'yellow'
    return 'red'
  }
  if (ratio >= 0.9) return 'green'
  if (ratio >= 0.6) return 'yellow'
  return 'red'
}

const colors = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' }
const bgs    = { green: '#f0fdf4', yellow: '#fffbeb', red: '#fef2f2' }
const borders = { green: '#bbf7d0', yellow: '#fde68a', red: '#fecaca' }

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
]

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
  const [tab, setTab] = useState<'hipotese' | 'funil' | 'impressao' | 'debug'>('hipotese')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const days = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000)
      const cmpTo   = toISO(addDays(new Date(dateFrom), -1))
      const cmpFrom = toISO(addDays(new Date(dateFrom), -days - 1))
      const url = `/api/performance?date_from=${dateFrom}&date_to=${dateTo}${compare ? `&compare_from=${cmpFrom}&compare_to=${cmpTo}` : ''}`
      const res  = await fetch(url)
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

  // ── Agregados ──
  const imp  = sum(current, 'impressions')
  const clk  = sum(current, 'clicks')
  const conv = sum(current, 'conversions')
  const cost = sum(current, 'cost')
  const ctrV = imp  ? clk  / imp  : 0
  const cvr  = clk  ? conv / clk  : 0
  const cpc  = clk  ? cost / clk  : 0
  const cpa  = conv ? cost / conv : 0
  const impShare = avg(current, 'search_impression_share')
  const topShare = avg(current, 'search_top_impression_share')
  const absTop   = avg(current, 'search_absolute_top_impression_share')
  const lostRank = avg(current, 'search_lost_impression_share_rank')
  const lostBudg = avg(current, 'search_lost_impression_share_budget')

  // Comparativo
  const cImp  = sum(cmp, 'impressions')
  const cClk  = sum(cmp, 'clicks')
  const cConv = sum(cmp, 'conversions')
  const cCost = sum(cmp, 'cost')
  const cCtr  = cImp ? cClk  / cImp  : 0
  const cCvr  = cClk ? cConv / cClk  : 0
  const cCpa  = cConv ? cCost / cConv : 0
  const cImpShare = avg(cmp, 'search_impression_share')
  const cLostRank = avg(cmp, 'search_lost_impression_share_rank')

  // Status vs benchmark
  const sCtr      = status(ctrV,      BENCH.ctr)
  const sCvr      = status(cvr,       BENCH.cvr)
  const sImpShare = status(impShare,  BENCH.imp_share)
  const sLostRank = status(lostRank,  BENCH.lost_rank, true)
  const sLostBudg = status(lostBudg,  BENCH.lost_budget, true)

  // ── Hipóteses ──
  // Gabriel: anúncios desqualificados → CTR ruim, qualidade baixa (lost by rank alto)
  // GT: problema na LP → CVR baixo mesmo com CTR ok

  const gabScore = [
    ctrV < BENCH.ctr ? 2 : 0,
    lostRank > BENCH.lost_rank ? 2 : 0,
    impShare < BENCH.imp_share ? 1 : 0,
  ].reduce((a, b) => a + b, 0)  // max 5

  const gtScore = [
    cvr < BENCH.cvr ? 2 : 0,
    ctrV >= BENCH.ctr * 0.8 ? 1 : 0,  // CTR razoável mas conv cai = LP
    conv < cConv && ctrV >= cCtr ? 2 : 0,  // conv caiu mas CTR manteve
  ].reduce((a, b) => a + b, 0)  // max 5

  const totalScore = gabScore + gtScore || 1
  const gabPct = Math.round((gabScore / totalScore) * 100)
  const gtPct  = Math.round((gtScore  / totalScore) * 100)

  // ── Estilos base ──
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 8,
    border: `1.5px solid ${active ? '#D32F2F' : '#e5e7eb'}`,
    background: active ? '#D32F2F' : '#fff',
    color: active ? '#fff' : '#374151',
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
  })
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
    color: active ? '#D32F2F' : '#6b7280', background: 'none', border: 'none',
    borderBottom: `2px solid ${active ? '#D32F2F' : 'transparent'}`,
  })
  const th: React.CSSProperties = {
    padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left',
    borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '9px 12px', fontSize: 12, borderBottom: '1px solid #f9fafb', color: '#111',
  }

  // ── Componente métrica com benchmark ──
  function MetricRow({ label, val, bench, format, invert = false, note }: {
    label: string; val: number; bench: number;
    format: (n: number) => string; invert?: boolean; note?: string
  }) {
    const s = status(val, bench, invert)
    const icon = s === 'green' ? '✓' : s === 'yellow' ? '~' : '✗'
    const pctOfBench = ((val / bench) * 100).toFixed(0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: colors[s], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{label}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: colors[s] }}>{format(val)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(Number(pctOfBench), 100)}%`, height: '100%', background: colors[s], borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              {pctOfBench}% do benchmark ({format(bench)})
            </span>
          </div>
          {note && <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0' }}>{note}</p>}
        </div>
      </div>
    )
  }

  return (
    <>
      <Head><title>Performance Analytics | Midas Odontomed</title></Head>
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ background: '#111', color: '#fff', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 15 }}>
            <div style={{ background: '#D32F2F', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>V4</div>
            Performance Analytics — Midas Odontomed
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: 20, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em' }}>GOOGLE ADS</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Benchmark: WordStream 2026 · Dental Services</span>
          </div>
        </div>

        <div style={{ maxWidth: 1260, margin: '0 auto', padding: '24px 20px' }}>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {PRESETS.map(p => (
              <button key={p.days} style={btnStyle(preset === p.days)} onClick={() => applyPreset(p.days)}>{p.label}</button>
            ))}
            <input type="date" style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 12 }} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(0) }} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>até</span>
            <input type="date" style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 12 }} value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(0) }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              vs período anterior
            </label>
            <button onClick={load} style={{ ...btnStyle(false), background: '#111', color: '#fff', border: '1.5px solid #111' }}>
              {loading ? '⟳ Carregando...' : '⟳ Atualizar'}
            </button>
          </div>

          {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', color: '#991b1b', marginBottom: 16, fontSize: 12 }}>⚠ {error}</div>}

          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Impressões', val: fmt(imp), d: delta(imp, cImp), s: null },
              { label: 'Cliques', val: fmt(clk), d: delta(clk, cClk), s: null },
              { label: 'CTR', val: pct(ctrV), d: delta(ctrV, cCtr), s: sCtr },
              { label: 'Conversões', val: fmt(conv), d: delta(conv, cConv), s: null },
              { label: 'Taxa Conv.', val: pct(cvr), d: delta(cvr, cCvr), s: sCvr },
              { label: 'Imp. Share', val: pct(impShare), d: delta(impShare, cImpShare), s: sImpShare },
              { label: 'Custo', val: brl(cost), d: delta(cost, cCost), s: null, inv: true },
              { label: 'CPA', val: conv ? brl(cpa) : '—', d: cCpa ? delta(cpa, cCpa) : null, s: null, inv: true },
            ].map(item => (
              <div key={item.label} style={{
                background: item.s ? bgs[item.s] : '#fff',
                border: `1px solid ${item.s ? borders[item.s] : '#e5e7eb'}`,
                borderRadius: 10, padding: '12px 16px',
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{item.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: item.s ? colors[item.s] : '#111' }}>
                  {item.val}
                  {item.d !== null && item.d !== undefined && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: (item.inv ? item.d < 0 : item.d > 0) ? '#16a34a' : '#dc2626', marginLeft: 5 }}>
                      {item.d > 0 ? '▲' : '▼'} {Math.abs(item.d).toFixed(1)}%
                    </span>
                  )}
                </p>
                {item.s && (
                  <p style={{ fontSize: 10, color: colors[item.s], margin: '3px 0 0', fontWeight: 600 }}>
                    {item.s === 'green' ? '✓ ok' : item.s === 'yellow' ? '~ atenção' : '✗ gap'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
              <button style={tabStyle(tab === 'hipotese')} onClick={() => setTab('hipotese')}>🔬 Análise de Hipóteses</button>
              <button style={tabStyle(tab === 'funil')} onClick={() => setTab('funil')}>🎯 Funil vs Benchmark</button>
              <button style={tabStyle(tab === 'impressao')} onClick={() => setTab('impressao')}>📊 Parcela de Impressão</button>
              <button style={tabStyle(tab === 'debug')} onClick={() => setTab('debug')}>🔍 Debug Diário</button>
            </div>

            {/* ═══ HIPÓTESES ═══ */}
            {tab === 'hipotese' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

                  {/* Gabriel */}
                  <div style={{ border: `2px solid ${gabScore > gtScore ? '#D32F2F' : '#e5e7eb'}`, borderRadius: 12, padding: 20, background: gabScore > gtScore ? '#fff5f5' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#D32F2F', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Hipótese A — Gabriel</p>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111' }}>Anúncios Desqualificados</h3>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: gabScore > gtScore ? '#D32F2F' : '#9ca3af' }}>{gabPct}%</div>
                        <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>evidência</div>
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
                      Tráfego de baixa intenção chegando via palavras-chave genéricas, anúncios pouco relevantes ao público-alvo ou Quality Score comprometido — gerando cliques que nunca converteriam.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'CTR abaixo do benchmark', ok: ctrV < BENCH.ctr, val: `${pct(ctrV)} vs ${pct(BENCH.ctr)} esperado`, evidence: ctrV < BENCH.ctr },
                        { label: 'Alta perda por qualidade/rank', ok: lostRank > BENCH.lost_rank, val: `${pct(lostRank)} perdido por rank (limite: ${pct(BENCH.lost_rank)})`, evidence: lostRank > BENCH.lost_rank },
                        { label: 'Impression share baixa', ok: impShare < BENCH.imp_share, val: `${pct(impShare)} vs ${pct(BENCH.imp_share)} ideal`, evidence: impShare < BENCH.imp_share },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: item.evidence ? '#fff5f5' : '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                          <span style={{ color: item.evidence ? '#dc2626' : '#16a34a', fontWeight: 800, fontSize: 13 }}>{item.evidence ? '✗' : '✓'}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111' }}>{item.label}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{item.val}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 14, padding: '10px 12px', background: '#111', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#fff', fontWeight: 600 }}>💡 Para validar:</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                        Analise o relatório de termos de pesquisa no Google Ads — se houver termos não relacionados a odontologia com alto volume de impressões, essa hipótese é confirmada.
                      </p>
                    </div>
                  </div>

                  {/* GT */}
                  <div style={{ border: `2px solid ${gtScore > gabScore ? '#2563eb' : '#e5e7eb'}`, borderRadius: 12, padding: 20, background: gtScore > gabScore ? '#eff6ff' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Hipótese B — GT</p>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111' }}>Problema na Landing Page</h3>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: gtScore > gabScore ? '#2563eb' : '#9ca3af' }}>{gtPct}%</div>
                        <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>evidência</div>
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
                      Usuários chegam com intenção de compra mas encontram atrito na LP — formulário confuso, CTA fraco, velocidade lenta, ou mensagem desalinhada com o anúncio que clicaram.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Taxa de conversão abaixo do esperado', val: `${pct(cvr)} vs ${pct(BENCH.cvr)} benchmark dental`, evidence: cvr < BENCH.cvr },
                        { label: 'CTR razoável mas conv. caiu', val: ctrV >= BENCH.ctr * 0.8 ? `CTR (${pct(ctrV)}) está dentro do aceitável` : `CTR (${pct(ctrV)}) também comprometido`, evidence: ctrV >= BENCH.ctr * 0.8 && cvr < BENCH.cvr },
                        { label: 'Conv. caiu mais que o CTR', val: compare && cmp.length ? `Conv: ${delta(conv, cConv)?.toFixed(1)}% vs CTR: ${delta(ctrV, cCtr)?.toFixed(1)}%` : 'Ative comparativo para ver', evidence: compare && cmp.length ? (conv < cConv && ctrV >= cCtr) : false },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: item.evidence ? '#eff6ff' : '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                          <span style={{ color: item.evidence ? '#2563eb' : '#9ca3af', fontWeight: 800, fontSize: 13 }}>{item.evidence ? '✗' : '✓'}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111' }}>{item.label}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{item.val}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 14, padding: '10px 12px', background: '#1e3a8a', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#fff', fontWeight: 600 }}>💡 Para validar:</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                        Analise o comportamento na LP via Google Analytics/Hotjar — taxa de rejeição, tempo na página e mapa de calor do CTA. Se bounce rate {'>'} 70%, LP é o problema.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Veredito */}
                <div style={{ background: '#111', borderRadius: 12, padding: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>📋 Diagnóstico com base nos dados disponíveis</p>
                  <p style={{ fontSize: 14, color: '#fff', lineHeight: 1.7, margin: 0 }}>
                    {gabScore === 0 && gtScore === 0 && 'Dados insuficientes para diagnóstico. Selecione um período com dados.'}
                    {gabScore > gtScore && `Os dados indicam maior probabilidade da Hipótese A (${gabPct}% de evidência). CTR ${pct(ctrV)} está ${ctrV < BENCH.ctr ? 'abaixo' : 'dentro'} do benchmark de ${pct(BENCH.ctr)} para o setor odontológico, e a perda por rank de ${pct(lostRank)} sugere problemas de relevância/Quality Score. Recomendação prioritária: auditoria de termos de pesquisa e revisão de relevância dos anúncios.`}
                    {gtScore > gabScore && `Os dados indicam maior probabilidade da Hipótese B (${gtPct}% de evidência). A taxa de conversão de ${pct(cvr)} está significativamente abaixo do benchmark de ${pct(BENCH.cvr)} para o setor dental, enquanto o CTR de ${pct(ctrV)} ${ctrV >= BENCH.ctr * 0.8 ? 'mantém-se em nível aceitável' : 'também está comprometido'}. Recomendação prioritária: teste A/B na landing page com foco em CTA e velocidade.`}
                    {gabScore === gtScore && gabScore > 0 && `Evidências equilibradas (${gabPct}% vs ${gtPct}%). Ambas as hipóteses têm suporte nos dados. Recomendação: atuar em paralelo — revisar termos de pesquisa e qualidade dos anúncios, e simultaneamente testar melhorias na LP.`}
                  </p>
                </div>
              </div>
            )}

            {/* ═══ FUNIL VS BENCHMARK ═══ */}
            {tab === 'funil' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Métricas vs Benchmark Dental 2026</h3>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 16px' }}>Fonte: WordStream & AgencyAnalytics · Dental Services</p>
                    <MetricRow label="CTR (Taxa de Clique)" val={ctrV} bench={BENCH.ctr} format={pct} note="Benchmark dental 2026: 5.66% (WordStream)" />
                    <MetricRow label="Taxa de Conversão" val={cvr} bench={BENCH.cvr} format={pct} note="Median dental (agências): 10.77% (AgencyAnalytics)" />
                    <MetricRow label="Impression Share" val={impShare} bench={BENCH.imp_share} format={pct} note="Mínimo saudável: 60%" />
                    <MetricRow label="Perdida por Rank" val={lostRank} bench={BENCH.lost_rank} format={pct} invert note="Aceitável: abaixo de 20%" />
                    <MetricRow label="Perdida por Budget" val={lostBudg} bench={BENCH.lost_budget} format={pct} invert note="Aceitável: abaixo de 10%" />
                  </div>

                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Funil Real vs Potencial</h3>

                    {[
                      { label: 'Impressões reais', val: imp, note: `Com IS ${pct(impShare)} — potencial: ${fmt(imp / (impShare || 1))}`, color: '#D32F2F', pct: 100 },
                      { label: 'Cliques', val: clk, note: `CTR ${pct(ctrV)} (bench: ${pct(BENCH.ctr)})`, color: '#ef4444', pct: imp ? (clk / imp) * 100 : 0 },
                      { label: 'Conversões reais', val: conv, note: `CVR ${pct(cvr)} (bench: ${pct(BENCH.cvr)})`, color: '#b91c1c', pct: imp ? (conv / imp) * 100 : 0 },
                      { label: 'Conversões potenciais', val: Math.round(clk * BENCH.cvr), note: `Se CVR atingisse benchmark dental`, color: '#16a34a', pct: imp ? (clk * BENCH.cvr / imp) * 100 : 0 },
                    ].map((item, i) => (
                      <div key={i} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600 }}>{item.label}</span>
                          <span style={{ fontWeight: 800 }}>{fmt(item.val)}</span>
                        </div>
                        <div style={{ background: '#f3f4f6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(item.pct, 100)}%`, height: '100%', background: item.color, borderRadius: 6 }} />
                        </div>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>{item.note}</p>
                      </div>
                    ))}

                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginTop: 16 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#15803d' }}>
                        🎯 Potencial de conversões adicionais: +{fmt(Math.round(clk * BENCH.cvr) - conv)}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#16a34a' }}>
                        Se a taxa de conversão atingisse o benchmark dental de {pct(BENCH.cvr)}, com o mesmo volume de cliques.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ IMPRESSION SHARE ═══ */}
            {tab === 'impressao' && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Parcela de Impressão — Google Search</h3>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 20px' }}>Mede qual % das impressões disponíveis você está de fato capturando e onde está perdendo.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Parcela Ganha', val: impShare, bench: BENCH.imp_share, inv: false },
                    { label: 'Topo de Página', val: topShare, bench: 0.5, inv: false },
                    { label: 'Topo Absoluto', val: absTop, bench: 0.3, inv: false },
                    { label: 'Perdida por Rank', val: lostRank, bench: BENCH.lost_rank, inv: true },
                    { label: 'Perdida por Budget', val: lostBudg, bench: BENCH.lost_budget, inv: true },
                  ].map(item => {
                    const s = status(item.val, item.bench, item.inv)
                    return (
                      <div key={item.label} style={{ background: bgs[s], border: `1px solid ${borders[s]}`, borderRadius: 10, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{item.label}</p>
                        <p style={{ fontSize: 26, fontWeight: 900, margin: 0, color: colors[s] }}>{pct(item.val)}</p>
                        <p style={{ fontSize: 10, color: colors[s], margin: '4px 0 0', fontWeight: 600 }}>
                          {s === 'green' ? '✓ ok' : s === 'yellow' ? '~ atenção' : '✗ gap'} · bench: {pct(item.bench)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Barra de distribuição */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Distribuição de todas as impressões disponíveis no leilão</p>
                  <div style={{ display: 'flex', height: 36, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
                    <div style={{ width: `${impShare * 100}%`, background: '#D32F2F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                      {impShare > 0.08 ? `✓ ${pct(impShare)}` : ''}
                    </div>
                    <div style={{ width: `${lostRank * 100}%`, background: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                      {lostRank > 0.06 ? `Rank ${pct(lostRank)}` : ''}
                    </div>
                    <div style={{ width: `${lostBudg * 100}%`, background: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7f1d1d', fontSize: 10, fontWeight: 700 }}>
                      {lostBudg > 0.06 ? `Budget ${pct(lostBudg)}` : ''}
                    </div>
                    <div style={{ flex: 1, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 10 }}>
                      {(1 - impShare - lostRank - lostBudg) > 0.05 ? `Não disputadas ${pct(1 - impShare - lostRank - lostBudg)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: '#6b7280', flexWrap: 'wrap' }}>
                    <span>🔴 Impressões ganhas</span>
                    <span>🟠 Perdidas por Rank/QS</span>
                    <span>🟡 Perdidas por Orçamento</span>
                    <span>⬜ Não disputadas</span>
                  </div>
                </div>

                {/* Diagnóstico IS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>Se o gap é por Rank/QS ({pct(lostRank)}):</p>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#78350f', lineHeight: 1.8 }}>
                      <li>Revisar relevância dos anúncios vs palavras-chave</li>
                      <li>Melhorar Ad Strength para "Excelente"</li>
                      <li>Aumentar lance ou usar estratégia Smart Bidding</li>
                      <li>Adicionar extensões de anúncio (callout, sitelink)</li>
                    </ul>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#991b1b' }}>Se o gap é por Budget ({pct(lostBudg)}):</p>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#7f1d1d', lineHeight: 1.8 }}>
                      <li>Aumentar orçamento diário da campanha</li>
                      <li>Identificar horários de pico e concentrar budget</li>
                      <li>Pausar termos de baixa intenção para liberar verba</li>
                      <li>Segmentar geografia para reduzir competição</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ DEBUG DIÁRIO ═══ */}
            {tab === 'debug' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Data','Impr.','Cliques','CTR','Conv.','Taxa Conv.','Custo','CPA','IS','Rank','Budget'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.length === 0 && (
                      <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: '#9ca3af', padding: 32 }}>Nenhum dado no período selecionado.</td></tr>
                    )}
                    {current.map((r, i) => {
                      const rCtr = status(r.ctr, BENCH.ctr)
                      const rCvr = status(r.conversion_rate, BENCH.cvr)
                      const rIs  = status(r.search_impression_share, BENCH.imp_share)
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ ...td, fontWeight: 700 }}>{r.date}</td>
                          <td style={td}>{fmt(r.impressions)}</td>
                          <td style={td}>{fmt(r.clicks)}</td>
                          <td style={{ ...td, color: colors[rCtr], fontWeight: 700 }}>{pct(r.ctr)}</td>
                          <td style={td}>{fmt(r.conversions, 1)}</td>
                          <td style={{ ...td, color: colors[rCvr], fontWeight: 700 }}>{pct(r.conversion_rate)}</td>
                          <td style={td}>{brl(r.cost)}</td>
                          <td style={td}>{r.conversions > 0 ? brl(r.cost / r.conversions) : '—'}</td>
                          <td style={{ ...td, color: colors[rIs], fontWeight: 700 }}>{pct(r.search_impression_share)}</td>
                          <td style={{ ...td, color: r.search_lost_impression_share_rank > BENCH.lost_rank ? '#dc2626' : '#374151' }}>{pct(r.search_lost_impression_share_rank)}</td>
                          <td style={{ ...td, color: r.search_lost_impression_share_budget > BENCH.lost_budget ? '#dc2626' : '#374151' }}>{pct(r.search_lost_impression_share_budget)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {current.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f3f4f6', fontWeight: 800 }}>
                        <td style={td}>TOTAL/MÉD.</td>
                        <td style={td}>{fmt(imp)}</td>
                        <td style={td}>{fmt(clk)}</td>
                        <td style={{ ...td, color: colors[sCtr] }}>{pct(ctrV)}</td>
                        <td style={td}>{fmt(conv, 1)}</td>
                        <td style={{ ...td, color: colors[sCvr] }}>{pct(cvr)}</td>
                        <td style={td}>{brl(cost)}</td>
                        <td style={td}>{conv > 0 ? brl(cpa) : '—'}</td>
                        <td style={{ ...td, color: colors[sImpShare] }}>{pct(impShare)}</td>
                        <td style={{ ...td, color: colors[sLostRank] }}>{pct(lostRank)}</td>
                        <td style={{ ...td, color: colors[sLostBudg] }}>{pct(lostBudg)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>

                <div style={{ marginTop: 16, padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 10, color: '#9ca3af' }}>
                  ✓ verde = dentro do benchmark dental 2026 &nbsp;|&nbsp; ~ amarelo = atenção &nbsp;|&nbsp; ✗ vermelho = abaixo do benchmark
                  &nbsp;·&nbsp; Fonte: WordStream 2026 · AgencyAnalytics 2025
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
