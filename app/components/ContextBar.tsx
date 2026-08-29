'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '../providers'

// Exportado — Topbar.tsx lo reusa para fusionar las dos barras en una sola en Camino A.
export const steps = [
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

  // Mismo alcance/criterio que Topbar.tsx — navy/oro solo en Camino A, match exacto.
  const esFlujoA = pathname === '/prospeccion/flujo-a' || pathname === '/analisis'
    || pathname === '/analisis/analizando' || pathname === '/propuesta'

  // En Camino A, Topbar.tsx fusiona esta barra con la suya en una sola — no se duplica aquí.
  if (esFlujoA) return null

  return (
    <div className={esFlujoA ? 'bg-[#132a4d] border-b border-[#2a3f5c]' : 'bg-[#0a6b52] border-b border-[#085041]/50'}>
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        <nav className="flex items-center gap-1">
          {steps.map((s, i) => {
            const isActive = s.step === activeStep
            const isCompleted = s.step < activeStep || (s.step < currentStep)
            const isReachable = s.step <= currentStep || s.step === activeStep + 1

            return (
              <div key={s.step} className="flex items-center">
                {i > 0 && (
                  <svg className={esFlujoA ? 'w-4 h-4 text-[#5f6a80] mx-1' : 'w-4 h-4 text-white/30 mx-1'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <Link
                  href={s.href}
                  className={esFlujoA
                    ? `flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all
                      ${isActive
                        ? 'bg-[#c9a227] text-[#070f22] shadow'
                        : isCompleted
                          ? 'bg-[#c9a227]/15 text-[#f4f0e6] hover:bg-[#c9a227]/25'
                          : 'text-[#5f6a80] cursor-not-allowed pointer-events-none'
                      }`
                    : `flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all
                      ${isActive
                        ? 'bg-white text-[#085041] shadow'
                        : isCompleted
                          ? 'bg-white/20 text-white hover:bg-white/30'
                          : 'text-white/50 cursor-not-allowed pointer-events-none'
                      }`
                  }
                >
                  <span className={esFlujoA
                    ? `w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                      ${isActive ? 'bg-[#070f22] text-[#ddc06a]' : isCompleted ? 'bg-[#c9a227]/40 text-[#f4f0e6]' : 'bg-white/5 text-[#5f6a80]'}`
                    : `w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                      ${isActive ? 'bg-[#085041] text-white' : isCompleted ? 'bg-white/40 text-white' : 'bg-white/10 text-white/40'}`
                  }>
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
              <svg className={esFlujoA ? 'w-4 h-4 text-[#8b96ab]' : 'w-4 h-4 text-white/60'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className={esFlujoA ? 'text-[#f4f0e6] font-medium text-sm truncate max-w-xs' : 'text-white font-medium text-sm truncate max-w-xs'}>{terrain.nombre}</span>
              {terrain.municipio && (
                <span className={esFlujoA ? 'text-[#8b96ab] text-xs' : 'text-white/50 text-xs'}>— {terrain.municipio}, {terrain.estado}</span>
              )}
            </>
          ) : (
            <span className={esFlujoA ? 'text-[#5f6a80] text-sm italic' : 'text-white/40 text-sm italic'}>Sin terreno activo</span>
          )}
        </div>
      </div>
    </div>
  )
}
