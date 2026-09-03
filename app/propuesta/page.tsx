'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { downloadPDF, autoSavePDF } from '@/lib/downloadPDF'
import { saveProyecto } from '@/lib/saveProyecto'
import type { ResultadoValidacionIndirectos, ResultadoEscaladoMix } from '@/lib/analisis/validacionFinanciera'

interface StressItem { titulo: string; escenario: string; impacto: string; status: 'green' | 'amber' | 'red' }
interface Factibilidad { status: 'Disponible' | 'Con condicionante' | 'No disponible'; nota: string }
interface AlertaLegal { tipo: string; descripcion: string; impacto: string; status: 'green' | 'amber' | 'red' }
interface Comparable { nombre: string; direccion: string; fechaReferencia: string; precioM2: number | null; avanceObra: string; unidades: number; tipologia: string }
interface SegmentoUnidad { tipo: string; absorcionMensual: string; precioM2: number; participacion: string; perfilComprador: string }
interface PricingFase { fase: string; precioM2: number; descuento: string; meta: string }
interface EstructuraCapital {
  equity: number; deuda: number; montoEquity: number; montoDeuda: number
  tipoDeuda: string; tasaDeuda: string; costoFinanciero: number
  preventa: { unidadesMinimas: number; porcentajeMinimo: string; montoMinimo: number; condicion: string }
  tasaDescuento: string; isrEstimado: number; utilidadNeta: number; descripcion: string
}
interface FlujoMes { mes: number; fase: string; egresos: number; ingresos: number; acumulado: number; nota: string }

interface AnalisisData {
  proyecto?: string
  recomendacion: { tipologia: string; descripcion: string }
  fichaLegal: {
    usoSueloActual?: string; usoSueloPermitido?: string; usoSuelo?: string
    compatible?: boolean; densidadAutorizada?: string
    cos: string; cus: string; altura: string; cajones: string
    retiros?: string; municipio: string; restriccion: string
    factibilidades?: { agua: Factibilidad; drenaje: Factibilidad; cfe: Factibilidad }
    regimenCondominio?: string; restriccionesAmbientales?: string
    nivelRiesgo?: 'Bajo' | 'Medio' | 'Alto'; alertasLegales?: AlertaLegal[]
  }
  financiero: {
    costoTerreno: number; costoTerrenoM2: number; construccionM2: number
    costoTotalConstruccion: number; indirectos: number; honorarios: number
    imprevistos: number; inversionTotal: number; precioVentaM2: number
    ingresosProyectados: number; utilidadBruta: number; margenBruto: number; tir: number | null
    validacionIndirectos?: ResultadoValidacionIndirectos
    escaladoPorMix?: ResultadoEscaladoMix
    precioVentaAjustadoPorBanda?: { precioVentaM2Modelo: number; precioVentaM2Ajustado: number; techoBandaConstruccion: number }
  }
  mercado: {
    demanda: string; zona: string; absorcion: string; proyectosActivos: string
    precioPromedioZona: string; perfilNSE: string; plusvalia: string; inventario: string
    productoRecomendado: string
    comparables?: Comparable[]
    segmentacion?: SegmentoUnidad[]
    pricingFases?: PricingFase[]
  }
  score: { total: number; solidezFinanciera: number; riesgoRegulatorio: number; exposicionMercado: number }
  stressTest: StressItem[]
  puntoQuiebre: { desviacionMaxCostos: string; absorcionMinViable: string; precioVentaMinimo: string; resumen: string }
  estructuraCapital?: EstructuraCapital
  flujoMensual?: FlujoMes[]
}

interface FormData {
  nombreProyecto: string; direccion: string; ciudad: string; colonia: string
  superficie: string; usoSuelo: string; estadoTerreno: string; presupuesto: string
}

const FALLBACK_A: AnalisisData = {
  recomendacion: { tipologia: 'Residencial Vertical · 48 departamentos', descripcion: '' },
  fichaLegal: { usoSuelo: 'Habitacional Plurifamiliar', cos: '60%', cus: '2.4', altura: '12 niveles', cajones: '1.2 por unidad', municipio: 'San Pedro Garza García', restriccion: '' },
  financiero: { costoTerreno: 8500000, costoTerrenoM2: 7083, construccionM2: 16500, costoTotalConstruccion: 23760000, indirectos: 3240000, honorarios: 1800000, imprevistos: 1188000, inversionTotal: 45200000, precioVentaM2: 38500, ingresosProyectados: 66780000, utilidadBruta: 12800000, margenBruto: 28.3, tir: 22.4 },
  mercado: { demanda: 'Alta', zona: 'Valle Oriente · San Pedro Garza García', absorcion: '8 unidades / mes', proyectosActivos: '4 proyectos en radio 500 m', precioPromedioZona: '$9,200 / m²', perfilNSE: 'A / B · 28–45 años', plusvalia: '+18%', inventario: '14 meses', productoRecomendado: 'Departamentos 2–3 rec. de 85–120 m²' },
  score: { total: 78, solidezFinanciera: 82, riesgoRegulatorio: 75, exposicionMercado: 71 },
  stressTest: [
    { titulo: 'Shock de Costos +15%', escenario: 'Costo total sube de $45.2 M a $49.8 M por incremento en materiales y mano de obra.', impacto: 'TIR: 22.4% → 17.8% · Margen: 28.3% → 20.1% · Proyecto sigue viable', status: 'amber' },
    { titulo: 'Freno de Ventas −50%', escenario: 'Absorción cae de 8 a 4 unidades/mes. Plazo se extiende 6 meses adicionales.', impacto: 'TIR: 22.4% → 14.1% · Margen: 28.3% → 22.4% · Viable con ajuste de plazo', status: 'amber' },
    { titulo: 'Ajuste de Mercado −10% en Precio', escenario: 'Precio de venta cae. Ingresos bajan considerablemente.', impacto: 'TIR: 22.4% → 9.8% · Margen: 28.3% → 12.6% · Al límite — revisar supuestos', status: 'red' },
  ],
  puntoQuiebre: { desviacionMaxCostos: '+28.4%', absorcionMinViable: '38%', precioVentaMinimo: '$29,800/m²', resumen: '' },
}

function fmt(n: number) { return `$${n.toLocaleString('es-MX')}` }
function fmtM(n: number) { return `$${(n / 1_000_000).toFixed(1)} M` }

