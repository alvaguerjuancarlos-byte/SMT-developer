'use client'

// Dona de composición para los paneles de Costos e Ingresos del tablero: anillo por segmentos
// con el total al centro y la lista de partidas con monto y % a la derecha.
export default function Dona({ segmentos, total, centro, sub, size = 132 }: {
  segmentos: { label: string; valor: number; color: string }[]
  total: number
  centro: string
  sub: string
  size?: number
}) {
  const r = 42, circ = 2 * Math.PI * r
  let acumulado = 0
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11" />
          {total > 0 && segmentos.filter(s => s.valor > 0).map(s => {
            const largo = (s.valor / total) * circ
            const el = (
              <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="11"
                strokeDasharray={`${Math.max(0, largo - 1.2)} ${circ}`} strokeDashoffset={-acumulado}
                style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }} />
            )
            acumulado += largo
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-[19px] font-black text-white leading-none tabular-nums">{centro}</span>
          <span className="text-[8px] text-white/40 uppercase tracking-wider mt-1">Total</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{sub}</p>
        {segmentos.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-white/60 flex-1 truncate">{s.label}</span>
            <span className="font-mono text-white/85 tabular-nums">{total > 0 ? `${((s.valor / total) * 100).toFixed(0)}%` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
