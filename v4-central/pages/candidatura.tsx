import { useState } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'

const WEBHOOK = 'https://primary-production-3b127.up.railway.app/webhook/candidatura'

const C = {
  bg:'#F2F1EF', card:'#FFFFFF', border:'#E8E6E3', border2:'#D4D1CC',
  red:'#E8002D', redLight:'#FFF0F2', redMid:'#FFCDD5',
  text:'#111111', text2:'#5A5A5A', text3:'#9A9A9A',
  green:'#16A34A', greenBg:'#F0FDF4',
  amber:'#D97706', amberBg:'#FFFBEB',
}

const AREAS: Record<string, { label: string; perguntas: { id: string; q: string }[] }> = {
  social:     { label:'Social Media',      perguntas:[
    { id:'sq1', q:'Quais são as premissas que você usa para fazer um planejamento de social media?' },
    { id:'sq2', q:'Quais métricas você analisa no dia a dia para entender se o conteúdo deu resultado?' },
  ]},
  trafego:    { label:'Gestor de Tráfego', perguntas:[
    { id:'tq1', q:'Quais são as principais plataformas que você gerencia?' },
    { id:'tq2', q:'Quais métricas você analisa para entender se a campanha está performando?' },
  ]},
  designer:   { label:'Designer',          perguntas:[
    { id:'dq1', q:'Descreva como geralmente é o seu processo de criação.' },
    { id:'dq2', q:'Quais são as principais ferramentas que você utiliza no dia a dia?' },
  ]},
  account:    { label:'Account',           perguntas:[
    { id:'aq1', q:'Como você começaria o planejamento de um cliente de contabilidade com objetivo de ir de R$100k para R$200k em 6 meses?' },
    { id:'aq2', q:'Explique o que é matriz SWOT.' },
    { id:'aq3', q:'Na sua opinião, quais são as métricas mais importantes a serem apresentadas para o cliente?' },
  ]},
  comercial:  { label:'Comercial',         perguntas:[
    { id:'cq1', q:'Qual o valor das suas principais taxas comerciais?' },
    { id:'cq2', q:'Como funciona um processo de venda na sua visão?' },
    { id:'cq3', q:'Qual o tempo médio entre o primeiro contato e a assinatura do contrato?' },
  ]},
  financeiro: { label:'Financeiro',        perguntas:[
    { id:'fq1', q:'O que significa conciliação?' },
    { id:'fq2', q:'Quais são os demonstrativos mais importantes para o dia a dia financeiro?' },
    { id:'fq3', q:'Como deve ser a rotina financeira de uma empresa saudável?' },
  ]},
  rh:         { label:'RH',               perguntas:[
    { id:'rq1', q:'Explique o que é Plano de Desenvolvimento Individual.' },
    { id:'rq2', q:'Como você montaria um processo seletivo?' },
    { id:'rq3', q:'Como você se organiza antes de abrir uma vaga e antes de fazer uma entrevista?' },
  ]},
  outro:      { label:'Outro',             perguntas:[] },
}

const CULTURAIS = [
  { id:'c1', q:'O que significa para você ter mentalidade de dono dentro de uma empresa?' },
  { id:'c2', q:'O que te motiva a buscar alta performance no dia a dia?' },
  { id:'c3', q:'Você se considera mais executor(a) ou mais estrategista? Justifique.' },
  { id:'c4', q:'Descreva uma situação em que você teve que agir com autonomia para atingir um resultado.' },
  { id:'c5', q:'Como você lida com metas e cobrança por resultado?' },
  { id:'c6', q:'Quando você está em um projeto em equipe e percebe que algo está atrasado, o que você faz?' },
  { id:'c7', q:'Descreva seu dia ideal de trabalho — como você organiza tarefas, rotina e prioridades.' },
  { id:'c8', q:'O que te faria ficar a longo prazo em uma empresa?' },
]

const STEPS = ['Dados Pessoais','Perguntas da Vaga','Validação Cultural','Confirmação']