function MetricRow({ label, value, valueClass = 'text-[#111d17]', border = true }: { label: string; value: React.ReactNode; valueClass?: string; border?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${border ? 'border-b border-[#F0F4F2]' : ''} last:border-0`}>
      <p className="text-[13px] text-[#5a7065]">{label}</p>
      <p className={`text-[13px] font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

// Portado de app/analisis/page.tsx (CashFlowChart) — SVG a mano, sin librería de gráficas.
function CashFlowChart({ data }: { data: FlujoMes[] }) {
  const W = 680, H = 220
  const pad = { top: 24, right: 16, bottom: 36, left: 72 }
  const iW = W - pad.left - pad.right
  const iH = H - pad.top - pad.bottom

  const maxEgreso  = Math.max(...data.map(d => d.egresos),  1)
  const maxIngreso = Math.max(...data.map(d => d.ingresos), 1)
  const maxBar     = Math.max(maxEgreso, maxIngreso)
  const minAcum    = Math.min(...data.map(d => d.acumulado))
  const maxAcum    = Math.max(...data.map(d => d.acumulado))
  const acumRange  = maxAcum - minAcum || 1

  const barW  = Math.max(4, iW / data.length - 3)
  const xPos  = (i: number) => pad.left + (i + 0.5) * (iW / data.length)
  const yLine = (v: number) => pad.top + ((maxAcum - v) / acumRange) * iH

  const zeroY = yLine(0)
  const linePts = data.map((d, i) => `${xPos(i)},${yLine(d.acumulado)}`).join(' ')

  const fmtCompacto = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}k`

  const ticks = [minAcum, minAcum + acumRange * 0.25, minAcum + acumRange * 0.5, minAcum + acumRange * 0.75, maxAcum]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.left} y1={yLine(t)} x2={W - pad.right} y2={yLine(t)} stroke="#F0F4F2" strokeWidth="1" />
          <text x={pad.left - 6} y={yLine(t) + 4} textAnchor="end" fontSize="9" fill="#b0bdb6">{fmtCompacto(t)}</text>
        </g>
      ))}

      {minAcum < 0 && maxAcum > 0 && (
        <line x1={pad.left} y1={zeroY} x2={W - pad.right} y2={zeroY} stroke="#E2E8E4" strokeWidth="1.5" strokeDasharray="4 3" />
      )}

      {data.map((d, i) => {
        const cx   = xPos(i)
        const half = barW / 2
        const hE   = (d.egresos  / maxBar) * (iH * 0.45)
        const hI   = (d.ingresos / maxBar) * (iH * 0.45)
        const midY = pad.top + iH * 0.5
        return (
          <g key={i}>
            {d.egresos  > 0 && <rect x={cx - half} y={midY}          width={barW} height={hE} rx="2" fill="#FCA5A5" />}
            {d.ingresos > 0 && <rect x={cx - half} y={midY - hI}     width={barW} height={hI} rx="2" fill="#6EE7B7" />}
          </g>
        )
      })}

      <polyline points={linePts} fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <circle key={i} cx={xPos(i)} cy={yLine(d.acumulado)} r="3"
          fill={d.acumulado >= 0 ? '#1D9E75' : '#DC2626'} stroke="white" strokeWidth="1.5" />
      ))}

      {data.map((d, i) => (
        (i === 0 || (i + 1) % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
          <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#9aab9f">M{d.mes}</text>
        )
      ))}

      <g transform={`translate(${pad.left}, ${H - 8})`}>
        <rect x="0" y="-7" width="8" height="8" rx="1" fill="#6EE7B7" />
        <text x="11" y="0" fontSize="9" fill="#5a7065">Ingresos</text>
        <rect x="64" y="-7" width="8" height="8" rx="1" fill="#FCA5A5" />
        <text x="75" y="0" fontSize="9" fill="#5a7065">Egresos</text>
        <line x1="128" y1="-3" x2="140" y2="-3" stroke="#1D9E75" strokeWidth="2.5" />
        <text x="143" y="0" fontSize="9" fill="#5a7065">Acumulado</text>
      </g>
    </svg>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#1A7A6E] tracking-[0.14em] uppercase mb-4 flex items-center gap-3">
      <span className="flex-1 border-t border-[rgba(0,0,0,0.08)]" />{children}<span className="flex-1 border-t border-[rgba(0,0,0,0.08)]" />
    </h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm ${className}`}>{children}</div>
}

function TableRow({ label, value, highlight = false, sub, alerta = false }: { label: string; value: string; highlight?: boolean; sub?: string; alerta?: boolean }) {
  return (
    <tr className={`${highlight ? 'bg-[#E1F5EE]' : ''} border-b border-[rgba(0,0,0,0.06)] last:border-0`}>
      <td className="px-6 py-3">
        <p className={`text-[13px] ${highlight ? 'font-bold text-[#04342C]' : 'text-[#5C7186]'}`}>{label}</p>
        {sub && <p className={`text-[11px] ${alerta ? 'text-[#D97706] font-medium' : 'text-[#9aab9f]'}`}>{sub}</p>}
      </td>
      <td className="px-6 py-3 text-right tabular-nums">
        <p className={`text-[13px] tabular-nums ${highlight ? 'font-bold text-[#04342C]' : 'font-semibold text-[#111d17]'}`}>{value}</p>
      </td>
    </tr>
  )
}

function ScoreArc({ score }: { score: number }) {
  const r = 46, circ = Math.PI * r, dash = (score / 100) * circ
  const color = score >= 70 ? '#1D9E75' : score >= 50 ? '#D97706' : '#DC2626'
  const label = score >= 70 ? 'Proyecto Viable' : score >= 50 ? 'Revisar Supuestos' : 'Riesgo Elevado'
  const labelColor = score >= 70 ? '#0F6E56' : score >= 50 ? '#92600A' : '#991B1B'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 120, height: 72 }}>
        <svg width="120" height="72" viewBox="0 0 120 72" fill="none" style={{ overflow: 'visible' }}>
          <path d="M 12 60 A 48 48 0 0 1 108 60" stroke="#E2E8E4" strokeWidth="10" strokeLinecap="round" fill="none"/>
          <path d="M 12 60 A 48 48 0 0 1 108 60" stroke={color} strokeWidth="10" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <span className="text-[28px] font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[10px] text-[#9aab9f]">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-bold" style={{ color: labelColor }}>{label}</span>
    </div>
  )
}

