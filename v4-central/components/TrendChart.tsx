import { useState, useRef } from 'react'

interface Point { date: string; value: number }
interface Props {
  data: Point[]
  color?: string
  height?: number
  formatValue?: (v: number) => string
  formatDate?: (d: string) => string
}

// Gráfico de linha em SVG puro, com hover/crosshair e tooltip — sem dependência externa.
export default function TrendChart({ data, color = '#FB2E0A', height = 140, formatValue = v => String(v), formatDate = d => d }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const W = 600

  if (!data || data.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Dados insuficientes para o período.</div>
  }

  const max = Math.max(...data.map(d => d.value), 0)
  const min = Math.min(...data.map(d => d.value), 0)
  const range = max - min || 1
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => height - 18 - ((v - min) / range) * (height - 30)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ')
  const areaPath = `${linePath} L ${x(data.length - 1)} ${height} L ${x(0)} ${height} Z`
  const gradId = 'tc-grad-' + color.replace('#', '')

  function onMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = ((e.clientX - rect.left) / rect.width) * W
    let idx = Math.round((relX / W) * (data.length - 1))
    idx = Math.max(0, Math.min(data.length - 1, idx))
    setHover(idx)
  }

  const h = hover !== null ? data[hover] : null

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {h && (
          <>
            <line x1={x(hover!)} x2={x(hover!)} y1={0} y2={height - 18} stroke={color} strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover!)} cy={y(h.value)} r={4} fill={color} stroke="var(--card-color)" strokeWidth={2} />
          </>
        )}
      </svg>
      {h && (
        <div style={{
          position: 'absolute', top: 4, left: `${(hover! / (data.length - 1)) * 100}%`, transform: hover! > data.length / 2 ? 'translateX(-105%)' : 'translateX(6%)',
          background: 'var(--text-main)', color: 'var(--card-color)', borderRadius: 6, padding: '5px 9px', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
        }}>
          <div style={{ fontWeight: 700 }}>{formatDate(h.date)}</div>
          <div>{formatValue(h.value)}</div>
        </div>
      )}
    </div>
  )
}