// ── Helpers UI ────────────────────────────────────────────────────────────────
const inputStyle = (err?: boolean): React.CSSProperties => ({
  width:'100%', height:42, border:`1.5px solid ${err?C.red:C.border2}`,
  borderRadius:8, padding:'0 12px', fontSize:13, color:C.text,
  background:err?C.redLight:C.bg, fontFamily:'inherit', outline:'none',
  appearance:'none' as any,
})

const taStyle = (err?: boolean): React.CSSProperties => ({
  ...inputStyle(err), height:'auto', minHeight:110, padding:'10px 12px',
  resize:'vertical' as any, lineHeight:1.55,
})

const labelStyle: React.CSSProperties = {
  color:C.text3, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase',
}

function Field({ label, error, children }: { label:string; error?:string; children: React.ReactNode }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <label style={labelStyle}>{label} <span style={{color:C.red}}>*</span></label>
      {children}
      {error && <span style={{color:C.red,fontSize:11}}>{error}</span>}
    </div>
  )
}

function Question({ num, q, id, val, onChange, error }: any) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <label style={{fontSize:13,fontWeight:500,color:C.text,lineHeight:1.5}}>
        <span style={{color:C.red,fontWeight:800,marginRight:6}}>{num}.</span>{q}
        <span style={{color:C.red}}> *</span>
      </label>
      <textarea id={id} value={val} onChange={e=>onChange(id,e.target.value)}
        style={taStyle(!!error)} placeholder="Responda com base na sua experiência real..."/>
      {error && <span style={{color:C.red,fontSize:11}}>{error}</span>}
    </div>
  )
}

