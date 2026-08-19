// Ícones de traço minimalista (sem emoji) — pra dar uma cara mais "ferramenta de
// trabalho" que "app de consumo". Todos em stroke, 24x24, currentColor.
import { CSSProperties } from 'react'

interface Props { size?: number; strokeWidth?: number; style?: CSSProperties; className?: string }
const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function Svg({ size = 18, strokeWidth = 1.75, style, className, children }: Props & { children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={style} className={className} {...base} strokeWidth={strokeWidth}>{children}</svg>
}

export const GridIcon = (p: Props) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>
export const ClipboardIcon = (p: Props) => <Svg {...p}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M9 11h6M9 15h6" /></Svg>
export const FileTextIcon = (p: Props) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></Svg>
export const ClockIcon = (p: Props) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
export const TrendingUpIcon = (p: Props) => <Svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 6h6v6" /></Svg>
export const BarChartIcon = (p: Props) => <Svg {...p}><path d="M4 20V10M12 20V4M20 20v-7" /></Svg>
export const FolderIcon = (p: Props) => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>
export const LayersIcon = (p: Props) => <Svg {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></Svg>
export const SearchIcon = (p: Props) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>
export const PlusIcon = (p: Props) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const ArrowRightIcon = (p: Props) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const ActivityIcon = (p: Props) => <Svg {...p}><path d="M3 12h4l2-7 4 14 2-7h6" /></Svg>
