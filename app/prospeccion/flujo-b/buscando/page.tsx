'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Error cargando Google Maps'))
    document.head.appendChild(script)
  })
}

const CANDIDATES = [
  {
    id: 1,
    lat: 25.6505,
    lng: -100.3319,
    nombre: 'Terreno en Valle Oriente',
    precio: '$8,500,000',
    superficie: '1,200 m²',
    pm2: '$7,083/m²',
    zona: 'San Pedro Garza García',
    uso: 'Habitacional Mixto',
    mercadoColor: 'green',
    legal: {
      usoSuelo: 'Habitacional Plurifamiliar',
      cos: '60%',
      cus: '2.4',
      altura: '12 niveles',
      cajones: '1.2 por unidad',
      restriccion: 'Restricción: 5 m frente a vialidad primaria',
      municipio: 'San Pedro Garza García',
    },
    mercado: {
      label: 'Demanda Alta',
      precioZona: '$9,200/m²',
      absorcion: '8 unidades/mes',
      competencia: '4 proyectos en radio 500 m',
      perfilNSE: 'A/B · 28–45 años',
      plusvalia: '+18% últimos 3 años',
      producto: 'Depto. 2–3 rec. de 85–120 m²',
    },
  },
  {
    id: 2,
    lat: 25.7618,
    lng: -100.3661,
    nombre: 'Predio en Cumbres Elite',
    precio: '$5,200,000',
    superficie: '850 m²',
    pm2: '$6,118/m²',
    zona: 'Monterrey Norte',
    uso: 'Comercial / Mixto',
    mercadoColor: 'blue',
    legal: {
      usoSuelo: 'Comercial Barrial / Mixto',
      cos: '70%',
      cus: '2.1',
      altura: '8 niveles',
      cajones: '1.5 por local',
      restriccion: 'Restricción: uso habitacional requiere % mínimo comercial',
      municipio: 'Monterrey',
    },
    mercado: {
      label: 'Mercado Activo',
      precioZona: '$7,800/m²',
      absorcion: '5 unidades/mes',
      competencia: '6 proyectos en radio 500 m',
      perfilNSE: 'B/C+ · 30–50 años',
      plusvalia: '+11% últimos 3 años',
      producto: 'Local comercial PB + deptos. superiores',
    },
  },
  {
    id: 3,
    lat: 25.6447,
    lng: -100.3590,
    nombre: 'Lote en Del Valle',
    precio: '$12,800,000',
    superficie: '2,100 m²',
    pm2: '$6,095/m²',
    zona: 'San Pedro Garza García',
    uso: 'Habitacional',
    mercadoColor: 'purple',
    legal: {
      usoSuelo: 'Habitacional Unifamiliar / Plurifamiliar',
      cos: '55%',
      cus: '3.0',
      altura: '15 niveles',
      cajones: '1.5 por unidad',
      restriccion: 'Restricción: área jardinada mínima 20% del predio',
      municipio: 'San Pedro Garza García',
    },
    mercado: {
      label: 'Alta Plusvalía',
      precioZona: '$11,500/m²',
      absorcion: '6 unidades/mes',
      competencia: '3 proyectos en radio 500 m',
      perfilNSE: 'A · 32–55 años',
      plusvalia: '+26% últimos 3 años',
      producto: 'Torre residencial premium 100–160 m²',
    },
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

function Dot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: color }} />
}

function LegalSheet({ legal }: { legal: typeof CANDIDATES[0]['legal'] }) {
  return (
    <div className="px-5 pb-4 border-b border-[#F0F4F2]">
      <p className="text-[10px] font-bold text-[#378ADD] tracking-[0.12em] uppercase mb-2 flex items-center gap-1.5">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Ficha normativa · Agente Legal
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <Dot color="#1D9E75" />
          <span className="text-[11px] text-[#5a7065]">Uso de suelo: <span className="font-semibold text-[#111d17]">{legal.usoSuelo}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color="#1D9E75" />
          <span className="text-[11px] text-[#5a7065]">COS / CUS: <span className="font-semibold text-[#111d17]">{legal.cos} / {legal.cus}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color="#1D9E75" />
          <span className="text-[11px] text-[#5a7065]">Altura máx: <span className="font-semibold text-[#111d17]">{legal.altura}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color="#1D9E75" />
          <span className="text-[11px] text-[#5a7065]">Cajones: <span className="font-semibold text-[#111d17]">{legal.cajones}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color="#6b7c74" />
          <span className="text-[11px] text-[#5a7065]">Municipio: <span className="font-semibold text-[#111d17]">{legal.municipio}</span></span>
        </div>
      </div>
      <div className="mt-2 flex items-start gap-1.5 bg-[#FFFBEB] border border-[#F5D97A] rounded-lg px-2.5 py-1.5">
        <Dot color="#D97706" />
        <span className="text-[11px] text-[#92600A]">{legal.restriccion}</span>
      </div>
    </div>
  )
}

