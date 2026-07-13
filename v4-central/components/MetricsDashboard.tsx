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
      background: '#0e1018', border: '1px solid #ffffff0d', borderRadius: 10,
      padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: 'all .2s'
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 500, color: color || '#f0f1f5', lineHeight: 1 }}>{value}</div>
      {d && (
        <div style={{ fontSize: 9, fontFamily: 'monospace', marginTop: 5, color: d.good ? '#1db97a' : '#ff4444' }}>
          {d.up ? '▲' : '▼'} {Math.abs(parseFloat(d.pct))}% vs anterior
        </div>
      )}
      {bar !== undefined && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, height: 2,
          width: `${Math.min(100, bar)}%`, background: color || '#FB2E0A',
          transition: 'width .9s cubic-bezier(.16,1,.3,1)'
        }} />
      )}
    </div>
  )
}

function ImpBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
        <span style={{ color: '#8b8fa8' }}>{label}</span>
        <span style={{ fontFamily: 'monospace', color: '#f0f1f5' }}>{value}</span>
      </div>
      <div style={{ height: 3, background: '#1a1e2a', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' }} />
      </div>
    </div>
  )
}

function GaugeArc({ pct }: { pct: number }) {
  const color = pct > 70 ? '#1db97a' : pct > 50 ? '#f59e0b' : '#ff4444'
  const offset = 132 - (132 * pct / 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 100, height: 54 }}>
        <svg width="100" height="54" viewBox="0 0 100 54">
          <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke="#1a1e2a" strokeWidth="8" strokeLinecap="round" />
          <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray="132" strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s' }} />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center', fontFamily: 'monospace', fontSize: 18, color }}>
          {pct}%
        </div>
      </div>
      <div style={{ fontSize: 9, color: '#4a4e63' }}>do leilão com impressão</div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────
interface Props { historico: MetricEntry[]; clienteNome: string }

