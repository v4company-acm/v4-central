import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from "recharts";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pqzojyhyqzizgudrdkhr.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxem9qeWh5cXppemd1ZHJka2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzE1ODYsImV4cCI6MjA5MjYwNzU4Nn0.dn4wXlLiPh7Nti0ybBbg1OApGlADK2agOEJsRbcAhwA";

const sb = async (table, select = "*", qs = "") => {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?select=${select}${qs}&limit=3000`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`Erro ${table}: ${r.status}`);
  return r.json();
};

const C = {
  topbar:"#1C0A0A", bg:"#F4F3F1", card:"#FFFFFF",
  border:"#E8E6E3", border2:"#D4D1CC",
  red:"#E8002D", redLight:"#FFF0F2", redMid:"#FFCDD5",
  text:"#1A1A1A", text2:"#666666", text3:"#AAAAAA",
  green:"#16A34A", greenBg:"#F0FDF4",
  orange:"#EA580C", orangeBg:"#FFF7ED",
  amber:"#D97706", amberBg:"#FFFBEB",
  blue:"#2563EB", blueBg:"#EFF6FF",
  purple:"#7C3AED", purpleBg:"#F5F3FF",
  cyan:"#0891B2", cyanBg:"#ECFEFF",
};

const PALETTE = [C.red,C.blue,C.green,C.amber,C.purple,C.cyan,"#DB2777","#059669"];

const fmtH = m => { const h=Math.floor((m||0)/60),mm=(m||0)%60; return mm?`${h}h${String(mm).padStart(2,"0")}m`:`${h}h`; };
const fmtR = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtPct = v => `${Math.round(v||0)}%`;
const toISO = d => d.toISOString().split("T")[0];
const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const today = () => toISO(new Date());
const daysAgo = n => toISO(addDays(new Date(),-n));

const PRESETS = [
  {label:"Hoje",    from:today(),     to:today()  },
  {label:"7 dias",  from:daysAgo(7),  to:today()  },
  {label:"30 dias", from:daysAgo(30), to:today()  },
  {label:"90 dias", from:daysAgo(90), to:today()  },
];

const SIT_LABEL = {10:"Ativa",20:"Pausada",30:"Concluída",40:"Cancelada"};

// ── Micro componentes ─────────────────────────────────────────────────────────
const Tag = ({label,color,bg}) => (
  <span style={{background:bg||`${color}18`,color,border:`1px solid ${color}33`,
    borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
    {label}
  </span>
);

const SectionTitle = ({children}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
    <div style={{width:7,height:7,borderRadius:"50%",background:C.red,flexShrink:0}}/>
    <h2 style={{color:C.red,fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",margin:0}}>{children}</h2>
  </div>
);

const Card = ({children,style={}}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
    padding:"20px 22px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",...style}}>
    {children}
  </div>
);

const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,
      padding:"10px 14px",fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,.12)"}}>
      {label&&<p style={{color:C.text2,marginBottom:6,fontSize:11}}>{label}</p>}
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color||C.text,fontWeight:700,margin:"2px 0"}}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const Kpi = ({label,value,sub,color=C.red,icon,alert}) => (
  <div style={{background:C.card,border:`1px solid ${alert?color:C.border}`,borderRadius:10,
    padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,.05)",borderTop:`3px solid ${color}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
      <p style={{color:C.text2,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",margin:0}}>{label}</p>
      {icon&&<span style={{fontSize:14,opacity:.3}}>{icon}</span>}
    </div>
    <p style={{color:C.text,fontSize:26,fontWeight:900,margin:0,letterSpacing:-0.5}}>{value}</p>
    {sub&&<p style={{color:C.text3,fontSize:11,margin:"5px 0 0"}}>{sub}</p>}
  </div>
);

const MiniCard = ({label,value,color,bg}) => (
  <div style={{background:bg,border:`1px solid ${color}22`,borderRadius:10,padding:"14px 18px"}}>
    <p style={{color,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",margin:"0 0 8px"}}>{label}</p>
    <p style={{color:C.text,fontSize:22,fontWeight:900,margin:0}}>{value}</p>
  </div>
);

const Progress = ({value,max,color=C.red}) => {
  const pct=max>0?Math.min(100,(value/max)*100):0;
  return (
    <div style={{background:C.border,borderRadius:4,height:5,overflow:"hidden"}}>
      <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:4,transition:"width .8s ease"}}/>
    </div>
  );
};

const Avatar = ({name,size=30}) => {
  const colors=[C.red,C.blue,C.green,C.amber,C.purple,C.cyan,"#DB2777","#059669"];
  const idx=(name?.charCodeAt(0)||0)%colors.length;
  const initials=name?.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:colors[idx],
      display:"flex",alignItems:"center",justifyContent:"center",
      color:"#fff",fontSize:size*.36,fontWeight:800,flexShrink:0}}>
      {initials}
    </div>
  );
};

