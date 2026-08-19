import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dominio, DOMINIO_CONFIG, healthMeta, fmtMetricValue,
  computeDomainScore, computeProjetoScore, MetricResult,
  PROJETO_CHECKLIST, computeAlertSignals, ChecklistAnswers,
} from '../lib/health'

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` } catch { return d }
}
function todayISO() { return new Date().toISOString().slice(0, 10) }

function ScoreRing({ score, color, size = 76 }: { score: number | null; color: string; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r
  const pct = score ?? 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hover-bg)" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} style={{ transition: 'stroke-dashoffset .3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 4.2, fontWeight: 800, color: 'var(--text-main)' }}>
        {score ?? '—'}
      </div>
    </div>
  )
}

function MetricRow({ m }: { m: MetricResult }) {
  const bad = m.atingimento != null && m.atingimento < 70
  const ok = m.atingimento != null && m.atingimento >= 100
  const color = m.atingimento == null ? 'var(--text-muted)' : ok ? '#16A34A' : bad ? '#FB2E0A' : '#D97706'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>{m.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Atual: <strong style={{ color: 'var(--text-secondary)' }}>{fmtMetricValue(m.atual, m.unidade)}</strong> · Meta: {m.meta != null ? fmtMetricValue(m.meta, m.unidade) : <em>não definida</em>}
        </div>
      </div>
      <div style={{ width: 90 }}>
        <div style={{ height: 6, background: 'var(--hover-bg)', borderRadius: 3, overflow: 'hidden' }}>
          {m.atingimento != null && <div style={{ width: `${Math.min(100, m.atingimento)}%`, height: '100%', background: color }} />}
        </div>
      </div>
      <div style={{ width: 48, textAlign: 'right', fontSize: 12, fontWeight: 700, color }}>{m.atingimento != null ? Math.round(m.atingimento) + '%' : '—'}</div>
    </div>
  )
}

interface Props {
  client: any
  onUpdateClient: (c: any) => void
  autorPadrao?: string
}

export default function HealthPanel({ client, onUpdateClient, autorPadrao }: Props) {
  const [dominio, setDominio] = useState<Dominio>('trafego')
  const [checks, setChecks] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [comercialAtuais, setComercialAtuais] = useState<Record<string, string>>({})
  const [playbook, setPlaybook] = useState<'sim' | 'parcial' | 'nao'>('sim')
  const [projetoChecklist, setProjetoChecklist] = useState<ChecklistAnswers>({})
  const [autor, setAutor] = useState(autorPadrao || '')
  const [dataRef, setDataRef] = useState(todayISO())
  const [observacao, setObservacao] = useState('')
  const [trafegoFormOpen, setTrafegoFormOpen] = useState(false)
  const [trafegoQuick, setTrafegoQuick] = useState({ data: todayISO(), roas: '', cpl: '', investimento: '' })
  const [windsorOpcoes, setWindsorOpcoes] = useState<{ id: string; nome: string }[]>([])
  const [windsorSelecionado, setWindsorSelecionado] = useState('')
  const [windsorFetching, setWindsorFetching] = useState(false)
  const [windsorInfo, setWindsorInfo] = useState<{ fonte: string; periodo: { date_from: string; date_to: string } } | null>(null)
  const [metasOpen, setMetasOpen] = useState(false)
  const [metasForm, setMetasForm] = useState<Record<string, string>>({})
  const [planForm, setPlanForm] = useState<{ open: boolean; descricao: string; responsavel: string; prazo: string }>({ open: false, descricao: '', responsavel: '', prazo: '' })
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [confirmForm, setConfirmForm] = useState<{ status: string; resultado: string }>({ status: 'confirmado_funcionou', resultado: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [chkRes, planRes] = await Promise.all([
      fetch(`/api/health-checks?cliente_id=${client.id}`),
      fetch(`/api/action-plans?cliente_id=${client.id}`),
    ])
    setChecks((await chkRes.json()).checks || [])
    setPlans((await planRes.json()).plans || [])
    setLoading(false)
  }, [client.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { setMetasForm(Object.fromEntries(Object.entries(client.metas || {}).map(([k, v]) => [k, String(v)]))) }, [client.metas])

  // Opções de vínculo com a fonte de dados real (Windsor/Kommo) da tela de Resultados —
  // não dá pra casar automaticamente clients x clientes (cadastros sem relação garantida),
  // então o vínculo é escolhido uma vez manualmente e fica salvo no cliente.
  useEffect(() => {
    fetch('/api/resultados-clientes').then(r => r.ok ? r.json() : { clientes: [] }).then(d => setWindsorOpcoes(d.clientes || [])).catch(() => {})
  }, [])

  async function buscarDoWindsor() {
    if (!client.resultadosClienteId) return
    setWindsorFetching(true)
    try {
      const res = await fetch(`/api/health-trafego-auto?resultados_cliente_id=${client.resultadosClienteId}&dias=30`)
      if (!res.ok) { alert('Não consegui buscar os dados agora. Tenta de novo em instantes.'); return }
      const d = await res.json()
      if (d.fonte === 'nenhuma') { alert('Esse vínculo não tem conta de Google/Meta Ads configurada no Windsor.'); return }
      setTrafegoQuick({
        data: todayISO(),
        roas: d.roas != null ? d.roas.toFixed(2) : '',
        cpl: d.cpl != null ? d.cpl.toFixed(2) : '',
        investimento: d.investimento != null ? d.investimento.toFixed(2) : '',
      })
      setWindsorInfo({ fonte: d.fonte, periodo: d.periodo })
      setTrafegoFormOpen(true)
    } finally {
      setWindsorFetching(false)
    }
  }

  async function vincularWindsor() {
    if (!windsorSelecionado) return
    onUpdateClient({ ...client, resultadosClienteId: windsorSelecionado })
  }

  const latestByDominio = useCallback((d: Dominio) => checks.filter(c => c.dominio === d)[0] || null, [checks])

  // ── TRÁFEGO: valores automáticos do último lançamento em metricasHistorico ──
  const trafegoAtuais = useMemo(() => {
    const hist = [...(client.metricasHistorico || [])].sort((a: any, b: any) => String(b.data || '').localeCompare(String(a.data || '')))
    const latest = hist[0]
    if (!latest) return { roas: null, cpl: null, investimento: null, dataRef: null }
    return { roas: parseFloat(latest.roas) || null, cpl: parseFloat(latest.cpl) || null, investimento: parseFloat(latest.invest) || null, dataRef: latest.data }
  }, [client.metricasHistorico])

  const trafegoCalc = useMemo(() => computeDomainScore('trafego', trafegoAtuais, client.metas || {}), [trafegoAtuais, client.metas])

  // ── COMERCIAL: valores digitados no form (ou do último check salvo, pra exibição) ──
  const comercialAtuaisParsed = useMemo(() => ({
    vendas: comercialAtuais.vendas ? parseFloat(comercialAtuais.vendas) : null,
    taxaFechamento: comercialAtuais.taxaFechamento ? parseFloat(comercialAtuais.taxaFechamento) : null,
    ticketMedio: comercialAtuais.ticketMedio ? parseFloat(comercialAtuais.ticketMedio) : null,
    cac: comercialAtuais.cac ? parseFloat(comercialAtuais.cac) : null,
  }), [comercialAtuais])
  const comercialCalc = useMemo(() => computeDomainScore('comercial', comercialAtuaisParsed, client.metas || {}), [comercialAtuaisParsed, client.metas])

  const lastTrafego = latestByDominio('trafego')
  const lastComercial = latestByDominio('comercial')
  const projetoCalc = useMemo(() => computeProjetoScore(lastTrafego?.score ?? null, lastComercial?.score ?? null, playbook), [lastTrafego, lastComercial, playbook])

  const currentForDominio = {
    trafego: { calc: trafegoCalc, last: lastTrafego },
    comercial: { calc: comercialCalc, last: lastComercial },
    projeto: { calc: projetoCalc, last: latestByDominio('projeto') },
  }[dominio]

  const displayStatus = currentForDominio.last?.status || currentForDominio.calc.status
  const displayScore = currentForDominio.last?.score ?? currentForDominio.calc.score
  const meta = healthMeta(displayStatus)

  // Sinais de atenção do checklist de Projeto — ao vivo (form aberto) e do último registro salvo
  const alertSignalsLive = useMemo(() => computeAlertSignals(projetoChecklist, playbook), [projetoChecklist, playbook])
  const lastProjeto = latestByDominio('projeto')
  const alertSignalsSaved = lastProjeto?.metricas?.alertas != null
    ? { alertas: lastProjeto.metricas.alertas, total: lastProjeto.metricas.total }
    : null

  const planosPendentes = plans.filter(p => p.status === 'pendente')
  const planosDominio = dominio === 'projeto' ? planosPendentes : planosPendentes.filter(p => p.dominio === dominio)
  const planosAtrasados = planosPendentes.filter(p => p.prazo < todayISO())

  function abrirTrafegoForm() {
    setTrafegoQuick({
      data: trafegoAtuais.dataRef || todayISO(),
      roas: trafegoAtuais.roas != null ? String(trafegoAtuais.roas) : '',
      cpl: trafegoAtuais.cpl != null ? String(trafegoAtuais.cpl) : '',
      investimento: trafegoAtuais.investimento != null ? String(trafegoAtuais.investimento) : '',
    })
    setWindsorInfo(null)
    setTrafegoFormOpen(true)
  }

  function salvarTrafegoQuick() {
    if (!trafegoQuick.data) return alert('Informe a data de referência.')
    const hist = [...(client.metricasHistorico || [])]
    const idx = hist.findIndex((h: any) => h.data === trafegoQuick.data)
    const patch = { roas: trafegoQuick.roas, cpl: trafegoQuick.cpl, invest: trafegoQuick.investimento, data: trafegoQuick.data, savedAt: new Date().toISOString() }
    if (idx >= 0) hist[idx] = { ...hist[idx], ...patch }
    else hist.unshift({ leads: '', roi: '', vendas: '', totalVendido: '', ...patch })
    hist.sort((a: any, b: any) => String(b.data || '').localeCompare(String(a.data || '')))
    onUpdateClient({ ...client, metricasHistorico: hist, metricas: hist[0] })
    setTrafegoFormOpen(false)
  }

  function abrirForm() {
    setAutor(autorPadrao || ''); setDataRef(todayISO()); setObservacao('')
    if (dominio === 'comercial') setComercialAtuais({})
    if (dominio === 'projeto') { setPlaybook('sim'); setProjetoChecklist({}) }
    setFormOpen(true)
  }

  async function salvarCheck() {
    if (!autor.trim()) return alert('Informe quem está registrando.')
    const calc = dominio === 'trafego' ? trafegoCalc : dominio === 'comercial' ? comercialCalc : projetoCalc
    if (calc.score == null && dominio !== 'projeto') return alert('Defina ao menos uma meta pra esse domínio antes de registrar (botão "Metas").')
    const body = {
      cliente_id: client.id, dominio, data: dataRef, autor: autor.trim(),
      score: calc.score, status: calc.status,
      metricas: dominio === 'projeto' ? { checklist: projetoChecklist, ...alertSignalsLive } : (calc as any).metrics,
      playbook_em_dia: dominio === 'projeto' ? playbook : null,
      observacao: observacao.trim() || null,
    }
    const res = await fetch('/api/health-checks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const { check } = await res.json()
      setChecks(p => [check, ...p])
      setFormOpen(false)
      if (calc.status !== 'saudavel') setPlanForm({ open: true, descricao: '', responsavel: autor.trim(), prazo: '' })
    } else {
      alert('Erro ao salvar. Tenta de novo.')
    }
  }

  async function salvarPlano() {
    if (!planForm.descricao.trim() || !planForm.responsavel.trim() || !planForm.prazo) return alert('Preencha descrição, responsável e prazo.')
    const lastCheck = checks[0]
    const body = { cliente_id: client.id, health_check_id: lastCheck?.id || null, dominio, descricao: planForm.descricao.trim(), responsavel: planForm.responsavel.trim(), prazo: planForm.prazo, criado_por: autor.trim() || autorPadrao || 'Não informado' }
    const res = await fetch('/api/action-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const { plan } = await res.json()
      setPlans(p => [...p, plan])
      setPlanForm({ open: false, descricao: '', responsavel: '', prazo: '' })
    }
  }

  async function confirmarPlano(id: number) {
    if (!confirmForm.resultado.trim()) return alert('Descreva o resultado observado.')
    const body = { id, status: confirmForm.status, resultado: confirmForm.resultado.trim(), confirmado_por: autorPadrao || 'Não informado' }
    const res = await fetch('/api/action-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const { plan } = await res.json()
      setPlans(p => p.map(x => x.id === id ? plan : x))
      setConfirmingId(null); setConfirmForm({ status: 'confirmado_funcionou', resultado: '' })
    }
  }

  function salvarMetas() {
    const metas: Record<string, number> = {}
    Object.entries(metasForm).forEach(([k, v]) => { if (v !== '' && v != null) metas[k] = parseFloat(v) })
    onUpdateClient({ ...client, metas })
    setMetasOpen(false)
  }

  const metasFieldsForDominio = dominio === 'projeto' ? [...DOMINIO_CONFIG.trafego.metrics, ...DOMINIO_CONFIG.comercial.metrics] : DOMINIO_CONFIG[dominio].metrics

  return (
    <div>
      {/* ── SWITCHER DE DOMÍNIO ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'var(--hover-bg)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['trafego', 'comercial', 'projeto'] as Dominio[]).map(d => (
          <button key={d} onClick={() => setDominio(d)} style={{
            padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: dominio === d ? 'var(--card-color)' : 'transparent', color: dominio === d ? 'var(--text-main)' : 'var(--text-muted)',
            boxShadow: dominio === d ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>{d === 'trafego' ? 'Tráfego' : d === 'comercial' ? 'Comercial' : 'Projeto (geral)'}</button>
        ))}
      </div>

      {planosAtrasados.length > 0 && (
        <div style={{ background: 'rgba(251,46,10,0.08)', border: '1px solid rgba(251,46,10,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 12, color: '#FB2E0A', fontWeight: 600 }}>
          ⚠ {planosAtrasados.length} plano(s) de ação com prazo vencido aguardando confirmação de resultado — role até "Planos de Ação" pra fechar o loop.
        </div>
      )}

      {/* ── CARD DE STATUS ATUAL ── */}
      <div style={{ background: meta.bg, border: `1px solid ${meta.color}33`, borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <ScoreRing score={displayScore} color={meta.color} />
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: meta.color }}>{meta.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {currentForDominio.last
              ? <>Registrado por <strong>{currentForDominio.last.autor}</strong> em {fmtDate(currentForDominio.last.data)}</>
              : 'Ainda sem registro — score calculado ao vivo com os dados atuais'}
          </div>
          {dominio === 'projeto' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Agrega Tráfego ({lastTrafego?.score ?? '—'}) + Comercial ({lastComercial?.score ?? '—'}) · Playbook: {currentForDominio.last?.playbook_em_dia || '—'}
            </div>
          )}
        </div>
        {dominio === 'projeto' && (() => {
          const sig = alertSignalsSaved || alertSignalsLive
          const sigColor = sig.alertas === 0 ? '#16A34A' : sig.alertas <= 2 ? '#D97706' : '#FB2E0A'
          return (
            <div style={{ textAlign: 'center', padding: '0 12px', borderLeft: `1px solid ${meta.color}33` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sinais de Atenção</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: sigColor }}>{sig.alertas}<span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>/{sig.total}</span></div>
              {!alertSignalsSaved && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ao vivo</div>}
            </div>
          )
        })()}
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => setMetasOpen(o => !o)}>Metas</button>
        {!formOpen && <button className="btn btn-primary btn-sm" onClick={abrirForm}>+ Registrar {dominio === 'projeto' ? 'Avaliação' : 'Check'}</button>}
      </div>

      {/* ── EDITAR METAS ── */}
      {metasOpen && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Metas combinadas com o cliente</div>
          <div className="form-grid-3">
            {metasFieldsForDominio.map(m => (
              <div className="field" key={m.metaField}>
                <label>{m.label} ({m.unidade === 'moeda' ? 'R$' : m.unidade === 'x' ? 'x' : m.unidade === 'pct' ? '%' : 'qtd'})</label>
                <input type="number" step="0.01" value={metasForm[m.metaField] || ''} onChange={e => setMetasForm(p => ({ ...p, [m.metaField]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => setMetasOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvarMetas}>Salvar Metas</button>
          </div>
        </div>
      )}

      {/* ── LANÇAMENTO RÁPIDO DE NÚMEROS DE TRÁFEGO ── */}
      {dominio === 'trafego' && (
        <div style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {trafegoAtuais.dataRef
              ? <>Números atuais vêm do lançamento de <strong style={{ color: 'var(--text-secondary)' }}>{fmtDate(trafegoAtuais.dataRef)}</strong> (compartilhado com a aba Métricas e Dash).</>
              : <>Nenhum número de tráfego lançado ainda para esse cliente — lance abaixo pra calcular o score.</>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {client.resultadosClienteId && (
              <button className="btn btn-sm" onClick={buscarDoWindsor} disabled={windsorFetching}>
                {windsorFetching ? 'Buscando...' : 'Buscar do Windsor (30d)'}
              </button>
            )}
            {!trafegoFormOpen && <button className="btn btn-sm" onClick={abrirTrafegoForm}>{trafegoAtuais.dataRef ? 'Atualizar Números' : '+ Lançar Números de Tráfego'}</button>}
          </div>
        </div>
      )}

      {dominio === 'trafego' && !client.resultadosClienteId && windsorOpcoes.length > 0 && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Esse cliente tem dados reais de mídia no Windsor — vincular pra buscar os números automaticamente?</span>
          <select value={windsorSelecionado} onChange={e => setWindsorSelecionado(e.target.value)} style={{ height: 32, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: 12, padding: '0 8px' }}>
            <option value="">Selecionar conta...</option>
            {windsorOpcoes.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" disabled={!windsorSelecionado} onClick={vincularWindsor}>Vincular</button>
        </div>
      )}

      {dominio === 'trafego' && trafegoFormOpen && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
          {windsorInfo && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
              Preenchido automaticamente via <strong>{windsorInfo.fonte === 'webhook' ? 'Kommo + Windsor' : 'Windsor'}</strong> · período {fmtDate(windsorInfo.periodo.date_from)} a {fmtDate(windsorInfo.periodo.date_to)} — confira antes de salvar.
            </div>
          )}
          <div className="form-grid-4" style={{ marginBottom: 4 }}>
            <div className="field"><label>Data de referência</label><input type="date" value={trafegoQuick.data} onChange={e => setTrafegoQuick(p => ({ ...p, data: e.target.value }))} /></div>
            <div className="field"><label>ROAS (ex: 4.8)</label><input value={trafegoQuick.roas} onChange={e => setTrafegoQuick(p => ({ ...p, roas: e.target.value }))} /></div>
            <div className="field"><label>CPL (R$)</label><input type="number" value={trafegoQuick.cpl} onChange={e => setTrafegoQuick(p => ({ ...p, cpl: e.target.value }))} /></div>
            <div className="field"><label>Investimento (R$)</label><input type="number" value={trafegoQuick.investimento} onChange={e => setTrafegoQuick(p => ({ ...p, investimento: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm" onClick={() => { setTrafegoFormOpen(false); setWindsorInfo(null) }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => { salvarTrafegoQuick(); setWindsorInfo(null) }}>Salvar Números</button>
          </div>
        </div>
      )}

      {/* ── BREAKDOWN DE MÉTRICAS (ao vivo) ── */}
      {dominio !== 'projeto' && (
        <div style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '4px 18px', marginBottom: 20 }}>
          {(dominio === 'trafego' ? trafegoCalc.metrics : comercialCalc.metrics).map(m => <MetricRow key={m.key} m={m} />)}
        </div>
      )}

      {/* ── FORM DE REGISTRO ── */}
      {formOpen && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
            {dominio === 'trafego' && 'Confirmar check de Tráfego (valores automáticos do último lançamento de métricas)'}
            {dominio === 'comercial' && 'Registrar números Comerciais do período'}
            {dominio === 'projeto' && 'Avaliação geral do Projeto'}
          </div>

          {dominio === 'comercial' && (
            <div className="form-grid-4" style={{ marginBottom: 4 }}>
              {DOMINIO_CONFIG.comercial.metrics.map(m => (
                <div className="field" key={m.key}>
                  <label>{m.label}</label>
                  <input type="number" step="0.01" value={comercialAtuais[m.key] || ''} onChange={e => setComercialAtuais(p => ({ ...p, [m.key]: e.target.value }))} placeholder={m.unidade === 'moeda' ? 'R$' : m.unidade === 'pct' ? '%' : ''} />
                </div>
              ))}
            </div>
          )}

          {dominio === 'projeto' && (
            <div className="field">
              <label>Playbook em Dia?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ k: 'sim', l: 'Sim' }, { k: 'parcial', l: 'Parcial' }, { k: 'nao', l: 'Não' }].map(o => (
                  <button key={o.k} type="button" onClick={() => setPlaybook(o.k as any)} style={{
                    padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: playbook === o.k ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                    background: playbook === o.k ? 'rgba(251,46,10,0.1)' : 'var(--card-color)',
                    color: playbook === o.k ? 'var(--red)' : 'var(--text-secondary)',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
          )}

          {dominio === 'projeto' && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: 8 }}>
                Checklist de Saúde (mesmos critérios da planilha de Account Plan)
              </label>
              <div style={{ display: 'grid', gap: 6 }}>
                {PROJETO_CHECKLIST.map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', background: 'var(--card-color)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {[{ k: 'sim', l: 'Sim' }, { k: 'nao', l: 'Não' }].map(o => (
                        <button key={o.k} type="button" onClick={() => setProjetoChecklist(p => ({ ...p, [item.key]: p[item.key] === o.k ? null : o.k as 'sim' | 'nao' }))} style={{
                          padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          border: projetoChecklist[item.key] === o.k ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                          background: projetoChecklist[item.key] === o.k ? 'rgba(251,46,10,0.1)' : 'var(--hover-bg)',
                          color: projetoChecklist[item.key] === o.k ? 'var(--red)' : 'var(--text-muted)',
                        }}>{o.l}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Sinais de atenção neste registro: <strong style={{ color: 'var(--text-secondary)' }}>{alertSignalsLive.alertas} de {alertSignalsLive.total}</strong>
              </div>
            </div>
          )}

          <div className="form-grid-2">
            <div className="field"><label>Registrado por *</label><input value={autor} onChange={e => setAutor(e.target.value)} placeholder="Seu nome" /></div>
            <div className="field"><label>Data de referência</label><input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)} /></div>
          </div>
          <div className="field"><label>Observação / contexto</label><textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} /></div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvarCheck}>Salvar Registro</button>
          </div>
        </div>
      )}

      {/* ── PLANO DE AÇÃO SUGERIDO APÓS CHECK RUIM ── */}
      {planForm.open && (
        <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#D97706' }}>Esse resultado não é Saudável — registrar um plano de ação?</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Fica pendente até você voltar aqui e confirmar se funcionou.</div>
          <div className="field"><label>O que será feito</label><textarea value={planForm.descricao} onChange={e => setPlanForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>
          <div className="form-grid-2">
            <div className="field"><label>Responsável</label><input value={planForm.responsavel} onChange={e => setPlanForm(p => ({ ...p, responsavel: e.target.value }))} /></div>
            <div className="field"><label>Prazo pra confirmar resultado</label><input type="date" value={planForm.prazo} onChange={e => setPlanForm(p => ({ ...p, prazo: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm" onClick={() => setPlanForm({ open: false, descricao: '', responsavel: '', prazo: '' })}>Pular</button>
            <button className="btn btn-primary btn-sm" onClick={salvarPlano}>Registrar Plano de Ação</button>
          </div>
        </div>
      )}

      {/* ── PLANOS DE AÇÃO ── */}
      <div className="sec-title" style={{ fontSize: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Planos de Ação {dominio !== 'projeto' && `(${DOMINIO_CONFIG[dominio].label})`}</span>
        <button className="btn btn-sm" onClick={() => setPlanForm({ open: true, descricao: '', responsavel: autorPadrao || '', prazo: '' })}>+ Novo Plano</button>
      </div>
      {planosDominio.length === 0 ? (
        <div className="empty" style={{ marginBottom: 20 }}>Nenhum plano pendente.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {planosDominio.map(p => {
            const atrasado = p.prazo < todayISO()
            return (
              <div key={p.id} style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 18px', borderLeft: `4px solid ${atrasado ? '#FB2E0A' : '#D97706'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{p.descricao}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {p.responsavel} · prazo {fmtDate(p.prazo)} {atrasado && <strong style={{ color: '#FB2E0A' }}>(vencido)</strong>} · {DOMINIO_CONFIG[p.dominio as 'trafego' | 'comercial']?.label || 'Projeto'}
                    </div>
                  </div>
                  {confirmingId !== p.id && <button className="btn btn-sm btn-primary" onClick={() => setConfirmingId(p.id)}>Confirmar Resultado</button>}
                </div>
                {confirmingId === p.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {[{ k: 'confirmado_funcionou', l: 'Funcionou' }, { k: 'confirmado_parcial', l: 'Parcialmente' }, { k: 'confirmado_nao_funcionou', l: 'Não Funcionou' }].map(o => (
                        <button key={o.k} type="button" onClick={() => setConfirmForm(f => ({ ...f, status: o.k }))} style={{
                          padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          border: confirmForm.status === o.k ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                          background: confirmForm.status === o.k ? 'rgba(251,46,10,0.1)' : 'var(--card-color)',
                          color: confirmForm.status === o.k ? 'var(--red)' : 'var(--text-secondary)',
                        }}>{o.l}</button>
                      ))}
                    </div>
                    <textarea value={confirmForm.resultado} onChange={e => setConfirmForm(f => ({ ...f, resultado: e.target.value }))} rows={2} placeholder="O que de fato aconteceu?" style={{ width: '100%', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => setConfirmingId(null)}>Cancelar</button>
                      <button className="btn btn-sm btn-primary" onClick={() => confirmarPlano(p.id)}>Salvar Confirmação</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      <div className="sec-title" style={{ fontSize: 16 }}>Histórico — {dominio === 'projeto' ? 'Projeto' : DOMINIO_CONFIG[dominio].label}</div>
      {loading ? <div className="empty">Carregando...</div> : checks.filter(c => c.dominio === dominio).length === 0 ? (
        <div className="empty">Nenhum registro ainda.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {checks.filter(c => c.dominio === dominio).map(chk => {
            const cm = healthMeta(chk.status)
            return (
              <div key={chk.id} style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 18px', borderLeft: `4px solid ${cm.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: cm.bg, color: cm.color, textTransform: 'uppercase' }}>{cm.label}</span>
                  {chk.score != null && <span style={{ fontSize: 11, fontWeight: 700, color: cm.color }}>{chk.score}/100</span>}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(chk.data)}</span>
                  {chk.playbook_em_dia && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Playbook: {chk.playbook_em_dia}</span>}
                </div>
                {chk.dominio !== 'projeto' && Array.isArray(chk.metricas) && chk.metricas.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {chk.metricas.map((m: MetricResult) => (
                      <span key={m.key} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                        {m.label}: {fmtMetricValue(m.atual, m.unidade)}{m.atingimento != null ? ` (${Math.round(m.atingimento)}%)` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {chk.dominio === 'projeto' && chk.metricas?.alertas != null && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: chk.metricas.alertas === 0 ? '#16A34A' : chk.metricas.alertas <= 2 ? '#D97706' : '#FB2E0A' }}>
                      {chk.metricas.alertas} de {chk.metricas.total} sinais de atenção
                    </span>
                    {chk.metricas.checklist && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {PROJETO_CHECKLIST.filter(item => chk.metricas.checklist[item.key] === 'nao').map(item => (
                          <span key={item.key} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'rgba(251,46,10,0.1)', color: 'var(--red)' }}>
                            {item.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {chk.observacao && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{chk.observacao}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Registrado por {chk.autor}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
