import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import Head from 'next/head'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <>
      <Head><title>Login — V4 Central de Clientes</title></Head>
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <h1>V4 <span style={{ color: 'var(--red)' }}>●</span></h1>
            <p>Central de Clientes</p>
          </div>
          {error && <div className="login-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
            </div>
            <div className="field">
              <label>Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (session) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}
