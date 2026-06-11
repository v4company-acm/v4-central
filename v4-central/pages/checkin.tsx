import { useState, useEffect } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'

const SB_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SB_ANON   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const WEBHOOK   = 'https://primary-production-3b127.up.railway.app/webhook/ppt-intake'

const C = {
  bg:'#F2F1EF', card:'#FFFFFF', border:'#E8E6E3', border2:'#D4D1CC',
  red:'#E8002D', redLight:'#FFF0F2', redMid:'#FFCDD5',
  text:'#111111', text2:'#5A5A5A', text3:'#9A9A9A',
  green:'#16A34A', greenBg:'#F0FDF4',
  orange:'#EA580C', orangeBg:'#FFF7ED',
  amber:'#D97706', amberBg:'#FFFBEB',
  blue:'#2563EB', blueBg:'#EFF6FF',
}

async function sbFetch(path: string, opts: RequestInit = {}) {
  const { headers: extraHeaders, ...rest } = opts as any
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    headers: {
      apikey: SB_ANON,
      Authorization: `Bearer ${SB_ANON}`,
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
    ...rest,
  })
  return res.json()
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }

const PERIODS = [
  { label:'Última semana',   days:7    },
  { label:'Últimas 2 sem.',  days:14   },
  { label:'Mês atual',       month:true},
]

const STATUS_MAP: Record<string, { label:string; color:string }> = {
  done:       { label:'Pronto',    color: C.green  },
  processing: { label:'Gerando…',  color: C.amber  },
  error:      { label:'Erro',      color: C.orange },
  pending:    { label:'Na fila',   color: C.text3  },
}

