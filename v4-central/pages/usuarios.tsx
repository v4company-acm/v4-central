import { useState, useEffect } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Layout from '../components/Layout'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [f, setF] = useState({ name:'', email:'', password:'', role:'member' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(f)
    })
    if (res.ok) { await fetchUsers(); setShowForm(false); setF({name:'',email:'',password:'',role:'member'}) }
    else { const d = await res.json(); setError(d.error||'Erro ao criar usuário') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este usuário?')) return
    await fetch('/api/users', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id}) })
    fetchUsers()
  }

  return (
    <>
      <Head><title>Usuários — V4 Central</title></Head>
      <Layout title="Usuários" topbarRight={<button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Novo usuário</button>}>
        <div style={{background:'#fff',border:'1px solid #E4E4E4',borderRadius:12,overflow:'hidden',maxWidth:700}}>
          <table className="users-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{fontWeight:500}}>{u.name}</td>
                  <td style={{color:'#6B6B6B'}}>{u.email}</td>
                  <td><span className={`badge ${u.role==='admin'?'badge-red':'badge-gray'}`}>{u.role==='admin'?'Admin':'Membro'}</span></td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-sm btn-danger" onClick={()=>handleDelete(u.id)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showForm && (
          <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
            <div className="modal modal-sm">
              <div className="modal-header">
                <h3>Novo usuário</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowForm(false)}>✕</button>
              </div>
              <form onSubmit={handleAdd}>
                <div className="modal-body">
                  {error && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:6,padding:'8px 12px',fontSize:13,color:'#991b1b',marginBottom:12}}>{error}</div>}
                  <div className="field"><label>Nome *</label><input value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} required /></div>
                  <div className="field"><label>Email *</label><input type="email" value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} required /></div>
                  <div className="field"><label>Senha *</label><input type="password" value={f.password} onChange={e=>setF(p=>({...p,password:e.target.value}))} required minLength={6} placeholder="mínimo 6 caracteres" /></div>
                  <div className="field"><label>Perfil</label>
                    <select value={f.role} onChange={e=>setF(p=>({...p,role:e.target.value}))}>
                      <option value="member">Membro</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn" onClick={()=>setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Criando...':'Criar usuário'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Layout>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  if ((session.user as any).role !== 'admin') return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}