const MultiSelect = ({label,options,value,onChange}) => {
  const [open,setOpen]=useState(false);
  const toggle=v=>value.includes(v)?onChange(value.filter(x=>x!==v)):onChange([...value,v]);
  const hasVal=value.length>0;
  useEffect(()=>{
    if(!open) return;
    const close=()=>setOpen(false);
    document.addEventListener("click",close);
    return ()=>document.removeEventListener("click",close);
  },[open]);
  return (
    <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:hasVal?C.redLight:C.card,color:hasVal?C.red:C.text2,
        border:`1px solid ${hasVal?C.red:C.border2}`,borderRadius:7,
        padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",
        display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
        {label}{hasVal?` (${value.length})`:""}<span style={{fontSize:8,opacity:.5}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:999,
          background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
          minWidth:210,maxHeight:260,overflowY:"auto",padding:6,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)"}}>
          <button onClick={()=>{onChange([]);setOpen(false);}} style={{
            width:"100%",background:value.length===0?C.redLight:"transparent",
            color:value.length===0?C.red:C.text2,border:"none",borderRadius:6,
            padding:"7px 10px",fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left",marginBottom:2}}>
            Todos
          </button>
          {options.map(o=>{
            const sel=value.includes(o);
            return (
              <button key={o} onClick={()=>toggle(o)} style={{
                width:"100%",background:sel?C.redLight:"transparent",color:sel?C.red:C.text,
                border:"none",borderRadius:6,padding:"7px 10px",fontSize:12,cursor:"pointer",
                textAlign:"left",display:"flex",justifyContent:"space-between"}}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:165}}>{o}</span>
                {sel&&<span style={{color:C.red,fontWeight:700}}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Produtividade() {
  const [preset,setPreset]         = useState(2);
  const [dateFrom,setDateFrom]     = useState(daysAgo(30));
  const [dateTo,setDateTo]         = useState(today());
  const [customDate,setCustomDate] = useState(false);
  const [execFil,setExecFil]       = useState([]);
  const [wsFil,setWsFil]           = useState([]);
  const [typeFil,setTypeFil]       = useState([]);
  const [rawTarefas,setRawTarefas]   = useState([]);
  const [rawProjetos,setRawProjetos] = useState([]);
  const [rawHoras,setRawHoras]       = useState([]);
  const [loading,setLoading]         = useState(true);
  const [err,setErr]                 = useState(null);

  useEffect(()=>{
    const load=async()=>{
      setLoading(true); setErr(null);
      try {
        const [t,p,h]=await Promise.all([
          sb("ekyte_tarefas","*",`&creation_date=gte.${dateFrom}&creation_date=lte.${dateTo}T23:59:59`),
          sb("ekyte_projetos","*"),
          sb("ekyte_horas","*",`&date=gte.${dateFrom}&date=lte.${dateTo}`),
        ]);
        setRawTarefas(t||[]); setRawProjetos(p||[]); setRawHoras(h||[]);
      } catch(e){ setErr(e.message); }
      finally{ setLoading(false); }
    };
    load();
  },[dateFrom,dateTo]);

  const optsExec = useMemo(()=>[...new Set(rawHoras.map(h=>h.executor).filter(Boolean))].sort(),[rawHoras]);
  const optsWs   = useMemo(()=>[...new Set(rawHoras.map(h=>h.workspace).filter(Boolean))].sort(),[rawHoras]);
  const optsType = useMemo(()=>[...new Set(rawHoras.map(h=>h.entry_type).filter(Boolean))].sort(),[rawHoras]);

  const horas = useMemo(()=>rawHoras.filter(h=>{
    if(execFil.length && !execFil.includes(h.executor))   return false;
    if(wsFil.length   && !wsFil.includes(h.workspace))    return false;
    if(typeFil.length && !typeFil.includes(h.entry_type)) return false;
    return true;
  }),[rawHoras,execFil,wsFil,typeFil]);

  const tarefas = useMemo(()=>rawTarefas.filter(t=>{
    if(execFil.length && !execFil.includes(t.executor))  return false;
    if(wsFil.length   && !wsFil.includes(t.workspace))   return false;
    return true;
  }),[rawTarefas,execFil,wsFil]);

  const applyPreset=i=>{setPreset(i);setCustomDate(false);setDateFrom(PRESETS[i].from);setDateTo(PRESETS[i].to);};

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalMin      = useMemo(()=>horas.reduce((s,h)=>s+(h.minutes||0),0),[horas]);
  const custoRealizado= useMemo(()=>horas.reduce((s,h)=>s+(h.accomplished_rate||0),0),[horas]);
  const concluidas    = useMemo(()=>tarefas.filter(t=>t.situation===30).length,[tarefas]);
  const taxaConcl     = tarefas.length?Math.round((concluidas/tarefas.length)*100):0;
  const projAtivos    = useMemo(()=>rawProjetos.filter(p=>p.status===10).length,[rawProjetos]);
  const diasPer       = Math.max(1,Math.ceil((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24)));
  const mediaDia      = (totalMin/60/diasPer).toFixed(1);

  // ── Breakdown por tipo (task/ticket/avulso) ───────────────────────────────
  const byType = useMemo(()=>{
    const acc={task:0,ticket:0,avulso:0};
    horas.forEach(h=>{ const k=h.entry_type||"avulso"; acc[k]=(acc[k]||0)+(h.minutes||0); });
    return [
      {name:"Tarefas",  horas:+(acc.task/60).toFixed(1),   color:C.blue,   bg:C.blueBg},
      {name:"Tickets",  horas:+(acc.ticket/60).toFixed(1), color:C.purple, bg:C.purpleBg},
      {name:"Avulso",   horas:+(acc.avulso/60).toFixed(1), color:C.text3,  bg:"#F5F5F5"},
    ];
  },[horas]);

  // ── Horas por situação de tarefa ─────────────────────────────────────────
  const tarefasMap = useMemo(()=>{
    const m={};
    rawTarefas.forEach(t=>{ m[t.ekyte_id]=t; });
    return m;
  },[rawTarefas]);

  const horasPorSit = useMemo(()=>{
    const acc={};
    horas.forEach(h=>{
      const t=tarefasMap[h.task_id];
      const label=h.entry_type==="ticket"?"Ticket":
                  h.entry_type==="avulso"?"Avulso":
                  SIT_LABEL[t?.situation]||"Sem vínculo";
      acc[label]=(acc[label]||0)+(h.minutes||0);
    });
    return Object.entries(acc).map(([name,min])=>({name,horas:+(min/60).toFixed(1)})).sort((a,b)=>b.horas-a.horas);
  },[horas,tarefasMap]);

  const horasConcl  = useMemo(()=>horas.filter(h=>tarefasMap[h.task_id]?.situation===30).reduce((s,h)=>s+(h.minutes||0),0),[horas,tarefasMap]);
  const eficiencia  = totalMin>0?Math.round((horasConcl/totalMin)*100):0;

  // ── Horas por workspace ───────────────────────────────────────────────────
  const horasPorWs = useMemo(()=>
    Object.entries(horas.reduce((a,h)=>{
      const k=h.workspace||"Sem cliente";
      if(!a[k]) a[k]={min:0,custo:0};
      a[k].min+=(h.minutes||0);
      a[k].custo+=(h.accomplished_rate||0);
      return a;
    },{}))
    .map(([name,v])=>({name,horas:+(v.min/60).toFixed(1),custo:+v.custo.toFixed(2)}))
    .sort((a,b)=>b.horas-a.horas).slice(0,10)
  ,[horas]);

  // ── Ranking executores ────────────────────────────────────────────────────
  const horasPorExec = useMemo(()=>
    Object.entries(horas.reduce((a,h)=>{
      const k=h.executor||"?";
      if(!a[k]) a[k]={min:0,custo:0};
      a[k].min+=(h.minutes||0);
      a[k].custo+=(h.accomplished_rate||0);
      return a;
    },{}))
    .map(([name,v])=>({name,horas:+(v.min/60).toFixed(1),custo:+v.custo.toFixed(2)}))
    .sort((a,b)=>b.horas-a.horas)
  ,[horas]);

  const maxExec = horasPorExec[0]?.horas||1;

  // ── Tarefas por situação ──────────────────────────────────────────────────
  const tarefasPorSit = useMemo(()=>
    Object.entries(tarefas.reduce((a,t)=>{const k=SIT_LABEL[t.situation]||"Outro";a[k]=(a[k]||0)+1;return a},{}))
    .map(([name,value])=>({name,value}))
  ,[tarefas]);

  // ── Tarefas por fase ──────────────────────────────────────────────────────
  const tarefasPorFase = useMemo(()=>
    Object.entries(tarefas.reduce((a,t)=>{const k=t.phase||"Sem etapa";a[k]=(a[k]||0)+1;return a},{}))
    .map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,8)
  ,[tarefas]);

  // ── Tendência diária ──────────────────────────────────────────────────────
  const trend = useMemo(()=>{
    const map=horas.reduce((a,h)=>{const k=h.date?.split("T")[0];if(!k)return a;a[k]=(a[k]||0)+(h.minutes||0);return a},{});
    return Object.entries(map).map(([date,min])=>({date,horas:+(min/60).toFixed(1)})).sort((a,b)=>a.date.localeCompare(b.date));
  },[horas]);

  // ── Tabela custo por cliente ──────────────────────────────────────────────
  const custoCliente = useMemo(()=>
    horasPorWs.map(w=>({...w,
      tarefas:tarefas.filter(t=>t.workspace===w.name).length,
      concl:tarefas.filter(t=>t.workspace===w.name&&t.situation===30).length,
    })).sort((a,b)=>b.custo-a.custo)
  ,[horasPorWs,tarefas]);

  const totalCusto = custoCliente.reduce((s,c)=>s+c.custo,0);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>
      <div style={{height:4,background:C.topbar}}/>

      {/* HEADER */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"0 28px",
        display:"flex",alignItems:"center",justifyContent:"space-between",height:56,
        position:"sticky",top:4,zIndex:200,boxShadow:"0 1px 3px rgba(0,0,0,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:36,height:36,background:C.red,borderRadius:8,display:"flex",
            alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:900}}>V4</div>
          <div>
            <p style={{color:C.text3,fontSize:10,letterSpacing:1,margin:0}}>ACM&Co</p>
            <p style={{color:C.text,fontSize:14,fontWeight:700,margin:0}}>Produtividade da Equipe</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {PRESETS.map((p,i)=>(
            <button key={i} onClick={()=>applyPreset(i)} style={{
              background:!customDate&&preset===i?C.red:"transparent",
              color:!customDate&&preset===i?"#fff":C.text2,
              border:`1px solid ${!customDate&&preset===i?C.red:C.border2}`,
              borderRadius:7,padding:"5px 13px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>
              {p.label}
            </button>
          ))}
          <button onClick={()=>setCustomDate(v=>!v)} style={{
            background:customDate?C.redLight:"transparent",color:customDate?C.red:C.text2,
            border:`1px solid ${customDate?C.red:C.border2}`,
            borderRadius:7,padding:"5px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Personalizado
          </button>
          {!loading&&!err&&(
            <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:8}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>
              <span style={{color:C.text3,fontSize:10}}>Sincronizado</span>
            </div>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,
        padding:"10px 28px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        {customDate&&(<>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:7,padding:"6px 10px",fontSize:12}}/>
          <span style={{color:C.text3,fontSize:12}}>até</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:7,padding:"6px 10px",fontSize:12}}/>
          <div style={{width:1,height:22,background:C.border2}}/>
        </>)}
        <MultiSelect label="Executor"    options={optsExec} value={execFil}  onChange={setExecFil}/>
        <MultiSelect label="Cliente"     options={optsWs}   value={wsFil}    onChange={setWsFil}/>
        <MultiSelect label="Tipo"        options={optsType} value={typeFil}  onChange={setTypeFil}/>
        {(execFil.length||wsFil.length||typeFil.length)?
          <button onClick={()=>{setExecFil([]);setWsFil([]);setTypeFil([]);}} style={{
            background:"transparent",color:C.text3,border:`1px solid ${C.border}`,
            borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>
            ✕ Limpar
          </button>:null}
      </div>

      {/* CONTEÚDO */}
      <div style={{padding:"24px 28px",maxWidth:1600,margin:"0 auto"}}>
        {loading&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:360,gap:14}}>
            <div style={{width:36,height:36,border:`3px solid ${C.border2}`,borderTop:`3px solid ${C.red}`,
              borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
            <p style={{color:C.text3,fontSize:13}}>Carregando...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {err&&(
          <div style={{background:C.redLight,border:`1px solid ${C.redMid}`,borderRadius:10,
            padding:16,color:C.red,marginBottom:20,fontSize:13}}>⚠ {err}</div>
        )}

        {!loading&&!err&&(<>

          {/* ── KPIs ── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12,marginBottom:20}}>
            <Kpi label="Horas Totais"     value={fmtH(totalMin)}      sub={`${mediaDia}h/dia média`}           color={C.red}    icon="⏱"/>
            <Kpi label="Custo Realizado"  value={fmtR(custoRealizado)} sub="calculado pelo Ekyte"              color={C.amber}  icon="💰"/>
            <Kpi label="Tarefas"          value={tarefas.length}       sub={`${concluidas} concluídas`}         color={C.blue}   icon="✓"/>
            <Kpi label="Taxa Conclusão"   value={fmtPct(taxaConcl)}    sub="das tarefas do período"            color={taxaConcl>60?C.green:C.orange} icon="%"/>
            <Kpi label="Eficiência"       value={fmtPct(eficiencia)}   sub="horas em tarefas concluídas"       color={eficiencia>50?C.green:C.orange} icon="◎"/>
            <Kpi label="Projetos Ativos"  value={projAtivos}           sub={`de ${rawProjetos.length} total`}  color={C.purple} icon="◈"/>
          </div>

          {/* ── BREAKDOWN TIPO + SITUAÇÃO ── */}
          <div style={{marginBottom:20}}>
            <Card>
              <SectionTitle>Distribuição de Horas</SectionTitle>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr) 2fr",gap:16,alignItems:"start"}}>
                {byType.map((t,i)=>(
                  <MiniCard key={i} label={t.name} value={fmtH(t.horas*60)} color={t.color} bg={t.bg}/>
                ))}
                <div style={{background:C.redLight,border:`1px solid ${C.redMid}`,borderRadius:10,padding:"14px 18px"}}>
                  <p style={{color:C.red,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",margin:"0 0 8px"}}>Em tarefas concluídas</p>
                  <p style={{color:C.text,fontSize:22,fontWeight:900,margin:0}}>{fmtH(horasConcl)}</p>
                  <p style={{color:C.text3,fontSize:11,margin:"4px 0 0"}}>{fmtPct(eficiencia)} do total apontado</p>
                </div>
              </div>
              <div style={{marginTop:20}}>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={horasPorSit} barSize={40}>
                    <XAxis dataKey="name" tick={{fill:C.text2,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false} width={28}/>
                    <Tooltip content={<Tip/>} formatter={v=>`${v}h`}/>
                    <Bar dataKey="horas" name="Horas" radius={[6,6,0,0]}>
                      {horasPorSit.map((e,i)=>{
                        const cols={"Concluída":C.green,"Ativa":C.blue,"Pausada":C.amber,
                                    "Ticket":C.purple,"Avulso":C.text3,"Sem vínculo":C.cyan};
                        return <Cell key={i} fill={cols[e.name]||PALETTE[i%PALETTE.length]}/>;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* ── TENDÊNCIA ── */}
          <div style={{marginBottom:20}}>
            <Card>
              <SectionTitle>Evolução de Horas no Período</SectionTitle>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={trend} margin={{top:4,right:8,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.red} stopOpacity={.12}/>
                      <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}
                    tickFormatter={d=>d.slice(5)} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false} width={28}/>
                  <Tooltip content={<Tip/>}/>
                  <Area type="monotone" dataKey="horas" stroke={C.red} strokeWidth={2}
                    fill="url(#gA)" name="Horas" dot={false} activeDot={{r:4,fill:C.red,stroke:"#fff",strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── HORAS POR CLIENTE + RANKING ── */}
          <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:20}}>
            <Card>
              <SectionTitle>Horas & Custo por Cliente</SectionTitle>
              <ResponsiveContainer width="100%" height={Math.max(200,horasPorWs.length*38)}>
                <BarChart data={horasPorWs} layout="vertical" barSize={13} barGap={4}>
                  <XAxis type="number" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis dataKey="name" type="category" tick={{fill:C.text2,fontSize:10}} axisLine={false} tickLine={false} width={135}
                    tickFormatter={n=>n.length>20?n.slice(0,20)+"…":n}/>
                  <Tooltip content={<Tip/>} formatter={(v,n)=>n==="horas"?`${v}h`:fmtR(v)}/>
                  <Bar dataKey="horas" name="Horas" fill={C.red} radius={[0,4,4,0]}/>
                  <Bar dataKey="custo" name="Custo R$" fill={C.amber} radius={[0,4,4,0]} opacity={.8}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <SectionTitle>Ranking de Membros</SectionTitle>
              <div style={{maxHeight:380,overflowY:"auto"}}>
                {horasPorExec.map((m,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <Avatar name={m.name} size={32}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{color:C.text,fontSize:12,fontWeight:600,overflow:"hidden",
                          textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:8}}>
                          <span style={{color:C.amber,fontSize:10,fontWeight:700}}>{fmtR(m.custo)}</span>
                          <span style={{color:C.text2,fontSize:11,fontWeight:700}}>{m.horas}h</span>
                        </div>
                      </div>
                      <Progress value={m.horas} max={maxExec}
                        color={i===0?C.red:i===1?C.amber:i===2?C.blue:C.border2}/>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── TAREFAS ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16,marginBottom:20}}>
            <Card>
              <SectionTitle>Por Situação</SectionTitle>
              <PieChart width={200} height={180} style={{margin:"0 auto"}}>
                <Pie data={tarefasPorSit} cx={100} cy={84} innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3} strokeWidth={0}>
                  {tarefasPorSit.map((s,i)=>{
                    const cor={Ativa:C.blue,Pausada:C.amber,Concluída:C.green,Cancelada:C.text3};
                    return <Cell key={i} fill={cor[s.name]||PALETTE[i]}/>;
                  })}
                </Pie>
                <Tooltip content={<Tip/>}/>
              </PieChart>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginTop:8}}>
                {tarefasPorSit.map((s,i)=>{
                  const cor={Ativa:C.blue,Pausada:C.amber,Concluída:C.green,Cancelada:C.text3};
                  const bg={Ativa:C.blueBg,Pausada:C.amberBg,Concluída:C.greenBg,Cancelada:"#F5F5F5"};
                  return <Tag key={i} label={`${s.name} (${s.value})`} color={cor[s.name]||PALETTE[i]} bg={bg[s.name]}/>;
                })}
              </div>
            </Card>

            <Card>
              <SectionTitle>Por Etapa</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tarefasPorFase} layout="vertical" barSize={13}>
                  <XAxis type="number" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis dataKey="name" type="category" tick={{fill:C.text2,fontSize:10}} axisLine={false}
                    tickLine={false} width={125} tickFormatter={n=>n.length>18?n.slice(0,18)+"…":n}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="value" name="Tarefas" radius={[0,4,4,0]}>
                    {tarefasPorFase.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── TABELA CUSTO POR CLIENTE ── */}
          <Card style={{padding:0,overflow:"hidden",marginBottom:24}}>
            <div style={{padding:"18px 22px 14px"}}><SectionTitle>Análise de Custo por Cliente</SectionTitle></div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:C.bg}}>
                  {["Cliente","Horas","Custo Realizado","% do total","Tarefas","Taxa Conclusão","Custo/Tarefa"].map(h=>(
                    <th key={h} style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1,
                      textTransform:"uppercase",padding:"10px 16px",textAlign:"left",
                      borderBottom:`1px solid ${C.border}`,borderTop:`1px solid ${C.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {custoCliente.map((c,i)=>{
                  const pctC=c.tarefas?Math.round((c.concl/c.tarefas)*100):0;
                  const custoT=c.tarefas?c.custo/c.tarefas:0;
                  const share=totalCusto?Math.round((c.custo/totalCusto)*100):0;
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}`,transition:"background .12s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.redLight}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <Avatar name={c.name} size={28}/>
                          <span style={{color:C.text,fontSize:13,fontWeight:600}}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{padding:"12px 16px",color:C.text2,fontSize:12,fontFamily:"monospace"}}>{c.horas}h</td>
                      <td style={{padding:"12px 16px",color:C.red,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{fmtR(c.custo)}</td>
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:60,background:C.border,borderRadius:3,height:5}}>
                            <div style={{width:`${share}%`,height:5,background:C.red,borderRadius:3}}/>
                          </div>
                          <span style={{color:C.text2,fontSize:11}}>{share}%</span>
                        </div>
                      </td>
                      <td style={{padding:"12px 16px",color:C.text2,fontSize:12,textAlign:"center"}}>{c.tarefas}</td>
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:50,background:C.border,borderRadius:3,height:5}}>
                            <div style={{width:`${pctC}%`,height:5,background:pctC>60?C.green:C.orange,borderRadius:3}}/>
                          </div>
                          <Tag label={`${pctC}%`} color={pctC>60?C.green:C.orange}
                            bg={pctC>60?C.greenBg:C.orangeBg}/>
                        </div>
                      </td>
                      <td style={{padding:"12px 16px",color:C.text2,fontSize:12,fontFamily:"monospace"}}>{fmtR(custoT)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:C.bg,borderTop:`2px solid ${C.border2}`}}>
                  <td style={{padding:"12px 16px",color:C.text,fontSize:12,fontWeight:800}}>TOTAL</td>
                  <td style={{padding:"12px 16px",color:C.text,fontSize:12,fontWeight:800,fontFamily:"monospace"}}>{(totalMin/60).toFixed(1)}h</td>
                  <td style={{padding:"12px 16px",color:C.red,fontSize:12,fontWeight:800,fontFamily:"monospace"}}>{fmtR(custoRealizado)}</td>
                  <td style={{padding:"12px 16px",color:C.text3,fontSize:12}}>100%</td>
                  <td style={{padding:"12px 16px",color:C.text,fontSize:12,fontWeight:800,textAlign:"center"}}>{tarefas.length}</td>
                  <td style={{padding:"12px 16px"}}>
                    <Tag label={`${taxaConcl}%`} color={taxaConcl>60?C.green:C.orange} bg={taxaConcl>60?C.greenBg:C.orangeBg}/>
                  </td>
                  <td style={{padding:"12px 16px",color:C.text2,fontSize:12,fontFamily:"monospace"}}>
                    {tarefas.length?fmtR(custoRealizado/tarefas.length):"—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <p style={{textAlign:"center",color:C.text3,fontSize:11,marginTop:8}}>
            V4 Company ACM · {dateFrom} até {dateTo} · Dados via Ekyte API (status confirmado)
          </p>
        </>)}
      </div>
    </div>
  );
}
