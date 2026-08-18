import { useState } from 'react'

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtR(n: any) {
  const v = parseFloat(n) || 0
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtN(n: any) {
  return Number(n).toLocaleString('pt-BR')
}
function fmtK(n: any) {
  const v = parseFloat(n) || 0
  return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v))
}
function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function delta(cur: number, prev: number, invert = false) {
  if (!prev || prev === 0) return null
  const pct = ((cur - prev) / Math.abs(prev) * 100).toFixed(1)
  const up = cur > prev
  const good = invert ? !up : up
  return { pct, up, good }
}

const GREEN = '#16A34A'
const AMBER = '#D97706'

// ── types ─────────────────────────────────────────────────────────────────────
interface Ad { name: string; spend: number; cpa: number; roas: number; ctr: number; conversions: number }
interface MetricEntry {
  data: string
  invest: string
  leads: string
  vendas: string
  totalVendido: string
  cpl: string
  roas: string
  roi: string
  savedAt: string
  google?: {
    spend: number; impressions: number; clicks: number; ctr: string
    conversions: number; roas: string; cpm: string
    imp_share: string; top_share: string; lost_rank: string
  }
  meta?: {
    spend: number; impressions: number; clicks: number; reach: number
    frequency: number; ctr: number; cpm: number; conversions: number; roas: number
    video?: { p25: number; p50: number; p75: number; p100: number }
    thumbstop: number; champion?: Ad; top_ads?: Ad[]
  }
}

// ── sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, delta: d, color, bar }: {
  label: string; value: string; delta?: { pct: string; up: boolean; good: boolean } | null
  color?: string; bar?: number
}) {
  return (
    <div style={{
      background: 'var(--hover-bg)', borderRadius: 10,
      padding: '13px 14px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      {d && (
        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: d.good ? GREEN : 'var(--red)' }}>
          {d.up ? '▲' : '▼'} {Math.abs(parseFloat(d.pct))}% vs anterior
        </div>
      )}
      {bar !== undefined && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, height: 2,
          width: `${Math.min(100, bar)}%`, background: color || 'var(--red)',
          transition: 'width .9s cubic-bezier(.16,1,.3,1)'
        }} />
      )}
    </div>
  )
}

function ImpBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div style={{ height: 4, background: 'var(--hover-bg)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' }} />
      </div>
    </div>
  )
}

function GaugeArc({ pct }: { pct: number }) {
  const color = pct > 70 ? GREEN : pct > 50 ? AMBER : 'var(--red)'
  const offset = 132 - (132 * pct / 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 100, height: 54 }}>
        <svg width="100" height="54" viewBox="0 0 100 54">
          <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke="var(--border-color)" strokeWidth="8" strokeLinecap="round" />
          <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray="132" strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s' }} />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center', fontWeight: 800, fontSize: 18, color, fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>do leilão com impressão</div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────
interface Props { historico: MetricEntry[]; clienteNome: string }