export default function CheckinPage() {
  const [clients,  setClients]  = useState<any[]>([])
  const [history,  setHistory]  = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [start,    setStart]    = useState('')
  const [end,      setEnd]      = useState('')
  const [email,    setEmail]    = useState('')
  const [period,   setPeriod]   = useState(-1)
  const [loading,  setLoading]  = useState(false)
  const [feedback, setFeedback] = useState<{type:'success'|'error'; msg:string}|null>(null)

  useEffect(() => { loadClients(); loadHistory() }, [])
  useEffect(() => {
    const t = setInterval(loadHistory, 15000)
    return () => clearInterval(t)
  }, [])

  async function loadClients() {
    try {
      const data = await sbFetch('/clientes?select=id,nome&order=nome')
      setClients(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function loadHistory() {
    try {
      const data = await sbFetch(
        '/report_requests?select=id,created_at,period_start,period_end,status,ppt_url,clientes(nome)&order=created_at.desc&limit=8'
      )
      setHistory(Array.isArray(data) ? data : [])
    } catch {}
  }

  function applyPeriod(idx: number) {
    setPeriod(idx)
    const today = new Date(); today.setHours(0,0,0,0)
    const p = PERIODS[idx]
    if ((p as any).month) {
      const s = new Date(today.getFullYear(), today.getMonth(), 1)
      const e = new Date(today); e.setDate(today.getDate()-1)
      setStart(fmt(s)); setEnd(fmt(e))
    } else {
      const s = new Date(today); s.setDate(today.getDate()-(p.days as number))
      const e = new Date(today); e.setDate(today.getDate()-1)
      setStart(fmt(s)); setEnd(fmt(e))
    }
  }

  async function handleSubmit() {
    // 🔴 TRAVA DEFINITIVA: Se o React já estiver processando um clique, ele ignora o segundo
    if (loading) return;

    setFeedback(null)
    if (!clientId) return setFeedback({type:'error', msg:'Selecione um cliente.'})
    if (!start||!end) return setFeedback({type:'error', msg:'Informe o período.'})
    if (start>end) return setFeedback({type:'error', msg:'Data de início não pode ser maior que a final.'})
    if (!email) return setFeedback({type:'error', msg:'Informe seu e-mail.'})

    setLoading(true)
    try {
      const sbRes = await sbFetch('/report_requests?select=id', {
        method: 'POST',
        headers: { Prefer:'return=representation' },
        body: JSON.stringify({ client_id:clientId, period_start:start, period_end:end,
          requested_by_email:email, channels:'{"google"}', status:'pending' }),
      })
      const inserted = Array.isArray(sbRes) ? sbRes[0] : sbRes
      if (!inserted?.id) throw new Error(JSON.stringify(inserted))

      const wh = await fetch(WEBHOOK, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id:inserted.id, client_id:clientId,
          period_start:start, period_end:end, requested_by_email:email }),
      })
      if (!wh.ok) throw new Error('Falha ao acionar automação.')

      setFeedback({type:'success', msg:'Solicitação enviada! Você receberá um e-mail com o link assim que o relatório estiver pronto.'})
      setClientId(''); setStart(''); setEnd(''); setEmail(''); setPeriod(-1)
      loadHistory()
    } catch(e:any) {
      setFeedback({type:'error', msg: e.message||'Erro inesperado. Tente novamente.'})
    } finally { setLoading(false) }
  }

  return (
    <>
      <Head><title>Check-in PPT — V4 Central</title></Head>
      <Layout title="Check-in PPT">
        <div style={{display:'flex',gap:24,alignItems:'flex-start'}}>

          {/* ── FORMULÁRIO ─────────────────────────────────────────────────── */}
          <div style={{flex:1,maxWidth:520}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
              overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>

              {/* Cabeçalho */}
              <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <div style={{width:3,height:16,background:C.red,borderRadius:2}}/>
                  <h2 style={{color:C.text,fontSize:15,fontWeight:800,margin:0}}>Solicitar Check-in</h2>
                </div>
                <p style={{color:C.text3,fontSize:12,margin:0}}>
                  Preencha os dados e o relatório será gerado automaticamente.
                </p>
              </div>

              {/* Corpo */}
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:18}}>

                {/* Feedback */}
                {feedback && (
                  <div style={{background:feedback.type==='success'?C.greenBg:C.redLight,
                    border:`1px solid ${feedback.type==='success'?C.green+'33':C.redMid}`,
                    borderRadius:8,padding:'12px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
                    <span style={{fontSize:16,flexShrink:0}}>{feedback.type==='success'?'✅':'⚠️'}</span>
                    <p style={{color:feedback.type==='success'?C.green:C.red,fontSize:13,margin:0,fontWeight:500}}>
                      {feedback.msg}
                    </p>
                  </div>
                )}

                {/* Cliente */}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>
                    Cliente
                  </label>
                  <select value={clientId} onChange={e=>setClientId(e.target.value)} style={{
                    width:'100%',height:42,border:`1px solid ${C.border2}`,borderRadius:8,
                    padding:'0 12px',fontSize:13,color:clientId?C.text:C.text3,
                    background:C.bg,fontFamily:'inherit',outline:'none',cursor:'pointer',appearance:'none'}}>
                    <option value="">Selecione o cliente…</option>
                    {clients.map((c:any)=>(
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Período rápido */}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <label style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>
                    Período
                  </label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {PERIODS.map((p,i)=>(
                      <button key={i} onClick={()=>applyPeriod(i)} style={{
                        fontSize:12,fontWeight:700,padding:'6px 14px',borderRadius:20,
                        border:`1px solid ${period===i?C.red:C.border2}`,
                        background:period===i?C.red:C.card,
                        color:period===i?'#fff':C.text2,
                        cursor:'pointer',transition:'all .12s',fontFamily:'inherit'}}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Datas */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[{label:'De',val:start,set:setStart},{label:'Até',val:end,set:setEnd}].map((f,i)=>(
                    <div key={i} style={{display:'flex',flexDirection:'column',gap:6}}>
                      <label style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>
                        {f.label}
                      </label>
                      <input type="date" value={f.val} onChange={e=>f.set(e.target.value)} style={{
                        height:42,border:`1px solid ${C.border2}`,borderRadius:8,padding:'0 12px',
                        fontSize:13,color:C.text,background:C.bg,fontFamily:'inherit',outline:'none'}}/>
                    </div>
                  ))}
                </div>

                {/* Email */}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>
                    Seu e-mail
                  </label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    placeholder="acc@v4company.com" style={{
                    height:42,border:`1px solid ${C.border2}`,borderRadius:8,padding:'0 12px',
                    fontSize:13,color:C.text,background:C.bg,fontFamily:'inherit',outline:'none',width:'100%'}}/>
                </div>

                {/* Botão */}
                <button onClick={handleSubmit} disabled={loading} style={{
                  width:'100%',height:44,background:loading?C.text3:C.red,color:'#fff',
                  border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:loading?'not-allowed':'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  fontFamily:'inherit',transition:'background .15s'}}>
                  {loading && (
                    <span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',
                      borderTopColor:'#fff',borderRadius:'50%',
                      animation:'spin 0.7s linear infinite',display:'inline-block'}}/>
                  )}
                  {loading ? 'Gerando…' : 'Gerar relatório'}
                </button>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            </div>
          </div>

          {/* ── HISTÓRICO ──────────────────────────────────────────────────── */}
          <div style={{width:300,flexShrink:0}}>
            <p style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:2,
              textTransform:'uppercase',margin:'0 0 12px',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:3,height:12,background:C.red,borderRadius:2,display:'inline-block'}}/>
              Solicitações recentes
            </p>

            {history.length===0 ? (
              <div style={{background:C.card,border:`1px dashed ${C.border2}`,borderRadius:10,
                padding:'32px 16px',textAlign:'center',color:C.text3,fontSize:13}}>
                Nenhuma solicitação ainda.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {history.map((r:any)=>{
                  const st = STATUS_MAP[r.status] || {label:r.status, color:C.text3}
                  const clientName = r.clientes?.nome || '—'
                  return (
                    <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,
                      borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                        <span style={{color:C.text,fontSize:13,fontWeight:700,overflow:'hidden',
                          textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:190}}>{clientName}</span>
                        <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                          <div style={{width:7,height:7,borderRadius:'50%',background:st.color,
                            animation:r.status==='processing'?'pulse 1s ease-in-out infinite':undefined}}/>
                          <span style={{color:st.color,fontSize:10,fontWeight:700}}>{st.label}</span>
                        </div>
                      </div>
                      <p style={{color:C.text3,fontSize:11,margin:'0 0 6px',fontFamily:'monospace'}}>
                        {r.period_start} → {r.period_end}
                      </p>
                      {r.ppt_url
                        ? <a href={r.ppt_url} target="_blank" rel="noreferrer"
                            style={{color:C.red,fontSize:12,fontWeight:700,textDecoration:'none'}}>
                            Abrir apresentação ↗
                          </a>
                        : <span style={{color:C.text3,fontSize:11}}>{st.label}</span>
                      }
                    </div>
                  )
                })}
              </div>
            )}
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
          </div>

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
