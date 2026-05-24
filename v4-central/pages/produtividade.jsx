import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from "recharts";

// ─── CONFIG SUPABASE ────────────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pqzojyhyqzizgudrdkhr.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxem9qeWh5cXppemd1ZHJka2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzE1ODYsImV4cCI6MjA5MjYwNzU4Nn0.dn4wXlLiPh7Nti0ybBbg1OApGlADK2agOEJsRbcAhwA";

const sb = async (table, select = "*", qs = "") => {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?select=${select}${qs}&limit=2000`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`Erro ${table}: ${r.status}`);
  return r.json();
};

// ─── DESIGN TOKENS (V4 Central) ─────────────────────────────────────────────
const C = {
  // bases
  topbar:   "#1C0A0A",
  sidebar:  "#FFFFFF",
  bg:       "#F4F3F1",
  card:     "#FFFFFF",
  border:   "#E8E6E3",
  border2:  "#D4D1CC",
  // brand
  red:      "#E8002D",
  redLight: "#FFF0F2",
  redMid:   "#FFCDD5",
  // texto
  text:     "#1A1A1A",
  text2:    "#666666",
  text3:    "#AAAAAA",
  // status
  green:    "#16A34A",
  greenBg:  "#F0FDF4",
  orange:   "#EA580C",
  orangeBg: "#FFF7ED",
  amber:    "#D97706",
  amberBg:  "#FFFBEB",
  blue:     "#2563EB",
  blueBg:   "#EFF6FF",
  // charts
  chart1:   "#E8002D",
  chart2:   "#2563EB",
  chart3:   "#16A34A",
  chart4:   "#D97706",
  chart5:   "#7C3AED",
  chart6:   "#0891B2",
};

const PALETTE = [C.chart1, C.chart2, C.chart3, C.chart4, C.chart5, C.chart6, "#DB2777", "#059669"];

// ─── UTILS ──────────────────────────────────────────────────────────────────
const fmtH   = m => { const h = Math.floor((m||0)/60), mm=(m||0)%60; return mm?`${h}h${String(mm).padStart(2,"0")}m`:`${h}h`; };
const fmtR   = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtPct = v => `${Math.round(v||0)}%`;
const toISO  = d => d.toISOString().split("T")[0];
const addDays= (d,n)=>{ const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const today  = () => toISO(new Date());
const daysAgo= n => toISO(addDays(new Date(),-n));

const PRESETS = [
  { label:"Hoje",  from:today(),     to:today()    },
  { label:"7 dias",from:daysAgo(7),  to:today()    },
  { label:"30 dias",from:daysAgo(30),to:today()    },
  { label:"90 dias",from:daysAgo(90),to:today()    },
];

const SIT = {
  10:{ label:"Ativa",     color:C.green,  bg:C.greenBg  },
  20:{ label:"Pausada",   color:C.amber,  bg:C.amberBg  },
  30:{ label:"Concluída", color:C.blue,   bg:C.blueBg   },
  40:{ label:"Cancelada", color:C.text3,  bg:"#F5F5F5"  },
};

// ─── MICRO COMPONENTES ──────────────────────────────────────────────────────
const Tag = ({label, color, bg}) => (
  <span style={{
    background: bg||`${color}18`, color,
    border: `1px solid ${color}33`,
    borderRadius: 20, padding: "2px 10px",
    fontSize: 11, fontWeight: 700, whiteSpace:"nowrap"
  }}>{label}</span>
);

const SectionTitle = ({children}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
    <div style={{width:7,height:7,borderRadius:"50%",background:C.red,flexShrink:0}} />
    <h2 style={{color:C.red,fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",margin:0}}>
      {children}
    </h2>
  </div>
);

const Card = ({children,style={}}) => (
  <div style={{
    background:C.card, border:`1px solid ${C.border}`,
    borderRadius:10, padding:"20px 22px",
    boxShadow:"0 1px 4px rgba(0,0,0,.06)", ...style
  }}>{children}</div>
);

const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,.12)"}}>
      {label && <p style={{color:C.text2,marginBottom:6,fontSize:11}}>{label}</p>}
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color||C.text,fontWeight:700,margin:"2px 0"}}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const Kpi = ({label,value,sub,color=C.red,icon,border=false}) => (
  <div style={{
    background:C.card, border:`1px solid ${border?color:C.border}`,
    borderRadius:10, padding:"18px 20px",
    boxShadow:"0 1px 4px rgba(0,0,0,.05)",
    borderTop: `3px solid ${color}`,
  }}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
      <p style={{color:C.text2,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",margin:0}}>{label}</p>
      {icon && <span style={{fontSize:14,opacity:.35}}>{icon}</span>}
    </div>
    <p style={{color:C.text,fontSize:28,fontWeight:900,margin:0,letterSpacing:-0.5}}>{value}</p>
    {sub && <p style={{color:C.text3,fontSize:11,margin:"5px 0 0"}}>{sub}</p>}
  </div>
);

// ─── MULTISELECT ─────────────────────────────────────────────────────────────
const MultiSelect = ({label,options,value,onChange}) => {
  const [open,setOpen] = useState(false);
  const toggle = v => value.includes(v)?onChange(value.filter(x=>x!==v)):onChange([...value,v]);
  const hasVal = value.length > 0;
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background: hasVal?C.redLight:C.card,
        color: hasVal?C.red:C.text2,
        border:`1px solid ${hasVal?C.red:C.border2}`,
        borderRadius:7,padding:"7px 12px",fontSize:12,fontWeight:600,
        cursor:"pointer",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
      }}>
        {label}{hasVal?` (${value.length})`:""} <span style={{fontSize:8,opacity:.5}}>▼</span>
      </button>
      {open && (
        <div onClick={e=>e.stopPropagation()} style={{
          position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:999,
          background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
          minWidth:210,maxHeight:260,overflowY:"auto",padding:6,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)"
        }}>
          <button onClick={()=>{onChange([]);setOpen(false);}} style={{
            width:"100%",background:value.length===0?C.redLight:"transparent",
            color:value.length===0?C.red:C.text2,border:"none",borderRadius:6,
            padding:"7px 10px",fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left",marginBottom:2
          }}>Todos</button>
          {options.map(o=>{
            const sel=value.includes(o);
            return (
              <button key={o} onClick={()=>toggle(o)} style={{
                width:"100%",background:sel?C.redLight:"transparent",
                color:sel?C.red:C.text,border:"none",borderRadius:6,
                padding:"7px 10px",fontSize:12,cursor:"pointer",textAlign:"left",
                display:"flex",justifyContent:"space-between",
              }}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{o}</span>
                {sel && <span style={{color:C.red,fontWeight:700}}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Progress = ({value,max,color=C.red}) => {
  const pct = max>0?Math.min(100,(value/max)*100):0;
  return (
    <div style={{background:C.border,borderRadius:4,height:5,overflow:"hidden"}}>
      <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:4,transition:"width .8s ease"}}/>
    </div>
  );
};

// ─── AVATAR INICIAL ───────────────────────────────────────────────────────────
const Avatar = ({name,size=30}) => {
  const colors=["#E8002D","#2563EB","#16A34A","#D97706","#7C3AED","#0891B2","#DB2777","#059669"];
  const idx = name?.charCodeAt(0)%colors.length||0;
  const initials = name?.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:colors[idx],
      display:"flex",alignItems:"center",justifyContent:"center",
      color:"#fff",fontSize:size*0.35,fontWeight:800,flexShrink:0}}>
      {initials}
    </div>
  );
};

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function Produtividade() {
  const [preset,setPreset]         = useState(2);
  const [dateFrom,setDateFrom]     = useState(daysAgo(30));
  const [dateTo,setDateTo]         = useState(today());
  const [customDate,setCustomDate] = useState(false);
  const [executores,setExecutores] = useState([]);
  const [workspaces,setWorkspaces] = useState([]);
  const [projSel,setProjSel]       = useState([]);
  const [taxaHora,setTaxaHora]     = useState(150);
  const [showCusto,setShowCusto]   = useState(true);
  const [rawTarefas,setRawTarefas]   = useState([]);
  const [rawProjetos,setRawProjetos] = useState([]);
  const [rawHoras,setRawHoras]       = useState([]);
  const [loading,setLoading]         = useState(true);
  const [err,setErr]                 = useState(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const load = async () => {
      setLoading(true); setErr(null);
      try {
        const [t,p,h] = await Promise.all([
          sb("ekyte_tarefas","*",`&creation_date=gte.${dateFrom}&creation_date=lte.${dateTo}T23:59:59`),
          sb("ekyte_projetos","*"),
          sb("ekyte_horas","*",`&date=gte.${dateFrom}&date=lte.${dateTo}`),
        ]);
        setRawTarefas(t||[]); setRawProjetos(p||[]); setRawHoras(h||[]);
      } catch(e) { setErr(e.message); }
      finally { setLoading(false); }
    };
    load();
  },[dateFrom,dateTo]);

  // ── Opções ──────────────────────────────────────────────────────────────────
  const optsExec = useMemo(()=>[...new Set(rawHoras.map(h=>h.executor).filter(Boolean))].sort(),[rawHoras]);
  const optsWs   = useMemo(()=>[...new Set(rawHoras.map(h=>h.workspace).filter(Boolean))].sort(),[rawHoras]);
  const optsProj = useMemo(()=>[...new Set(rawHoras.map(h=>h.project).filter(Boolean))].sort(),[rawHoras]);

  // ── Filtrar ─────────────────────────────────────────────────────────────────
  const horas = useMemo(()=>rawHoras.filter(h=>{
    if(executores.length && !executores.includes(h.executor)) return false;
    if(workspaces.length && !workspaces.includes(h.workspace)) return false;
    if(projSel.length   && !projSel.includes(h.project))      return false;
    return true;
  }),[rawHoras,executores,workspaces,projSel]);

  const tarefas = useMemo(()=>rawTarefas.filter(t=>{
    if(executores.length && !executores.includes(t.executor))  return false;
    if(workspaces.length && !workspaces.includes(t.workspace)) return false;
    if(projSel.length   && !projSel.includes(t.project))      return false;
    return true;
  }),[rawTarefas,executores,workspaces,projSel]);

  const applyPreset = i => { setPreset(i); setCustomDate(false); setDateFrom(PRESETS[i].from); setDateTo(PRESETS[i].to); };

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalMin   = useMemo(()=>horas.reduce((s,h)=>s+(h.minutes||0),0),[horas]);
  const totalCusto = (totalMin/60)*taxaHora;
  const concluidas = useMemo(()=>tarefas.filter(t=>t.situation===30).length,[tarefas]);
  const taxaConcl  = tarefas.length ? Math.round((concluidas/tarefas.length)*100) : 0;
  const projAtivos = useMemo(()=>rawProjetos.filter(p=>p.status===10).length,[rawProjetos]);
  const diasPeriodo= Math.max(1,Math.ceil((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24)));
  const mediaDiaria= (totalMin/60/diasPeriodo).toFixed(1);

  // ── Charts data ─────────────────────────────────────────────────────────────
  const horasPorWs = useMemo(()=>
    Object.entries(horas.reduce((a,h)=>{const k=h.workspace||"Sem cliente";a[k]=(a[k]||0)+(h.minutes||0);return a},{}))
    .map(([name,min])=>({name,horas:+(min/60).toFixed(1),custo:+((min/60)*taxaHora).toFixed(2)}))
    .sort((a,b)=>b.horas-a.horas).slice(0,10)
  ,[horas,taxaHora]);

  const horasPorExec = useMemo(()=>
    Object.entries(horas.reduce((a,h)=>{const k=h.executor||"?";a[k]=(a[k]||0)+(h.minutes||0);return a},{}))
    .map(([name,min])=>({name,horas:+(min/60).toFixed(1),min}))
    .sort((a,b)=>b.horas-a.horas)
  ,[horas]);

  const tarefasPorSit = useMemo(()=>
    Object.entries(tarefas.reduce((a,t)=>{const k=SIT[t.situation]?.label||"Outro";a[k]=(a[k]||0)+1;return a},{}))
    .map(([name,value])=>({name,value}))
  ,[tarefas]);

  const tarefasPorFase = useMemo(()=>
    Object.entries(tarefas.reduce((a,t)=>{const k=t.phase||"Sem etapa";a[k]=(a[k]||0)+1;return a},{}))
    .map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,8)
  ,[tarefas]);

  const trend = useMemo(()=>{
    const map=horas.reduce((a,h)=>{const k=h.date?.split("T")[0];if(!k)return a;a[k]=(a[k]||0)+(h.minutes||0);return a},{});
    return Object.entries(map).map(([date,min])=>({date,horas:+(min/60).toFixed(1)})).sort((a,b)=>a.date.localeCompare(b.date));
  },[horas]);

  const custoCliente = useMemo(()=>
    horasPorWs.map(w=>({
      ...w,
      custo: w.horas*taxaHora,
      tarefas: tarefas.filter(t=>t.workspace===w.name).length,
      concluidas: tarefas.filter(t=>t.workspace===w.name&&t.situation===30).length,
    })).sort((a,b)=>b.custo-a.custo)
  ,[horasPorWs,tarefas,taxaHora]);

  const totalCustoWs = custoCliente.reduce((s,c)=>s+c.custo,0);
  const maxExec = horasPorExec[0]?.horas||1;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* TOP BAR FINA */}
      <div style={{height:4,background:C.topbar,width:"100%"}} />

      {/* HEADER */}
      <div style={{
        background:C.card,borderBottom:`1px solid ${C.border}`,
        padding:"0 28px",display:"flex",alignItems:"center",
        justifyContent:"space-between",height:56,
        position:"sticky",top:4,zIndex:200,
        boxShadow:"0 1px 3px rgba(0,0,0,.08)"
      }}>
        {/* Logo + título */}
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{
            width:36,height:36,background:C.red,borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center",
            color:"#fff",fontSize:13,fontWeight:900,letterSpacing:-0.5
          }}>V4</div>
          <div>
            <p style={{color:C.text3,fontSize:10,letterSpacing:1,margin:0}}>ACM&Co</p>
            <p style={{color:C.text,fontSize:14,fontWeight:700,margin:0}}>Produtividade da Equipe</p>
          </div>
        </div>

        {/* Filtros de período */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {PRESETS.map((p,i)=>(
            <button key={i} onClick={()=>applyPreset(i)} style={{
              background: !customDate&&preset===i ? C.red : "transparent",
              color: !customDate&&preset===i ? "#fff" : C.text2,
              border:`1px solid ${!customDate&&preset===i?C.red:C.border2}`,
              borderRadius:7,padding:"5px 13px",fontSize:12,fontWeight:600,
              cursor:"pointer",transition:"all .15s"
            }}>{p.label}</button>
          ))}
          <button onClick={()=>setCustomDate(v=>!v)} style={{
            background:customDate?C.redLight:"transparent",
            color:customDate?C.red:C.text2,
            border:`1px solid ${customDate?C.red:C.border2}`,
            borderRadius:7,padding:"5px 13px",fontSize:12,fontWeight:600,cursor:"pointer"
          }}>Personalizado</button>
          {!loading&&!err&&(
            <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:8}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>
              <span style={{color:C.text3,fontSize:10}}>Dados atualizados</span>
            </div>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{
        background:C.card,borderBottom:`1px solid ${C.border}`,
        padding:"10px 28px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"
      }}>
        {customDate && (
          <>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:7,padding:"6px 10px",fontSize:12}}/>
            <span style={{color:C.text3,fontSize:12}}>até</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:7,padding:"6px 10px",fontSize:12}}/>
            <div style={{width:1,height:22,background:C.border2}}/>
          </>
        )}

        <MultiSelect label="Executor" options={optsExec} value={executores} onChange={setExecutores}/>
        <MultiSelect label="Cliente"  options={optsWs}   value={workspaces} onChange={setWorkspaces}/>
        <MultiSelect label="Projeto"  options={optsProj} value={projSel}    onChange={setProjSel}/>

        <div style={{width:1,height:22,background:C.border2}}/>

        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:C.text2,fontSize:11,fontWeight:600}}>R$/hora</span>
          <input type="number" value={taxaHora} onChange={e=>setTaxaHora(+e.target.value)}
            style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.red,borderRadius:7,
              padding:"5px 8px",fontSize:12,fontWeight:800,width:72,textAlign:"center"}}/>
        </div>

        <button onClick={()=>setShowCusto(v=>!v)} style={{
          background:showCusto?C.redLight:"transparent",
          color:showCusto?C.red:C.text3,
          border:`1px solid ${showCusto?C.redMid:C.border2}`,
          borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"
        }}>
          {showCusto?"💰 Custo ativo":"💰 Exibir custo"}
        </button>

        {(executores.length||workspaces.length||projSel.length)?
          <button onClick={()=>{setExecutores([]);setWorkspaces([]);setProjSel([]);}} style={{
            background:"transparent",color:C.text3,border:`1px solid ${C.border}`,
            borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer"
          }}>✕ Limpar filtros</button>:null}
      </div>

      {/* CONTEÚDO */}
      <div style={{padding:"24px 28px",maxWidth:1600,margin:"0 auto"}}>

        {loading && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:360,gap:14}}>
            <div style={{width:36,height:36,border:`3px solid ${C.border2}`,borderTop:`3px solid ${C.red}`,
              borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
            <p style={{color:C.text3,fontSize:13}}>Carregando dados...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {err && (
          <div style={{background:C.redLight,border:`1px solid ${C.redMid}`,borderRadius:10,padding:16,color:C.red,marginBottom:20,fontSize:13}}>
            ⚠ {err}
          </div>
        )}

        {!loading && !err && (<>

          {/* ── KPIs ── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12,marginBottom:24}}>
            <Kpi label="Horas Totais"    value={fmtH(totalMin)}   sub={`${mediaDiaria}h/dia em média`} color={C.red}   icon="⏱"/>
            <Kpi label="Custo Estimado"  value={showCusto?fmtR(totalCusto):"—"} sub={`à R$${taxaHora}/h`} color={C.amber} icon="💰"/>
            <Kpi label="Tarefas"         value={tarefas.length}   sub={`${concluidas} concluídas`}     color={C.blue}  icon="✓"/>
            <Kpi label="Taxa Conclusão"  value={fmtPct(taxaConcl)} sub="das tarefas do período"        color={taxaConcl>60?C.green:C.orange} icon="%"/>
            <Kpi label="Projetos Ativos" value={projAtivos}       sub={`de ${rawProjetos.length} total`} color={C.chart5} icon="◈"/>
            <Kpi label="Membros Ativos"  value={horasPorExec.length} sub="com horas no período"        color={C.chart6} icon="◉"/>
          </div>

          {/* ── TENDÊNCIA ── */}
          <div style={{marginBottom:20}}>
            <Card>
              <SectionTitle>Evolução de Horas no Período</SectionTitle>
              <ResponsiveContainer width="100%" height={148}>
                <AreaChart data={trend} margin={{top:4,right:8,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.red} stopOpacity={.15}/>
                      <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}
                    tickFormatter={d=>d.slice(5)} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false} width={28}/>
                  <Tooltip content={<Tip/>}/>
                  <Area type="monotone" dataKey="horas" stroke={C.red} strokeWidth={2}
                    fill="url(#gArea)" name="Horas" dot={false} activeDot={{r:4,fill:C.red,stroke:"#fff",strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── HORAS POR WS + RANKING EXEC ── */}
          <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:20}}>

            <Card>
              <SectionTitle>Horas por Cliente</SectionTitle>
              <ResponsiveContainer width="100%" height={Math.max(180,horasPorWs.length*38)}>
                <BarChart data={horasPorWs} layout="vertical" barSize={13} barGap={4}>
                  <XAxis type="number" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis dataKey="name" type="category" tick={{fill:C.text2,fontSize:10}} axisLine={false} tickLine={false} width={135}
                    tickFormatter={n=>n.length>20?n.slice(0,20)+"…":n}/>
                  <Tooltip content={<Tip/>} formatter={(v,n)=>n==="horas"?`${v}h`:fmtR(v)}/>
                  <Bar dataKey="horas" name="Horas" fill={C.red} radius={[0,4,4,0]}/>
                  {showCusto && <Bar dataKey="custo" name="Custo R$" fill={C.amber} radius={[0,4,4,0]} opacity={.8}/>}
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
                        <span style={{color:C.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {m.name}
                        </span>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:8}}>
                          {showCusto && <span style={{color:C.amber,fontSize:10,fontWeight:700}}>{fmtR(m.horas*taxaHora)}</span>}
                          <span style={{color:C.text2,fontSize:11,fontWeight:700}}>{m.horas}h</span>
                        </div>
                      </div>
                      <Progress value={m.horas} max={maxExec} color={i===0?C.red:i===1?C.amber:i===2?C.blue:C.border2}/>
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
                  {tarefasPorSit.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                </Pie>
                <Tooltip content={<Tip/>}/>
              </PieChart>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginTop:8}}>
                {tarefasPorSit.map((s,i)=>(
                  <Tag key={i} label={`${s.name} (${s.value})`} color={PALETTE[i%PALETTE.length]} bg={`${PALETTE[i%PALETTE.length]}12`}/>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle>Por Etapa de Trabalho</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tarefasPorFase} layout="vertical" barSize={13}>
                  <XAxis type="number" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis dataKey="name" type="category" tick={{fill:C.text2,fontSize:10}} axisLine={false} tickLine={false} width={125}
                    tickFormatter={n=>n.length>18?n.slice(0,18)+"…":n}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="value" name="Tarefas" radius={[0,4,4,0]}>
                    {tarefasPorFase.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── TABELA CUSTO ── */}
          {showCusto && (
            <Card style={{padding:0,overflow:"hidden",marginBottom:24}}>
              <div style={{padding:"18px 22px 14px"}}>
                <SectionTitle>Análise de Custo por Cliente</SectionTitle>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:C.bg}}>
                    {["Cliente","Horas","Custo Est.","% do total","Tarefas","Taxa Conclusão","Custo/Tarefa"].map(h=>(
                      <th key={h} style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1,
                        textTransform:"uppercase",padding:"10px 16px",textAlign:"left",
                        borderBottom:`1px solid ${C.border}`,borderTop:`1px solid ${C.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {custoCliente.map((c,i)=>{
                    const pctC   = c.tarefas?Math.round((c.concluidas/c.tarefas)*100):0;
                    const custoT = c.tarefas?c.custo/c.tarefas:0;
                    const share  = totalCustoWs?Math.round((c.custo/totalCustoWs)*100):0;
                    return (
                      <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:"transparent",transition:"background .12s"}}
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
                            <Tag label={`${pctC}%`} color={pctC>60?C.green:C.orange} bg={pctC>60?C.greenBg:C.orangeBg}/>
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
                    <td style={{padding:"12px 16px",color:C.red,fontSize:12,fontWeight:800,fontFamily:"monospace"}}>{fmtR(totalCusto)}</td>
                    <td style={{padding:"12px 16px",color:C.text3,fontSize:12}}>100%</td>
                    <td style={{padding:"12px 16px",color:C.text,fontSize:12,fontWeight:800,textAlign:"center"}}>{tarefas.length}</td>
                    <td style={{padding:"12px 16px"}}><Tag label={`${taxaConcl}%`} color={taxaConcl>60?C.green:C.orange} bg={taxaConcl>60?C.greenBg:C.orangeBg}/></td>
                    <td style={{padding:"12px 16px",color:C.text2,fontSize:12,fontFamily:"monospace"}}>{tarefas.length?fmtR(totalCusto/tarefas.length):"—"}</td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}

          {/* FOOTER */}
          <p style={{textAlign:"center",color:C.text3,fontSize:11,marginTop:24}}>
            V4 Company ACM · {dateFrom} até {dateTo} · Dados via Ekyte → Supabase
          </p>

        </>)}
      </div>
    </div>
  );
}
