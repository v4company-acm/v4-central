import MetricsDashboard from './MetricsDashboard'
import HealthPanel from './HealthPanel'
import { healthMeta } from '../lib/health'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

function fmtDate(d: string) { if(!d||d==='-') return '—'; try{const[y,m,day]=d.split('-');return`${day}/${m}/${y}`}catch{return d} }
function fmtR(v: any) { if(!v&&v!==0) return '—'; return 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) }
function fmtNum(v: any) { if(!v&&v!==0) return '—'; return Number(v).toLocaleString('pt-BR') }

// 🔴 ABAS REFORMULADAS: Otimizações, Reuniões e Anotações unificadas em "Atividades"
const TABS = [
  {k:'dados',l:'Visão Geral'},
  {k:'health',l:'Health Score'},
  {k:'atividades',l:'Histórico (Feed)'},
  {k:'metricas',l:'Métricas e Dash'},
  {k:'monetizacoes',l:'Monetizações'},
  {k:'criativos',l:'Criativos'},
  {k:'equipe',l:'Equipe'},
  {k:'links',l:'Links'},
]

interface Props { client: any; onUpdate: (c: any) => void; initialTab?: string }

export default function ClientDetail({ client: c, onUpdate, initialTab }: Props) {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'admin'
  const [tab, setTab] = useState(initialTab || 'dados')
  const [equipeEdit, setEquipeEdit] = useState(false)
  const [equipeFields, setEquipeFields] = useState({ estrategista: '', gestor: '', account: '', closer: '', sdr: '' })
  const [itemForm, setItemForm] = useState<any>(null)
  const [ifields, setIfields] = useState<any>({})
  const [metForm, setMetForm] = useState(false)
  const [mfields, setMfields] = useState<any>({roas:'',cpl:'',leads:'',invest:'',roi:'',vendas:'',totalVendido:'',data:new Date().toISOString().slice(0,10)})

  const servicos: string[] = c.servicos || []
  const historico: any[] = c.metricasHistorico || []

  // Health Score — puxa o check de Projeto mais recente só pro tile do cabeçalho
  // (o restante do detalhamento vive dentro do HealthPanel, na aba dedicada)
  const [latestHealth, setLatestHealth] = useState<any>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/health-checks?cliente_id=${c.id}`)
      .then(r => r.ok ? r.json() : { checks: [] })
      .then(d => { if (!cancelled) setLatestHealth((d.checks || []).find((x: any) => x.dominio === 'projeto') || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [c.id])
  const healthTileMeta = healthMeta(latestHealth?.status)

  // Melhores valores do histórico
  const bestRoas = historico.length ? Math.max(...historico.map((m:any)=>parseFloat(m.roas)||0)) : null
  const bestRoi = historico.length ? Math.max(...historico.map((m:any)=>parseFloat(m.roi)||0)) : null

  function addItem(field: string, item: any) {
    onUpdate({ ...c, [field]: [item, ...(c[field]||[])] })
  }
  function removeItem(field: string, idx: number, realField?: string) {
    if (!confirm('Remover este registro permanentemente?')) return
    const targetField = realField || field
    const arr = [...(c[targetField]||[])]
    arr.splice(idx, 1)
    onUpdate({ ...c, [targetField]: arr })
  }

  function abrirEquipeEdit() {
    setEquipeFields({
      estrategista: c.estrategista || '', gestor: c.gestor || '', account: c.account || '',
      closer: c.closer || '', sdr: c.sdr || '',
    })
    setEquipeEdit(true)
  }
  function salvarEquipe() {
    onUpdate({ ...c, ...equipeFields })
    setEquipeEdit(false)
  }

  function salvarMetrica() {
    if (!mfields.data) return alert('Informe a data.')
    const novaMetrica = { ...mfields, savedAt: new Date().toISOString() }
    const novo = [novaMetrica, ...historico]
    onUpdate({ ...c, metricasHistorico: novo, metricas: mfields })
    setMetForm(false)
    setMfields({roas:'',cpl:'',leads:'',invest:'',roi:'',vendas:'',totalVendido:'',data:new Date().toISOString().slice(0,10)})
  }

  // ── LÓGICA DO COCKPIT (Cálculos para o painel superior) ──
  const totalMonetizado = (c.monetizacoes||[]).reduce((sum:number,m:any)=>sum+Number(m.valor||0),0)
  
  // Calcula dias para vencer o contrato
  let diasVencimento = null
  let corVencimento = 'var(--text-main)'
  if (c.fimContrato && c.fimContrato !== '-') {
    const hoje = new Date()
    const fim = new Date(c.fimContrato)
    const diffTime = fim.getTime() - hoje.getTime()
    diasVencimento = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diasVencimento < 30) corVencimento = '#FB2E0A' // Vermelho
    else if (diasVencimento < 60) corVencimento = '#D97706' // Amarelo
    else corVencimento = '#16A34A' // Verde
  }

  // ── LÓGICA DA TIMELINE UNIFICADA ──
  const timeline = [
    ...(c.otimizacoes||[]).map((i:any, idx:number)=>({...i, _type:'otimizacao', _idx:idx})),
    ...(c.reunioes||[]).map((i:any, idx:number)=>({...i, _type:'reuniao', _idx:idx})),
    ...(c.anotacoes||[]).map((i:any, idx:number)=>({...i, _type:'anotacao', _idx:idx}))
  ].sort((a,b) => new Date(b.data || '2000-01-01').getTime() - new Date(a.data || '2000-01-01').getTime())

  return (
    <div className="detail-card">

      {/* ── 1. HEADER (identidade + cockpit) ── */}
      <div className="detail-header" style={{flexDirection:'column', alignItems:'stretch', gap:20}}>
        <div>
          <div style={{fontSize:11, fontWeight:700, color:'var(--red)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6}}>
            {c.cohort || 'Cliente'} · V4
          </div>
          <div style={{fontSize:28, fontWeight:800, color:'var(--text-main)', letterSpacing:'-0.01em'}}>{c.nome}</div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'auto repeat(4, 1fr)', gap:14, alignItems:'stretch'}}>
          {/* MRR — card-herói */}
          <div style={{background:'var(--brand-gradient)', borderRadius:12, padding:'14px 20px', minWidth:150, display:'flex', flexDirection:'column', justifyContent:'center'}}>
            <span style={{fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'.08em'}}>MRR Atual</span>
            <span style={{fontSize:22, fontWeight:900, color:'#fff'}}>{fmtR(c.mrr)}</span>
          </div>

          {/* Health Score */}
          <div onClick={()=>setTab('health')} style={{display:'flex', flexDirection:'column', gap:4, justifyContent:'center', cursor:'pointer'}}>
            <span style={{fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1}}>Health Score (Projeto)</span>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{width:10, height:10, borderRadius:'50%', background:healthTileMeta.color}} />
              <span style={{fontSize:16, fontWeight:800, color:healthTileMeta.color}}>{latestHealth ? `${healthTileMeta.label} · ${latestHealth.score}` : healthTileMeta.label}</span>
            </div>
            {!latestHealth && <span style={{fontSize:11, fontWeight:600, color:'var(--text-muted)', marginTop:-4}}>(ainda sem avaliação registrada)</span>}
          </div>

          {/* Status */}
          <div style={{display:'flex', flexDirection:'column', gap:4, justifyContent:'center'}}>
            <span style={{fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1}}>Status do Projeto</span>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{width:10, height:10, borderRadius:'50%', background:c.status==='ativo'?'#16A34A':c.status==='atencao'?'#D97706':c.status==='churn'?'#FB2E0A':'var(--text-muted)'}} />
              <span style={{fontSize:16, fontWeight:800, color:'var(--text-main)', textTransform:'capitalize'}}>{c.status || 'Não definido'}</span>
            </div>
          </div>

          {/* Fim do Contrato */}
          <div style={{display:'flex', flexDirection:'column', gap:4, justifyContent:'center'}}>
            <span style={{fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1}}>Vencimento do Contrato</span>
            <span style={{fontSize:16, fontWeight:800, color:corVencimento}}>
              {c.fimContrato ? fmtDate(c.fimContrato) : 'Não informado'}
            </span>
            {diasVencimento !== null && (
              <span style={{fontSize:11, fontWeight:600, color:corVencimento, marginTop:-4}}>
                ({diasVencimento > 0 ? `Faltam ${diasVencimento} dias` : `Venceu há ${Math.abs(diasVencimento)} dias`})
              </span>
            )}
          </div>

          {/* Monetização */}
          <div style={{display:'flex', flexDirection:'column', gap:4, justifyContent:'center'}}>
            <span style={{fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1}}>Monetizações Extras</span>
            <span style={{fontSize:16, fontWeight:800, color:'#16A34A'}}>{fmtR(totalMonetizado)}</span>
          </div>
        </div>
      </div>

      {/* ── 2. NAVEGAÇÃO DE ABAS ── */}
      <div className="detail-tabs">
        {TABS.map(t => (
          <button key={t.k} onClick={()=>setTab(t.k)} className={`detail-tab${tab === t.k ? ' active' : ''}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── 3. CORPO DO COMPONENTE ── */}
      <div className="detail-body">

        {/* ABA: DADOS E VISÃO GERAL */}
        {tab==='dados' && <>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:40}}>
            <div>
              <div className="sec-title" style={{fontSize:16, borderBottom:'2px solid var(--border-color)', paddingBottom:8, marginBottom:16}}>Informações de Contato</div>
              <div className="info-row"><span className="info-key">Stakeholder</span><span className="info-val">{c.stakeholder||'—'}</span></div>
              <div className="info-row"><span className="info-key">Telefone</span><span className="info-val">{c.telefone||'—'}</span></div>
              <div className="info-row"><span className="info-key">Instagram</span><span className="info-val">{c.instagram&&c.instagram!=='-'?<a href={c.instagram} target="_blank" rel="noreferrer" style={{color:'#2563EB'}}>Abrir Perfil</a>:'—'}</span></div>
              <div className="info-row"><span className="info-key">Site</span><span className="info-val">{c.site&&c.site!=='-'?<a href={c.site} target="_blank" rel="noreferrer" style={{color:'#2563EB'}}>Acessar Site</a>:'—'}</span></div>
            </div>
            <div>
              <div className="sec-title" style={{fontSize:16, borderBottom:'2px solid var(--border-color)', paddingBottom:8, marginBottom:16}}>Contexto do Projeto</div>
              <div className="info-row"><span className="info-key">Data de Entrada</span><span className="info-val">{fmtDate(c.dataEntrada)}</span></div>
              <div className="info-row"><span className="info-key">Cohort</span><span className="info-val">{c.cohort||'—'}</span></div>
              <div className="info-row"><span className="info-key">Canais de Mídia</span><span className="info-val">{c.canais||'—'}</span></div>
            </div>
          </div>

          <div style={{marginTop:24}}>
            <div className="sec-title" style={{fontSize:16, borderBottom:'2px solid var(--border-color)', paddingBottom:8, marginBottom:16}}>Serviços Contratados</div>
            {servicos.length === 0 ? (
              <div style={{fontSize:13, color:'var(--text-muted)'}}>Nenhum serviço cadastrado — edite o cadastro pra listar o que está incluso no contrato.</div>
            ) : (
              <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                {servicos.map(s => (
                  <span key={s} style={{background:'var(--hover-bg)', border:'1px solid var(--border-color)', borderRadius:20, padding:'6px 14px', fontSize:13, fontWeight:600, color:'var(--text-main)'}}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {c.descricao&&c.descricao!=='-'&&<div style={{marginTop:24, background:'var(--hover-bg)', padding:16, borderRadius:8, borderLeft:'4px solid var(--border-color)'}}><strong style={{display:'block', marginBottom:4}}>Sobre o projeto:</strong>{c.descricao}</div>}
          {c.promessa&&c.promessa!=='-'&&<div style={{marginTop:12, background:'rgba(251,46,10,0.08)', padding:16, borderRadius:8, borderLeft:'4px solid #FB2E0A'}}><strong style={{display:'block', marginBottom:4, color:'#FB2E0A'}}>Alinhamento e Promessas:</strong>{c.promessa}</div>}
        </>}

        {/* ABA: HEALTH SCORE */}
        {tab==='health' && (
          <HealthPanel client={c} onUpdateClient={onUpdate} />
        )}

        {/* ABA: HISTÓRICO (TIMELINE UNIFICADA) */}
        {tab==='atividades' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
            <div className="sec-title" style={{margin:0, fontSize:16}}>Feed de Atividades</div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-sm" style={{background:'#EFF6FF', color:'#2563EB', borderColor:'#BFDBFE'}} onClick={()=>{setIfields({texto:'',autor:'',data:new Date().toISOString().slice(0,10)});setItemForm('anotacao')}}>+ Anotação</button>
              <button className="btn btn-sm" style={{background:'#FFFBEB', color:'#D97706', borderColor:'#FDE68A'}} onClick={()=>{setIfields({titulo:'',data:new Date().toISOString().slice(0,10),participantes:'',resumo:''});setItemForm('reuniao')}}>+ Reunião</button>
              <button className="btn btn-sm" style={{background:'#F0FDF4', color:'#16A34A', borderColor:'#BBF7D0'}} onClick={()=>{setIfields({titulo:'',desc:'',resultado:'',data:new Date().toISOString().slice(0,10)});setItemForm('otimizacao')}}>+ Otimização</button>
            </div>
          </div>

          {timeline.length === 0 ? <div className="empty">Nenhuma atividade registrada ainda para este cliente.</div> : (
            <div style={{position:'relative', paddingLeft:16}}>
              {/* Linha vertical da timeline */}
              <div style={{position:'absolute', top:10, bottom:10, left:23, width:2, background:'var(--border-color)'}} />

              {timeline.map((item:any, i:number) => {
                const isReuniao = item._type === 'reuniao';
                const isOtimiza = item._type === 'otimizacao';

                return (
                  <div key={i} style={{display:'flex', gap:16, marginBottom:24, position:'relative'}}>
                    {/* Ícone bolinha */}
                    <div style={{width:16, height:16, borderRadius:'50%', zIndex:2, marginTop:4, flexShrink:0,
                      background: isReuniao ? '#D97706' : isOtimiza ? '#16A34A' : '#2563EB',
                      border:'3px solid var(--card-color)', boxShadow:'0 0 0 1px var(--border-color)'}} />

                    {/* Card do conteúdo */}
                    <div style={{flex:1, background:'var(--hover-bg)', border:'1px solid var(--border-color)', borderRadius:8, padding:16, transition:'all 0.2s'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--card-color)')} onMouseLeave={e=>(e.currentTarget.style.background='var(--hover-bg)')}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <span style={{fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, textTransform:'uppercase',
                            background: isReuniao ? '#FFFBEB' : isOtimiza ? '#F0FDF4' : '#EFF6FF',
                            color: isReuniao ? '#D97706' : isOtimiza ? '#16A34A' : '#2563EB',
                          }}>
                            {isReuniao ? 'Reunião' : isOtimiza ? 'Otimização' : 'Anotação'}
                          </span>
                          <span style={{fontSize:12, color:'var(--text-muted)', fontWeight:600}}>{fmtDate(item.data)}</span>
                        </div>
                        <button style={{background:'none', border:'none', color:'#FB2E0A', cursor:'pointer', fontSize:14}} onClick={()=>removeItem(item._type==='otimizacao'?'otimizacoes':item._type==='reuniao'?'reunioes':'anotacoes', item._idx)}>×</button>
                      </div>

                      <div style={{fontSize:15, fontWeight:700, color:'var(--text-main)', marginBottom:4}}>{item.titulo || item.texto}</div>

                      {isReuniao && <div style={{fontSize:13, color:'var(--text-secondary)'}}><strong>Participantes:</strong> {item.participantes||'Nenhum'}</div>}
                      {isReuniao && item.resumo && <div style={{fontSize:13, color:'var(--text-secondary)', marginTop:4}}>{item.resumo}</div>}

                      {isOtimiza && <div style={{fontSize:13, color:'var(--text-secondary)'}}><strong>Resultado:</strong> <span style={{color:'#16A34A', fontWeight:600}}>{item.resultado||'Pendente'}</span></div>}
                      {isOtimiza && item.desc && <div style={{fontSize:13, color:'var(--text-secondary)', marginTop:4}}>{item.desc}</div>}

                      {!isReuniao && !isOtimiza && item.autor && <div style={{fontSize:12, color:'var(--text-muted)', marginTop:6}}>Feito por: {item.autor}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>}

        {/* ABA: MÉTRICAS E DASHBOARD */}
        {tab==='metricas' && <>
          <MetricsDashboard historico={c.metricasHistorico || []} clienteNome={c.nome} />
          
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12, marginTop:24}}>
            <div className="sec-title" style={{margin:0}}>Registros Brutos de Performance</div>
            {!metForm && <button className="btn btn-sm btn-primary" onClick={()=>setMetForm(true)}>+ Registrar Semana</button>}
          </div>

          {metForm && (
            <div style={{background:'var(--hover-bg)',border:'1px solid var(--border-color)',borderRadius:10,padding:20,marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:16,color:'var(--text-main)'}}>Preencher dados de performance</div>
              <div className="form-grid-4" style={{marginBottom:12}}>
                <div className="field"><label>Data Base *</label><input type="date" value={mfields.data} onChange={e=>setMfields((p:any)=>({...p,data:e.target.value}))} /></div>
                <div className="field"><label>ROAS (Ex: 4.8x)</label><input value={mfields.roas} onChange={e=>setMfields((p:any)=>({...p,roas:e.target.value}))} /></div>
                <div className="field"><label>ROI (%)</label><input type="number" value={mfields.roi} onChange={e=>setMfields((p:any)=>({...p,roi:e.target.value}))} /></div>
                <div className="field"><label>CPL (R$)</label><input type="number" value={mfields.cpl} onChange={e=>setMfields((p:any)=>({...p,cpl:e.target.value}))} /></div>
              </div>
              <div className="form-grid-4" style={{marginBottom:20}}>
                <div className="field"><label>Leads Totais</label><input type="number" value={mfields.leads} onChange={e=>setMfields((p:any)=>({...p,leads:e.target.value}))} /></div>
                <div className="field"><label>Qtd. Vendas</label><input type="number" value={mfields.vendas} onChange={e=>setMfields((p:any)=>({...p,vendas:e.target.value}))} /></div>
                <div className="field"><label>Faturamento (R$)</label><input type="number" value={mfields.totalVendido} onChange={e=>setMfields((p:any)=>({...p,totalVendido:e.target.value}))} /></div>
                <div className="field"><label>Investimento (R$)</label><input type="number" value={mfields.invest} onChange={e=>setMfields((p:any)=>({...p,invest:e.target.value}))} /></div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button className="btn btn-sm" onClick={()=>setMetForm(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={salvarMetrica}>Salvar Dados</button>
              </div>
            </div>
          )}

          {historico.length === 0 ? <div className="empty">Nenhuma métrica registrada ainda.</div> :
            <div style={{overflowX:'auto', background:'var(--card-color)', border:'1px solid var(--border-color)', borderRadius:8}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'var(--hover-bg)', borderBottom:'1px solid var(--border-color)'}}>
                    {['Data','ROAS','ROI','CPL','Leads','Vendas','Faturamento','Investimento',''].map(h=> <th key={h} style={{textAlign:'left',padding:'12px',fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase'}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {historico.map((m:any,i:number)=>{
                    const isTop = parseFloat(m.roas||0) === bestRoas && bestRoas && bestRoas > 0
                    return (
                      <tr key={i} style={{borderBottom:'1px solid var(--border-color)',background:isTop?'rgba(251,46,10,0.08)':'transparent'}}>
                        <td style={{padding:'12px',fontWeight:600}}>{fmtDate(m.data)} {isTop && <span style={{background:'#FB2E0A',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:4,marginLeft:6}}>Recorde</span>}</td>
                        <td style={{padding:'12px',fontWeight:700}}>{m.roas||'—'}</td>
                        <td style={{padding:'12px'}}>{m.roi?m.roi+'%':'—'}</td>
                        <td style={{padding:'12px'}}>{m.cpl?'R$'+m.cpl:'—'}</td>
                        <td style={{padding:'12px'}}>{m.leads?fmtNum(m.leads):'—'}</td>
                        <td style={{padding:'12px'}}>{m.vendas?fmtNum(m.vendas):'—'}</td>
                        <td style={{padding:'12px',color:'#16A34A',fontWeight:600}}>{m.totalVendido?fmtR(m.totalVendido):'—'}</td>
                        <td style={{padding:'12px',color:'#D97706'}}>{m.invest?fmtR(m.invest):'—'}</td>
                        <td style={{padding:'12px',textAlign:'right'}}><button className="btn btn-sm btn-danger" onClick={()=>{if(!confirm('Remover esta entrada?'))return;const arr=[...historico];arr.splice(i,1);onUpdate({...c,metricasHistorico:arr,metricas:arr[0]||{}})}}>Excluir</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          }
        </>}

        {/* DEMAIS ABAS (Monetizações, Criativos, Equipe, Links) */}
        {tab==='monetizacoes' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div className="sec-title" style={{margin:0, fontSize:16}}>Histórico de Upsells e Cross-sells</div>
            <button className="btn btn-sm btn-primary" onClick={()=>{setIfields({descricao:'',valor:'',data:new Date().toISOString().slice(0,10),status:'pago'});setItemForm('monetizacao')}}>+ Registrar Monetização</button>
          </div>
          {(c.monetizacoes||[]).length===0?<div className="empty">Este cliente ainda não teve monetizações extras.</div>:
            <div style={{display:'grid', gap:12}}>
              {(c.monetizacoes||[]).map((m:any,i:number)=>(
                <div key={i} style={{background:'var(--card-color)', border:'1px solid var(--border-color)', borderRadius:8, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderLeft:`4px solid ${m.status==='pago'?'#16A34A':'#D97706'}`}}>
                  <div>
                    <div style={{fontSize:15, fontWeight:700, color:'var(--text-main)', marginBottom:4}}>{m.descricao}</div>
                    <div style={{fontSize:12, color:'var(--text-muted)', fontWeight:600}}>{m.data&&fmtDate(m.data)} <span style={{margin:'0 8px'}}>•</span> <span style={{color:m.status==='pago'?'#16A34A':'#D97706'}}>{m.status==='pago'?'Status: Pago':'Status: Pendente'}</span></div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:16}}>
                    <span style={{fontSize:18, fontWeight:800, color:'var(--text-main)'}}>{fmtR(m.valor)}</span>
                    <button style={{background:'#FFF0F2', border:'1px solid #FFCDD5', color:'#FB2E0A', width:28, height:28, borderRadius:6, cursor:'pointer', fontWeight:700}} onClick={()=>removeItem('monetizacoes',i)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          }
        </>}

        {tab==='criativos' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="sec-title" style={{margin:0}}>Repertório de Criativos</div>
            <button className="btn btn-sm" onClick={()=>{setIfields({titulo:'',url:'',descricao:''});setItemForm('criativo')}}>+ Adicionar Mídia</button>
          </div>
          {(c.criativos||[]).length===0 ? <div className="empty">Galeria vazia. Cole links do Drive, Pinterest, Ads Library etc.</div> :
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16}}>
              {(c.criativos||[]).map((cr:any,i:number)=>(
                <div key={i} style={{border:'1px solid var(--border-color)',borderRadius:8,overflow:'hidden',background:'var(--card-color)',boxShadow:'0 2px 8px rgba(0,0,0,0.03)'}}>
                  {cr.url && (cr.url.match(/\.(jpg|jpeg|png|gif|webp)/i) || cr.url.includes('drive.google.com')) ? (
                    <div style={{height:150,background:'var(--hover-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                      <img src={cr.url} alt={cr.titulo} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as any).style.display='none'}} />
                    </div>
                  ) : (
                    <div style={{height:100,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center', fontSize:32}}>🎨</div>
                  )}
                  <div style={{padding:'12px 16px'}}>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:'var(--text-main)'}}>{cr.titulo}</div>
                    {cr.descricao&&<div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:12,lineHeight:1.4}}>{cr.descricao}</div>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      {cr.url&&<a href={cr.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#2563EB',fontWeight:600,textDecoration:'none'}}>Acessar Original ↗</a>}
                      <button style={{border:'none',background:'none',color:'#FB2E0A',cursor:'pointer',fontSize:12,fontWeight:600}} onClick={()=>removeItem('criativos',i)}>Apagar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </>}

        {tab==='equipe' && <>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <div className="sec-title" style={{margin:0}}>Squad de Atendimento (V4)</div>
            {isAdmin && !equipeEdit && <button className="btn btn-sm" onClick={abrirEquipeEdit}>Editar Equipe</button>}
          </div>

          {equipeEdit ? (
            <div style={{background:'var(--hover-bg)', border:'1px solid var(--border-color)', borderRadius:10, padding:20, marginBottom:32}}>
              <div className="form-grid-3" style={{marginBottom:16}}>
                <div className="field"><label>Estrategista Principal</label><input value={equipeFields.estrategista} onChange={e=>setEquipeFields(p=>({...p,estrategista:e.target.value}))} /></div>
                <div className="field"><label>Gestor de Tráfego</label><input value={equipeFields.gestor} onChange={e=>setEquipeFields(p=>({...p,gestor:e.target.value}))} /></div>
                <div className="field"><label>Account Executive</label><input value={equipeFields.account} onChange={e=>setEquipeFields(p=>({...p,account:e.target.value}))} /></div>
              </div>
              <div className="form-grid-3" style={{marginBottom:16}}>
                <div className="field"><label>Closer Responsável</label><input value={equipeFields.closer} onChange={e=>setEquipeFields(p=>({...p,closer:e.target.value}))} /></div>
                <div className="field"><label>SDR (Pré-vendas)</label><input value={equipeFields.sdr} onChange={e=>setEquipeFields(p=>({...p,sdr:e.target.value}))} /></div>
              </div>
              <div style={{display:'flex', gap:10}}>
                <button className="btn btn-sm" onClick={()=>setEquipeEdit(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={salvarEquipe}>Salvar Equipe</button>
              </div>
            </div>
          ) : <>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:32}}>
              <div style={{background:'var(--hover-bg)', padding:16, borderRadius:8, border:'1px solid var(--border-color)'}}><div style={{fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase'}}>Estrategista Principal</div><div style={{fontSize:15, fontWeight:600, color:'var(--text-main)', marginTop:4}}>{c.estrategista||'Não definido'}</div></div>
              <div style={{background:'var(--hover-bg)', padding:16, borderRadius:8, border:'1px solid var(--border-color)'}}><div style={{fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase'}}>Gestor de Tráfego</div><div style={{fontSize:15, fontWeight:600, color:'var(--text-main)', marginTop:4}}>{c.gestor||'Não definido'}</div></div>
              <div style={{background:'var(--hover-bg)', padding:16, borderRadius:8, border:'1px solid var(--border-color)'}}><div style={{fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase'}}>Account Executive</div><div style={{fontSize:15, fontWeight:600, color:'var(--text-main)', marginTop:4}}>{c.account||'Não definido'}</div></div>
            </div>
            <div className="sec-title">Squad Comercial (Vendas)</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
              <div style={{background:'var(--hover-bg)', padding:16, borderRadius:8, border:'1px solid var(--border-color)'}}><div style={{fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase'}}>Closer Responsável</div><div style={{fontSize:15, fontWeight:600, color:'var(--text-main)', marginTop:4}}>{c.closer||'Não definido'}</div></div>
              <div style={{background:'var(--hover-bg)', padding:16, borderRadius:8, border:'1px solid var(--border-color)'}}><div style={{fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase'}}>SDR (Pré-vendas)</div><div style={{fontSize:15, fontWeight:600, color:'var(--text-main)', marginTop:4}}>{c.sdr||'Não definido'}</div></div>
            </div>
          </>}
        </>}

        {tab==='links' && <>
          <div className="sec-title" style={{fontSize:16}}>Documentação Base</div>
          <div style={{background:'var(--card-color)', border:'1px solid var(--border-color)', borderRadius:8, overflow:'hidden', marginBottom:24}}>
            {[['Contrato Assinado',c.linkContrato],['Call de Vendas (Vídeo)',c.linkCall],['Transcrição da Call',c.linkTranscricao],['Drive V4 Marketing',c.linkV4],['BANT do SDR',c.linkBant]].map(([l,v], idx)=>(
              <div key={l} style={{display:'flex', justifyContent:'space-between', padding:'14px 20px', borderBottom: idx===4?'none':'1px solid var(--border-light)', background: idx%2===0?'var(--hover-bg)':'var(--card-color)'}}>
                <span style={{fontWeight:600, color:'var(--text-secondary)'}}>{l}</span>
                <span>{v?<a href={v as string} target="_blank" rel="noreferrer" style={{color:'#2563EB',fontWeight:600,textDecoration:'none'}}>Acessar Link ↗</a>:<span style={{color:'var(--text-muted)', fontSize:12}}>Pendente</span>}</span>
              </div>
            ))}
          </div>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="sec-title" style={{margin:0, fontSize:16}}>Outros Links Úteis</div>
            <button className="btn btn-sm" onClick={()=>{setIfields({titulo:'',url:''});setItemForm('arquivo')}}>+ Adicionar Link</button>
          </div>
          {(c.arquivos||[]).length===0?<div className="empty">Nenhum link adicional registrado.</div>:
            <div style={{display:'grid', gap:8}}>
              {(c.arquivos||[]).map((a:any,i:number)=>(
                <div key={i} style={{background:'var(--hover-bg)', border:'1px solid var(--border-color)', borderRadius:8, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontWeight:600}}>{a.titulo} {a.url&&<a href={a.url} target="_blank" rel="noreferrer" style={{marginLeft:12, fontSize:12, color:'#2563EB', textDecoration:'none', fontWeight:400}}>{a.url}</a>}</div>
                  <button style={{background:'none', border:'none', color:'#FB2E0A', cursor:'pointer', fontSize:14}} onClick={()=>removeItem('arquivos',i)}>×</button>
                </div>
              ))}
            </div>
          }
        </>}
      </div>

      {/* ── 4. MODAL GENÉRICO DE CADASTRO ── */}
      {itemForm && (
        <div className="overlay" style={{background:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)'}} onClick={e=>{if(e.target===e.currentTarget)setItemForm(null)}}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 style={{fontSize:16, fontWeight:800}}>{{otimizacao:'Registrar Otimização',reuniao:'Agendar/Registrar Reunião',anotacao:'Adicionar Anotação',arquivo:'Novo Link Rápido',criativo:'Salvar Criativo',monetizacao:'Registrar Monetização Extra'}[itemForm as string]}</h3>
              <button className="btn btn-ghost btn-sm" onClick={()=>setItemForm(null)}>✕</button>
            </div>
            <div className="modal-body">
              {itemForm==='otimizacao'&&<>
                <div className="field"><label>O que foi feito? (Título) *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} /></div>
                <div className="field"><label>Qual foi o resultado percebido?</label><input value={ifields.resultado||''} onChange={e=>setIfields((p:any)=>({...p,resultado:e.target.value}))} placeholder="Ex: CPL caiu 20%" /></div>
                <div className="field"><label>Detalhes da ação</label><textarea value={ifields.desc||''} onChange={e=>setIfields((p:any)=>({...p,desc:e.target.value}))} rows={3} /></div>
                <div className="field"><label>Data da otimização</label><input type="date" value={ifields.data||''} onChange={e=>setIfields((p:any)=>({...p,data:e.target.value}))} /></div>
              </>}
              {itemForm==='reuniao'&&<>
                <div className="field"><label>Pauta da Reunião *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} /></div>
                <div className="field"><label>Data</label><input type="date" value={ifields.data||''} onChange={e=>setIfields((p:any)=>({...p,data:e.target.value}))} /></div>
                <div className="field"><label>Quem participou?</label><input value={ifields.participantes||''} onChange={e=>setIfields((p:any)=>({...p,participantes:e.target.value}))} placeholder="Ex: Cliente, João (ACC), Maria (SDR)" /></div>
                <div className="field"><label>Resumo e Próximos Passos</label><textarea value={ifields.resumo||''} onChange={e=>setIfields((p:any)=>({...p,resumo:e.target.value}))} rows={3} /></div>
              </>}
              {itemForm==='anotacao'&&<>
                <div className="field"><label>Anotação / Observação *</label><textarea value={ifields.texto||''} onChange={e=>setIfields((p:any)=>({...p,texto:e.target.value}))} rows={4} placeholder="Escreva informações importantes para o time..." /></div>
                <div className="field"><label>Seu Nome (Autor)</label><input value={ifields.autor||''} onChange={e=>setIfields((p:any)=>({...p,autor:e.target.value}))} /></div>
                <div className="field"><label>Data</label><input type="date" value={ifields.data||''} onChange={e=>setIfields((p:any)=>({...p,data:e.target.value}))} /></div>
              </>}
              {itemForm==='arquivo'&&<>
                <div className="field"><label>Nome do Link *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} /></div>
                <div className="field"><label>URL</label><input value={ifields.url||''} onChange={e=>setIfields((p:any)=>({...p,url:e.target.value}))} placeholder="https://..." /></div>
              </>}
              {itemForm==='criativo'&&<>
                <div className="field"><label>Nome da Campanha / Criativo *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} /></div>
                <div className="field"><label>Link da Imagem/Vídeo</label><input value={ifields.url||''} onChange={e=>setIfields((p:any)=>({...p,url:e.target.value}))} placeholder="https://..." /></div>
                <div className="field"><label>Instruções / Copy</label><textarea value={ifields.descricao||''} onChange={e=>setIfields((p:any)=>({...p,descricao:e.target.value}))} rows={3} /></div>
              </>}
              {itemForm==='monetizacao'&&<>
                <div className="field"><label>Motivo (Upsell / Novo Projeto) *</label><input value={ifields.descricao||''} onChange={e=>setIfields((p:any)=>({...p,descricao:e.target.value}))} placeholder="Ex: Contratação de SEO" /></div>
                <div className="field"><label>Valor Faturado (R$)</label><input type="number" value={ifields.valor||''} onChange={e=>setIfields((p:any)=>({...p,valor:e.target.value}))} placeholder="Ex: 2500" /></div>
                <div className="field"><label>Data de Fechamento</label><input type="date" value={ifields.data||''} onChange={e=>setIfields((p:any)=>({...p,data:e.target.value}))} /></div>
                <div className="field"><label>Status do Pagamento</label>
                  <select value={ifields.status||'pago'} onChange={e=>setIfields((p:any)=>({...p,status:e.target.value}))} style={{width:'100%',height:40,border:'1px solid var(--border-color)',borderRadius:6,padding:'0 12px',outline:'none',background:'var(--input-bg)',color:'var(--text-main)'}}>
                    <option value="pago">Já foi Pago</option>
                    <option value="pendente">Aguardando Pagamento</option>
                  </select>
                </div>
              </>}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setItemForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={()=>{
                if(itemForm==='otimizacao'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('otimizacoes',ifields)}
                else if(itemForm==='reuniao'){if(!ifields.titulo?.trim())return alert('Informe a pauta.');addItem('reunioes',ifields)}
                else if(itemForm==='anotacao'){if(!ifields.texto?.trim())return alert('Escreva a anotação.');addItem('anotacoes',ifields)}
                else if(itemForm==='arquivo'){if(!ifields.titulo?.trim())return alert('Informe o nome do link.');addItem('arquivos',ifields)}
                else if(itemForm==='criativo'){if(!ifields.titulo?.trim())return alert('Informe o nome.');addItem('criativos',ifields)}
                else if(itemForm==='monetizacao'){if(!ifields.descricao?.trim())return alert('Descreva o motivo da monetização.');addItem('monetizacoes',ifields)}
                setItemForm(null)
              }}>Salvar Registro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
