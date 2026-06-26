'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveProyecto } from '@/lib/saveProyecto'

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentStatus = 'waiting' | 'running' | 'done' | 'error'

interface TerrenoResult {
  costoTerrenoM2: number
  costoTerreno: number
  bitacoraTerreno: any
}
interface ConstruccionResult {
  construccionM2: number
  costoTotalConstruccion: number
  superficieConstruida: number
  superficieVendible?: number
  bitacoraConstruccion: any
}
interface LegalResult { fichaLegal: any; fuentes?: any }
interface MercadoResult { mercado: any; fuentes?: any }
interface FinancieroResult {
  recomendacion: any; financiero: any; estructuraCapital: any
  flujoMensual: any[]; score: any; metodologiaScore: any
  stressTest: any[]; puntoQuiebre: any
}

interface UbicacionData {
  isocronas: { rango_min: number; poblacion_alcanzada: number | null }[]
}

interface PipelineState {
  terreno:     { status: AgentStatus; data: TerrenoResult | null;     overrideM2: string }
  construccion:{ status: AgentStatus; data: ConstruccionResult | null; overrideM2: string }
  legal:       { status: AgentStatus; data: LegalResult | null }
  mercado:     { status: AgentStatus; data: MercadoResult | null }
  financiero:  { status: AgentStatus; data: FinancieroResult | null }
  ubicacion:   { status: AgentStatus; data: UbicacionData | null }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)} M`
    : `$${n.toLocaleString('es-MX')}`

function Spinner({ color = '#1D9E75', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg className="animate-spin shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="1.2"/>
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function StepBadge({ n, status, label }: { n: number; status: AgentStatus; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-[12px] font-medium transition-all ${
      status === 'done' ? 'text-[#0F6E56]' : status === 'running' ? 'text-[#111d17]' : 'text-[#b0bdb6]'
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
        status === 'done' ? 'bg-[#1D9E75] text-white' :
        status === 'running' ? 'bg-[#111d17] text-white' :
        'bg-[#E2E8E4] text-[#b0bdb6]'
      }`}>
        {status === 'done' ? '✓' : n}
      </div>
      {label}
    </div>
  )
}

function SemaforoChip({ sem }: { sem?: string }) {
  if (!sem) return null
  const cfg = sem === 'VERDE'
    ? { bg: 'bg-[#E1F5EE]', text: 'text-[#0F6E56]', dot: 'bg-[#1D9E75]' }
    : sem === 'AMARILLO'
    ? { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', dot: 'bg-[#F59E0B]' }
    : { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]', dot: 'bg-[#DC2626]' }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      IC {sem}
    </span>
  )
}

function EditableM2({
  label, value, override, onOverride, unit = '/m²',
}: {
  label: string; value: number; override: string; onOverride: (v: string) => void; unit?: string
}) {
  const display = override !== '' ? Number(override) : value
  return (
    <div className="bg-[#F7F8F6] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide font-semibold">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-[#9aab9f]">$</span>
          <input
            type="number"
            value={override !== '' ? override : value}
            onChange={e => onOverride(e.target.value)}
            className="w-28 text-[17px] font-bold text-[#111d17] bg-transparent border-b border-dashed border-[#C0CDC7] focus:outline-none focus:border-[#1D9E75]"
          />
          <span className="text-[12px] text-[#9aab9f]">{unit}</span>
        </div>
      </div>
      {override !== '' && Number(override) !== value && (
        <div className="text-right">
          <p className="text-[9px] text-[#9aab9f]">Agente calculó</p>
          <p className="text-[11px] text-[#b0bdb6] line-through">${value.toLocaleString('es-MX')}{unit}</p>
        </div>
      )}
    </div>
  )
}

// ─── Step Cards ──────────────────────────────────────────────────────────────

function RunningCard({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-6 flex items-center gap-5">
      <Spinner size={36} />
      <div>
        <p className="text-[14px] font-semibold text-[#111d17]">{label}</p>
        <p className="text-[12px] text-[#9aab9f] mt-0.5">{hint}</p>
      </div>
    </div>
  )
}

function DoneCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#9FE1CB] shadow-sm overflow-hidden">
      {children}
    </div>
  )
}

function ErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[#FECACA] p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] flex items-center justify-center shrink-0">
          <span className="text-sm">⚠️</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#991B1B]">{label} — Error al conectar</p>
          <p className="text-[11px] text-[#b0bdb6]">Verifica tu API key o conexión</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="text-[12px] font-semibold text-[#1D9E75] border border-[#9FE1CB] px-3 py-1.5 rounded-lg hover:bg-[#F0FBF6] transition-colors cursor-pointer shrink-0"
      >
        Re-intentar
      </button>
    </div>
  )
}

// ─── Agent Chat ──────────────────────────────────────────────────────────────