export default function CandidaturaPage() {
  const [step, setStep]         = useState(0) // 0-3
  const [done, setDone]         = useState(false)
  const [loading, setLoading]   = useState(false)

  // Step 1
  const [nome,     setNome]     = useState('')
  const [idade,    setIdade]    = useState('')
  const [cidade,   setCidade]   = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [area,     setArea]     = useState('')

  // Step 2 — técnicas
  const [tecnicas, setTecnicas] = useState<Record<string,string>>({})

  // Step 3 — culturais
  const [culturais, setCulturais] = useState<Record<string,string>>({})
  const [processosFuturos, setProcessosFuturos] = useState('')

  // Erros
  const [erros, setErros] = useState<Record<string,string>>({})

  const setRespTec = (id: string, val: string) => {
    setTecnicas(p=>({...p,[id]:val}))
    setErros(p=>{const n={...p}; delete n[id]; return n})
  }
  const setRespCul = (id: string, val: string) => {
    setCulturais(p=>({...p,[id]:val}))
    setErros(p=>{const n={...p}; delete n[id]; return n})
  }

  // ── Validações ──────────────────────────────────────────────────────────────
  function validateStep1() {
    const e: Record<string,string> = {}
    if (!nome.trim())     e.nome     = 'Campo obrigatório'
    if (!idade.trim())    e.idade    = 'Campo obrigatório'
    if (!cidade.trim())   e.cidade   = 'Campo obrigatório'
    if (!linkedin.trim()) e.linkedin = 'Campo obrigatório'
    if (!area)            e.area     = 'Selecione uma área'
    setErros(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const ids = AREAS[area]?.perguntas.map(p=>p.id) || []
    const e: Record<string,string> = {}
    ids.forEach(id => { if (!tecnicas[id]?.trim()) e[id] = 'Resposta obrigatória' })
    setErros(e)
    return Object.keys(e).length === 0
  }

  function validateStep3() {
    const e: Record<string,string> = {}
    CULTURAIS.forEach(c => { if (!culturais[c.id]?.trim()) e[c.id] = 'Resposta obrigatória' })
    if (!processosFuturos) e.processosFuturos = 'Selecione uma opção'
    setErros(e)
    return Object.keys(e).length === 0
  }

  function nextStep() {
    if (step===0 && !validateStep1()) return
    if (step===1 && !validateStep2()) return
    if (step===2 && !validateStep3()) return
    setStep(s=>s+1)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  function prevStep() { setStep(s=>s-1); window.scrollTo({top:0,behavior:'smooth'}) }

  async function handleSubmit() {
    setLoading(true)
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        dados_pessoais: { nome, idade, cidade, linkedin, area: AREAS[area]?.label||area },
        respostas_tecnicas: tecnicas,
        respostas_culturais: {
          ...Object.fromEntries(CULTURAIS.map(c=>[c.id, culturais[c.id]||''])),
          processos_futuros: processosFuturos,
        },
      }
      const r = await fetch(WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
      if (!r.ok) throw new Error('Erro no envio')
      setDone(true)
    } catch {
      alert('Erro ao enviar. Verifique sua conexão e tente novamente.')
    } finally { setLoading(false) }
  }

  // ── Progress bar ─────────────────────────────────────────────────────────────
  const Progress = () => (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
      padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:0}}>
      {STEPS.map((s,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',flex:i<STEPS.length-1?1:'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <div style={{
              width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',
              justifyContent:'center',fontSize:12,fontWeight:800,flexShrink:0,
              background: done||i<step ? C.green : i===step ? C.red : C.border2,
              color: done||i<step||i===step ? '#fff' : C.text3,
            }}>
              {done||i<step ? '✓' : i+1}
            </div>
            <span style={{
              fontSize:12, fontWeight:i===step?700:500,
              color: done||i<step ? C.green : i===step ? C.text : C.text3,
              whiteSpace:'nowrap',
            }}>{s}</span>
          </div>
          {i<STEPS.length-1 && (
            <div style={{flex:1,height:1,background:i<step?C.green:C.border2,margin:'0 12px'}}/>
          )}
        </div>
      ))}
    </div>
  )

  // ── Botões de navegação ───────────────────────────────────────────────────────
  const NavButtons = ({ onNext, nextLabel='Próximo →', isSubmit=false }: any) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      marginTop:28,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
      {step > 0
        ? <button onClick={prevStep} style={{background:'transparent',color:C.text2,
            border:`1px solid ${C.border2}`,borderRadius:8,padding:'10px 20px',
            fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            ← Voltar
          </button>
        : <div/>
      }
      <button onClick={onNext} disabled={loading} style={{
        background:isSubmit?C.text:C.red, color:'#fff',border:'none',borderRadius:8,
        padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer',
        fontFamily:'inherit',display:'flex',alignItems:'center',gap:8,
        opacity:loading?0.7:1}}>
        {loading && <span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',
          borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',
          display:'inline-block'}}/>}
        {loading ? 'Enviando…' : nextLabel}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Sucesso ──────────────────────────────────────────────────────────────────
  if (done) return (
    <>
      <Head><title>Candidatura enviada — V4 Central</title></Head>
      <Layout title="Formulário de Candidatura">
        <div style={{maxWidth:560,margin:'60px auto',textAlign:'center'}}>
          <div style={{width:72,height:72,background:C.greenBg,borderRadius:16,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:32,margin:'0 auto 20px'}}>✅</div>
          <h2 style={{color:C.text,fontSize:22,fontWeight:800,marginBottom:10}}>Candidatura enviada!</h2>
          <p style={{color:C.text3,fontSize:14,lineHeight:1.6}}>
            Obrigado por compartilhar seu perfil com a gente. Em caso de aderência com uma vaga atual ou futura, entraremos em contato.
          </p>
        </div>
      </Layout>
    </>
  )

  return (
    <>
      <Head><title>Formulário de Candidatura — V4 Central</title></Head>
      <Layout title="Formulário de Candidatura">
        <div style={{maxWidth:700,margin:'0 auto'}}>
          <Progress/>

          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
            padding:'24px 28px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>

            {/* ── ETAPA 1: Dados Pessoais ──────────────────────────────────── */}
            {step===0 && (
              <>
                <div style={{marginBottom:24,paddingBottom:20,borderBottom:`1px solid ${C.border}`}}>
                  <p style={{color:C.red,fontSize:10,fontWeight:800,letterSpacing:2,textTransform:'uppercase',margin:'0 0 4px'}}>
                    Etapa 01 — Identificação
                  </p>
                  <h3 style={{color:C.text,fontSize:17,fontWeight:800,margin:'0 0 4px'}}>Dados Pessoais</h3>
                  <p style={{color:C.text3,fontSize:12,margin:0}}>Preencha suas informações básicas para iniciarmos o processo.</p>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div style={{gridColumn:'1/-1'}}>
                    <Field label="Nome completo" error={erros.nome}>
                      <input value={nome} onChange={e=>{setNome(e.target.value);setErros(p=>{const n={...p};delete n.nome;return n})}}
                        placeholder="Seu nome completo" style={inputStyle(!!erros.nome)}/>
                    </Field>
                  </div>
                  <Field label="Idade" error={erros.idade}>
                    <input type="number" value={idade} onChange={e=>{setIdade(e.target.value);setErros(p=>{const n={...p};delete n.idade;return n})}}
                      placeholder="Sua idade" min={16} max={80} style={inputStyle(!!erros.idade)}/>
                  </Field>
                  <Field label="Cidade / Estado" error={erros.cidade}>
                    <input value={cidade} onChange={e=>{setCidade(e.target.value);setErros(p=>{const n={...p};delete n.cidade;return n})}}
                      placeholder="Ex: Goiânia / GO" style={inputStyle(!!erros.cidade)}/>
                  </Field>
                  <div style={{gridColumn:'1/-1'}}>
                    <Field label="LinkedIn" error={erros.linkedin}>
                      <input value={linkedin} onChange={e=>{setLinkedin(e.target.value);setErros(p=>{const n={...p};delete n.linkedin;return n})}}
                        placeholder="linkedin.com/in/seuperfil" style={inputStyle(!!erros.linkedin)}/>
                    </Field>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <Field label="Área de interesse" error={erros.area}>
                      <select value={area} onChange={e=>{setArea(e.target.value);setErros(p=>{const n={...p};delete n.area;return n})}}
                        style={{...inputStyle(!!erros.area),cursor:'pointer'}}>
                        <option value="">Selecione uma área...</option>
                        {Object.entries(AREAS).map(([k,v])=>(
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
                <NavButtons onNext={nextStep}/>
              </>
            )}

            {/* ── ETAPA 2: Perguntas Técnicas ──────────────────────────────── */}
            {step===1 && (
              <>
                <div style={{marginBottom:24,paddingBottom:20,borderBottom:`1px solid ${C.border}`}}>
                  <p style={{color:C.red,fontSize:10,fontWeight:800,letterSpacing:2,textTransform:'uppercase',margin:'0 0 4px'}}>
                    Etapa 02 — {AREAS[area]?.label}
                  </p>
                  <h3 style={{color:C.text,fontSize:17,fontWeight:800,margin:'0 0 4px'}}>Perguntas da Vaga</h3>
                  <p style={{color:C.text3,fontSize:12,margin:0}}>Responda com base na sua experiência real.</p>
                </div>

                {AREAS[area]?.perguntas.length === 0
                  ? <div style={{background:C.bg,borderRadius:8,padding:'16px',color:C.text3,fontSize:13,lineHeight:1.5}}>
                      Você selecionou <strong style={{color:C.text}}>"Outro"</strong> — não há perguntas técnicas específicas. Você seguirá direto para as perguntas de validação cultural.
                    </div>
                  : <div style={{display:'flex',flexDirection:'column',gap:20}}>
                      {AREAS[area].perguntas.map((p,i)=>(
                        <Question key={p.id} num={i+1} q={p.q} id={p.id}
                          val={tecnicas[p.id]||''} onChange={setRespTec} error={erros[p.id]}/>
                      ))}
                    </div>
                }
                <NavButtons onNext={nextStep}/>
              </>
            )}

            {/* ── ETAPA 3: Culturais ───────────────────────────────────────── */}
            {step===2 && (
              <>
                <div style={{marginBottom:24,paddingBottom:20,borderBottom:`1px solid ${C.border}`}}>
                  <p style={{color:C.red,fontSize:10,fontWeight:800,letterSpacing:2,textTransform:'uppercase',margin:'0 0 4px'}}>
                    Etapa 03 — Cultura
                  </p>
                  <h3 style={{color:C.text,fontSize:17,fontWeight:800,margin:'0 0 4px'}}>Validação Cultural</h3>
                  <p style={{color:C.text3,fontSize:12,margin:0}}>Essas perguntas nos ajudam a entender sua mentalidade e forma de trabalhar.</p>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {CULTURAIS.map((c,i)=>(
                    <Question key={c.id} num={i+1} q={c.q} id={c.id}
                      val={culturais[c.id]||''} onChange={setRespCul} error={erros[c.id]}/>
                  ))}
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <label style={{fontSize:13,fontWeight:500,color:C.text,lineHeight:1.5}}>
                      <span style={{color:C.red,fontWeight:800,marginRight:6}}>9.</span>
                      Você está aberto(a) a processos futuros, caso não haja vaga imediata?
                      <span style={{color:C.red}}> *</span>
                    </label>
                    <select value={processosFuturos} onChange={e=>{setProcessosFuturos(e.target.value);setErros(p=>{const n={...p};delete n.processosFuturos;return n})}}
                      style={{...inputStyle(!!erros.processosFuturos),cursor:'pointer'}}>
                      <option value="">Selecione...</option>
                      <option value="Sim">Sim, tenho interesse em processos futuros</option>
                      <option value="Não">Não, preciso de uma oportunidade imediata</option>
                    </select>
                    {erros.processosFuturos && <span style={{color:C.red,fontSize:11}}>{erros.processosFuturos}</span>}
                  </div>
                </div>
                <NavButtons onNext={nextStep}/>
              </>
            )}

            {/* ── ETAPA 4: Revisão ─────────────────────────────────────────── */}
            {step===3 && (
              <>
                <div style={{marginBottom:24,paddingBottom:20,borderBottom:`1px solid ${C.border}`}}>
                  <p style={{color:C.red,fontSize:10,fontWeight:800,letterSpacing:2,textTransform:'uppercase',margin:'0 0 4px'}}>
                    Etapa 04 — Confirmação
                  </p>
                  <h3 style={{color:C.text,fontSize:17,fontWeight:800,margin:'0 0 4px'}}>Pronto para enviar!</h3>
                  <p style={{color:C.text3,fontSize:12,margin:0}}>Revise os dados abaixo antes de confirmar sua candidatura.</p>
                </div>

                <div style={{background:C.bg,borderRadius:10,padding:'18px 20px',
                  display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
                  {[['Nome',nome],['Idade',`${idade} anos`],['Cidade/UF',cidade],
                    ['LinkedIn',linkedin],['Área',AREAS[area]?.label||area]].map(([k,v])=>(
                    <div key={k} style={{display:'flex',gap:12,fontSize:13}}>
                      <span style={{color:C.text3,fontWeight:700,minWidth:80}}>{k}</span>
                      <span style={{color:C.text}}>{v}</span>
                    </div>
                  ))}
                  <div style={{borderTop:`1px solid ${C.border2}`,paddingTop:10,marginTop:4,
                    color:C.text3,fontSize:11}}>
                    + {AREAS[area]?.perguntas.length} perguntas técnicas · 9 perguntas culturais respondidas ✓
                  </div>
                </div>

                <div style={{background:C.amberBg,border:`1px solid ${C.amber}33`,borderRadius:8,
                  padding:'12px 14px',fontSize:13,color:'#5D4037',lineHeight:1.5}}>
                  ⚠️ Ao enviar, você confirma que todas as informações prestadas são verdadeiras.
                </div>

                <NavButtons onNext={handleSubmit} nextLabel="Enviar candidatura →" isSubmit/>
              </>
            )}

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
