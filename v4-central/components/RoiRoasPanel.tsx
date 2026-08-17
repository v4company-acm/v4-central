import { useState } from 'react'
import {
  ROI_ROAS_STATUSES, RoiRoasCheck, RoiRoasStatusKey, roiRoasMeta, sortedRoiChecks,
  currentRoiCheck, suggestRoiRoasStatus, roasSeries,
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

  const [f, setF] = useState<{ status: RoiRoasStatusKey; autor: string; observacao: string; data: string }>({
    status: suggestion.status, autor: autorPadrao || '', observacao: '', data: new Date().toISOString().slice(0, 10),
  })

  function abrirForm() {
    setF({ status: suggestion.status, autor: autorPadrao || '', observacao: '', data: new Date().toISOString().slice(0, 10) })
    setFormOpen(true)
  }

  function salvar() {
    if (!f.autor.trim()) return alert('Informe quem está registrando.')
    onAddCheck({
      status: f.status,
      data: f.data,
      autor: f.autor.trim(),
      observacao: f.observacao.trim(),
      roasRef: suggestion.roas,
      roiRef: suggestion.roi,
      savedAt: new Date().toISOString(),
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 220 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: meta.color, flexShrink: 0, boxShadow: `0 0 0 5px ${meta.color}22` }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: meta.color }}>{meta.label}</div>
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
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {ROI_ROAS_STATUSES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
            {s.label}
          </div>
        ))}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Sugestão automática: ROAS ≥ 3x e ROI ≥ 20% = Saudável · ROAS ≥ 1x e ROI ≥ 0% = Atenção · abaixo disso = Crítico</span>
      </div>

      {/* ── FORM DE REGISTRO ── */}
      {formOpen && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--text-main)' }}>Registrar status desta semana</div>

          <div className="field">
            <label>Status *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROI_ROAS_STATUSES.map(s => (
                <button key={s.key} type="button" onClick={() => setF(p => ({ ...p, status: s.key }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: f.status === s.key ? `1.5px solid ${s.color}` : '1px solid var(--border-color)',
                    background: f.status === s.key ? s.bg : 'var(--card-color)',
                    color: f.status === s.key ? s.color : 'var(--text-secondary)',
                  }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field"><label>Registrado por *</label><input value={f.autor} onChange={e => setF(p => ({ ...p, autor: e.target.value }))} placeholder="Seu nome" /></div>
            <div className="field"><label>Semana de referência</label><input type="date" value={f.data} onChange={e => setF(p => ({ ...p, data: e.target.value }))} /></div>
          </div>
          <div className="field">
            <label>Observação / contexto</label>
            <textarea value={f.observacao} onChange={e => setF(p => ({ ...p, observacao: e.target.value }))} rows={3}
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
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: cm.bg, color: cm.color, textTransform: 'uppercase' }}>{cm.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{fmtDate(chk.data)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· ROAS {fmtRoas(chk.roasRef)} · ROI {fmtRoi(chk.roiRef)}</span>
                  </div>
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
