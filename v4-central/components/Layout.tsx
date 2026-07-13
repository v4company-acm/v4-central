import { useState, useEffect, ReactNode } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { signOut } from 'next-auth/react' // Já deixei pronto pro seu NextAuth

interface LayoutProps {
  children: ReactNode;
  title?: string;
  topbarRight?: ReactNode;
}

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/checkin', label: 'Check-in PPT' },
  { href: '/produtividade', label: 'Produtividade' },
]

export default function Layout({ children, title = 'Central', topbarRight }: LayoutProps) {
  const [theme, setTheme] = useState('light')
  const router = useRouter()

  // Ao carregar a página, verifica se o usuário já tinha salvo o Dark Mode
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  // Função que inverte o tema e salva na memória
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  return (
    <div className="layout">
      <Head>
        <title>{title} — V4 Central de Clientes</title>
      </Head>

      {/* ── NAV DE TOPO (Identidade + Navegação) ── */}
      <header className="topnav">
        <div className="topnav__brand">
          <div className="logo-badge">V4</div>
          <div className="logo-text">
            <div className="logo-title">Central de Clientes</div>
            <div className="logo-subtitle">V4 Company</div>
          </div>
        </div>

        <nav className="topnav__links">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={`topnav__link${router.pathname === link.href ? ' active' : ''}`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="topnav__user">
          <span className="topnav__user-label">Equipe Interna</span>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="topnav__logout">
            Sair
          </button>
        </div>
      </header>

      {/* ── ÁREA PRINCIPAL ── */}
      <div className="main">

        {/* Topbar (Cabeçalho da página) */}
        <header className="topbar">
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-main)' }}>
            {title}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            {/* BOTÃO DE DARK MODE ☀️/🌙 */}
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
                color: 'var(--text-main)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--input-bg)'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Botões extras que vêm da página (ex: "Novo Cliente", "Voltar") */}
            {topbarRight}
          </div>
        </header>

        {/* Conteúdo Dinâmico da Página */}
        <main className="content">
          {children}
        </main>

      </div>
    </div>
  )
}
