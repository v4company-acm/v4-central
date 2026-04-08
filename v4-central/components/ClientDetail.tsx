import { useState } from 'react'

function fmtDate(d: string) { if(!d||d==='-') return '—'; try{const[y,m,day]=d.split('-');return`${day}/${m}/${y}`}catch{return d} }
function fmtR(v: any) { if(!v&&v!==0) return '—'; return 'R$'+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2}) }

const TABS = [{k:'dados',l:'Dados'},{k:'equipe',l:'Equipe'},{k:'links',l:'Links'},{k:'metricas',l:'Métricas'},{k:'otimizacoes',l:'Otimizações'},{k:'reunioes',l:'Reuniões'},{k:'anotacoes',l:'Anotações'}]

interface Props { client: any; onUpdate: (c: any) => void }

export default function ClientDetail({ client: c, onUpdate }: Props) {
  const [tab, setTab] = useState('dados')
  const [itemForm, setItemForm] = useState<any>(null)
  const [metForm, setMetForm] = useState(false)
  const [ifields, setIfields] = useState<any>({})
  const [mfields, setMfields] = useState<any>(c.metricas||{})

  const cats = [c.catSaber&&'Saber',c.catTer&&'Ter',c.catExecutar&&'Executar'].filter(Boolean).join(', ')||'—'

  function addItem(field: string, item: any) {
    const updated = { ...c, [field]: [item, ...(c[field]||[])] }
    onUpdate(updated)
  }
  function removeItem(field: string, idx: number) {
    if (!confirm('Remover?')) return
    const arr = [...(c[field]||[])]
    arr.splice(idx, 1)
    onUpdate({ ...c, [field]: arr })
  }
  function saveMetricas() {
    onUpdate({ ...c, metricas: mfields })
    setMetForm(false)
  }

  return (
    <div className="detail-card">
      <div className="detail-tabs">
        {TABS.map(t => <button key={t.k} className={`detail-tab ${tab===t.k?'active':''}`} onClick={()=>setTab(t.k)}>{t.l}</button>)}
      </div>

      <div className="detail-body">
        {tab==='dados' && (
          <>
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
          </>
        )}

        {tab==='equipe' && (
          <>
            <div className="sec-title">Equipe V4</div>
            <div className="info-row"><span className="info-key">Estrategista</span><span className="info-val">{c.estrategista||'—'}</span></div>
            <div className="info-row"><span className="info-key">Gestor de tráfego</span><span className="info-val">{c.gestor||'—'}</span></div>
            <div className="info-row"><span className="info-key">Account</span><span className="info-val">{c.account||'—'}</span></div>
            <div className="sec-title" style={{marginTop:16}}>Equipe de vendas</div>
            <div className="info-row"><span className="info-key">Closer</span><span className="info-val">{c.closer||'—'}</span></div>
            <div className="info-row"><span className="info-key">SDR</span><span className="info-val">{c.sdr||'—'}</span></div>
          </>
        )}

        {tab==='links' && (
          <>
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
          </>
        )}

        {tab==='metricas' && (
          <>
            <div className="stat-grid">
              <div className="stat-box"><div className="stat-lbl">ROAS médio</div><div className="stat-val">{c.metricas?.roas||'—'}</div></div>
              <div className="stat-box"><div className="stat-lbl">CPL médio</div><div className="stat-val">{c.metricas?.cpl?'R$'+c.metricas.cpl:'—'}</div></div>
              <div className="stat-box"><div className="stat-lbl">Leads gerados</div><div className="stat-val">{c.metricas?.leads||'—'}</div></div>
            </div>
            <div style={{marginBottom:16}}><div className="stat-box" style={{display:'inline-block',minWidth:160}}><div className="stat-lbl">Investimento total</div><div className="stat-val">{c.metricas?.invest?fmtR(c.metricas.invest):'—'}</div></div></div>
            {!metForm
              ? <button className="btn btn-sm" onClick={()=>{setMfields(c.metricas||{});setMetForm(true)}}>Atualizar métricas</button>
              : <div style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:8,padding:16}}>
                  <div className="form-grid-2" style={{marginBottom:10}}>
                    <div className="field"><label>ROAS médio</label><input value={mfields.roas||''} onChange={e=>setMfields((p:any)=>({...p,roas:e.target.value}))} /></div>
                    <div className="field"><label>CPL médio (R$)</label><input type="number" value={mfields.cpl||''} onChange={e=>setMfields((p:any)=>({...p,cpl:e.target.value}))} /></div>
                    <div className="field"><label>Leads gerados</label><input type="number" value={mfields.leads||''} onChange={e=>setMfields((p:any)=>({...p,leads:e.target.value}))} /></div>
                    <div className="field"><label>Investimento total (R$)</label><input type="number" value={mfields.invest||''} onChange={e=>setMfields((p:any)=>({...p,invest:e.target.value}))} /></div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-sm" onClick={()=>setMetForm(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={saveMetricas}>Salvar</button>
                  </div>
                </div>
            }
          </>
        )}

        {tab==='otimizacoes' && (
          <>
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
          </>
        )}

        {tab==='reunioes' && (
          <>
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
          </>
        )}

        {tab==='anotacoes' && (
          <>
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
          </>
        )}
      </div>

      {itemForm && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setItemForm(null)}}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>{{otimizacao:'Nova otimização',reuniao:'Nova reunião',anotacao:'Nova anotação',arquivo:'Novo link'}[itemForm]}</h3>
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
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setItemForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={()=>{
                if(itemForm==='otimizacao'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('otimizacoes',ifields)}
                else if(itemForm==='reuniao'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('reunioes',ifields)}
                else if(itemForm==='anotacao'){if(!ifields.texto?.trim())return alert('Escreva a anotação.');addItem('anotacoes',ifields)}
                else if(itemForm==='arquivo'){if(!ifields.titulo?.trim())return alert('Informe o título.');addItem('arquivos',ifields)}
                setItemForm(null)
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
