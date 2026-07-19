'use client'

export default function Palanca({
  label,
  value,
  pct,
  active,
  onClick,
  readOnly,
}: {
  label: string
  value: string
  pct?: number
  active: boolean
  onClick: () => void
  readOnly?: boolean
}) {
  const clampedPct = pct !== undefined ? Math.max(0, Math.min(100, pct)) : undefined

  return (
    <button
      onClick={onClick}
      className={`group relative flex-1 min-w-0 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer border ${
        active
          ? 'bg-[#1D9E75]/10 border-[#1D9E75]/60 shadow-[0_0_0_1px_rgba(29,158,117,0.3),0_0_16px_rgba(29,158,117,0.15)]'
          : 'bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`text-[9px] font-semibold uppercase tracking-wider truncate ${active ? 'text-[#1D9E75]' : 'text-white/40'}`}>
          {label}
        </span>
        {readOnly && <span className="text-[8px] text-white/25 shrink-0">RO</span>}
      </div>
      <div className="font-mono text-[13px] font-bold text-white truncate">{value}</div>
      {clampedPct !== undefined && (
        <div className="mt-1.5 h-[3px] w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${active ? 'bg-[#1D9E75]' : 'bg-white/25'}`}
            style={{ width: `${clampedPct}%`, transition: 'width 0.4s ease' }}
          />
        </div>
      )}
    </button>
  )
}
