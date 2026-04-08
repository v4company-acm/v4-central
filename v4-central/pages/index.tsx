import { useState, useEffect } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'
import ClientForm from '../components/ClientForm'
import ClientDetail from '../components/ClientDetail'

const COLORS = ['#E6F1FB|#185FA5','#EEEDFE|#534AB7','#E1F5EE|#0F6E56','#FAEEDA|#854F0B','#FAECE7|#993C1D','#EAF3DE|#3B6D11','#FBEAF0|#993556','#F1EFE8|#5F5E5A']

function ini(n: string) { return (n||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() }
function badgeCls(s: string) { return {ativo:'badge-green',atencao:'badge-amber',churn:'badge-red',inativo:'badge-gray'}[s]||'badge-gray' }
function badgeLbl(s: string) { return {ativo:'Ativo',atencao:'Em atenção',churn:'Churn risk',inativo:'Inativo'}[s]||s }

export default function HomePage() {
  const [clients, setClients] = useState<any[]>([])
  const [filter, setFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editClient, setEditClient] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const res = await fetch('/api/clients')
    if (res.ok) setClients(await res.json())
  }

  async function handleSave(data: any) {
    setSaving(true)
    if (editClient) {
      const res = await fetch(`/api/clients/${editClient.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
      if (res.ok) { const updated = await res.json(); setClients(p => p.map(c => c.id===updated.id ? updated : c)); setSelected(updated) }
    } else {
      const res = await fetch('/api/clients', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
      if (res.ok) { const created = await res.json(); setClients(p => [...p, created]) }
    }
    setSaving(false); setShowForm(false); setEditClient(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients(p => p.filter(c => c.id !== id))
    setSelected(null)
  }

  async function handleUpdateClient(updated: any) {
    const res = await fetch(`/api/clients/${updated.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updated) })
    if (res.ok) { const u = await res.json(); setClients(p => p.map(c => c.id===u.id ? u : c)); setSelected(u) }
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const mq = !q || c.nome.toLowerCase().includes(q) || (c.cohort||'').toLowerCase().includes(q) || (c.gestor||'').toLowerCase().includes(q) || (c.account||'').toLowerCase().includes(q)
    const mf = filter==='todos' || c.status===filter || (filter.startsWith('resp:') && [c.gestor,c.account,c.estrategista].includes(filter.slice(5)))
    return mq && mf
  })

  const resps = [...new Set(clients.flatMap(c => [c.gestor,c.account,c.estrategista].filter(Boolean)))]

  return (
    <>
      <Head><title>Clientes — V4 Central</title></Head>
      <Layout
        title={selected ? selected.nome : 'Central de Clientes'}
        topbarRight={
          selected
            ? <div style={{display:'flex',gap:8}}>
                <button className="btn btn-sm" onClick={() => { setEditClient(selected); setShowForm(true) }}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>Excluir</button>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>← Voltar</button>
              </div>
            : <button className="btn btn-primary btn-sm" onClick={() => { setEditClient(null); setShowForm(true) }}>+ Novo cliente</button>
        }
      >
        {selected ? (
          <ClientDetail client={selected} onUpdate={handleUpdateClient} />
        ) : (
          <div style={{display:'flex',gap:20}}>
            {/* Filters sidebar inline */}
            <div style={{width:180,flexShrink:0}}>
              <input className="sb-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{width:'100%'}} />
              <div className="sb-section">Status</div>
              {[['todos','#888780','Todos'],['ativo','#639922','Ativos'],['atencao','#EF9F27','Em atenção'],['churn','#E24B4A','Churn risk']].map(([v,c,l])=>(
                <div key={v} className={`sb-item ${filter===v?'active':''}`} onClick={()=>setFilter(v as string)}>
                  <div className="sb-dot" style={{background:c as string}} />{l}
                </div>
              ))}
              {resps.length>0 && <>
                <div className="sb-section">Responsáveis</div>
                {resps.map(r=>(
                  <div key={r} className={`sb-item ${filter===`resp:${r}`?'active':''}`} onClick={()=>setFilter(`resp:${r}`)} style={{fontSize:12}}>{r}</div>
                ))}
              </>}
            </div>

            {/* Grid */}
            <div style={{flex:1}}>
              {filtered.length===0
                ? <div className="empty">Nenhum cliente encontrado.<br/>Clique em "+ Novo cliente" para começar.</div>
                : <div className="clients-grid">
                    {filtered.map((c,i) => {
                      const [bg,fg] = COLORS[clients.indexOf(c) % COLORS.length].split('|')
                      return (
                        <div key={c.id} className={`client-card ${selected?.id===c.id?'active':''}`} onClick={()=>setSelected(c)}>
                          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                            <div className="card-avatar" style={{background:bg,color:fg}}>{ini(c.nome)}</div>
                            <div>
                              <div style={{fontWeight:600,fontSize:14}}>{c.nome}</div>
                              <div style={{fontSize:12,color:'#6B6B6B'}}>{c.cohort||'—'}</div>
                            </div>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span className={`badge ${badgeCls(c.status)}`}>{badgeLbl(c.status)}</span>
                            <span style={{fontSize:11,color:'#6B6B6B'}}>{c.gestor||c.account||''}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>
          </div>
        )}
      </Layout>

      {showForm && (
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setShowForm(false);setEditClient(null)}}}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editClient ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setShowForm(false);setEditClient(null)}}>✕</button>
            </div>
            <ClientForm initial={editClient} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditClient(null)}} loading={saving} />
          </div>
        </div>
      )}
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
