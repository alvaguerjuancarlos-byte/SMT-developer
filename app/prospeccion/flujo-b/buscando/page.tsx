'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const CANDIDATES = [
  {
    id: 1,
    nombre: 'Terreno en Valle Oriente',
    precio: '$8,500,000',
    superficie: '1,200 m²',
    pm2: '$7,083/m²',
    zona: 'San Pedro Garza García',
    uso: 'Habitacional Mixto',
    mercado: 'Demanda Alta',
    mercadoColor: 'green',
  },
  {
    id: 2,
    nombre: 'Predio en Cumbres Elite',
    precio: '$5,200,000',
    superficie: '850 m²',
    pm2: '$6,118/m²',
    zona: 'Monterrey Norte',
    uso: 'Comercial / Mixto',
    mercado: 'Mercado Activo',
    mercadoColor: 'blue',
  },
  {
    id: 3,
    nombre: 'Lote en Del Valle',
    precio: '$12,800,000',
    superficie: '2,100 m²',
    pm2: '$6,095/m²',
    zona: 'San Pedro Garza García',
    uso: 'Habitacional',
    mercado: 'Alta Plusvalía',
    mercadoColor: 'purple',
  },
]

type Stage = 1 | 2 | 3 | 4

function AgentSpinner({ color = '#1D9E75' }: { color?: string }) {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function PulsingDots() {
  return (
    <span className="inline-flex gap-1 ml-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

function AgentBadge({
  label,
  status,
  color,
}: {
  label: string
  status: 'waiting' | 'running' | 'done'
  color: string
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-500 ${
        status === 'done'
          ? 'bg-[#E1F5EE] border-[#9FE1CB] text-[#0F6E56]'
          : status === 'running'
          ? 'bg-white border-[#E2E8E4] text-[#111d17] shadow-sm'
          : 'bg-[#F7F8F6] border-[#E2E8E4] text-[#9aab9f]'
      }`}
    >
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

function CandidateCard({
  c,
  stage,
  index,
}: {
  c: typeof CANDIDATES[0]
  stage: Stage
  index: number
}) {
  const visible = stage >= 2
  const legalDone = stage >= 3
  const marketDone = stage >= 4

  const marketColors: Record<string, string> = {
    green: 'bg-[#E1F5EE] text-[#0F6E56] border-[#9FE1CB]',
    blue: 'bg-[#E6F1FB] text-[#185FA5] border-[#85B7EB]',
    purple: 'bg-[#F3EEFF] text-[#6B3FA0] border-[#C4A8E8]',
  }

  return (
    <div
      className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm overflow-hidden transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transitionDelay: `${index * 100}ms`,
      }}
    >
      <div className="px-5 py-4 border-b border-[#F0F4F2] flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-[#9aab9f] tracking-[0.12em] uppercase">Candidato #{c.id}</span>
          <h3 className="text-[15px] font-semibold text-[#111d17] mt-0.5">{c.nombre}</h3>
          <p className="text-[12px] text-[#7a9089]">{c.zona}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold text-[#111d17]">{c.precio}</p>
          <p className="text-[11px] text-[#9aab9f]">MXN</p>
        </div>
      </div>

      <div className="px-5 py-3 flex gap-4 border-b border-[#F0F4F2]">
        <div>
          <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide">Superficie</p>
          <p className="text-[13px] font-semibold text-[#111d17]">{c.superficie}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide">Precio / m²</p>
          <p className="text-[13px] font-semibold text-[#111d17]">{c.pm2}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide">Uso de suelo</p>
          <p className="text-[13px] font-semibold text-[#111d17]">{c.uso}</p>
        </div>
      </div>

      <div className="px-5 py-3 flex flex-wrap gap-2">
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-500 ${
            legalDone
              ? 'bg-[#E1F5EE] text-[#0F6E56] border-[#9FE1CB]'
              : 'bg-[#F7F8F6] text-[#9aab9f] border-[#E2E8E4]'
          }`}
        >
          {legalDone ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <span className="w-2 h-2 rounded-full border border-[#D0DDD5]" />
          )}
          Uso de suelo: {legalDone ? 'Compatible' : 'Verificando…'}
        </div>

        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-500 ${
            legalDone
              ? 'bg-[#E1F5EE] text-[#0F6E56] border-[#9FE1CB]'
              : 'bg-[#F7F8F6] text-[#9aab9f] border-[#E2E8E4]'
          }`}
        >
          {legalDone ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <span className="w-2 h-2 rounded-full border border-[#D0DDD5]" />
          )}
          Normativa: {legalDone ? 'Sin restricciones' : 'Pendiente'}
        </div>

        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-500 ${
            marketDone
              ? `${marketColors[c.mercadoColor]}`
              : 'bg-[#F7F8F6] text-[#9aab9f] border-[#E2E8E4]'
          }`}
        >
          {marketDone ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 7l2-3 2 1.5 2-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <span className="w-2 h-2 rounded-full border border-[#D0DDD5]" />
          )}
          {marketDone ? c.mercado : 'Mercado pendiente'}
        </div>
      </div>
    </div>
  )
}

