import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
  RadialBarChart, RadialBar, ComposedChart, Line,
} from "recharts";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pqzojyhyqzizgudrdkhr.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxem9qeWh5cXppemd1ZHJka2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzE1ODYsImV4cCI6MjA5MjYwNzU4Nn0.dn4wXlLiPh7Nti0ybBbg1OApGlADK2agOEJsRbcAhwA";
const sb = async (table, select="*", qs="") => {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?select=${select}${qs}&limit=3000`,
    { headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` } });
  if (!r.ok) throw new Error(`Erro ${table}: ${r.status}`);
  return r.json();
};

// ── TOKENS ────────────────────────────────────────────────────────────────────
const C = {
  topbar:"#1C0A0A", bg:"#F2F1EF", card:"#FFFFFF",
  border:"#E8E6E3", border2:"#D4D1CC",
  red:"#E8002D", redLight:"#FFF0F2", redMid:"#FFCDD5",
  text:"#111111", text2:"#5A5A5A", text3:"#9A9A9A",
  green:"#16A34A", greenBg:"#F0FDF4", greenMid:"#BBF7D0",
  orange:"#EA580C", orangeBg:"#FFF7ED",
  amber:"#D97706", amberBg:"#FFFBEB",
  blue:"#2563EB", blueBg:"#EFF6FF",
  purple:"#7C3AED", purpleBg:"#F5F3FF",
  cyan:"#0891B2", cyanBg:"#ECFEFF",
  sidebar:"#FFFFFF",
};
const PAL = [C.red,C.blue,C.green,C.amber,C.purple,C.cyan,"#DB2777","#059669","#F59E0B","#06B6D4"];
const SIT = { 10:{l:"Ativa",c:C.blue,bg:C.blueBg}, 20:{l:"Pausada",c:C.amber,bg:C.amberBg},
               30:{l:"Concluída",c:C.green,bg:C.greenBg}, 40:{l:"Cancelada",c:C.text3,bg:"#F5F5F5"} };

// ── UTILS ─────────────────────────────────────────────────────────────────────
const fmtH  = m => { const h=Math.floor((m||0)/60),mm=(m||0)%60; return mm?`${h}h${String(mm).padStart(2,"0")}m`:`${h}h`; };
const fmtR  = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtK  = v => v>=1000?`R$ ${(v/1000).toFixed(1)}k`:`R$ ${Math.round(v)}`;
const pct   = (a,b) => b>0?Math.round((a/b)*100):0;
const toISO = d => d.toISOString().split("T")[0];
const ago   = n => { const d=new Date(); d.setDate(d.getDate()-n); return toISO(d); };
const today = () => toISO(new Date());
const PRESETS = [
  {l:"Hoje",    f:today(),  t:today()},
  {l:"7d",      f:ago(7),   t:today()},
  {l:"30d",     f:ago(30),  t:today()},
  {l:"90d",     f:ago(90),  t:today()},
];

// ── COMPONENTES BASE ──────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
    padding:"20px 22px",boxShadow:"0 1px 3px rgba(0,0,0,.05)",...style}}>
    {children}
  </div>
);

const SecTitle = ({children,sub}) => (
  <div style={{marginBottom:18}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:3,height:16,background:C.red,borderRadius:2}}/>
      <h3 style={{color:C.text,fontSize:13,fontWeight:800,margin:0}}>{children}</h3>
    </div>
    {sub&&<p style={{color:C.text3,fontSize:11,margin:"4px 0 0 11px"}}>{sub}</p>}
  </div>
);

const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
      padding:"10px 14px",fontSize:12,boxShadow:"0 8px 24px rgba(0,0,0,.12)"}}>
      {label&&<p style={{color:C.text2,marginBottom:6,fontSize:11,borderBottom:`1px solid ${C.border}`,paddingBottom:6}}>{label}</p>}
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6,margin:"3px 0"}}>
          <div style={{width:8,height:8,borderRadius:2,background:p.color||C.red,flexShrink:0}}/>
          <span style={{color:C.text2}}>{p.name}:</span>
          <span style={{color:C.text,fontWeight:700}}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const Tag = ({label,color,bg,size="sm"}) => (
  <span style={{background:bg||`${color}15`,color,border:`1px solid ${color}30`,
    borderRadius:20,padding:size==="sm"?"2px 9px":"4px 12px",
    fontSize:size==="sm"?10:12,fontWeight:700,whiteSpace:"nowrap",display:"inline-block"}}>
    {label}
  </span>
);

const Avatar = ({name,size=32}) => {
  const colors=[C.red,C.blue,C.green,C.amber,C.purple,C.cyan,"#DB2777","#059669"];
  const idx=(name?.charCodeAt(0)||0)%colors.length;
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:colors[idx],flexShrink:0,
      display:"flex",alignItems:"center",justifyContent:"center",
      color:"#fff",fontSize:size*.34,fontWeight:800}}>
      {name?.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?"}
    </div>
  );
};

const Bar2 = ({value,max,color=C.red,height=6}) => {
  const p=max>0?Math.min(100,(value/max)*100):0;
  return (
    <div style={{background:C.border,borderRadius:height,height,overflow:"hidden",flex:1}}>
      <div style={{width:`${p}%`,height:"100%",background:color,borderRadius:height,transition:"width .6s ease"}}/>
    </div>
  );
};

