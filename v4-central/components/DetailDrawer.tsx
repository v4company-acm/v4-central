import { ReactNode, useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
}

// Painel lateral de detalhe — evita ter que sair da lista pra ver o contexto completo de um registro.
export default function DetailDrawer({ open, onClose, title, subtitle, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-bg)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', width: 440, maxWidth: '92vw', height: '100%', background: 'var(--card-color)',
        borderLeft: '1px solid var(--border-color)', boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', animation: 'slideIn .18s ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {subtitle && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{subtitle}</div>}
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{title}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}
