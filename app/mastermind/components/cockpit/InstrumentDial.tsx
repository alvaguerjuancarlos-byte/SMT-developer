'use client'

type DialSize = 'lg' | 'md' | 'sm'

const GEOMETRY: Record<DialSize, { cx: number; cy: number; r: number; stroke: number; w: number; h: number; valueSize: number; labelSize: number }> = {
  lg: { cx: 70, cy: 74, r: 54, stroke: 12, w: 140, h: 90, valueSize: 26, labelSize: 10 },
  md: { cx: 50, cy: 53, r: 38, stroke: 9, w: 100, h: 64, valueSize: 18, labelSize: 9 },
  sm: { cx: 32, cy: 34, r: 22, stroke: 6, w: 64, h: 40, valueSize: 11, labelSize: 0 },
}

export default function InstrumentDial({
  value,
  min = 0,
  max,
  target,
  label,
  sublabel,
  size = 'md',
  converge = true,
  color,
  formatValue,
}: {
  value: number | null
  min?: number
  max?: number
  target?: number
  label?: string
  sublabel?: string
  size?: DialSize
  converge?: boolean
  color?: string
  formatValue?: (v: number) => string
}) {
  const g = GEOMETRY[size]
  const scaleMax = max ?? Math.max((target ?? 0) * 1.6, (value ?? 0) * 1.2, 40)
  const circ = Math.PI * g.r

  const valorClamp = converge && value !== null ? Math.max(min, Math.min(scaleMax, value)) : min
  const dash = ((valorClamp - min) / (scaleMax - min || 1)) * circ

  const autoColor = !converge || value === null
    ? 'rgba(255,255,255,0.25)'
    : target !== undefined
      ? (value >= target ? '#1D9E75' : '#DC2626')
      : '#1D9E75'
  const strokeColor = color ?? autoColor

  const fmt = formatValue ?? ((v: number) => `${v.toFixed(0)}%`)

  let marca: { x1: number; y1: number; x2: number; y2: number } | null = null
  if (target !== undefined) {
    const fObjetivo = Math.min(1, Math.max(0, (target - min) / (scaleMax - min || 1)))
    const angulo = Math.PI * (1 - fObjetivo)
    marca = {
      x1: g.cx + (g.r - 12) * Math.cos(angulo),
      y1: g.cy - (g.r - 12) * Math.sin(angulo),
      x2: g.cx + (g.r + 12) * Math.cos(angulo),
      y2: g.cy - (g.r + 12) * Math.sin(angulo),
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: g.w, height: g.h }}>
        <svg width={g.w} height={g.h} viewBox={`0 0 ${g.w} ${g.h}`} fill="none">
          <path
            d={`M ${g.cx - g.r} ${g.cy} A ${g.r} ${g.r} 0 0 1 ${g.cx + g.r} ${g.cy}`}
            stroke="rgba(255,255,255,0.08)" strokeWidth={g.stroke} strokeLinecap="round" fill="none"
          />
          <path
            d={`M ${g.cx - g.r} ${g.cy} A ${g.r} ${g.r} 0 0 1 ${g.cx + g.r} ${g.cy}`}
            stroke={strokeColor} strokeWidth={g.stroke} strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          {marca && (
            <line x1={marca.x1} y1={marca.y1} x2={marca.x2} y2={marca.y2} stroke="white" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-0.5">
          <span className="font-mono font-bold leading-none" style={{ color: strokeColor, fontSize: g.valueSize }}>
            {converge && value !== null ? fmt(value) : '—'}
          </span>
          {label && g.labelSize > 0 && (
            <span className="text-white/40 uppercase tracking-wider" style={{ fontSize: g.labelSize }}>{label}</span>
          )}
        </div>
      </div>
      {sublabel && <span className="text-[10px] text-white/30 mt-1">{sublabel}</span>}
    </div>
  )
}
