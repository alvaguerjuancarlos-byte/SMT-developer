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

  // El selector de camino (portada) trae su propio header navy/oro — sin chrome duplicado.
  if (pathname === '/prospeccion') return null

  // Pantallas de auth (login/registro/recuperar) traen su propio header navy — sin chrome duplicado.
  if (pathname === '/login' || pathname === '/registro' || pathname === '/recuperar') return null

  // Mismo criterio que Topbar.tsx — Mastermind trae su propio breadcrumb local.
  if (pathname === '/mastermind' || pathname === '/mastermind-core') return null

  // Mismo criterio que Topbar.tsx — Dashboard trae su propio header, sin chrome duplicado.
  if (pathname === '/dashboard') return null

  // Mismo alcance/criterio que Topbar.tsx — navy/oro solo en Camino A, match exacto.
  const esFlujoA = pathname === '/prospeccion/flujo-a' || pathname === '/analisis'
    || pathname === '/analisis/analizando' || pathname === '/propuesta'

  // Mismo criterio para Camino B (navy/azul) — match exacto de las 4 pantallas propias.
  const esFlujoB = pathname === '/prospeccion/flujo-b' || pathname === '/prospeccion/flujo-b/buscando'
    || pathname === '/analisis/flujo-b' || pathname === '/propuesta/flujo-b'

  // En Camino A y Camino B, Topbar.tsx fusiona esta barra con la suya en una sola — no se duplica aquí.
  if (esFlujoA || esFlujoB) return null

  return (
    <div className="bg-[#132a4d] border-b border-[#2a3f5c]">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        <nav className="flex items-center gap-1">
          {steps.map((s, i) => {
            const isActive = s.step === activeStep
            const isCompleted = s.step < activeStep || (s.step < currentStep)
            const isReachable = s.step <= currentStep || s.step === activeStep + 1

            return (
              <div key={s.step} className="flex items-center">
                {i > 0 && (
                  <svg className="w-4 h-4 text-[#5f6a80] mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <Link
                  href={s.href}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-[#c9a227] text-[#070f22] shadow'
                      : isCompleted
                        ? 'bg-[#c9a227]/15 text-[#f4f0e6] hover:bg-[#c9a227]/25'
                        : 'text-[#5f6a80] cursor-not-allowed pointer-events-none'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                    ${isActive ? 'bg-[#070f22] text-[#ddc06a]' : isCompleted ? 'bg-[#c9a227]/40 text-[#f4f0e6]' : 'bg-white/5 text-[#5f6a80]'}`}>
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
              <svg className="w-4 h-4 text-[#8b96ab]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[#f4f0e6] font-medium text-sm truncate max-w-xs">{terrain.nombre}</span>
              {terrain.municipio && (
                <span className="text-[#8b96ab] text-xs">— {terrain.municipio}, {terrain.estado}</span>
              )}
            </>
          ) : (
            <span className="text-[#5f6a80] text-sm italic">Sin terreno activo</span>
          )}
        </div>
      </div>
    </div>
  )
}
