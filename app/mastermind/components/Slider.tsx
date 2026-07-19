'use client'

export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  colSpan = 2,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  colSpan?: 1 | 2
}) {
  const clamped = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0

  return (
    <div className={colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={Number.isFinite(value) ? value : 0}
            onChange={e => onChange(e.target.valueAsNumber || 0)}
            className="w-20 text-[12px] font-mono text-right bg-black/30 border border-white/15 rounded-lg px-2 py-0.5 text-white focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
          />
          {unit && <span className="text-[11px] text-white/40">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={e => onChange(e.target.valueAsNumber)}
        className="w-full h-1.5 rounded-full cursor-pointer appearance-none accent-[#1D9E75]"
        style={{ background: `linear-gradient(to right, #1D9E75 ${pct}%, rgba(255,255,255,0.1) ${pct}%)` }}
      />
      <div className="flex justify-between text-[9px] font-mono text-white/25 mt-1">
        <span>{min.toLocaleString('es-MX')}{unit}</span>
        <span>{max.toLocaleString('es-MX')}{unit}</span>
      </div>
    </div>
  )
}
