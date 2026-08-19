import { useState, useEffect, useMemo } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'
import { healthMeta, HealthStatusKey } from '../lib/health'

const C = {
  card: 'var(--card-color)', border: 'var(--border-color)', border2: 'var(--border-light)',
  text: 'var(--text-main)', text2: 'var(--text-secondary)', text3: 'var(--text-muted)',
  red: '#FB2E0A', green: '#16A34A', amber: '#D97706',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` } catch { return d }
}

const STATUS_SEVERIDADE: Record<string, number> = { critico: 0, atencao: 1, implantacao: 2, saudavel: 3 }

function DomainCell({ dom }: { dom: any }) {
  if (!dom) {
    return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
  }
  const m = healthMeta(dom.status)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</span>
      {dom.score != null && <span style={{ fontSize: 11, color: C.text3, fontVariantNumeric: 'tabular-nums' }}>({dom.score})</span>}
    </div>
  )
}

export default function HealthScorePage() {
  const [clients, setClients] = useState<any[]>([])
  const [healthPorCliente, setHealthPorCliente] = useState<Record<string, any>>({})
  const [planosAtrasadosPorCliente, setPlanosAtrasadosPorCliente] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cRes, hRes] = await Promise.all([fetch('/api/clients', { cache: 'no-store' }), fetch('/api/health-summary', { cache: 'no-store' })])
    setClients(cRes.ok ? await cRes.json() : [])
    if (hRes.ok) {
      const d = await hRes.json()
      setHealthPorCliente(d.porCliente || {})
      setPlanosAtrasadosPorCliente(d.planosAtrasados || {})
    }
    setLoading(false)
  }

  const rows = useMemo(() => {
    return clients.map(c => {
      const h = healthPorCliente[c.id] || { trafego: null, comercial: null, projeto: null }
      const atrasados = planosAtrasadosPorCliente[c.id] || 0
      const ultimaAvaliacao = [h.trafego?.data, h.comercial?.data, h.projeto?.data].filter(Boolean).sort().reverse()[0] || null
      const projetoStatus: HealthStatusKey = h.projeto?.status || 'implantacao'
      const alertas = h.projeto?.metricas?.alertas
      const totalAlertas = h.projeto?.metricas?.total
      return { cliente: c, h, atrasados, ultimaAvaliacao, projetoStatus, alertas, totalAlertas }
    })
  }, [clients, healthPorCliente, planosAtrasadosPorCliente])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const mq = !q || r.cliente.nome.toLowerCase().includes(q)
    const ms = statusFilter === 'todos' || r.projetoStatus === statusFilter
    return mq && ms
  }).sort((a, b) => {
    const sa = STATUS_SEVERIDADE[a.projetoStatus] ?? 9
    const sb = STATUS_SEVERIDADE[b.projetoStatus] ?? 9
    if (sa !== sb) return sa - sb
    return (a.h.projeto?.score ?? 999) - (b.h.projeto?.score ?? 999)
  })

  const counts = {
    saudavel: rows.filter(r => r.projetoStatus === 'saudavel').length,
    atencao: rows.filter(r => r.projetoStatus === 'atencao').length,
    critico: rows.filter(r => r.projetoStatus === 'critico').length,
    implantacao: rows.filter(r => r.projetoStatus === 'implantacao').length,
  }
  const totalAtrasados = Object.values(planosAtrasadosPorCliente).reduce((s, n) => s + Number(n || 0), 0)

  return (
    <>
      <Head><title>Health Score — V4 Central</title></Head>
      <Layout title="Health Score — Visão Unificada">
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>

          <div style={{ fontSize: 13, color: C.text2, marginBottom: 20, maxWidth: 760, lineHeight: 1.6 }}>
            Visão consolidada do Health Score de todos os clientes — Tráfego, Comercial e Projeto lado a lado,
            pra localizar quem precisa de atenção sem ter que abrir cliente por cliente. Ordenado do mais crítico pro mais saudável.
          </div>

          {/* ── KPI STRIP ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, marginBottom: 20, background: C.border, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {[
              { label: 'Saudável', value: counts.saudavel, accent: C.green },
              { label: 'Atenção', value: counts.atencao, accent: C.amber },
              { label: 'Crítico', value: counts.critico, accent: C.red },
              { label: 'Em Implantação', value: counts.implantacao, accent: C.text3 },
              { label: 'Planos Atrasados', value: totalAtrasados, accent: totalAtrasados > 0 ? C.red : C.text3 },
            ].map((k, i) => (
              <div key={i} style={{ background: C.card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: `2px solid ${k.accent}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.label}</span>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* ── FILTROS ── */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input style={{ flex: 1, minWidth: 200, height: 38, background: 'var(--hover-bg)', border: 'none', borderRadius: 8, padding: '0 15px', fontSize: 13, outline: 'none', color: C.text }}
              placeholder="Pesquisar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ height: 38, background: 'var(--hover-bg)', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none', cursor: 'pointer', color: C.text }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="todos">Todos os status (Projeto)</option>
              <option value="critico">Crítico</option>
              <option value="atencao">Atenção</option>
              <option value="saudavel">Saudável</option>
              <option value="implantacao">Em Implantação</option>
            </select>
          </div>

          {/* ── TABELA ── */}
          {loading ? (
            <div className="empty">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">Nenhum cliente encontrado.</div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--hover-bg)' }}>
                      {['Cliente', 'Tráfego', 'Comercial', 'Projeto', 'Sinais de Atenção', 'Planos Atrasados', 'Última Avaliação'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: C.text2, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.cliente.id}
                        onClick={() => window.location.href = `/?cliente=${r.cliente.id}&tab=health`}
                        style={{ borderBottom: `1px solid ${C.border2}`, cursor: 'pointer', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{r.cliente.nome}</td>
                        <td style={{ padding: '12px 16px' }}><DomainCell dom={r.h.trafego} /></td>
                        <td style={{ padding: '12px 16px' }}><DomainCell dom={r.h.comercial} /></td>
                        <td style={{ padding: '12px 16px' }}><DomainCell dom={r.h.projeto} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          {r.alertas != null ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: r.alertas === 0 ? C.green : r.alertas <= 2 ? C.amber : C.red }}>
                              {r.alertas} de {r.totalAlertas}
                            </span>
                          ) : <span style={{ fontSize: 12, color: C.text3 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {r.atrasados > 0
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: C.red, padding: '2px 9px', borderRadius: 20 }}>{r.atrasados}</span>
                            : <span style={{ fontSize: 12, color: C.text3 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.ultimaAvaliacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