function MarketSheet({ mercado, color }: { mercado: typeof CANDIDATES[0]['mercado']; color: string }) {
  const headerColors: Record<string, string> = {
    green: 'text-[#0F6E56]',
    blue: 'text-[#185FA5]',
    purple: 'text-[#6B3FA0]',
  }
  const dotColors: Record<string, string> = {
    green: '#1D9E75',
    blue: '#378ADD',
    purple: '#8B5CF6',
  }

  return (
    <div className="px-5 pb-4">
      <p className={`text-[10px] font-bold tracking-[0.12em] uppercase mb-2 flex items-center gap-1.5 ${headerColors[color]}`}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M1 9l3-4 2.5 2 3-5" stroke={dotColors[color]} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Reporte de mercado · Agente Mercado
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <Dot color={dotColors[color]} />
          <span className="text-[11px] text-[#5a7065]">Precio zona: <span className="font-semibold text-[#111d17]">{mercado.precioZona}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color={dotColors[color]} />
          <span className="text-[11px] text-[#5a7065]">Absorción: <span className="font-semibold text-[#111d17]">{mercado.absorcion}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color={dotColors[color]} />
          <span className="text-[11px] text-[#5a7065]">Competencia: <span className="font-semibold text-[#111d17]">{mercado.competencia}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color={dotColors[color]} />
          <span className="text-[11px] text-[#5a7065]">Perfil: <span className="font-semibold text-[#111d17]">{mercado.perfilNSE}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot color="#1D9E75" />
          <span className="text-[11px] text-[#5a7065]">Plusvalía: <span className="font-semibold text-[#0F6E56]">{mercado.plusvalia}</span></span>
        </div>
      </div>
      <div className="flex items-start gap-1.5 bg-[#F0FBF6] border border-[#9FE1CB] rounded-lg px-2.5 py-1.5">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="mt-0.5 shrink-0">
          <path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4z" stroke="#1D9E75" strokeWidth="1" fill="#E1F5EE"/>
        </svg>
        <span className="text-[11px] text-[#0F6E56] font-medium">Producto recomendado: {mercado.producto}</span>
      </div>
    </div>
  )
}

const CANDIDATE_COLORS: Record<string, string> = {
  green: '#1D9E75',
  blue: '#378ADD',
  purple: '#8B5CF6',
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
  return {
    url: `data:image/svg+xml,${svg}`,
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h),
  }
}

function CandidatesMap({
  candidates,
  highlightedId,
  onPinClick,
}: {
  candidates: typeof CANDIDATES
  highlightedId: number | null
  onPinClick: (id: number) => void
}) {
  const mapRef     = useRef<HTMLDivElement>(null)
  const mapObj     = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const callbackRef = useRef(onPinClick)
  const [ready, setReady] = useState(false)

  useEffect(() => { callbackRef.current = onPinClick }, [onPinClick])

  useEffect(() => {
    loadGoogleMaps().then(() => setReady(true)).catch(console.error)
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    mapObj.current = new google.maps.Map(mapRef.current, {
      center: MAPA_CENTRO,
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    })
    markersRef.current = candidates.map((c) => {
      const color = CANDIDATE_COLORS[c.mercadoColor] ?? '#1D9E75'
      const marker = new google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map: mapObj.current!,
        icon: pinIcon(c.id, color, false),
        title: c.nombre,
      })
      marker.addListener('click', () => callbackRef.current(c.id))
      return marker
    })
  }, [ready])

  useEffect(() => {
    if (!markersRef.current.length) return
    markersRef.current.forEach((marker, i) => {
      const c = candidates[i]
      const color = CANDIDATE_COLORS[c.mercadoColor] ?? '#1D9E75'
      const hi = c.id === highlightedId
      marker.setIcon(pinIcon(c.id, color, hi))
      marker.setZIndex(hi ? 100 : 1)
    })
  }, [highlightedId, candidates])

  if (!ready) {
    return (
      <div
        className="w-full rounded-2xl border border-[#E2E8E4] bg-[#F7F8F6] flex items-center justify-center mb-4"
        style={{ height: 320 }}
      >
        <p className="text-[13px] text-[#9aab9f]">Cargando mapa…</p>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden border border-[#E2E8E4] shadow-sm mb-4"
      style={{ height: 320 }}
    />
  )
}

function CandidateCard({
  c,
  stage,
  index,
  highlighted,
}: {
  c: typeof CANDIDATES[0]
  stage: Stage
  index: number
  highlighted: boolean
}) {
  const visible = stage >= 2
  const legalDone = stage >= 3
  const marketDone = stage >= 4

  return (
    <div
      id={`candidate-${c.id}`}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-500 ${
        highlighted ? 'border-[#1D9E75] shadow-[0_0_0_2px_#1D9E75]' : 'border-[#E2E8E4]'
      }`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transitionDelay: `${index * 100}ms`,
      }}
    >
      {/* Header */}
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

      {/* Base metrics */}
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

      {/* Legal pending */}
      {!legalDone && (
        <div className="px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-[#F7F8F6] text-[#9aab9f] border-[#E2E8E4]">
              <span className="w-2 h-2 rounded-full border border-[#D0DDD5]" />
              Normativa: verificando…
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-[#F7F8F6] text-[#9aab9f] border-[#E2E8E4]">
              <span className="w-2 h-2 rounded-full border border-[#D0DDD5]" />
              Mercado: pendiente
            </div>
          </div>
        </div>
      )}

      {/* Legal done sheet */}
      {legalDone && <LegalSheet legal={c.legal} />}

      {/* Market done sheet */}
      {marketDone && <MarketSheet mercado={c.mercado} color={c.mercadoColor} />}
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

function BuscandoContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || ''
  const [stage, setStage] = useState<Stage>(1)
  const [statusText, setStatusText] = useState('Agente Scout buscando terrenos...')
  const [highlightedId, setHighlightedId] = useState<number | null>(null)

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
                <CandidateCard key={c.id} c={c} stage={stage} index={i} highlighted={highlightedId === c.id} />
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

          {/* Stage 4 — map */}
          {stage === 4 && (
            <CandidatesMap
              candidates={CANDIDATES}
              highlightedId={highlightedId}
              onPinClick={(id) => {
                setHighlightedId(id)
                document.getElementById(`candidate-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }}
            />
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
                onClick={() => router.push(`/analisis/flujo-b${proyecto ? `?proyecto=${encodeURIComponent(proyecto)}` : ''}`)}
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

export default function BuscandoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f]">Iniciando Scout…</p>
      </div>
    }>
      <BuscandoContent />
    </Suspense>
  )
}