function StressRow({ titulo, escenario, impacto, status }: StressItem) {
  const cfg = {
    green: { badge: 'bg-[#E1F5EE] text-[#0F6E56]', dot: '#1D9E75', label: 'Tolerable' },
    amber: { badge: 'bg-[#FEF3C7] text-[#92600A]', dot: '#D97706', label: 'Monitorear' },
    red:   { badge: 'bg-[#FEE2E2] text-[#991B1B]', dot: '#DC2626', label: 'Crítico' },
  }[status]
  return (
    <div className="flex items-start gap-4 py-4 border-b border-[rgba(0,0,0,0.06)] last:border-0">
      <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: cfg.dot }} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[13px] font-bold text-[#111d17]">{titulo}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
        </div>
        <p className="text-[12px] text-[#5C7186] mb-1">{escenario}</p>
        <p className="text-[12px] font-semibold text-[#111d17]">{impacto}</p>
      </div>
    </div>
  )
}

// Colapsa contenido de "detalle" en la versión condensada (Camino corto) — mismo look que
// SectionTitle (líneas + etiqueta) pero interactivo, con chevron. `forzarAbierto` permite que
// el botón "Ver todo el detalle" del header expanda todas las secciones a la vez sin perder
// el estado individual de cada una (si el usuario ya la abrió, se queda abierta al des-forzar).
function Colapsable({ titulo, forzarAbierto, children }: { titulo: string; forzarAbierto: boolean; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const mostrar = forzarAbierto || abierto
  return (
    <div>
      <button onClick={() => setAbierto(v => !v)} className="w-full flex items-center gap-3 mb-4 cursor-pointer">
        <span className="flex-1 border-t border-[rgba(0,0,0,0.08)]" />
        <span className="text-[11px] font-bold text-[#1A7A6E] tracking-[0.14em] uppercase flex items-center gap-1.5">
          {titulo}
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" style={{ transform: mostrar ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
            <path d="M5 3l4 4-4 4" stroke="#1A7A6E" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="flex-1 border-t border-[rgba(0,0,0,0.08)]" />
      </button>
      {mostrar && children}
    </div>
  )
}

const USOS_LABEL: Record<string, string> = {
  habitacional: 'Habitacional', comercial: 'Comercial', mixto: 'Mixto',
  industrial: 'Industrial', agricola: 'Agrícola', 'sin-uso': 'Sin uso definido',
}
const ESTADO_LABEL: Record<string, string> = {
  'baldio-limpio': 'Baldío limpio', 'baldio-escombro': 'Baldío con escombro',
  construccion: 'Construcción existente', vegetacion: 'Vegetación densa',
}

function PropuestaContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || 'Proyecto de Inversión'
  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  const [d, setD] = useState<AnalisisData>(FALLBACK_A)
  const [form, setForm] = useState<(FormData & { _modoRapido?: boolean }) | null>(null)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [todoExpandido, setTodoExpandido] = useState(false)
  const modoRapido = form?._modoRapido === true

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    try {
      const proyectoId = localStorage.getItem('smt_proyecto_id') || undefined
      await downloadPDF(`propuesta-${proyecto.replace(/\s+/g, '-').toLowerCase()}.pdf`, proyectoId)
    } finally {
      setPdfLoading(false)
    }
  }

  useEffect(() => {
    const raw = localStorage.getItem('smt_analisis_data')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setD(parsed)
        setAiGenerated(true)
        if (!localStorage.getItem('smt_proyecto_id')) {
          const rawForm = localStorage.getItem('smt_flujo_a_data')
          const formData = rawForm ? JSON.parse(rawForm) : {}
          saveProyecto({ nombre: proyecto, datos: { ...parsed, _inputData: formData }, flujo: 'A' })
            .then(r => { if (r.ok && r.id) localStorage.setItem('smt_proyecto_id', r.id) })
            .catch(() => {})
        }
      } catch { /* fallback */ }
    }
    const rawForm = localStorage.getItem('smt_flujo_a_data')
    if (rawForm) {
      try { setForm(JSON.parse(rawForm)) } catch { /* ignore */ }
    }
  }, [])

  // Auto-guardar PDF en Mis Proyectos cuando carga la propuesta
  useEffect(() => {
    const proyectoId = localStorage.getItem('smt_proyecto_id') || undefined
    if (!proyectoId) return
    const filename = `propuesta-${proyecto.replace(/\s+/g, '-').toLowerCase()}.pdf`
    const timer = setTimeout(() => {
      autoSavePDF(filename, proyectoId).catch(err => console.warn('[propuesta-a] autoSave:', err))
    }, 3500)
    return () => clearTimeout(timer)
  }, [proyecto])

  const f = d.financiero

  return (
    <div className="min-h-screen bg-[#0b1d3a] flex flex-col">
      <header className="no-print px-8 py-4 flex items-center gap-3 border-b border-[#2a3f5c] bg-[#070f22] sticky top-0 z-20">
        <div className="w-8 h-8 rounded-lg bg-[#c9a227] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#070f22" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#070f22" strokeWidth="1" strokeOpacity="0.6"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] font-medium text-[#f4f0e6] tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-[#8b96ab] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {modoRapido && (
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2e2510] border border-[#7a5f1f] text-[#FBBF24] px-3 py-1 rounded-full">
              ⚡ Camino corto
            </span>
          )}
          {aiGenerated && (
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#c9a227]/15 border border-[#c9a227]/40 text-[#ddc06a] px-3 py-1 rounded-full">
              IA generado
            </span>
          )}
          {modoRapido && !todoExpandido && (
            <button onClick={() => setTodoExpandido(true)} className="no-print flex items-center gap-1.5 text-[13px] font-medium text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] hover:border-[#a68f52] px-3 py-1.5 rounded-xl transition-colors mr-1">
              Ver todo el detalle
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] hover:border-[#a68f52] px-3 py-1.5 rounded-xl transition-colors mr-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Mis Proyectos
          </button>
          <button
            onClick={() => router.push(`/analisis${proyecto !== 'Proyecto de Inversión' ? `?proyecto=${encodeURIComponent(proyecto)}` : ''}`)}
            className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] transition-colors mr-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver al Análisis
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl border transition-colors text-[#ddc06a] border-[#c9a227]/40 bg-[#c9a227]/10 hover:bg-[#c9a227] hover:text-[#070f22] hover:border-[#c9a227] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {pdfLoading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3"/>
                  <path d="M7 2a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Generando…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Descargar PDF
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div id="propuesta-print" className="w-full max-w-[800px] mx-auto flex flex-col gap-10">

          {/* 1 · Cover */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #091D30 0%, #0D2137 60%, #0a1c2e 100%)' }}>
            <div className="px-8 pt-8 pb-6 border-b border-white/10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1D9E75] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                      <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-white">SMT Developer</p>
                    <p className="text-[10px] text-white/40 tracking-[0.12em] uppercase">Inteligencia inmobiliaria</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75]/20 border border-[#1D9E75]/40 text-[#9FE1CB] px-3 py-1 rounded-full">Confidencial</span>
              </div>
              <p className="text-[11px] font-bold text-[#9FE1CB] tracking-[0.14em] uppercase mb-2">Propuesta de Inversión Estructurada</p>
              <h1 className="text-[34px] font-black text-white leading-tight mb-2">{proyecto}</h1>
              <p className="text-[14px] text-white/50">{form ? `${form.ciudad}${form.colonia ? ` · ${form.colonia}` : ''}` : d.mercado.zona} · {today}</p>
            </div>
            <div className="grid grid-cols-4 divide-x divide-white/10">
              {[
                { label: 'TIR Socio',         num: f.tir === null ? 'N/D' : `${f.tir.toFixed(1)}`,   sym: f.tir === null ? '' : '%' },
                { label: 'Inversión Total',   num: `$${(f.inversionTotal  / 1_000_000).toFixed(1)}`, sym: ' M'  },
                { label: 'Utilidad Bruta',    num: `$${(f.utilidadBruta   / 1_000_000).toFixed(1)}`, sym: ' M'  },
                { label: 'Score Resiliencia', num: `${d.score.total}`,                               sym: '/100' },
              ].map((m, i) => (
                <div key={i} className="px-6 py-5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className="text-[24px] font-black leading-none text-white tabular-nums">
                    {m.num}<span className="text-[#5DCAA5] text-[16px] font-bold">{m.sym}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 2 · Resumen Ejecutivo */}
          <div>
            <SectionTitle>Resumen Ejecutivo</SectionTitle>
            <Card className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'TIR Socio',           num: f.tir === null ? 'N/D' : `${f.tir.toFixed(1)}`, sym: f.tir === null ? '' : '%', sub: 'caso base', dark: true },
                  { label: 'Inversión Total',      num: `$${(f.inversionTotal / 1_000_000).toFixed(1)}`, sym: ' M', sub: 'MXN',          dark: false },
                  { label: 'Utilidad Proyectada',  num: `$${(f.utilidadBruta  / 1_000_000).toFixed(1)}`, sym: ' M', sub: 'MXN bruto',    dark: false },
                  { label: 'Score Resiliencia',    num: `${d.score.total}`, sym: '',   sub: '/ 100 · Viable', dark: false },
                ].map((m, i) => (
                  <div key={i} className={`rounded-2xl p-5 border ${m.dark ? 'bg-[#0D2137] border-[#1A7A6E]/40' : 'bg-white border-[rgba(0,0,0,0.08)]'}`}>
                    <p className={`text-[10px] font-semibold tracking-[0.14em] uppercase mb-2 ${m.dark ? 'text-[#5DCAA5]' : 'text-[#9aab9f]'}`}>{m.label}</p>
                    <p className={`text-[24px] font-black leading-none tabular-nums ${m.dark ? 'text-white' : 'text-[#111d17]'}`}>
                      {m.num}{m.sym && <span className={`text-[16px] font-bold ${m.dark ? 'text-[#5DCAA5]' : 'text-[#5C7186]'}`}>{m.sym}</span>}
                    </p>
                    <p className={`text-[11px] mt-1 ${m.dark ? 'text-white/40' : 'text-[#9aab9f]'}`}>{m.sub}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#F7F8F6] rounded-xl px-5 py-4 border border-[rgba(0,0,0,0.08)]">
                <p className="text-[14px] text-[#5C7186] leading-relaxed">
                  El proyecto <strong className="text-[#111d17]">{proyecto}</strong>{form ? ` ubicado en ${form.ciudad}${form.colonia ? `, ${form.colonia}` : ''}` : ''} tiene una tipología recomendada de <strong className="text-[#111d17]">{d.recomendacion.tipologia}</strong>.
                  Con una inversión total de <strong className="text-[#111d17]">{fmt(f.inversionTotal)}</strong> y precio de venta estimado de {fmt(f.precioVentaM2)}/m², el proyecto genera una{' '}
                  <strong className="text-[#0F6E56]">TIR Socio {f.tir === null ? 'no calculable' : `del ${f.tir.toFixed(1)}% anual`}</strong> y una utilidad bruta de {fmt(f.utilidadBruta)}.
                  El Score de Resiliencia de <strong className="text-[#0F6E56]">{d.score.total}/100</strong> confirma viabilidad ante desviaciones moderadas en costos, absorción y precio de mercado.
                </p>
              </div>
            </Card>
          </div>

          {/* 3 · El Terreno */}
          {form && (() => {
            const contenido = (
              <Card className="p-0 overflow-hidden">
                <table className="w-full">
                  <tbody>
                    <TableRow label="Dirección" value={form.direccion || '—'} sub={`${form.colonia ? form.colonia + ', ' : ''}${form.ciudad}`} />
                    <TableRow label="Superficie total" value={form.superficie ? `${Number(form.superficie).toLocaleString('es-MX')} m²` : '—'} />
                    <TableRow label="Uso de suelo actual" value={USOS_LABEL[form.usoSuelo] || form.usoSuelo || '—'} />
                    <TableRow label="Estado del predio" value={ESTADO_LABEL[form.estadoTerreno] || form.estadoTerreno || '—'} />
                    <TableRow label="Municipio" value={d.fichaLegal.municipio} />
                    <TableRow label="Precio de adquisición" value={fmt(f.costoTerreno)} />
                    <TableRow label="Precio por m²" value={`${fmt(f.costoTerrenoM2)} / m²`} />
                  </tbody>
                </table>
              </Card>
            )
            return modoRapido ? (
              <Colapsable titulo="El Terreno" forzarAbierto={todoExpandido}>{contenido}</Colapsable>
            ) : (
              <div><SectionTitle>El Terreno</SectionTitle>{contenido}</div>
            )
          })()}

          {/* 4 · Marco Legal y Normativo */}
          {(() => {
            const contenido = (
              <Card className="p-6">
              {/* Uso de suelo actual vs. permitido */}
              {(d.fichaLegal.usoSueloActual || d.fichaLegal.usoSueloPermitido) && (
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wide mb-3">Uso de suelo</p>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="bg-[#F7F8F6] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3">
                      <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-1">Actual</p>
                      <p className="text-[13px] font-semibold text-[#111d17]">{d.fichaLegal.usoSueloActual || '—'}</p>
                    </div>
                    <div className={`border rounded-xl px-4 py-3 ${d.fichaLegal.compatible === false ? 'bg-[#FFF5F5] border-[#FECACA]' : 'bg-[#F0FBF6] border-[#9FE1CB]'}`}>
                      <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-1">Permitido (PDU)</p>
                      <p className="text-[13px] font-semibold text-[#111d17]">{d.fichaLegal.usoSueloPermitido || d.fichaLegal.usoSuelo || '—'}</p>
                      {d.fichaLegal.compatible === false && <span className="text-[10px] font-bold text-[#991B1B]">Requiere cambio de uso</span>}
                    </div>
                  </div>
                  {d.fichaLegal.densidadAutorizada && (
                    <p className="text-[12px] text-[#5C7186] px-1">Densidad autorizada: <strong className="text-[#111d17]">{d.fichaLegal.densidadAutorizada}</strong></p>
                  )}
                </div>
              )}

              {/* Parámetros normativos */}
              <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wide mb-3">Parámetros normativos</p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'COS', value: d.fichaLegal.cos },
                  { label: 'CUS', value: d.fichaLegal.cus },
                  { label: 'Altura máx.', value: d.fichaLegal.altura },
                  { label: 'Cajones', value: d.fichaLegal.cajones },
                  ...(d.fichaLegal.retiros ? [{ label: 'Retiros', value: d.fichaLegal.retiros }] : []),
                  { label: 'Municipio', value: d.fichaLegal.municipio },
                ].map((item, i) => (
                  <div key={i} className="bg-[#F7F8F6] border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className="text-[13px] font-semibold text-[#111d17]">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Factibilidades */}
              {d.fichaLegal.factibilidades && (
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wide mb-3">Factibilidades de servicios</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['agua', 'drenaje', 'cfe'] as const).map(srv => {
                      const fac = d.fichaLegal.factibilidades![srv]
                      const c = fac.status === 'Disponible'
                        ? { bg: 'bg-[#F0FBF6]', border: 'border-[#9FE1CB]', dot: '#1D9E75', text: 'text-[#0F6E56]' }
                        : fac.status === 'Con condicionante'
                        ? { bg: 'bg-[#FFFBEB]', border: 'border-[#F5D97A]', dot: '#D97706', text: 'text-[#92600A]' }
                        : { bg: 'bg-[#FFF5F5]', border: 'border-[#FECACA]', dot: '#DC2626', text: 'text-[#991B1B]' }
                      const label = { agua: 'Agua potable', drenaje: 'Drenaje', cfe: 'CFE' }
                      return (
                        <div key={srv} className={`${c.bg} border ${c.border} rounded-xl p-3`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
                            <p className="text-[11px] font-bold text-[#111d17]">{label[srv]}</p>
                          </div>
                          <p className={`text-[10px] font-semibold ${c.text}`}>{fac.status}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Régimen de condominio */}
              {d.fichaLegal.regimenCondominio && (
                <div className="mb-4 bg-[#F7F8F6] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide mb-1">Régimen de condominio</p>
                  <p className="text-[12px] text-[#111d17]">{d.fichaLegal.regimenCondominio}</p>
                </div>
              )}

              {/* Restricción + ambiental */}
              <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#F5D97A] rounded-xl px-4 py-3 mb-3">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                  <path d="M7 2L12.5 11.5H1.5L7 2Z" stroke="#D97706" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M7 6v3" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="10" r="0.5" fill="#D97706"/>
                </svg>
                <p className="text-[12px] text-[#92600A]"><strong>Restricción principal:</strong> {d.fichaLegal.restriccion}</p>
              </div>

              {/* Alertas legales */}
              {d.fichaLegal.alertasLegales && d.fichaLegal.alertasLegales.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wide mb-2">
                    Alertas legales
                    {d.fichaLegal.nivelRiesgo && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${d.fichaLegal.nivelRiesgo === 'Alto' ? 'bg-[#FEE2E2] text-[#991B1B]' : d.fichaLegal.nivelRiesgo === 'Medio' ? 'bg-[#FEF3C7] text-[#92600A]' : 'bg-[#E1F5EE] text-[#0F6E56]'}`}>
                        Riesgo {d.fichaLegal.nivelRiesgo}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col gap-2">
                    {d.fichaLegal.alertasLegales.map((a, i) => {
                      const ac = a.status === 'red'
                        ? { bg: 'bg-[#FFF5F5]', border: 'border-[#FECACA]', dot: '#DC2626', badge: 'bg-[#FEE2E2] text-[#991B1B]', label: 'Crítico' }
                        : a.status === 'amber'
                        ? { bg: 'bg-[#FFFBEB]', border: 'border-[#F5D97A]', dot: '#D97706', badge: 'bg-[#FEF3C7] text-[#92600A]', label: 'Manejable' }
                        : { bg: 'bg-[#F0FBF6]', border: 'border-[#9FE1CB]', dot: '#1D9E75', badge: 'bg-[#E1F5EE] text-[#0F6E56]', label: 'Sin impacto' }
                      return (
                        <div key={i} className={`${ac.bg} border ${ac.border} rounded-xl px-4 py-3`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ac.dot }} />
                              <p className="text-[13px] font-bold text-[#111d17]">{a.tipo}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ac.badge}`}>{ac.label}</span>
                          </div>
                          <p className="text-[12px] text-[#5C7186] mb-1">{a.descripcion}</p>
                          <p className="text-[12px] font-semibold text-[#111d17]">{a.impacto}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              </Card>
            )
            return (
              <div>
                {/* En Camino corto, el riesgo Alto se asoma aunque el bloque legal esté colapsado */}
                {modoRapido && d.fichaLegal.nivelRiesgo === 'Alto' && (
                  <div className="mb-4 flex items-center gap-2 bg-[#FEE2E2] border border-[#FECACA] rounded-xl px-4 py-3">
                    <span className="w-2 h-2 rounded-full bg-[#DC2626] shrink-0" />
                    <p className="text-[12px] font-semibold text-[#991B1B]">Riesgo legal Alto — revisa el detalle antes de avanzar.</p>
                  </div>
                )}
                {modoRapido ? (
                  <Colapsable titulo="Marco Legal y Normativo" forzarAbierto={todoExpandido}>{contenido}</Colapsable>
                ) : (
                  <><SectionTitle>Marco Legal y Normativo</SectionTitle>{contenido}</>
                )}
              </div>
            )
          })()}

          {/* 6 · Recomendación Estratégica */}
          <div>
            <SectionTitle>Recomendación Estratégica</SectionTitle>
            <Card className="p-6">
              <div className="flex items-start gap-5 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-[#E1F5EE] flex items-center justify-center shrink-0">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#1D9E75" strokeWidth="1.8"/>
                    <path d="M3 9h18M9 21V9" stroke="#1D9E75" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#1D9E75] tracking-[0.12em] uppercase mb-1">Tipología recomendada</p>
                  <h3 className="text-[22px] font-bold text-[#111d17] mb-1">{d.recomendacion.tipologia}</h3>
                  <p className="text-[13px] text-[#5C7186]">{d.mercado.zona}</p>
                </div>
              </div>
              <p className="text-[14px] text-[#5C7186] leading-relaxed">{d.recomendacion.descripcion}</p>
            </Card>
          </div>

          {/* 7 · Estructura Financiera */}
          {(() => {
            const contenido = (
              <Card className="p-0 overflow-hidden">
                <table className="w-full">
                  <tbody>
                    <TableRow label="Costo del terreno" value={fmt(f.costoTerreno)} sub={`${fmt(f.costoTerrenoM2)} / m²`} />
                    <TableRow label="Construcción por m²" value={`${fmt(f.construccionM2)} / m²`} />
                    <TableRow label="Costo total de construcción" value={fmt(f.costoTotalConstruccion)} sub={f.escaladoPorMix && f.escaladoPorMix.factorEscalaMix < 1 ? `Ajustado al ${f.escaladoPorMix.eficienciaMixPct}% que aprovecha el mix de unidades` : undefined} alerta={!!(f.escaladoPorMix && f.escaladoPorMix.factorEscalaMix < 1)} />
                    <TableRow label="Indirectos y administración" value={fmt(f.indirectos)} sub={`${f.costoTotalConstruccion > 0 ? ((f.indirectos / f.costoTotalConstruccion) * 100).toFixed(1) : '0'}% sobre costo de obra`} alerta={!!f.validacionIndirectos?.indirectosFueraDeRango} />
                    <TableRow label="Honorarios y diseño" value={fmt(f.honorarios)} sub={`${f.costoTotalConstruccion > 0 ? ((f.honorarios / f.costoTotalConstruccion) * 100).toFixed(1) : '0'}% sobre costo de obra`} alerta={!!f.validacionIndirectos?.honorariosFueraDeRango} />
                    <TableRow label="Imprevistos (5%)" value={fmt(f.imprevistos)} sub="Reserva de contingencia" />
                    <TableRow label="Inversión Total" value={fmt(f.inversionTotal)} highlight />
                    <TableRow label="Precio de venta estimado / m²" value={`${fmt(f.precioVentaM2)} / m²`} sub={f.precioVentaAjustadoPorBanda ? 'Ajustado a un valor representativo de tu banda de construcción' : `Mercado ${d.mercado.zona}`} alerta={!!f.precioVentaAjustadoPorBanda} />
                    <TableRow label="Ingresos proyectados (100%)" value={fmt(f.ingresosProyectados)} />
                    <TableRow label="Utilidad bruta" value={fmt(f.utilidadBruta)} />
                    <TableRow label="Margen bruto sobre inversión" value={`${f.margenBruto}%`} highlight />
                  </tbody>
                </table>
              </Card>
            )
            return modoRapido ? (
              <Colapsable titulo="Estructura Financiera" forzarAbierto={todoExpandido}>{contenido}</Colapsable>
            ) : (
              <div><SectionTitle>Estructura Financiera</SectionTitle>{contenido}</div>
            )
          })()}

          {/* 7b · Estructura de Capital — cómo se financia el proyecto (equity/deuda) */}
          {d.estructuraCapital && (() => {
            const ec = d.estructuraCapital
            const contenido = (
              <Card>
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-[#0F6E56]">Equity {ec.equity}%</span>
                    <span className="text-[11px] font-bold text-[#4F46E5]">Deuda {ec.deuda}%</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div className="bg-[#1D9E75]" style={{ width: `${ec.equity}%` }} />
                    <div className="bg-[#4F46E5]" style={{ width: `${ec.deuda}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-[#5C7186]">{fmt(ec.montoEquity)}</span>
                    <span className="text-[11px] text-[#5C7186]">{fmt(ec.montoDeuda)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 mb-5 divide-y divide-[#F0F4F2]">
                  <MetricRow label="Tipo de deuda" value={ec.tipoDeuda} />
                  <MetricRow label="Tasa de interés" value={ec.tasaDeuda} />
                  <MetricRow label="Costo financiero" value={fmt(ec.costoFinanciero)} />
                  <MetricRow label="TIR — tipo" value={ec.tasaDescuento} />
                  <MetricRow label="ISR estimado (30%)" value={fmt(ec.isrEstimado)} />
                  <MetricRow label="Utilidad neta" value={fmt(ec.utilidadNeta)} valueClass="text-[#0F6E56] font-bold" />
                </div>

                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl px-4 py-4">
                  <p className="text-[11px] font-bold text-[#3730A3] uppercase tracking-wide mb-2">Preventa mínima para crédito puente</p>
                  <div className="flex items-center gap-6 mb-2">
                    <div>
                      <p className="text-[28px] font-black text-[#4F46E5] leading-none">{ec.preventa.unidadesMinimas}</p>
                      <p className="text-[11px] text-[#6366F1]">unidades · {ec.preventa.porcentajeMinimo}</p>
                    </div>
                    <div>
                      <p className="text-[18px] font-bold text-[#4F46E5] leading-none">{fmt(ec.preventa.montoMinimo)}</p>
                      <p className="text-[11px] text-[#6366F1]">ingreso mínimo en preventa</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-[#4338CA]">{ec.preventa.condicion}</p>
                </div>

                {ec.descripcion && (
                  <p className="text-[12px] text-[#5C7186] mt-4 px-1 leading-relaxed">{ec.descripcion}</p>
                )}
              </Card>
            )
            return modoRapido ? (
              <Colapsable titulo="Estructura de Capital" forzarAbierto={todoExpandido}>{contenido}</Colapsable>
            ) : (
              <div><SectionTitle>Estructura de Capital</SectionTitle>{contenido}</div>
            )
          })()}

          {/* 7c · Flujo de Caja Proyectado */}
          {d.flujoMensual && d.flujoMensual.length > 0 && (() => {
            const contenido = (
              <>
                <Card className="pb-4 mb-0">
                  <CashFlowChart data={d.flujoMensual!} />
                </Card>
                <Card className="p-0 overflow-hidden mt-3">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[#F7F8F6] border-b border-[rgba(0,0,0,0.08)]">
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide w-12">Mes</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide">Fase</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-[#DC2626] uppercase tracking-wide">Egresos</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-[#0F6E56] uppercase tracking-wide">Ingresos</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.flujoMensual!.map((row, i) => {
                        const positivo = row.acumulado >= 0
                        return (
                          <tr key={i} className={`border-b border-[rgba(0,0,0,0.06)] last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFA]'}`}>
                            <td className="px-4 py-3 text-center">
                              <span className="text-[11px] font-bold text-[#9aab9f]">{row.mes}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[12px] font-semibold text-[#111d17]">{row.fase}</p>
                              <p className="text-[10px] text-[#9aab9f] leading-snug">{row.nota}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.egresos > 0 && <span className="text-[12px] font-semibold text-[#DC2626]">−{fmt(row.egresos)}</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.ingresos > 0 && <span className="text-[12px] font-semibold text-[#0F6E56]">+{fmt(row.ingresos)}</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-[12px] font-bold ${positivo ? 'text-[#0F6E56]' : 'text-[#DC2626]'}`}>
                                {positivo ? '+' : ''}{fmt(row.acumulado)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Card>
              </>
            )
            return modoRapido ? (
              <Colapsable titulo="Flujo de Caja Proyectado" forzarAbierto={todoExpandido}>{contenido}</Colapsable>
            ) : (
              <div><SectionTitle>Flujo de Caja Proyectado</SectionTitle>{contenido}</div>
            )
          })()}

          {/* 7 · Análisis de Mercado */}
          <div>
            <SectionTitle>Análisis de Mercado</SectionTitle>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#9FE1CB]">
                  <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />Demanda {d.mercado.demanda}
                </span>
                <span className="text-[12px] text-[#5C7186]">{d.mercado.zona}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-10 mb-5">
                {[
                  { label: 'Velocidad de absorción', value: d.mercado.absorcion, green: true },
                  { label: 'Proyectos activos radio 500 m', value: d.mercado.proyectosActivos },
                  { label: 'Precio promedio zona', value: d.mercado.precioPromedioZona },
                  { label: 'Perfil comprador NSE', value: d.mercado.perfilNSE },
                  { label: 'Plusvalía últimos 3 años', value: d.mercado.plusvalia, green: true },
                  { label: 'Inventario promedio activo', value: d.mercado.inventario },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-[rgba(0,0,0,0.06)] last:border-0">
                    <p className="text-[13px] text-[#5C7186]">{item.label}</p>
                    <p className={`text-[13px] font-semibold ${(item as { green?: boolean }).green ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#F0FBF6] border border-[#D4EFE3] rounded-xl px-4 py-3 mb-5">
                <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wide mb-1">Producto recomendado</p>
                <p className="text-[15px] font-bold text-[#111d17]">{d.mercado.productoRecomendado}</p>
              </div>

              {(() => {
              const detalleMercado = (
                <>
              {/* Comparables */}
              {d.mercado.comparables && d.mercado.comparables.length > 0 && (
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wide mb-3">Proyectos comparables</p>
                  <div className="flex flex-col gap-2">
                    {d.mercado.comparables.map((c, i) => (
                      <div key={i} className="bg-[#F7F8F6] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-[13px] font-semibold text-[#111d17]">{c.nombre}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${c.avanceObra === 'Entregado' ? 'bg-[#E1F5EE] text-[#0F6E56]' : c.avanceObra === 'En obra' ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#EEF2FF] text-[#4F46E5]'}`}>{c.avanceObra}</span>
                        </div>
                        <p className="text-[11px] text-[#8a9e92] mb-1.5">{c.direccion} · {c.fechaReferencia}</p>
                        <div className="flex gap-5">
                          {c.precioM2 != null && <span className="text-[11px] text-[#5C7186]">Precio: <strong className="text-[#111d17]">${c.precioM2.toLocaleString('es-MX')}/m²</strong></span>}
                          <span className="text-[11px] text-[#5C7186]">{c.tipologia}</span>
                          <span className="text-[11px] text-[#5C7186]">{c.unidades} unidades</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Segmentación */}
              {d.mercado.segmentacion && d.mercado.segmentacion.length > 0 && (
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wide mb-3">Segmentación por tipo de unidad</p>
                  <div className="flex flex-col gap-2">
                    {d.mercado.segmentacion.map((s, i) => (
                      <div key={i} className="bg-[#F7F8F6] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[13px] font-semibold text-[#111d17]">{s.tipo}</p>
                          <span className="text-[12px] font-bold text-[#0F6E56]">{s.participacion}</span>
                        </div>
                        <div className="h-1.5 bg-[#E2E8E4] rounded-full overflow-hidden mb-2">
                          <div className="h-full bg-[#1D9E75] rounded-full" style={{ width: s.participacion }} />
                        </div>
                        <div className="flex gap-5">
                          <span className="text-[11px] text-[#5C7186]">Precio: <strong className="text-[#111d17]">${s.precioM2.toLocaleString('es-MX')}/m²</strong></span>
                          <span className="text-[11px] text-[#5C7186]">Absorción: <strong className="text-[#111d17]">{s.absorcionMensual}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing por fase */}
              {d.mercado.pricingFases && d.mercado.pricingFases.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wide mb-3">Estrategia de pricing por fase</p>
                  <div className="grid grid-cols-3 gap-3">
                    {d.mercado.pricingFases.map((fase, i) => (
                      <div key={i} className="bg-[#F7F8F6] border border-[rgba(0,0,0,0.08)] rounded-xl p-3">
                        <p className="text-[11px] font-bold text-[#5C7186] mb-1">{fase.fase}</p>
                        <p className="text-[18px] font-black text-[#111d17] leading-none">${fase.precioM2.toLocaleString('es-MX')}</p>
                        <p className="text-[10px] text-[#9aab9f] mb-2">/m²</p>
                        <span className="text-[10px] font-bold bg-[#FEF3C7] text-[#92600A] px-2 py-0.5 rounded-full">{fase.descuento}</span>
                        <p className="text-[10px] text-[#8a9e92] mt-2 leading-snug">{fase.meta}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )
              return modoRapido ? (
                <Colapsable titulo="Ver comparables, segmentación y pricing" forzarAbierto={todoExpandido}>{detalleMercado}</Colapsable>
              ) : detalleMercado
              })()}
            </Card>
          </div>

          {/* 7 · Mitigación y Resiliencia */}
          <div>
            <SectionTitle>Mitigación y Resiliencia</SectionTitle>
            <Card className="p-6">
              <div className="flex items-start gap-8 mb-6 pb-6 border-b border-[rgba(0,0,0,0.06)]">
                <div className="shrink-0"><ScoreArc score={d.score.total} /></div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-[#111d17] mb-2">Score de Resiliencia: {d.score.total}/100</p>
                  <p className="text-[13px] text-[#5C7186] leading-relaxed mb-4">{d.puntoQuiebre.resumen}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Solidez financiera', v: d.score.solidezFinanciera },
                      { label: 'Riesgo regulatorio', v: d.score.riesgoRegulatorio },
                      { label: 'Exposición mercado', v: d.score.exposicionMercado },
                    ].map(item => {
                      const color = item.v >= 70 ? '#1D9E75' : '#D97706'
                      return (
                        <div key={item.label} className="bg-[#F7F8F6] rounded-xl p-3 border border-[rgba(0,0,0,0.08)]">
                          <p className="text-[10px] text-[#9aab9f] mb-2">{item.label}</p>
                          <div className="h-1.5 bg-[#E2E8E4] rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.v}%`, backgroundColor: color }} />
                          </div>
                          <p className="text-[12px] font-bold" style={{ color }}>{item.v}/100</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {(() => {
              const detalleResiliencia = (
                <>
              <p className="text-[10px] font-bold text-[#9aab9f] tracking-[0.12em] uppercase mb-2">Stress Test — Escenarios Adversos</p>
              <div>{d.stressTest.map((s, i) => <StressRow key={i} {...s} />)}</div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Desviación máx. costos', value: d.puntoQuiebre.desviacionMaxCostos, color: '#1D9E75' },
                  { label: 'Absorción mínima viable', value: d.puntoQuiebre.absorcionMinViable, color: '#D97706' },
                  { label: 'Precio venta mínimo', value: d.puntoQuiebre.precioVentaMinimo, color: '#D97706' },
                ].map(b => (
                  <div key={b.label} className="bg-[#F7F8F6] border border-[rgba(0,0,0,0.08)] rounded-xl p-4 text-center">
                    <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-2">{b.label}</p>
                    <p className="text-[20px] font-black" style={{ color: b.color }}>{b.value}</p>
                  </div>
                ))}
              </div>
                </>
              )
              return modoRapido ? (
                <Colapsable titulo="Ver stress test y punto de quiebre" forzarAbierto={todoExpandido}>{detalleResiliencia}</Colapsable>
              ) : detalleResiliencia
              })()}
            </Card>
          </div>

          {/* 8 · Próximos Pasos */}
          {(() => {
            const contenido = (
              <Card className="p-6">
                <div className="flex flex-col gap-4">
                  {[
                    { n: '01', title: 'Completar debida diligencia', desc: 'Obtener escrituras notariales, constancia de uso de suelo, estudio de suelo y factibilidad de servicios. Plazo estimado: 3–4 semanas.', color: '#1D9E75' },
                    { n: '02', title: 'Estructurar esquema de capital', desc: 'Definir la mezcla equity / crédito puente (propuesta: 40% / 60%). Contactar instituciones financieras para carta de intención de crédito.', color: '#1D9E75' },
                    { n: '03', title: 'Formalizar adquisición del terreno', desc: 'Firma de promesa de compraventa con condicionantes de debida diligencia. Depósito en garantía: 5% del precio de adquisición.', color: '#D97706' },
                    { n: '04', title: 'Iniciar diseño arquitectónico y permisos', desc: 'Contratar despacho de arquitectura para proyecto ejecutivo. Gestionar licencia de construcción ante municipio. Plazo estimado: 2–3 meses.', color: '#D97706' },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[13px] text-white" style={{ backgroundColor: s.color }}>{s.n}</div>
                      <div className="flex-1 pt-0.5">
                        <p className="text-[14px] font-bold text-[#111d17] mb-1">{s.title}</p>
                        <p className="text-[13px] text-[#5C7186] leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
            return modoRapido ? (
              <Colapsable titulo="Próximos Pasos" forzarAbierto={todoExpandido}>{contenido}</Colapsable>
            ) : (
              <div><SectionTitle>Próximos Pasos</SectionTitle>{contenido}</div>
            )
          })()}

          {/* 9 · Footer */}
          <div className="rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.08)]">
            <div className="bg-[#0D2137] px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1D9E75] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                    <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">SMT Developer</p>
                  <p className="text-[11px] text-white/40">Inteligencia inmobiliaria</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/40">Generado el {today}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Análisis Mastermind v1.0</p>
              </div>
            </div>
            <div className="bg-white px-8 py-4">
              <p className="text-[11px] text-[#9aab9f] leading-relaxed">
                <strong className="text-[#5C7186]">Aviso de confidencialidad:</strong> Este documento ha sido generado por SMT Developer con base en información de mercado disponible al {today} y constituye una proyección con fines informativos para inversionistas calificados. Las cifras presentadas son estimaciones y no garantizan rendimientos futuros.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

export default function PropuestaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b1d3a] flex items-center justify-center"><p className="text-[#5f6a80]">Generando propuesta…</p></div>}>
      <PropuestaContent />
    </Suspense>
  )
}
