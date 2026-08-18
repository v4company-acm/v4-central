import { useState, useMemo } from 'react'
import {
  ROI_ROAS_STATUSES, RoiRoasCheck, roiRoasMeta, sortedRoiChecks,
  currentRoiCheck, suggestRoiRoasStatus, roasSeries,
  HEALTH_CRITERIA, HealthAnswers, computeHealthScore,
} from '../lib/roiRoas'

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` } catch { return d }
}
function fmtRoas(v: number | null | undefined) { return v || v === 0 ? v.toFixed(1) + 'x' : '—' }
function fmtRoi(v: number | null | undefined) { return v || v === 0 ? v + '%' : '—' }

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dados insuficientes para tendência.</div>
  const w = 100, h = 32, max = Math.max(...data, 1), min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  const last = data[data.length - 1], prev = data[data.length - 2]
  const color = last >= prev ? '#16A34A' : '#FB2E0A'
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Barra de score 0-100, com marcadores nos cortes de status (35 e 70).
function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--hover-bg)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '35%', top: 0, bottom: 0, width: 1, background: 'var(--border-color)' }} />
      <div style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: 1, background: 'var(--border-color)' }} />
      <div style={{ width: `${Math.max(2, score)}%`, height: '100%', background: color, transition: 'width .25s' }} />
    </div>
  )
}

interface Props {
  historico: any[]
  checks: RoiRoasCheck[]
  autorPadrao?: string
  onAddCheck: (check: RoiRoasCheck) => void
  onRemoveCheck: (idx: number) => void
}

export default function RoiRoasPanel({ historico, checks, autorPadrao, onAddCheck, onRemoveCheck }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const suggestion = suggestRoiRoasStatus(historico)
  const current = currentRoiCheck(checks)
  const displayStatus = current?.status || suggestion.status
  const meta = roiRoasMeta(displayStatus)
  const series = roasSeries(historico)
  const sorted = sortedRoiChecks(checks)

  const [autor, setAutor] = useState(autorPadrao || '')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [observacao, setObservacao] = useState('')
  const [emImplantacao, setEmImplantacao] = useState(false)
  const [answers, setAnswers] = useState<HealthAnswers>({})

  const live = useMemo(() => computeHealthScore(answers), [answers])
  const liveMeta = roiRoasMeta(emImplantacao ? 'implantacao' : live.status)
  const allAnswered = live.answered === HEALTH_CRITERIA.length

  function abrirForm() {
    // pré-preenche o critério de ROAS/ROI vs meta com a sugestão automática — os outros 4 ficam em aberto pro account julgar.
    const preAnswers: HealthAnswers = {}
    if (suggestion.status === 'saudavel') preAnswers.metaRoasRoi = 'acima'
    else if (suggestion.status === 'atencao') preAnswers.metaRoasRoi = 'na_meta'
    else if (suggestion.status === 'critico') preAnswers.metaRoasRoi = 'abaixo'
    setAnswers(preAnswers)
    setAutor(autorPadrao || ''); setData(new Date().toISOString().slice(0, 10)); setObservacao(''); setEmImplantacao(false)
    setFormOpen(true)
  }

  function salvar() {
    if (!autor.trim()) return alert('Informe quem está registrando.')
    if (!emImplantacao && !allAnswered) return alert('Preencha os 5 critérios do scorecard (ou marque "ainda em implantação").')
    const result = emImplantacao ? { score: 0, status: 'implantacao' as const } : live
    onAddCheck({
      status: result.status,
      data, autor: autor.trim(), observacao: observacao.trim(),
      roasRef: suggestion.roas, roiRef: suggestion.roi,
      savedAt: new Date().toISOString(),
      answers: emImplantacao ? undefined : answers,
      score: emImplantacao ? undefined : result.score,
      emImplantacao,
    })
    setFormOpen(false)
  }

  return (
    <div>
      {/* ── CARD DE STATUS ATUAL ── */}
      <div style={{
        background: meta.bg, border: `1px solid ${meta.color}33`, borderRadius: 12,
        padding: 20, marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 240 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: meta.color, flexShrink: 0, boxShadow: `0 0 0 5px ${meta.color}22` }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: meta.color, display: 'flex', alignItems: 'center', gap: 8 }}>
              {meta.label}
              {current?.score != null && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{current.score}/100</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {current
                ? <>Registrado por <strong>{current.autor}</strong> em {fmtDate(current.data)}</>
                : <>Ainda sem registro manual — sugestão automática com base no último lançamento de métricas</>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, flex: 1, minWidth: 260 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>ROAS atual</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>{fmtRoas(current?.roasRef ?? suggestion.roas)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>ROI atual</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>{fmtRoi(current?.roiRef ?? suggestion.roi)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Tendência ROAS</div>
            <Sparkline data={series} />
          </div>
        </div>

        {!formOpen && <button className="btn btn-primary btn-sm" onClick={abrirForm}>+ Registrar Status</button>}
      </div>

      {/* ── LEGENDA OBJETIVA ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        {ROI_ROAS_STATUSES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
            {s.label}
          </div>
        ))}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Score 70-100 = Saudável · 35-69 = Atenção · 0-34 = Crítico, calculado a partir dos 5 critérios abaixo</span>
      </div>

      {/* ── FORM DE REGISTRO (SCORECARD) ── */}
      {formOpen && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Registrar status desta semana</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={emImplantacao} onChange={e => setEmImplantacao(e.target.checked)} style={{ accentColor: 'var(--red)' }} />
              Ainda em implantação (sem dado suficiente pro scorecard)
            </label>
          </div>

          {!emImplantacao && (
            <>
              {/* Resultado ao vivo enquanto preenche */}
              <div style={{ background: 'var(--card-color)', border: `1px solid ${liveMeta.color}33`, borderRadius: 8, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: liveMeta.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: liveMeta.color }}>{liveMeta.label} — {live.score}/100</div>
                  <div style={{ marginTop: 6 }}><ScoreBar score={live.score} color={liveMeta.color} /></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{live.answered}/{HEALTH_CRITERIA.length} critérios</div>
              </div>

              <div style={{ display: 'grid', gap: 16, marginBottom: 18 }}>
                {HEALTH_CRITERIA.map(crit => (
                  <div key={crit.key} className="field" style={{ marginBottom: 0 }}>
                    <label>{crit.label}</label>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, marginTop: -2 }}>{crit.hint}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {crit.options.map(opt => {
                        const active = answers[crit.key] === opt.key
                        const optColor = opt.points === 20 ? '#16A34A' : opt.points === 0 ? '#FB2E0A' : '#D97706'
                        return (
                          <button key={opt.key} type="button" onClick={() => setAnswers(p => ({ ...p, [crit.key]: opt.key }))}
                            style={{
                              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              border: active ? `1.5px solid ${optColor}` : '1px solid var(--border-color)',
                              background: active ? `${optColor}1a` : 'var(--card-color)',
                              color: active ? optColor : 'var(--text-secondary)',
                            }}>{opt.label}</button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="form-grid-2">
            <div className="field"><label>Registrado por *</label><input value={autor} onChange={e => setAutor(e.target.value)} placeholder="Seu nome" /></div>
            <div className="field"><label>Semana de referência</label><input type="date" value={data} onChange={e => setData(e.target.value)} /></div>
          </div>
          <div className="field">
            <label>Observação / contexto</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3}
              placeholder="Ex: ROAS caiu por causa de aumento de CPM no Meta; já ajustamos orçamento." />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvar}>Salvar Registro</button>
          </div>
        </div>
      )}

      {/* ── HISTÓRICO DE REGISTROS ── */}
      <div className="sec-title" style={{ fontSize: 16 }}>Histórico de Registros</div>
      {sorted.length === 0 ? (
        <div className="empty">Nenhum status foi registrado manualmente ainda. Use "+ Registrar Status" para começar o acompanhamento.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map((chk, i) => {
            const cm = roiRoasMeta(chk.status)
            return (
              <div key={i} style={{
                background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8,
                padding: '14px 18px', borderLeft: `4px solid ${cm.color}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: cm.bg, color: cm.color, textTransform: 'uppercase' }}>{cm.label}</span>
                    {chk.score != null && <span style={{ fontSize: 11, fontWeight: 700, color: cm.color }}>{chk.score}/100</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{fmtDate(chk.data)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· ROAS {fmtRoas(chk.roasRef)} · ROI {fmtRoi(chk.roiRef)}</span>
                  </div>
                  {chk.answers && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: chk.observacao ? 8 : 0 }}>
                      {HEALTH_CRITERIA.map(crit => {
                        const chosen = crit.options.find(o => o.key === chk.answers?.[crit.key])
                        if (!chosen) return null
                        const c = chosen.points === 20 ? '#16A34A' : chosen.points === 0 ? '#FB2E0A' : '#D97706'
                        return (
                          <span key={crit.key} title={crit.label} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${c}14`, color: c }}>
                            {crit.label.split(' ')[0]}: {chosen.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {chk.observacao && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{chk.observacao}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Registrado por {chk.autor}</div>
                </div>
                <button style={{ background: 'none', border: 'none', color: '#FB2E0A', cursor: 'pointer', fontSize: 14 }}
                  onClick={() => { if (confirm('Remover este registro permanentemente?')) onRemoveCheck(checks.indexOf(chk)) }}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
