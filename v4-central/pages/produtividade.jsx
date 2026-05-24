import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from "recharts";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://pqzojyhyqzizgudrdkhr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxem9qeWh5cXppemd1ZHJka2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzE1ODYsImV4cCI6MjA5MjYwNzU4Nn0.dn4wXlLiPh7Nti0ybBbg1OApGlADK2agOEJsRbcAhwA"; // substitua pela anon key (pública)

const query = async (table, select = "*", filters = "") => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filters}&limit=1000`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Erro ao buscar ${table}`);
  return res.json();
};

// ─── CORES ─────────────────────────────────────────────────────────────────
const RED      = "#E8002D";
const DARK     = "#0A0A0A";
const SURFACE  = "#141414";
const CARD     = "#1C1C1C";
const BORDER   = "#2A2A2A";
const TEXT      = "#F0F0F0";
const MUTED    = "#888";
const PALETTE  = ["#E8002D","#FF4D6D","#FF8FA3","#FFB3C1","#FFCCD5","#6C63FF","#3ECFCF","#F5A623"];

// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmtH = (min) => {
  const h = Math.floor((min || 0) / 60);
  const m = (min || 0) % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
};

const situacaoLabel = { 10: "Ativa", 20: "Pausada", 30: "Concluída", 40: "Cancelada" };
const situacaoCor   = { 10: "#3ECFCF", 20: "#F5A623", 30: "#4CAF50", 40: "#888" };

// ─── COMPONENTES BASE ──────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
    padding: "20px 24px", ...style
  }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
    {children}
  </p>
);

const BigNumber = ({ value, unit = "" }) => (
  <p style={{ color: TEXT, fontSize: 36, fontWeight: 800, margin: 0, fontFamily: "'DM Mono', monospace" }}>
    {value}<span style={{ color: MUTED, fontSize: 18, marginLeft: 4 }}>{unit}</span>
  </p>
);

const SectionTitle = ({ children }) => (
  <h2 style={{ color: TEXT, fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "32px 0 16px", borderLeft: `3px solid ${RED}`, paddingLeft: 12 }}>
    {children}
  </h2>
);

