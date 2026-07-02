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

  return (
    <div className={colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-semibold text-[#5a7065] uppercase tracking-wide">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number.isFinite(value) ? value : 0}
            onChange={e => onChange(e.target.valueAsNumber || 0)}
            className="w-20 text-[12px] text-right border border-[#E2E8E4] rounded-lg px-2 py-0.5 text-[#111d17] focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
          />
          {unit && <span className="text-[11px] text-[#9aab9f]">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={e => onChange(e.target.valueAsNumber)}
        className="w-full accent-[#1D9E75] cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-[#C4CEC8] mt-0.5">
        <span>{min.toLocaleString('es-MX')}{unit}</span>
        <span>{max.toLocaleString('es-MX')}{unit}</span>
      </div>
    </div>
  )
}
