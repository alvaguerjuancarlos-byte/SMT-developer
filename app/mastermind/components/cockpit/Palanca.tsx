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
      className={`group relative flex-1 min-w-0 rounded-xl px-3 py-3 text-left transition-colors cursor-pointer border ${
        active
          ? 'bg-[#c9a227]/10 border-[#c9a227]/60 shadow-[0_0_0_1px_rgba(201,162,39,0.3),0_0_16px_rgba(201,162,39,0.15)]'
          : 'bg-[#0f2343] border-white/[0.08] hover:border-white/25 hover:bg-[#132a4d]'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider truncate ${active ? 'text-[#c9a227]' : 'text-white/45'}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-[#c9a227] shadow-[0_0_6px_#c9a227]' : 'bg-white/25'}`} />
          {label}
        </span>
        {readOnly && <span className="text-[8px] text-white/25 shrink-0">RO</span>}
      </div>
      <div className="font-mono text-[16px] font-bold text-white truncate tabular-nums">{value}</div>
      {clampedPct !== undefined && (
        <div className="mt-1.5 h-[3px] w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${active ? 'bg-[#c9a227]' : 'bg-white/25'}`}
            style={{ width: `${clampedPct}%`, transition: 'width 0.4s ease' }}
          />
        </div>
      )}
    </button>
  )
}
