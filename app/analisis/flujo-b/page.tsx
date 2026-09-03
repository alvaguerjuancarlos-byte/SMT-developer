'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FuentesConsultadas from '@/app/components/FuentesConsultadas'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

// Look & feel — espejo azul del navy/oro de Flujo A (ver app/prospeccion/flujo-a/page.tsx).
// Los colores semanticos (verde=positivo, ambar=precaucion, rojo=riesgo) y el codigo
// tricolor Scout/Legal/Mercado se preservan — solo se adapto su fondo claro para navy.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

// ─── Types ───────────────────────────────────────────────────────────────────

interface Factibilidad { status: 'Disponible' | 'Con condicionante' | 'No disponible'; nota: string }
interface AlertaLegal { tipo: string; descripcion: string; impacto: string; status: 'green' | 'amber' | 'red' }
interface Comparable { nombre: string; precioM2: number; avanceObra: string; absorcion: string }
interface SegmentoUnidad { tipo: string; participacion: string; precioM2: number; absorcionMensual: string }

interface CandidateLegal {
  usoSueloActual?: string; usoSueloPermitido?: string; usoSuelo?: string
  compatible?: boolean
  cos: string; cus: string; altura: string; cajones: string; restriccion: string; municipio: string
  factibilidades?: { agua: Factibilidad; drenaje: Factibilidad; cfe: Factibilidad }
  nivelRiesgo?: 'Bajo' | 'Medio' | 'Alto'
  alertasLegales?: AlertaLegal[]
}
interface CandidateMercado {
  label: string; precioZona: string; absorcion: string
  competencia: string; perfilNSE: string; plusvalia: string; producto: string
  comparables?: Comparable[]
  segmentacion?: SegmentoUnidad[]
}
interface Candidate {
  id: number; nombre: string; zona: string; ubicacion?: string
  lat: number; lng: number; precio: string; superficie: string
  preciom2: string; uso: string; mercadoColor: string
  score?: number; tir?: string; pros?: string[]; contras?: string[]
  recomendado?: boolean; legal: CandidateLegal; mercado: CandidateMercado
}
interface StressItem { titulo: string; escenario: string; impacto: string; status: 'green' | 'amber' | 'red' }

interface EstructuraCapital {
  equity: number; deuda: number; montoEquity: number; montoDeuda: number
  tipoDeuda: string; tasaDeuda: string; costoFinanciero: number
  preventa: { unidadesMinimas: number; porcentajeMinimo: string; montoMinimo: number; condicion: string }
  tasaDescuento: string; isrEstimado: number; utilidadNeta: number; descripcion: string
}
interface FlujoMes { mes: number; fase: string; egresos: number; ingresos: number; acumulado: number; nota: string }
interface PuntoQuiebre { desviacionMaxCostos: string; absorcionMinViable: string; precioVentaMinimo: string; resumen: string }

interface ScoreDimCandidate { candidatoId: number; score: number; razon: string }
interface ScoreDim { nombre: string; peso: string; scores: ScoreDimCandidate[]; interpretacion: string }
interface MetodologiaScore { descripcion: string; dimensiones: ScoreDim[] }

interface Recomendacion {
  candidatoId: number; scoreResiliencia: number; texto: string; stressTest: StressItem[]
  financiero?: Record<string, string>
  estructuraCapital?: EstructuraCapital
  flujoMensual?: FlujoMes[]
  puntoQuiebre?: PuntoQuiebre
  metodologiaScore?: MetodologiaScore
}
interface Fuente { nombre: string; tipo: string }
interface Fuentes { scout?: Fuente[]; legal?: Fuente[]; mercado?: Fuente[] }

interface ScoutData {
  candidatos: Candidate[]
  proyecto?: string
  recomendacion?: Recomendacion
  fuentes?: Fuentes
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  return parseFloat((s || '').replace(/[^0-9.]/g, '')) || 0
}
function demandaRank(label: string): number {
  const l = (label || '').toLowerCase()
  if (l.includes('alta') || l.includes('high')) return 3
  if (l.includes('media') || l.includes('med')) return 2
  return 1
}
function computeBest(cs: Candidate[]): Record<string, boolean>[] {
  if (!cs.length) return []
  const prices    = cs.map(c => parseNum(c.precio))
  const surfs     = cs.map(c => parseNum(c.superficie))
  const pm2       = cs.map(c => parseNum(c.preciom2))
  const cus       = cs.map(c => parseNum(c.legal?.cus || '0'))
  const alturas   = cs.map(c => parseNum(c.legal?.altura || '0'))
  const demandas  = cs.map(c => demandaRank(c.mercado?.label || ''))
  const absorcs   = cs.map(c => parseNum(c.mercado?.absorcion || '0'))
  const plusvalias= cs.map(c => parseNum(c.mercado?.plusvalia || '0'))
  const tirs      = cs.map(c => parseNum(c.tir || '0'))
  const minP = Math.min(...prices), maxS = Math.max(...surfs), minPm2 = Math.min(...pm2)
  const maxCus = Math.max(...cus), maxAlt = Math.max(...alturas)
  const maxDem = Math.max(...demandas), maxAbs = Math.max(...absorcs)
  const maxPlusv = Math.max(...plusvalias), maxTir = Math.max(...tirs)
  return cs.map((c, i) => ({
    precio:     prices[i]    === minP    && minP > 0,
    superficie: surfs[i]     === maxS    && maxS > 0,
    preciom2:   pm2[i]       === minPm2  && minPm2 > 0,
    usoSuelo:   false,
    cosCus:     cus[i]       === maxCus  && maxCus > 0,
    altura:     alturas[i]   === maxAlt  && maxAlt > 0,
    demanda:    demandas[i]  === maxDem  && maxDem > 0,
    absorcion:  absorcs[i]   === maxAbs  && maxAbs > 0,
    plusvalia:  plusvalias[i]=== maxPlusv && maxPlusv > 0,
    tir:        tirs[i]      === maxTir  && maxTir > 0,
  }))
}
function fmt(n: number) { return '$' + n.toLocaleString('es-MX') }

