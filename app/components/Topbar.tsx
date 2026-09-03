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

  // El selector de camino (portada) trae su propio header navy/oro — sin chrome duplicado.
  if (pathname === '/prospeccion') return null

  // Pantallas de auth (login/registro/recuperar) traen su propio header navy — sin chrome duplicado.
  if (pathname === '/login' || pathname === '/registro' || pathname === '/recuperar') return null

  // Mastermind (calibración core y plan financiero completo) trae su propio breadcrumb local —
  // el stepper genérico de aquí no reconoce estas rutas y se queda pegado en "Prospección" con
  // Análisis/Propuesta deshabilitados, justo los pasos que servirían para volver.
  if (pathname === '/mastermind' || pathname === '/mastermind-core') return null

  // Look & feel navy/oro — acotado a Flujo A por ahora (mismo alcance que
  // app/prospeccion/flujo-a/page.tsx). Match exacto, no startsWith: /analisis/flujo-b y
  // /propuesta/flujo-b NO deben verse afectados, solo comparten prefijo de ruta.
  const esFlujoA = pathname === '/prospeccion/flujo-a' || pathname === '/analisis'
    || pathname === '/analisis/analizando' || pathname === '/propuesta'

  // Mismo criterio para Camino B (navy/azul) — match exacto de las 4 pantallas propias.
  const esFlujoB = pathname === '/prospeccion/flujo-b' || pathname === '/prospeccion/flujo-b/buscando'
    || pathname === '/analisis/flujo-b' || pathname === '/propuesta/flujo-b'

  if (esFlujoA || esFlujoB) {
    const accent   = esFlujoA ? '#c9a227' : '#5B8FD4'
    const accentLt = esFlujoA ? '#ddc06a' : '#8FB6E8'
    // JC pidió fusionar Topbar + ContextBar en una sola barra para Camino A, y omitir el
    // subtítulo "Plataforma de Análisis Inmobiliario" y el correo visible — ContextBar.tsx
    // se omite a sí mismo en estas rutas (ver su propio esFlujoA), todo vive aquí.
    const activeStep = steps.find(s => pathname.startsWith(s.href))?.step ?? 1
    return (
      <header className="bg-[#070f22] shadow-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex flex-wrap items-center justify-between gap-y-2 gap-x-6 py-2">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent }}>
                <svg className="w-5 h-5" style={{ color: '#070f22' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <Link href="/" className="font-bold text-lg tracking-tight text-[#f4f0e6] transition-colors whitespace-nowrap" onMouseEnter={e => (e.currentTarget.style.color = accentLt)} onMouseLeave={e => (e.currentTarget.style.color = '#f4f0e6')}>
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
                          ? 'shadow'
                          : isCompleted
                            ? ''
                            : 'text-[#5f6a80] cursor-not-allowed pointer-events-none'
                      }`}
                      style={
                        isActive ? { backgroundColor: accent, color: '#070f22' }
                        : isCompleted ? { backgroundColor: `${accent}26`, color: '#f4f0e6' }
                        : undefined
                      }
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={
                          isActive ? { backgroundColor: '#070f22', color: accentLt }
                          : isCompleted ? { backgroundColor: `${accent}66`, color: '#f4f0e6' }
                          : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#5f6a80' }
                        }>
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
              className="text-xs font-semibold rounded-full px-3 py-1.5 transition-colors"
              style={{ color: accentLt, border: `1px solid ${accent}` }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = accent; e.currentTarget.style.color = '#070f22' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = accentLt }}
            >
              PREFORMA
            </Link>
            {email && (
              <>
                <Link
                  href="/perfil"
                  className="w-8 h-8 rounded-full bg-[#132a4d] flex items-center justify-center transition-colors"
                  style={{ border: `1px solid ${accent}66` }}
                  title="Mi cuenta"
                >
                  <span className="text-xs font-semibold" style={{ color: accentLt }}>{inicialesDe(email)}</span>
                </Link>
                <button onClick={handleLogout} className="text-[#8b96ab] text-xs transition-colors" onMouseEnter={e => (e.currentTarget.style.color = accentLt)} onMouseLeave={e => (e.currentTarget.style.color = '')}>
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
    <header className="bg-[#070f22] shadow-lg border-b border-[#2a3f5c]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#c9a227] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#070f22]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <Link href="/" className="text-[#f4f0e6] font-bold text-lg tracking-tight hover:text-[#ddc06a] transition-colors">
            SMT Developer
          </Link>
          <span className="text-[#2a3f5c] text-sm">|</span>
          <span className="text-[#8b96ab] text-sm">Plataforma de Análisis Inmobiliario</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/preforma"
            className="text-xs font-semibold text-[#ddc06a] border border-[#c9a227] hover:bg-[#c9a227] hover:text-[#070f22] rounded-full px-3 py-1.5 transition-colors"
          >
            PREFORMA
          </Link>
          <span className="text-[#5f6a80] text-xs">v3.0 · Jul 2026</span>
          {email && (
            <>
              <span className="text-[#8b96ab] text-xs hidden sm:inline">{email}</span>
              <Link
                href="/perfil"
                className="w-8 h-8 rounded-full bg-[#132a4d] border border-[#c9a227]/40 flex items-center justify-center hover:border-[#c9a227] transition-colors"
                title="Mi cuenta"
              >
                <span className="text-[#ddc06a] text-xs font-semibold">{inicialesDe(email)}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-[#8b96ab] hover:text-[#ddc06a] text-xs transition-colors"
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