export default function MetricsDashboard({ historico, clienteNome }: Props) {
  const [period, setPeriod] = useState(1)

  if (!historico || historico.length === 0) {
    return (
      <div className="empty">
        Nenhuma métrica registrada ainda.<br />
        <span style={{ fontSize: 12 }}>Lance os números na aba Health Score (Tráfego) ou registre a semana abaixo.</span>
      </div>
    )
  }

  const sorted = [...historico].sort((a, b) => b.data.localeCompare(a.data))
  const shown = sorted.slice(0, period === 1 ? 1 : period === 7 ? 7 : 30)
  const cur = shown[0]
  const prev = shown[1]

  const invest = parseFloat(cur.invest) || 0
  const roas = parseFloat(cur.roas) || 0
  const fat = parseFloat(cur.totalVendido) || 0
  const leads = parseInt(cur.leads) || 0
  const vendas = parseInt(cur.vendas) || 0
  const cpl = parseFloat(cur.cpl) || 0
  const roi = parseFloat(cur.roi) || 0
  const txConv = leads > 0 ? (vendas / leads * 100).toFixed(1) + '%' : '—'
  const tm = vendas > 0 ? fmtR(fat / vendas) : '—'

  const g = cur.google
  const m = cur.meta
  const impShare = parseFloat(g?.imp_share || '0') || 0
  const topShare = parseFloat(g?.top_share || '0') || 0
  const lostRank = parseFloat(g?.lost_rank || '0') || 0

  const bestRoas = Math.max(...sorted.map(d => parseFloat(d.roas) || 0))
  const bestRoi = Math.max(...sorted.map(d => parseFloat(d.roi) || 0))
  const bestVendas = Math.max(...sorted.map(d => parseInt(d.vendas) || 0))

  // ── styles ─────────────────────────────────────────────────────────────────
  const card = {
    background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14
  }
  const cardLabel = { fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 12 }

  return (
    <div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          Última atualização: <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(cur.data)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--hover-bg)', borderRadius: 10, padding: 4 }}>
          {[{ l: 'Hoje', v: 1 }, { l: '7d', v: 7 }, { l: '30d', v: 30 }].map(p => (
            <button key={p.v} onClick={() => setPeriod(p.v)} style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', border: 'none',
              color: period === p.v ? 'var(--text-main)' : 'var(--text-muted)',
              background: period === p.v ? 'var(--card-color)' : 'transparent',
              boxShadow: period === p.v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{p.l}</button>
          ))}
        </div>
      </div>

      {/* KPIs principais */}
      <div className="sec-title" style={{ fontSize: 12 }}>Resultado</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
        <KpiCard label="Investimento" value={fmtR(invest)} color={AMBER}
          delta={prev ? delta(invest, parseFloat(prev.invest), true) : null} bar={invest / 500 * 100} />
        <KpiCard label="ROAS" value={roas ? roas.toFixed(1) + 'x' : '—'} color={GREEN}
          delta={prev ? delta(roas, parseFloat(prev.roas)) : null} bar={roas / 8 * 100} />
        <KpiCard label="Faturamento" value={fmtR(fat)} color={GREEN}
          delta={prev ? delta(fat, parseFloat(prev.totalVendido)) : null} bar={fat / 3000 * 100} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 24 }}>
        {[
          { label: 'Leads', value: String(leads), color: undefined },
          { label: 'Vendas', value: String(vendas), color: undefined },
          { label: 'CPL', value: cpl ? fmtR(cpl) : '—', color: undefined },
          { label: 'Tx conv.', value: txConv, color: AMBER },
          { label: 'Ticket médio', value: tm, color: undefined },
          { label: 'ROI', value: roi ? roi + '%' : '—', color: roi > 0 ? GREEN : 'var(--red)' },
        ].map(k => (
          <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />
        ))}
      </div>

      {/* Google Ads */}
      {g && (
        <>
          <div className="sec-title" style={{ fontSize: 12 }}>Google Ads</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
            <div style={card}>
              <div style={cardLabel}>Search Impression Share</div>
              <GaugeArc pct={impShare} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <ImpBar label="Topo da página" value={topShare + '%'} pct={topShare} color="#2563EB" />
                <ImpBar label="Perdido por rank" value={lostRank + '%'} pct={lostRank} color="var(--red)" />
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Performance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ImpBar label="Impressões" value={fmtK(g.impressions)} pct={Math.min(100, g.impressions / 200)} color="#2563EB" />
                <ImpBar label="Cliques" value={fmtK(g.clicks)} pct={Math.min(100, g.clicks / 8)} color="#7C3AED" />
                <ImpBar label="CTR" value={g.ctr + '%'} pct={Math.min(100, parseFloat(g.ctr) * 15)} color={AMBER} />
                <ImpBar label="CPM médio" value={fmtR(g.cpm)} pct={Math.min(100, parseFloat(g.cpm) * 4)} color={GREEN} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Meta Ads */}
      {m && (
        <>
          <div className="sec-title" style={{ fontSize: 12 }}>Meta Ads</div>

          {/* Criativo campeão */}
          {m.champion && (
            <div style={{
              background: 'rgba(251,46,10,0.06)', borderLeft: '4px solid var(--red)',
              borderRadius: 8, padding: 16, marginBottom: 8
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(251,46,10,0.14)', color: 'var(--red)', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, marginBottom: 10, letterSpacing: '.06em' }}>
                ★ CRIATIVO CAMPEÃO · MENOR CPA
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, lineHeight: 1.3, color: 'var(--text-main)' }}>{m.champion.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { l: 'ROAS', v: m.champion.roas ? m.champion.roas.toFixed(1) + 'x' : '—', c: GREEN },
                  { l: 'CPA', v: m.champion.cpa ? fmtR(m.champion.cpa) : '—', c: undefined },
                  { l: 'CTR', v: m.champion.ctr + '%', c: AMBER },
                  { l: 'Gasto', v: fmtR(m.champion.spend), c: undefined },
                ].map(s => (
                  <div key={s.l} style={{ background: 'var(--hover-bg)', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.c || 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
            {/* Alcance e frequência */}
            <div style={card}>
              <div style={cardLabel}>Alcance & Frequência</div>
              {[
                { l: 'Alcance único', v: fmtK(m.reach) },
                { l: 'Impressões', v: fmtK(m.impressions) },
                { l: 'Frequência', v: m.frequency?.toFixed(2) + 'x' },
                { l: 'CPM', v: fmtR(m.cpm) },
                { l: 'CTR', v: m.ctr + '%' },
              ].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
                </div>
              ))}
            </div>

            {/* Retenção de vídeo */}
            <div style={card}>
              <div style={cardLabel}>Retenção de vídeo</div>
              {m.video ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginTop: 8 }}>
                    {[
                      { k: 'p25', v: m.video.p25, op: 'ff' },
                      { k: 'p50', v: m.video.p50, op: 'cc' },
                      { k: 'p75', v: m.video.p75, op: '88' },
                      { k: 'p100', v: m.video.p100, op: '55' },
                    ].map(b => {
                      const max = m.video!.p25 || 1
                      return (
                        <div key={b.k} style={{ flex: 1, height: `${b.v / max * 100}%`, background: `#FB2E0A${b.op}`, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {['25%', '50%', '75%', '100%'].map(l => (
                      <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-muted)' }}>{l}</div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    Thumbstop rate: <span style={{ color: AMBER, fontWeight: 700 }}>{m.thumbstop}%</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20, textAlign: 'center' }}>Sem dados de vídeo</div>
              )}
            </div>

            {/* Top criativos */}
            <div style={card}>
              <div style={cardLabel}>Top criativos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(m.top_ads || []).slice(0, 4).map((a, i) => (
                  <div key={i} style={{ padding: '7px 9px', background: 'var(--hover-bg)', borderRadius: 7 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: a.roas > 3 ? GREEN : AMBER, fontVariantNumeric: 'tabular-nums' }}>
                        {a.roas ? a.roas.toFixed(1) + 'x' : '—'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.cpa ? fmtR(a.cpa) + ' CPA' : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Melhores resultados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 24 }}>
        {[
          { l: 'Melhor ROAS', v: bestRoas ? bestRoas.toFixed(1) + 'x' : '—', c: GREEN },
          { l: 'Melhor ROI', v: bestRoi ? bestRoi + '%' : '—', c: GREEN },
          { l: 'Recorde vendas', v: bestVendas ? fmtN(bestVendas) : '—', c: undefined },
        ].map(k => (
          <div key={k.l} style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: 14, borderTop: '2px solid var(--red)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.c || 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Histórico */}
      <div className="sec-title" style={{ fontSize: 12 }}>Histórico</div>
      <div style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--hover-bg)' }}>
                {['Data', 'Invest.', 'ROAS', 'Leads', 'Vendas', 'CPL', 'Tx conv', 'ImpShare', 'Freq', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((d, i) => {
                const r = parseFloat(d.roas) || 0
                const tc = parseInt(d.leads) > 0 ? (parseInt(d.vendas) / parseInt(d.leads) * 100).toFixed(0) + '%' : '—'
                const isTop = r === bestRoas && r > 0
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-light)', background: isTop ? 'rgba(251,46,10,0.06)' : 'transparent' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDate(d.data)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtR(parseFloat(d.invest))}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r > 4 ? GREEN : r > 2 ? 'var(--text-main)' : 'var(--red)' }}>{r ? r.toFixed(1) + 'x' : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{d.leads || 0}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{d.vendas || 0}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(d.cpl) > 0 ? fmtR(parseFloat(d.cpl)) : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{tc}</td>
                    <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', color: parseFloat(d.google?.imp_share || '0') > 70 ? GREEN : 'var(--text-secondary)' }}>{d.google?.imp_share ? d.google.imp_share + '%' : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{d.meta?.frequency ? d.meta.frequency.toFixed(2) + 'x' : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {isTop && <span style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>Recorde</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
