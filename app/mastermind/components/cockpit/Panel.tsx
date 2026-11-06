'use client'

import type { ReactNode } from 'react'

// Panel del tablero de control: tarjeta oscura con línea de acento arriba y LED encendido junto
// al título (pedido de JC, 6-nov: que Mastermind se vea como un tablero de control moderno).
export default function Panel({
  titulo,
  accent,
  action,
  children,
}: {
  titulo: string
  accent?: string
  action?: ReactNode
  children: ReactNode
}) {
  const color = accent ?? '#c9a227'
  return (
    <div
      className="relative rounded-2xl border border-white/[0.08] p-5 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #11284a 0%, #0c1f3d 100%)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
          {titulo}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}
