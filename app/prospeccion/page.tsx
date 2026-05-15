'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FlowSelector() {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovering, setHovering] = useState<string | null>(null)
  const router = useRouter()

  const handleContinue = () => {
    if (!selected) return
    if (selected === 'a') {
      router.push('/prospeccion/flujo-a')
    } else {
      router.push('/prospeccion/flujo-b')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">
      <header className="px-8 py-5 flex items-center gap-3 border-b border-[#E2E8E4] bg-white">
        <div className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] font-medium text-[#1a1a1a] tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-[#6b7c74] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-[12px] text-[#9aab9f]">
            <span className="text-[#1D9E75] font-medium">Nueva oportunidad</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>Análisis</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>Propuesta</span>
          </div>
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[13px] text-[#5a7065] hover:text-[#111d17] border border-[#E2E8E4] hover:border-[#C8D5CF] px-3 py-1.5 rounded-xl transition-colors">
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
            <p className="text-[12px] font-medium text-[#1D9E75] tracking-[0.14em] uppercase mb-3">
              Módulo de prospección
            </p>
            <h1 className="text-[28px] font-semibold text-[#111d17] leading-tight mb-3">
              ¿Cómo quieres comenzar<br />el análisis?
            </h1>
            <p className="text-[15px] text-[#5a7065] leading-relaxed">
              Elige tu punto de partida. Puedes analizar un terreno que ya tienes<br />
              o dejar que el Scout encuentre candidatos por ti.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setSelected('a')}
              onMouseEnter={() => setHovering('a')}
              onMouseLeave={() => setHovering(null)}
              className={`relative text-left rounded-2xl border p-6 transition-all duration-200 ${
                selected === 'a'
                  ? 'bg-white border-[#1D9E75] shadow-[0_0_0_2px_#1D9E75]'
                  : hovering === 'a'
                  ? 'bg-white border-[#9FE1CB] shadow-sm'
                  : 'bg-white border-[#E2E8E4]'
              }`}
            >
              {selected === 'a' && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1D9E75] text-white text-[10px] font-semibold tracking-wide px-3 py-1 rounded-full whitespace-nowrap">
                  Flujo más común
                </span>
              )}
              <div className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${selected === 'a' ? 'bg-[#1D9E75]' : 'border border-[#D0DDD5] opacity-60'}`}>
                {selected === 'a' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#E1F5EE] flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="10" width="18" height="11" rx="1.5" stroke="#1D9E75" strokeWidth="1.5"/>
                  <path d="M3 11L12 4L21 11" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="9" y="15" width="6" height="6" rx="0.5" stroke="#1D9E75" strokeWidth="1.2"/>
                </svg>
              </div>
              <p className="text-[10px] font-semibold text-[#0F6E56] tracking-[0.12em] uppercase mb-1">Flujo A</p>
              <h2 className="text-[16px] font-semibold text-[#111d17] mb-2">Ya tengo un terreno</h2>
              <p className="text-[13px] text-[#5a7065] leading-relaxed mb-4">
                Tengo un predio específico y quiero analizar su potencial de desarrollo e inversión.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#5DCAA5]/40">Captura de datos</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#5DCAA5]/40">Análisis inmediato</span>
              </div>
            </button>

            <button
              onClick={() => setSelected('b')}
              onMouseEnter={() => setHovering('b')}
              onMouseLeave={() => setHovering(null)}
              className={`relative text-left rounded-2xl border p-6 transition-all duration-200 ${
                selected === 'b'
                  ? 'bg-white border-[#378ADD] shadow-[0_0_0_2px_#378ADD]'
                  : hovering === 'b'
                  ? 'bg-white border-[#85B7EB] shadow-sm'
                  : 'bg-white border-[#E2E8E4]'
              }`}
            >
              <div className={`absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${selected === 'b' ? 'bg-[#378ADD]' : 'border border-[#D0DDD5] opacity-60'}`}>
                {selected === 'b' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#E6F1FB] flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#185FA5" strokeWidth="1.5"/>
                  <path d="M16.5 16.5L21 21" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 11H14M11 8V14" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-[10px] font-semibold text-[#185FA5] tracking-[0.12em] uppercase mb-1">Flujo B</p>
              <h2 className="text-[16px] font-semibold text-[#111d17] mb-2">Quiero buscar un terreno</h2>
              <p className="text-[13px] text-[#5a7065] leading-relaxed mb-4">
                Tengo una intención de desarrollo y quiero que el Scout busque candidatos en una zona.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E6F1FB] text-[#185FA5] border border-[#85B7EB]/40">Scout IA</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E6F1FB] text-[#185FA5] border border-[#85B7EB]/40">Búsqueda activa</span>
              </div>
            </button>
          </div>

          <button
            onClick={handleContinue}
            disabled={!selected}
            className={`w-full py-4 rounded-xl text-[15px] font-medium transition-all duration-200 ${
              selected
                ? 'bg-[#1D9E75] text-white hover:bg-[#0F6E56] cursor-pointer'
                : 'bg-[#E2E8E4] text-[#9aab9f] cursor-not-allowed'
            }`}
          >
            {!selected && 'Selecciona una opción para continuar'}
            {selected === 'a' && 'Continuar → Captura del terreno'}
            {selected === 'b' && 'Continuar → Definir intención de búsqueda'}
          </button>

          <p className="text-center text-[12px] text-[#9aab9f] mt-4">
            El análisis toma entre 2 y 4 horas · Recibirás notificación al completarse
          </p>
        </div>
      </main>
    </div>
  )
}