const ID_LABELS = ['A', 'B', 'C']

// ─── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK: ScoutData = {
  candidatos: [
    {
      id: 1, nombre: 'Terreno Valle Oriente', zona: 'San Pedro Garza García',
      ubicacion: 'Av. Vasconcelos 300 Pte., San Pedro Garza García',
      lat: 25.658, lng: -100.367, precio: '$8,500,000', superficie: '1,200 m²',
      preciom2: '$7,083/m²', uso: 'Hab. Plurifamiliar', mercadoColor: 'green',
      score: 88, tir: '22.4%', recomendado: true,
      pros: ['Mayor plusvalía de la zona (+18% en 3 años)', 'Uso de suelo ya habilitado para vertical', 'Acceso directo a Av. Vasconcelos — alta visibilidad'],
      contras: ['Precio por m² más alto del comparativo', 'Sin cajones en planta baja — requiere sótano'],
      legal: { usoSuelo: 'Hab. Plurifamiliar', cos: '60%', cus: '2.4', altura: '12 niveles', cajones: '1.2 por unidad', restriccion: 'Requiere sótano para cajones', municipio: 'San Pedro Garza García' },
      mercado: { label: 'Demanda Alta', precioZona: '$38,500/m²', absorcion: '8 unidades/mes', competencia: '3 proyectos en radio 500 m', perfilNSE: 'A/B · 28–45 años', plusvalia: '+18% últimos 3 años', producto: 'Departamentos 80–120 m² NSE A/B' },
    },
    {
      id: 2, nombre: 'Terreno Cumbres Elite', zona: 'García, Nuevo León',
      ubicacion: 'Blvd. Cumbres 450, García, Nuevo León',
      lat: 25.734, lng: -100.408, precio: '$5,200,000', superficie: '1,850 m²',
      preciom2: '$2,811/m²', uso: 'Mixto / Comercial', mercadoColor: 'blue',
      score: 74, tir: '16.8%', recomendado: false,
      pros: ['Mayor superficie al precio más bajo del comparativo', 'Precio por m² más competitivo ($2,811)', 'Zona en crecimiento con baja competencia activa'],
      contras: ['Demanda y absorción más bajas — horizonte extendido', 'Uso mixto requiere cambio de uso de suelo'],
      legal: { usoSuelo: 'Mixto / Comercial', cos: '50%', cus: '1.8', altura: '8 niveles', cajones: '1.0 por unidad', restriccion: 'Requiere cambio de uso de suelo para residencial', municipio: 'García' },
      mercado: { label: 'Demanda Media', precioZona: '$22,000/m²', absorcion: '5 unidades/mes', competencia: '1 proyecto en radio 500 m', perfilNSE: 'B/C · 25–40 años', plusvalia: '+11% últimos 3 años', producto: 'Casas 80–100 m² NSE B/C' },
    },
    {
      id: 3, nombre: 'Terreno Distrito Tec', zona: 'Monterrey',
      ubicacion: 'Calle Eugenio Garza Sada 2501, Monterrey',
      lat: 25.646, lng: -100.307, precio: '$7,100,000', superficie: '980 m²',
      preciom2: '$7,245/m²', uso: 'Hab. Plurifamiliar', mercadoColor: 'purple',
      score: 79, tir: '19.1%', recomendado: false,
      pros: ['Ubicación premium cerca del Tec de Monterrey', 'Demanda alta y mercado estudiantil/joven consolidado', 'Normativa plurifamiliar vigente — sin trámite de cambio'],
      contras: ['Superficie más pequeña limita número de unidades', 'Competencia alta de desarrollos recientes en radio 300 m'],
      legal: { usoSuelo: 'Hab. Plurifamiliar', cos: '60%', cus: '2.2', altura: '10 niveles', cajones: '1.0 por unidad', restriccion: 'Alta competencia — diferenciación de producto necesaria', municipio: 'Monterrey' },
      mercado: { label: 'Demanda Alta', precioZona: '$35,000/m²', absorcion: '7 unidades/mes', competencia: '5 proyectos en radio 500 m', perfilNSE: 'B · 22–35 años', plusvalia: '+14% últimos 3 años', producto: 'Departamentos compactos 50–70 m² NSE B' },
    },
  ],
  recomendacion: {
    candidatoId: 1, scoreResiliencia: 81,
    texto: 'El Terreno A (Valle Oriente) presenta el mayor score compuesto del comparativo (88/100) combinando la normativa más favorable (Plurifamiliar, 12 niveles, CUS 2.4), la mejor velocidad de absorción (8 u/mes) y la plusvalía más alta de los tres candidatos (+18% en 3 años). Aunque su precio por m² es el más alto, la capacidad constructiva y el perfil de demanda NSE A/B en San Pedro Garza García justifican el diferencial con una TIR estimada de 22.4% anual.',
    stressTest: [
      { titulo: 'Shock de Costos +15%', escenario: 'Costo total sube de $45.2 M a $49.8 M por incremento en materiales.', impacto: 'TIR: 22.4% → 17.8% · Margen: 28.3% → 20.1%', status: 'amber' },
      { titulo: 'Freno de Ventas −50%', escenario: 'Absorción baja de 8 a 4 u/mes. Plazo se extiende 6 meses.', impacto: 'TIR: 22.4% → 14.1% · Plazo: 18 → 24 meses', status: 'amber' },
      { titulo: 'Ajuste de Precio −10%', escenario: 'Precio de venta cae de $38,500 a $34,650/m². Ingresos −$6.7 M.', impacto: 'TIR: 22.4% → 9.8% · Margen: 28.3% → 12.6%', status: 'red' },
    ],
  },
}

