'use client'

import Link from 'next/link'

export default function Topbar() {
  return (
    <header className="bg-[#085041] shadow-lg">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <Link href="/" className="text-white font-bold text-lg tracking-tight hover:text-white/90 transition-colors">
            SMT Developer
          </Link>
          <span className="text-white/30 text-sm">|</span>
          <span className="text-white/60 text-sm">Plataforma de Análisis Inmobiliario</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/70 text-xs">v3.0 · Jul 2026</span>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">JC</span>
          </div>
        </div>
      </div>
    </header>
  )
}
