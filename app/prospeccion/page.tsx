'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'
import { supabase } from '@/lib/supabase'

// Look & feel — continuación del navy/oro aplicado en Flujo A (ver
// app/prospeccion/flujo-a/page.tsx para la paleta de referencia completa).
//
// Ya no existen "Camino A" y "Camino A · rápido" como opciones separadas — el cockpit nuevo
// (bento-grid + Mastermind unificado en app/analisis/analizando/) volvió obsoleta la distinción:
// antes "rápido" existía para saltarse pausas de un wizard paso a paso incómodo, y ese wizard ya
// no existe. Ahora solo hay Camino A (el flujo completo, ya con el cockpit) y Camino B (Scout,
// sin cambios). El modo `?modo=rapido` de flujo-a/page.tsx sigue existiendo en el código (recorta
// preguntas del intake) pero ya no se expone aquí — decisión consciente, no descuido.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

export default function FlowSelector() {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovering, setHovering] = useState<string | null>(null)
  const [email, setEmail] = useState<string | undefined>(undefined)
  const router = useRouter()

  // Esta pantalla (y /dashboard) traen su propio header y excluyen el Topbar genérico (evita
  // el doble header) — pero el Topbar era el único lugar con botón "Salir". Sin esto, después
  // de entrar no había manera de cerrar sesión desde el flujo principal (bug real reportado).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setEmail(session?.user?.email))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleContinue = () => {
    if (!selected) return
    router.push(selected === 'a' ? '/prospeccion/flujo-a' : '/prospeccion/flujo-b')
  }

  return (
    <div className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex flex-col relative overflow-hidden`}>
      {/* Video de fondo — dron sobre Monterrey/San Pedro (Pexels, licencia libre de uso).
          object-cover + loop silencioso. Overlay ligero, solo para dar contraste al texto
          suelto (título/subtítulo) — las tarjetas ya tienen su propio fondo sólido, no
          dependen de esto. Sin grid encima: el video ya da suficiente textura, duplicarla
          se veía sucio y tapaba el video. */}
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      >
        <source src="/videos/monterrey-skyline.mp4" type="video/mp4" />
      </video>
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: 'linear-gradient(180deg, rgba(7,15,34,0.55) 0%, rgba(11,29,58,0.4) 35%, rgba(11,29,58,0.6) 75%, rgba(11,29,58,0.8) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col flex-1">
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
        <div className="ml-auto flex items-center gap-3">
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
          {email && (
            <>
              <button onClick={() => router.push('/perfil')}
                className="w-8 h-8 rounded-full bg-[#132a4d] border border-[#c9a227]/40 flex items-center justify-center hover:border-[#c9a227] transition-colors shrink-0"
                title={email}>
                <span className="text-[#ddc06a] text-[11px] font-semibold">{email.slice(0, 2).toUpperCase()}</span>
              </button>
              <button onClick={handleLogout}
                className="text-[13px] text-[#8b96ab] hover:text-[#ddc06a] transition-colors"
                style={{ fontFamily: 'var(--font-plex-mono)' }}>
                Salir
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[620px]">
          <div className="mb-10 text-center">
            <h2
              className="text-[30px] md:text-[36px] font-medium text-[#f4f0e6] leading-[1.1] tracking-[-0.01em] mb-3"
              style={{ fontFamily: 'var(--font-fraunces)', textShadow: '0 2px 16px rgba(7,15,34,0.6)' }}
            >
              ¿Cómo quieres comenzar<br />el análisis?
            </h2>
            <p className="text-[15px] text-[#c7ccd6] leading-relaxed" style={{ textShadow: '0 1px 10px rgba(7,15,34,0.6)' }}>
              Elige tu punto de partida. Puedes analizar un terreno que ya tienes<br />
              o dejar que el Scout encuentre candidatos por ti.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Camino A */}
            <button
              onClick={() => setSelected('a')}
              onMouseEnter={() => setHovering('a')}
              onMouseLeave={() => setHovering(null)}
              className={`relative text-left rounded-2xl border-2 p-7 transition-all duration-200 bg-[#132a4d] ${
                selected === 'a'
                  ? 'border-[#c9a227] shadow-[0_0_0_1px_#c9a227]'
                  : hovering === 'a'
                  ? 'border-[#a68f52]'
                  : 'border-[#2a3f5c]'
              }`}
            >
              <span
                className="absolute -top-3 left-7 bg-[#c9a227] text-[#070f22] text-[10px] font-semibold tracking-wide px-3 py-1 rounded-full whitespace-nowrap"
                style={{ fontFamily: 'var(--font-plex-mono)' }}
              >
                Flujo más común
              </span>
              <div className={`absolute top-5 right-5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${selected === 'a' ? 'bg-[#c9a227]' : 'border border-[#2a3f5c]'}`}>
                {selected === 'a' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7 8,3" stroke="#070f22" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#c9a227]/15 flex items-center justify-center mb-5 mt-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="10" width="18" height="11" rx="1.5" stroke="#ddc06a" strokeWidth="1.5"/>
                  <path d="M3 11L12 4L21 11" stroke="#ddc06a" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="9" y="15" width="6" height="6" rx="0.5" stroke="#ddc06a" strokeWidth="1.2"/>
                </svg>
              </div>
              <h3 className="text-[18px] font-semibold text-[#f4f0e6] mb-2">Ya tengo un terreno</h3>
              <p className="text-[13.5px] text-[#8b96ab] leading-relaxed">
                Tengo un predio específico y quiero analizar su potencial de desarrollo e inversión —
                6 agentes de IA corriendo en vivo en un solo cockpit, con Mastermind calibrando el
                proyecto en cada momento.
              </p>
            </button>

            {/* Camino B */}
            <button
              onClick={() => setSelected('b')}
              onMouseEnter={() => setHovering('b')}
              onMouseLeave={() => setHovering(null)}
              className={`relative text-left rounded-2xl border-2 p-7 transition-all duration-200 bg-[#132a4d] ${
                selected === 'b'
                  ? 'border-[#5B8FD4] shadow-[0_0_0_1px_#5B8FD4]'
                  : hovering === 'b'
                  ? 'border-[#3f5a85]'
                  : 'border-[#2a3f5c]'
              }`}
            >
              <div className={`absolute top-5 right-5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${selected === 'b' ? 'bg-[#5B8FD4]' : 'border border-[#2a3f5c]'}`}>
                {selected === 'b' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#5B8FD4]/15 flex items-center justify-center mb-5 mt-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#8FB6E8" strokeWidth="1.5"/>
                  <path d="M16.5 16.5L21 21" stroke="#8FB6E8" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 11H14M11 8V14" stroke="#8FB6E8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="text-[18px] font-semibold text-[#f4f0e6] mb-2">Quiero buscar un terreno</h3>
              <p className="text-[13.5px] text-[#8b96ab] leading-relaxed">
                Tengo una intención de desarrollo y quiero que el Scout busque candidatos en una zona.
              </p>
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
            {selected === 'b' && 'Continuar → Definir intención de búsqueda'}
          </button>

          <p className="text-center text-[12px] text-[#5f6a80] mt-4">
            El análisis toma entre 2 y 4 horas · Recibirás notificación al completarse
          </p>
        </div>
      </main>
      </div>
    </div>
  )
}
