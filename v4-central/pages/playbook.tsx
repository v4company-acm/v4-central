import { useState, useEffect, useMemo } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'
import PlaybookKanban, { PlaybookItemEdit } from '../components/PlaybookKanban'
import { fmtDate } from '../lib/playbook'

const C = {
  card: 'var(--card-color)', border: 'var(--border-color)', border2: 'var(--border-light)',
  text: 'var(--text-main)', text2: 'var(--text-secondary)', text3: 'var(--text-muted)',
  red: '#FB2E0A', green: '#16A34A', amber: '#D97706',
}

export default function PlaybookPage() {
  const [clients, setClients] = useState<any[]>([])
  const [porCliente, setPorCliente] = useState<Record<string, any>>({})
  const [itensTodos, setItensTodos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'sem_playbook' | 'atrasados'>('todos')
  const [view, setView] = useState<'quadro' | 'cobertura'>('quadro')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cRes, pRes, iRes] = await Promise.all([
      fetch('/api/clients', { cache: 'no-store' }),
      fetch('/api/playbook-summary', { cache: 'no-store' }),
      fetch('/api/playbook-itens-todos', { cache: 'no-store' }),
    ])
    setClients(cRes.ok ? await cRes.json() : [])
    if (pRes.ok) setPorCliente((await pRes.json()).porCliente || {})
    if (iRes.ok) setItensTodos((await iRes.json()).itens || [])
    setLoading(false)
  }

  async function marcarEntregue(id: number) {
    const res = await fetch('/api/playbook-itens', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'entregue' }) })
    if (res.ok) load()
  }
  async function reabrirItem(id: number) {
    const res = await fetch('/api/playbook-itens', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'pendente' }) })
    if (res.ok) load()
  }
  async function editarItem(id: number, patch: PlaybookItemEdit) {
    const res = await fetch('/api/playbook-itens', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    if (res.ok) load()
    else { const d = await res.json().catch(() => ({})); alert(`Erro ao editar: ${d.error || 'tenta de novo.'}`) }
  }
  function abrirCliente(clienteId: string) {
    window.location.href = `/?cliente=${clienteId}&tab=playbook`
  }

  const rows = useMemo(() => {
    return clients.map(c => {
      const p = porCliente[c.id] || { regrasAtivas: 0, pendentes: 0, atrasados: 0, proxima: null }
      const semPlaybook = !(p.regrasAtivas > 0)
      return { cliente: c, p, semPlaybook }
    })
  }, [clients, porCliente])

  const filteredRows = rows.filter(r => {
    const q = search.toLowerCase()
    const mq = !q || r.cliente.nome.toLowerCase().includes(q)
    const mf = filtro === 'todos' || (filtro === 'sem_playbook' && r.semPlaybook) || (filtro === 'atrasados' && r.p.atrasados > 0)
    return mq && mf
  }).sort((a, b) => {
    if (a.semPlaybook !== b.semPlaybook) return a.semPlaybook ? -1 : 1
    if (a.p.atrasados !== b.p.atrasados) return b.p.atrasados - a.p.atrasados
    return (a.p.proxima || '9999-99-99').localeCompare(b.p.proxima || '9999-99-99')
  })

  const filteredItens = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return itensTodos
    return itensTodos.filter(i => (i.cliente_nome || '').toLowerCase().includes(q))
  }, [itensTodos, search])

  const totalSemPlaybook = rows.filter(r => r.semPlaybook).length
  const totalAtrasados = rows.reduce((s, r) => s + (r.p.atrasados || 0), 0)
  const totalPendentes = rows.reduce((s, r) => s + (r.p.pendentes || 0), 0)
  const totalComPlaybook = rows.length - totalSemPlaybook

  return (
    <>
      <Head><title>Playbook — V4 Central</title></Head>
      <Layout title="Playbook — Visão Unificada">
        <div style={{ maxWidth: 1500, margin: '0 auto' }}>

          <div style={{ fontSize: 13, color: C.text2, marginBottom: 20, maxWidth: 780, lineHeight: 1.6 }}>
            Previsibilidade de tudo que será entregue no próximo mês, em todos os clientes — o quadro abaixo é
            organizado por semana, não por status: dá pra ver de relance o que vence quando, sem abrir cliente por cliente.
          </div>

          {/* ── KPI STRIP ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, marginBottom: 20, background: C.border, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {[
              { label: 'Com Playbook', value: totalComPlaybook, accent: C.green },
              { label: 'Sem Playbook', value: totalSemPlaybook, accent: totalSemPlaybook > 0 ? C.amber : C.text3 },
              { label: 'Entregas Pendentes (3m)', value: totalPendentes, accent: '#2563EB' },
              { label: 'Entregas Atrasadas', value: totalAtrasados, accent: totalAtrasados > 0 ? C.red : C.text3 },
            ].map((k, i) => (
              <div key={i} style={{ background: C.card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: `2px solid ${k.accent}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.label}</span>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* ── FILTROS + TOGGLE DE VISÃO ── */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input style={{ flex: 1, minWidth: 200, height: 38, background: 'var(--hover-bg)', border: 'none', borderRadius: 8, padding: '0 15px', fontSize: 13, outline: 'none', color: C.text }}
              placeholder="Pesquisar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            {view === 'cobertura' && (
              <select style={{ height: 38, background: 'var(--hover-bg)', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none', cursor: 'pointer', color: C.text }}
                value={filtro} onChange={e => setFiltro(e.target.value as any)}>
                <option value="todos">Todos os clientes</option>
                <option value="sem_playbook">Sem playbook definido</option>
                <option value="atrasados">Com entregas atrasadas</option>
              </select>
            )}
            <div style={{ display: 'flex', gap: 4, background: 'var(--hover-bg)', borderRadius: 10, padding: 4 }}>
              {[{ k: 'quadro', l: 'Quadro' }, { k: 'cobertura', l: 'Cobertura' }].map(o => (
                <button key={o.k} onClick={() => setView(o.k as any)} style={{
                  padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: view === o.k ? 'var(--card-color)' : 'transparent', color: view === o.k ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: view === o.k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>{o.l}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="empty">Carregando...</div>
          ) : view === 'quadro' ? (
            filteredItens.length === 0 ? (
              <div className="empty">Nenhuma entrega pendente pro próximo mês.</div>
            ) : (
              <PlaybookKanban
                itens={filteredItens}
                onMarcarEntregue={marcarEntregue}
                onReabrir={reabrirItem}
                onEditar={editarItem}
                mostrarCliente
                onClickCliente={abrirCliente}
              />
            )
          ) : filteredRows.length === 0 ? (
            <div className="empty">Nenhum cliente encontrado.</div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--hover-bg)' }}>
                      {['Cliente', 'Regras Ativas', 'Entregas Pendentes', 'Atrasadas', 'Próxima Entrega'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: C.text2, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(r => (
                      <tr key={r.cliente.id}
                        onClick={() => abrirCliente(r.cliente.id)}
                        style={{ borderBottom: `1px solid ${C.border2}`, cursor: 'pointer', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{r.cliente.nome}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {r.semPlaybook
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, background: 'rgba(217,119,6,0.1)', padding: '3px 9px', borderRadius: 20 }}>Sem Playbook</span>
                            : <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{r.p.regrasAtivas}</span>}
                        </td>
                        <td style={{ padding: '12px 16px', fontVariantNumeric: 'tabular-nums', color: C.text2 }}>{r.p.pendentes || 0}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {r.p.atrasados > 0
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: C.red, padding: '2px 9px', borderRadius: 20 }}>{r.p.atrasados}</span>
                            : <span style={{ fontSize: 12, color: C.text3 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.p.proxima)}</td>
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
