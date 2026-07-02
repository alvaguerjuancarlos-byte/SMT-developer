'use client'

import { useState, type ReactNode } from 'react'

export default function CollapsibleSection({
  titulo,
  subtitulo,
  defaultOpen = true,
  children,
}: {
  titulo: string
  subtitulo?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FAFBFA] transition-colors cursor-pointer"
      >
        <div>
          <h3 className="text-[13px] font-bold text-[#111d17]">{titulo}</h3>
          {subtitulo && <p className="text-[11px] text-[#9aab9f] mt-0.5">{subtitulo}</p>}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className="flex-shrink-0 text-[#9aab9f] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 grid grid-cols-2 gap-3">{children}</div>}
    </div>
  )
}
