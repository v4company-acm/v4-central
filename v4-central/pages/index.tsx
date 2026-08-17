import { useState, useEffect } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'
import ClientForm from '../components/ClientForm'
import ClientDetail from '../components/ClientDetail'
import { roiRoasMeta, currentRoiCheck, suggestRoiRoasStatus } from '../lib/roiRoas'

const C = {
  bg: 'var(--bg-color)',
  card: 'var(--card-color)',
  border: 'var(--border-color)',
  border2: 'var(--border-light)',
  text: 'var(--text-main)',
  text2: 'var(--text-secondary)',
  text3: 'var(--text-muted)',
  red: '#FB2E0A', redLight: 'rgba(251, 46, 10, 0.1)', redMid: 'rgba(251, 46, 10, 0.2)',
  green: '#16A34A', greenBg: 'rgba(22, 163, 74, 0.1)',
  orange: '#EA580C', orangeBg: 'rgba(234, 88, 12, 0.1)',
  amber: '#D97706', amberBg: 'rgba(217, 119, 6, 0.1)',
  blue: '#2563EB', blueBg: 'rgba(37, 99, 235, 0.1)',
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const COLORS = ['#E6F1FB|#185FA5','#EEEDFE|#534AB7','#E1F5EE|#0F6E56','#FAEEDA|#854F0B','#FAECE7|#993C1D','#EAF3DE|#3B6D11','#FBEAF0|#993556','#F1EFE8|#5F5E5A']
function ini(n: string) { return (n||'?').split(' ').slice(0,2).map((w:string)=>w[0]).join('').toUpperCase() }
function badgeLbl(s: string) { return {ativo:'Ativo',atencao:'Em atenção',churn:'Churn risk',inativo:'Inativo'}[s as string]||s }
function fmtR(v: number) { return `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}` }

const TOOLS = [
  { label:'Ekyte',            icon:'🎯', href:'https://app.ekyte.com', color:C.blue,  bg:C.blueBg  },
  { label:'Check-in PPT',     icon:'📋', href:'/checkin',             color:C.red,   bg:C.redLight },
  { label:'Candidatura',      icon:'📝', href:'/candidatura',         color:C.green, bg:C.greenBg  },
  { label:'Produtividade',    icon:'⏱',  href:'/produtividade',       color:C.amber, bg:C.amberBg  },
  { label:'Performance',      icon:'📈', href:'/performance-page',    color:'#7c3aed', bg:'rgba(124,58,237,0.1)' },
  { label:'Gestão de Projetos', icon:'🗂', href:'https://docs.google.com/spreadsheets/d/1NgADoUY7r9RZyhnfXdRYcHbaPWfWYTp_AAYA9j3nnzM/edit', color:'#0F6E56', bg:'#E1F5EE' },
  { label:'Account Plan',     icon:'📑', href:'https://docs.google.com/spreadsheets/d/1qhy14Vhjifbyhgt1hAH_NLJ-FykZ95sr7nSJMUOBk68/edit', color:'#854F0B', bg:'#FAEEDA' },
]

async function sbQuery(table: string, qs = '') {
  if(!SB_URL || !SB_KEY) return []
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}&limit=500`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  })
  if(!r.ok) return []
  return r.json()
}

function parseLocalDate(str: string) {
  if(!str) return null
  const s = str.split('T')[0]
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y, m-1, d)
}

function getLastActivity(c: any) {
  const dates = [
    ...(c.anotacoes || []).map((a: any) => a.data),
    ...(c.reunioes || []).map((r: any) => r.data),
    ...(c.otimizacoes || []).map((o: any) => o.data)
  ].filter(Boolean).sort().reverse()
  if (dates.length === 0) return 'Sem registro'
  const last = new Date(dates[0])
  const hoje = new Date()
  const diff = Math.floor((hoje.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return `Há ${diff} dias`
}

function getRoiStatusKey(c: any) {
  const check = currentRoiCheck(c.roiRoasChecks)
  return check?.status || suggestRoiRoasStatus(c.metricasHistorico).status
}

export default function HomePage() {
  const [clients, setClients]   = useState<any[]>([])
  const [filter, setFilter]     = useState('todos')
  const [roiFilter, setRoiFilter] = useState('todos')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editClient, setEditClient] = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [tarefasHoje, setTarefasHoje]     = useState<any[]>([])
  const [tarefasAtraso, setTarefasAtraso] = useState<any[]>([])

  useEffect(() => { fetchClients(); fetchSuabase() }, [])

  async function fetchClients() {
    const res = await fetch('/api/clients')
    if (res.ok) setClients(await res.json())
  }

  async function fetchSuabase() {
    try {
      const hoje = new Date(); hoje.setHours(0,0,0,0)
      const [tarefas] = await Promise.all([
        sbQuery('ekyte_tarefas', 'situation=in.(10,20)&select=id,title,workspace,executor,due_date,situation'),
      ])
      const ativas = tarefas || []
      setTarefasHoje(ativas.filter((t: any) => parseLocalDate(t.due_date)?.getTime() === hoje.getTime()))
      setTarefasAtraso(ativas.filter((t: any) => (parseLocalDate(t.due_date) || hoje) < hoje))
    } catch(e) {}
  }

  async function handleSave(data: any) {
    setSaving(true)
    const method = editClient ? 'PUT' : 'POST'
    const url = editClient ? `/api/clients/${editClient.id}` : '/api/clients'
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
    if (res.ok) {
      const updated = await res.json()
      if (editClient) setClients(p => p.map(c => c.id === updated.id ? updated : c))
      else setClients(p => [...p, updated])
      if (selected?.id === updated.id) setSelected(updated)
    }
    setSaving(false); setShowForm(false); setEditClient(null)
  }

  async function handleUpdateClient(updated: any) {
    const res = await fetch(`/api/clients/${updated.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(updated) })
    if (res.ok) {
      const u = await res.json()
      setClients(p=>p.map(c=>c.id===u.id?u:c))
      setSelected(u)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente permanentemente?')) return
    await fetch(`/api/clients/${id}`, { method:'DELETE' })
    setClients(p => p.filter(c => c.id !== id))
    setSelected(null)
  }

  const resps = [...new Set(clients.flatMap(c => [c.gestor, c.account, c.estrategista].filter(Boolean)))]
  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const mq = !q || c.nome.toLowerCase().includes(q) || (c.gestor||'').toLowerCase().includes(q) || (c.account||'').toLowerCase().includes(q)
    const mf = filter === 'todos' || c.status === filter || (filter.startsWith('resp:') && [c.gestor, c.account, c.estrategista].includes(filter.slice(5)))
    const mr = roiFilter === 'todos' || getRoiStatusKey(c) === roiFilter
    return mq && mf && mr
  })

  const mrrTotal = clients.reduce((s, c) => s + (Number(c.mrr) || 0), 0)
  const totalMonetizado = clients.reduce((acc, c) => acc + (c.monetizacoes || []).reduce((sum: number, m: any) => sum + Number(m.valor || 0), 0), 0)
  const roiSaudavelCount = clients.filter(c => getRoiStatusKey(c) === 'saudavel').length
  const roiCriticoCount = clients.filter(c => getRoiStatusKey(c) === 'critico').length

  // Clientes com Google Ads configurado (para o card de Performance)
  const clientesComGA = clients.filter(c => c.id && [
    '3070f334-1ff5-468c-bb06-29cfb05f6a71',
    '56e9a96d-b6af-49c0-b04f-354c0c5aa3bb',
    '709ca941-21aa-429a-891d-1a8bbb133122',
  ].includes(c.id))

  return (
    <>
      <Head><title>Central de Clientes — V4</title></Head>
      <Layout
        title={selected ? selected.nome : 'Dashboard de Unidade'}
        topbarRight={
          selected ? (
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-sm" onClick={() => {setEditClient(selected); setShowForm(true)}}>Editar Cadastro</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>Excluir</button>
              <button className="btn btn-sm" style={{background:'#111', color:'#fff'}} onClick={() => setSelected(null)}>← Voltar ao Início</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => {setEditClient(null); setShowForm(true)}}>+ Novo Cliente</button>
          )
        }
      >
        {selected ? (
          <ClientDetail client={selected} onUpdate={handleUpdateClient} />
        ) : (
          <div style={{maxWidth:1400, margin:'0 auto'}}>

            {/* ── 1. KPI STRIP ── */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:16, marginBottom:24}}>
              {[
                { label:'Clientes Ativos',  value:clients.filter(c=>c.status==='ativo').length,    color:C.green,  bg:C.greenBg,  icon:'✓' },
                { label:'Em Atenção',       value:clients.filter(c=>c.status==='atencao').length,  color:C.amber,  bg:C.amberBg,  icon:'⚠' },
                { label:'Tarefas Hoje',     value:tarefasHoje.length,                              color:C.amber,  bg:C.amberBg,  icon:'📅' },
                { label:'Em Atraso',        value:tarefasAtraso.length, color:tarefasAtraso.length > 0 ? C.red : C.green, bg:tarefasAtraso.length > 0 ? C.redLight : C.greenBg, icon:'⏰' },
                { label:'ROI Saudável',     value:roiSaudavelCount,     color:C.green, bg:C.greenBg, icon:'🟢' },
                { label:'ROI Crítico',      value:roiCriticoCount,      color:roiCriticoCount > 0 ? C.red : C.green, bg:roiCriticoCount > 0 ? C.redLight : C.greenBg, icon:'🔴' },
                { label:'MRR Consolidado',  value:fmtR(mrrTotal),       isMoney:true, grad:'linear-gradient(135deg, #1e293b 0%, #334155 100%)' },
                { label:'Upsell (LTV Extra)',value:fmtR(totalMonetizado),isMoney:true, grad:'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' },
              ].map((k: any, i) => (
                <div key={i} style={{
                  background: k.grad || C.card, borderRadius:12, padding:'16px',
                  border: k.grad ? 'none' : `1px solid ${C.border}`,
                  boxShadow:'0 2px 10px rgba(0,0,0,0.04)',
                  display:'flex', flexDirection:'column', justifyContent:'space-between'
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                    <span style={{fontSize:10, fontWeight:700, color:k.grad ? 'rgba(255,255,255,0.7)' : C.text3, textTransform:'uppercase', letterSpacing:1}}>{k.label}</span>
                    {!k.grad && <div style={{width:24, height:24, borderRadius:6, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12}}>{k.icon}</div>}
                  </div>
                  <div style={{fontSize: k.isMoney ? 18 : 24, fontWeight:900, color: k.grad ? '#fff' : C.text}}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* ── 2. BARRA DE ATALHOS E FILTROS ── */}
            <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 20px', marginBottom:24, display:'flex', alignItems:'center', gap:20, flexWrap:'wrap'}}>
              <div style={{display:'flex', gap:8, borderRight:`1px solid ${C.border}`, paddingRight:20}}>
                {TOOLS.map((t, i) => (
                  <a key={i} href={t.href} target={t.href.startsWith('http')?'_blank':'_self'}
                    style={{width:36, height:36, borderRadius:8, background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', transition:'transform 0.2s', position:'relative'}}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform='scale(1.1)'
                      const tip = e.currentTarget.querySelector('.tooltip') as HTMLElement
                      if (tip) tip.style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform='scale(1)'
                      const tip = e.currentTarget.querySelector('.tooltip') as HTMLElement
                      if (tip) tip.style.opacity = '0'
                    }}
                    title={t.label}
                  >
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span className="tooltip" style={{
                      position:'absolute', bottom:-28, left:'50%', transform:'translateX(-50%)',
                      background:'#111', color:'#fff', fontSize:10, fontWeight:600,
                      padding:'3px 8px', borderRadius:6, whiteSpace:'nowrap',
                      opacity:0, transition:'opacity 0.15s', pointerEvents:'none', zIndex:10
                    }}>{t.label}</span>
                  </a>
                ))}
              </div>

              <div style={{flex:1, display:'flex', gap:12, alignItems:'center'}}>
                <input style={{flex:1, height:38, background:'#f1f1f1', border:'none', borderRadius:8, padding:'0 15px', fontSize:13, outline:'none'}}
                  placeholder="Pesquisar cliente ou responsável..."
                  value={search} onChange={e=>setSearch(e.target.value)} />

                <select style={{height:38, background:'#f1f1f1', border:'none', borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', cursor:'pointer'}}
                  value={filter} onChange={e=>setFilter(e.target.value)}>
                  <option value="todos">Todos os Status</option>
                  <option value="ativo">Ativos</option>
                  <option value="atencao">Em Atenção</option>
                  <option value="churn">Risco de Churn</option>
                </select>

                <select style={{height:38, background:'#f1f1f1', border:'none', borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', cursor:'pointer'}}
                  value={filter.startsWith('resp:') ? filter : ''} onChange={e=>setFilter(e.target.value)}>
                  <option value="todos">Todos os Responsáveis</option>
                  {resps.map(r => <option key={r} value={`resp:${r}`}>{r}</option>)}
                </select>

                <select style={{height:38, background:'#f1f1f1', border:'none', borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', cursor:'pointer'}}
                  value={roiFilter} onChange={e=>setRoiFilter(e.target.value)}>
                  <option value="todos">Todos os Status ROI/ROAS</option>
                  <option value="saudavel">🟢 ROI Saudável</option>
                  <option value="atencao">🟡 Atenção</option>
                  <option value="critico">🔴 Crítico</option>
                  <option value="implantacao">⚪ Em Implantação</option>
                </select>
              </div>
            </div>

            {/* ── 3. CARD DE PERFORMANCE ANALYTICS ── */}
            <div style={{background:'var(--brand-gradient)', borderRadius:12, padding:'20px 24px', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16}}>
              <div style={{display:'flex', alignItems:'center', gap:16}}>
                <div style={{width:44, height:44, borderRadius:10, background:'rgba(251,46,10,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>📈</div>
                <div>
                  <p style={{margin:0, fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.1em'}}>Módulo Analytics</p>
                  <p style={{margin:'2px 0 0', fontSize:16, fontWeight:800, color:'#fff'}}>Performance de Tráfego</p>
                  <p style={{margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.45)'}}>Google Ads · Funil · Benchmarks WordStream 2026</p>
                </div>
              </div>
              <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                {clientesComGA.slice(0,3).map(c => (
                  <a key={c.id} href={`/performance-page?cliente_id=${c.id}`}
                    style={{
                      padding:'8px 16px', borderRadius:8,
                      background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
                      color:'#fff', fontSize:12, fontWeight:600, textDecoration:'none',
                      transition:'all 0.2s', display:'flex', alignItems:'center', gap:6
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(251,46,10,0.2)'; e.currentTarget.style.borderColor='rgba(251,46,10,0.4)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)' }}
                  >
                    📊 {c.nome}
                  </a>
                ))}
                <a href="/performance-page"
                  style={{
                    padding:'8px 20px', borderRadius:8,
                    background:'#FB2E0A', border:'none',
                    color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none',
                    transition:'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='#D61A0E'}
                  onMouseLeave={e => e.currentTarget.style.background='#FB2E0A'}
                >
                  Abrir Analytics →
                </a>
              </div>
            </div>

            {/* ── 4. GRID DE CLIENTES ── */}
            {filtered.length === 0 ? (
              <div style={{padding:80, textAlign:'center', background:C.card, borderRadius:12, border:`1px dashed ${C.border2}`}}>
                <div style={{fontSize:40, marginBottom:16}}>🔍</div>
                <div style={{color:C.text2, fontWeight:600}}>Nenhum cliente encontrado com os filtros atuais.</div>
              </div>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(380px, 1fr))', gap:16}}>
                {filtered.map((c) => {
                  const [bg, fg] = COLORS[clients.indexOf(c) % COLORS.length].split('|')
                  const ltvExtra = (c.monetizacoes || []).reduce((sum: number, m: any) => sum + Number(m.valor || 0), 0)
                  const isExpiring = c.fimContrato && new Date(c.fimContrato).getTime() - new Date().getTime() < 30 * 864e5
                  const statusColor = c.status === 'ativo' ? C.green : c.status === 'churn' ? C.red : C.amber
                  const roiMeta = roiRoasMeta(getRoiStatusKey(c))

                  return (
                    <div key={c.id} onClick={() => setSelected(c)} style={{
                      display:'grid', gridTemplateColumns:'1fr auto',
                      background:C.card, borderRadius:12, border:`1px solid ${C.border}`,
                      cursor:'pointer', transition:'all 0.2s', position:'relative', overflow:'hidden'
                    }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red; e.currentTarget.style.transform='translateY(-2px)'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='translateY(0)'}}
                    >
                      {isExpiring && (
                        <div style={{position:'absolute', top:8, left:8, background:C.red, color:'#fff', fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:20, letterSpacing:0.5}}>
                          CONTRATO VENCENDO
                        </div>
                      )}

                      {/* ── ZONA ESQUERDA (narrativa) ── */}
                      <div style={{padding:20, minWidth:0}}>
                        <div style={{fontSize:9, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10}}>
                          {c.cohort || 'Sem Cohort'}
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:14}}>
                          <div style={{width:40, height:40, borderRadius:10, background:bg, color:fg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, flexShrink:0}}>
                            {ini(c.nome)}
                          </div>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:800, fontSize:15, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.nome}</div>
                            <div style={{fontSize:11, fontWeight:700, color:statusColor}}>{badgeLbl(c.status).toUpperCase()}</div>
                          </div>
                        </div>
                        <div style={{display:'inline-flex', alignItems:'center', gap:5, background:roiMeta.bg, color:roiMeta.color, fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, marginBottom:10}}>
                          <div style={{width:6, height:6, borderRadius:'50%', background:roiMeta.dot}} />
                          {roiMeta.label}
                        </div>
                        <div style={{display:'flex', flexDirection:'column', gap:3}}>
                          <span style={{fontSize:10, color:C.text3, fontWeight:600}}>Última atividade: <span style={{color:C.text2, fontWeight:700}}>{getLastActivity(c)}</span></span>
                          <span style={{fontSize:10, color:C.text3, fontWeight:600}}>{c.gestor || c.account || 'Sem Gestor'}</span>
                        </div>
                      </div>

                      {/* ── ZONA DIREITA (evidência / dado em destaque) ── */}
                      <div style={{
                        width:140, flexShrink:0, padding:'20px 16px',
                        background:C.redLight, borderLeft:`1px solid ${C.border}`,
                        display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'flex-end', gap:12
                      }}>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:9, fontWeight:700, color:C.red, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2}}>MRR</div>
                          <div style={{fontSize:18, fontWeight:900, color:C.text}}>{fmtR(c.mrr || 0)}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:9, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2}}>LTV Extra</div>
                          <div style={{fontSize:13, fontWeight:800, color:C.green}}>{fmtR(ltvExtra)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Layout>

      {showForm && (
        <div className="overlay" style={{background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)'}}
          onClick={e=>{if(e.target===e.currentTarget){setShowForm(false);setEditClient(null)}}}>
          <div className="modal" style={{borderRadius:16}}>
            <div className="modal-header">
              <h3 style={{fontWeight:800}}>{editClient ? '📝 Editar Cliente' : '🚀 Novo Cliente'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setShowForm(false);setEditClient(null)}}>✕</button>
            </div>
            <ClientForm initial={editClient} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditClient(null)}} loading={saving}/>
          </div>
        </div>
      )}
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
