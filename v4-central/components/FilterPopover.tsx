import { useState, useRef, useEffect } from 'react'

interface Option { value: string; label: string; count: number }
interface Props {
  label: string
  options: Option[]
  selected: string[]
  onChange: (v: string[]) => void
}

// Filtro facetado estilo Airtable/Notion: dropdown com checklist + contagem por opção.
export default function FilterPopover({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }

  const active = selected.length > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        border: active ? '1px solid var(--red)' : '1px solid var(--border-color)',
        background: active ? 'rgba(251,46,10,0.08)' : 'var(--card-color)',
        color: active ? 'var(--red)' : 'var(--text-secondary)',
      }}>
        {label}{active ? ` (${selected.length})` : ''} <span style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 44, left: 0, zIndex: 30, minWidth: 220, maxHeight: 320, overflowY: 'auto',
          background: 'var(--card-color)', border: '1px solid var(--border-color)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 6,
        }}>
          {active && (
            <button onClick={() => onChange([])} style={{
              width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 12, fontWeight: 700,
              color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6,
            }}>× Limpar filtro</button>
          )}
          {options.length === 0 && <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>Sem opções</div>}
          {options.map(o => (
            <label key={o.value} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 13,
              cursor: 'pointer', borderRadius: 6, color: 'var(--text-main)',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} style={{ accentColor: 'var(--red)' }} />
              <span style={{ flex: 1 }}>{o.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
