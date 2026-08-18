import { useState, useEffect, useMemo } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'

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

const C = {
  card: 'var(--card-color)', border: 'var(--border-color)', border2: 'var(--border-light)',
  text: 'var(--text-main)', text2: 'var(--text-secondary)', text3: 'var(--text-muted)',
  red: '#FB2E0A', redLight: 'rgba(251,46,10,0.1)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.1)',
  amber: '#D97706', amberBg: 'rgba(217,119,6,0.1)',
}

function fmtR(v: number | null) { if (v === null || v === undefined) return '—'; return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtPct(v: number | null) { if (v === null || v === undefined) return '—'; return (Number(v) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%' }
function fmtDate(v: string | null) { if (!v) return '—'; const [y, m, d] = v.split('-'); return `${d}/${m}/${y}` }
function fmtLt(v: number | null) { if (v === null || v === undefined) return '—'; return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m' }
function fmtSyncedAt(v: string | null) {
  if (!v) return 'ainda não sincronizado'
  const d = new Date(v)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_COLOR: Record<string, string> = {
  'Ativo': C.green, 'Inativo': C.text3, 'Churn antes de entrar': C.red,
}

export default function GestaoProjetosPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [flagFilter, setFlagFilter] = useState('todos')
  const [sortKey, setSortKey] = useState<'cliente' | 'recorrente' | 'gmv_mensal' | 'lt'>('cliente')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  useEffect(() => {
    fetch('/api/gestao-projetos').then(r => r.json()).then(d => {
      setRows(d.rows || []); setSyncedAt(d.syncedAt || null); setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const statuses = useMemo(() => [...new Set(rows.map(r => r.status).filter(Boolean))] as string[], [rows])
  const flags = useMemo(() => [...new Set(rows.map(r => r.flag).filter(Boolean))] as string[], [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let out = rows.filter(r =>
      (!q || r.cliente.toLowerCase().includes(q)) &&
      (statusFilter === 'todos' || r.status === statusFilter) &&
      (flagFilter === 'todos' || r.flag === flagFilter)
    )
    out = [...out].sort((a, b) => {
      const av = a[sortKey] ?? (typeof a.recorrente === 'number' ? -Infinity : ''), bv = b[sortKey] ?? (typeof b.recorrente === 'number' ? -Infinity : '')
      if (typeof av === 'string' || typeof bv === 'string') return sortDir * String(av).localeCompare(String(bv))
      return sortDir * ((av as number) - (bv as number))
    })
    return out
  }, [rows, search, statusFilter, flagFilter, sortKey, sortDir])

  const kpis = useMemo(() => {
    const ativos = rows.filter(r => r.status === 'Ativo')
    return {
      total: rows.length,
      ativos: ativos.length,
      recorrenteTotal: ativos.reduce((s, r) => s + (r.recorrente || 0), 0),
      midiaTotal: ativos.reduce((s, r) => s + (r.midia || 0), 0),
      roiPositivo: rows.filter(r => (r.roi_maior_1 || '').toLowerCase() === 'sim').length,
    }
  }, [rows])

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(k); setSortDir(1) }
  }

  return (
    <>
      <Head><title>Gestão de Projetos — V4 Central de Clientes</title></Head>
      <Layout title="Gestão de Projetos">
        <div style={{ maxWidth: 1500, margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: C.text3 }}>
              Espelho automático da planilha "Gestão de Projetos" (aba DataBase) · sincronizado a cada 4h via n8n
            </div>
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>
              🔄 Última sincronização: {fmtSyncedAt(syncedAt)}
            </div>
          </div>

          {/* KPI STRIP */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total de Clientes', value: kpis.total, color: C.text, bg: C.card },
              { label: 'Ativos', value: kpis.ativos, color: C.green, bg: C.greenBg },
              { label: 'Com ROI > 1', value: kpis.roiPositivo, color: C.green, bg: C.greenBg },
              { label: 'Recorrente (ativos)', value: fmtR(kpis.recorrenteTotal), isMoney: true, grad: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' },
              { label: 'Mídia (ativos)', value: fmtR(kpis.midiaTotal), isMoney: true, grad: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' },
            ].map((k: any, i) => (
              <div key={i} style={{
                background: k.grad || C.card, borderRadius: 12, padding: 16,
                border: k.grad ? 'none' : `1px solid ${C.border}`, boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: k.grad ? 'rgba(255,255,255,0.7)' : C.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: k.isMoney ? 18 : 24, fontWeight: 900, color: k.grad ? '#fff' : (k.color || C.text) }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* FILTROS */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ flex: 1, minWidth: 200, height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 15px', fontSize: 13, outline: 'none' }}
              placeholder="Pesquisar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none', cursor: 'pointer' }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="todos">Todos os Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={{ height: 38, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none', cursor: 'pointer' }}
              value={flagFilter} onChange={e => setFlagFilter(e.target.value)}>
              <option value="todos">Todas as Flags</option>
              {flags.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* TABELA */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: C.card, borderRadius: 12, border: `1px dashed ${C.border2}`, color: C.text2 }}>Nenhum cliente encontrado.</div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--hover-bg)', borderBottom: `1px solid ${C.border}` }}>
                      {[
                        { l: '', k: null }, { l: 'Cliente', k: 'cliente' }, { l: 'Status', k: null }, { l: 'Jornada / Step', k: null },
                        { l: 'Recorrente', k: 'recorrente' }, { l: 'Mídia', k: null }, { l: 'E.E/Pontual', k: null },
                        { l: 'GMV Mensal', k: 'gmv_mensal' }, { l: 'LT', k: 'lt' }, { l: 'Check-in', k: null },
                        { l: 'DISC', k: null }, { l: 'ROI > 1', k: null }, { l: 'Contrato', k: null },
                      ].map(h => (
                        <th key={h.l || 'flag'} onClick={() => h.k && toggleSort(h.k as any)} style={{
                          textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.text3,
                          textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
                          cursor: h.k ? 'pointer' : 'default', userSelect: 'none',
                        }}>
                          {h.l}{h.k && sortKey === h.k ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${C.border2}` }}>
                        <td style={{ padding: '10px 14px', fontSize: 16 }}>{r.flag || '—'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>{r.cliente}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status || ''] || C.text3 }}>{r.status || '—'}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{r.jornada || '—'}{r.step ? ` · ${r.step}` : ''}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: C.text }}>{fmtR(r.recorrente)}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{fmtR(r.midia)}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{fmtR(r.ee_pontual)}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{fmtR(r.gmv_mensal)}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{fmtLt(r.lt)}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{r.freq_checkin || '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.text2 }}>{r.disc_pagador || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {r.roi_maior_1 ? (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                              background: r.roi_maior_1.toLowerCase() === 'sim' ? C.greenBg : C.redLight,
                              color: r.roi_maior_1.toLowerCase() === 'sim' ? C.green : C.red,
                            }}>{r.roi_maior_1}</span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text3, fontSize: 11 }} title={r.contrato || ''}>
                          {r.contrato || '—'}
                        </td>
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
