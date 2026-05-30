'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveProyecto } from '@/lib/saveProyecto'

type Stage = 1 | 2 | 3 | 4

function AgentSpinner({ color = '#1D9E75' }: { color?: string }) {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function BigSpinner({ color, glow, size = 120 }: { color: string; glow: string; size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full opacity-20" style={{ backgroundColor: glow }} />
      <svg className="animate-spin absolute inset-0" width={size} height={size} viewBox="0 0 96 96" fill="none">
        <circle cx="48" cy="48" r="42" stroke={color} strokeWidth="7" strokeOpacity="0.15"/>
        <path d="M48 6a42 42 0 0 1 42 42" stroke={color} strokeWidth="7" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function PulsingDots() {
  return (
    <span className="inline-flex gap-1 ml-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )
}

function AgentBadge({ label, status, color }: { label: string; status: 'waiting' | 'running' | 'done'; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-500 ${
      status === 'done'
        ? 'bg-[#E1F5EE] border-[#9FE1CB] text-[#0F6E56]'
        : status === 'running'
        ? 'bg-white border-[#E2E8E4] text-[#111d17] shadow-sm'
        : 'bg-[#F7F8F6] border-[#E2E8E4] text-[#9aab9f]'
    }`}>
      {status === 'done' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : status === 'running' ? (
        <AgentSpinner color={color} />
      ) : (
        <span className="w-3 h-3 rounded-full border border-[#D0DDD5]" />
      )}
      {label}
    </div>
  )
}

const STAGE_TEXTS: Record<Stage, string> = {
  1: 'Agente Legal verificando normativa y uso de suelo…',
  2: 'Agente Financiero calculando costos y TIR…',
  3: 'Agente Mastermind generando recomendación final…',
  4: 'Análisis completado — reporte listo',
}

function AnalizandoContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || ''
  const [stage, setStage] = useState<Stage>(1)
  const [error, setError] = useState<string | null>(null)

  const progressPct = stage === 1 ? 20 : stage === 2 ? 55 : stage === 3 ? 85 : 100

  useEffect(() => {
    const formDataRaw = localStorage.getItem('smt_flujo_a_data')
    if (!formDataRaw) {
      router.push('/prospeccion/flujo-a')
      return
    }
    const formData = JSON.parse(formDataRaw)

    const t1 = setTimeout(() => setStage(2), 3000)
    const t2 = setTimeout(() => setStage(3), 6000)

    const runAnalisis = () => fetch('/api/analizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(res => {
      if (!res.ok) throw new Error('API error')
      return res.json()
    })

    runAnalisis()
      .catch(() => new Promise<void>(r => setTimeout(r, 2000)).then(runAnalisis))
      .then(async (data: Record<string, unknown>) => {
        if (data.error) throw new Error(String(data.error))
        localStorage.setItem('smt_analisis_data', JSON.stringify({ ...data, proyecto }))
        saveProyecto({ nombre: proyecto, datos: data, flujo: 'A' }).then(r => {
          if (r.ok && r.id) localStorage.setItem('smt_proyecto_id', r.id)
        })
        setStage(4)
        setTimeout(() => {
          router.push(`/analisis?proyecto=${encodeURIComponent(proyecto)}`)
        }, 800)
      })
      .catch(err => {
        console.error(err)
        setError('No se pudo generar el análisis. Verifica tu API key en .env.local')
      })

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

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
        <div className="ml-auto flex items-center gap-2 text-[12px] text-[#9aab9f]">
          <span className="text-[#1D9E75] font-medium">Flujo A</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Analizando terreno</span>
        </div>
      </header>

      <div className="h-1 bg-[#E2E8E4]">
        <div className="h-full bg-[#1D9E75] transition-all duration-700 ease-in-out" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[560px]">

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <p className="text-[15px] font-bold text-red-700 mb-2">Error al generar el análisis</p>
              <p className="text-[13px] text-red-600 mb-4">{error}</p>
              <button
                onClick={() => router.push('/prospeccion/flujo-a')}
                className="text-[13px] text-[#1D9E75] hover:underline"
              >
                Volver al formulario
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-10">
                {proyecto && (
                  <div className="inline-block mb-5 px-4 py-2 bg-[#1D9E75] rounded-xl">
                    <p className="text-[10px] font-bold text-[#9FE1CB] tracking-[0.12em] uppercase mb-0.5">Proyecto</p>
                    <p className="text-[16px] font-bold text-white">{proyecto}</p>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 mb-3">
                  {stage < 4 ? (
                    <>
                      <AgentSpinner color="#1D9E75" />
                      <span className="text-[14px] font-medium text-[#111d17]">{STAGE_TEXTS[stage]}</span>
                      <PulsingDots />
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="8" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="1.5"/>
                        <path d="M5 9l3 3 5-5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[14px] font-medium text-[#0F6E56]">{STAGE_TEXTS[4]}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <AgentBadge label="Agente Legal" status={stage === 1 ? 'running' : 'done'} color="#378ADD" />
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#D0DDD5]">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <AgentBadge label="Agente Financiero" status={stage < 2 ? 'waiting' : stage === 2 ? 'running' : 'done'} color="#8B5CF6" />
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#D0DDD5]">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <AgentBadge label="Agente Mastermind" status={stage < 3 ? 'waiting' : stage === 3 ? 'running' : 'done'} color="#1D9E75" />
                </div>
              </div>

              {stage === 1 && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <BigSpinner color="#378ADD" glow="#378ADD" />
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-[#111d17] mb-1">Revisando normativa urbana</p>
                    <p className="text-[13px] text-[#7a9089]">Verificando uso de suelo, COS, CUS y restricciones municipales…</p>
                  </div>
                </div>
              )}

              {stage === 2 && (
                <div className="flex flex-col items-center gap-6 bg-white border border-[#E5DEFF] rounded-2xl px-5 py-10 shadow-sm">
                  <BigSpinner color="#8B5CF6" glow="#8B5CF6" />
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#111d17]">Modelando estructura financiera</p>
                    <p className="text-[12px] text-[#7a9089]">Calculando costos, ingresos, TIR y score de resiliencia…</p>
                  </div>
                </div>
              )}

              {stage === 3 && (
                <div className="flex flex-col items-center gap-6 bg-white border border-[#D4EFE3] rounded-2xl px-5 py-10 shadow-sm">
                  <BigSpinner color="#1D9E75" glow="#1D9E75" />
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#111d17]">Generando recomendación Mastermind</p>
                    <p className="text-[12px] text-[#7a9089]">Consolidando análisis de mercado y stress test…</p>
                  </div>
                </div>
              )}

              {stage === 4 && (
                <div className="bg-[#F0FBF6] border border-[#1D9E75]/30 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#1D9E75] flex items-center justify-center mx-auto mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-[16px] font-bold text-[#0F6E56] mb-1">Análisis completado</p>
                  <p className="text-[13px] text-[#5a9078]">Redirigiendo al reporte completo…</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function AnalizandoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f]">Iniciando análisis…</p>
      </div>
    }>
      <AnalizandoContent />
    </Suspense>
  )
}
