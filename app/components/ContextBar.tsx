'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '../providers'

const steps = [
  { label: 'Prospección', href: '/prospeccion', step: 1 as const },
  { label: 'Análisis', href: '/analisis', step: 2 as const },
  { label: 'Propuesta', href: '/propuesta', step: 3 as const },
]

export default function ContextBar() {
  const pathname = usePathname()
  const { terrain, currentStep } = useApp()

  const activeStep = steps.find(s => pathname.startsWith(s.href))?.step ?? 1

  // PREFORMA es una pantalla completa aparte, sin el breadcrumb de pasos de SMT Developer.
  if (pathname?.startsWith('/preforma')) return null

  return (
    <div className="bg-[#0a6b52] border-b border-[#085041]/50">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        <nav className="flex items-center gap-1">
          {steps.map((s, i) => {
            const isActive = s.step === activeStep
            const isCompleted = s.step < activeStep || (s.step < currentStep)
            const isReachable = s.step <= currentStep || s.step === activeStep + 1

            return (
              <div key={s.step} className="flex items-center">
                {i > 0 && (
                  <svg className="w-4 h-4 text-white/30 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <Link
                  href={s.href}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-white text-[#085041] shadow'
                      : isCompleted
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'text-white/50 cursor-not-allowed pointer-events-none'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                    ${isActive ? 'bg-[#085041] text-white' : isCompleted ? 'bg-white/40 text-white' : 'bg-white/10 text-white/40'}`}>
                    {isCompleted && !isActive ? '✓' : s.step}
                  </span>
                  {s.label}
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {terrain.nombre ? (
            <>
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-white font-medium text-sm truncate max-w-xs">{terrain.nombre}</span>
              {terrain.municipio && (
                <span className="text-white/50 text-xs">— {terrain.municipio}, {terrain.estado}</span>
              )}
            </>
          ) : (
            <span className="text-white/40 text-sm italic">Sin terreno activo</span>
          )}
        </div>
      </div>
    </div>
  )
}