export default function MetricsDashboard({ historico, clienteNome }: Props) {
  const [period, setPeriod] = useState(1)

  if (!historico || historico.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#8b8fa8', fontSize: 14 }}>
        Nenhuma métrica registrada ainda.<br />
        <span style={{ fontSize: 12, color: '#4a4e63' }}>Os dados serão preenchidos automaticamente pelo n8n.</span>
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
  const card: React.CSSProperties = {
    background: '#0e1018', border: '1px solid #ffffff0d', borderRadius: 10, padding: 14
  }
  const secLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: '.14em', color: '#4a4e63',
    textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8
  }

  return (
    <div style={{ background: '#07080d', borderRadius: 12, padding: 20, color: '#f0f1f5' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.5px' }}>{clienteNome}</div>
          <div style={{ fontSize: 11, color: '#8b8fa8', marginTop: 3, fontFamily: 'monospace' }}>
            Dashboard de tráfego · {fmtDate(cur.data)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ l: 'Hoje', v: 1 }, { l: '7d', v: 7 }, { l: '30d', v: 30 }].map(p => (
            <button key={p.v} onClick={() => setPeriod(p.v)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: period === p.v ? 'none' : '1px solid #ffffff18',
              color: period === p.v ? '#fff' : '#8b8fa8',
              background: period === p.v ? '#FB2E0A' : 'transparent', fontFamily: 'inherit'
            }}>{p.l}</button>
          ))}
        </div>
      </div>

      {/* KPIs principais */}
      <div style={{ ...secLabel }}>Resultado<div style={{ flex: 1, height: 1, background: '#ffffff0d' }} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 7 }}>
        <KpiCard label="Investimento" value={fmtR(invest)} color="#ff4444"
          delta={prev ? delta(invest, parseFloat(prev.invest), true) : null} bar={invest / 500 * 100} />
        <KpiCard label="ROAS" value={roas ? roas.toFixed(1) + 'x' : '—'} color="#1db97a"
          delta={prev ? delta(roas, parseFloat(prev.roas)) : null} bar={roas / 8 * 100} />
        <KpiCard label="Faturamento" value={fmtR(fat)}
          delta={prev ? delta(fat, parseFloat(prev.totalVendido)) : null} bar={fat / 3000 * 100} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 7, marginBottom: 20 }}>
        {[
          { label: 'Leads', value: String(leads), color: undefined },
          { label: 'Vendas', value: String(vendas), color: undefined },
          { label: 'CPL', value: cpl ? fmtR(cpl) : '—', color: '#3b8bdd' },
          { label: 'Tx conv.', value: txConv, color: '#f59e0b' },
          { label: 'Ticket médio', value: tm, color: undefined },
          { label: 'ROI', value: roi ? roi + '%' : '—', color: roi > 0 ? '#1db97a' : '#ff4444' },
        ].map(k => (
          <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />
        ))}
      </div>

      {/* Google Ads */}
      {g && (
        <>
          <div style={{ ...secLabel }}>Google Ads<div style={{ flex: 1, height: 1, background: '#ffffff0d' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 20 }}>
            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', marginBottom: 12 }}>Search Impression Share</div>
              <GaugeArc pct={impShare} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <ImpBar label="Topo da página" value={topShare + '%'} pct={topShare} color="#3b8bdd" />
                <ImpBar label="Perdido por rank" value={lostRank + '%'} pct={lostRank} color="#ff4444" />
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', marginBottom: 12 }}>Performance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ImpBar label="Impressões" value={fmtK(g.impressions)} pct={Math.min(100, g.impressions / 200)} color="#3b8bdd" />
                <ImpBar label="Cliques" value={fmtK(g.clicks)} pct={Math.min(100, g.clicks / 8)} color="#8b5cf6" />
                <ImpBar label="CTR" value={g.ctr + '%'} pct={Math.min(100, parseFloat(g.ctr) * 15)} color="#f59e0b" />
                <ImpBar label="CPM médio" value={fmtR(g.cpm)} pct={Math.min(100, parseFloat(g.cpm) * 4)} color="#1db97a" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Meta Ads */}
      {m && (
        <>
          <div style={{ ...secLabel }}>Meta Ads<div style={{ flex: 1, height: 1, background: '#ffffff0d' }} /></div>

          {/* Criativo campeão */}
          {m.champion && (
            <div style={{
              background: 'linear-gradient(135deg,#FB2E0A0a,#8b5cf60a)',
              border: '1px solid #FB2E0A22', borderRadius: 10, padding: 14, marginBottom: 7
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FB2E0A22', color: '#ff4444', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 10, marginBottom: 8, letterSpacing: '.08em' }}>
                ★ CRIATIVO CAMPEÃO · MENOR CPA
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>{m.champion.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {[
                  { l: 'ROAS', v: m.champion.roas ? m.champion.roas.toFixed(1) + 'x' : '—', c: '#1db97a' },
                  { l: 'CPA', v: m.champion.cpa ? fmtR(m.champion.cpa) : '—', c: '#f0f1f5' },
                  { l: 'CTR', v: m.champion.ctr + '%', c: '#f59e0b' },
                  { l: 'Gasto', v: fmtR(m.champion.spend), c: '#f0f1f5' },
                ].map(s => (
                  <div key={s.l} style={{ background: '#141720', borderRadius: 7, padding: '7px 8px' }}>
                    <div style={{ fontSize: 8, color: '#4a4e63', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>{s.l}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 500, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 20 }}>
            {/* Alcance e frequência */}
            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', marginBottom: 10 }}>Alcance & Frequência</div>
              {[
                { l: 'Alcance único', v: fmtK(m.reach) },
                { l: 'Impressões', v: fmtK(m.impressions) },
                { l: 'Frequência', v: m.frequency?.toFixed(2) + 'x' },
                { l: 'CPM', v: fmtR(m.cpm) },
                { l: 'CTR', v: m.ctr + '%' },
              ].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #ffffff0d' }}>
                  <span style={{ fontSize: 10, color: '#8b8fa8' }}>{r.l}</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#f0f1f5' }}>{r.v}</span>
                </div>
              ))}
            </div>

            {/* Retenção de vídeo */}
            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', marginBottom: 10 }}>Retenção de vídeo</div>
              {m.video ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginTop: 8 }}>
                    {[
                      { k: 'p25', v: m.video.p25, op: 'cc' },
                      { k: 'p50', v: m.video.p50, op: '99' },
                      { k: 'p75', v: m.video.p75, op: '66' },
                      { k: 'p100', v: m.video.p100, op: '44' },
                    ].map(b => {
                      const max = m.video!.p25 || 1
                      return (
                        <div key={b.k} style={{ flex: 1, height: `${b.v / max * 100}%`, background: `#FB2E0A${b.op}`, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {['25%', '50%', '75%', '100%'].map(l => (
                      <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: '#4a4e63', fontFamily: 'monospace' }}>{l}</div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 9, color: '#4a4e63' }}>
                    Thumbstop rate: <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{m.thumbstop}%</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#4a4e63', marginTop: 20, textAlign: 'center' }}>Sem dados de vídeo</div>
              )}
            </div>

            {/* Top criativos */}
            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', marginBottom: 10 }}>Top criativos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(m.top_ads || []).slice(0, 4).map((a, i) => (
                  <div key={i} style={{ padding: '6px 8px', background: '#141720', borderRadius: 7 }}>
                    <div style={{ fontSize: 10, color: '#8b8fa8', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: a.roas > 3 ? '#1db97a' : '#f59e0b' }}>
                        {a.roas ? a.roas.toFixed(1) + 'x' : '—'}
                      </span>
                      <span style={{ fontSize: 10, color: '#4a4e63' }}>{a.cpa ? fmtR(a.cpa) + ' CPA' : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Melhores resultados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 20 }}>
        {[
          { l: 'Melhor ROAS', v: bestRoas ? bestRoas.toFixed(1) + 'x' : '—', c: '#1db97a' },
          { l: 'Melhor ROI', v: bestRoi ? bestRoi + '%' : '—', c: '#1db97a' },
          { l: 'Recorde vendas', v: bestVendas ? fmtN(bestVendas) : '—', c: '#f0f1f5' },
        ].map(k => (
          <div key={k.l} style={{ ...card, borderTop: '2px solid #FB2E0A' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', marginBottom: 6 }}>{k.l}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 500, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Histórico */}
      <div style={{ ...secLabel }}>Histórico<div style={{ flex: 1, height: 1, background: '#ffffff0d' }} /></div>
      <div style={{ background: '#0e1018', border: '1px solid #ffffff0d', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#141720' }}>
                {['Data', 'Invest.', 'ROAS', 'Leads', 'Vendas', 'CPL', 'Tx conv', 'ImpShare', 'Freq', ''].map(h => (
                  <th key={h} style={{ padding: '8px 11px', textAlign: 'left', fontSize: 8, fontWeight: 700, letterSpacing: '.1em', color: '#4a4e63', textTransform: 'uppercase', borderBottom: '1px solid #ffffff0d', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((d, i) => {
                const r = parseFloat(d.roas) || 0
                const tc = parseInt(d.leads) > 0 ? (parseInt(d.vendas) / parseInt(d.leads) * 100).toFixed(0) + '%' : '—'
                const isTop = r === bestRoas && r > 0
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #ffffff0d', background: isTop ? '#FB2E0A08' : 'transparent' }}>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: '#f0f1f5', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(d.data)}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: '#8b8fa8' }}>{fmtR(parseFloat(d.invest))}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: r > 4 ? '#1db97a' : r > 2 ? '#f0f1f5' : '#ff4444' }}>{r ? r.toFixed(1) + 'x' : '—'}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: '#8b8fa8' }}>{d.leads || 0}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: '#8b8fa8' }}>{d.vendas || 0}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: '#8b8fa8' }}>{parseFloat(d.cpl) > 0 ? fmtR(parseFloat(d.cpl)) : '—'}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: '#8b8fa8' }}>{tc}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: parseFloat(d.google?.imp_share || '0') > 70 ? '#1db97a' : '#8b8fa8' }}>{d.google?.imp_share ? d.google.imp_share + '%' : '—'}</td>
                    <td style={{ padding: '8px 11px', fontFamily: 'monospace', color: '#8b8fa8' }}>{d.meta?.frequency ? d.meta.frequency.toFixed(2) + 'x' : '—'}</td>
                    <td style={{ padding: '8px 11px' }}>
                      {isTop && <span style={{ background: '#FB2E0A22', color: '#ff4444', fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 8 }}>★ top</span>}
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