const QUICK_QUESTIONS: Record<string, string[]> = {
  terreno: [
    '¿Por qué asignaste esa banda y no la adyacente?',
    '¿Cómo afecta la clasificación vial al valor?',
    '¿Los comparables son del mismo nivel de la colonia?',
    '¿Qué dato mejoraría más el índice de confiabilidad?',
  ],
  construccion: [
    '¿Por qué ese costo/m² para esta ciudad?',
    '¿Cómo calculaste la superficie construible?',
    '¿Qué partida representa mayor riesgo de sobrecosto?',
    '¿Cómo cambia si ajusto la banda de construcción?',
  ],
  legal: [
    '¿Cuánto tiempo toman los permisos en este municipio?',
    '¿La alerta más crítica puede resolverse?',
    '¿Se necesita cambio de uso de suelo?',
    '¿Qué implica el CUS para el número de unidades?',
  ],
  mercado: [
    '¿Por qué esa velocidad de absorción?',
    '¿Hay riesgo de saturación en el corredor?',
    '¿Cuál es el mejor producto para este mercado?',
    '¿Los comparables son del mismo nivel de calidad?',
  ],
}

function AgentChat({ agentKey, agentData }: { agentKey: string; agentData: any }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text?: string) => {
    const pregunta = text ?? input.trim()
    if (!pregunta || loading) return
    setInput('')
    const next = [...messages, { role: 'user' as const, content: pregunta }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat-analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analisis: agentData, messages, pregunta }),
      })
      const json = await res.json()
      setMessages([...next, { role: 'assistant', content: json.respuesta || 'Sin respuesta.' }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Error al conectar. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  const questions = QUICK_QUESTIONS[agentKey] ?? []

  return (
    <div className="border-t border-[#F0F4F2] px-5 py-4">
      <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest mb-3">Preguntar al agente</p>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {questions.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-[11px] text-[#1D9E75] border border-[#9FE1CB] bg-[#F0FBF6] px-3 py-1.5 rounded-full hover:bg-[#E1F5EE] transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto mb-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0 mb-0.5">
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                  </svg>
                </div>
              )}
              <div className={`max-w-[82%] px-3 py-2 text-[12px] leading-relaxed rounded-2xl ${
                m.role === 'user'
                  ? 'bg-[#1D9E75] text-white rounded-br-sm'
                  : 'bg-[#F7F8F6] border border-[#E2E8E4] text-[#111d17] rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0 mb-0.5">
                <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                </svg>
              </div>
              <div className="bg-[#F7F8F6] border border-[#E2E8E4] rounded-2xl rounded-bl-sm px-3 py-2.5">
                <span className="inline-flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#9aab9f] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pregunta algo sobre este cálculo…"
          disabled={loading}
          className="flex-1 text-[12px] bg-[#F7F8F6] border border-[#E2E8E4] rounded-xl px-4 py-2.5 outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 placeholder:text-[#c0cdc7] disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl bg-[#1D9E75] flex items-center justify-center disabled:opacity-40 hover:bg-[#0F6E56] transition-colors cursor-pointer shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main pipeline ───────────────────────────────────────────────────────────

function PipelineContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || ''

  const [formData, setFormData] = useState<any>(null)
  const [pipe, setPipe] = useState<PipelineState>({
    terreno:     { status: 'waiting', data: null, overrideM2: '' },
    construccion:{ status: 'waiting', data: null, overrideM2: '' },
    legal:       { status: 'waiting', data: null },
    mercado:     { status: 'waiting', data: null },
    financiero:  { status: 'waiting', data: null },
    ubicacion:   { status: 'waiting', data: null },
  })

  useEffect(() => {
    const raw = localStorage.getItem('smt_flujo_a_data')
    if (!raw) { router.push('/prospeccion/flujo-a'); return }
    const fd = JSON.parse(raw)
    setFormData(fd)
    runUbicacion(fd)   // ubicación primero; al terminar dispara runTerreno con el contexto
  }, [])

  // ── Preparación: Ubicación (corre primero, al terminar dispara Terreno) ──
  const runUbicacion = async (fd: any) => {
    const lat: number | null = fd.lat ?? fd.zonaGeo?.lat ?? null
    const lng: number | null = fd.lng ?? fd.zonaGeo?.lng ?? null

    if (!lat || !lng) {
      // Sin coordenadas: saltar ubicación y arrancar terreno directamente
      setPipe(p => ({ ...p, ubicacion: { status: 'done', data: { landPrice: null, isocronas: [] } } }))
      runTerreno(fd, null)
      return
    }

    setPipe(p => ({ ...p, ubicacion: { status: 'running', data: null } }))
    try {
      const isoRes = await fetch('/api/geo/isochrone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, perfil: 'driving' }),
      }).then(r => r.json())
      const isocronas = isoRes.isocronas ?? []
      const ubicacionData: UbicacionData = { isocronas }
      setPipe(p => ({ ...p, ubicacion: { status: 'done', data: ubicacionData } }))
      runTerreno(fd, ubicacionData)
    } catch {
      setPipe(p => ({ ...p, ubicacion: { status: 'error', data: null } }))
      runTerreno(fd, null)
    }
  }

  // ── Step 1: Terreno ──
  const runTerreno = async (fd?: any, ubicacion?: UbicacionData | null) => {
    const input = fd || formData
    const ub = ubicacion !== undefined ? ubicacion : pipe.ubicacion.data
    setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'running', data: null } }))
    try {
      const res = await fetch('/api/agentes/terreno', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, ubicacion: ub }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'done', data: json } }))
    } catch {
      setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'error' } }))
    }
  }

  // ── Step 2: Construcción ──
  const runConstruccion = async () => {
    const t = pipe.terreno.data!
    const m2 = pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2
    const payload = { ...formData, costoTerrenoM2: m2, costoTerreno: m2 * Number(formData.superficie) }
    setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'running', data: null } }))
    try {
      const res = await fetch('/api/agentes/construccion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'done', data: json } }))
    } catch {
      setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'error' } }))
    }
  }

  // ── Step 3: Legal + Mercado (parallel) ──
  const runLegalMercado = async () => {
    const c = pipe.construccion.data!
    const m2c = pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2
    const payload = { ...formData, costoTerrenoM2: efectivoTerrenoM2(), construccionM2: m2c }
    setPipe(p => ({
      ...p,
      legal:  { ...p.legal,  status: 'running', data: null },
      mercado:{ ...p.mercado, status: 'running', data: null },
    }))
    const [lRes, mRes] = await Promise.allSettled([
      fetch('/api/agentes/legal',  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
      fetch('/api/agentes/mercado',{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
    ])
    setPipe(p => ({
      ...p,
      legal:  { status: lRes.status === 'fulfilled' && !lRes.value.error ? 'done' : 'error', data: lRes.status === 'fulfilled' ? lRes.value : null },
      mercado:{ status: mRes.status === 'fulfilled' && !mRes.value.error ? 'done' : 'error', data: mRes.status === 'fulfilled' ? mRes.value : null },
    }))
  }

  const runLegal = async () => {
    setPipe(p => ({ ...p, legal: { status: 'running', data: null } }))
    try {
      const res = await fetch('/api/agentes/legal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, legal: { status: 'done', data: json } }))
    } catch {
      setPipe(p => ({ ...p, legal: { status: 'error', data: null } }))
    }
  }

  const runMercado = async () => {
    setPipe(p => ({ ...p, mercado: { status: 'running', data: null } }))
    try {
      const res = await fetch('/api/agentes/mercado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, mercado: { status: 'done', data: json } }))
    } catch {
      setPipe(p => ({ ...p, mercado: { status: 'error', data: null } }))
    }
  }

  // ── Step 4: Financiero ──
  const runFinanciero = async () => {
    const t = pipe.terreno.data!
    const c = pipe.construccion.data!
    const m2t = pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2
    const m2c = pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2
    const costoTerreno = m2t * Number(formData.superficie)
    // Use actual total from agent (sum of zones). Recompute only if user overrode cost/m².
    const costoTotalConstruccion = pipe.construccion.overrideM2 !== ''
      ? m2c * (c.superficieConstruida || Number(formData.superficie) * 1.2)
      : (c.costoTotalConstruccion || m2c * (c.superficieConstruida || Number(formData.superficie) * 1.2))
    const payload = {
      ...formData,
      costoTerrenoM2: m2t, costoTerreno,
      construccionM2: m2c, costoTotalConstruccion,
      superficieConstruida: c.superficieConstruida,
      superficieVendible: c.superficieVendible,
      fichaLegal: pipe.legal.data?.fichaLegal,
      mercado: pipe.mercado.data?.mercado,
    }
    setPipe(p => ({ ...p, financiero: { status: 'running', data: null } }))
    try {
      const res = await fetch('/api/agentes/financiero', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, financiero: { status: 'done', data: json } }))

      // Assemble final result and save
      const fullResult = {
        proyecto,
        ...json,
        bitacoraTerreno: t.bitacoraTerreno,
        bitacoraConstruccion: c.bitacoraConstruccion,
        fichaLegal: pipe.legal.data?.fichaLegal,
        mercado: pipe.mercado.data?.mercado,
        fuentes: {
          legal: pipe.legal.data?.fuentes?.legal || [],
          mercado: pipe.mercado.data?.fuentes?.mercado || [],
        },
      }
      localStorage.setItem('smt_analisis_data', JSON.stringify(fullResult))
      saveProyecto({ nombre: proyecto, datos: { ...fullResult, _inputData: formData }, flujo: 'A' })
        .then(r => { if (r.ok && r.id) localStorage.setItem('smt_proyecto_id', r.id) })
      setTimeout(() => router.push(`/analisis?proyecto=${encodeURIComponent(proyecto)}`), 1200)
    } catch {
      setPipe(p => ({ ...p, financiero: { status: 'error', data: null } }))
    }
  }

  const efectivoTerrenoM2 = () => {
    const t = pipe.terreno.data
    if (!t) return 0
    return pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2
  }
  const efectivoConstruccionM2 = () => {
    const c = pipe.construccion.data
    if (!c) return 0
    return pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2
  }

  const legalMercadoBothDone = pipe.legal.status === 'done' && pipe.mercado.status === 'done'
  const legalMercadoBothError = pipe.legal.status === 'error' && pipe.mercado.status === 'error'
  const legalMercadoRunning = pipe.legal.status === 'running' || pipe.mercado.status === 'running'

  // ── Progress ──
  const stepsDone = [
    pipe.terreno.status === 'done',
    pipe.construccion.status === 'done',
    legalMercadoBothDone,
    pipe.financiero.status === 'done',
  ].filter(Boolean).length
  const pct = (stepsDone / 4) * 100

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center gap-3 border-b border-[#E2E8E4] bg-white">
        <div className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] font-medium text-[#1a1a1a] tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-[#6b7c74] tracking-[0.12em] uppercase">Pipeline de análisis</span>
        </div>
        {proyecto && (
          <div className="ml-auto px-3 py-1.5 bg-[#1D9E75] rounded-lg">
            <p className="text-[10px] font-bold text-[#9FE1CB] tracking-wide uppercase leading-none">Proyecto</p>
            <p className="text-[13px] font-bold text-white leading-tight">{proyecto}</p>
          </div>
        )}
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-[#E2E8E4]">
        <div className="h-full bg-[#1D9E75] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      <main className="flex-1 flex gap-0 overflow-hidden">
        {/* Left sidebar — step indicators */}
        <aside className="hidden md:flex flex-col gap-6 w-52 shrink-0 px-6 py-8 border-r border-[#E2E8E4] bg-white">
          <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest">Agentes</p>
          <StepBadge n={1} status={pipe.terreno.status} label="Terreno" />
          <StepBadge n={2} status={pipe.construccion.status} label="Construcción" />
          <StepBadge n={3} status={legalMercadoBothDone ? 'done' : legalMercadoRunning ? 'running' : 'waiting'} label="Legal + Mercado" />
          <StepBadge n={4} status={pipe.financiero.status} label="Financiero" />
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 py-8">
          <div className="max-w-[640px] mx-auto flex flex-col gap-5">

            {/* ══ STEP 1 — TERRENO ══ */}
            <section>
              <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest mb-3">Paso 1 · Agente de Valuación</p>

              {pipe.ubicacion.status === 'running' && (
                <RunningCard
                  label="Preparando contexto de ubicación…"
                  hint="Obteniendo precio de zona y accesibilidad — el agente Terreno arranca al terminar"
                />
              )}

              {pipe.terreno.status === 'running' && (
                <RunningCard label="Agente Terreno analizando…" hint="Buscando comparables, clasificando banda, aplicando factores de ajuste" />
              )}

              {pipe.terreno.status === 'error' && (
                <ErrorCard label="Agente Terreno" onRetry={() => runTerreno()} />
              )}

              {pipe.terreno.status === 'done' && pipe.terreno.data && (() => {
                const t = pipe.terreno.data
                const ic = t.bitacoraTerreno?.indiceConfiabilidad
                const vp = t.bitacoraTerreno?.validacionPrecioSolicitado
                const m2efectivo = pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2
                return (
                  <DoneCard>
                    <div className="px-5 py-4 border-b border-[#F0F4F2] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-[13px] font-bold text-[#0F6E56]">Agente Terreno</span>
                        <span className="text-[11px] text-[#9aab9f]">Banda {t.bitacoraTerreno?.bandaTerreno} · {t.bitacoraTerreno?.nombreBanda}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SemaforoChip sem={ic?.semaforo} />
                        <button onClick={() => runTerreno()}
                          className="text-[11px] text-[#9aab9f] hover:text-[#1D9E75] transition-colors cursor-pointer">
                          Re-correr
                        </button>
                      </div>
                    </div>

                    <div className="px-5 py-4 grid grid-cols-2 gap-3">
                      <EditableM2
                        label="Precio / m² terreno"
                        value={t.costoTerrenoM2}
                        override={pipe.terreno.overrideM2}
                        onOverride={v => setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: v } }))}
                      />
                      <div className="bg-[#F7F8F6] rounded-xl px-4 py-3">
                        <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide font-semibold">Costo total terreno</p>
                        <p className="text-[17px] font-bold text-[#111d17] mt-0.5">
                          {fmt(m2efectivo * Number(formData?.superficie || 0))}
                        </p>
                        <p className="text-[10px] text-[#9aab9f]">{Number(formData?.superficie || 0).toLocaleString()} m²</p>
                      </div>
                    </div>

                    {/* ── Bitácora del cálculo ── */}
                    {t.bitacoraTerreno && (
                      <div className="border-t border-[#F0F4F2] px-5 py-4 flex flex-col gap-4">
                        <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest">Bitácora del cálculo</p>

                        {/* Banda + justificación */}
                        <div className="bg-[#F7F8F6] rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-white bg-[#1D9E75] px-2 py-0.5 rounded-full">
                              Banda {t.bitacoraTerreno.bandaTerreno}
                            </span>
                            <span className="text-[11px] font-semibold text-[#111d17]">{t.bitacoraTerreno.nombreBanda}</span>
                          </div>
                          <p className="text-[11px] text-[#5a7065] leading-snug">{t.bitacoraTerreno.justificacionBanda}</p>
                          <p className="text-[10px] text-[#9aab9f] mt-1.5 font-medium">
                            Precio base referencia: <span className="text-[#111d17]">${t.bitacoraTerreno.precioM2Referencia?.toLocaleString('es-MX')}/m²</span>
                            {t.bitacoraTerreno.fuenteReferencia ? ` · ${t.bitacoraTerreno.fuenteReferencia}` : ''}
                          </p>
                        </div>

                        {/* Ajustes aplicados */}
                        {t.bitacoraTerreno.ajustes?.length > 0 && (
                          <div className="rounded-xl border border-[#E2E8E4] overflow-hidden">
                            <div className="px-4 py-2 bg-[#F7F8F6] border-b border-[#E2E8E4]">
                              <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide">Factores aplicados</p>
                            </div>
                            {t.bitacoraTerreno.ajustes.map((a: any, i: number) => (
                              <div key={i} className="px-4 py-2.5 border-b border-[#F0F4F2] last:border-0 flex items-start justify-between gap-3 bg-white">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-[#111d17] leading-tight">{a.concepto}</p>
                                  <p className="text-[10px] text-[#9aab9f] mt-0.5 leading-snug">{a.descripcion}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-[12px] font-bold ${String(a.factorAjuste).startsWith('+') ? 'text-[#0F6E56]' : 'text-[#DC2626]'}`}>
                                    {a.factorAjuste}
                                  </p>
                                  <p className="text-[10px] text-[#9aab9f]">
                                    {a.impactoM2 > 0 ? '+' : ''}{Number(a.impactoM2).toLocaleString('es-MX')}/m²
                                  </p>
                                </div>
                              </div>
                            ))}
                            <div className="px-4 py-3 bg-[#F0FBF6] flex items-center justify-between">
                              <p className="text-[11px] font-bold text-[#0F6E56]">Precio final ajustado</p>
                              <p className="text-[15px] font-black text-[#0F6E56]">
                                ${t.bitacoraTerreno.precioM2Final?.toLocaleString('es-MX')}/m²
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Rango de valoración */}
                        {t.bitacoraTerreno.rangoValoracion && (
                          <div>
                            <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide mb-2">Rango de negociación</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[#F7F8F6] rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] text-[#9aab9f] uppercase tracking-wide">Mínimo</p>
                                <p className="text-[13px] font-bold text-[#111d17]">${t.bitacoraTerreno.rangoValoracion.minimo?.toLocaleString()}/m²</p>
                              </div>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 8h8M9 5l3 3-3 3" stroke="#D0DDD5" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              <div className="flex-1 bg-[#1D9E75] rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] text-white/70 uppercase tracking-wide">Calculado</p>
                                <p className="text-[13px] font-bold text-white">${t.bitacoraTerreno.precioM2Final?.toLocaleString()}/m²</p>
                              </div>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 8h8M9 5l3 3-3 3" stroke="#D0DDD5" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              <div className="flex-1 bg-[#F7F8F6] rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] text-[#9aab9f] uppercase tracking-wide">Máximo</p>
                                <p className="text-[13px] font-bold text-[#111d17]">${t.bitacoraTerreno.rangoValoracion.maximo?.toLocaleString()}/m²</p>
                              </div>
                            </div>
                            {t.bitacoraTerreno.rangoValoracion.interpretacion && (
                              <p className="text-[10px] text-[#9aab9f] mt-1.5 leading-snug">{t.bitacoraTerreno.rangoValoracion.interpretacion}</p>
                            )}
                          </div>
                        )}

                        {/* Comparables */}
                        {t.bitacoraTerreno.fuentesComparables?.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide mb-2">
                              Comparables encontrados ({t.bitacoraTerreno.fuentesComparables.length})
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {t.bitacoraTerreno.fuentesComparables.map((c: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-[#F7F8F6] rounded-xl px-4 py-2.5">
                                  <div>
                                    <p className="text-[11px] font-semibold text-[#111d17]">{c.colonia}</p>
                                    <p className="text-[10px] text-[#9aab9f]">
                                      {c.portal} · {c.superficie?.toLocaleString()} m² · {c.distanciaKm} km · {c.fechaPublicacion}
                                    </p>
                                  </div>
                                  <p className="text-[13px] font-bold text-[#111d17] shrink-0">
                                    ${c.precioM2?.toLocaleString()}/m²
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#9aab9f] italic">
                            Sin comparables directos encontrados — precio estimado por método paramétrico de banda.
                          </p>
                        )}
                      </div>
                    )}

                    {ic && (
                      <div className="border-t border-[#F0F4F2] px-5 py-3">
                        <p className="text-[11px] text-[#9aab9f] leading-snug">{ic.interpretacion}</p>
                        {ic.accionRecomendada && (
                          <p className="text-[11px] text-[#D97706] mt-1 font-medium">→ {ic.accionRecomendada}</p>
                        )}
                      </div>
                    )}

                    {vp?.aplica && (
                      <div className={`mx-5 mb-4 px-4 py-2.5 rounded-xl border text-[11px] font-medium ${
                        vp.semaforo === 'VERDE' ? 'bg-[#E1F5EE] border-[#9FE1CB] text-[#0F6E56]' :
                        vp.semaforo === 'ROJO'  ? 'bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]' :
                        'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]'
                      }`}>
                        {vp.interpretacion}
                      </div>
                    )}

                    <AgentChat agentKey="terreno" agentData={pipe.terreno.data} />

                    {pipe.construccion.status === 'waiting' && (
                      <div className="px-5 pb-5">
                        <button
                          onClick={runConstruccion}
                          className="w-full bg-[#1D9E75] text-white rounded-xl py-3 text-[13px] font-semibold hover:bg-[#0F6E56] transition-colors cursor-pointer flex items-center justify-center gap-2"
                        >
                          Aprobar y continuar con Construcción
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                        {pipe.terreno.overrideM2 !== '' && (
                          <p className="text-[10px] text-[#9aab9f] text-center mt-2">
                            Se usará tu valor corregido: ${Number(pipe.terreno.overrideM2).toLocaleString()}/m²
                          </p>
                        )}
                      </div>
                    )}
                  </DoneCard>
                )
              })()}
            </section>

            {/* ══ UBICACIÓN ══ */}
            {pipe.ubicacion.status !== 'waiting' && (
              <section>
                <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest mb-3">Inteligencia de Ubicación</p>

                {pipe.ubicacion.status === 'running' && (
                  <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-5 flex items-center gap-4">
                    <Spinner size={22} />
                    <p className="text-[13px] font-medium text-[#111d17]">Calculando isócronas y precio de suelo…</p>
                  </div>
                )}

                {pipe.ubicacion.status === 'done' && pipe.ubicacion.data && (() => {
                  const { isocronas } = pipe.ubicacion.data
                  if (isocronas.length === 0) return null
                  return (
                    <div className="bg-white rounded-2xl border border-[#9FE1CB] shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#F0F4F2] flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-[13px] font-bold text-[#0F6E56]">Accesibilidad</span>
                        <span className="text-[11px] text-[#9aab9f]">Población alcanzable en auto</span>
                      </div>
                      <div className="px-5 py-4 flex gap-2">
                        {isocronas.map(iso => (
                          <div key={iso.rango_min} className="flex-1 bg-[#F7F8F6] rounded-xl px-3 py-3 text-center">
                            <p className="text-[10px] text-[#9aab9f] font-semibold">{iso.rango_min} min</p>
                            <p className="text-[15px] font-black text-[#111d17] mt-0.5">
                              {iso.poblacion_alcanzada != null
                                ? iso.poblacion_alcanzada >= 1_000_000
                                  ? `${(iso.poblacion_alcanzada / 1_000_000).toFixed(1)}M`
                                  : iso.poblacion_alcanzada >= 1_000
                                    ? `${(iso.poblacion_alcanzada / 1_000).toFixed(0)}k`
                                    : iso.poblacion_alcanzada.toLocaleString()
                                : '—'}
                            </p>
                            <p className="text-[9px] text-[#9aab9f]">hab.</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </section>
            )}

            {/* ══ STEP 2 — CONSTRUCCIÓN ══ */}
            {(pipe.construccion.status !== 'waiting') && (
              <section>
                <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest mb-3">Paso 2 · Agente de Construcción</p>

                {pipe.construccion.status === 'running' && (
                  <RunningCard label="Agente Construcción analizando…" hint="Consultando índices CMIC, calculando partidas y materiales principales" />
                )}

                {pipe.construccion.status === 'error' && (
                  <ErrorCard label="Agente Construcción" onRetry={runConstruccion} />
                )}

                {pipe.construccion.status === 'done' && pipe.construccion.data && (() => {
                  const c = pipe.construccion.data
                  const ic = c.bitacoraConstruccion?.indiceConfiabilidad
                  const desglose = c.bitacoraConstruccion?.desgloseConstruccion
                  const m2efectivo = pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2
                  const totalCons = c.costoTotalConstruccion || m2efectivo * (c.superficieConstruida || 0)
                  return (
                    <DoneCard>
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-[#F0F4F2] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckIcon />
                          <span className="text-[13px] font-bold text-[#0F6E56]">Agente Construcción</span>
                          <span className="text-[11px] text-[#9aab9f]">Banda {c.bitacoraConstruccion?.bandaElegida} · {c.superficieConstruida?.toLocaleString()} m² brutos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SemaforoChip sem={ic?.semaforo} />
                          <button onClick={runConstruccion}
                            className="text-[11px] text-[#9aab9f] hover:text-[#1D9E75] transition-colors cursor-pointer">
                            Re-correr
                          </button>
                        </div>
                      </div>

                      {/* COS / CUS / Área verde resumen */}
                      {desglose && (
                        <div className="px-5 pt-4 pb-2 grid grid-cols-4 gap-2">
                          {[
                            { label: 'COS', val: desglose.cosEstimado, hint: 'Huella máxima' },
                            { label: 'CUS', val: desglose.cusEstimado, hint: 'Superficie total' },
                            { label: 'Eficiencia', val: desglose.eficiencia, hint: 'Área vendible / total' },
                            { label: 'Área libre', val: `${desglose.areaVerdeYLibre?.m2?.toLocaleString()} m²`, hint: desglose.areaVerdeYLibre?.porcentajeLote + ' del lote' },
                          ].map(item => (
                            <div key={item.label} className="bg-[#F7F8F6] rounded-xl px-3 py-2.5 text-center">
                              <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide font-semibold">{item.label}</p>
                              <p className="text-[15px] font-bold text-[#111d17] mt-0.5">{item.val}</p>
                              <p className="text-[9px] text-[#c0cdc7] mt-0.5 leading-tight">{item.hint}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Zona breakdown table */}
                      {desglose?.zonas && desglose.zonas.length > 0 && (
                        <div className="px-5 pb-3">
                          <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest mb-2">Desglose por zona</p>
                          <div className="rounded-xl border border-[#E2E8E4] overflow-hidden">
                            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] bg-[#F0F4F2] px-3 py-1.5">
                              {['Zona', 'm²', 'Costo/m²', 'Total'].map(h => (
                                <span key={h} className="text-[9px] font-bold text-[#9aab9f] uppercase tracking-wider">{h}</span>
                              ))}
                            </div>
                            {desglose.zonas.map((z: any, i: number) => (
                              <div key={i} className={`grid grid-cols-[2fr_1fr_1fr_1fr] px-3 py-2 ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFA]'} border-t border-[#F0F4F2]`}>
                                <div>
                                  <p className="text-[11px] font-semibold text-[#111d17]">{z.zona}</p>
                                  <p className="text-[9px] text-[#9aab9f] leading-tight">{z.concepto}</p>
                                </div>
                                <span className="text-[11px] text-[#5a7065] self-center">{z.m2?.toLocaleString()} m²</span>
                                <div className="self-center">
                                  <span className="text-[11px] text-[#5a7065]">${z.costoM2?.toLocaleString()}</span>
                                  <span className="text-[9px] text-[#c0cdc7] block">{z.factorRespectoBanda}</span>
                                </div>
                                <span className="text-[11px] font-semibold text-[#111d17] self-center">{fmt(z.costoTotal)}</span>
                              </div>
                            ))}
                            {desglose.areaVerdeYLibre?.costoUrbanizacion > 0 && (
                              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] px-3 py-2 bg-[#F0FBF6] border-t border-[#E2E8E4]">
                                <div>
                                  <p className="text-[11px] font-semibold text-[#0F6E56]">Área verde / urbanización</p>
                                  <p className="text-[9px] text-[#9aab9f] leading-tight">{desglose.areaVerdeYLibre.descripcion?.split(':')[0]}</p>
                                </div>
                                <span className="text-[11px] text-[#5a7065] self-center">{desglose.areaVerdeYLibre.m2?.toLocaleString()} m²</span>
                                <span className="text-[11px] text-[#5a7065] self-center">${desglose.areaVerdeYLibre.costoUrbanizacionM2?.toLocaleString()}</span>
                                <span className="text-[11px] font-semibold text-[#0F6E56] self-center">{fmt(desglose.areaVerdeYLibre.costoUrbanizacion)}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-[9px] text-[#c0cdc7] mt-1.5">Área vendible: {c.superficieVendible?.toLocaleString() || desglose.zonas[0]?.m2?.toLocaleString()} m² · Eficiencia {desglose.eficiencia}</p>
                        </div>
                      )}

                      {/* Costo ponderado + total */}
                      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                        <EditableM2
                          label="Costo ponderado / m²"
                          value={c.construccionM2}
                          override={pipe.construccion.overrideM2}
                          onOverride={v => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: v } }))}
                        />
                        <div className="bg-[#F7F8F6] rounded-xl px-4 py-3">
                          <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide font-semibold">Costo total directo</p>
                          <p className="text-[17px] font-bold text-[#111d17] mt-0.5">{fmt(totalCons)}</p>
                          <p className="text-[10px] text-[#9aab9f]">Suma ponderada por zona</p>
                        </div>
                      </div>

                      {ic && (
                        <div className="px-5 pb-3">
                          <p className="text-[11px] text-[#9aab9f] leading-snug">{ic.interpretacion}</p>
                          {ic.accionRecomendada && (
                            <p className="text-[11px] text-[#D97706] mt-1 font-medium">→ {ic.accionRecomendada}</p>
                          )}
                        </div>
                      )}

                      <AgentChat agentKey="construccion" agentData={pipe.construccion.data} />

                      {(pipe.legal.status === 'waiting' && pipe.mercado.status === 'waiting') && (
                        <div className="px-5 pb-5">
                          <button
                            onClick={runLegalMercado}
                            className="w-full bg-[#1D9E75] text-white rounded-xl py-3 text-[13px] font-semibold hover:bg-[#0F6E56] transition-colors cursor-pointer flex items-center justify-center gap-2"
                          >
                            Aprobar y continuar con Legal + Mercado
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                          {pipe.construccion.overrideM2 !== '' && (
                            <p className="text-[10px] text-[#9aab9f] text-center mt-2">
                              Se usará tu valor corregido: ${Number(pipe.construccion.overrideM2).toLocaleString()}/m²
                            </p>
                          )}
                        </div>
                      )}
                    </DoneCard>
                  )
                })()}
              </section>
            )}

            {/* ══ STEP 3 — LEGAL + MERCADO ══ */}
            {(pipe.legal.status !== 'waiting' || pipe.mercado.status !== 'waiting') && (
              <section>
                <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest mb-3">Paso 3 · Legal + Mercado (paralelo)</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Legal */}
                  <div>
                    {pipe.legal.status === 'running' && (
                      <RunningCard label="Agente Legal…" hint="Verificando PDU, uso de suelo, factibilidades" />
                    )}
                    {pipe.legal.status === 'error' && (
                      <ErrorCard label="Agente Legal" onRetry={runLegal} />
                    )}
                    {pipe.legal.status === 'done' && pipe.legal.data && (() => {
                      const fl = pipe.legal.data.fichaLegal
                      return (
                        <DoneCard>
                          <div className="px-4 py-3 border-b border-[#F0F4F2] flex items-center gap-2">
                            <CheckIcon />
                            <span className="text-[12px] font-bold text-[#0F6E56]">Agente Legal</span>
                            <button onClick={runLegal} className="ml-auto text-[10px] text-[#9aab9f] hover:text-[#1D9E75] cursor-pointer">Re-correr</button>
                          </div>
                          <div className="px-4 py-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">Uso de suelo</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fl?.compatible ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                                {fl?.compatible ? 'Compatible' : 'Requiere cambio'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">Nivel de riesgo</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                fl?.nivelRiesgo === 'Bajo' ? 'bg-[#E1F5EE] text-[#0F6E56]' :
                                fl?.nivelRiesgo === 'Medio' ? 'bg-[#FEF3C7] text-[#92400E]' :
                                'bg-[#FEE2E2] text-[#991B1B]'
                              }`}>{fl?.nivelRiesgo || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">COS / CUS</span>
                              <span className="text-[11px] font-semibold text-[#111d17]">{fl?.cos} / {fl?.cus}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">Alertas</span>
                              <span className="text-[11px] font-semibold text-[#111d17]">{fl?.alertasLegales?.length || 0} alerta(s)</span>
                            </div>
                          </div>
                          <AgentChat agentKey="legal" agentData={pipe.legal.data} />
                        </DoneCard>
                      )
                    })()}
                  </div>

                  {/* Mercado */}
                  <div>
                    {pipe.mercado.status === 'running' && (
                      <RunningCard label="Agente Mercado…" hint="Buscando comparables, analizando absorción y pricing" />
                    )}
                    {pipe.mercado.status === 'error' && (
                      <ErrorCard label="Agente Mercado" onRetry={runMercado} />
                    )}
                    {pipe.mercado.status === 'done' && pipe.mercado.data && (() => {
                      const m = pipe.mercado.data.mercado
                      return (
                        <DoneCard>
                          <div className="px-4 py-3 border-b border-[#F0F4F2] flex items-center gap-2">
                            <CheckIcon />
                            <span className="text-[12px] font-bold text-[#0F6E56]">Agente Mercado</span>
                            <button onClick={runMercado} className="ml-auto text-[10px] text-[#9aab9f] hover:text-[#1D9E75] cursor-pointer">Re-correr</button>
                          </div>
                          <div className="px-4 py-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">Precio/m² zona</span>
                              <span className="text-[11px] font-bold text-[#111d17]">{m?.precioPromedioZona || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">Absorción</span>
                              <span className="text-[11px] font-semibold text-[#111d17]">{m?.absorcion || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">Demanda</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                m?.demanda === 'Alta' ? 'bg-[#E1F5EE] text-[#0F6E56]' :
                                m?.demanda === 'Media' ? 'bg-[#FEF3C7] text-[#92400E]' :
                                'bg-[#FEE2E2] text-[#991B1B]'
                              }`}>{m?.demanda || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5a7065]">Plusvalía</span>
                              <span className="text-[11px] font-semibold text-[#0F6E56]">{m?.plusvalia || '—'}</span>
                            </div>
                          </div>
                          <AgentChat agentKey="mercado" agentData={pipe.mercado.data} />
                        </DoneCard>
                      )
                    })()}
                  </div>
                </div>

                {/* Approve step 3 */}
                {legalMercadoBothDone && pipe.financiero.status === 'waiting' && (
                  <button
                    onClick={runFinanciero}
                    className="w-full mt-4 bg-[#1D9E75] text-white rounded-xl py-3 text-[13px] font-semibold hover:bg-[#0F6E56] transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    Aprobar y generar Análisis Financiero
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
                {legalMercadoBothError && (
                  <p className="text-[11px] text-[#DC2626] text-center mt-3">Ambos agentes fallaron — re-intenta cada uno por separado.</p>
                )}
              </section>
            )}

            {/* ══ STEP 4 — FINANCIERO ══ */}
            {pipe.financiero.status !== 'waiting' && (
              <section>
                <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-widest mb-3">Paso 4 · Agente Financiero</p>

                {pipe.financiero.status === 'running' && (
                  <RunningCard label="Agente Financiero modelando…" hint="Calculando TIR, flujo de caja, stress test y score de resiliencia" />
                )}

                {pipe.financiero.status === 'error' && (
                  <ErrorCard label="Agente Financiero" onRetry={runFinanciero} />
                )}

                {pipe.financiero.status === 'done' && pipe.financiero.data && (() => {
                  const f = pipe.financiero.data.financiero
                  return (
                    <DoneCard>
                      <div className="px-5 py-4 border-b border-[#F0F4F2] flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-[13px] font-bold text-[#0F6E56]">Análisis completo</span>
                      </div>
                      <div className="px-5 py-4 grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide">TIR</p>
                          <p className="text-[22px] font-black text-[#1D9E75]">{f?.tir}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide">Margen</p>
                          <p className="text-[22px] font-black text-[#111d17]">{f?.margenBruto}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide">Inversión</p>
                          <p className="text-[22px] font-black text-[#111d17]">{fmt(f?.inversionTotal || 0)}</p>
                        </div>
                      </div>
                      <div className="px-5 pb-5">
                        <div className="bg-[#F0FBF6] border border-[#1D9E75]/30 rounded-xl px-4 py-3 text-center">
                          <p className="text-[12px] text-[#5a9078]">Redirigiendo al reporte completo…</p>
                          <Spinner color="#1D9E75" size={20} />
                        </div>
                      </div>
                    </DoneCard>
                  )
                })()}
              </section>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}

export default function AnalizandoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f]">Iniciando pipeline…</p>
      </div>
    }>
      <PipelineContent />
    </Suspense>
  )
}