const Pill = ({ label, color }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
    {label}
  </span>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || TEXT, fontSize: 13, fontWeight: 700, margin: 0 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ─── PERÍODO FILTER ────────────────────────────────────────────────────────
const periods = [
  { label: "7d",  days: 7  },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const dateFrom = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
};

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod]     = useState(30);
  const [tarefas, setTarefas]   = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [horas, setHoras]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const from = dateFrom(period);
        const [t, p, h] = await Promise.all([
          query("ekyte_tarefas", "*", `&creation_date=gte.${from}`),
          query("ekyte_projetos", "*"),
          query("ekyte_horas", "*", `&date=gte.${from}`),
        ]);
        setTarefas(t);
        setProjetos(p);
        setHoras(h);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalHoras   = horas.reduce((s, h) => s + (h.minutes || 0), 0);
  const totalTarefas = tarefas.length;
  const concluidas   = tarefas.filter(t => t.situation === 30).length;
  const projAtivos   = projetos.filter(p => p.status === 10).length;

  // ── Tarefas por etapa (situation) ────────────────────────────────────────
  const tarefasPorSit = Object.entries(
    tarefas.reduce((acc, t) => {
      const k = situacaoLabel[t.situation] || "Outro";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // ── Horas por workspace ───────────────────────────────────────────────────
  const horasPorWs = Object.entries(
    horas.reduce((acc, h) => {
      const k = h.workspace || "Sem workspace";
      acc[k] = (acc[k] || 0) + (h.minutes || 0);
      return acc;
    }, {})
  )
    .map(([name, minutes]) => ({ name, horas: +(minutes / 60).toFixed(1) }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 10);

  // ── Horas por membro ──────────────────────────────────────────────────────
  const horasPorMembro = Object.entries(
    horas.reduce((acc, h) => {
      const k = h.executor || "Sem executor";
      acc[k] = (acc[k] || 0) + (h.minutes || 0);
      return acc;
    }, {})
  )
    .map(([name, minutes]) => ({ name, horas: +(minutes / 60).toFixed(1) }))
    .sort((a, b) => b.horas - a.horas);

  // ── Projetos por status ───────────────────────────────────────────────────
  const projPorStatus = Object.entries(
    projetos.reduce((acc, p) => {
      const k = p.status_label || "Outro";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // ── Tarefas por fase ──────────────────────────────────────────────────────
  const tarefasPorFase = Object.entries(
    tarefas.reduce((acc, t) => {
      const k = t.phase || "Sem etapa";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div style={{
      minHeight: "100vh", background: DARK, color: TEXT,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: "0 0 60px",
    }}>
      {/* ── HEADER ── */}
      <div style={{
        background: SURFACE, borderBottom: `1px solid ${BORDER}`,
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 32, background: RED, borderRadius: 2 }} />
          <div>
            <p style={{ color: MUTED, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>V4 Company ACM</p>
            <p style={{ color: TEXT, fontSize: 16, fontWeight: 800, margin: 0 }}>Produtividade</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: CARD, borderRadius: 8, padding: 4 }}>
          {periods.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              style={{
                background: period === p.days ? RED : "transparent",
                color: period === p.days ? "#fff" : MUTED,
                border: "none", borderRadius: 6, padding: "6px 14px",
                fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s"
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 32px 0" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⟳</div>
            <p>Carregando dados do Supabase...</p>
          </div>
        )}

        {error && (
          <div style={{ background: "#E8002D22", border: `1px solid ${RED}`, borderRadius: 8, padding: 16, marginBottom: 24, color: "#FF8FA3" }}>
            ⚠ {error}. Verifique a ANON KEY do Supabase no topo do arquivo.
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── KPIs ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <Card>
                <Label>Horas Apontadas</Label>
                <BigNumber value={fmtH(totalHoras)} />
                <p style={{ color: MUTED, fontSize: 12, margin: "4px 0 0" }}>nos últimos {period} dias</p>
              </Card>
              <Card>
                <Label>Tarefas no Período</Label>
                <BigNumber value={totalTarefas} />
                <p style={{ color: MUTED, fontSize: 12, margin: "4px 0 0" }}>
                  <span style={{ color: "#4CAF50" }}>{concluidas} concluídas</span>
                </p>
              </Card>
              <Card>
                <Label>Taxa de Conclusão</Label>
                <BigNumber value={totalTarefas ? Math.round((concluidas / totalTarefas) * 100) : 0} unit="%" />
                <p style={{ color: MUTED, fontSize: 12, margin: "4px 0 0" }}>das tarefas do período</p>
              </Card>
              <Card>
                <Label>Projetos Ativos</Label>
                <BigNumber value={projAtivos} />
                <p style={{ color: MUTED, fontSize: 12, margin: "4px 0 0" }}>de {projetos.length} totais</p>
              </Card>
            </div>

            {/* ── PROJETOS ── */}
            <SectionTitle>Projetos</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
              <Card>
                <Label>Distribuição por Status</Label>
                <PieChart width={220} height={200} style={{ margin: "0 auto" }}>
                  <Pie data={projPorStatus} cx={110} cy={90} innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {projPorStatus.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {projPorStatus.map((p, i) => (
                    <Pill key={i} label={`${p.name} (${p.value})`} color={PALETTE[i % PALETTE.length]} />
                  ))}
                </div>
              </Card>

              <Card>
                <Label>Lista de Projetos</Label>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {projetos.slice(0, 15).map((p, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 0", borderBottom: `1px solid ${BORDER}`
                    }}>
                      <div>
                        <p style={{ color: TEXT, fontSize: 13, fontWeight: 600, margin: 0 }}>{p.title || "—"}</p>
                        <p style={{ color: MUTED, fontSize: 11, margin: "2px 0 0" }}>{p.workspace}</p>
                      </div>
                      <Pill label={p.status_label || "—"} color={p.status === 10 ? "#3ECFCF" : p.status === 30 ? "#4CAF50" : MUTED} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* ── TAREFAS ── */}
            <SectionTitle>Tarefas</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card>
                <Label>Por Situação</Label>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tarefasPorSit} barSize={28}>
                    <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {tarefasPorSit.map((entry, i) => (
                        <Cell key={i} fill={Object.values(situacaoCor)[i % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <Label>Por Etapa (fase atual)</Label>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tarefasPorFase} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill={RED} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ── HORAS ── */}
            <SectionTitle>Apontamento de Horas</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card>
                <Label>Horas por Cliente (Workspace)</Label>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={horasPorWs} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="horas" fill="#6C63FF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <Label>Horas por Membro da Equipe</Label>
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  {horasPorMembro.map((m, i) => {
                    const pct = horasPorMembro[0]?.horas > 0 ? (m.horas / horasPorMembro[0].horas) * 100 : 0;
                    return (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: TEXT, fontSize: 13 }}>{m.name}</span>
                          <span style={{ color: MUTED, fontSize: 12, fontFamily: "monospace" }}>{m.horas}h</span>
                        </div>
                        <div style={{ background: BORDER, borderRadius: 4, height: 6 }}>
                          <div style={{
                            height: 6, borderRadius: 4, width: `${pct}%`,
                            background: `linear-gradient(90deg, ${RED}, #FF4D6D)`,
                            transition: "width .6s ease"
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* ── FOOTER ── */}
            <p style={{ textAlign: "center", color: MUTED, fontSize: 11, marginTop: 48, letterSpacing: 1 }}>
              V4 Company ACM · Dados sincronizados via Ekyte API → Supabase · Período: últimos {period} dias
            </p>
          </>
        )}
      </div>
    </div>
  );
}
