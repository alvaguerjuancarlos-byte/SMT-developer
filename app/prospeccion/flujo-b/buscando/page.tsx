'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveProyecto } from '@/lib/saveProyecto'
import { authedFetch } from '@/lib/apiClient'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

// Look & feel — espejo azul del navy/oro de Flujo A (ver app/prospeccion/flujo-a/page.tsx).
// Los colores verde/azul/morado de Scout·Legal·Mercado son un código de identidad de agente
// (no de marca) y se preservan tal cual para no perder esa distinción visual entre los 3.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return
    if ((window as any).google?.maps) { resolve(); return }
    const existing = document.getElementById('gmap-script')
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''
    const script = document.createElement('script')
    script.id = 'gmap-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true; script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Error cargando Google Maps'))
    document.head.appendChild(script)
  })
}

interface CandidateLegal {
  usoSuelo: string; cos: string; cus: string; altura: string; cajones: string; restriccion: string; municipio: string
}
interface CandidateMercado {
  label: string; precioZona: string; absorcion: string; competencia: string; perfilNSE: string; plusvalia: string; producto: string
}
interface Candidate {
  id: number; nombre: string; zona: string; ubicacion?: string; lat: number; lng: number
  precio: string; superficie: string; preciom2: string; uso: string; mercadoColor: string
  legal: CandidateLegal; mercado: CandidateMercado
}

type Stage = 1 | 2 | 3 | 4

