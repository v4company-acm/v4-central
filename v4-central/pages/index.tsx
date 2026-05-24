import { useState, useEffect } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'
import ClientForm from '../components/ClientForm'
import ClientDetail from '../components/ClientDetail'

// ── Design tokens (mesma identidade do dash de produtividade) ────────────────
const C = {
  bg:'#F2F1EF', card:'#FFFFFF', border:'#E8E6E3', border2:'#D4D1CC',
  red:'#E8002D', redLight:'#FFF0F2', redMid:'#FFCDD5',
  text:'#111111', text2:'#5A5A5A', text3:'#9A9A9A',
  green:'#16A34A', greenBg:'#F0FDF4',
  orange:'#EA580C', orangeBg:'#FFF7ED',
  amber:'#D97706', amberBg:'#FFFBEB',
  blue:'#2563EB', blueBg:'#EFF6FF',
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const COLORS = ['#E6F1FB|#185FA5','#EEEDFE|#534AB7','#E1F5EE|#0F6E56','#FAEEDA|#854F0B','#FAECE7|#993C1D','#EAF3DE|#3B6D11','#FBEAF0|#993556','#F1EFE8|#5F5E5A']
function ini(n: string) { return (n||'?').split(' ').slice(0,2).map((w:string)=>w[0]).join('').toUpperCase() }
function badgeCls(s: string) { return {ativo:'badge-green',atencao:'badge-amber',churn:'badge-red',inativo:'badge-gray'}[s as string]||'badge-gray' }
function badgeLbl(s: string) { return {ativo:'Ativo',atencao:'Em atenção',churn:'Churn risk',inativo:'Inativo'}[s as string]||s }
function fmtR(v: number) { return `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}` }

const TOOLS = [
  { label:'Ekyte',         icon:'🎯', href:'https://app.ekyte.com',                 color:C.blue,   bg:C.blueBg   },
  { label:'Windsor.ai',    icon:'📊', href:'https://windsor.ai',                    color:'#7C3AED', bg:'#F5F3FF'  },
  { label:'Google Ads',    icon:'🔍', href:'https://ads.google.com',                color:C.green,  bg:C.greenBg  },
  { label:'Meta Ads',      icon:'📘', href:'https://business.facebook.com',         color:C.blue,   bg:C.blueBg   },
  { label:'Analytics',     icon:'📈', href:'https://analytics.google.com',          color:C.amber,  bg:C.amberBg  },
  { label:'Produtividade', icon:'⏱',  href:'/produtividade',                        color:C.red,    bg:C.redLight },
]

// ── Supabase helper ───────────────────────────────────────────────────────────
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

export default function HomePage() {
  const [clients, setClients]   = useState<any[]>([])
  const [filter, setFilter]     = useState('todos')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editClient, setEditClient] = useState<any>(null)
  const [saving, setSaving]     = useState(false)

  // Dados do Supabase para KPIs e alertas
  const [tarefasHoje, setTarefasHoje]     = useState<any[]>([])
  const [tarefasAtraso, setTarefasAtraso] = useState<any[]>([])
  const [horasSemana, setHorasSemana]     = useState(0)

  useEffect(() => { fetchClients() }, [])
  useEffect(() => { fetchSuabase() }, [])

  async function fetchClients() {
    const res = await fetch('/api/clients')
    if (res.ok) setClients(await res.json())
  }

  async function fetchSuabase() {
    try {
      const hoje = new Date(); hoje.setHours(0,0,0,0)
      const hojeStr = hoje.toISOString().split('T')[0]
      const semanaStr = new Date(hoje.getTime() - 7*864e5).toISOString().split('T')[0]

      const [tarefas, horas] = await Promise.all([
        sbQuery('ekyte_tarefas', 'situation=in.(10,20)&select=id,title,workspace,executor,due_date,situation'),
        sbQuery('ekyte_horas', `date=gte.${semanaStr}&select=minutes`),
      ])

      const hoje2 = new Date(); hoje2.setHours(0,0,0,0)
      const ativas = tarefas || []
      setTarefasHoje(ativas.filter((t: any) => {
        const d = parseLocalDate(t.due_date)
        return d && d.getTime() === hoje2.getTime()
      }))
      setTarefasAtraso(ativas.filter((t: any) => {
        const d = parseLocalDate(t.due_date)
        return d && d < hoje2
      }))
      const totalMin = (horas || []).reduce((s: number, h: any) => s + (h.minutes||0), 0)
      setHorasSemana(Math.round(totalMin / 60 * 10) / 10)
    } catch(e) { /* silencioso */ }
  }

  async function handleSave(data: any) {
    setSaving(true)
    if (editClient) {
      const res = await fetch(`/api/clients/${editClient.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
      if (res.ok) { const u = await res.json(); setClients(p=>p.map(c=>c.id===u.id?u:c)); setSelected(u) }
    } else {
      const res = await fetch('/api/clients', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
      if (res.ok) { const cr = await res.json(); setClients(p=>[...p,cr]) }
    }
    setSaving(false); setShowForm(false); setEditClient(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente?')) return
    await fetch(`/api/clients/${id}`, { method:'DELETE' })
    setClients(p=>p.filter(c=>c.id!==id))
    setSelected(null)
  }

  async function handleUpdateClient(updated: any) {
    const res = await fetch(`/api/clients/${updated.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(updated) })
    if (res.ok) { const u = await res.json(); setClients(p=>p.map(c=>c.id===u.id?u:c)); setSelected(u) }
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const mq = !q || c.nome.toLowerCase().includes(q) || (c.cohort||'').toLowerCase().includes(q) || (c.gestor||'').toLowerCase().includes(q) || (c.account||'').toLowerCase().includes(q)
    const mf = filter==='todos' || c.status===filter || (filter.startsWith('resp:') && [c.gestor,c.account,c.estrategista].includes(filter.slice(5)))
    return mq && mf
  })

  const resps = [...new Set(clients.flatMap(c=>[c.gestor,c.account,c.estrategista].filter(Boolean)))]
  const ativos   = clients.filter(c=>c.status==='ativo').length
  const atencao  = clients.filter(c=>c.status==='atencao').length
  const churn    = clients.filter(c=>c.status==='churn').length
  const mrrTotal = clients.reduce((s,c)=>s+(Number(c.mrr)||0),0)

  return (
    <>
      <Head><title>Clientes — V4 Central</title></Head>
      <Layout
        title={selected ? selected.nome : 'Central de Clientes'}
        topbarRight={
          selected
            ? <div style={{display:'flex',gap:8}}>
                <button className="btn btn-sm" onClick={()=>{setEditClient(selected);setShowForm(true)}}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={()=>handleDelete(selected.id)}>Excluir</button>
                <button className="btn btn-sm" onClick={()=>setSelected(null)}>← Voltar</button>
              </div>
            : <button className="btn btn-primary btn-sm" onClick={()=>{setEditClient(null);setShowForm(true)}}>+ Novo cliente</button>
        }
      >
        {selected ? (
          <ClientDetail client={selected} onUpdate={handleUpdateClient} />
        ) : (
          <div>

            {/* ── KPI Strip ────────────────────────────────────────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:20}}>
              {[
                { label:'Clientes Ativos',   value:ativos,                color:C.green,  bg:C.greenBg,   icon:'✓' },
                { label:'Em Atenção',         value:atencao,               color:C.amber,  bg:C.amberBg,   icon:'⚠' },
                { label:'Churn Risk',         value:churn,                 color:C.orange, bg:C.orangeBg,  icon:'!' },
                { label:'MRR Total',          value:fmtR(mrrTotal),        color:C.blue,   bg:C.blueBg,    icon:'$' },
                { label:'Tarefas Hoje',       value:tarefasHoje.length,    color:C.amber,  bg:C.amberBg,   icon:'📅' },
                { label:'Em Atraso',          value:tarefasAtraso.length,  color:tarefasAtraso.length>0?C.red:C.green, bg:tarefasAtraso.length>0?C.redLight:C.greenBg, icon:'⏰' },
              ].map((k,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
                  padding:'14px 16px',borderTop:`3px solid ${k.color}`,
                  boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <p style={{color:C.text3,fontSize:9,fontWeight:700,letterSpacing:1.5,
                      textTransform:'uppercase',margin:0}}>{k.label}</p>
                    <div style={{width:26,height:26,borderRadius:7,background:k.bg,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>{k.icon}</div>
                  </div>
                  <p style={{color:C.text,fontSize:22,fontWeight:900,margin:0,letterSpacing:'-0.5px'}}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* ── Atalhos de ferramentas ────────────────────────────────────── */}
            <div style={{marginBottom:20}}>
              <p style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:2,
                textTransform:'uppercase',margin:'0 0 10px',display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:3,height:12,background:C.red,borderRadius:2,display:'inline-block'}}/>
                Acesso rápido
              </p>
              <div style={{display:'flex',gap:10}}>
                {TOOLS.map((t,i)=>(
                  <a key={i} href={t.href} target={t.href.startsWith('http')?'_blank':'_self'} rel="noreferrer"
                    style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
                      padding:'12px 18px',textDecoration:'none',display:'flex',alignItems:'center',
                      gap:8,flex:1,transition:'all .15s',boxShadow:'0 1px 3px rgba(0,0,0,.04)',
                      cursor:'pointer'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=t.color;(e.currentTarget as HTMLElement).style.background=t.bg}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border;(e.currentTarget as HTMLElement).style.background=C.card}}>
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span style={{color:C.text,fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>{t.label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* ── Alertas (se houver) ───────────────────────────────────────── */}
            {(tarefasAtraso.length > 0 || tarefasHoje.length > 0) && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
                {tarefasAtraso.length > 0 && (
                  <div style={{background:C.redLight,border:`1px solid ${C.redMid}`,borderRadius:10,padding:'14px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      <span style={{fontSize:14}}>🔴</span>
                      <p style={{color:C.red,fontSize:11,fontWeight:800,margin:0,letterSpacing:.5}}>
                        {tarefasAtraso.length} TAREFAS EM ATRASO
                      </p>
                    </div>
                    <div style={{maxHeight:100,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
                      {tarefasAtraso.slice(0,5).map((t:any,i:number)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',
                          background:'rgba(255,255,255,.6)',borderRadius:6,padding:'5px 8px'}}>
                          <span style={{color:C.text,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',
                            whiteSpace:'nowrap',maxWidth:200}}>{t.title||'—'}</span>
                          <span style={{color:C.text3,fontSize:10,flexShrink:0,marginLeft:8}}>{t.workspace}</span>
                        </div>
                      ))}
                      {tarefasAtraso.length > 5 && <p style={{color:C.red,fontSize:10,margin:'4px 0 0',textAlign:'center'}}>
                        +{tarefasAtraso.length-5} mais → <a href="/produtividade" style={{color:C.red}}>ver no dashboard</a>
                      </p>}
                    </div>
                  </div>
                )}
                {tarefasHoje.length > 0 && (
                  <div style={{background:C.amberBg,border:`1px solid ${C.amber}33`,borderRadius:10,padding:'14px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      <span style={{fontSize:14}}>🟡</span>
                      <p style={{color:C.amber,fontSize:11,fontWeight:800,margin:0,letterSpacing:.5}}>
                        {tarefasHoje.length} TAREFAS PARA HOJE
                      </p>
                    </div>
                    <div style={{maxHeight:100,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
                      {tarefasHoje.slice(0,5).map((t:any,i:number)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',
                          background:'rgba(255,255,255,.6)',borderRadius:6,padding:'5px 8px'}}>
                          <span style={{color:C.text,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',
                            whiteSpace:'nowrap',maxWidth:200}}>{t.title||'—'}</span>
                          <span style={{color:C.text3,fontSize:10,flexShrink:0,marginLeft:8}}>{t.executor?.split(' ')[0]}</span>
                        </div>
                      ))}
                      {tarefasHoje.length > 5 && <p style={{color:C.amber,fontSize:10,margin:'4px 0 0',textAlign:'center'}}>
                        +{tarefasHoje.length-5} mais → <a href="/produtividade" style={{color:C.amber}}>ver no dashboard</a>
                      </p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Clientes ──────────────────────────────────────────────────── */}
            <div style={{display:'flex',gap:20}}>
              {/* Sidebar de filtros */}
              <div style={{width:180,flexShrink:0}}>
                <input className="sb-search" value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Buscar..." style={{width:'100%'}} />
                <div className="sb-section">Status</div>
                {[['todos','#888780','Todos'],['ativo','#639922','Ativos'],['atencao','#EF9F27','Em atenção'],['churn','#E24B4A','Churn risk']].map(([v,c,l])=>(
                  <div key={v} className={`sb-item ${filter===v?'active':''}`} onClick={()=>setFilter(v as string)}>
                    <div className="sb-dot" style={{background:c as string}}/>{l}
                  </div>
                ))}
                {resps.length>0 && <>
                  <div className="sb-section">Responsáveis</div>
                  {resps.map(r=>(
                    <div key={r} className={`sb-item ${filter===`resp:${r}`?'active':''}`}
                      onClick={()=>setFilter(`resp:${r}`)} style={{fontSize:12}}>{r}</div>
                  ))}
                </>}
              </div>

              {/* Grid de clientes */}
              <div style={{flex:1}}>
                {filtered.length===0
                  ? <div className="empty">Nenhum cliente encontrado.<br/>Clique em "+ Novo cliente" para começar.</div>
                  : <div className="clients-grid">
                      {filtered.map((c) => {
                        const [bg,fg] = COLORS[clients.indexOf(c)%COLORS.length].split('|')
                        const mrr = Number(c.mrr)||0
                        return (
                          <div key={c.id} className={`client-card ${selected?.id===c.id?'active':''}`}
                            onClick={()=>setSelected(c)}
                            style={{position:'relative',overflow:'hidden'}}>
                            {/* Indicador de status lateral */}
                            <div style={{position:'absolute',left:0,top:0,bottom:0,width:3,
                              background:c.status==='ativo'?C.green:c.status==='atencao'?C.amber:c.status==='churn'?C.red:'#ccc',
                              borderRadius:'10px 0 0 10px'}}/>
                            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,paddingLeft:6}}>
                              <div className="card-avatar" style={{background:bg,color:fg}}>{ini(c.nome)}</div>
                              <div style={{minWidth:0}}>
                                <div style={{fontWeight:600,fontSize:13,overflow:'hidden',
                                  textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nome}</div>
                                <div style={{fontSize:11,color:C.text3}}>{c.cohort||'—'}</div>
                              </div>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingLeft:6}}>
                              <span className={`badge ${badgeCls(c.status)}`}>{badgeLbl(c.status)}</span>
                              <div style={{textAlign:'right'}}>
                                {mrr>0 && <div style={{fontSize:11,fontWeight:700,color:C.green}}>{fmtR(mrr)}</div>}
                                <div style={{fontSize:10,color:C.text3}}>{c.gestor||c.account||''}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                }
              </div>
            </div>
          </div>
        )}
      </Layout>

      {showForm && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setShowForm(false);setEditClient(null)}}}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editClient?'Editar cliente':'Novo cliente'}</h3>
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
