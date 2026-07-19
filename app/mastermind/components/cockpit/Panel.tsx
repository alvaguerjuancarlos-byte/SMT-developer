'use client'

import type { ReactNode } from 'react'

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
  return (
    <div
      className="rounded-xl border border-white/10 p-5"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 60%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent ?? '#1D9E75' }} />
          {titulo}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}
