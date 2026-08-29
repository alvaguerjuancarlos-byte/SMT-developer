'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '../providers'
import { steps } from './ContextBar'

function inicialesDe(email: string | undefined) {
  if (!email) return '—'
  const nombre = email.split('@')[0]
  return nombre.slice(0, 2).toUpperCase()
}

export default function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { terrain, currentStep } = useApp()
  const [email, setEmail] = useState<string | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setEmail(session?.user?.email))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email))
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // PREFORMA es una pantalla completa aparte, sin el chrome verde de SMT Developer.
  if (pathname?.startsWith('/preforma')) return null

  // Look & feel navy/oro — acotado a Flujo A por ahora (mismo alcance que
  // app/prospeccion/flujo-a/page.tsx). Match exacto, no startsWith: /analisis/flujo-b y
  // /propuesta/flujo-b NO deben verse afectados, solo comparten prefijo de ruta.
  const esFlujoA = pathname === '/prospeccion/flujo-a' || pathname === '/analisis'
    || pathname === '/analisis/analizando' || pathname === '/propuesta'

  if (esFlujoA) {
    // JC pidió fusionar Topbar + ContextBar en una sola barra para Camino A, y omitir el
    // subtítulo "Plataforma de Análisis Inmobiliario" y el correo visible — ContextBar.tsx
    // se omite a sí mismo en estas rutas (ver su propio esFlujoA), todo vive aquí.
    const activeStep = steps.find(s => pathname.startsWith(s.href))?.step ?? 1
    return (
      <header className="bg-[#070f22] shadow-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex flex-wrap items-center justify-between gap-y-2 gap-x-6 py-2">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#c9a227] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#070f22]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <Link href="/" className="font-bold text-lg tracking-tight text-[#f4f0e6] hover:text-[#ddc06a] transition-colors whitespace-nowrap">
                SMT Developer
              </Link>
            </div>

            <nav className="flex items-center gap-1">
              {steps.map((s, i) => {
                const isActive = s.step === activeStep
                const isCompleted = s.step < activeStep || (s.step < currentStep)
                return (
                  <div key={s.step} className="flex items-center">
                    {i > 0 && (
                      <svg className="w-4 h-4 text-[#5f6a80] mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <Link
                      href={s.href}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-[#c9a227] text-[#070f22] shadow'
                          : isCompleted
                            ? 'bg-[#c9a227]/15 text-[#f4f0e6] hover:bg-[#c9a227]/25'
                            : 'text-[#5f6a80] cursor-not-allowed pointer-events-none'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive ? 'bg-[#070f22] text-[#ddc06a]' : isCompleted ? 'bg-[#c9a227]/40 text-[#f4f0e6]' : 'bg-white/5 text-[#5f6a80]'
                      }`}>
                        {isCompleted && !isActive ? '✓' : s.step}
                      </span>
                      {s.label}
                    </Link>
                  </div>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {terrain.nombre && (
              <div className="hidden md:flex items-center gap-2">
                <svg className="w-4 h-4 text-[#8b96ab]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[#f4f0e6] font-medium text-sm truncate max-w-[160px]">{terrain.nombre}</span>
              </div>
            )}
            <Link
              href="/preforma"
              className="text-xs font-semibold text-[#ddc06a] border border-[#c9a227] hover:bg-[#c9a227] hover:text-[#070f22] rounded-full px-3 py-1.5 transition-colors"
            >
              PREFORMA
            </Link>
            {email && (
              <>
                <Link
                  href="/perfil"
                  className="w-8 h-8 rounded-full bg-[#132a4d] border border-[#c9a227]/40 flex items-center justify-center hover:border-[#c9a227] transition-colors"
                  title="Mi cuenta"
                >
                  <span className="text-[#ddc06a] text-xs font-semibold">{inicialesDe(email)}</span>
                </Link>
                <button onClick={handleLogout} className="text-[#8b96ab] hover:text-[#ddc06a] text-xs transition-colors">
                  Salir
                </button>
              </>
            )}
          </div>
        </div>
      </header>
    )
  }

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
          <Link
            href="/preforma"
            className="text-xs font-semibold text-white bg-white/15 hover:bg-white/25 rounded-full px-3 py-1.5 transition-colors"
          >
            PREFORMA
          </Link>
          <span className="text-white/70 text-xs">v3.0 · Jul 2026</span>
          {email && (
            <>
              <span className="text-white/60 text-xs hidden sm:inline">{email}</span>
              <Link
                href="/perfil"
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                title="Mi cuenta"
              >
                <span className="text-white text-xs font-semibold">{inicialesDe(email)}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-white/60 hover:text-white text-xs transition-colors"
              >
                Salir
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
