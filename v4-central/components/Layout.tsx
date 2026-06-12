import { useState, useEffect, ReactNode } from 'react'
import Head from 'next/head'
import { signOut } from 'next-auth/react' // Já deixei pronto pro seu NextAuth

interface LayoutProps {
  children: ReactNode;
  title?: string;
  topbarRight?: ReactNode;
}

export default function Layout({ children, title = 'Central', topbarRight }: LayoutProps) {
  const [theme, setTheme] = useState('light')

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
        <title>{title} — ACM&Co</title>
      </Head>

      {/* ── SIDEBAR (Menu Lateral) ── */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-dot" />
          ACM&Co Central
        </div>

        <div className="sb-section">Menu Principal</div>
        
        <a href="/" className="sb-item">
          <div className="sb-dot" style={{background: 'var(--red)'}} />
          Dashboard
        </a>
        
        <a href="/checkin" className="sb-item">
          <div className="sb-dot" style={{background: 'var(--text-muted)'}} />
          Check-in PPT
        </a>
        
        <a href="/produtividade" className="sb-item">
          <div className="sb-dot" style={{background: 'var(--text-muted)'}} />
          Produtividade
        </a>

        {/* Rodapé da Sidebar */}
        <div className="sb-footer">
          <div className="sb-user">
            Acesso
            <strong>Equipe Interna</strong>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })} 
            className="btn btn-ghost btn-sm" 
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-secondary)' }}
          >
            Sair / Logout
          </button>
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL ── */}
      <div className="main">
        
        {/* Topbar (Cabeçalho) */}
        <header className="topbar">
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
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
