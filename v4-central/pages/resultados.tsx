import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'
import TrendChart from '../components/TrendChart'

interface ClienteOpt { id: string; nome: string; tipo: string; ativo: boolean; nivel: 'full' | 'ads'; temGoogle: boolean; temMeta: boolean }

const C = {
  card: 'var(--card-color)', border: 'var(--border-color)', border2: 'var(--border-light)',
  text: 'var(--text-main)', text2: 'var(--text-secondary)', text3: 'var(--text-muted)',
  red: '#FB2E0A', redLight: 'rgba(251,46,10,0.1)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.1)',
  amber: '#D97706', amberBg: 'rgba(217,119,6,0.1)',
  blue: '#2563EB', blueBg: 'rgba(37,99,235,0.1)',
}

function fmtR(v: number | null | undefined) { if (v === null || v === undefined || isNaN(v)) return '—'; return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtN(v: number | null | undefined) { if (v === null || v === undefined || isNaN(v)) return '—'; return Number(v).toLocaleString('pt-BR') }
function fmtPct(v: number | null | undefined, dec = 1) { if (v === null || v === undefined || isNaN(v)) return '—'; return Number(v).toFixed(dec) + '%' }
function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function Delta({ v, invert = false }: { v: number | null | undefined; invert?: boolean }) {
  if (v === null || v === undefined || isNaN(v)) return null
  const up = v > 0
  const good = invert ? !up : up
  return <span style={{ fontSize: 11, fontWeight: 700, color: good ? C.green : C.red, marginLeft: 6 }}>{up ? '▲' : '▼'} {Math.abs(v).toFixed(1)}%</span>
}

function KpiCard({ label, value, sub, color, grad }: { label: string; value: string; sub?: React.ReactNode; color?: string; grad?: string }) {
  return (
    <div style={{ background: grad || C.card, borderRadius: 12, padding: 16, border: grad ? 'none' : `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: grad ? 'rgba(255,255,255,0.7)' : C.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: grad ? '#fff' : (color || C.text) }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: grad ? 'rgba(255,255,255,0.65)' : C.text3, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: 1 | -1; onClick: () => void }) {
  return (
    <th onClick={onClick} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
      {label}{active ? (dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  )
}

function useSort<T = any>(rows: T[], defaultKey: keyof T, defaultDir: 1 | -1 = -1) {
  const [key, setKey] = useState<keyof T>(defaultKey)
  const [dir, setDir] = useState<1 | -1>(defaultDir)
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[key] as any, bv = b[key] as any
    if (typeof av === 'string') return dir * String(av).localeCompare(String(bv))
    return dir * ((av || 0) - (bv || 0))
  }), [rows, key, dir])
  const toggle = (k: keyof T) => { if (k === key) setDir(d => (d === 1 ? -1 : 1)); else { setKey(k); setDir(-1) } }
  return { sorted, key, dir, toggle }
}

const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }
const secTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

// Barra de funil genérica — cada etapa mostra volume absoluto + taxa de conversão em
// relação à etapa anterior, pra deixar claro onde o funil está perdendo gente.
function FunnelBar({ stages }: { stages: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...stages.map(s => s.value), 1)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null
        const rate = prev ? (s.value / prev) * 100 : null
        return (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text2, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <span><strong style={{ color: C.text }}>{fmtN(s.value)}</strong>{rate != null && <span style={{ color: C.text3, marginLeft: 6 }}>({fmtPct(rate)} da etapa anterior)</span>}</span>
            </div>
            <div style={{ height: 10, background: 'var(--hover-bg)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, height: '100%', background: s.color, transition: 'width .3s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ResultadosPage() {
  const today = new Date()
  const [clientes, setClientes] = useState<ClienteOpt[]>([])
  const [clienteId, setClienteId] = useState('')
  const [preset, setPreset] = useState(30)
  const [dateFrom, setDateFrom] = useState(toISO(addDays(today, -30)))
  const [dateTo, setDateTo] = useState(toISO(today))
  const [compare, setCompare] = useState(true)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [metric, setMetric] = useState<'invest' | 'conv' | 'leads'>('invest')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  function toggleCampaign(name: string) {
    setExpandedCampaigns(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })
  }

  useEffect(() => {
    fetch('/api/resultados-clientes').then(r => r.json()).then(d => {
      setClientes(d.clientes || [])
      if (d.clientes?.length) setClienteId(d.clientes[0].id)
    })
  }, [])

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    const days = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000)
    const params = new URLSearchParams({ cliente_id: clienteId, date_from: dateFrom, date_to: dateTo })
    if (compare) {
      params.set('compare_from', toISO(addDays(new Date(dateFrom), -days - 1)))
      params.set('compare_to', toISO(addDays(new Date(dateFrom), -1)))
    }
    try {
      const res = await fetch(`/api/resultados?${params}`)
      setData(await res.json())
    } catch { setData(null) }
    setLoading(false)
  }, [clienteId, dateFrom, dateTo, compare])

  useEffect(() => { load() }, [load])

  function applyPreset(days: number) {
    setPreset(days); setDateFrom(toISO(addDays(today, -days))); setDateTo(toISO(today))
  }

  const clienteAtual = clientes.find(c => c.id === clienteId)
  const mode = data?.mode

  // ── payload normalizado (funciona pros dois modos: 'full' via webhook Kommo+Windsor, ou 'ads' via Windsor direto) ──
  const norm = useMemo(() => {
    if (!data) return null
    if (mode === 'full') {
      const p = data.payload
      const gDaily = (p?.google_ads?.daily || []).map((t: any[]) => ({ date: t[0], cost: t[1], clicks: t[2], impressions: t[3], conversions: t[4] }))
      const crmDaily = (p?.crm?.daily || []).map((t: any[]) => ({ date: t[0], leads: t[1], won: t[2], revenue: t[3] }))
      return {
        google: p?.google_ads?.status !== undefined ? { status: p.google_ads.status, totals: { spend: p.google_ads.totals.cost, clicks: p.google_ads.totals.clicks, impressions: p.google_ads.totals.impressions, conversions: p.google_ads.totals.conversions, conversion_value: 0 }, daily: gDaily, campaigns: (p.google_ads.campaigns || []).map((c: any) => ({ campaign_name: c.name, spend: c.cost, clicks: c.clicks, impressions: c.impressions, conversions: c.conversions })), auction: p.google_ads.auction_insights } : null,
        meta: p?.meta_ads?.status !== undefined ? { status: p.meta_ads.status, totals: { spend: p.meta_ads.totals.cost, clicks: p.meta_ads.totals.clicks, impressions: p.meta_ads.totals.impressions, conversions: p.meta_ads.totals.conversions, conversion_value: 0 }, daily: [], campaigns: [] } : null,
        blended: p?.blended || null,
        crm: p?.crm || null,
        crmDaily,
        keywords: p?.google_ads?.top_keywords || [],
        searchTerms: p?.google_ads?.top_search_terms || [],
        periodLabel: p?.period_label,
        source: p?.source,
        deltaCostPct: p?.google_ads?.totals?.delta?.cost ?? null,
      }
    }
    if (mode === 'ads') {
      const deltaCostPct = data.compare?.cost ? (((data.blended?.cost || 0) - data.compare.cost) / data.compare.cost) * 100 : null
      return {
        google: data.google, meta: data.meta, blended: data.blended, crm: null,
        crmDaily: [], keywords: [], searchTerms: [], periodLabel: null, source: 'live',
        deltaCostPct,
      }
    }
    return null
  }, [data, mode])

  const trendSeries = useMemo(() => {
    if (!norm) return []
    if (metric === 'leads' && norm.crmDaily.length) return norm.crmDaily.map((d: any) => ({ date: d.date, value: d.leads }))
    if (metric === 'conv') {
      const gd = norm.google?.daily || []
      if (gd.length) return gd.map((d: any) => ({ date: d.date, value: d.conversions }))
    }
    const gd = norm.google?.daily || []
    return gd.map((d: any) => ({ date: d.date, value: d.cost ?? d.spend }))
  }, [norm, metric])

  const googleFacet = useSort<any>(norm?.google?.campaigns || [], 'spend')
  const metaFacet = useSort<any>(norm?.meta?.campaigns || [], 'spend')
  const repsFacet = useSort<any>(norm?.crm?.reps || [], 'revenue')
  const citiesFacet = useSort<any>(norm?.crm?.cities || [], 'revenue')
  const keywordsFacet = useSort<any>(norm?.keywords || [], 'cost')

  return (
    <>
      <Head><title>Resultados — V4 Central de Clientes</title></Head>
      <Layout title="Resultados">
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>

          {/* TOOLBAR */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ height: 38, minWidth: 220, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.nivel === 'full' ? ' · CRM completo' : ''}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ l: '7d', v: 7 }, { l: '14d', v: 14 }, { l: '30d', v: 30 }, { l: '90d', v: 90 }].map(p => (
                <button key={p.v} onClick={() => applyPreset(p.v)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: preset === p.v ? 'none' : `1px solid ${C.border}`,
                  background: preset === p.v ? C.red : C.card, color: preset === p.v ? '#fff' : C.text2,
                }}>{p.l}</button>
              ))}
            </div>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(0) }} style={{ height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 12 }} />
            <span style={{ color: C.text3, fontSize: 12 }}>até</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(0) }} style={{ height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 12 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text2, cursor: 'pointer', marginLeft: 'auto' }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} style={{ accentColor: C.red }} /> Comparar com período anterior
            </label>
          </div>

          {loading && <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>Carregando resultados...</div>}

          {!loading && mode === 'none' && (
            <div style={{ padding: 60, textAlign: 'center', background: C.card, borderRadius: 12, border: `1px dashed ${C.border2}`, color: C.text2 }}>
              {data?.clienteNome} ainda não tem mídia paga (Google/Meta Ads) configurada no Windsor. Nada pra mostrar aqui ainda.
            </div>
          )}

          {!loading && norm && (
            <div style={{ display: 'grid', gap: 20 }}>

              {norm.periodLabel && (
                <div style={{ fontSize: 11, color: C.text3, display: 'flex', gap: 8, alignItems: 'center' }}>
                  📅 {norm.periodLabel} {norm.source === 'cache' && <span style={{ background: C.amberBg, color: C.amber, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>prévia em cache — pode não refletir o range exato selecionado</span>}
                </div>
              )}

              {/* HERO KPIs — só mostra o que a fonte de dados realmente calculou (nada de rótulo genérico com "—") */}
              {(() => {
                const totalConv = norm.blended?.conversions ?? ((norm.google?.totals.conversions || 0) + (norm.meta?.totals.conversions || 0))
                const taxaFechamento = norm.crm?.totals?.win_rate ?? norm.crm?.totals?.lead_to_win_rate ?? (data.crmBasico?.taxaFechamento)
                const tiles = [
                  { key: 'cost', label: 'Investimento', value: fmtR(norm.blended?.cost ?? ((norm.google?.totals.spend || 0) + (norm.meta?.totals.spend || 0))), grad: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', sub: norm.deltaCostPct != null ? <Delta v={norm.deltaCostPct} invert /> : undefined },
                  { key: 'conv', label: clienteAtual?.tipo === 'ecomm' ? 'Vendas' : 'Leads / Conversões', value: fmtN(totalConv), grad: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' },
                  norm.blended?.cpl != null && { key: 'cpl', label: 'CPL', value: fmtR(norm.blended.cpl), color: C.amber },
                  norm.blended?.cac != null && { key: 'cac', label: 'CAC', value: fmtR(norm.blended.cac), color: C.amber },
                  norm.blended?.roas != null && { key: 'roas', label: 'ROAS', value: norm.blended.roas.toFixed(2) + 'x', color: C.green },
                  taxaFechamento != null && { key: 'win', label: 'Taxa de Fechamento', value: fmtPct(taxaFechamento), color: C.green },
                  norm.crm?.totals?.revenue != null && { key: 'rev', label: 'Receita (CRM)', value: fmtR(norm.crm.totals.revenue), color: C.green, sub: `${fmtN(norm.crm.totals.won)} negócios ganhos` },
                ].filter(Boolean) as any[]
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
                    {tiles.map(t => <KpiCard key={t.key} label={t.label} value={t.value} color={t.color} grad={t.grad} sub={t.sub} />)}
                  </div>
                )
              })()}

              {/* TENDÊNCIA */}
              <div style={card}>
                <div style={secTitle}>
                  <span>Tendência</span>
                  <div style={{ display: 'flex', gap: 2, background: 'var(--hover-bg)', borderRadius: 8, padding: 3 }}>
                    {[{ k: 'invest', l: 'Investimento' }, { k: 'conv', l: 'Conversões' }, ...(norm.crmDaily.length ? [{ k: 'leads', l: 'Leads CRM' }] : [])].map(m => (
                      <button key={m.k} onClick={() => setMetric(m.k as any)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: metric === m.k ? C.card : 'transparent', color: metric === m.k ? C.text : C.text3, boxShadow: metric === m.k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{m.l}</button>
                    ))}
                  </div>
                </div>
                <TrendChart data={trendSeries} color={C.red} formatValue={v => metric === 'invest' ? fmtR(v) : fmtN(v)} formatDate={d => d} />
              </div>

              {/* CANAIS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[{ label: 'Google Ads', icon: '🔵', ch: norm.google }, { label: 'Meta Ads', icon: '🟣', ch: norm.meta }].map(({ label, icon, ch }) => (
                  <div key={label} style={card}>
                    <div style={secTitle}>
                      <span>{icon} {label}</span>
                      {ch && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: ch.status === 'ativo' ? C.greenBg : C.amberBg, color: ch.status === 'ativo' ? C.green : C.amber, textTransform: 'uppercase' }}>{ch.status === 'ativo' ? 'Ativo' : ch.status === 'sem_entrega' ? 'Sem entrega' : ch.status}</span>}
                    </div>
                    {!ch ? <div style={{ color: C.text3, fontSize: 12, textAlign: 'center', padding: 20 }}>Não configurado.</div> : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {[{ l: 'Investimento', v: fmtR(ch.totals.spend) }, { l: 'Cliques', v: fmtN(ch.totals.clicks) }, { l: 'Impressões', v: fmtN(ch.totals.impressions) }, { l: 'Conversões', v: fmtN(ch.totals.conversions) }, { l: 'CPC', v: ch.totals.clicks ? fmtR(ch.totals.spend / ch.totals.clicks) : '—' }, { l: 'CPA', v: ch.totals.conversions ? fmtR(ch.totals.spend / ch.totals.conversions) : '—' }].map(s => (
                          <div key={s.l} style={{ background: 'var(--hover-bg)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.text3, textTransform: 'uppercase' }}>{s.l}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {ch?.auction && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', marginBottom: 8 }}>Auction Insights</div>
                        {[{ l: 'Parcela de impressão', v: ch.auction.impression_share, color: C.blue }, { l: 'Perdido por orçamento', v: ch.auction.lost_budget, color: C.amber }, { l: 'Perdido por rank', v: ch.auction.lost_rank, color: C.red }].filter(b => b.v !== undefined).map(b => (
                          <div key={b.l} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.text2, marginBottom: 2 }}><span>{b.l}</span><span>{fmtPct(b.v)}</span></div>
                            <div style={{ height: 5, background: 'var(--hover-bg)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, b.v)}%`, height: '100%', background: b.color }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* COMPARATIVO DE CANAIS — mídia paga x resultado real de vendas no CRM, lado a lado */}
              {data.comparativoCanais?.length > 0 && (
                <div style={card}>
                  <div style={secTitle}>
                    <span>Comparativo de Canais</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'none' }}>Vendas/Faturamento vêm do CRM — podem diferir das conversões da plataforma</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr style={{ background: 'var(--hover-bg)' }}>
                        {['Canal', 'Investimento', 'Cliques', 'Impressões', 'Conv. Plataforma', 'Vendas (CRM)', 'Faturamento (CRM)', 'ROAS Real'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {data.comparativoCanais.map((c: any) => (
                          <tr key={c.canal} style={{ borderBottom: `1px solid ${C.border2}` }}>
                            <td style={{ padding: '9px 12px', fontWeight: 700, color: C.text }}>{c.canal}</td>
                            <td style={{ padding: '9px 12px' }}>{fmtR(c.spend)}</td>
                            <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(c.clicks)}</td>
                            <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(c.impressions)}</td>
                            <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(c.conversoesPlataforma)}</td>
                            <td style={{ padding: '9px 12px', color: c.vendasCrm != null ? C.green : C.text3, fontWeight: c.vendasCrm != null ? 700 : 400 }}>{c.vendasCrm != null ? fmtN(c.vendasCrm) : 'sem CRM associado'}</td>
                            <td style={{ padding: '9px 12px', color: c.faturamentoCrm != null ? C.green : C.text3 }}>{c.faturamentoCrm != null ? fmtR(c.faturamentoCrm) : '—'}</td>
                            <td style={{ padding: '9px 12px', fontWeight: 700 }}>{c.roasCrm != null ? c.roasCrm.toFixed(2) + 'x' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TABELA DE CAMPANHAS — com drill-down por grupo de anúncio quando disponível */}
              {(googleFacet.sorted.length > 0 || metaFacet.sorted.length > 0) && (
                <div style={card}>
                  <div style={secTitle}>Campanhas</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr style={{ background: 'var(--hover-bg)' }}>
                        <SortableTh label="Campanha" active={googleFacet.key === 'campaign_name'} dir={googleFacet.dir} onClick={() => googleFacet.toggle('campaign_name' as any)} />
                        <SortableTh label="Investimento" active={googleFacet.key === 'spend'} dir={googleFacet.dir} onClick={() => googleFacet.toggle('spend' as any)} />
                        <SortableTh label="Cliques" active={googleFacet.key === 'clicks'} dir={googleFacet.dir} onClick={() => googleFacet.toggle('clicks' as any)} />
                        <SortableTh label="Impressões" active={googleFacet.key === 'impressions'} dir={googleFacet.dir} onClick={() => googleFacet.toggle('impressions' as any)} />
                        <SortableTh label="Conversões" active={googleFacet.key === 'conversions'} dir={googleFacet.dir} onClick={() => googleFacet.toggle('conversions' as any)} />
                      </tr></thead>
                      <tbody>
                        {[...googleFacet.sorted, ...metaFacet.sorted].map((r: any, i: number) => {
                          const hasAdGroups = r.adGroups?.length > 0
                          const open = expandedCampaigns.has(r.campaign_name + i)
                          return (
                            <Fragment key={i}>
                              <tr onClick={() => hasAdGroups && toggleCampaign(r.campaign_name + i)} style={{ borderBottom: `1px solid ${C.border2}`, cursor: hasAdGroups ? 'pointer' : 'default' }}>
                                <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text }}>{hasAdGroups && (open ? '▾ ' : '▸ ')}{r.campaign_name}{hasAdGroups && <span style={{ fontSize: 10, color: C.text3, fontWeight: 400 }}> ({r.adGroups.length} grupos)</span>}</td>
                                <td style={{ padding: '9px 12px' }}>{fmtR(r.spend)}</td>
                                <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(r.clicks)}</td>
                                <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(r.impressions)}</td>
                                <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(r.conversions)}</td>
                              </tr>
                              {hasAdGroups && open && r.adGroups.map((ag: any, j: number) => (
                                <tr key={`${i}-${j}`} style={{ borderBottom: `1px solid ${C.border2}`, background: 'var(--hover-bg)' }}>
                                  <td style={{ padding: '7px 12px 7px 30px', color: C.text2, fontSize: 11 }}>↳ {ag.name}</td>
                                  <td style={{ padding: '7px 12px', fontSize: 11 }}>{fmtR(ag.spend)}</td>
                                  <td style={{ padding: '7px 12px', color: C.text3, fontSize: 11 }}>{fmtN(ag.clicks)}</td>
                                  <td style={{ padding: '7px 12px', color: C.text3, fontSize: 11 }}>{fmtN(ag.impressions)}</td>
                                  <td style={{ padding: '7px 12px', color: C.text3, fontSize: 11 }}>{fmtN(ag.conversions)}</td>
                                </tr>
                              ))}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {[...googleFacet.sorted, ...metaFacet.sorted].every((r: any) => !r.adGroups?.length) && (
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 10 }}>Detalhamento por grupo de anúncio não disponível pra esse canal/período.</div>
                  )}
                </div>
              )}

              {/* TERMOS DE PESQUISA / PALAVRAS-CHAVE (só modo full) */}
              {keywordsFacet.sorted.length > 0 && (
                <div style={card}>
                  <div style={secTitle}>Palavras-chave (top {keywordsFacet.sorted.length} por custo)</div>
                  <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr style={{ background: 'var(--hover-bg)', position: 'sticky', top: 0 }}>
                        <SortableTh label="Termo" active={keywordsFacet.key === 'text'} dir={keywordsFacet.dir} onClick={() => keywordsFacet.toggle('text' as any)} />
                        <SortableTh label="Grupo" active={keywordsFacet.key === 'ad_group'} dir={keywordsFacet.dir} onClick={() => keywordsFacet.toggle('ad_group' as any)} />
                        <SortableTh label="Custo" active={keywordsFacet.key === 'cost'} dir={keywordsFacet.dir} onClick={() => keywordsFacet.toggle('cost' as any)} />
                        <SortableTh label="Cliques" active={keywordsFacet.key === 'clicks'} dir={keywordsFacet.dir} onClick={() => keywordsFacet.toggle('clicks' as any)} />
                        <SortableTh label="Conv." active={keywordsFacet.key === 'conversions'} dir={keywordsFacet.dir} onClick={() => keywordsFacet.toggle('conversions' as any)} />
                      </tr></thead>
                      <tbody>
                        {keywordsFacet.sorted.slice(0, 60).map((k: any, i: number) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border2}` }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: C.text }}>{k.text}</td>
                            <td style={{ padding: '8px 12px', color: C.text3 }}>{k.ad_group}</td>
                            <td style={{ padding: '8px 12px' }}>{fmtR(k.cost)}</td>
                            <td style={{ padding: '8px 12px', color: C.text2 }}>{fmtN(k.clicks)}</td>
                            <td style={{ padding: '8px 12px', color: C.text2 }}>{fmtN(k.conversions)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CRM COMPLETO (Kommo — só clientes com nível 'full') */}
              {norm.crm && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    {[
                      { l: 'Leads', v: norm.crm.totals.leads }, { l: 'Oportunidades', v: norm.crm.totals.opportunities },
                      { l: 'Ganhos', v: norm.crm.totals.won, color: C.green }, { l: 'Perdidos', v: norm.crm.totals.lost, color: C.red },
                      { l: 'Pipeline em aberto', v: fmtR(norm.crm.totals.pipeline_value) }, { l: 'Ticket médio', v: fmtR(norm.crm.totals.avg_deal_size) },
                    ].map(s => (
                      <div key={s.l} style={{ ...card, padding: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' }}>{s.l}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: s.color || C.text }}>{typeof s.v === 'number' ? fmtN(s.v) : s.v}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={card}>
                      <div style={secTitle}>Funil de Vendas</div>
                      <FunnelBar stages={[
                        { label: 'Leads', value: norm.crm.totals.leads, color: C.blue },
                        { label: 'Oportunidades', value: norm.crm.totals.opportunities, color: C.amber },
                        { label: 'Ganhos', value: norm.crm.totals.won, color: C.green },
                      ]} />
                      <div style={{ fontSize: 11, color: C.text3, marginTop: 10 }}>
                        {fmtN(norm.crm.totals.lost)} oportunidades perdidas · win rate de {fmtPct(norm.crm.totals.win_rate)} sobre ganhos+perdidos
                      </div>
                    </div>
                    {(() => {
                      const stageMap: Record<string, number> = {}
                      ;(norm.crm.cities || []).forEach((c: any) => (c.open_by_stage || []).forEach((s: any) => { stageMap[s.stage] = (stageMap[s.stage] || 0) + s.count }))
                      const stages = Object.entries(stageMap).filter(([, v]) => v > 0)
                      return stages.length > 0 ? (
                        <div style={card}>
                          <div style={secTitle}>Pipeline em Aberto por Estágio</div>
                          <FunnelBar stages={stages.map(([label, value]) => ({ label, value, color: C.blue }))} />
                        </div>
                      ) : <div />
                    })()}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
                    <div style={card}>
                      <div style={secTitle}>Performance por Vendedor</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead><tr style={{ background: 'var(--hover-bg)' }}>
                            <SortableTh label="Vendedor" active={repsFacet.key === 'name'} dir={repsFacet.dir} onClick={() => repsFacet.toggle('name' as any)} />
                            <SortableTh label="Leads" active={repsFacet.key === 'leads'} dir={repsFacet.dir} onClick={() => repsFacet.toggle('leads' as any)} />
                            <SortableTh label="Ganhos" active={repsFacet.key === 'won'} dir={repsFacet.dir} onClick={() => repsFacet.toggle('won' as any)} />
                            <SortableTh label="Receita" active={repsFacet.key === 'revenue'} dir={repsFacet.dir} onClick={() => repsFacet.toggle('revenue' as any)} />
                            <SortableTh label="Win Rate" active={repsFacet.key === 'win_rate'} dir={repsFacet.dir} onClick={() => repsFacet.toggle('win_rate' as any)} />
                          </tr></thead>
                          <tbody>
                            {repsFacet.sorted.map((r: any, i: number) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${C.border2}` }}>
                                <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text }}>{r.name}</td>
                                <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(r.leads)}</td>
                                <td style={{ padding: '9px 12px', color: C.green, fontWeight: 700 }}>{fmtN(r.won)}</td>
                                <td style={{ padding: '9px 12px' }}>{fmtR(r.revenue)}</td>
                                <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtPct(r.win_rate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={card}>
                      <div style={secTitle}>Motivos de Perda</div>
                      {(norm.crm.all_lost_reasons || []).slice(0, 6).map((r: any, i: number) => {
                        const max = Math.max(...(norm.crm.all_lost_reasons || []).map((x: any) => x.count), 1)
                        return (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text2, marginBottom: 3 }}><span>{r.reason}</span><span style={{ fontWeight: 700 }}>{r.count}</span></div>
                            <div style={{ height: 6, background: 'var(--hover-bg)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: C.red }} /></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {citiesFacet.sorted.length > 0 && (
                    <div style={card}>
                      <div style={secTitle}>Performance por Cidade</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead><tr style={{ background: 'var(--hover-bg)' }}>
                            <SortableTh label="Cidade" active={citiesFacet.key === 'label'} dir={citiesFacet.dir} onClick={() => citiesFacet.toggle('label' as any)} />
                            <SortableTh label="Leads" active={citiesFacet.key === 'leads'} dir={citiesFacet.dir} onClick={() => citiesFacet.toggle('leads' as any)} />
                            <SortableTh label="Ganhos" active={citiesFacet.key === 'won'} dir={citiesFacet.dir} onClick={() => citiesFacet.toggle('won' as any)} />
                            <SortableTh label="Receita" active={citiesFacet.key === 'revenue'} dir={citiesFacet.dir} onClick={() => citiesFacet.toggle('revenue' as any)} />
                            <SortableTh label="Win Rate" active={citiesFacet.key === 'win_rate'} dir={citiesFacet.dir} onClick={() => citiesFacet.toggle('win_rate' as any)} />
                          </tr></thead>
                          <tbody>
                            {citiesFacet.sorted.map((c: any, i: number) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${C.border2}` }}>
                                <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text }}>{c.label}</td>
                                <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtN(c.leads)}</td>
                                <td style={{ padding: '9px 12px', color: C.green, fontWeight: 700 }}>{fmtN(c.won)}</td>
                                <td style={{ padding: '9px 12px' }}>{fmtR(c.revenue)}</td>
                                <td style={{ padding: '9px 12px', color: C.text2 }}>{fmtPct(c.win_rate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {norm.crm.v4_deals?.length > 0 && (
                    <div style={card}>
                      <div style={secTitle}>Negócios Atribuídos à V4 ({norm.crm.v4_deals.length})</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {norm.crm.v4_deals.map((d: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--hover-bg)', borderRadius: 8, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: C.text }}>{d.name} <span style={{ color: C.text3, fontWeight: 400 }}>· {d.city}</span></span>
                            <span style={{ color: C.text2 }}>{d.responsible} · {fmtR(d.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* CRM BÁSICO (leads/CRM próprio, quando não tem webhook dedicado) */}
              {!norm.crm && data.crmBasico && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
                  <div style={card}>
                    <div style={secTitle}>Funil de Vendas</div>
                    <FunnelBar stages={[
                      { label: 'Leads', value: data.crmBasico.totalLeads, color: C.blue },
                      { label: 'Orçados', value: data.crmBasico.orcados, color: C.amber },
                      { label: 'Vendidos', value: data.crmBasico.vendidos, color: C.green },
                    ]} />
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 10 }}>
                      {data.crmBasico.perdidos} orçados não fecharam (motivo de perda não é registrado na fonte de dados atual).
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 16 }}>
                      {[
                        { l: 'Valor Orçado', v: fmtR(data.crmBasico.valorOrcado) }, { l: 'Valor Fechado', v: fmtR(data.crmBasico.valorFechado), color: C.green },
                        { l: 'Em Aberto', v: fmtR(data.crmBasico.valorEmAberto), color: C.amber }, { l: 'Taxa de Fechamento', v: fmtPct(data.crmBasico.taxaFechamento), color: C.green },
                      ].map(s => (
                        <div key={s.l} style={{ background: 'var(--hover-bg)', borderRadius: 8, padding: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: C.text3, textTransform: 'uppercase' }}>{s.l}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: s.color || C.text }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={card}>
                    <div style={secTitle}>Vendas por Origem</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr style={{ background: 'var(--hover-bg)' }}>
                          {['Origem', 'Leads', 'Orçados', 'Vendidos', 'Faturamento', 'Fechamento'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {(data.crmBasico.porOrigem || []).map((o: any) => (
                            <tr key={o.origem} style={{ borderBottom: `1px solid ${C.border2}` }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: C.text }}>{o.origem}</td>
                              <td style={{ padding: '8px 10px', color: C.text2 }}>{fmtN(o.leads)}</td>
                              <td style={{ padding: '8px 10px', color: C.text2 }}>{fmtN(o.orcados)}</td>
                              <td style={{ padding: '8px 10px', color: C.green, fontWeight: 700 }}>{fmtN(o.vendidos)}</td>
                              <td style={{ padding: '8px 10px' }}>{fmtR(o.valorFechado)}</td>
                              <td style={{ padding: '8px 10px', color: C.text2 }}>{fmtPct(o.taxaFechamento)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
