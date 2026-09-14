import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PlaybookTipo, TIPOS_ORDENADOS, TIPO_META, FREQ_LABEL, DIAS_SEMANA,
  PLAYBOOK_PRESETS, sugerirPresets, fmtCadencia, fmtDate, todayISO, isAtrasado,
} from '../lib/playbook'
import PlaybookKanban, { semanaDoItem, normalizarLink, PlaybookItemEdit } from './PlaybookKanban'

const JANELA_KANBAN_SEMANAS = 4

interface Props { client: any; autorPadrao?: string }

const NOVA_REGRA_DEFAULT = { titulo: '', descricao: '', tipo: 'relatorio' as PlaybookTipo, frequencia: 'semanal' as 'semanal' | 'quinzenal' | 'mensal' | 'unico', dia_semana: 1, dia_mes: 1, responsavel: '', data_inicio: todayISO() }
const NOVO_AVULSO_DEFAULT = { titulo: '', tipo: 'outro' as PlaybookTipo, data_prevista: todayISO(), responsavel: '', descricao: '', link: '' }

function MesLabel(dataISO: string) {
  const [y, m] = dataISO.split('-')
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${nomes[parseInt(m, 10) - 1]} ${y}`
}

export default function PlaybookPanel({ client, autorPadrao }: Props) {
  const [regras, setRegras] = useState<any[]>([])
  const [itens, setItens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [regraFormOpen, setRegraFormOpen] = useState(false)
  const [regraForm, setRegraForm] = useState<any>(NOVA_REGRA_DEFAULT)
  const [avulsoFormOpen, setAvulsoFormOpen] = useState(false)
  const [avulsoForm, setAvulsoForm] = useState<any>(NOVO_AVULSO_DEFAULT)
  const [autor, setAutor] = useState(autorPadrao || '')
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)
  const [obsConfirm, setObsConfirm] = useState('')
  const [templates, setTemplates] = useState<any[]>([])
  const [roadmaps, setRoadmaps] = useState<any[]>([])
  const [applyFormId, setApplyFormId] = useState<number | null>(null)
  const [applyDataInicio, setApplyDataInicio] = useState(todayISO())
  const [applying, setApplying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await fetch('/api/playbook-gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: client.id }) })
      const [rRes, iRes, rmRes] = await Promise.all([
        fetch(`/api/playbook-regras?cliente_id=${client.id}`, { cache: 'no-store' }),
        fetch(`/api/playbook-itens?cliente_id=${client.id}`, { cache: 'no-store' }),
        fetch(`/api/playbook-roadmaps?cliente_id=${client.id}`, { cache: 'no-store' }),
      ])
      if (rRes.ok) setRegras((await rRes.json()).regras || [])
      if (iRes.ok) setItens((await iRes.json()).itens || [])
      if (rmRes.ok) setRoadmaps((await rmRes.json()).roadmaps || [])
    } catch (e) {
      console.error('Erro ao carregar Playbook:', e)
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/playbook-templates', { cache: 'no-store' }).then(r => r.ok ? r.json() : { templates: [] }).then(d => setTemplates(d.templates || [])).catch(() => {})
  }, [])

  const sugestoes = useMemo(() => sugerirPresets(client.servicos || []), [client.servicos])
  const titulosExistentes = useMemo(() => new Set(regras.filter(r => r.ativo).map(r => r.titulo)), [regras])

  const pendentes = itens.filter(i => i.status === 'pendente')
  const atrasados = pendentes.filter(isAtrasado)
  const proximosMeses = pendentes.filter(i => !isAtrasado(i))

  // Curto prazo (próximas ~4 semanas) vira quadro kanban — dá a previsibilidade de
  // relance que uma lista de texto não dá. O que passa disso (meses 2-3) fica na
  // lista mensal mais enxuta abaixo, já que é horizonte de planejamento, não ação imediata.
  const noKanban = proximosMeses.filter(i => semanaDoItem(i.data_prevista) < JANELA_KANBAN_SEMANAS)
  const maisAdiante = proximosMeses.filter(i => semanaDoItem(i.data_prevista) >= JANELA_KANBAN_SEMANAS)

  const porMes: Record<string, any[]> = {}
  maisAdiante.forEach(i => { const k = i.data_prevista.slice(0, 7); (porMes[k] = porMes[k] || []).push(i) })
  const meses = Object.keys(porMes).sort()

  function usarPreset(p: typeof PLAYBOOK_PRESETS[number]) {
    setRegraForm({ titulo: p.titulo, descricao: '', tipo: p.tipo, frequencia: p.frequencia, dia_semana: p.dia_semana ?? 1, dia_mes: p.dia_mes ?? 1, responsavel: '', data_inicio: todayISO() })
    setRegraFormOpen(true)
  }

  function abrirAplicar(templateId: number) {
    setApplyDataInicio(client.dataEntrada || todayISO())
    setApplyFormId(templateId)
  }

  async function aplicarTemplate() {
    if (!autor.trim()) return alert('Informe quem está aplicando o roteiro.')
    if (roadmaps.length > 0 && !confirm('Esse cliente já tem roteiro(s) aplicado(s) antes. Aplicar mais um vai somar as tarefas do novo template sem apagar o que já existe. Continuar?')) return
    setApplying(true)
    try {
      const res = await fetch('/api/playbook-aplicar-template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: client.id, template_id: applyFormId, data_inicio: applyDataInicio, criado_por: autor.trim() }),
      })
      if (res.ok) {
        const d = await res.json()
        await load()
        setApplyFormId(null)
        alert(`Roteiro aplicado — ${d.criados} tarefas geradas a partir de ${new Date(applyDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}.`)
      } else {
        const d = await res.json().catch(() => ({}))
        alert(`Erro ao aplicar: ${d.error || 'tenta de novo.'}`)
      }
    } finally {
      setApplying(false)
    }
  }

  async function salvarRegra() {
    if (!regraForm.titulo.trim()) return alert('Dê um título pra essa regra.')
    if (!autor.trim()) return alert('Informe quem está cadastrando.')
    const body = {
      cliente_id: client.id, titulo: regraForm.titulo.trim(), descricao: regraForm.descricao.trim() || null,
      tipo: regraForm.tipo, frequencia: regraForm.frequencia,
      dia_semana: ['semanal', 'quinzenal'].includes(regraForm.frequencia) ? regraForm.dia_semana : null,
      dia_mes: regraForm.frequencia === 'mensal' ? regraForm.dia_mes : null,
      responsavel: regraForm.responsavel.trim() || null, data_inicio: regraForm.data_inicio, criado_por: autor.trim(),
    }
    const res = await fetch('/api/playbook-regras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { await load(); setRegraFormOpen(false); setRegraForm(NOVA_REGRA_DEFAULT) }
    else { const d = await res.json().catch(() => ({})); alert(`Erro ao salvar: ${d.error || 'tenta de novo.'}`) }
  }

  async function desativarRegra(id: number) {
    if (!confirm('Desativar essa regra? As entregas futuras ainda pendentes dela serão canceladas (o que já foi entregue continua no histórico).')) return
    const res = await fetch('/api/playbook-regras', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ativo: false }) })
    if (res.ok) await load()
  }

  async function excluirRegra(id: number) {
    if (!confirm('Excluir essa regra permanentemente? O histórico de entregas continua registrado, só a regra em si some.')) return
    const res = await fetch(`/api/playbook-regras?id=${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  async function salvarAvulso() {
    if (!avulsoForm.titulo.trim()) return alert('Dê um título pro compromisso.')
    if (!autor.trim()) return alert('Informe quem está cadastrando.')
    const body = {
      cliente_id: client.id, titulo: avulsoForm.titulo.trim(), tipo: avulsoForm.tipo, data_prevista: avulsoForm.data_prevista,
      responsavel: avulsoForm.responsavel.trim() || null, criado_por: autor.trim(),
      descricao: avulsoForm.descricao.trim() || null, link: avulsoForm.link.trim() || null,
    }
    const res = await fetch('/api/playbook-itens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { await load(); setAvulsoFormOpen(false); setAvulsoForm(NOVO_AVULSO_DEFAULT) }
    else { const d = await res.json().catch(() => ({})); alert(`Erro ao salvar: ${d.error || 'tenta de novo.'}`) }
  }

  async function marcarEntregue(id: number) {
    const res = await fetch('/api/playbook-itens', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'entregue', observacao: obsConfirm.trim() || null }) })
    if (res.ok) { await load(); setConfirmandoId(null); setObsConfirm('') }
  }

  async function reabrirItem(id: number) {
    const res = await fetch('/api/playbook-itens', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'pendente' }) })
    if (res.ok) await load()
  }

  async function excluirItem(id: number) {
    if (!confirm('Excluir esse compromisso permanentemente?')) return
    const res = await fetch(`/api/playbook-itens?id=${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  // Correção do que já foi lançado — o preenchimento é livre/personalizado, então
  // accounts precisam poder ajustar título, tipo, data, responsável, descrição e link
  // (onde está o material) depois de criar.
  async function editarItem(id: number, patch: PlaybookItemEdit) {
    const res = await fetch('/api/playbook-itens', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    if (res.ok) await load()
    else { const d = await res.json().catch(() => ({})); alert(`Erro ao editar: ${d.error || 'tenta de novo.'}`) }
  }

  function ItemRow({ item }: { item: any }) {
    const meta = TIPO_META[item.tipo as PlaybookTipo]
    const atrasado = isAtrasado(item)
    const cor = item.status === 'entregue' ? '#16A34A' : atrasado ? '#FB2E0A' : 'var(--border-color)'
    return (
      <div style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px', borderLeft: `4px solid ${cor}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 78, flexShrink: 0, fontSize: 12, fontWeight: 700, color: atrasado ? '#FB2E0A' : 'var(--text-secondary)' }}>{fmtDate(item.data_prevista)}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: meta.bg, color: meta.color, textTransform: 'uppercase', flexShrink: 0 }}>{meta.label}</span>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{item.titulo}</div>
          {item.responsavel && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.responsavel}</div>}
          {item.descricao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{item.descricao}</div>}
          {item.observacao && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{item.observacao}</div>}
          {item.link && <a href={normalizarLink(item.link)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', marginTop: 2, display: 'inline-block' }}>🔗 Ver material</a>}
        </div>
        {item.status === 'entregue' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>Entregue {item.data_entrega ? `em ${fmtDate(item.data_entrega)}` : ''}</span>
            <button className="btn btn-sm" onClick={() => reabrirItem(item.id)}>Reabrir</button>
          </div>
        ) : confirmandoId === item.id ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={obsConfirm} onChange={e => setObsConfirm(e.target.value)} placeholder="Observação (opcional)" style={{ height: 32, fontSize: 12, width: 160 }} />
            <button className="btn btn-sm" onClick={() => { setConfirmandoId(null); setObsConfirm('') }}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={() => marcarEntregue(item.id)}>Confirmar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {atrasado && <span style={{ fontSize: 10, fontWeight: 800, color: '#FB2E0A', alignSelf: 'center' }}>ATRASADO</span>}
            <button className="btn btn-sm btn-primary" onClick={() => setConfirmandoId(item.id)}>Marcar Entregue</button>
            <button onClick={() => excluirItem(item.id)} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* ── STAT STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginBottom: 20, background: 'var(--border-color)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { label: 'Regras Ativas', value: regras.filter(r => r.ativo).length, accent: 'var(--text-muted)' },
          { label: 'Entregas nos Próx. 3 Meses', value: proximosMeses.length, accent: '#2563EB' },
          { label: 'Atrasadas', value: atrasados.length, accent: atrasados.length > 0 ? '#FB2E0A' : 'var(--text-muted)' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--card-color)', padding: '14px 18px', borderTop: `2px solid ${k.accent}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {atrasados.length > 0 && (
        <div style={{ background: 'rgba(251,46,10,0.08)', border: '1px solid rgba(251,46,10,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#FB2E0A', fontWeight: 600 }}>
          ⚠ {atrasados.length} entrega(s) atrasada(s) — veja a coluna "Atrasado" no quadro abaixo.
        </div>
      )}

      {regras.length === 0 && itens.length === 0 && !loading && (
        <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 12, color: '#2563EB' }}>
          Esse cliente ainda não tem playbook definido. Monte abaixo, de forma personalizada, o que vai ser entregue nos próximos meses — dê um título, escolha a data e o responsável. Cada entrega fica editável depois de criada.
        </div>
      )}

      {/* ── SUGESTÕES RÁPIDAS ── */}
      <div className="sec-title" style={{ fontSize: 14 }}>Sugestões Rápidas</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {sugestoes.map(p => {
          const jaTem = titulosExistentes.has(p.titulo)
          return (
            <button key={p.titulo} disabled={jaTem} onClick={() => usarPreset(p)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border-color)', background: jaTem ? 'var(--hover-bg)' : 'var(--card-color)',
              color: jaTem ? 'var(--text-muted)' : 'var(--text-main)', cursor: jaTem ? 'default' : 'pointer', opacity: jaTem ? 0.6 : 1,
            }}>
              {jaTem ? '✓' : '+'} {p.titulo}
            </button>
          )
        })}
      </div>

      {/* ── REGRAS RECORRENTES ── */}
      <div className="sec-title" style={{ fontSize: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Regras Recorrentes</span>
        {!regraFormOpen && <button className="btn btn-sm btn-primary" onClick={() => { setRegraForm(NOVA_REGRA_DEFAULT); setRegraFormOpen(true) }}>+ Nova Regra</button>}
      </div>

      {regraFormOpen && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div className="form-grid-2">
            <div className="field"><label>Título *</label><input value={regraForm.titulo} onChange={e => setRegraForm((p: any) => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Relatório Semanal" /></div>
            <div className="field"><label>Tipo</label>
              <select value={regraForm.tipo} onChange={e => setRegraForm((p: any) => ({ ...p, tipo: e.target.value }))}>
                {TIPOS_ORDENADOS.map(t => <option key={t} value={t}>{TIPO_META[t].label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-3">
            <div className="field"><label>Frequência</label>
              <select value={regraForm.frequencia} onChange={e => setRegraForm((p: any) => ({ ...p, frequencia: e.target.value }))}>
                {Object.entries(FREQ_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {['semanal', 'quinzenal'].includes(regraForm.frequencia) && (
              <div className="field"><label>Dia da semana</label>
                <select value={regraForm.dia_semana} onChange={e => setRegraForm((p: any) => ({ ...p, dia_semana: parseInt(e.target.value) }))}>
                  {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {regraForm.frequencia === 'mensal' && (
              <div className="field"><label>Dia do mês</label><input type="number" min={1} max={31} value={regraForm.dia_mes} onChange={e => setRegraForm((p: any) => ({ ...p, dia_mes: parseInt(e.target.value) || 1 }))} /></div>
            )}
            {regraForm.frequencia === 'unico' && (
              <div className="field"><label>Data</label><input type="date" value={regraForm.data_inicio} onChange={e => setRegraForm((p: any) => ({ ...p, data_inicio: e.target.value }))} /></div>
            )}
            <div className="field"><label>Responsável</label><input value={regraForm.responsavel} onChange={e => setRegraForm((p: any) => ({ ...p, responsavel: e.target.value }))} placeholder="Nome" /></div>
          </div>
          {regraForm.frequencia !== 'unico' && (
            <div className="field"><label>Começar a partir de</label><input type="date" value={regraForm.data_inicio} onChange={e => setRegraForm((p: any) => ({ ...p, data_inicio: e.target.value }))} /></div>
          )}
          <div className="field"><label>Registrado por *</label><input value={autor} onChange={e => setAutor(e.target.value)} placeholder="Seu nome" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm" onClick={() => setRegraFormOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvarRegra}>Salvar Regra</button>
          </div>
        </div>
      )}

      {regras.filter(r => r.ativo).length === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>Nenhuma regra ativa.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
          {regras.filter(r => r.ativo).map(r => {
            const meta = TIPO_META[r.tipo as PlaybookTipo]
            return (
              <div key={r.id} style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: meta.bg, color: meta.color, textTransform: 'uppercase' }}>{meta.label}</span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{r.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtCadencia(r)}{r.responsavel ? ` · ${r.responsavel}` : ''}</div>
                </div>
                <button className="btn btn-sm" onClick={() => desativarRegra(r.id)}>Desativar</button>
                <button onClick={() => excluirRegra(r.id)} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LINHA DO TEMPO ── */}
      <div className="sec-title" style={{ fontSize: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Quadro — Próximo Mês</span>
        {!avulsoFormOpen && <button className="btn btn-sm" onClick={() => { setAvulsoForm(NOVO_AVULSO_DEFAULT); setAvulsoFormOpen(true) }}>+ Compromisso Avulso</button>}
      </div>

      {avulsoFormOpen && (
        <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div className="form-grid-4">
            <div className="field"><label>Título *</label><input value={avulsoForm.titulo} onChange={e => setAvulsoForm((p: any) => ({ ...p, titulo: e.target.value }))} /></div>
            <div className="field"><label>Tipo</label>
              <select value={avulsoForm.tipo} onChange={e => setAvulsoForm((p: any) => ({ ...p, tipo: e.target.value }))}>
                {TIPOS_ORDENADOS.map(t => <option key={t} value={t}>{TIPO_META[t].label}</option>)}
              </select>
            </div>
            <div className="field"><label>Data</label><input type="date" value={avulsoForm.data_prevista} onChange={e => setAvulsoForm((p: any) => ({ ...p, data_prevista: e.target.value }))} /></div>
            <div className="field"><label>Responsável</label><input value={avulsoForm.responsavel} onChange={e => setAvulsoForm((p: any) => ({ ...p, responsavel: e.target.value }))} /></div>
          </div>
          <div className="field">
            <label>Detalhes / observações</label>
            <textarea value={avulsoForm.descricao} onChange={e => setAvulsoForm((p: any) => ({ ...p, descricao: e.target.value }))} rows={2}
              placeholder="O que é essa entrega, o que foi combinado, o que falta..." style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-color)', color: 'var(--text-main)', fontSize: 13 }} />
          </div>
          <div className="field"><label>Link do material</label><input value={avulsoForm.link} onChange={e => setAvulsoForm((p: any) => ({ ...p, link: e.target.value }))} placeholder="Drive, Figma, LP, Ekyte..." /></div>
          <div className="field"><label>Registrado por *</label><input value={autor} onChange={e => setAutor(e.target.value)} placeholder="Seu nome" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-sm" onClick={() => setAvulsoFormOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvarAvulso}>Salvar Compromisso</button>
          </div>
        </div>
      )}

      {loading ? <div className="empty">Carregando...</div> : (atrasados.length === 0 && noKanban.length === 0) ? (
        <div className="empty" style={{ marginBottom: 20 }}>Nenhuma entrega prevista pro próximo mês. Adicione uma regra recorrente ou um compromisso avulso.</div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <PlaybookKanban
            itens={[...atrasados, ...noKanban]}
            onMarcarEntregue={marcarEntregue}
            onReabrir={reabrirItem}
            onEditar={editarItem}
            janelaSemanas={JANELA_KANBAN_SEMANAS}
          />
        </div>
      )}

      {/* ── APLICAR ROTEIRO (TEMPLATE) — opcional, ponto de partida só se ajudar; o que
          importa é o playbook personalizado montado acima, e qualquer tarefa gerada aqui
          pode ser editada normalmente no quadro. ── */}
      {templates.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 24 }}>
          <div className="sec-title" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Roteiros Prontos (opcional)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
            Se ajudar como ponto de partida, você pode aplicar um roteiro-base da V4 pra gerar um esqueleto de tarefas — mas o playbook é pra ser personalizado por cliente, então depois de aplicado, edite/ajuste/remova o que quiser diretamente no quadro acima.
          </div>
          {roadmaps.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Já aplicado: {roadmaps.map(r => `${r.template_nome} (${fmtDate(r.data_inicio)})`).join(' · ')}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {templates.map(t => {
              const totalTarefas = t.fases.reduce((s: number, f: any) => s + f.tarefas.length, 0)
              return (
                <div key={t.id} style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{t.horizonte_semanas} semanas</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>{t.fases.length} fases · {totalTarefas} tarefas</div>
                  {applyFormId === t.id ? (
                    <div>
                      <div className="field" style={{ marginBottom: 8 }}><label style={{ fontSize: 10 }}>Início (semana 1)</label><input type="date" value={applyDataInicio} onChange={e => setApplyDataInicio(e.target.value)} /></div>
                      <div className="field" style={{ marginBottom: 8 }}><label style={{ fontSize: 10 }}>Registrado por *</label><input value={autor} onChange={e => setAutor(e.target.value)} placeholder="Seu nome" /></div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm" onClick={() => setApplyFormId(null)} disabled={applying}>Cancelar</button>
                        <button className="btn btn-sm btn-primary" onClick={aplicarTemplate} disabled={applying}>{applying ? 'Aplicando...' : 'Confirmar'}</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-sm" onClick={() => abrirAplicar(t.id)}>Aplicar Roteiro</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {meses.length > 0 && (
        <>
          <div className="sec-title" style={{ fontSize: 14 }}>Mais Adiante (meses seguintes)</div>
          {meses.map(mes => (
            <div key={mes} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{MesLabel(mes + '-01')}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {porMes[mes].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista)).map(i => <ItemRow key={i.id} item={i} />)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
