import { useState, useEffect } from 'react'

const COHORTS = ['Imobiliária','E-commerce','SaaS','Varejo','Serviço','Educação','Food Service','Franquia','Finanças','Energia Solar','Turismo','Indústria','Telecom','Odontologia','Saúde','Outro']
const CANAIS_ORIGEM = ['Facebook','Google','Instagram','LinkedIn','TikTok','Site','Orgânico','Indicação','Os Sócios','Blog','Bing','NA']

interface Props { initial?: any; onSave: (data: any) => void; onCancel: () => void; loading?: boolean }

export default function ClientForm({ initial, onSave, onCancel, loading }: Props) {
  const [f, setF] = useState({
    nome:'', stakeholder:'', telefone:'', mrr:'', valorTotal:'', fidelidade:'',
    dataEntrada: new Date().toISOString().slice(0,10), inicioProj:'', fimContrato:'',
    status:'ativo', estrategista:'', gestor:'', account:'', closer:'', sdr:'',
    linkContrato:'', linkCall:'', linkTranscricao:'', linkV4:'', linkBant:'',
    canalOrigem:'', instagram:'', site:'', cohort:'', promessa:'', descricao:'',
    canais:'', catSaber:false, catTer:false, catExecutar:false,
  })

  useEffect(() => { if (initial) setF({ ...f, ...initial }) }, [])

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.nome.trim()) return alert('Informe o nome da empresa.')
    onSave(f)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">

        <div className="form-section">
          <div className="sec-title">Informações básicas</div>
          <div className="form-grid-2">
            <div className="field"><label>Nome da empresa <span className="req">*</span></label><input value={f.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome da empresa" /></div>
            <div className="field"><label>Stakeholder / Contato</label><input value={f.stakeholder} onChange={e=>set('stakeholder',e.target.value)} placeholder="Nome do responsável" /></div>
          </div>
          <div className="form-grid-4">
            <div className="field"><label>Telefone</label><input value={f.telefone} onChange={e=>set('telefone',e.target.value)} placeholder="(00) 00000-0000" /></div>
            <div className="field"><label>Valor mensal (R$)</label><input type="number" value={f.mrr} onChange={e=>set('mrr',e.target.value)} placeholder="0" /></div>
            <div className="field"><label>Valor total (R$)</label><input type="number" value={f.valorTotal} onChange={e=>set('valorTotal',e.target.value)} placeholder="0" /></div>
            <div className="field"><label>Fidelidade</label>
              <select value={f.fidelidade} onChange={e=>set('fidelidade',e.target.value)}>
                <option value="">Selecione...</option>
                <option>6 meses</option><option>12 meses</option><option>One Time</option>
              </select>
            </div>
          </div>
          <div className="form-grid-4">
            <div className="field"><label>Data de entrada</label><input type="date" value={f.dataEntrada} onChange={e=>set('dataEntrada',e.target.value)} /></div>
            <div className="field"><label>Início do projeto</label><input type="date" value={f.inicioProj} onChange={e=>set('inicioProj',e.target.value)} /></div>
            <div className="field"><label>Fim do contrato</label><input type="date" value={f.fimContrato} onChange={e=>set('fimContrato',e.target.value)} /></div>
            <div className="field"><label>Status</label>
              <select value={f.status} onChange={e=>set('status',e.target.value)}>
                <option value="ativo">Ativo</option>
                <option value="atencao">Em atenção</option>
                <option value="churn">Churn risk</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="sec-title">Equipe V4</div>
          <div className="form-grid-3">
            <div className="field"><label>Estrategista</label><input value={f.estrategista} onChange={e=>set('estrategista',e.target.value)} /></div>
            <div className="field"><label>Gestor de tráfego</label><input value={f.gestor} onChange={e=>set('gestor',e.target.value)} /></div>
            <div className="field"><label>Account</label><input value={f.account} onChange={e=>set('account',e.target.value)} /></div>
          </div>
          <div className="form-grid-2">
            <div className="field"><label>Closer</label><input value={f.closer} onChange={e=>set('closer',e.target.value)} /></div>
            <div className="field"><label>SDR</label><input value={f.sdr} onChange={e=>set('sdr',e.target.value)} /></div>
          </div>
        </div>

        <div className="form-section">
          <div className="sec-title">Links obrigatórios</div>
          <div className="form-grid-3">
            <div className="field"><label>Contrato</label><input value={f.linkContrato} onChange={e=>set('linkContrato',e.target.value)} placeholder="https://..." /></div>
            <div className="field"><label>Gravação call de vendas</label><input value={f.linkCall} onChange={e=>set('linkCall',e.target.value)} placeholder="https://..." /></div>
            <div className="field"><label>Transcrição da call</label><input value={f.linkTranscricao} onChange={e=>set('linkTranscricao',e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="form-grid-2">
            <div className="field"><label>V4 Marketing</label><input value={f.linkV4} onChange={e=>set('linkV4',e.target.value)} placeholder="https://..." /></div>
            <div className="field"><label>BANT SDR</label><input value={f.linkBant} onChange={e=>set('linkBant',e.target.value)} placeholder="https://..." /></div>
          </div>
        </div>

        <div className="form-section">
          <div className="sec-title">Detalhes do cliente</div>
          <div className="form-grid-4">
            <div className="field"><label>Canal de origem</label>
              <select value={f.canalOrigem} onChange={e=>set('canalOrigem',e.target.value)}>
                <option value="">Selecione...</option>
                {CANAIS_ORIGEM.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Instagram</label><input value={f.instagram} onChange={e=>set('instagram',e.target.value)} placeholder="@usuario ou link" /></div>
            <div className="field"><label>Site</label><input value={f.site} onChange={e=>set('site',e.target.value)} placeholder="https://..." /></div>
            <div className="field"><label>Cohort / Segmento</label>
              <select value={f.cohort} onChange={e=>set('cohort',e.target.value)}>
                <option value="">Selecione...</option>
                {COHORTS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="field"><label>Promessas fora do escopo</label><textarea value={f.promessa} onChange={e=>set('promessa',e.target.value)} /></div>
            <div className="field"><label>Sobre o projeto / cliente</label><textarea value={f.descricao} onChange={e=>set('descricao',e.target.value)} /></div>
          </div>
          <div className="field"><label>Produtos contratados</label>
            <div className="chk-group">
              <label className="chk-item"><input type="checkbox" checked={f.catSaber} onChange={e=>set('catSaber',e.target.checked)} /> Saber</label>
              <label className="chk-item"><input type="checkbox" checked={f.catTer} onChange={e=>set('catTer',e.target.checked)} /> Ter</label>
              <label className="chk-item"><input type="checkbox" checked={f.catExecutar} onChange={e=>set('catExecutar',e.target.checked)} /> Executar</label>
            </div>
          </div>
          <div className="field" style={{marginTop:8}}><label>Canais de mídia ativos</label><input value={f.canais} onChange={e=>set('canais',e.target.value)} placeholder="Ex: Meta Ads, Google Ads" /></div>
        </div>

      </div>
      <div className="modal-footer">
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar cliente'}</button>
      </div>
    </form>
  )
}