function AgentStatusBar({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center mb-6">
      <AgentBadge
        label="Scout IA"
        status={stage === 1 ? 'running' : 'done'}
        color="#1D9E75"
      />
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#D0DDD5]">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      <AgentBadge
        label="Agente Legal"
        status={stage < 2 ? 'waiting' : stage === 2 ? 'running' : 'done'}
        color="#378ADD"
      />
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#D0DDD5]">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      <AgentBadge
        label="Agente de Mercado"
        status={stage < 3 ? 'waiting' : stage === 3 ? 'running' : 'done'}
        color="#8B5CF6"
      />
    </div>
  )
}

export default function BuscandoPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>(1)
  const [statusText, setStatusText] = useState('Agente Scout buscando terrenos...')

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(setTimeout(() => {
      setStage(2)
      setStatusText('Agente Legal verificando uso de suelo y normativa...')
    }, 3000))

    timers.push(setTimeout(() => {
      setStage(3)
      setStatusText('Agente de Mercado analizando demanda y competencia...')
    }, 6500))

    timers.push(setTimeout(() => {
      setStage(4)
      setStatusText('Análisis completado — 3 candidatos encontrados')
    }, 10000))

    return () => timers.forEach(clearTimeout)
  }, [])

  const progressPct = stage === 1 ? 15 : stage === 2 ? 45 : stage === 3 ? 75 : 100

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
          <span className="text-[#1D9E75] font-medium">Flujo B</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="text-[#1D9E75] font-medium">Scout IA</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Análisis en progreso</span>
        </div>
      </header>

      {/* Top progress bar */}
      <div className="h-1 bg-[#E2E8E4]">
        <div
          className="h-full bg-[#1D9E75] transition-all duration-700 ease-in-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-[680px] mx-auto">

          {/* Status header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              {stage < 4 ? (
                <>
                  <AgentSpinner color="#1D9E75" />
                  <span className="text-[14px] font-medium text-[#111d17]">{statusText}</span>
                  <PulsingDots />
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="8" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="1.5"/>
                    <path d="M5 9l3 3 5-5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[14px] font-medium text-[#0F6E56]">{statusText}</span>
                </>
              )}
            </div>
            <AgentStatusBar stage={stage} />
          </div>

          {/* Stage 1 — searching animation */}
          {stage === 1 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full bg-[#E1F5EE] animate-ping opacity-60" />
                <div className="relative w-20 h-20 rounded-full bg-[#E1F5EE] flex items-center justify-center">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="#1D9E75" strokeWidth="1.8"/>
                    <path d="M16.5 16.5L21 21" stroke="#1D9E75" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M8 11H14M11 8V14" stroke="#1D9E75" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <p className="text-[15px] font-semibold text-[#111d17] mb-1">Escaneando el mercado</p>
              <p className="text-[13px] text-[#7a9089]">El Scout está analizando disponibilidad, precios y zonas…</p>
            </div>
          )}

          {/* Stages 2-4 — candidate cards */}
          {stage >= 2 && (
            <div className="flex flex-col gap-4 mb-8">
              {CANDIDATES.map((c, i) => (
                <CandidateCard key={c.id} c={c} stage={stage} index={i} />
              ))}
            </div>
          )}

          {/* Stage 2 — legal agent running */}
          {stage === 2 && (
            <div className="flex items-center gap-3 bg-white border border-[#E2E8E4] rounded-2xl px-5 py-4 shadow-sm mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#E6F1FB] flex items-center justify-center shrink-0">
                <AgentSpinner color="#378ADD" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#111d17]">Agente Legal trabajando</p>
                <p className="text-[12px] text-[#7a9089]">Verificando uso de suelo, normativa urbana y restricciones…</p>
              </div>
            </div>
          )}

          {/* Stage 3 — market agent running */}
          {stage === 3 && (
            <div className="flex items-center gap-3 bg-white border border-[#E2E8E4] rounded-2xl px-5 py-4 shadow-sm mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#F3EEFF] flex items-center justify-center shrink-0">
                <AgentSpinner color="#8B5CF6" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#111d17]">Agente de Mercado trabajando</p>
                <p className="text-[12px] text-[#7a9089]">Analizando demanda, comparables y tendencias de la zona…</p>
              </div>
            </div>
          )}

          {/* Stage 4 — CTA */}
          {stage === 4 && (
            <div className="bg-[#F0FBF6] border border-[#1D9E75]/30 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1D9E75] flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-[16px] font-bold text-[#0F6E56] mb-1">Análisis multi-agente completado</p>
              <p className="text-[13px] text-[#5a9078] mb-5">
                Scout, Legal y Mercado han procesado los 3 candidatos. El reporte completo está listo.
              </p>
              <button
                onClick={() => router.push('/analisis')}
                className="inline-flex items-center gap-2 bg-[#1D9E75] text-white px-8 py-3.5 rounded-xl text-[15px] font-semibold hover:bg-[#0F6E56] transition-colors cursor-pointer"
              >
                Ver Análisis Completo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