// KPI com mini-ring
const KpiRing = ({label,value,sub,color,pctVal,icon}) => {
  const r=22; const circ=2*Math.PI*r; const dash=pctVal!=null?(pctVal/100)*circ:0;
  return (
    <Card style={{display:"flex",alignItems:"center",gap:16,padding:"18px 20px",
      borderLeft:`3px solid ${color}`}}>
      {pctVal!=null?(
        <svg width={56} height={56} style={{flexShrink:0}}>
          <circle cx={28} cy={28} r={r} fill="none" stroke={C.border} strokeWidth={5}/>
          <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 28 28)" style={{transition:"stroke-dasharray .8s ease"}}/>
          <text x={28} y={32} textAnchor="middle" fontSize={11} fontWeight={800} fill={color}>{pctVal}%</text>
        </svg>
      ):(
        <div style={{width:48,height:48,borderRadius:12,background:`${color}15`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
          {icon}
        </div>
      )}
      <div style={{minWidth:0}}>
        <p style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",margin:"0 0 4px"}}>{label}</p>
        <p style={{color:C.text,fontSize:24,fontWeight:900,margin:0,letterSpacing:-0.5}}>{value}</p>
        {sub&&<p style={{color:C.text3,fontSize:11,margin:"3px 0 0"}}>{sub}</p>}
      </div>
    </Card>
  );
};

// KPI simples
const Kpi = ({label,value,sub,color=C.red,delta}) => (
  <Card style={{borderTop:`3px solid ${color}`,padding:"16px 18px"}}>
    <p style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",margin:"0 0 10px"}}>{label}</p>
    <p style={{color:C.text,fontSize:26,fontWeight:900,margin:0,letterSpacing:-0.5}}>{value}</p>
    {sub&&<p style={{color:C.text3,fontSize:11,margin:"4px 0 0"}}>{sub}</p>}
    {delta!=null&&<p style={{color:delta>=0?C.green:C.orange,fontSize:11,margin:"4px 0 0",fontWeight:700}}>
      {delta>=0?"▲":"▼"} {Math.abs(delta)}% vs anterior
    </p>}
  </Card>
);

// MultiSelect
const MS = ({label,opts,val,set}) => {
  const [open,setOpen]=useState(false);
  const has=val.length>0;
  const toggle=v=>val.includes(v)?set(val.filter(x=>x!==v)):set([...val,v]);
  useEffect(()=>{
    if(!open) return;
    const h=()=>setOpen(false);
    setTimeout(()=>document.addEventListener("click",h),0);
    return ()=>document.removeEventListener("click",h);
  },[open]);
  return (
    <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:has?C.redLight:C.card,color:has?C.red:C.text2,
        border:`1px solid ${has?C.red:C.border2}`,borderRadius:8,
        padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",
        display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
        boxShadow:"0 1px 2px rgba(0,0,0,.05)"}}>
        {label}{has?` · ${val.length}`:""} <span style={{fontSize:8,opacity:.4}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:999,
          background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
          minWidth:220,maxHeight:280,overflowY:"auto",padding:8,
          boxShadow:"0 12px 40px rgba(0,0,0,.15)"}}>
          <button onClick={()=>{set([]);setOpen(false);}} style={{
            width:"100%",background:val.length===0?C.redLight:"transparent",
            color:val.length===0?C.red:C.text2,border:"none",borderRadius:8,
            padding:"8px 10px",fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left",marginBottom:4}}>
            Todos
          </button>
          {opts.map(o=>{
            const s=val.includes(o);
            return (
              <button key={o} onClick={()=>toggle(o)} style={{
                width:"100%",background:s?C.redLight:"transparent",color:s?C.red:C.text,
                border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,cursor:"pointer",
                textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:170}}>{o}</span>
                {s&&<div style={{width:16,height:16,borderRadius:"50%",background:C.red,
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>
                </div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── NAV SIDEBAR ───────────────────────────────────────────────────────────────
const NAV = [
  {id:"geral",   icon:"◉", label:"Visão Geral"},
  {id:"horas",   icon:"⏱", label:"Apontamentos"},
  {id:"tarefas", icon:"✓", label:"Tarefas"},
  {id:"equipe",  icon:"◈", label:"Equipe"},
  {id:"clientes",icon:"$", label:"Clientes"},
];

// ── TABELA DE TAREFAS COM FILTROS INLINE ─────────────────────────────────────
function TabelaTarefas({tarefas,SIT,fmtH,C,Avatar,Tag}) {
  const [fExec,setFExec] = useState([]);
  const [fWs,setFWs]     = useState([]);
  const [fSit,setFSit]   = useState([]);
  const [busca,setBusca] = useState("");
  const [pgSize,setPgSize]= useState(30);

  const optsExec = useMemo(()=>[...new Set(tarefas.map(t=>t.executor).filter(Boolean))].sort(),[tarefas]);
  const optsWs   = useMemo(()=>[...new Set(tarefas.map(t=>t.workspace).filter(Boolean))].sort(),[tarefas]);
  const optsSit  = useMemo(()=>[...new Set(tarefas.map(t=>SIT[t.situation]?.l).filter(Boolean))].sort(),[tarefas,SIT]);

  const filtered = useMemo(()=>tarefas.filter(t=>{
    if(fExec.length && !fExec.includes(t.executor)) return false;
    if(fWs.length   && !fWs.includes(t.workspace))  return false;
    if(fSit.length  && !fSit.includes(SIT[t.situation]?.l)) return false;
    if(busca && !`${t.title} ${t.workspace} ${t.executor} ${t.phase}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }),[tarefas,fExec,fWs,fSit,busca]);

  const hasFilter = fExec.length||fWs.length||fSit.length||busca;

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
      overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>

      {/* Barra de filtros da tabela */}
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:C.bg}}>

        {/* Busca */}
        <div style={{position:"relative",flex:1,minWidth:200}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",
            color:C.text3,fontSize:12}}>🔍</span>
          <input
            value={busca} onChange={e=>setBusca(e.target.value)}
            placeholder="Buscar tarefa, workspace, executor..."
            style={{width:"100%",background:C.card,border:`1px solid ${C.border2}`,color:C.text,
              borderRadius:8,padding:"7px 12px 7px 30px",fontSize:12,boxSizing:"border-box"}}/>
        </div>

        {/* Filtro Executor */}
        <MS label="Executor" opts={optsExec} val={fExec} set={setFExec}/>

        {/* Filtro Workspace */}
        <MS label="Workspace" opts={optsWs} val={fWs} set={setFWs}/>

        {/* Filtro Situação — chips rápidos */}
        <div style={{display:"flex",gap:4}}>
          {optsSit.map(s=>{
            const sitEntry=Object.values(SIT).find(v=>v.l===s);
            const active=fSit.includes(s);
            return (
              <button key={s} onClick={()=>setFSit(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s])} style={{
                background:active?(sitEntry?.bg||`${sitEntry?.c}15`):"transparent",
                color:active?(sitEntry?.c||C.red):C.text3,
                border:`1px solid ${active?(sitEntry?.c||C.red):C.border2}`,
                borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",
                transition:"all .15s"}}>
                {s}
              </button>
            );
          })}
        </div>

        {hasFilter&&(
          <button onClick={()=>{setFExec([]);setFWs([]);setFSit([]);setBusca("");}} style={{
            background:"transparent",color:C.text3,border:`1px solid ${C.border}`,
            borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>
            ✕ Limpar
          </button>
        )}

        <span style={{color:C.text3,fontSize:11,marginLeft:"auto"}}>
          {filtered.length} de {tarefas.length} tarefas
        </span>
      </div>

      {/* Tabela */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
          <thead>
            <tr style={{background:C.bg}}>
              {["Tarefa","Workspace","Executor","Etapa","Situação","Prev.","Real"].map(h=>(
                <th key={h} style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1,
                  textTransform:"uppercase",padding:"10px 14px",textAlign:"left",
                  borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0,pgSize).map((t,i)=>{
              const sit=SIT[t.situation]||{l:"Outro",c:C.text3,bg:"#F5F5F5"};
              const estourado=t.actual_time>t.estimated_time&&t.estimated_time>0;
              return (
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`,transition:"background .1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.redLight}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"10px 14px",maxWidth:260}}>
                    <span style={{color:C.text,fontSize:12,fontWeight:600,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{t.title||"—"}</span>
                  </td>
                  <td style={{padding:"10px 14px",maxWidth:150}}>
                    <span style={{color:C.text2,fontSize:11,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{t.workspace||"—"}</span>
                  </td>
                  <td style={{padding:"10px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <Avatar name={t.executor} size={22}/>
                      <span style={{color:C.text2,fontSize:11,whiteSpace:"nowrap",overflow:"hidden",
                        textOverflow:"ellipsis",maxWidth:120}}>{t.executor||"—"}</span>
                    </div>
                  </td>
                  <td style={{padding:"10px 14px",color:C.text2,fontSize:11,maxWidth:160}}>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>
                      {t.phase||"—"}
                    </span>
                  </td>
                  <td style={{padding:"10px 14px"}}>
                    <Tag label={sit.l} color={sit.c} bg={sit.bg}/>
                  </td>
                  <td style={{padding:"10px 14px",color:C.text2,fontSize:11,fontFamily:"monospace",whiteSpace:"nowrap"}}>
                    {fmtH(t.estimated_time)}
                  </td>
                  <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:11,whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:estourado?C.orange:C.text2,fontWeight:estourado?700:400}}>
                        {fmtH(t.actual_time)}
                      </span>
                      {estourado&&<span style={{fontSize:9,color:C.orange,fontWeight:800}}>▲</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length===0&&(
          <div style={{padding:"40px 0",textAlign:"center",color:C.text3,fontSize:13}}>
            Nenhuma tarefa encontrada com os filtros selecionados
          </div>
        )}

        {filtered.length>pgSize&&(
          <div style={{padding:"14px",textAlign:"center",borderTop:`1px solid ${C.border}`}}>
            <button onClick={()=>setPgSize(p=>p+30)} style={{
              background:C.redLight,color:C.red,border:`1px solid ${C.redMid}`,
              borderRadius:8,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Carregar mais ({filtered.length-pgSize} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Produtividade() {
  const [page,setPage]   = useState("geral");
  const [preset,setPreset] = useState(2);
  const [df,setDf]       = useState(ago(30));
  const [dt,setDt]       = useState(today());
  const [custom,setCustom]= useState(false);
  const [xExec,setXExec] = useState([]);
  const [xWs,setXWs]     = useState([]);
  const [rawT,setRawT]   = useState([]);
  const [rawP,setRawP]   = useState([]);
  const [rawH,setRawH]   = useState([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]     = useState(null);

  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr(null);
      try {
        const [t,p,h]=await Promise.all([
          sb("ekyte_tarefas","*",`&creation_date=gte.${df}&creation_date=lte.${dt}T23:59:59`),
          sb("ekyte_projetos","*"),
          sb("ekyte_horas","*",`&date=gte.${df}&date=lte.${dt}`),
        ]);
        setRawT(t||[]); setRawP(p||[]); setRawH(h||[]);
      } catch(e){ setErr(e.message); }
      finally{ setLoading(false); }
    })();
  },[df,dt]);

  const optsExec=useMemo(()=>[...new Set(rawH.map(h=>h.executor).filter(Boolean))].sort(),[rawH]);
  const optsWs  =useMemo(()=>[...new Set(rawH.map(h=>h.workspace).filter(Boolean))].sort(),[rawH]);

  const H=useMemo(()=>rawH.filter(h=>{
    if(xExec.length&&!xExec.includes(h.executor)) return false;
    if(xWs.length  &&!xWs.includes(h.workspace))  return false;
    return true;
  }),[rawH,xExec,xWs]);

  const T=useMemo(()=>rawT.filter(t=>{
    if(xExec.length&&!xExec.includes(t.executor))  return false;
    if(xWs.length  &&!xWs.includes(t.workspace))   return false;
    return true;
  }),[rawT,xExec,xWs]);

  const ap=i=>{setPreset(i);setCustom(false);setDf(PRESETS[i].f);setDt(PRESETS[i].t);};

  // ── Cálculos globais ───────────────────────────────────────────────────────
  const totalMin    = useMemo(()=>H.reduce((s,h)=>s+(h.minutes||0),0),[H]);
  const custoReal   = useMemo(()=>H.reduce((s,h)=>s+(h.accomplished_rate||0),0),[H]);
  const concl       = useMemo(()=>T.filter(t=>t.situation===30).length,[T]);
  const ativas      = useMemo(()=>T.filter(t=>t.situation===10).length,[T]);
  const taxaConcl   = pct(concl,T.length);
  const projAtivos  = useMemo(()=>rawP.filter(p=>p.status===10).length,[rawP]);
  const dias        = Math.max(1,Math.ceil((new Date(dt)-new Date(df))/(864e5)));
  const mediaDia    = (totalMin/60/dias).toFixed(1);

  const tMap=useMemo(()=>{const m={};rawT.forEach(t=>{m[t.ekyte_id]=t;});return m;},[rawT]);
  const horasConcl  = useMemo(()=>H.filter(h=>tMap[h.task_id]?.situation===30).reduce((s,h)=>s+(h.minutes||0),0),[H,tMap]);
  const efic        = pct(horasConcl,totalMin);

  // Horas por workspace
  const hwsMap=useMemo(()=>H.reduce((a,h)=>{
    const k=h.workspace||"Sem cliente";
    if(!a[k]) a[k]={min:0,custo:0,exec:new Set()};
    a[k].min+=(h.minutes||0); a[k].custo+=(h.accomplished_rate||0);
    if(h.executor) a[k].exec.add(h.executor);
    return a;
  },{}),[H]);

  const hByWs=useMemo(()=>
    Object.entries(hwsMap).map(([name,v])=>({
      name, horas:+(v.min/60).toFixed(1), custo:+v.custo.toFixed(2), exec:v.exec.size
    })).sort((a,b)=>b.horas-a.horas)
  ,[hwsMap]);

  // Horas por executor
  const hByExec=useMemo(()=>
    Object.entries(H.reduce((a,h)=>{
      const k=h.executor||"?";
      if(!a[k]) a[k]={min:0,custo:0,task:0,ticket:0,av:0};
      a[k].min+=(h.minutes||0); a[k].custo+=(h.accomplished_rate||0);
      if(h.entry_type==="task") a[k].task+=(h.minutes||0);
      else if(h.entry_type==="ticket") a[k].ticket+=(h.minutes||0);
      else a[k].av+=(h.minutes||0);
      return a;
    },{}))
    .map(([name,v])=>({name,horas:+(v.min/60).toFixed(1),custo:+v.custo.toFixed(2),
      task:+(v.task/60).toFixed(1),ticket:+(v.ticket/60).toFixed(1),av:+(v.av/60).toFixed(1)}))
    .sort((a,b)=>b.horas-a.horas)
  ,[H]);

  const maxExec=hByExec[0]?.horas||1;

  // Trend diário
  const trend=useMemo(()=>{
    const m=H.reduce((a,h)=>{const k=h.date?.split("T")[0];if(!k)return a;a[k]=(a[k]||0)+(h.minutes||0);return a},{});
    return Object.entries(m).map(([d,min])=>({d:d.slice(5),horas:+(min/60).toFixed(1)})).sort((a,b)=>a.d.localeCompare(b.d));
  },[H]);

  // Horas por tipo
  const byType=useMemo(()=>{
    const acc={task:0,ticket:0,avulso:0};
    H.forEach(h=>{acc[h.entry_type||"avulso"]+=(h.minutes||0);});
    return [{name:"Tarefas",v:acc.task,c:C.blue},{name:"Tickets",v:acc.ticket,c:C.purple},{name:"Avulso",v:acc.avulso,c:C.text3}];
  },[H]);

  // Horas por situação
  const bySit=useMemo(()=>{
    const acc={};
    H.forEach(h=>{
      const t=tMap[h.task_id];
      const k=h.entry_type==="ticket"?"Ticket":h.entry_type==="avulso"?"Avulso":SIT[t?.situation]?.l||"Outro";
      acc[k]=(acc[k]||0)+(h.minutes||0);
    });
    return Object.entries(acc).map(([name,min])=>({name,horas:+(min/60).toFixed(1)})).sort((a,b)=>b.horas-a.horas);
  },[H,tMap]);

  // Tarefas por fase
  const tByFase=useMemo(()=>
    Object.entries(T.reduce((a,t)=>{const k=t.phase||"Sem etapa";a[k]=(a[k]||0)+1;return a},{}))
    .map(([n,v])=>({n,v})).sort((a,b)=>b.v-a.v).slice(0,10)
  ,[T]);

  // Horas por tipo de tarefa
  const hByTaskType=useMemo(()=>
    Object.entries(H.reduce((a,h)=>{const k=h.task_type||"Outros";a[k]=(a[k]||0)+(h.minutes||0);return a},{}))
    .map(([name,min])=>({name,horas:+(min/60).toFixed(1)})).sort((a,b)=>b.horas-a.horas).slice(0,8)
  ,[H]);

  // Custo por cliente (tabela)
  const custoTab=useMemo(()=>hByWs.map(w=>({...w,
    tarefas:T.filter(t=>t.workspace===w.name).length,
    concl:T.filter(t=>t.workspace===w.name&&t.situation===30).length,
  })),[hByWs,T]);
  const totalCusto=custoTab.reduce((s,c)=>s+c.custo,0);

  // ── SEÇÕES ────────────────────────────────────────────────────────────────
  const renderGeral = () => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const naoInic  = T.filter(t=>t.situation===10&&!(t.actual_time>0));
    const emAberto = T.filter(t=>t.situation===10&&t.actual_time>0);
    const emAtraso = T.filter(t=>t.situation!==30&&t.situation!==40&&t.due_date&&new Date(t.due_date)<hoje);
    const hNaoInic = H.filter(h=>tMap[h.task_id]?.situation===10&&!(tMap[h.task_id]?.actual_time>0)).reduce((s,h)=>s+(h.minutes||0),0);
    const hAberto  = H.filter(h=>tMap[h.task_id]?.situation===10&&tMap[h.task_id]?.actual_time>0).reduce((s,h)=>s+(h.minutes||0),0);

    return (
    <>
      {/* KPIs topo — rings */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        <KpiRing label="Horas Totais"   value={fmtH(totalMin)}  sub={`${mediaDia}h/dia · ${dias} dias`} color={C.red}  icon="⏱"/>
        <KpiRing label="Taxa Conclusão" value={`${taxaConcl}%`} sub={`${concl} de ${T.length} tarefas`} color={taxaConcl>60?C.green:C.orange} pctVal={taxaConcl}/>
        <KpiRing label="Eficiência"     value={`${efic}%`}      sub="do tempo em tarefas concluídas"    color={efic>50?C.green:C.amber} pctVal={efic}/>
      </div>

      {/* KPIs secundários — foco em abertas e atraso */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        <Kpi label="Custo Realizado"   value={fmtK(custoReal)}  sub="pelo Ekyte"                     color={C.amber}/>
        <Kpi label="Tarefas em Aberto" value={emAberto.length}  sub={`${fmtH(hAberto)} apontadas`}   color={C.blue}/>
        <Kpi label="Tarefas em Atraso" value={emAtraso.length}  sub={`${pct(emAtraso.length,T.length)}% do total`} color={emAtraso.length>0?C.orange:C.green}/>
        <Kpi label="Não Iniciadas"     value={naoInic.length}   sub="sem nenhum apontamento"          color={C.text3}/>
      </div>

      {/* Tendência + Painel de status */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <SecTitle sub="Horas confirmadas por dia">Evolução Diária</SecTitle>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={trend} margin={{top:4,right:4,bottom:0,left:-10}}>
              <defs>
                <linearGradient id="grd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.red} stopOpacity={.15}/>
                  <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="4 4" vertical={false}/>
              <XAxis dataKey="d" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}
                interval={Math.floor(trend.length/6)}/>
              <YAxis tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false} width={24}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="horas" stroke={C.red} strokeWidth={2.5}
                fill="url(#grd)" name="Horas" dot={false}
                activeDot={{r:5,fill:C.red,stroke:"#fff",strokeWidth:2}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{display:"flex",flexDirection:"column",gap:12}}>
          <SecTitle sub="Situação das tarefas do período">Status da Equipe</SecTitle>

          {/* Não iniciadas */}
          <div style={{background:C.bg,borderRadius:10,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:8,height:8,borderRadius:2,background:C.text3}}/>
                <span style={{color:C.text2,fontSize:12,fontWeight:600}}>Não iniciadas</span>
              </div>
              <span style={{color:C.text,fontSize:16,fontWeight:900}}>{naoInic.length}</span>
            </div>
            <Bar2 value={naoInic.length} max={T.length} color={C.text3} height={5}/>
            <p style={{color:C.text3,fontSize:10,margin:"4px 0 0"}}>{pct(naoInic.length,T.length)}% das tarefas sem apontamento</p>
          </div>

          {/* Em aberto */}
          <div style={{background:C.blueBg,borderRadius:10,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:8,height:8,borderRadius:2,background:C.blue}}/>
                <span style={{color:C.blue,fontSize:12,fontWeight:700}}>Em aberto</span>
              </div>
              <span style={{color:C.text,fontSize:16,fontWeight:900}}>{emAberto.length}</span>
            </div>
            <Bar2 value={emAberto.length} max={T.length} color={C.blue} height={5}/>
            <p style={{color:C.text3,fontSize:10,margin:"4px 0 0"}}>{fmtH(hAberto)} apontadas nessas tarefas</p>
          </div>

          {/* Em atraso */}
          <div style={{background:emAtraso.length>0?C.orangeBg:C.greenBg,borderRadius:10,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:12}}>{emAtraso.length>0?"⚠️":"✅"}</span>
                <span style={{color:emAtraso.length>0?C.orange:C.green,fontSize:12,fontWeight:700}}>
                  {emAtraso.length>0?"Em atraso":"Sem atrasos"}
                </span>
              </div>
              <span style={{color:C.text,fontSize:16,fontWeight:900}}>{emAtraso.length}</span>
            </div>
            {emAtraso.length>0&&<Bar2 value={emAtraso.length} max={T.length} color={C.orange} height={5}/>}
            <p style={{color:C.text3,fontSize:10,margin:"4px 0 0"}}>
              {emAtraso.length>0?`${pct(emAtraso.length,T.length)}% das tarefas com prazo vencido`:"Todas as tarefas dentro do prazo"}
            </p>
          </div>

          {/* Horas em concluídas */}
          <div style={{background:C.greenBg,borderRadius:10,padding:"12px 14px"}}>
            <p style={{color:C.text3,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",margin:"0 0 4px"}}>
              Horas em concluídas
            </p>
            <p style={{color:C.green,fontSize:20,fontWeight:900,margin:0}}>{fmtH(horasConcl)}</p>
            <p style={{color:C.text3,fontSize:10,margin:"3px 0 0"}}>{efic}% do total apontado</p>
          </div>
        </Card>
      </div>

      {/* Top clientes + Top membros */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <SecTitle sub="Por horas apontadas">Top Clientes</SecTitle>
          {hByWs.slice(0,6).map((w,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{width:28,height:28,borderRadius:8,background:PAL[i%PAL.length]+"20",
                display:"flex",alignItems:"center",justifyContent:"center",
                color:PAL[i%PAL.length],fontSize:11,fontWeight:900,flexShrink:0}}>
                {i+1}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.text,fontSize:12,fontWeight:600,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.name}</span>
                  <span style={{color:C.text2,fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>{w.horas}h</span>
                </div>
                <Bar2 value={w.horas} max={hByWs[0]?.horas||1} color={PAL[i%PAL.length]} height={5}/>
              </div>
              <span style={{color:C.amber,fontSize:11,fontWeight:700,flexShrink:0,width:80,textAlign:"right"}}>{fmtK(w.custo)}</span>
            </div>
          ))}
        </Card>

        <Card>
          <SecTitle sub="Por horas apontadas">Top Membros</SecTitle>
          {hByExec.slice(0,6).map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <Avatar name={m.name} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.text,fontSize:12,fontWeight:600,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                  <span style={{color:C.text2,fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>{m.horas}h</span>
                </div>
                <Bar2 value={m.horas} max={maxExec} color={i===0?C.red:i<3?C.amber:C.blue} height={5}/>
              </div>
              <span style={{color:C.amber,fontSize:11,fontWeight:700,flexShrink:0,width:80,textAlign:"right"}}>{fmtK(m.custo)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
    );
  };

  const renderHoras = () => (
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        <Kpi label="Total Horas"       value={fmtH(totalMin)}    sub={`${mediaDia}h/dia`}         color={C.red}/>
        <Kpi label="Custo Realizado"   value={fmtR(custoReal)}   sub="via Ekyte"                  color={C.amber}/>
        <Kpi label="Em Tarefas"        value={fmtH(byType[0]?.v)} sub="horas produtivas"          color={C.blue}/>
        <Kpi label="Eficiência"        value={`${efic}%`}         sub="horas em entregas concl."  color={efic>50?C.green:C.orange}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <SecTitle sub="Horas diárias no período">Evolução por Dia</SecTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trend} barSize={trend.length>20?6:12} margin={{top:4,right:4,bottom:0,left:-10}}>
              <CartesianGrid stroke={C.border} strokeDasharray="4 4" vertical={false}/>
              <XAxis dataKey="d" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}
                interval={Math.floor(trend.length/8)}/>
              <YAxis tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false} width={24}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="horas" name="Horas" fill={C.red} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SecTitle>Por Situação de Tarefa</SecTitle>
          <div style={{maxHeight:240,overflowY:"auto"}}>
            {bySit.map((s,i)=>{
              const cols={"Concluída":C.green,"Ativa":C.blue,"Pausada":C.amber,"Ticket":C.purple,"Avulso":C.text3};
              const c=cols[s.name]||PAL[i%PAL.length];
              return (
                <div key={i} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:10,height:10,borderRadius:3,background:c,flexShrink:0}}/>
                      <span style={{color:C.text2,fontSize:12}}>{s.name}</span>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <span style={{color:C.text3,fontSize:10}}>{pct(s.horas*60,totalMin)}%</span>
                      <span style={{color:C.text,fontSize:12,fontWeight:700}}>{s.horas}h</span>
                    </div>
                  </div>
                  <Bar2 value={s.horas} max={bySit[0]?.horas||1} color={c} height={5}/>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <SecTitle sub="Horas por tipo de tarefa">Por Categoria</SecTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hByTaskType} layout="vertical" barSize={13}>
              <XAxis type="number" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis dataKey="name" type="category" tick={{fill:C.text2,fontSize:10}} axisLine={false}
                tickLine={false} width={130} tickFormatter={n=>n.length>17?n.slice(0,17)+"…":n}/>
              <Tooltip content={<Tip/>} formatter={v=>`${v}h`}/>
              <Bar dataKey="horas" name="Horas" radius={[0,4,4,0]}>
                {hByTaskType.map((_,i)=><Cell key={i} fill={PAL[i%PAL.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SecTitle sub="Status das tarefas do período">Composição de Tarefas</SecTitle>
          {(()=>{
            const hoje = new Date(); hoje.setHours(0,0,0,0);
            const naoInic = T.filter(t=>t.situation===10&&!(t.actual_time>0));
            const emAberto= T.filter(t=>t.situation===10&&t.actual_time>0);
            const emAtraso= T.filter(t=>t.situation!==30&&t.situation!==40&&t.due_date&&new Date(t.due_date)<hoje);
            const conclui = T.filter(t=>t.situation===30);
            const data=[
              {name:"Não iniciadas",value:naoInic.length, c:C.text3},
              {name:"Em aberto",    value:emAberto.length,c:C.blue},
              {name:"Em atraso",    value:emAtraso.length,c:C.orange},
              {name:"Concluídas",   value:conclui.length, c:C.green},
            ].filter(x=>x.value>0);
            return (
              <>
                <PieChart width={220} height={170} style={{margin:"0 auto"}}>
                  <Pie data={data} cx={110} cy={80} innerRadius={50} outerRadius={78}
                    dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {data.map((d,i)=><Cell key={i} fill={d.c}/>)}
                  </Pie>
                  <Tooltip content={<Tip/>}/>
                </PieChart>
                <div style={{marginTop:10}}>
                  {data.map((d,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",
                      alignItems:"center",padding:"6px 4px",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:3,background:d.c,flexShrink:0}}/>
                        <span style={{color:C.text2,fontSize:12}}>{d.name}</span>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{color:C.text3,fontSize:10}}>{pct(d.value,T.length)}%</span>
                        <span style={{color:d.c,fontSize:13,fontWeight:800,minWidth:28,textAlign:"right"}}>{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {emAtraso.length>0&&(
                  <div style={{background:C.orangeBg,border:`1px solid ${C.orange}30`,borderRadius:8,
                    padding:"10px 12px",marginTop:12,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14}}>⚠️</span>
                    <div>
                      <p style={{color:C.orange,fontSize:11,fontWeight:800,margin:0}}>
                        {emAtraso.length} tarefa{emAtraso.length>1?"s":""} em atraso
                      </p>
                      <p style={{color:C.text3,fontSize:10,margin:"2px 0 0"}}>
                        {pct(emAtraso.length,T.length)}% do total do período
                      </p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </Card>
      </div>
    </>
  );

  const renderTarefas = () => (
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        <Kpi label="Total Tarefas"  value={T.length}       sub="no período"                    color={C.red}/>
        <Kpi label="Concluídas"     value={concl}          sub={`${taxaConcl}% do total`}       color={C.green}/>
        <Kpi label="Ativas"         value={ativas}         sub="em andamento"                   color={C.blue}/>
        <Kpi label="Pausadas"       value={T.filter(t=>t.situation===20).length} sub="aguardando" color={C.amber}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16,marginBottom:16}}>
        <Card>
          <SecTitle>Por Situação</SecTitle>
          <PieChart width={200} height={190} style={{margin:"0 auto"}}>
            <Pie data={Object.entries(SIT).map(([k,v])=>({name:v.l,value:T.filter(t=>t.situation===+k).length})).filter(x=>x.value>0)}
              cx={100} cy={88} innerRadius={54} outerRadius={84}
              dataKey="value" paddingAngle={3} strokeWidth={0}>
              {Object.entries(SIT).filter(([k])=>T.filter(t=>t.situation===+k).length>0)
                .map(([k,v],i)=><Cell key={i} fill={v.c}/>)}
            </Pie>
            <Tooltip content={<Tip/>}/>
          </PieChart>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginTop:8}}>
            {Object.entries(SIT).map(([k,v])=>{
              const n=T.filter(t=>t.situation===+k).length;
              if(!n) return null;
              return <Tag key={k} label={`${v.l} · ${n}`} color={v.c} bg={v.bg}/>;
            })}
          </div>
        </Card>

        <Card>
          <SecTitle sub="Quantidade de tarefas por etapa do fluxo">Por Etapa</SecTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tByFase} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis dataKey="n" type="category" tick={{fill:C.text2,fontSize:10}} axisLine={false}
                tickLine={false} width={130} tickFormatter={n=>n.length>17?n.slice(0,17)+"…":n}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="v" name="Tarefas" radius={[0,5,5,0]}>
                {tByFase.map((_,i)=><Cell key={i} fill={PAL[i%PAL.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <TabelaTarefas tarefas={T} SIT={SIT} fmtH={fmtH} C={C} Avatar={Avatar} Tag={Tag} />
    </>
  );

  const renderEquipe = () => (
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        <Kpi label="Membros com horas" value={hByExec.length}      sub="no período"           color={C.red}/>
        <Kpi label="Média p/ membro"   value={hByExec.length?fmtH(totalMin/hByExec.length):"-"} sub="por pessoa"  color={C.blue}/>
        <Kpi label="Custo p/ membro"   value={hByExec.length?fmtK(custoReal/hByExec.length):"-"} sub="custo médio" color={C.amber}/>
      </div>

      <Card style={{marginBottom:16}}>
        <SecTitle sub="Detalhamento por membro">Apontamentos da Equipe</SecTitle>
        {hByExec.map((m,i)=>(
          <div key={i} style={{borderBottom:`1px solid ${C.border}`,padding:"14px 0",
            display:"grid",gridTemplateColumns:"220px 1fr 100px 100px 100px",alignItems:"center",gap:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Avatar name={m.name} size={36}/>
              <div>
                <p style={{color:C.text,fontSize:13,fontWeight:700,margin:0}}>{m.name}</p>
                <p style={{color:C.text3,fontSize:10,margin:"2px 0 0"}}>{m.horas}h totais</p>
              </div>
            </div>
            <div>
              <div style={{display:"flex",gap:4,marginBottom:5}}>
                {[{v:m.task,c:C.blue,l:"Tarefas"},{v:m.ticket,c:C.purple,l:"Tickets"},{v:m.av,c:C.text3,l:"Avulso"}]
                  .filter(x=>x.v>0).map((x,j)=>(
                    <div key={j} style={{height:8,borderRadius:4,flex:x.v,background:x.c,minWidth:4,
                      transition:"flex .6s ease"}} title={`${x.l}: ${x.v}h`}/>
                  ))}
              </div>
              <div style={{display:"flex",gap:10}}>
                {[{v:m.task,c:C.blue,l:"Tarefas"},{v:m.ticket,c:C.purple,l:"Tickets"},{v:m.av,c:C.text3,l:"Avulso"}]
                  .filter(x=>x.v>0).map((x,j)=>(
                    <span key={j} style={{color:x.c,fontSize:10,fontWeight:700}}>{x.l}: {x.v}h</span>
                  ))}
              </div>
            </div>
            <div style={{textAlign:"center"}}>
              <p style={{color:C.text,fontSize:15,fontWeight:800,margin:0}}>{m.horas}h</p>
              <p style={{color:C.text3,fontSize:10,margin:"2px 0 0"}}>Total</p>
            </div>
            <div style={{textAlign:"center"}}>
              <p style={{color:C.amber,fontSize:15,fontWeight:800,margin:0}}>{fmtK(m.custo)}</p>
              <p style={{color:C.text3,fontSize:10,margin:"2px 0 0"}}>Custo</p>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:i===0?C.red:i<3?C.amber:C.text3}}>
                #{i+1}
              </div>
              <Bar2 value={m.horas} max={maxExec} color={i===0?C.red:i<3?C.amber:C.blue} height={6}/>
            </div>
          </div>
        ))}
      </Card>
    </>
  );

  const renderClientes = () => (
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        <Kpi label="Clientes Atendidos" value={hByWs.length}     sub="com horas no período"  color={C.red}/>
        <Kpi label="Custo Total"        value={fmtR(custoReal)}  sub="realizado via Ekyte"   color={C.amber}/>
        <Kpi label="Média por Cliente"  value={hByWs.length?fmtK(custoReal/hByWs.length):"-"} sub="custo médio" color={C.blue}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16,marginBottom:16}}>
        <Card>
          <SecTitle sub="Horas e custo por cliente">Distribuição</SecTitle>
          <ResponsiveContainer width="100%" height={Math.max(220,hByWs.length*38)}>
            <BarChart data={hByWs} layout="vertical" barSize={12} barGap={4}>
              <XAxis type="number" tick={{fill:C.text3,fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis dataKey="name" type="category" tick={{fill:C.text2,fontSize:10}} axisLine={false}
                tickLine={false} width={140} tickFormatter={n=>n.length>20?n.slice(0,20)+"…":n}/>
              <Tooltip content={<Tip/>} formatter={(v,n)=>n==="horas"?`${v}h`:fmtR(v)}/>
              <Bar dataKey="horas" name="Horas" fill={C.red}  radius={[0,4,4,0]}/>
              <Bar dataKey="custo" name="Custo" fill={C.amber} radius={[0,4,4,0]} opacity={.85}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SecTitle sub="Participação no custo total">Share de Custo</SecTitle>
          <PieChart width={220} height={200} style={{margin:"0 auto"}}>
            <Pie data={hByWs.slice(0,6).map(w=>({name:w.name,value:w.custo}))}
              cx={110} cy={92} innerRadius={54} outerRadius={84}
              dataKey="value" paddingAngle={3} strokeWidth={0}>
              {hByWs.slice(0,6).map((_,i)=><Cell key={i} fill={PAL[i%PAL.length]}/>)}
            </Pie>
            <Tooltip content={<Tip/>} formatter={v=>fmtR(v)}/>
          </PieChart>
          <div style={{marginTop:8}}>
            {hByWs.slice(0,5).map((w,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:10,height:10,borderRadius:3,background:PAL[i%PAL.length]}}/>
                  <span style={{color:C.text2,fontSize:11,maxWidth:120,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.name}</span>
                </div>
                <span style={{color:C.text,fontSize:11,fontWeight:700}}>{totalCusto?pct(w.custo,totalCusto):0}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"18px 22px 14px"}}><SecTitle>Análise Completa por Cliente</SecTitle></div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:C.bg}}>
              {["Cliente","Horas","Custo Realizado","Share","Tarefas","Concluídas","Taxa","Custo/h","Custo/Tarefa"].map(h=>(
                <th key={h} style={{color:C.text3,fontSize:9,fontWeight:700,letterSpacing:1,
                  textTransform:"uppercase",padding:"10px 14px",textAlign:"left",
                  borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {custoTab.map((c,i)=>{
              const pctC=pct(c.concl,c.tarefas);
              const custoH=c.horas>0?c.custo/c.horas:0;
              const custoT=c.tarefas>0?c.custo/c.tarefas:0;
              const share=pct(c.custo,totalCusto);
              return (
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`,transition:"background .1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.redLight}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:8,height:32,borderRadius:2,background:PAL[i%PAL.length],flexShrink:0}}/>
                      <div>
                        <p style={{color:C.text,fontSize:12,fontWeight:700,margin:0,maxWidth:150,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</p>
                        <p style={{color:C.text3,fontSize:10,margin:"1px 0 0"}}>{c.exec} membro(s)</p>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"12px 14px",color:C.text,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{c.horas}h</td>
                  <td style={{padding:"12px 14px",color:C.red,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{fmtR(c.custo)}</td>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <Bar2 value={c.custo} max={totalCusto} color={PAL[i%PAL.length]} height={5}/>
                      <span style={{color:C.text2,fontSize:10,flexShrink:0}}>{share}%</span>
                    </div>
                  </td>
                  <td style={{padding:"12px 14px",color:C.text2,fontSize:12,textAlign:"center"}}>{c.tarefas}</td>
                  <td style={{padding:"12px 14px",color:C.green,fontSize:12,textAlign:"center",fontWeight:700}}>{c.concl}</td>
                  <td style={{padding:"12px 14px"}}>
                    <Tag label={`${pctC}%`} color={pctC>60?C.green:C.orange} bg={pctC>60?C.greenBg:C.orangeBg}/>
                  </td>
                  <td style={{padding:"12px 14px",color:C.text2,fontSize:11,fontFamily:"monospace"}}>{fmtK(custoH)}/h</td>
                  <td style={{padding:"12px 14px",color:C.text2,fontSize:11,fontFamily:"monospace"}}>{fmtK(custoT)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:C.bg,borderTop:`2px solid ${C.border2}`}}>
              <td style={{padding:"12px 14px",color:C.text,fontSize:12,fontWeight:900}}>TOTAL</td>
              <td style={{padding:"12px 14px",color:C.text,fontSize:12,fontWeight:900,fontFamily:"monospace"}}>{(totalMin/60).toFixed(1)}h</td>
              <td style={{padding:"12px 14px",color:C.red,fontSize:12,fontWeight:900,fontFamily:"monospace"}}>{fmtR(custoReal)}</td>
              <td style={{padding:"12px 14px",color:C.text3}}>100%</td>
              <td style={{padding:"12px 14px",color:C.text,fontWeight:900,textAlign:"center"}}>{T.length}</td>
              <td style={{padding:"12px 14px",color:C.green,fontWeight:900,textAlign:"center"}}>{concl}</td>
              <td style={{padding:"12px 14px"}}><Tag label={`${taxaConcl}%`} color={taxaConcl>60?C.green:C.orange} bg={taxaConcl>60?C.greenBg:C.orangeBg}/></td>
              <td colSpan={2}/>
            </tr>
          </tfoot>
        </table>
      </Card>
    </>
  );

  const pages = {geral:renderGeral,horas:renderHoras,tarefas:renderTarefas,equipe:renderEquipe,clientes:renderClientes};

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
      color:C.text,display:"flex",flexDirection:"column"}}>
      <div style={{height:4,background:C.topbar}}/>

      {/* HEADER */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"0 24px",
        display:"flex",alignItems:"center",justifyContent:"space-between",height:54,
        position:"sticky",top:4,zIndex:200,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <a href="/" style={{
            display:"flex",alignItems:"center",justifyContent:"center",
            width:32,height:32,borderRadius:8,border:`1px solid ${C.border2}`,
            background:C.bg,color:C.text2,fontSize:16,textDecoration:"none",
            cursor:"pointer",transition:"all .15s",flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.background=C.redLight}
            onMouseLeave={e=>e.currentTarget.style.background=C.bg}>←
          </a>
          <div style={{width:34,height:34,background:C.red,borderRadius:8,display:"flex",
            alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:900}}>V4</div>
          <div>
            <p style={{color:C.text3,fontSize:9,letterSpacing:1.5,textTransform:"uppercase",margin:0}}>ACM&Co · Produtividade</p>
            <p style={{color:C.text,fontSize:14,fontWeight:800,margin:0}}>
              {NAV.find(n=>n.id===page)?.label}
            </p>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Filtros */}
          <MS label="Executor" opts={optsExec} val={xExec} set={setXExec}/>
          <MS label="Cliente"  opts={optsWs}   val={xWs}   set={setXWs}/>
          {(xExec.length||xWs.length)?
            <button onClick={()=>{setXExec([]);setXWs([]);}} style={{
              background:"transparent",color:C.text3,border:`1px solid ${C.border}`,
              borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>✕</button>:null}

          <div style={{width:1,height:22,background:C.border2,margin:"0 4px"}}/>

          {/* Período */}
          <div style={{display:"flex",gap:3,background:C.bg,borderRadius:8,padding:3}}>
            {PRESETS.map((p,i)=>(
              <button key={i} onClick={()=>ap(i)} style={{
                background:!custom&&preset===i?C.red:"transparent",
                color:!custom&&preset===i?"#fff":C.text3,
                border:"none",borderRadius:6,padding:"4px 11px",
                fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                {p.l}
              </button>
            ))}
            <button onClick={()=>setCustom(v=>!v)} style={{
              background:custom?C.red:"transparent",color:custom?"#fff":C.text3,
              border:"none",borderRadius:6,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              ✎
            </button>
          </div>

          {custom&&(
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="date" value={df} onChange={e=>setDf(e.target.value)}
                style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.text,
                  borderRadius:7,padding:"5px 8px",fontSize:11}}/>
              <span style={{color:C.text3,fontSize:11}}>→</span>
              <input type="date" value={dt} onChange={e=>setDt(e.target.value)}
                style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.text,
                  borderRadius:7,padding:"5px 8px",fontSize:11}}/>
            </div>
          )}

          {!loading&&!err&&(
            <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:4}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:C.green,
                boxShadow:`0 0 0 2px ${C.greenMid}`}}/>
              <span style={{color:C.text3,fontSize:10}}>Ao vivo</span>
            </div>
          )}
        </div>
      </div>

      <div style={{display:"flex",flex:1}}>
        {/* SIDEBAR */}
        <div style={{width:200,background:C.card,borderRight:`1px solid ${C.border}`,
          padding:"16px 12px",position:"sticky",top:58,height:"calc(100vh - 58px)",flexShrink:0}}>
          <p style={{color:C.text3,fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",
            margin:"0 0 8px 8px"}}>Menu</p>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{
              width:"100%",background:page===n.id?C.redLight:"transparent",
              color:page===n.id?C.red:C.text2,
              border:`1px solid ${page===n.id?C.redMid:"transparent"}`,
              borderRadius:8,padding:"9px 12px",fontSize:13,fontWeight:600,
              cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",
              gap:8,marginBottom:2,transition:"all .15s"}}>
              <span style={{fontSize:12,opacity:.7}}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          <div style={{position:"absolute",bottom:20,left:12,right:12}}>
            <div style={{background:C.bg,borderRadius:10,padding:"12px 14px"}}>
              <p style={{color:C.text3,fontSize:9,fontWeight:700,letterSpacing:1,
                textTransform:"uppercase",margin:"0 0 6px"}}>Período</p>
              <p style={{color:C.text,fontSize:12,fontWeight:700,margin:0}}>{df}</p>
              <p style={{color:C.text3,fontSize:10,margin:"2px 0"}}>até</p>
              <p style={{color:C.text,fontSize:12,fontWeight:700,margin:0}}>{dt}</p>
            </div>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div style={{flex:1,padding:"24px",overflow:"auto"}}>
          {loading&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",height:400,gap:16}}>
              <div style={{width:40,height:40,border:`3px solid ${C.border2}`,
                borderTop:`3px solid ${C.red}`,borderRadius:"50%",
                animation:"spin 1s linear infinite"}}/>
              <p style={{color:C.text3,fontSize:13}}>Carregando dados...</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {err&&(
            <div style={{background:C.redLight,border:`1px solid ${C.redMid}`,borderRadius:12,
              padding:20,color:C.red,fontSize:13}}>⚠ {err}</div>
          )}
          {!loading&&!err&&pages[page]?.()}
          {!loading&&!err&&(
            <p style={{textAlign:"center",color:C.text3,fontSize:10,marginTop:32,
              letterSpacing:1,textTransform:"uppercase"}}>
              V4 Company ACM · Ekyte API · {df} → {dt}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