function AgentSpinner({ color = '#5B8FD4' }: { color?: string }) {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function BigSpinner({ color, glow, size = 96 }: { color: string; glow: string; size?: number }) {
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
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#5B8FD4] inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )
}

function AgentBadge({ label, status, color }: { label: string; status: 'waiting' | 'running' | 'done'; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-500 ${
      status === 'done' ? 'bg-[#1D9E75]/10 border-[#1D9E75]/40 text-[#5FD4A8]'
      : status === 'running' ? 'bg-[#132a4d] border-[#2a3f5c] text-[#f4f0e6] shadow-sm'
      : 'bg-[#0e2038] border-[#2a3f5c] text-[#5f6a80]'
    }`} style={{ fontFamily: 'var(--font-plex-mono)' }}>
      {status === 'done' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : status === 'running' ? (
        <AgentSpinner color={color} />
      ) : (
        <span className="w-3 h-3 rounded-full border border-[#3a4d6b]" />
      )}
      {label}
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: color }} />
}

function LegalSheet({ legal }: { legal: CandidateLegal }) {
  return (
    <div className="px-5 pb-4 border-b border-[#2a3f5c]">
      <p className="text-[10px] font-bold text-[#378ADD] tracking-[0.12em] uppercase mb-2 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-plex-mono)' }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Ficha normativa · Agente Legal
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {[
          { label: 'Uso de suelo', value: legal.usoSuelo },
          { label: 'COS / CUS', value: `${legal.cos} / ${legal.cus}` },
          { label: 'Altura máx', value: legal.altura },
          { label: 'Cajones', value: legal.cajones },
          { label: 'Municipio', value: legal.municipio },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Dot color="#378ADD" />
            <span className="text-[11px] text-[#8b96ab]">{label}: <span className="font-semibold text-[#f4f0e6]">{value}</span></span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-start gap-1.5 bg-[#1c304b] border border-[#c9a227]/40 rounded-lg px-2.5 py-1.5">
        <Dot color="#ddc06a" />
        <span className="text-[11px] text-[#ddc06a]">{legal.restriccion}</span>
      </div>
    </div>
  )
}

const CANDIDATE_COLORS: Record<string, string> = { green: '#1D9E75', blue: '#378ADD', purple: '#8B5CF6' }

function MarketSheet({ mercado, color }: { mercado: CandidateMercado; color: string }) {
  const headerColors: Record<string, string> = { green: 'text-[#5FD4A8]', blue: 'text-[#185FA5]', purple: 'text-[#B79CF0]' }
  const dotColor = CANDIDATE_COLORS[color] ?? '#1D9E75'
  return (
    <div className="px-5 pb-4">
      <p className={`text-[10px] font-bold tracking-[0.12em] uppercase mb-2 flex items-center gap-1.5 ${headerColors[color]}`} style={{ fontFamily: 'var(--font-plex-mono)' }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M1 9l3-4 2.5 2 3-5" stroke={dotColor} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Reporte de mercado · Agente Mercado
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-2">
        {[
          { label: 'Precio zona', value: mercado.precioZona },
          { label: 'Absorción', value: mercado.absorcion },
          { label: 'Competencia', value: mercado.competencia },
          { label: 'Perfil', value: mercado.perfilNSE },
          { label: 'Plusvalía', value: mercado.plusvalia },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Dot color={dotColor} />
            <span className="text-[11px] text-[#8b96ab]">{label}: <span className="font-semibold text-[#f4f0e6]">{value}</span></span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-1.5 bg-[#5B8FD4]/10 border border-[#5B8FD4]/40 rounded-lg px-2.5 py-1.5">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="mt-0.5 shrink-0">
          <path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4z" stroke="#5B8FD4" strokeWidth="1" fill="#5B8FD4" fillOpacity="0.15"/>
        </svg>
        <span className="text-[11px] text-[#8FB6E8] font-medium">Producto recomendado: {mercado.producto}</span>
      </div>
    </div>
  )
}

function CandidateCard({ c, stage, index, highlighted }: { c: Candidate; stage: Stage; index: number; highlighted: boolean }) {
  const visible = stage >= 2
  const legalDone = stage >= 3
  const marketDone = stage >= 4
  return (
    <div
      id={`candidate-${c.id}`}
      className={`bg-[#132a4d] rounded-2xl border shadow-sm overflow-hidden transition-all duration-500 ${
        highlighted ? 'border-[#5B8FD4] shadow-[0_0_0_2px_#5B8FD4]' : 'border-[#2a3f5c]'
      }`}
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', transitionDelay: `${index * 100}ms` }}
    >
      <div className="px-5 py-4 border-b border-[#2a3f5c] flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-[#5f6a80] tracking-[0.12em] uppercase" style={{ fontFamily: 'var(--font-plex-mono)' }}>Candidato #{c.id}</span>
          <h3 className="text-[15px] font-semibold text-[#f4f0e6] mt-0.5">{c.nombre}</h3>
          <p className="text-[12px] text-[#5f6a80]">{c.zona}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold text-[#f4f0e6]">{c.precio}</p>
          <p className="text-[11px] text-[#5f6a80]">MXN</p>
        </div>
      </div>
      <div className="px-5 py-3 flex gap-4 border-b border-[#2a3f5c]">
        <div><p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Superficie</p><p className="text-[13px] font-semibold text-[#f4f0e6]">{c.superficie}</p></div>
        <div><p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Precio / m²</p><p className="text-[13px] font-semibold text-[#f4f0e6]">{c.preciom2}</p></div>
        <div><p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Uso de suelo</p><p className="text-[13px] font-semibold text-[#f4f0e6]">{c.uso}</p></div>
      </div>
      {!legalDone && (
        <div className="px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-[#0e2038] text-[#5f6a80] border-[#2a3f5c]">
              <span className="w-2 h-2 rounded-full border border-[#3a4d6b]" />Normativa: verificando…
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-[#0e2038] text-[#5f6a80] border-[#2a3f5c]">
              <span className="w-2 h-2 rounded-full border border-[#3a4d6b]" />Mercado: pendiente
            </div>
          </div>
        </div>
      )}
      {legalDone && <LegalSheet legal={c.legal} />}
      {marketDone && <MarketSheet mercado={c.mercado} color={c.mercadoColor} />}
    </div>
  )
}

function AgentStatusBar({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center mb-6">
      <AgentBadge label="Scout IA" status={stage === 1 ? 'running' : 'done'} color="#1D9E75" />
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#3a4d6b]">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      <AgentBadge label="Agente Legal" status={stage < 2 ? 'waiting' : stage === 2 ? 'running' : 'done'} color="#378ADD" />
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#3a4d6b]">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      <AgentBadge label="Agente de Mercado" status={stage < 3 ? 'waiting' : stage === 3 ? 'running' : 'done'} color="#8B5CF6" />
    </div>
  )
}

const MAPA_CENTRO = { lat: 25.690, lng: -100.348 }

function pinIcon(num: number, color: string, highlighted: boolean): google.maps.Icon {
  const w = highlighted ? 38 : 30
  const h = highlighted ? 48 : 38
  const stroke = highlighted ? ` stroke="white" stroke-width="2"` : ''
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 30 38">` +
    `<path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 23 15 23S30 25.5 30 15C30 6.716 23.284 0 15 0z" fill="${color}"${stroke}/>` +
    `<text x="15" y="19" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="12" font-weight="bold" font-family="sans-serif">${num}</text>` +
    `</svg>`
  )
  return { url: `data:image/svg+xml,${svg}`, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(w / 2, h) }
}

function CandidatesMap({ candidates, highlightedId, onPinClick }: { candidates: Candidate[]; highlightedId: number | null; onPinClick: (id: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const callbackRef = useRef(onPinClick)
  const [ready, setReady] = useState(false)

  useEffect(() => { callbackRef.current = onPinClick }, [onPinClick])
  useEffect(() => { loadGoogleMaps().then(() => setReady(true)).catch(console.error) }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const center = candidates[0] ? { lat: candidates[0].lat, lng: candidates[0].lng } : MAPA_CENTRO
    mapObj.current = new google.maps.Map(mapRef.current, {
      center, zoom: 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] }],
    })
    markersRef.current = candidates.map(c => {
      const color = CANDIDATE_COLORS[c.mercadoColor] ?? '#1D9E75'
      const marker = new google.maps.Marker({ position: { lat: c.lat, lng: c.lng }, map: mapObj.current!, icon: pinIcon(c.id, color, false), title: c.nombre })
      marker.addListener('click', () => callbackRef.current(c.id))
      return marker
    })
  }, [ready])

  useEffect(() => {
    if (!markersRef.current.length) return
    markersRef.current.forEach((marker, i) => {
      const c = candidates[i]
      const color = CANDIDATE_COLORS[c.mercadoColor] ?? '#1D9E75'
      marker.setIcon(pinIcon(c.id, color, c.id === highlightedId))
      marker.setZIndex(c.id === highlightedId ? 100 : 1)
    })
  }, [highlightedId, candidates])

  if (!ready) return <div className="w-full rounded-2xl border border-[#2a3f5c] bg-[#0e2038] flex items-center justify-center mb-4" style={{ height: 320 }}><p className="text-[13px] text-[#5f6a80]">Cargando mapa…</p></div>

  return <div ref={mapRef} className="w-full rounded-2xl overflow-hidden border border-[#2a3f5c] shadow-sm mb-4" style={{ height: 320 }} />
}

function BuscandoContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || ''
  const [stage, setStage] = useState<Stage>(1)
  const [statusText, setStatusText] = useState('Agente Scout buscando terrenos...')
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const formDataRaw = localStorage.getItem('smt_flujo_b_data')
    if (!formDataRaw) {
      router.push('/prospeccion/flujo-b')
      return
    }
    const formData = JSON.parse(formDataRaw)

    const t1 = setTimeout(() => {
      setStage(2)
      setStatusText('Agente Legal verificando uso de suelo y normativa...')
    }, 3000)

    authedFetch('/api/scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then(res => { if (!res.ok) throw new Error('API error'); return res.json() })
      .then(async data => {
        if (data.error) throw new Error(data.error)
        const cands: Candidate[] = data.candidatos
        const scoutPayload = { candidatos: cands, recomendacion: data.recomendacion, fuentes: data.fuentes }
        localStorage.setItem('smt_scout_data', JSON.stringify({ ...scoutPayload, proyecto }))
        setCandidates(cands)
        setStage(3)
        setStatusText('Agente de Mercado analizando demanda y competencia...')

        if (proyecto) {
          saveProyecto({ nombre: proyecto, datos: scoutPayload, flujo: 'B' }).then(r => {
            if (r.ok && r.id) {
              localStorage.setItem('smt_proyecto_id', r.id)
            } else {
              console.error('[BuscandoPage] saveProyecto failed:', r.error)
              setSaveError(r.error || 'Error desconocido al guardar')
            }
          })
        } else {
          console.warn('[BuscandoPage] proyecto vacío — no se guardará en Mis Proyectos')
        }

        setTimeout(() => {
          setStage(4)
          setStatusText('Análisis completado — 3 candidatos encontrados')
        }, 4000)
      })
      .catch(err => {
        console.error(err)
        setError('No se pudo completar la búsqueda. Verifica tu API key en .env.local')
      })

    return () => clearTimeout(t1)
  }, [])

  const progressPct = stage === 1 ? 15 : stage === 2 ? 45 : stage === 3 ? 75 : 100

  return (
    <div
      className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex flex-col`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    >
      <header className="sticky top-0 z-20 px-8 py-5 flex items-center gap-3 border-b border-white/10 bg-[#070f22]">
        <div className="w-8 h-8 rounded-lg bg-[#5B8FD4] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#f4f0e6" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#f4f0e6" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] tracking-wide" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 500, color: '#f4f0e6' }}>
            SMT <em style={{ fontStyle: 'normal', color: '#8FB6E8' }}>Developer</em>
          </span>
          <span className="block text-[10px] text-[#8b96ab] tracking-[0.12em] uppercase" style={{ fontFamily: 'var(--font-plex-mono)' }}>Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-[#5f6a80]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
          <span className="text-[#8FB6E8] font-medium">Flujo B</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Scout IA — Análisis en progreso</span>
        </div>
      </header>

      <div className="h-1 bg-[#2a3f5c]">
        <div className="h-full bg-[#5B8FD4] transition-all duration-700 ease-in-out" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-[680px] mx-auto">

          {error ? (
            <div className="bg-red-950/40 border border-red-900 rounded-2xl p-6 text-center">
              <p className="text-[15px] font-bold text-red-400 mb-2">Error en el Scout IA</p>
              <p className="text-[13px] text-red-300 mb-4">{error}</p>
              <button onClick={() => router.push('/prospeccion/flujo-b')} className="text-[13px] text-[#8FB6E8] hover:underline">
                Volver al formulario
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 mb-3">
                  {stage < 4 ? (
                    <><AgentSpinner color="#5B8FD4" /><span className="text-[14px] font-medium text-[#f4f0e6]">{statusText}</span><PulsingDots /></>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="8" fill="#132a4d" stroke="#5B8FD4" strokeWidth="1.5"/>
                        <path d="M5 9l3 3 5-5" stroke="#5B8FD4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[14px] font-medium text-[#8FB6E8]">{statusText}</span>
                    </>
                  )}
                </div>
                <AgentStatusBar stage={stage} />
              </div>

              {stage === 1 && (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  <BigSpinner color="#1D9E75" glow="#1D9E75" size={120} />
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-[#f4f0e6] mb-1">Escaneando el mercado</p>
                    <p className="text-[13px] text-[#5f6a80]">El Scout está analizando disponibilidad, precios y zonas…</p>
                  </div>
                </div>
              )}

              {stage === 3 && (
                <div className="flex flex-col items-center gap-4 bg-[#132a4d] border border-[#8B5CF6]/30 rounded-2xl px-5 py-8 shadow-sm mb-4">
                  <BigSpinner color="#8B5CF6" glow="#8B5CF6" size={120} />
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#f4f0e6]">Agente de Mercado trabajando</p>
                    <p className="text-[12px] text-[#5f6a80]">Analizando demanda, comparables y tendencias de la zona…</p>
                  </div>
                </div>
              )}

              {stage >= 2 && candidates.length > 0 && (
                <div className="flex flex-col gap-4 mb-4">
                  {candidates.map((c, i) => (
                    <CandidateCard key={c.id} c={c} stage={stage} index={i} highlighted={highlightedId === c.id} />
                  ))}
                </div>
              )}

              {stage === 2 && (
                <div className="flex flex-col items-center gap-4 bg-[#132a4d] border border-[#378ADD]/30 rounded-2xl px-5 py-8 shadow-sm mb-4">
                  <BigSpinner color="#378ADD" glow="#378ADD" size={120} />
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#f4f0e6]">Agente Legal trabajando</p>
                    <p className="text-[12px] text-[#5f6a80]">Verificando uso de suelo, normativa urbana y restricciones…</p>
                  </div>
                </div>
              )}

              {stage === 4 && candidates.length > 0 && (
                <CandidatesMap
                  candidates={candidates}
                  highlightedId={highlightedId}
                  onPinClick={id => {
                    setHighlightedId(id)
                    document.getElementById(`candidate-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                  }}
                />
              )}

              {stage === 4 && (
                <>
                  <div className="bg-[#1c304b] border border-[#5B8FD4]/30 rounded-2xl p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#5B8FD4] flex items-center justify-center mx-auto mb-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#070f22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p className="text-[16px] font-bold text-[#8FB6E8] mb-1">Análisis multi-agente completado</p>
                    <p className="text-[13px] text-[#8b96ab] mb-5">
                      Scout, Legal y Mercado han procesado los 3 candidatos. El reporte completo está listo.
                    </p>
                    <button
                      onClick={() => router.push(`/analisis/flujo-b${proyecto ? `?proyecto=${encodeURIComponent(proyecto)}` : ''}`)}
                      className="inline-flex items-center gap-2 bg-[#5B8FD4] text-[#f4f0e6] px-8 py-3.5 rounded-xl text-[15px] font-semibold hover:bg-[#8FB6E8] transition-colors cursor-pointer"
                      style={{ fontFamily: 'var(--font-plex-mono)' }}
                    >
                      Ver Análisis Completo
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 4l4 4-4 4" stroke="#f4f0e6" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  {saveError && (
                    <div className="mt-3 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
                      <p className="text-[12px] font-semibold text-red-400 mb-0.5">Error al guardar en Mis Proyectos</p>
                      <p className="text-[11px] text-red-300 font-mono break-all">{saveError}</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function BuscandoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b1d3a] flex items-center justify-center"><p className="text-[#5f6a80]">Iniciando Scout…</p></div>}>
      <BuscandoContent />
    </Suspense>
  )
}
