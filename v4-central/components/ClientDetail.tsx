import MetricsDashboard from './MetricsDashboard'
import { useState } from 'react'

function fmtDate(d: string) { if(!d||d==='-') return '—'; try{const[y,m,day]=d.split('-');return`${day}/${m}/${y}`}catch{return d} }
function fmtR(v: any) { if(!v&&v!==0) return '—'; return 'R$'+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}) }
function fmtNum(v: any) { if(!v&&v!==0) return '—'; return Number(v).toLocaleString('pt-BR') }

const TABS = [
  {k:'dados',l:'Dados'},{k:'equipe',l:'Equipe'},{k:'links',l:'Links'},
  {k:'metricas',l:'Métricas'},{k:'otimizacoes',l:'Otimizações'},
  {k:'reunioes',l:'Reuniões'},{k:'anotacoes',l:'Anotações'},{k:'criativos',l:'Criativos'}
]

interface Props { client: any; onUpdate: (c: any) => void }

export default function ClientDetail({ client: c, onUpdate }: Props) {
  const [tab, setTab] = useState('dados')
  const [itemForm, setItemForm] = useState<any>(null)
  const [ifields, setIfields] = useState<any>({})
  const [metForm, setMetForm] = useState(false)
  const [mfields, setMfields] = useState<any>({roas:'',cpl:'',leads:'',invest:'',roi:'',vendas:'',totalVendido:'',data:new Date().toISOString().slice(0,10)})

  const cats = [c.catSaber&&'Saber',c.catTer&&'Ter',c.catExecutar&&'Executar'].filter(Boolean).join(', ')||'—'
  const historico: any[] = c.metricasHistorico || []

  // Melhores valores do histórico
  const bestRoas = historico.length ? Math.max(...historico.map((m:any)=>parseFloat(m.roas)||0)) : null
  const bestRoi = historico.length ? Math.max(...historico.map((m:any)=>parseFloat(m.roi)||0)) : null
  const bestVendas = historico.length ? Math.max(...historico.map((m:any)=>parseInt(m.vendas)||0)) : null

  function addItem(field: string, item: any) {
    onUpdate({ ...c, [field]: [item, ...(c[field]||[])] })
  }
  function removeItem(field: string, idx: number) {
    if (!confirm('Remover?')) return
    const arr = [...(c[field]||[])]
    arr.splice(idx, 1)
    onUpdate({ ...c, [field]: arr })
  }

  function salvarMetrica() {
    if (!mfields.data) return alert('Informe a data.')
    const novaMetrica = { ...mfields, savedAt: new Date().toISOString() }
    const novo = [novaMetrica, ...historico]
    // Atualiza também o resumo rápido com a entrada mais recente
    onUpdate({ ...c, metricasHistorico: novo, metricas: mfields })
    setMetForm(false)
    setMfields({roas:'',cpl:'',leads:'',invest:'',roi:'',vendas:'',totalVendido:'',data:new Date().toISOString().slice(0,10)})
  }

  return (
    <div className="detail-card">
      <div className="detail-tabs">
        {TABS.map(t => <button key={t.k} className={`detail-tab ${tab===t.k?'active':''}`} onClick={()=>setTab(t.k)}>{t.l}</button>)}
      </div>

      <div className="detail-body">

        {tab==='dados' && <>
          <div className="sec-title">Informações básicas</div>
          <div className="info-row"><span className="info-key">Stakeholder</span><span className="info-val">{c.stakeholder||'—'}</span></div>
          <div className="info-row"><span className="info-key">Telefone</span><span className="info-val">{c.telefone||'—'}</span></div>
          <div className="info-row"><span className="info-key">MRR</span><span className="info-val">{fmtR(c.mrr)}</span></div>
          <div className="info-row"><span className="info-key">Valor total contrato</span><span className="info-val">{fmtR(c.valorTotal)}</span></div>
          <div className="info-row"><span className="info-key">Fidelidade</span><span className="info-val">{c.fidelidade||'—'}</span></div>
          <div className="info-row"><span className="info-key">Entrada</span><span className="info-val">{fmtDate(c.dataEntrada)}</span></div>
          <div className="info-row"><span className="info-key">Início do projeto</span><span className="info-val">{fmtDate(c.inicioProj)}</span></div>
          <div className="info-row"><span className="info-key">Fim do contrato</span><span className="info-val">{fmtDate(c.fimContrato)}</span></div>
          <div className="sec-title" style={{marginTop:16}}>Detalhes</div>
          <div className="info-row"><span className="info-key">Canal de origem</span><span className="info-val">{c.canalOrigem||'—'}</span></div>
          <div className="info-row"><span className="info-key">Instagram</span><span className="info-val">{c.instagram&&c.instagram!=='-'?<a href={c.instagram} target="_blank" rel="noreferrer" style={{color:'#2563EB'}}>Ver perfil</a>:'—'}</span></div>
          <div className="info-row"><span className="info-key">Site</span><span className="info-val">{c.site&&c.site!=='-'?<a href={c.site} target="_blank" rel="noreferrer" style={{color:'#2563EB'}}>Acessar</a>:'—'}</span></div>
          <div className="info-row"><span className="info-key">Cohort</span><span className="info-val">{c.cohort||'—'}</span></div>
          <div className="info-row"><span className="info-key">Canais ativos</span><span className="info-val">{c.canais||'—'}</span></div>
          <div className="info-row"><span className="info-key">Produtos contratados</span><span className="info-val">{cats}</span></div>
          {c.descricao&&c.descricao!=='-'&&<><div className="sec-title" style={{marginTop:16}}>Sobre o projeto</div><div className="note-block">{c.descricao}</div></>}
          {c.promessa&&c.promessa!=='-'&&<><div className="sec-title" style={{marginTop:16}}>Promessas fora do escopo</div><div className="note-block">{c.promessa}</div></>}
        </>}

        {tab==='equipe' && <>
          <div className="sec-title">Equipe V4</div>
          <div className="info-row"><span className="info-key">Estrategista</span><span className="info-val">{c.estrategista||'—'}</span></div>
          <div className="info-row"><span className="info-key">Gestor de tráfego</span><span className="info-val">{c.gestor||'—'}</span></div>
          <div className="info-row"><span className="info-key">Account</span><span className="info-val">{c.account||'—'}</span></div>
          <div className="sec-title" style={{marginTop:16}}>Equipe de vendas</div>
          <div className="info-row"><span className="info-key">Closer</span><span className="info-val">{c.closer||'—'}</span></div>
          <div className="info-row"><span className="info-key">SDR</span><span className="info-val">{c.sdr||'—'}</span></div>
        </>}

        {tab==='links' && <>
          <div className="sec-title">Links obrigatórios</div>
          {[['Contrato',c.linkContrato],['Call de vendas',c.linkCall],['Transcrição da call',c.linkTranscricao],['V4 Marketing',c.linkV4],['BANT SDR',c.linkBant]].map(([l,v])=>(
            <div key={l} className="link-row">
              <span style={{color:'#6B6B6B',minWidth:160}}>{l}</span>
              <span style={{flex:1,textAlign:'right'}}>{v?<a href={v as string} target="_blank" rel="noreferrer" style={{color:'#2563EB',fontSize:12}}>Abrir link</a>:'—'}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,marginBottom:8}}>
            <div className="sec-title" style={{margin:0}}>Links adicionais</div>
            <button className="btn btn-sm" onClick={()=>{setIfields({titulo:'',url:''});setItemForm('arquivo')}}>+ Adicionar</button>
          </div>
          {(c.arquivos||[]).length===0?<div style={{fontSize:13,color:'#C4C4C4',padding:'8px 0'}}>Nenhum link adicional.</div>:
            (c.arquivos||[]).map((a:any,i:number)=>(
              <div key={i} className="link-row">
                <div style={{flex:1}}><div style={{fontWeight:600}}>{a.titulo}</div>{a.url&&<a href={a.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#2563EB'}}>{a.url}</a>}</div>
                <button className="btn btn-sm btn-danger" onClick={()=>removeItem('arquivos',i)}>×</button>
              </div>
            ))
          }
        </>}

        {tab==='metricas' && (
  <MetricsDashboard
    historico={c.metricasHistorico || []}
    clienteNome={c.nome}
  />
)}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="sec-title" style={{margin:0}}>Histórico de métricas ({historico.length} entradas)</div>
            {!metForm && <button className="btn btn-sm btn-primary" onClick={()=>setMetForm(true)}>+ Nova entrada</button>}
          </div>

          {metForm && (
            <div style={{background:'#fafafa',border:'1px solid #eee',borderRadius:10,padding:16,marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Nova entrada de métricas</div>
              <div className="form-grid-4" style={{marginBottom:8}}>
                <div className="field"><label>Data *</label><input type="date" value={mfields.data} onChange={e=>setMfields((p:any)=>({...p,data:e.target.value}))} /></div>
                <div className="field"><label>ROAS</label><input value={mfields.roas} onChange={e=>setMfields((p:any)=>({...p,roas:e.target.value}))} placeholder="Ex: 4.8x" /></div>
                <div className="field"><label>ROI (%)</label><input type="number" value={mfields.roi} onChange={e=>setMfields((p:any)=>({...p,roi:e.target.value}))} placeholder="Ex: 320" /></div>
                <div className="field"><label>CPL (R$)</label><input type="number" value={mfields.cpl} onChange={e=>setMfields((p:any)=>({...p,cpl:e.target.value}))} /></div>
              </div>
              <div className="form-grid-4" style={{marginBottom:12}}>
                <div className="field"><label>Leads gerados</label><input type="number" value={mfields.leads} onChange={e=>setMfields((p:any)=>({...p,leads:e.target.value}))} /></div>
                <div className="field"><label>Qtd. de vendas</label><input type="number" value={mfields.vendas} onChange={e=>setMfields((p:any)=>({...p,vendas:e.target.value}))} /></div>
                <div className="field"><label>Total vendido (R$)</label><input type="number" value={mfields.totalVendido} onChange={e=>setMfields((p:any)=>({...p,totalVendido:e.target.value}))} /></div>
                <div className="field"><label>Investimento (R$)</label><input type="number" value={mfields.invest} onChange={e=>setMfields((p:any)=>({...p,invest:e.target.value}))} /></div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-sm" onClick={()=>setMetForm(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={salvarMetrica}>Salvar entrada</button>
              </div>
            </div>
          )}

          {historico.length === 0
            ? <div className="empty">Nenhuma métrica registrada ainda.<br/>Clique em "+ Nova entrada" para começar.</div>
            : <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid #eee'}}>
                      {['Data','ROAS','ROI','CPL','Leads','Vendas','Total vendido','Investimento'].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'8px 10px',fontSize:11,fontWeight:700,color:'#6B6B6B',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((m:any,i:number)=>{
                      const isTop = parseFloat(m.roas||0) === bestRoas && bestRoas && bestRoas > 0
                      return (
                        <tr key={i} style={{borderBottom:'1px solid #f5f5f5',background:isTop?'#fff8f8':'transparent'}}>
                          <td style={{padding:'9px 10px',fontWeight:500,whiteSpace:'nowrap'}}>{fmtDate(m.data)} {isTop && <span style={{background:'#D72B2B',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:10,marginLeft:4}}>★</span>}</td>
                          <td style={{padding:'9px 10px'}}>{m.roas||'—'}</td>
                          <td style={{padding:'9px 10px'}}>{m.roi?m.roi+'%':'—'}</td>
                          <td style={{padding:'9px 10px'}}>{m.cpl?'R$'+m.cpl:'—'}</td>
                          <td style={{padding:'9px 10px'}}>{m.leads?fmtNum(m.leads):'—'}</td>
                          <td style={{padding:'9px 10px'}}>{m.vendas?fmtNum(m.vendas):'—'}</td>
                          <td style={{padding:'9px 10px'}}>{m.totalVendido?fmtR(m.totalVendido):'—'}</td>
                          <td style={{padding:'9px 10px'}}>{m.invest?fmtR(m.invest):'—'}</td>
                          <td style={{padding:'9px 10px'}}><button className="btn btn-sm btn-danger" onClick={()=>{if(!confirm('Remover esta entrada?'))return;const arr=[...historico];arr.splice(i,1);onUpdate({...c,metricasHistorico:arr,metricas:arr[0]||{}})}}>×</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
       {tab==='metricas' && (
  <MetricsDashboard
    historico={c.metricasHistorico || []}
    clienteNome={c.nome}
  />
)}

        {tab==='otimizacoes' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="sec-title" style={{margin:0}}>{(c.otimizacoes||[]).length} otimizações</div>
            <button className="btn btn-sm" onClick={()=>{setIfields({titulo:'',desc:'',resultado:'',data:''});setItemForm('otimizacao')}}>+ Adicionar</button>
          </div>
          {(c.otimizacoes||[]).length===0?<div className="empty">Nenhuma otimização registrada.</div>:
            (c.otimizacoes||[]).map((o:any,i:number)=>(
              <div key={i} className="item-row">
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <div className="item-title">{o.titulo}</div>
                  <button className="btn btn-sm btn-danger" onClick={()=>removeItem('otimizacoes',i)}>×</button>
                </div>
                <div className="item-meta">{o.resultado} {o.data&&'· '+fmtDate(o.data)}</div>
                {o.desc&&<div style={{fontSize:12,color:'#6B6B6B',marginTop:3}}>{o.desc}</div>}
              </div>
            ))
          }
        </>}

        {tab==='reunioes' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="sec-title" style={{margin:0}}>{(c.reunioes||[]).length} reuniões</div>
            <button className="btn btn-sm" onClick={()=>{setIfields({titulo:'',data:new Date().toISOString().slice(0,10),participantes:'',resumo:''});setItemForm('reuniao')}}>+ Adicionar</button>
          </div>
          {(c.reunioes||[]).length===0?<div className="empty">Nenhuma reunião registrada.</div>:
            (c.reunioes||[]).map((r:any,i:number)=>(
              <div key={i} className="item-row">
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <div className="item-title">{r.titulo}</div>
                  <button className="btn btn-sm btn-danger" onClick={()=>removeItem('reunioes',i)}>×</button>
                </div>
                <div className="item-meta">{r.data&&fmtDate(r.data)} {r.participantes&&'· '+r.participantes}</div>
                {r.resumo&&<div style={{fontSize:12,color:'#6B6B6B',marginTop:3}}>{r.resumo}</div>}
              </div>
            ))
          }
        </>}

        {tab==='anotacoes' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="sec-title" style={{margin:0}}>{(c.anotacoes||[]).length} anotações</div>
            <button className="btn btn-sm" onClick={()=>{setIfields({texto:'',autor:'',data:new Date().toISOString().slice(0,10)});setItemForm('anotacao')}}>+ Adicionar</button>
          </div>
          {(c.anotacoes||[]).length===0?<div className="empty">Nenhuma anotação registrada.</div>:
            (c.anotacoes||[]).map((a:any,i:number)=>(
              <div key={i} className="note-block">
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span>{a.texto}</span>
                  <button className="btn btn-sm btn-danger" onClick={()=>removeItem('anotacoes',i)} style={{marginLeft:8}}>×</button>
                </div>
                <div className="item-meta" style={{marginTop:4}}>{a.autor} {a.data&&'· '+fmtDate(a.data)}</div>
              </div>
            ))
          }
        </>}

        {tab==='criativos' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="sec-title" style={{margin:0}}>Repertório de criativos ({(c.criativos||[]).length})</div>
            <button className="btn btn-sm" onClick={()=>{setIfields({titulo:'',url:'',tipo:'imagem',descricao:''});setItemForm('criativo')}}>+ Adicionar</button>
          </div>
          <p style={{fontSize:12,color:'#6B6B6B',marginBottom:16}}>Adicione links de imagens, vídeos ou referências para o time de design.</p>
          {(c.criativos||[]).length===0
            ? <div className="empty">Nenhum criativo adicionado ainda.<br/>Cole links de imagens do Google Drive, Pinterest, Behance etc.</div>
            : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                {(c.criativos||[]).map((cr:any,i:number)=>(
                  <div key={i} style={{border:'1px solid #eee',borderRadius:10,overflow:'hidden',background:'#fff'}}>
                    {cr.url && (cr.url.match(/\.(jpg|jpeg|png|gif|webp)/i) || cr.url.includes('drive.google.com')) ? (
                      <div style={{height:140,background:'#f4f4f4',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                        <img src={cr.url} alt={cr.titulo} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as any).style.display='none'}} />
                      </div>
                    ) : (
                      <div style={{height:80,background:'#fef2f2',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span style={{fontSize:28}}>🎨</span>
                      </div>
                    )}
                    <div style={{padding:'10px 12px'}}>
                      <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{cr.titulo}</div>
                      {cr.descricao&&<div style={{fontSize:12,color:'#6B6B6B',marginBottom:6}}>{cr.descricao}</div>}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        {cr.url&&<a href={cr.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#2563EB'}}>Abrir link</a>}
                        <button className="btn btn-sm btn-danger" onClick={()=>removeItem('criativos',i)}>×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>}
      </div>

      {itemForm && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setItemForm(null)}}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>{{otimizacao:'Nova otimização',reuniao:'Nova reunião',anotacao:'Nova anotação',arquivo:'Novo link',criativo:'Novo criativo'}[itemForm]}</h3>
              <button className="btn btn-ghost btn-sm" onClick={()=>setItemForm(null)}>✕</button>
            </div>
            <div className="modal-body">
              {itemForm==='otimizacao'&&<>
                <div className="field"><label>Título *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} /></div>
                <div className="field"><label>Descrição</label><textarea value={ifields.desc||''} onChange={e=>setIfields((p:any)=>({...p,desc:e.target.value}))} /></div>
                <div className="field"><label>Resultado</label><input value={ifields.resultado||''} onChange={e=>setIfields((p:any)=>({...p,resultado:e.target.value}))} placeholder="Ex: +22% CTR" /></div>
                <div className="field"><label>Data</label><input type="date" value={ifields.data||''} onChange={e=>setIfields((p:any)=>({...p,data:e.target.value}))} /></div>
              </>}
              {itemForm==='reuniao'&&<>
                <div className="field"><label>Título *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} /></div>
                <div className="field"><label>Data</label><input type="date" value={ifields.data||''} onChange={e=>setIfields((p:any)=>({...p,data:e.target.value}))} /></div>
                <div className="field"><label>Participantes</label><input value={ifields.participantes||''} onChange={e=>setIfields((p:any)=>({...p,participantes:e.target.value}))} /></div>
                <div className="field"><label>Resumo / próximos passos</label><textarea value={ifields.resumo||''} onChange={e=>setIfields((p:any)=>({...p,resumo:e.target.value}))} /></div>
              </>}
              {itemForm==='anotacao'&&<>
                <div className="field"><label>Anotação *</label><textarea value={ifields.texto||''} onChange={e=>setIfields((p:any)=>({...p,texto:e.target.value}))} /></div>
                <div className="field"><label>Autor</label><input value={ifields.autor||''} onChange={e=>setIfields((p:any)=>({...p,autor:e.target.value}))} /></div>
                <div className="field"><label>Data</label><input type="date" value={ifields.data||''} onChange={e=>setIfields((p:any)=>({...p,data:e.target.value}))} /></div>
              </>}
              {itemForm==='arquivo'&&<>
                <div className="field"><label>Título *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} /></div>
                <div className="field"><label>URL</label><input value={ifields.url||''} onChange={e=>setIfields((p:any)=>({...p,url:e.target.value}))} placeholder="https://..." /></div>
              </>}
              {itemForm==='criativo'&&<>
                <div className="field"><label>Título / nome do criativo *</label><input value={ifields.titulo||''} onChange={e=>setIfields((p:any)=>({...p,titulo:e.target.value}))} placeholder="Ex: Banner promo março" /></div>
                <div className="field"><label>Link (Drive, Pinterest, Behance...)</label><input value={ifields.url||''} onChange={e=>setIfields((p:any)=>({...p,url:e.target.value}))} placeholder="https://..." /></div>
                <div className="field"><label>Descrição / observações</label><textarea value={ifields.descricao||''} onChange={e=>setIfields((p:any)=>({...p,descricao:e.target.value}))} placeholder="Ex: Referência de cor, estilo, formato..." /></div>
              </>}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setItemForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={()=>{
                if(itemForm==='otimizacao'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('otimizacoes',ifields)}
                else if(itemForm==='reuniao'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('reunioes',ifields)}
                else if(itemForm==='anotacao'){if(!ifields.texto?.trim())return alert('Escreva a anotação.');addItem('anotacoes',ifields)}
                else if(itemForm==='arquivo'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('arquivos',ifields)}
                else if(itemForm==='criativo'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('criativos',ifields)}
                setItemForm(null)
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