const METRIC_ROWS: { key: string; label: string }[] = [
  { key: 'precio',     label: 'Precio total' },
  { key: 'superficie', label: 'Superficie' },
  { key: 'preciom2',   label: 'Precio por m²' },
  { key: 'usoSuelo',   label: 'Uso de suelo' },
  { key: 'cosCus',     label: 'COS / CUS' },
  { key: 'altura',     label: 'Altura máxima' },
  { key: 'demanda',    label: 'Demanda zona' },
  { key: 'absorcion',  label: 'Velocidad absorción' },
  { key: 'plusvalia',  label: 'Plusvalía 3 años' },
  { key: 'tir',        label: 'TIR estimada' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#5f6a80] tracking-[0.14em] uppercase mb-4 flex items-center gap-3" style={{ fontFamily: 'var(--font-plex-mono)' }}>
      <span className="flex-1 h-px bg-[#2a3f5c]" />
      {children}
      <span className="flex-1 h-px bg-[#2a3f5c]" />
    </h2>
  )
}

function ScoreArc({ score }: { score: number }) {
  const r = 46
  const circ = Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#1D9E75' : score >= 50 ? '#D97706' : '#DC2626'
  const label = score >= 70 ? 'Proyecto Viable' : score >= 50 ? 'Revisar Supuestos' : 'Riesgo Elevado'
  const labelColor = score >= 70 ? '#5FD4A8' : score >= 50 ? '#E8B84B' : '#F87171'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 120, height: 72 }}>
        <svg width="120" height="72" viewBox="0 0 120 72" fill="none" style={{ overflow: 'visible' }}>
          <path d="M 12 60 A 48 48 0 0 1 108 60" stroke="#2a3f5c" strokeWidth="10" strokeLinecap="round" fill="none"/>
          <path d="M 12 60 A 48 48 0 0 1 108 60" stroke={color} strokeWidth="10" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <span className="text-[28px] font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[10px] text-[#5f6a80]">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-bold" style={{ color: labelColor }}>{label}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AnalisisflujoB() {
  const router = useRouter()
  const params = useSearchParams()
  const proyectoParam = params.get('proyecto') || ''
  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  const [scoutData, setScoutData] = useState<ScoutData>(FALLBACK)
  const [aiGenerated, setAiGenerated] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('smt_scout_data')
    if (raw) {
      try {
        const parsed: ScoutData = JSON.parse(raw)
        if (parsed?.candidatos?.length) {
          setScoutData(parsed)
          setAiGenerated(true)
        }
      } catch { /* keep fallback */ }
    }
  }, [])

  const candidates = scoutData.candidatos
  const rec = scoutData.recomendacion
  const recCand = candidates.find(c => c.recomendado || c.id === rec?.candidatoId) || candidates[0]
  const proyecto = proyectoParam || scoutData.proyecto || 'Proyecto Scout'

  const metricsPerCand = candidates.map(c => ({
    precio:     c.precio,
    superficie: c.superficie,
    preciom2:   c.preciom2,
    usoSuelo:   c.legal?.usoSueloPermitido || c.legal?.usoSuelo || c.uso,
    cosCus:     c.legal ? `${c.legal.cos} / ${c.legal.cus}` : '—',
    altura:     c.legal?.altura || '—',
    demanda:    (c.mercado?.label || '').replace(/^Demanda\s+/i, ''),
    absorcion:  c.mercado?.absorcion || '—',
    plusvalia:  c.mercado?.plusvalia || '—',
    tir:        c.tir || '—',
  }))

  const bestFlags = computeBest(candidates)
  const stressTests = rec?.stressTest || FALLBACK.recomendacion!.stressTest
  const ec = rec?.estructuraCapital
  const flujo = rec?.flujoMensual
  const pq = rec?.puntoQuiebre
  const ms = rec?.metodologiaScore

  const factibilidadDot = (status: string) =>
    status === 'Disponible' ? '#1D9E75' : status === 'Con condicionante' ? '#D97706' : '#DC2626'
  const riesgoCfg = (r?: string) =>
    r === 'Bajo' ? { bg: 'bg-[#14301f]', text: 'text-[#5FD4A8]' }
    : r === 'Medio' ? { bg: 'bg-[#2e2510]', text: 'text-[#E8B84B]' }
    : { bg: 'bg-[#2e1414]', text: 'text-[#F87171]' }
  const alertaColor = (s: string) =>
    s === 'green' ? { dot: '#1D9E75', bg: '#14301f', text: '#5FD4A8' }
    : s === 'amber' ? { dot: '#D97706', bg: '#2e2510', text: '#E8B84B' }
    : { dot: '#DC2626', bg: '#2e1414', text: '#F87171' }

  return (
    <div
      className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex flex-col`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    >

      {/* Header */}
      <header className="px-8 py-4 flex items-center gap-3 border-b border-white/10 bg-[#070f22] sticky top-0 z-20">
        <div className="w-8 h-8 rounded-lg bg-[#5B8FD4] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#f4f0e6" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#f4f0e6" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] tracking-wide" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 500 }}>SMT <em style={{ fontStyle: 'normal', color: '#8FB6E8' }}>Developer</em></span>
          <span className="block text-[10px] text-[#8b96ab] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {aiGenerated && (
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#5B8FD4]/10 border border-[#5B8FD4]/40 text-[#8FB6E8] px-2.5 py-1 rounded-full">
              IA generado
            </span>
          )}
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] hover:border-[#3f5a85] px-3 py-1.5 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Mis Proyectos
          </button>
          <button
            onClick={() => router.push('/prospeccion/flujo-b/buscando')}
            className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver a Candidatos
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-[900px] mx-auto flex flex-col gap-10">

          {/* 1 · Hero banner */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #070f22 0%, #0b1d3a 55%, #091529 100%)' }}>
            <div className="px-8 pt-8 pb-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#5B8FD4] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#f4f0e6" strokeWidth="1.5" fill="none"/>
                      <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#f4f0e6" strokeWidth="1" strokeOpacity="0.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#f4f0e6]">SMT Developer</p>
                    <p className="text-[10px] text-[#f4f0e6]/40 tracking-[0.12em] uppercase">Inteligencia inmobiliaria</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#5B8FD4]/20 border border-[#5B8FD4]/40 text-[#8FB6E8] px-3 py-1 rounded-full">
                  Análisis Comparativo · {candidates.length} Candidatos
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#8FB6E8] tracking-[0.14em] uppercase mb-2">Reporte Scout IA · Flujo B</p>
              <h1 className="text-[32px] font-black text-[#f4f0e6] leading-tight mb-2">{proyecto}</h1>
              <p className="text-[14px] text-[#f4f0e6]/50">{recCand?.zona || ''} · {today}</p>
            </div>
          </div>

          {/* 2 · Comparative table */}
          <div>
            <SectionTitle>Tabla Comparativa de Terrenos</SectionTitle>
            <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3f5c]" style={{ background: 'linear-gradient(135deg, #070f22, #0b1d3a)' }}>
                    <th className="px-5 py-4 text-left text-[10px] font-bold text-[#f4f0e6]/50 uppercase tracking-wide w-[200px]">Indicador</th>
                    {candidates.map((c, i) => (
                      <th key={c.id} className="px-5 py-4 text-center">
                        <p className="text-[13px] font-bold text-[#f4f0e6]">{c.nombre}</p>
                        <p className="text-[10px] text-[#f4f0e6]/40 mt-0.5 font-normal">{ID_LABELS[i]} · {c.zona}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map((row, ri) => (
                    <tr key={row.key} className={`border-b border-[#2a3f5c] last:border-0 ${ri % 2 === 0 ? '' : 'bg-[#0e2038]'}`}>
                      <td className="px-5 py-3.5 text-[12px] font-semibold text-[#8b96ab]">{row.label}</td>
                      {candidates.map((c, ci) => {
                        const val = metricsPerCand[ci]?.[row.key as keyof typeof metricsPerCand[0]] || '—'
                        const isBest = bestFlags[ci]?.[row.key] ?? false
                        return (
                          <td key={c.id} className="px-5 py-3.5 text-center">
                            <span className={`inline-block text-[13px] font-semibold px-2.5 py-1 rounded-lg ${isBest ? 'bg-[#14301f] text-[#5FD4A8]' : 'text-[#f4f0e6]'}`}>
                              {val}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3 · Candidate cards */}
          <div>
            <SectionTitle>Evaluación por Candidato</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              {candidates.map((c, i) => {
                const score = c.score ?? 75
                const scoreBg = score >= 80 ? 'bg-[#14301f] text-[#5FD4A8]' : score >= 70 ? 'bg-[#2e2510] text-[#E8B84B]' : 'bg-[#2e1414] text-[#F87171]'
                return (
                  <div key={c.id} className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 pt-5 pb-4 border-b border-[#2a3f5c]">
                      <div className="flex items-start justify-between mb-1">
                        <div className="w-8 h-8 rounded-lg bg-[#5B8FD4] flex items-center justify-center text-[#f4f0e6] font-black text-[13px] shrink-0">
                          {ID_LABELS[i]}
                        </div>
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${scoreBg}`}>{score}/100</span>
                      </div>
                      <p className="text-[14px] font-bold text-[#f4f0e6] mt-2 leading-tight">{c.nombre}</p>
                      <p className="text-[11px] text-[#5f6a80] mt-0.5 leading-snug">{c.ubicacion || c.zona}</p>
                    </div>
                    <div className="px-5 py-4 flex flex-col gap-3 flex-1">
                      {(c.pros?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[9px] font-bold text-[#1D9E75] uppercase tracking-[0.12em] mb-2">Fortalezas</p>
                          <ul className="flex flex-col gap-1.5">
                            {(c.pros || []).map((p, pi) => (
                              <li key={pi} className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-[#14301f] flex items-center justify-center shrink-0 mt-0.5">
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path d="M1.5 4L3.5 6L6.5 2" stroke="#1D9E75" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </span>
                                <span className="text-[11px] text-[#8b96ab] leading-snug">{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(c.contras?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[9px] font-bold text-[#D97706] uppercase tracking-[0.12em] mb-2">Riesgos</p>
                          <ul className="flex flex-col gap-1.5">
                            {(c.contras || []).map((con, ci2) => (
                              <li key={ci2} className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-[#2e2510] flex items-center justify-center shrink-0 mt-0.5">
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path d="M4 2.5V4.5M4 5.5V5.6" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/>
                                  </svg>
                                </span>
                                <span className="text-[11px] text-[#8b96ab] leading-snug">{con}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4 · Análisis Legal por Candidato */}
          {candidates.some(c => c.legal?.factibilidades || c.legal?.nivelRiesgo || c.legal?.alertasLegales?.length) && (
            <div>
              <SectionTitle>Análisis Legal · 3 Candidatos</SectionTitle>
              <div className="grid grid-cols-3 gap-4">
                {candidates.map((c, i) => {
                  const rc = riesgoCfg(c.legal?.nivelRiesgo)
                  return (
                    <div key={c.id} className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden flex flex-col">
                      {/* Card header */}
                      <div className="px-5 py-4 border-b border-[#2a3f5c]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-[#5B8FD4] flex items-center justify-center text-[#f4f0e6] font-black text-[11px] shrink-0">{ID_LABELS[i]}</span>
                            <span className="text-[12px] font-bold text-[#f4f0e6] truncate">{c.nombre}</span>
                          </div>
                          {c.legal?.nivelRiesgo && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${rc.bg} ${rc.text}`}>
                              Riesgo {c.legal.nivelRiesgo}
                            </span>
                          )}
                        </div>
                        {/* Uso de suelo */}
                        {(c.legal?.usoSueloActual || c.legal?.usoSueloPermitido) && (
                          <div className="mt-2 flex flex-col gap-1 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[#5f6a80]">Actual</span>
                              <span className="font-medium text-[#8b96ab] truncate ml-2 max-w-[120px]">{c.legal.usoSueloActual}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5f6a80]">Permitido</span>
                              <span className="font-medium text-[#f4f0e6] truncate ml-2 max-w-[120px]">{c.legal.usoSueloPermitido}</span>
                            </div>
                            {c.legal?.compatible !== undefined && (
                              <div className={`mt-1.5 text-[10px] font-bold px-2 py-1 rounded-lg text-center ${c.legal.compatible ? 'bg-[#14301f] text-[#5FD4A8]' : 'bg-[#2e1414] text-[#F87171]'}`}>
                                {c.legal.compatible ? '✓ Compatible — uso directo' : '✗ Requiere cambio de uso'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Factibilidades */}
                      {c.legal?.factibilidades && (
                        <div className="px-5 py-3 border-b border-[#2a3f5c]">
                          <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-[0.12em] mb-2">Factibilidades</p>
                          {(['agua', 'drenaje', 'cfe'] as const).map(svc => {
                            const f = c.legal.factibilidades![svc]
                            return (
                              <div key={svc} className="flex items-start justify-between py-1 gap-2">
                                <span className="text-[11px] text-[#8b96ab] shrink-0">{svc === 'cfe' ? 'CFE' : svc.charAt(0).toUpperCase() + svc.slice(1)}</span>
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: factibilidadDot(f.status) }} />
                                    <span className="text-[10px] font-semibold text-[#f4f0e6]">{f.status}</span>
                                  </div>
                                  {f.nota && <span className="text-[9px] text-[#5f6a80] text-right leading-snug mt-0.5">{f.nota}</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Alertas */}
                      {c.legal?.alertasLegales && c.legal.alertasLegales.length > 0 && (
                        <div className="px-5 py-3 flex-1">
                          <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-[0.12em] mb-2">Alertas Legales</p>
                          {c.legal.alertasLegales.map((a, ai) => {
                            const ac = alertaColor(a.status)
                            return (
                              <div key={ai} className="mb-2 last:mb-0 rounded-lg p-2" style={{ background: ac.bg + '50' }}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ac.dot }} />
                                  <span className="text-[10px] font-bold" style={{ color: ac.text }}>{a.tipo}</span>
                                </div>
                                <p className="text-[10px] text-[#8b96ab] leading-snug">{a.descripcion}</p>
                                {a.impacto && <p className="text-[9px] text-[#5f6a80] mt-1">{a.impacto}</p>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 5 · Comparables y Segmentación */}
          {candidates.some(c => c.mercado?.comparables?.length || c.mercado?.segmentacion?.length) && (
            <div>
              <SectionTitle>Comparables y Segmentación por Zona</SectionTitle>
              <div className="grid grid-cols-3 gap-4">
                {candidates.map((c, i) => (
                  <div key={c.id} className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#2a3f5c] bg-[#0e2038] flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-[#5B8FD4] flex items-center justify-center text-[#f4f0e6] font-black text-[10px] shrink-0">{ID_LABELS[i]}</span>
                      <span className="text-[12px] font-bold text-[#f4f0e6] truncate">{c.zona}</span>
                    </div>

                    {/* Comparables */}
                    {c.mercado?.comparables && c.mercado.comparables.length > 0 && (
                      <div className="px-5 py-3 border-b border-[#2a3f5c]">
                        <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-[0.12em] mb-2">Competencia Activa</p>
                        {c.mercado.comparables.map((comp, ci) => (
                          <div key={ci} className="mb-2.5 last:mb-0">
                            <p className="text-[11px] font-semibold text-[#f4f0e6] leading-snug">{comp.nombre}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-[#1D9E75] font-semibold">${comp.precioM2.toLocaleString('es-MX')}/m²</span>
                              <span className="text-[#2a3f5c] text-[10px]">·</span>
                              <span className="text-[10px] text-[#5f6a80]">{comp.avanceObra}</span>
                              <span className="text-[#2a3f5c] text-[10px]">·</span>
                              <span className="text-[10px] text-[#5f6a80]">{comp.absorcion}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Segmentación */}
                    {c.mercado?.segmentacion && c.mercado.segmentacion.length > 0 && (
                      <div className="px-5 py-3">
                        <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-[0.12em] mb-2">Segmentación de Demanda</p>
                        {c.mercado.segmentacion.map((seg, si) => {
                          const pct = parseFloat(seg.participacion) || 0
                          return (
                            <div key={si} className="mb-2.5 last:mb-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-[#8b96ab] truncate flex-1 mr-2">{seg.tipo}</span>
                                <span className="text-[10px] font-bold text-[#f4f0e6] shrink-0">{seg.participacion}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[#2a3f5c] overflow-hidden">
                                <div className="h-full rounded-full bg-[#1D9E75] transition-all duration-700" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-[#5f6a80]">${seg.precioM2.toLocaleString('es-MX')}/m²</span>
                                <span className="text-[#2a3f5c] text-[9px]">·</span>
                                <span className="text-[9px] text-[#5f6a80]">{seg.absorcionMensual}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6 · Metodología del Score Comparativa */}
          {ms && (
            <div>
              <SectionTitle>Metodología del Score · Comparativa</SectionTitle>
              <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#2a3f5c] bg-[#0e2038]">
                  <p className="text-[13px] text-[#8b96ab] leading-relaxed">{ms.descripcion}</p>
                </div>
                <div className="divide-y divide-[#2a3f5c]">
                  {ms.dimensiones.map((dim, di) => (
                    <div key={di} className="px-6 py-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[13px] font-bold text-[#f4f0e6]">{dim.nombre}</span>
                        <span className="text-[10px] bg-[#2a3f5c] text-[#5f6a80] px-2 py-0.5 rounded-full font-bold">{dim.peso}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        {dim.scores.map(s => {
                          const cand = candidates.find(c => c.id === s.candidatoId)
                          const ci = cand ? candidates.indexOf(cand) : 0
                          const sc = s.score >= 80 ? { color: '#1D9E75', bg: '#14301f' } : s.score >= 70 ? { color: '#D97706', bg: '#2e2510' } : { color: '#DC2626', bg: '#2e1414' }
                          return (
                            <div key={s.candidatoId} className="rounded-xl p-3 border border-[#2a3f5c]" style={{ background: sc.bg + '60' }}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-md bg-[#5B8FD4] flex items-center justify-center text-[#f4f0e6] font-black text-[9px]">{ID_LABELS[ci]}</span>
                                  <span className="text-[10px] text-[#5f6a80] font-medium">{cand?.nombre?.split(' ').slice(1).join(' ') || `Candidato ${ID_LABELS[ci]}`}</span>
                                </div>
                                <span className="text-[16px] font-black leading-none" style={{ color: sc.color }}>{s.score}</span>
                              </div>
                              <p className="text-[10px] text-[#8b96ab] leading-snug">{s.razon}</p>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[12px] text-[#8b96ab] italic leading-relaxed">{dim.interpretacion}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7 · Recomendación Mastermind */}
          {recCand && (
            <div>
              <SectionTitle>Recomendación Mastermind</SectionTitle>
              <div className="rounded-2xl overflow-hidden border border-[#5B8FD4]/40" style={{ background: 'linear-gradient(135deg, #070f22 0%, #0b1d3a 100%)' }}>
                <div className="px-8 py-7">
                  <div className="flex items-start gap-6">
                    <div className="shrink-0">
                      <ScoreArc score={rec?.scoreResiliencia ?? recCand.score ?? 81} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#5B8FD4]/20 border border-[#5B8FD4]/40 text-[#8FB6E8] px-3 py-1 rounded-full">
                          Candidato Recomendado
                        </span>
                        <span className="text-[10px] font-bold text-[#4ade80]/60 uppercase tracking-wide">
                          Score {rec?.scoreResiliencia ?? recCand.score ?? 81}/100
                        </span>
                      </div>
                      <h3 className="text-[22px] font-black text-[#f4f0e6] mb-1">{recCand.nombre} — Candidato {ID_LABELS[candidates.indexOf(recCand)] || 'A'}</h3>
                      <p className="text-[13px] text-[#f4f0e6]/50 mb-4">{recCand.ubicacion || recCand.zona}</p>
                      <p className="text-[13px] text-[#f4f0e6]/70 leading-relaxed">{rec?.texto || FALLBACK.recomendacion!.texto}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-4 gap-4 pt-6 border-t border-white/10">
                    {[
                      { label: 'TIR Estimada',   value: recCand.tir || '—',                green: true  },
                      { label: 'Score Global',    value: `${recCand.score ?? 81}/100`,      green: true  },
                      { label: 'Absorción',       value: recCand.mercado?.absorcion || '—', green: false },
                      { label: 'Plusvalía 3 a.',  value: recCand.mercado?.plusvalia || '—', green: true  },
                    ].map((m, mi) => (
                      <div key={mi} className="text-center">
                        <p className="text-[10px] text-[#f4f0e6]/40 uppercase tracking-wide mb-1">{m.label}</p>
                        <p className={`text-[22px] font-black leading-none ${m.green ? 'text-[#4ade80]' : 'text-[#f4f0e6]'}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8 · Estructura de Capital */}
          {ec && (
            <div>
              <SectionTitle>Estructura de Capital · Candidato Recomendado</SectionTitle>
              <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden">
                <div className="px-6 pt-6 pb-5">
                  {/* Equity / Deuda bar */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-[#f4f0e6]">Mezcla Financiera</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#1D9E75] font-bold">Equity {ec.equity}%</span>
                        <span className="text-[11px] text-[#378ADD] font-bold">Deuda {ec.deuda}%</span>
                      </div>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#1D9E75] rounded-l-full transition-all duration-700" style={{ width: `${ec.equity}%` }} />
                      <div className="h-full bg-[#378ADD] rounded-r-full transition-all duration-700" style={{ width: `${ec.deuda}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-[#5f6a80]">
                      <span>{fmt(ec.montoEquity)} MXN</span>
                      <span>{fmt(ec.montoDeuda)} MXN</span>
                    </div>
                  </div>
                  {/* Grid de métricas */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5">
                    {[
                      { label: 'Tipo de deuda',       value: ec.tipoDeuda },
                      { label: 'Tasa de deuda',        value: ec.tasaDeuda },
                      { label: 'Costo financiero',     value: fmt(ec.costoFinanciero) + ' MXN' },
                      { label: 'Tasa de descuento',    value: ec.tasaDescuento },
                      { label: 'ISR estimado',         value: fmt(ec.isrEstimado) + ' MXN' },
                      { label: 'Utilidad neta',        value: fmt(ec.utilidadNeta) + ' MXN' },
                    ].map((item, ii) => (
                      <div key={ii} className="flex items-center justify-between py-1.5 border-b border-[#2a3f5c] last:border-0">
                        <span className="text-[12px] text-[#5f6a80]">{item.label}</span>
                        <span className="text-[12px] font-semibold text-[#f4f0e6]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {/* Preventa mínima */}
                  <div className="bg-[#1c2440] rounded-xl p-4">
                    <p className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-[0.12em] mb-1">Preventa Mínima Requerida</p>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[22px] font-black text-[#A5B4FC]">{ec.preventa.unidadesMinimas}</span>
                      <span className="text-[12px] text-[#A5B4FC]/70">unidades · {ec.preventa.porcentajeMinimo} del proyecto</span>
                    </div>
                    <p className="text-[11px] text-[#A5B4FC]/70">{fmt(ec.preventa.montoMinimo)} MXN — {ec.preventa.condicion}</p>
                  </div>
                  {ec.descripcion && (
                    <p className="text-[12px] text-[#5f6a80] mt-4 leading-relaxed">{ec.descripcion}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 9 · Flujo de Caja */}
          {flujo && flujo.length > 0 && (
            <div>
              <SectionTitle>Flujo de Caja Proyectado · Candidato Recomendado</SectionTitle>
              <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#2a3f5c] bg-[#0e2038]">
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Mes</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Fase</th>
                      <th className="px-5 py-3 text-right text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Egresos</th>
                      <th className="px-5 py-3 text-right text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Ingresos</th>
                      <th className="px-5 py-3 text-right text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Acumulado</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flujo.map((f, fi) => (
                      <tr key={fi} className={`border-b border-[#2a3f5c] last:border-0 ${fi % 2 === 1 ? 'bg-[#0e2038]' : ''}`}>
                        <td className="px-5 py-3 font-bold text-[#f4f0e6]">M{f.mes}</td>
                        <td className="px-5 py-3 text-[#8b96ab]">{f.fase}</td>
                        <td className="px-5 py-3 text-right text-[#DC2626] font-semibold">{fmt(f.egresos)}</td>
                        <td className="px-5 py-3 text-right text-[#1D9E75] font-semibold">{fmt(f.ingresos)}</td>
                        <td className={`px-5 py-3 text-right font-bold ${f.acumulado >= 0 ? 'text-[#1D9E75]' : 'text-[#DC2626]'}`}>{fmt(f.acumulado)}</td>
                        <td className="px-5 py-3 text-[#5f6a80] text-[11px]">{f.nota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 10 · Punto de Quiebre */}
          {pq && (
            <div>
              <SectionTitle>Punto de Quiebre · Candidato Recomendado</SectionTitle>
              <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm p-6">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Desviación máx. de costos', value: pq.desviacionMaxCostos, color: '#D97706' },
                    { label: 'Absorción mínima viable',   value: pq.absorcionMinViable,  color: '#D97706' },
                    { label: 'Precio de venta mínimo',    value: pq.precioVentaMinimo,   color: '#DC2626' },
                  ].map((item, ii) => (
                    <div key={ii} className="bg-[#2e2510] border border-[#D97706] rounded-xl p-4 text-center">
                      <p className="text-[9px] font-bold text-[#E8B84B] uppercase tracking-[0.12em] mb-2">{item.label}</p>
                      <p className="text-[24px] font-black" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[13px] text-[#8b96ab] leading-relaxed">{pq.resumen}</p>
              </div>
            </div>
          )}

          {/* 11 · Stress Test */}
          <div>
            <SectionTitle>Stress Test · Terreno Recomendado</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              {stressTests.map(s => {
                const cfg = {
                  amber: { dot: '#D97706', badge: 'bg-[#2e2510] text-[#E8B84B]', border: 'border-[#D97706]/50', label: 'Tolerable' },
                  red:   { dot: '#DC2626', badge: 'bg-[#2e1414] text-[#F87171]', border: 'border-[#DC2626]/50', label: 'Crítico'   },
                  green: { dot: '#1D9E75', badge: 'bg-[#14301f] text-[#5FD4A8]', border: 'border-[#1D9E75]/50', label: 'Tolerable' },
                }[s.status]
                return (
                  <div key={s.titulo} className={`bg-[#132a4d] rounded-2xl border ${cfg.border} p-5 shadow-sm`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-[13px] font-bold text-[#f4f0e6] mb-2">{s.titulo}</p>
                    <p className="text-[12px] text-[#8b96ab] leading-relaxed mb-3">{s.escenario}</p>
                    <p className="text-[12px] font-semibold text-[#f4f0e6]">{s.impacto}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 12 · Fuentes */}
          {scoutData.fuentes && (
            <div>
              <SectionTitle>Fuentes de Información Consultadas</SectionTitle>
              <div className="grid grid-cols-3 gap-4">
                {([
                  { key: 'scout',   label: 'Scout IA',          color: '#1D9E75', bg: '#14301f', icon: 'M9 2L16 6V12L9 16L2 12V6L9 2Z' },
                  { key: 'legal',   label: 'Agente Legal',       color: '#378ADD', bg: '#101f38', icon: 'M2 6l3 3 5-5' },
                  { key: 'mercado', label: 'Agente de Mercado',  color: '#8B5CF6', bg: '#211a38', icon: 'M1 9l3-4 2.5 2 3-5' },
                ] as const).map(({ key, label, color, bg, icon }) => {
                  const items: Fuente[] = scoutData.fuentes?.[key] ?? []
                  if (!items.length) return null
                  return (
                    <div key={key} className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#2a3f5c] flex items-center gap-2.5" style={{ background: bg }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: color }}>
                          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                            <path d={icon} stroke="#f4f0e6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <p className="text-[12px] font-bold" style={{ color }}>{label}</p>
                      </div>
                      <ul className="divide-y divide-[#2a3f5c]">
                        {items.map((f, fi) => (
                          <li key={fi} className="px-5 py-3">
                            <p className="text-[12px] font-semibold text-[#f4f0e6] leading-snug">{f.nombre}</p>
                            <p className="text-[10px] text-[#5f6a80] mt-0.5 uppercase tracking-wide">{f.tipo}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Base de conocimiento */}
          <FuentesConsultadas />

          {/* 13 · CTA */}
          <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm p-6 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-[#5FD4A8] mb-1">Análisis completo · Listo para presentar</p>
              <p className="text-[13px] text-[#8b96ab]">Genera la propuesta comparativa con los tres candidatos para inversionistas.</p>
            </div>
            <button
              onClick={() => {
                router.push(`/propuesta/flujo-b?proyecto=${encodeURIComponent(proyecto)}`)
              }}
              className="flex items-center gap-2 bg-[#5B8FD4] text-[#f4f0e6] px-6 py-3.5 rounded-xl text-[14px] font-semibold hover:bg-[#8FB6E8] transition-colors cursor-pointer shrink-0 ml-6"
            >
              Generar Propuesta Comparativa
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#f4f0e6" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}

export default function AnalisisflujoB_Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b1d3a] flex items-center justify-center">
        <p className="text-[#5f6a80]">Cargando análisis comparativo…</p>
      </div>
    }>
      <AnalisisflujoB />
    </Suspense>
  )
}
