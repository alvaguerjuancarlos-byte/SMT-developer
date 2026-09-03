'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

// Look & feel — continuación del navy/oro aplicado en Flujo A (ver
// app/prospeccion/flujo-a/page.tsx para la paleta de referencia completa).
// Esta es la pantalla de entrada (selector de flujo), fuera de las 4
// pantallas originales acotadas por el commit 6e96d28 — JC pidió extenderlo
// aquí. Flujo B conserva su acento azul (identidad propia del flujo) pero
// sobre el mismo fondo navy y tipografía.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

export default function FlowSelector() {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovering, setHovering] = useState<string | null>(null)
  const router = useRouter()

  const handleContinue = () => {
    if (!selected) return
    if (selected === 'a') {
      router.push('/prospeccion/flujo-a')
    } else if (selected === 'a-rapido') {
      router.push('/prospeccion/flujo-a?modo=rapido')
    } else {
      router.push('/prospeccion/flujo-b')
    }
  }

  return (
    <div
      className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex flex-col`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    >
      <header className="sticky top-0 z-20 bg-[#070f22] px-8 py-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-[#c9a227] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#070f22" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#070f22" strokeWidth="1" strokeOpacity="0.6"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] tracking-wide" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 500, color: '#f4f0e6' }}>
            SMT <em style={{ fontStyle: 'normal', color: '#ddc06a' }}>Developer</em>
          </span>
          <span className="block text-[10px] text-[#8b96ab] tracking-[0.14em] uppercase" style={{ fontFamily: 'var(--font-plex-mono)' }}>
            Inteligencia inmobiliaria
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#8b96ab]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
            <span className="text-[#ddc06a] font-medium">Nueva oportunidad</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>Análisis</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>Propuesta</span>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] hover:border-[#a68f52] px-3 py-1.5 rounded-xl transition-colors"
            style={{ fontFamily: 'var(--font-plex-mono)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Mis Proyectos
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[640px]">
          <div className="mb-10 text-center">
            <p className="text-[12px] font-medium text-[#c9a227] tracking-[0.14em] uppercase mb-3" style={{ fontFamily: 'var(--font-plex-mono)' }}>
              Módulo de prospección
            </p>
            <h2
              className="text-[30px] md:text-[36px] font-medium text-[#f4f0e6] leading-[1.1] tracking-[-0.01em] mb-3"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              ¿Cómo quieres comenzar<br />el análisis?
            </h2>
            <p className="text-[15px] text-[#8b96ab] leading-relaxed">
              Elige tu punto de partida. Puedes analizar un terreno que ya tienes<br />
              o dejar que el Scout encuentre candidatos por ti.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Flujo A */}
            <button
              onClick={() => setSelected('a')}
              onMouseEnter={() => setHovering('a')}
              onMouseLeave={() => setHovering(null)}
              className={`relative text-left rounded-2xl border-2 p-6 transition-all duration-200 bg-[#132a4d] ${
                selected === 'a'
                  ? 'border-[#c9a227] shadow-[0_0_0_1px_#c9a227]'
                  : hovering === 'a'
                  ? 'border-[#a68f52]'
                  : 'border-[#2a3f5c]'
              }`}
            >
              {selected === 'a' && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c9a227] text-[#070f22] text-[10px] font-semibold tracking-wide px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ fontFamily: 'var(--font-plex-mono)' }}
                >
                  Flujo más común
                </span>
              )}
              <div className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${selected === 'a' ? 'bg-[#c9a227]' : 'border border-[#2a3f5c]'}`}>
                {selected === 'a' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7 8,3" stroke="#070f22" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#c9a227]/15 flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="10" width="18" height="11" rx="1.5" stroke="#ddc06a" strokeWidth="1.5"/>
                  <path d="M3 11L12 4L21 11" stroke="#ddc06a" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="9" y="15" width="6" height="6" rx="0.5" stroke="#ddc06a" strokeWidth="1.2"/>
                </svg>
              </div>
              <p className="text-[10px] font-semibold text-[#ddc06a] tracking-[0.12em] uppercase mb-1" style={{ fontFamily: 'var(--font-plex-mono)' }}>Flujo A</p>
              <h3 className="text-[16px] font-semibold text-[#f4f0e6] mb-2">Ya tengo un terreno</h3>
              <p className="text-[13px] text-[#8b96ab] leading-relaxed mb-4">
                Tengo un predio específico y quiero analizar su potencial de desarrollo e inversión.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#c9a227]/10 text-[#ddc06a] border border-[#a68f52]/40">Captura de datos</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#c9a227]/10 text-[#ddc06a] border border-[#a68f52]/40">Análisis inmediato</span>
              </div>
            </button>

            {/* Flujo B */}
            <button
              onClick={() => setSelected('b')}
              onMouseEnter={() => setHovering('b')}
              onMouseLeave={() => setHovering(null)}
              className={`relative text-left rounded-2xl border-2 p-6 transition-all duration-200 bg-[#132a4d] ${
                selected === 'b'
                  ? 'border-[#5B8FD4] shadow-[0_0_0_1px_#5B8FD4]'
                  : hovering === 'b'
                  ? 'border-[#3f5a85]'
                  : 'border-[#2a3f5c]'
              }`}
            >
              <div className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${selected === 'b' ? 'bg-[#5B8FD4]' : 'border border-[#2a3f5c]'}`}>
                {selected === 'b' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#5B8FD4]/15 flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#8FB6E8" strokeWidth="1.5"/>
                  <path d="M16.5 16.5L21 21" stroke="#8FB6E8" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 11H14M11 8V14" stroke="#8FB6E8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-[10px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-1" style={{ fontFamily: 'var(--font-plex-mono)' }}>Flujo B</p>
              <h3 className="text-[16px] font-semibold text-[#f4f0e6] mb-2">Quiero buscar un terreno</h3>
              <p className="text-[13px] text-[#8b96ab] leading-relaxed mb-4">
                Tengo una intención de desarrollo y quiero que el Scout busque candidatos en una zona.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#5B8FD4]/10 text-[#8FB6E8] border border-[#5B8FD4]/40">Scout IA</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#5B8FD4]/10 text-[#8FB6E8] border border-[#5B8FD4]/40">Búsqueda activa</span>
              </div>
            </button>

            {/* Flujo A · Camino corto */}
            <button
              onClick={() => setSelected('a-rapido')}
              onMouseEnter={() => setHovering('a-rapido')}
              onMouseLeave={() => setHovering(null)}
              className={`relative text-left rounded-2xl border-2 p-6 transition-all duration-200 bg-[#132a4d] ${
                selected === 'a-rapido'
                  ? 'border-[#c9a227] shadow-[0_0_0_1px_#c9a227]'
                  : hovering === 'a-rapido'
                  ? 'border-[#a68f52]'
                  : 'border-[#2a3f5c]'
              }`}
            >
              <div className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${selected === 'a-rapido' ? 'bg-[#c9a227]' : 'border border-[#2a3f5c]'}`}>
                {selected === 'a-rapido' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7 8,3" stroke="#070f22" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#c9a227]/15 flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L4 14H11L10 22L20 9H13L13 2Z" stroke="#ddc06a" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-[10px] font-semibold text-[#ddc06a] tracking-[0.12em] uppercase mb-1" style={{ fontFamily: 'var(--font-plex-mono)' }}>Flujo A · Camino corto</p>
              <h3 className="text-[16px] font-semibold text-[#f4f0e6] mb-2">Ya tengo un terreno, quiero ir rápido</h3>
              <p className="text-[13px] text-[#8b96ab] leading-relaxed mb-4">
                Mismos agentes de IA corriendo en vivo, con menos preguntas y sin pausas manuales — ideal para una demo rápida.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#c9a227]/10 text-[#ddc06a] border border-[#a68f52]/40">3 pantallas</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#c9a227]/10 text-[#ddc06a] border border-[#a68f52]/40">Sin pausas</span>
              </div>
            </button>
          </div>

          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full py-4 rounded-xl text-[15px] font-semibold transition-all duration-200"
            style={{
              fontFamily: 'var(--font-plex-mono)',
              backgroundColor: selected ? '#c9a227' : '#132a4d',
              color: selected ? '#070f22' : '#5f6a80',
              cursor: selected ? 'pointer' : 'not-allowed',
              border: selected ? 'none' : '2px solid #2a3f5c',
            }}
            onMouseEnter={e => { if (selected) e.currentTarget.style.backgroundColor = '#ddc06a' }}
            onMouseLeave={e => { if (selected) e.currentTarget.style.backgroundColor = '#c9a227' }}
          >
            {!selected && 'Selecciona una opción para continuar'}
            {selected === 'a' && 'Continuar → Captura del terreno'}
            {selected === 'a-rapido' && 'Continuar → Captura rápida del terreno'}
            {selected === 'b' && 'Continuar → Definir intención de búsqueda'}
          </button>

          <p className="text-center text-[12px] text-[#5f6a80] mt-4">
            {selected === 'a-rapido'
              ? 'Corre los mismos agentes de IA en vivo, con menos preguntas'
              : 'El análisis toma entre 2 y 4 horas · Recibirás notificación al completarse'}
          </p>
        </div>
      </main>
    </div>
  )
}
