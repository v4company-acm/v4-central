import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'

interface Props { children: React.ReactNode; title?: string; topbarRight?: React.ReactNode }

export default function Layout({ children, title = 'Central de Clientes', topbarRight }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = (session?.user as any)?.role === 'admin'

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-dot" />
          V4 Company
        </div>

        <div className="sb-section">Menu</div>
        <Link href="/" className={`sb-item ${router.pathname === '/' ? 'active' : ''}`}>
          <span>👥</span> Clientes
        </Link>
        {isAdmin && (
          <Link href="/usuarios" className={`sb-item ${router.pathname === '/usuarios' ? 'active' : ''}`}>
            <span>⚙️</span> Usuários
          </Link>
        )}

        <div className="sb-footer">
          <div className="sb-user">
            <strong>{session?.user?.name}</strong>
            {session?.user?.email}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => signOut({ callbackUrl: '/login' })}>
            Sair
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          {topbarRight}
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
