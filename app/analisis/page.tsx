'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import FuentesConsultadas from '@/app/components/FuentesConsultadas'
import { authedFetch } from '@/lib/apiClient'
import { BocetoVolumetria, VistaAereaTerreno } from '@/app/components/BocetoVolumetria'
import type { AnalisisData, StressItem, FlujoMes } from '@/lib/analisis/tipos'
import { resolveBitacoraArquitectura } from '@/lib/analisis/bitacoraArquitectura'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

const AMENIDADES_NIVEL_LABELS: Record<string, string> = {
  '1': 'Mínimas', '2': 'Intermedias', '3': 'Top',
}

const FALLBACK: AnalisisData = {
  recomendacion: {
    tipologia: 'Residencial Vertical · 48 departamentos',
    descripcion: 'Con base en el análisis normativo (CUS 2.4, 12 niveles permitidos), la demanda activa en Valle Oriente y el perfil de comprador NSE A/B de 28–45 años, la tipología óptima es un edificio de departamentos de 2 y 3 recámaras en rangos de 85–120 m². Esta configuración maximiza el área vendible, logra la absorción proyectada de 8 unidades/mes y produce una TIR del 22.4% con margen bruto del 31.2%.',
  },
  fichaLegal: { usoSuelo: 'Habitacional Plurifamiliar', cos: '60%', cus: '2.4', altura: '12 niveles', cajones: '1.2 por unidad', municipio: 'San Pedro Garza García', restriccion: 'Retiro mínimo de 5 m frente a vialidad primaria. Impacta área de planta baja.' },
  financiero: { costoTerreno: 8500000, costoTerrenoM2: 7083, construccionM2: 16500, costoTotalConstruccion: 23760000, indirectos: 3240000, honorarios: 1800000, imprevistos: 1188000, inversionTotal: 45200000, precioVentaM2: 38500, ingresosProyectados: 66780000, utilidadBruta: 21580000, margenBruto: 47.7, tir: 22.4 },
  mercado: { demanda: 'Alta', zona: 'Valle Oriente · San Pedro Garza García', absorcion: '8 unidades / mes', proyectosActivos: '4 proyectos en radio 500 m', precioPromedioZona: '$9,200 / m²', perfilNSE: 'A / B · 28–45 años', plusvalia: '+18%', inventario: '14 meses', productoRecomendado: 'Departamentos 2–3 rec. de 85–120 m² con terraza y 1–2 cajones' },
  score: { total: 78, solidezFinanciera: 82, riesgoRegulatorio: 75, exposicionMercado: 71 },
  stressTest: [
    { titulo: 'Shock de Costos +15%', escenario: 'Incremento generalizado en materiales y mano de obra del 15% sobre el presupuesto base. Costo total sube de $45.2 M a $49.8 M.', impacto: 'TIR baja de 22.4% → 17.8% · Margen: 47.7% → 38.4% · Proyecto sigue viable', status: 'amber' },
    { titulo: 'Freno de Ventas −50%', escenario: 'Absorción cae de 8 a 4 unidades/mes. Plazo se extiende de 6 a 12 meses. Costo financiero adicional estimado: $2.1 M.', impacto: 'TIR baja de 22.4% → 14.1% · Margen: 47.7% → 39.2% · Proyecto sigue viable con ajuste de plazo', status: 'amber' },
    { titulo: 'Ajuste de Mercado −10% en Precio', escenario: 'Precio de venta cae de $38,500 a $34,650/m² por corrección de mercado. Ingresos bajan de $66.8 M a $60.1 M.', impacto: 'TIR baja de 22.4% → 9.8% · Margen: 47.7% → 24.5% · Proyecto al límite — revisar supuestos', status: 'red' },
  ],
  puntoQuiebre: { desviacionMaxCostos: '+28.4%', absorcionMinViable: '38%', precioVentaMinimo: '$29,800/m²', resumen: 'El proyecto mantiene viabilidad en el 87% de los escenarios simulados. La principal vulnerabilidad es una caída sostenida en precio de venta mayor al 22.4%.' },
}

function fmt(n: number) { return `$${n.toLocaleString('es-MX')}` }
// Versión corta para montos grandes en espacios chicos (hero banner) — $276,150,214 no cabe
// en una columna angosta sin desbordarse, $276.2M sí.
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

function CheckIcon({ color = '#1D9E75' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7l3 3 6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-bold text-[#5f6a80] tracking-[0.12em] uppercase mb-4">{children}</h2>
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm p-6 ${className}`}>{children}</div>
}

function MetricRow({ label, value, valueClass = 'text-[#f4f0e6]', border = true }: { label: string; value: React.ReactNode; valueClass?: string; border?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${border ? 'border-b border-[#2a3f5c]' : ''} last:border-0`}>
      <p className="text-[13px] text-[#8b96ab]">{label}</p>
      <p className={`text-[13px] font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

function ScoreGauge({ score }: { score: number }) {
  const r = 54
  const circ = Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#1D9E75' : score >= 50 ? '#D97706' : '#DC2626'
  const label = score >= 70 ? 'Proyecto Viable' : score >= 50 ? 'Revisar Supuestos' : 'Riesgo Elevado'
  const labelColor = score >= 70 ? 'text-[#4ADE80]' : score >= 50 ? 'text-[#92600A]' : 'text-red-700'
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 90 }}>
        <svg width="140" height="90" viewBox="0 0 140 90" fill="none">
          <path d="M 16 74 A 54 54 0 0 1 124 74" stroke="#2a3f5c" strokeWidth="12" strokeLinecap="round" fill="none"/>
          <path d="M 16 74 A 54 54 0 0 1 124 74" stroke={color} strokeWidth="12" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1">
          <span className="text-[32px] font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[11px] text-[#5f6a80]">/ 100</span>
        </div>
      </div>
      <span className={`text-[12px] font-bold mt-2 ${labelColor}`}>{label}</span>
    </div>
  )
}

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
  const yBar  = (v: number) => iH - (v / maxBar) * iH
  const yLine = (v: number) => pad.top + ((maxAcum - v) / acumRange) * iH

  const zeroY = yLine(0)

  const linePts = data.map((d, i) => `${xPos(i)},${yLine(d.acumulado)}`).join(' ')

  const fmt = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}k`

  // y-axis ticks (acumulado)
  const ticks = [minAcum, minAcum + acumRange * 0.25, minAcum + acumRange * 0.5, minAcum + acumRange * 0.75, maxAcum]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      {/* Grid lines */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.left} y1={yLine(t)} x2={W - pad.right} y2={yLine(t)} stroke="#2a3f5c" strokeWidth="1" />
          <text x={pad.left - 6} y={yLine(t) + 4} textAnchor="end" fontSize="9" fill="#8b96ab">{fmt(t)}</text>
        </g>
      ))}

      {/* Zero line */}
      {minAcum < 0 && maxAcum > 0 && (
        <line x1={pad.left} y1={zeroY} x2={W - pad.right} y2={zeroY} stroke="#2a3f5c" strokeWidth="1.5" strokeDasharray="4 3" />
      )}

      {/* Bars: egresos (red, pointing down from bottom) and ingresos (green, pointing up) */}
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

      {/* Acumulado line */}
      <polyline points={linePts} fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots on line */}
      {data.map((d, i) => (
        <circle key={i} cx={xPos(i)} cy={yLine(d.acumulado)} r="3"
          fill={d.acumulado >= 0 ? '#1D9E75' : '#DC2626'} stroke="white" strokeWidth="1.5" />
      ))}

      {/* X-axis month labels */}
      {data.map((d, i) => (
        (i === 0 || (i + 1) % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
          <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#5f6a80">M{d.mes}</text>
        )
      ))}

      {/* Legend */}
      <g transform={`translate(${pad.left}, ${H - 8})`}>
        <rect x="0" y="-7" width="8" height="8" rx="1" fill="#6EE7B7" />
        <text x="11" y="0" fontSize="9" fill="#8b96ab">Ingresos</text>
        <rect x="64" y="-7" width="8" height="8" rx="1" fill="#FCA5A5" />
        <text x="75" y="0" fontSize="9" fill="#8b96ab">Egresos</text>
        <line x1="128" y1="-3" x2="140" y2="-3" stroke="#1D9E75" strokeWidth="2.5" />
        <text x="143" y="0" fontSize="9" fill="#8b96ab">Acumulado</text>
      </g>
    </svg>
  )
}

function StressCard({ titulo, escenario, impacto, status }: StressItem) {
  const colors = {
    green: { bg: 'bg-[#14301f]', border: 'border-[#2f6b4a]', badge: 'bg-[#1a3d28] text-[#4ADE80]', dot: '#1D9E75' },
    amber: { bg: 'bg-[#2e2510]', border: 'border-[#7a5f1f]', badge: 'bg-[#3d2f10] text-[#FBBF24]', dot: '#D97706' },
    red: { bg: 'bg-[#2e1414]', border: 'border-[#7a3535]', badge: 'bg-[#3d1a1a] text-[#F87171]', dot: '#DC2626' },
  }
  const c = colors[status]
  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
          <p className="text-[13px] font-bold text-[#f4f0e6]">{titulo}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
          {status === 'green' ? 'Tolerable' : status === 'amber' ? 'Monitorear' : 'Crítico'}
        </span>
      </div>
      <p className="text-[12px] text-[#8b96ab] mb-3">{escenario}</p>
      <p className="text-[13px] font-semibold text-[#f4f0e6]">{impacto}</p>
    </div>
  )
}

function AnalisisContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || 'Proyecto sin nombre'
  const [d, setD] = useState<AnalisisData>(FALLBACK)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [showBitacora, setShowBitacora] = useState(false)
  const [showBitacoraConstruccion, setShowBitacoraConstruccion] = useState(false)
  const [showDiagramaApilamiento, setShowDiagramaApilamiento] = useState(false)
  const [showBitacoraFinanciero, setShowBitacoraFinanciero] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('smt_analisis_data')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setD(parsed)
        setAiGenerated(true)
      } catch { /* use fallback */ }
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const sendMessage = async (text?: string) => {
    const pregunta = (text ?? chatInput).trim()
    if (!pregunta || chatLoading) return
    const history = chatMessages.map(m => ({ role: m.role, content: m.content }))
    setChatMessages(prev => [...prev, { role: 'user', content: pregunta }])
    setChatInput('')
    setChatLoading(true)

    const callApi = async () => {
      const res = await authedFetch('/api/chat-analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analisis: d, messages: history, pregunta }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (!data.respuesta) throw new Error('Respuesta vacía')
      return data.respuesta as string
    }

    try {
      let respuesta: string
      try {
        respuesta = await callApi()
      } catch {
        // single retry after 1.5 s for transient errors
        await new Promise(r => setTimeout(r, 1500))
        respuesta = await callApi()
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setChatMessages(prev => [...prev, { role: 'assistant', content: `No pude procesar la pregunta: ${msg}. Intenta de nuevo.` }])
    } finally {
      setChatLoading(false)
    }
  }

  const f = d.financiero

  const BitacoraModal = () => {
    const b = d.bitacoraTerreno
    if (!b) return null
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowBitacora(false)}>
        <div className="bg-[#132a4d] rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="sticky top-0 bg-[#132a4d] border-b border-[#2a3f5c] px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#c9a227]/15 border border-[#c9a227]/40 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="1.5" width="10" height="13" rx="1.5" stroke="#c9a227" strokeWidth="1.3"/>
                  <path d="M4.5 5.5h5M4.5 8h5M4.5 10.5h3" stroke="#c9a227" strokeWidth="1.3" strokeLinecap="round"/>
                  <circle cx="13" cy="13" r="3" fill="#c9a227"/>
                  <path d="M11.8 13h2.4M13 11.8v2.4" stroke="white" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#f4f0e6]">Bitácora de Cálculo</p>
                <p className="text-[11px] text-[#5f6a80]">Costo del terreno · Metodología detallada</p>
              </div>
            </div>
            <button onClick={() => setShowBitacora(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5f6a80] hover:bg-[#132a4d] hover:text-[#f4f0e6] transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-5">
            {/* Metodología */}
            <div className="bg-[#c9a227]/10 border border-[#c9a227]/30 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-[#c9a227] uppercase tracking-wide mb-1">Metodología de valuación</p>
              <p className="text-[14px] font-bold text-[#ddc06a]">{b.metodologia}</p>
              <p className="text-[11px] text-[#8b96ab] mt-1">Fuente de referencia: {b.fuenteReferencia}</p>
            </div>

            {/* Banda */}
            {b.bandaTerreno && (
              <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl px-4 py-4">
                <p className="text-[10px] font-bold text-[#3730A3] uppercase tracking-wide mb-3">Clasificación de banda</p>
                <div className="flex items-center gap-4 mb-3">
                  {/* Badge de banda */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-[#4F46E5] flex items-center justify-center mb-1">
                      <span className="text-[28px] font-black text-white leading-none">{b.bandaTerreno}</span>
                    </div>
                    <span className="text-[9px] font-bold text-[#6366F1] uppercase tracking-wide">de 4</span>
                  </div>
                  {/* Barra visual de bandas */}
                  <div className="flex-1">
                    <div className="flex gap-1 mb-1.5">
                      {[1,2,3,4].map(n => (
                        <div key={n} className={`flex-1 h-2 rounded-full ${n === b.bandaTerreno ? 'bg-[#4F46E5]' : 'bg-[#E0E7FF]'}`} />
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] text-[#5f6a80]">Popular</span>
                      <span className="text-[9px] text-[#5f6a80]">Premium</span>
                    </div>
                    <p className="text-[12px] font-bold text-[#4F46E5] mt-1.5">{b.nombreBanda}</p>
                  </div>
                </div>
                {b.justificacionBanda && (
                  <p className="text-[11px] text-[#4338CA] leading-snug mb-2">{b.justificacionBanda}</p>
                )}
                {b.nseReferencias && (
                  <div className="bg-[#132a4d] border border-[#C7D2FE] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-[#6366F1] uppercase tracking-wide mb-0.5">Referencias usadas</p>
                    <p className="text-[11px] text-[#4338CA]">{b.nseReferencias}</p>
                  </div>
                )}
              </div>
            )}

            {/* Precio base */}
            <div>
              <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Precio base de referencia</p>
              <div className="flex items-center gap-4 bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                <div>
                  <p className="text-[10px] text-[#5f6a80] mb-0.5">Precio/m² zona</p>
                  <p className="text-[22px] font-black text-[#f4f0e6]">${b.precioM2Referencia.toLocaleString('es-MX')}</p>
                  <p className="text-[10px] text-[#5f6a80]">por m²</p>
                </div>
                <div className="flex-1 text-center text-[#C8D5CF]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-[10px] text-[#C8D5CF] mt-1">ajustes</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#5f6a80] mb-0.5">Precio/m² final</p>
                  <p className="text-[22px] font-black text-[#c9a227]">${b.precioM2Final.toLocaleString('es-MX')}</p>
                  <p className="text-[10px] text-[#5f6a80]">por m²</p>
                </div>
              </div>
            </div>

            {/* Ajustes */}
            {b.ajustes && b.ajustes.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Factores de ajuste aplicados</p>
                <div className="flex flex-col gap-2">
                  {b.ajustes.map((aj, i) => {
                    const positivo = aj.impactoM2 >= 0
                    return (
                      <div key={i} className={`border rounded-xl px-4 py-3 ${positivo ? 'bg-[#14301f] border-[#2f6b4a]' : 'bg-[#2e1414] border-[#7a3535]'}`}>
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-[13px] font-semibold text-[#f4f0e6]">{aj.concepto}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${positivo ? 'bg-[#1a3d28] text-[#4ADE80]' : 'bg-[#3d1a1a] text-[#F87171]'}`}>
                              {aj.factorAjuste}
                            </span>
                            <span className={`text-[12px] font-bold ${positivo ? 'text-[#4ADE80]' : 'text-[#DC2626]'}`}>
                              {positivo ? '+' : ''}{aj.impactoM2 >= 0 ? `$${aj.impactoM2.toLocaleString('es-MX')}` : `-$${Math.abs(aj.impactoM2).toLocaleString('es-MX')}`}/m²
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#8b96ab]">{aj.descripcion}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Fórmula y resultado */}
            <div className="bg-[#f4f0e6] rounded-xl px-5 py-4">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-3">Cálculo final</p>
              <p className="text-[12px] text-white/60 mb-2">{b.formula}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-center">
                  <p className="text-[10px] text-white/40 mb-0.5">Superficie</p>
                  <p className="text-[18px] font-bold text-white">{b.superficieM2.toLocaleString('es-MX')} m²</p>
                </div>
                <p className="text-[18px] text-white/30 font-light">×</p>
                <div className="text-center">
                  <p className="text-[10px] text-white/40 mb-0.5">Precio/m²</p>
                  <p className="text-[18px] font-bold text-white">${b.precioM2Final.toLocaleString('es-MX')}</p>
                </div>
                <p className="text-[18px] text-white/30 font-light">=</p>
                <div className="text-center">
                  <p className="text-[10px] text-[#4ade80] mb-0.5">Costo total</p>
                  <p className="text-[22px] font-black text-[#4ade80]">${b.costoTotalTerreno.toLocaleString('es-MX')}</p>
                </div>
              </div>
            </div>

            {/* Razonamiento */}
            <div>
              <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-2">Razonamiento del agente</p>
              <p className="text-[13px] text-[#8b96ab] leading-relaxed bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">{b.razonamiento}</p>
            </div>

            {/* Rango de valuación */}
            {b.rangoValoracion && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Rango de valuación</p>
                <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-center">
                      <p className="text-[10px] text-[#5f6a80] mb-0.5">Mínimo</p>
                      <p className="text-[16px] font-bold text-[#8b96ab]">${b.rangoValoracion.minimo.toLocaleString('es-MX')}/m²</p>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="relative h-2 bg-[#2a3f5c] rounded-full">
                        {(() => {
                          const rango = b.rangoValoracion.maximo - b.rangoValoracion.minimo
                          const pos = rango > 0 ? ((b.precioM2Final - b.rangoValoracion.minimo) / rango) * 100 : 50
                          return (
                            <>
                              <div className="h-full bg-gradient-to-r from-[#c9a227]/40 to-[#c9a227] rounded-full" />
                              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#132a4d] border-2 border-[#c9a227] shadow-sm" style={{ left: `${Math.min(Math.max(pos, 5), 95)}%`, transform: 'translateX(-50%) translateY(-50%)' }} />
                            </>
                          )
                        })()}
                      </div>
                      <p className="text-[10px] text-[#5f6a80] text-center mt-1">Precio estimado</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-[#5f6a80] mb-0.5">Máximo</p>
                      <p className="text-[16px] font-bold text-[#f4f0e6]">${b.rangoValoracion.maximo.toLocaleString('es-MX')}/m²</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8b96ab] leading-snug">{b.rangoValoracion.interpretacion}</p>
                </div>
              </div>
            )}

            {/* Supuestos */}
            {b.supuestos && b.supuestos.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-2">Supuestos del cálculo</p>
                <div className="flex flex-col gap-1.5">
                  {b.supuestos.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5f6a80] mt-1.5 shrink-0" />
                      <p className="text-[12px] text-[#8b96ab]">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const BANDA_COLORS: Record<number, { bg: string; border: string; text: string; badge: string }> = {
    1: { bg: 'bg-[#132a4d]', border: 'border-[#2a3f5c]', text: 'text-[#8b96ab]', badge: 'bg-[#2a3f5c] text-[#8b96ab]' },
    2: { bg: 'bg-[#1a1f42]', border: 'border-[#3d3f7a]', text: 'text-[#A5AEF5]', badge: 'bg-[#2a2d63] text-[#A5AEF5]' },
    3: { bg: 'bg-[#14301f]', border: 'border-[#2f6b4a]', text: 'text-[#4ADE80]', badge: 'bg-[#1a3d28] text-[#4ADE80]' },
    4: { bg: 'bg-[#2e2510]', border: 'border-[#7a5f1f]', text: 'text-[#FBBF24]', badge: 'bg-[#3d2f10] text-[#FBBF24]' },
  }

  const BitacoraConstruccionModal = () => {
    const b = d.bitacoraConstruccion
    if (!b) return null
    const bc = BANDA_COLORS[b.bandaElegida] ?? BANDA_COLORS[2]
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowBitacoraConstruccion(false)}>
        <div className="bg-[#132a4d] rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="sticky top-0 bg-[#132a4d] border-b border-[#2a3f5c] px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#c9a227]/15 border border-[#c9a227]/40 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="1" width="9" height="12" rx="1" stroke="#c9a227" strokeWidth="1.3"/>
                  <path d="M4 4.5h5M4 7h5M4 9.5h3" stroke="#c9a227" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M11 9l2 2-2 2" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#f4f0e6]">Bitácora de Cálculo</p>
                <p className="text-[11px] text-[#5f6a80]">Costo de construcción · Metodología CMIC</p>
              </div>
            </div>
            <button onClick={() => setShowBitacoraConstruccion(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5f6a80] hover:bg-[#132a4d] hover:text-[#f4f0e6] transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-5">
            {/* Banda elegida */}
            <div className={`${bc.bg} border ${bc.border} rounded-xl px-4 py-4`}>
              <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Banda de construcción elegida</p>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${bc.badge}`}>
                  <span className="text-[28px] font-black leading-none">{b.bandaElegida}</span>
                </div>
                <div className="flex-1">
                  <div className="flex gap-1 mb-1.5">
                    {[1,2,3,4].map(n => (
                      <div key={n} className={`flex-1 h-2 rounded-full ${n === b.bandaElegida ? 'bg-[#c9a227]' : 'bg-[#2a3f5c]'}`} />
                    ))}
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-[#5f6a80]">Económica</span>
                    <span className="text-[9px] text-[#5f6a80]">Premium</span>
                  </div>
                  <p className={`text-[13px] font-bold ${bc.text}`}>{b.nombreBanda}</p>
                </div>
              </div>
              {b.descripcionBanda && <p className="text-[11px] text-[#8b96ab] mt-2 leading-snug">{b.descripcionBanda}</p>}
            </div>

            {/* Fuente */}
            <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1">Fuente de referencia</p>
              <p className="text-[12px] font-semibold text-[#f4f0e6]">{b.fuenteReferencia}</p>
            </div>

            {/* Costo base y ajustes */}
            <div>
              <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Costo base y ajustes aplicados</p>
              <div className="flex items-center gap-4 bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3 mb-3">
                <div>
                  <p className="text-[10px] text-[#5f6a80] mb-0.5">Costo base CMIC</p>
                  <p className="text-[22px] font-black text-[#f4f0e6]">${b.costoPorM2Base.toLocaleString('es-MX')}</p>
                  <p className="text-[10px] text-[#5f6a80]">por m²</p>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#C8D5CF] shrink-0">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="text-[10px] text-[#5f6a80] mb-0.5">Costo final/m²</p>
                  <p className="text-[22px] font-black text-[#c9a227]">${b.costoPorM2Final.toLocaleString('es-MX')}</p>
                  <p className="text-[10px] text-[#5f6a80]">por m²</p>
                </div>
              </div>
              {b.ajustes && b.ajustes.length > 0 && (
                <div className="flex flex-col gap-2">
                  {b.ajustes.map((aj, i) => {
                    const positivo = aj.impactoM2 >= 0
                    return (
                      <div key={i} className={`border rounded-xl px-4 py-3 ${positivo ? 'bg-[#14301f] border-[#2f6b4a]' : 'bg-[#2e1414] border-[#7a3535]'}`}>
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-[13px] font-semibold text-[#f4f0e6]">{aj.concepto}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${positivo ? 'bg-[#1a3d28] text-[#4ADE80]' : 'bg-[#3d1a1a] text-[#F87171]'}`}>{aj.factorAjuste}</span>
                            <span className={`text-[12px] font-bold ${positivo ? 'text-[#4ADE80]' : 'text-[#DC2626]'}`}>
                              {positivo ? '+' : ''}{aj.impactoM2 >= 0 ? `$${aj.impactoM2.toLocaleString('es-MX')}` : `-$${Math.abs(aj.impactoM2).toLocaleString('es-MX')}`}/m²
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#8b96ab]">{aj.descripcion}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Cálculo final */}
            <div className="bg-[#f4f0e6] rounded-xl px-5 py-4">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-3">Cálculo final</p>
              <p className="text-[12px] text-white/60 mb-2">{b.formula}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-center">
                  <p className="text-[10px] text-white/40 mb-0.5">Superficie construible</p>
                  <p className="text-[18px] font-bold text-white">{b.superficieConstruccionM2.toLocaleString('es-MX')} m²</p>
                </div>
                <p className="text-[18px] text-white/30 font-light">×</p>
                <div className="text-center">
                  <p className="text-[10px] text-white/40 mb-0.5">Costo/m²</p>
                  <p className="text-[18px] font-bold text-white">${b.costoPorM2Final.toLocaleString('es-MX')}</p>
                </div>
                <p className="text-[18px] text-white/30 font-light">=</p>
                <div className="text-center">
                  <p className="text-[10px] text-[#4ade80] mb-0.5">Costo total</p>
                  <p className="text-[22px] font-black text-[#4ade80]">${b.costoTotalConstruccion.toLocaleString('es-MX')}</p>
                </div>
              </div>
            </div>

            {/* Contexto ciudad y tipología */}
            {(b.ciudadAjuste || b.tipologiaAjuste) && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-2">Contexto del ajuste</p>
                <div className="flex flex-col gap-2">
                  {b.ciudadAjuste && (
                    <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold text-[#5f6a80] uppercase mb-1">Factor ciudad</p>
                      <p className="text-[12px] text-[#8b96ab]">{b.ciudadAjuste}</p>
                    </div>
                  )}
                  {b.tipologiaAjuste && (
                    <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold text-[#5f6a80] uppercase mb-1">Factor tipología</p>
                      <p className="text-[12px] text-[#8b96ab]">{b.tipologiaAjuste}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Razonamiento */}
            <div>
              <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-2">Razonamiento del agente</p>
              <p className="text-[13px] text-[#8b96ab] leading-relaxed bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">{b.razonamiento}</p>
            </div>

            {/* Rango de referencia */}
            {b.rangoReferencia && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Rango CMIC para esta banda y ciudad</p>
                <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-center">
                      <p className="text-[10px] text-[#5f6a80] mb-0.5">Mínimo</p>
                      <p className="text-[16px] font-bold text-[#8b96ab]">${b.rangoReferencia.minimo.toLocaleString('es-MX')}/m²</p>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="relative h-2 bg-[#2a3f5c] rounded-full">
                        {(() => {
                          const rango = b.rangoReferencia.maximo - b.rangoReferencia.minimo
                          const pos = rango > 0 ? ((b.costoPorM2Final - b.rangoReferencia.minimo) / rango) * 100 : 50
                          return (
                            <>
                              <div className="h-full bg-gradient-to-r from-[#c9a227]/40 to-[#c9a227] rounded-full" />
                              <div className="absolute top-1/2 w-3 h-3 rounded-full bg-[#132a4d] border-2 border-[#c9a227] shadow-sm" style={{ left: `${Math.min(Math.max(pos, 5), 95)}%`, transform: 'translateX(-50%) translateY(-50%)' }} />
                            </>
                          )
                        })()}
                      </div>
                      <p className="text-[10px] text-[#5f6a80] text-center mt-1">Costo estimado</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-[#5f6a80] mb-0.5">Máximo</p>
                      <p className="text-[16px] font-bold text-[#f4f0e6]">${b.rangoReferencia.maximo.toLocaleString('es-MX')}/m²</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8b96ab] leading-snug">{b.rangoReferencia.interpretacion}</p>
                </div>
              </div>
            )}

            {/* Desglose por partidas */}
            {b.desglosePorPartidas && b.desglosePorPartidas.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Desglose por partidas</p>
                <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl overflow-hidden">
                  {(() => {
                    const maxPct = Math.max(...b.desglosePorPartidas!.map(p => p.porcentaje))
                    return b.desglosePorPartidas!.map((p, i) => (
                      <div key={i} className={`px-4 py-3 ${i > 0 ? 'border-t border-[#2a3f5c]' : ''}`}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-[12px] font-semibold text-[#f4f0e6] shrink-0">{p.partida}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold text-[#5f6a80]">{p.porcentaje}%</span>
                            <span className="text-[12px] font-bold text-[#c9a227]">${p.costoPorM2.toLocaleString('es-MX')}/m²</span>
                          </div>
                        </div>
                        <div className="relative h-1.5 bg-[#2a3f5c] rounded-full mb-1.5">
                          <div className="h-full bg-[#c9a227] rounded-full" style={{ width: `${(p.porcentaje / maxPct) * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-[#5f6a80] leading-snug">{p.descripcion}</p>
                      </div>
                    ))
                  })()}
                  <div className="bg-[#f4f0e6] px-4 py-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/60">Total (100%)</span>
                    <span className="text-[14px] font-black text-[#4ade80]">${b.costoPorM2Final.toLocaleString('es-MX')}/m²</span>
                  </div>
                </div>
              </div>
            )}

            {/* Materiales principales */}
            {b.materialesPrincipales && b.materialesPrincipales.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Materiales principales</p>
                <div className="border border-[#2a3f5c] rounded-xl overflow-hidden">
                  <div className="bg-[#132a4d] px-4 py-2 grid grid-cols-4 gap-2 border-b border-[#2a3f5c]">
                    <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide col-span-2">Material</p>
                    <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide text-right">Cant./m²</p>
                    <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide text-right">$/m²</p>
                  </div>
                  {b.materialesPrincipales.map((m, i) => (
                    <div key={i} className={`px-4 py-3 grid grid-cols-4 gap-2 items-center ${i % 2 === 0 ? 'bg-[#132a4d]' : 'bg-[#0f2340]'} ${i < b.materialesPrincipales!.length - 1 ? 'border-b border-[#2a3f5c]' : ''}`}>
                      <div className="col-span-2">
                        <p className="text-[12px] font-semibold text-[#f4f0e6]">{m.material}</p>
                        {m.nota && <p className="text-[10px] text-[#5f6a80]">{m.nota}</p>}
                      </div>
                      <p className="text-[12px] text-[#8b96ab] text-right">{m.cantidadPorM2} {m.unidad}</p>
                      <p className="text-[12px] font-bold text-[#c9a227] text-right">${m.costoPorM2.toLocaleString('es-MX')}</p>
                    </div>
                  ))}
                  <div className="px-4 py-2 bg-[#132a4d] border-t border-[#2a3f5c]">
                    <p className="text-[10px] text-[#5f6a80] italic">Costos referenciales. Validar con proveedores locales antes de presupuestar.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Supuestos */}
            {b.supuestos && b.supuestos.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-2">Supuestos del cálculo</p>
                <div className="flex flex-col gap-1.5">
                  {b.supuestos.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5f6a80] mt-1.5 shrink-0" />
                      <p className="text-[12px] text-[#8b96ab]">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const MIX_COLORS = ['#1D9E75', '#4338CA', '#D97706', '#DB2777', '#0891B2', '#65A30D']

  const DiagramaApilamientoModal = () => {
    const ba = resolveBitacoraArquitectura(d)
    const t = ba?.tipologiaPropuesta
    if (!t) return null

    const nivelesComercial = t.comercial?.niveles ?? 0
    const totalNiveles = t.niveles ?? (nivelesComercial + (t.habitacional ? 1 : 0))
    const mix = t.habitacional?.mix ?? []
    const totalUnidadesMix = mix.reduce((s, m) => s + m.unidades, 0)

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowDiagramaApilamiento(false)}>
        <div className="bg-[#132a4d] rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 bg-[#132a4d] border-b border-[#2a3f5c] px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="2.5" rx="0.6" fill="#6D28D9"/>
                  <rect x="2" y="6.75" width="12" height="2.5" rx="0.6" fill="#6D28D9"/>
                  <rect x="2" y="11.5" width="12" height="2.5" rx="0.6" fill="#6D28D9"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#f4f0e6]">Diagrama de Apilamiento</p>
                <p className="text-[11px] text-[#5f6a80]">Boceto esquemático de la propuesta de tipología · pre-plano</p>
              </div>
            </div>
            <button onClick={() => setShowDiagramaApilamiento(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5f6a80] hover:bg-[#132a4d] hover:text-[#f4f0e6] transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-5">
            {/* Resumen del programa */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-3 py-2.5 text-center">
                <p className="text-[16px] font-black text-[#f4f0e6]">{totalNiveles}</p>
                <p className="text-[9px] text-[#5f6a80] uppercase tracking-wide">Niveles</p>
              </div>
              <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-3 py-2.5 text-center">
                <p className="text-[16px] font-black text-[#f4f0e6]">{t.habitacional?.totalDepartamentos ?? 0}</p>
                <p className="text-[9px] text-[#5f6a80] uppercase tracking-wide">Departamentos</p>
              </div>
              <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-3 py-2.5 text-center">
                <p className="text-[16px] font-black text-[#f4f0e6]">{t.comercial?.totalLocales ?? 0}</p>
                <p className="text-[9px] text-[#5f6a80] uppercase tracking-wide">Locales</p>
              </div>
              <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-3 py-2.5 text-center">
                {/* tamanoAmenidades es una escala 1-3 (ver AMENIDADES_NIVEL_LABELS), no m² —
                    antes se mostraba mal como "{n} m² Amenidades". */}
                <p className="text-[16px] font-black text-[#f4f0e6]">{AMENIDADES_NIVEL_LABELS[String(t.tamanoAmenidades)] ?? '—'}</p>
                <p className="text-[9px] text-[#5f6a80] uppercase tracking-wide">Amenidades</p>
              </div>
            </div>

            {/* Bocetos — elevación (apilamiento) + planta (huella sobre el lote) */}
            <div>
              <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-2">Elevación</p>
              <BocetoVolumetria tipologia={t} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-2">Vista en planta (aérea)</p>
              <VistaAereaTerreno
                superficieTerreno={d.bitacoraTerreno?.superficieM2 ?? 0}
                superficieConstruida={ba?.superficieConstruida ?? 0}
                niveles={t.niveles}
                desgloseZonas={ba?.desgloseZonas}
                areaLibreYVerde={ba?.areaLibreYVerde}
              />
            </div>

            {/* Mix de unidades habitacionales */}
            {mix.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Mix de unidades habitacionales</p>
                <div className="flex h-3 rounded-full overflow-hidden mb-3">
                  {mix.map((m, i) => (
                    <div key={i} style={{ width: `${totalUnidadesMix > 0 ? (m.unidades / totalUnidadesMix) * 100 : 0}%`, backgroundColor: MIX_COLORS[i % MIX_COLORS.length] }} />
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  {mix.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: MIX_COLORS[i % MIX_COLORS.length] }} />
                      <span className="text-[12px] font-semibold text-[#f4f0e6] flex-1">{m.tipo}</span>
                      <span className="text-[11px] text-[#8b96ab]">{m.unidades} uds</span>
                      <span className="text-[11px] text-[#5f6a80]">· {m.m2Promedio} m² prom.</span>
                      <span className="text-[11px] font-bold text-[#c9a227] w-10 text-right">{totalUnidadesMix > 0 ? Math.round((m.unidades / totalUnidadesMix) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-[#5f6a80] italic">Boceto ilustrativo generado a partir del programa arquitectónico propuesto por el Agente de Costos de Construcción. No sustituye un plano arquitectónico ni asume distribución real por nivel — es una aproximación de volumetría para evaluar la propuesta antes de diseño.</p>
          </div>
        </div>
      </div>
    )
  }

  const BitacoraFinancieroModal = () => {
    const secciones = [
      { titulo: 'Indirectos', total: f.indirectos, items: f.indirectosDesglose },
      { titulo: 'Honorarios de proyecto', total: f.honorarios, items: f.honorariosDesglose },
      { titulo: 'Imprevistos', total: f.imprevistos, items: f.imprevistosDesglose },
    ].filter(s => s.items && s.items.length > 0)

    if (secciones.length === 0) return null

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowBitacoraFinanciero(false)}>
        <div className="bg-[#132a4d] rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 bg-[#132a4d] border-b border-[#2a3f5c] px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#c9a227]/15 border border-[#c9a227]/40 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="1" width="9" height="12" rx="1" stroke="#c9a227" strokeWidth="1.3"/>
                  <path d="M4 4.5h5M4 7h5M4 9.5h3" stroke="#c9a227" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M11 9l2 2-2 2" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#f4f0e6]">Desglose de costos administrativos</p>
                <p className="text-[11px] text-[#5f6a80]">Indirectos · Honorarios · Imprevistos</p>
              </div>
            </div>
            <button onClick={() => setShowBitacoraFinanciero(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5f6a80] hover:bg-[#132a4d] hover:text-[#f4f0e6] transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-5">
            {secciones.map(({ titulo, total, items }) => {
              const maxMonto = Math.max(...items!.map(it => it.monto))
              return (
                <div key={titulo}>
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">{titulo}</p>
                  <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl overflow-hidden">
                    {items!.map((it, i) => (
                      <div key={i} className={`px-4 py-3 ${i > 0 ? 'border-t border-[#2a3f5c]' : ''}`}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-[12px] font-semibold text-[#f4f0e6]">{it.concepto}</p>
                          <span className="text-[12px] font-bold text-[#c9a227] shrink-0">${it.monto.toLocaleString('es-MX')}</span>
                        </div>
                        <div className="relative h-1.5 bg-[#2a3f5c] rounded-full">
                          <div className="h-full bg-[#c9a227] rounded-full" style={{ width: `${maxMonto > 0 ? (it.monto / maxMonto) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="bg-[#f4f0e6] px-4 py-3 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/60">Total {titulo.toLowerCase()}</span>
                      <span className="text-[14px] font-black text-[#4ade80]">${total.toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <p className="text-[10px] text-[#5f6a80] italic">Desglose informativo — cada sección suma aproximadamente el total ya reflejado en la Estimación de Costos. No cambia la inversión total ni la TIR.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    {showBitacora && <BitacoraModal />}
    {showBitacoraConstruccion && <BitacoraConstruccionModal />}
    {showDiagramaApilamiento && <DiagramaApilamientoModal />}
    {showBitacoraFinanciero && <BitacoraFinancieroModal />}
    <div
      className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex flex-col`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    >
      <header className="px-8 py-5 flex items-center gap-3 border-b border-white/10 bg-[#070f22] sticky top-0 z-10">
        <div className="w-8 h-8 rounded-lg bg-[#c9a227] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] tracking-wide" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 500, color: '#f4f0e6' }}>
            SMT <em style={{ fontStyle: 'normal', color: '#ddc06a' }}>Developer</em>
          </span>
          <span className="block text-[10px] text-white/40 tracking-[0.12em] uppercase" style={{ fontFamily: 'var(--font-plex-mono)' }}>Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {aiGenerated && (
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#c9a227]/15 border border-[#c9a227]/40 text-[#ddc06a] px-3 py-1 rounded-full">
              IA generado
            </span>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] hover:border-[#C8D5CF] px-3 py-1.5 rounded-xl transition-colors print:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 4V2h8v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <rect x="1" y="4" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M3 8v4h8V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Imprimir / PDF
          </button>
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] hover:border-[#C8D5CF] px-3 py-1.5 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Mis Proyectos
          </button>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-[780px] mx-auto flex flex-col gap-8">

          {/* Hero banner */}
          <div className="bg-[#f4f0e6] rounded-2xl p-7 text-white">
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] uppercase bg-[#c9a227] text-[#070f22] px-3 py-1 rounded-full mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#132a4d] animate-pulse" />
                  Análisis Completado
                </span>
                <h1 className="text-[26px] font-bold text-white leading-tight">{proyecto}</h1>
                <p className="text-[13px] text-white/50 mt-1">Reporte de inversión · Flujo A · {d.mercado.zona}</p>
              </div>
            </div>
            {/* Fila 1 — las dos TIR, protagonistas, mismo tamaño entre ellas */}
            <div className={`grid gap-4 pt-5 border-t border-white/10 ${f.tirProyecto !== undefined ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="min-w-0">
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">TIR Socio</p>
                <p className={`text-[28px] font-black whitespace-nowrap ${f.tir === null ? 'text-white/30' : f.tir >= 0 ? 'text-[#4ade80]' : 'text-[#F87171]'}`}>
                  {f.tir === null ? 'N/D' : `${f.tir.toFixed(1)}%`}
                </p>
                <p className="text-[11px] text-white/40">anual · apalancada</p>
              </div>
              {f.tirProyecto !== undefined && (
                <div className="min-w-0">
                  <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">TIR Proyecto</p>
                  <p className={`text-[28px] font-black whitespace-nowrap ${f.tirProyecto === null ? 'text-white/30' : f.tirProyecto >= 0 ? 'text-[#4ade80]' : 'text-[#F87171]'}`}>
                    {f.tirProyecto === null ? 'N/D' : `${f.tirProyecto.toFixed(1)}%`}
                  </p>
                  <p className="text-[11px] text-white/40">anual · sin apalancar</p>
                </div>
              )}
            </div>

            {/* Fila 2 — datos secundarios, letra más chica y montos abreviados (M) para que quepan */}
            <div className={`grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-white/10 ${d.estructuraCapital ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {d.estructuraCapital && (
                <div className="min-w-0">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Financiamiento Externo</p>
                  <p className="text-[19px] font-black text-[#818CF8] whitespace-nowrap">{fmtCompact(d.estructuraCapital.montoDeuda)}</p>
                  <p className="text-[11px] text-white/40">Banca · {d.estructuraCapital.deuda}%</p>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Inversión Total</p>
                <p className="text-[19px] font-black text-white whitespace-nowrap">{fmtCompact(f.inversionTotal)}</p>
                <p className="text-[11px] text-white/40">MXN</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Score Resiliencia</p>
                <p className="text-[19px] font-black text-[#4ade80]">{d.score.total}</p>
                <p className="text-[11px] text-white/40">/ 100</p>
              </div>
            </div>
            {d.estructuraCapital && (
              <p className="text-[10px] text-white/30 mt-2">
                Financiamiento externo + equity cubren terreno, construcción e indirectos — la comercialización se paga de las ventas, por eso no está incluida ahí y "Inversión Total" puede ser mayor.
              </p>
            )}
          </div>

          {/* Recomendación */}
          <div>
            <SectionTitle>Recomendación Principal</SectionTitle>
            <div className="bg-[#c9a227]/10 border border-[#c9a227]/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#c9a227] flex items-center justify-center shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8"/>
                    <path d="M3 9h18M9 21V9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#c9a227] tracking-[0.12em] uppercase mb-1">Tipología recomendada</p>
                  <h3 className="text-[20px] font-bold text-[#f4f0e6] mb-2">{d.recomendacion.tipologia}</h3>
                  <p className="text-[14px] text-[#8b96ab] leading-relaxed">{d.recomendacion.descripcion}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ficha Legal */}
          <div>
            <SectionTitle>Ficha Legal y Normativa</SectionTitle>
            <Card>
              {/* Uso de suelo — actual vs. permitido */}
              {(d.fichaLegal.usoSueloActual || d.fichaLegal.usoSueloPermitido) ? (
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Uso de suelo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                      <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide mb-1">Actual</p>
                      <p className="text-[13px] font-semibold text-[#f4f0e6]">{d.fichaLegal.usoSueloActual || '—'}</p>
                    </div>
                    <div className={`border rounded-xl px-4 py-3 ${d.fichaLegal.compatible === false ? 'bg-[#2e1414] border-[#7a3535]' : 'bg-[#14301f] border-[#2f6b4a]'}`}>
                      <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide mb-1">Permitido (PDU)</p>
                      <p className="text-[13px] font-semibold text-[#f4f0e6]">{d.fichaLegal.usoSueloPermitido || d.fichaLegal.usoSuelo || '—'}</p>
                      {d.fichaLegal.compatible === false && (
                        <span className="text-[10px] font-bold text-[#991B1B] mt-1 inline-block">Requiere cambio de uso</span>
                      )}
                    </div>
                  </div>
                  {d.fichaLegal.densidadAutorizada && (
                    <div className="mt-2 bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-2">
                      <span className="text-[11px] text-[#8b96ab]">Densidad autorizada: </span>
                      <span className="text-[11px] font-semibold text-[#f4f0e6]">{d.fichaLegal.densidadAutorizada}</span>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Parámetros normativos */}
              <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Parámetros normativos</p>
              <div className="grid grid-cols-2 gap-x-8 mb-5">
                <div className="divide-y divide-[#2a3f5c]">
                  <MetricRow label="COS permitido" value={d.fichaLegal.cos} />
                  <MetricRow label="CUS" value={d.fichaLegal.cus} />
                  <MetricRow label="Altura máxima" value={d.fichaLegal.altura} />
                </div>
                <div className="divide-y divide-[#2a3f5c]">
                  <MetricRow label="Cajones por unidad" value={d.fichaLegal.cajones} />
                  {d.fichaLegal.retiros && <MetricRow label="Retiros reglamentarios" value={d.fichaLegal.retiros} />}
                  <MetricRow label="Municipio" value={d.fichaLegal.municipio} />
                </div>
              </div>

              {/* Factibilidades */}
              {d.fichaLegal.factibilidades && (
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Factibilidades de servicios</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['agua', 'drenaje', 'cfe'] as const).map(srv => {
                      const f = d.fichaLegal.factibilidades![srv]
                      const colors = {
                        'Disponible': { bg: 'bg-[#14301f]', border: 'border-[#2f6b4a]', dot: '#1D9E75', text: 'text-[#4ADE80]' },
                        'Con condicionante': { bg: 'bg-[#2e2510]', border: 'border-[#7a5f1f]', dot: '#D97706', text: 'text-[#FBBF24]' },
                        'No disponible': { bg: 'bg-[#2e1414]', border: 'border-[#7a3535]', dot: '#DC2626', text: 'text-[#F87171]' },
                      }
                      const c = colors[f.status] || colors['Con condicionante']
                      const label = { agua: 'Agua potable', drenaje: 'Drenaje', cfe: 'CFE / Electricidad' }
                      return (
                        <div key={srv} className={`${c.bg} border ${c.border} rounded-xl p-3`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                            <p className="text-[11px] font-bold text-[#f4f0e6]">{label[srv]}</p>
                          </div>
                          <p className={`text-[10px] font-semibold ${c.text} mb-1`}>{f.status}</p>
                          <p className="text-[10px] text-[#8b96ab] leading-snug">{f.nota}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Régimen de condominio */}
              {d.fichaLegal.regimenCondominio && (
                <div className="mb-5 bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-1">Régimen de condominio</p>
                  <p className="text-[12px] text-[#f4f0e6]">{d.fichaLegal.regimenCondominio}</p>
                </div>
              )}

              {/* Restricciones ambientales */}
              {d.fichaLegal.restriccionesAmbientales && (
                <div className="mb-5">
                  <div className="flex items-start gap-2 bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                      <circle cx="7" cy="7" r="5.5" stroke="#8b96ab" strokeWidth="1.3"/>
                      <path d="M7 4v4" stroke="#8b96ab" strokeWidth="1.3" strokeLinecap="round"/>
                      <circle cx="7" cy="9.5" r="0.5" fill="#8b96ab"/>
                    </svg>
                    <div>
                      <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-0.5">Restricciones ambientales y de riesgo</p>
                      <p className="text-[12px] text-[#f4f0e6]">{d.fichaLegal.restriccionesAmbientales}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Restricción principal */}
              <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#F5D97A] rounded-xl px-4 py-3 mb-4">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                  <path d="M7 2L12.5 11.5H1.5L7 2Z" stroke="#D97706" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M7 6v3" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="10" r="0.5" fill="#D97706"/>
                </svg>
                <p className="text-[12px] text-[#92600A]"><strong>Restricción principal:</strong> {d.fichaLegal.restriccion}</p>
              </div>

              {/* Alertas legales */}
              {d.fichaLegal.alertasLegales && d.fichaLegal.alertasLegales.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">
                    Alertas legales
                    {d.fichaLegal.nivelRiesgo && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${d.fichaLegal.nivelRiesgo === 'Alto' ? 'bg-[#3d1a1a] text-[#F87171]' : d.fichaLegal.nivelRiesgo === 'Medio' ? 'bg-[#3d2f10] text-[#FBBF24]' : 'bg-[#1a3d28] text-[#4ADE80]'}`}>
                        Riesgo {d.fichaLegal.nivelRiesgo}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col gap-2">
                    {d.fichaLegal.alertasLegales.map((a, i) => {
                      const ac = {
                        green: { bg: 'bg-[#14301f]', border: 'border-[#2f6b4a]', dot: '#1D9E75', badge: 'bg-[#1a3d28] text-[#4ADE80]', label: 'Sin impacto' },
                        amber: { bg: 'bg-[#2e2510]', border: 'border-[#7a5f1f]', dot: '#D97706', badge: 'bg-[#3d2f10] text-[#FBBF24]', label: 'Manejable' },
                        red: { bg: 'bg-[#2e1414]', border: 'border-[#7a3535]', dot: '#DC2626', badge: 'bg-[#3d1a1a] text-[#F87171]', label: 'Crítico' },
                      }[a.status]
                      return (
                        <div key={i} className={`${ac.bg} border ${ac.border} rounded-xl px-4 py-3`}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ac.dot }} />
                              <p className="text-[13px] font-bold text-[#f4f0e6]">{a.tipo}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ac.badge}`}>{ac.label}</span>
                          </div>
                          <p className="text-[12px] text-[#8b96ab] mb-1.5">{a.descripcion}</p>
                          <p className="text-[12px] font-semibold text-[#f4f0e6]">{a.impacto}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Estimación de costos */}
          <div>
            <SectionTitle>Estimación de Costos e Ingresos</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <tbody>
                  {[
                    { label: 'Costo del terreno', value: fmt(f.costoTerreno), sub: `${fmt(f.costoTerrenoM2)}/m²`, highlight: false, bitacora: true },
                    { label: 'Construcción por m²', value: `${fmt(f.construccionM2)}/m²`, sub: 'Costo directo por m² construido', highlight: false, bitacora: false, bitacoraCons: true },
                    { label: 'Costo total construcción', value: fmt(f.costoTotalConstruccion), sub: f.escaladoPorMix && f.escaladoPorMix.factorEscalaMix < 1 ? `Ajustado a ${(f.escaladoPorMix.factorEscalaMix * 100).toFixed(0)}% — el mix de unidades aprovecha ${f.escaladoPorMix.eficienciaMixPct}% del área vendible calculada (${fmt(f.escaladoPorMix.costoTotalConstruccionOriginal)} sin ajustar)` : '', highlight: false, bitacora: false, bitacoraCons: false, alerta: !!(f.escaladoPorMix && f.escaladoPorMix.factorEscalaMix < 1) },
                    { label: 'Indirectos y permisos', value: fmt(f.indirectos), sub: `${f.costoTotalConstruccion > 0 ? ((f.indirectos / f.costoTotalConstruccion) * 100).toFixed(1) : '0'}% sobre costo de obra${f.validacionIndirectos?.indirectosFueraDeRango ? ' — fuera del rango esperado (15–18%)' : ''}`, highlight: false, bitacora: false, bitacoraCons: false, bitacoraFin: true, alerta: !!f.validacionIndirectos?.indirectosFueraDeRango },
                    { label: 'Honorarios y diseño', value: fmt(f.honorarios), sub: `${f.costoTotalConstruccion > 0 ? ((f.honorarios / f.costoTotalConstruccion) * 100).toFixed(1) : '0'}% sobre costo de obra${f.validacionIndirectos?.honorariosFueraDeRango ? ' — fuera del rango esperado (8–10%)' : ''}`, highlight: false, bitacora: false, bitacoraCons: false, alerta: !!f.validacionIndirectos?.honorariosFueraDeRango },
                    { label: 'Imprevistos (5%)', value: fmt(f.imprevistos), sub: 'Reserva de contingencia', highlight: false, bitacora: false, bitacoraCons: false },
                    ...(f.comercializacion !== undefined ? [{ label: 'Comercialización (3%)', value: fmt(f.comercializacion), sub: 'Comisión de venta sobre ingreso neto', highlight: false, bitacora: false, bitacoraCons: false }] : []),
                    { label: 'Inversión Total', value: fmt(f.inversionTotal), sub: '', highlight: true, bitacora: false, bitacoraCons: false },
                    { label: 'Precio venta estimado / m²', value: `${fmt(f.precioVentaM2)}/m²`, sub: f.precioVentaAjustadoPorBanda ? `Ajustado — el modelo eligió ${fmt(f.precioVentaAjustadoPorBanda.precioVentaM2Modelo)}/m², de zona premium no representativo de tu banda de construcción` : `Mercado ${d.mercado.zona} · NSE ${d.mercado.perfilNSE.split('·')[0].trim()}`, highlight: false, bitacora: false, bitacoraCons: false, alerta: !!f.precioVentaAjustadoPorBanda },
                    { label: 'Ingresos proyectados (bruto)', value: fmt(f.ingresosProyectados), sub: '100% absorción', highlight: false, bitacora: false, bitacoraCons: false },
                    ...(f.descuentos !== undefined ? [{ label: 'Descuentos y cancelaciones (5%)', value: `-${fmt(f.descuentos)}`, sub: 'Sobre ingreso bruto', highlight: false, bitacora: false, bitacoraCons: false }] : []),
                    ...(f.ingresosNetos !== undefined ? [{ label: 'Ingresos netos', value: fmt(f.ingresosNetos), sub: '', highlight: false, bitacora: false, bitacoraCons: false }] : []),
                    { label: 'Utilidad bruta', value: fmt(f.utilidadBruta), sub: '', highlight: false, bitacora: false, bitacoraCons: false },
                    { label: 'Margen bruto', value: `${f.margenBruto}%`, sub: 'sobre inversión total', highlight: true, bitacora: false, bitacoraCons: false },
                  ].map((row, i) => (
                    <tr key={i} className={row.highlight ? 'bg-[#14301f]' : i % 2 === 0 ? 'bg-[#132a4d]' : 'bg-[#0f2340]'}>
                      <td className="px-6 py-3 border-b border-[#2a3f5c]">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className={`text-[13px] ${row.highlight ? 'font-bold text-[#4ADE80]' : 'text-[#8b96ab]'}`}>{row.label}</p>
                            {row.sub && <p className={`text-[11px] ${row.alerta ? 'text-[#D97706] font-medium' : 'text-[#5f6a80]'}`}>{row.sub}</p>}
                          </div>
                          {row.bitacora && d.bitacoraTerreno && (
                            <button onClick={() => setShowBitacora(true)} title="Ver bitácora de cálculo"
                              className="flex items-center gap-1 text-[10px] font-bold text-[#c9a227] border border-[#c9a227]/40 bg-[#c9a227]/10 px-2 py-0.5 rounded-full hover:bg-[#c9a227]/20 transition-colors shrink-0 cursor-pointer">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <rect x="1" y="0.5" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
                                <path d="M3 3.5h4M3 5.5h4M3 7.5h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                              </svg>
                              Bitácora
                            </button>
                          )}
                          {row.bitacoraCons && d.bitacoraConstruccion && (
                            <button onClick={() => setShowBitacoraConstruccion(true)} title="Ver bitácora de construcción"
                              className="flex items-center gap-1 text-[10px] font-bold text-[#c9a227] border border-[#c9a227]/40 bg-[#c9a227]/10 px-2 py-0.5 rounded-full hover:bg-[#c9a227]/20 transition-colors shrink-0 cursor-pointer">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <rect x="1" y="0.5" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
                                <path d="M3 3.5h4M3 5.5h4M3 7.5h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                              </svg>
                              Bitácora
                            </button>
                          )}
                          {row.bitacoraCons && resolveBitacoraArquitectura(d)?.tipologiaPropuesta && (
                            <button onClick={() => setShowDiagramaApilamiento(true)} title="Ver diagrama de apilamiento"
                              className="flex items-center gap-1 text-[10px] font-bold text-[#c9a227] border border-[#c9a227]/40 bg-[#c9a227]/10 px-2 py-0.5 rounded-full hover:bg-[#c9a227]/20 transition-colors shrink-0 cursor-pointer">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <rect x="1" y="1" width="8" height="2" rx="0.5" fill="currentColor"/>
                                <rect x="1" y="4" width="8" height="2" rx="0.5" fill="currentColor"/>
                                <rect x="1" y="7" width="8" height="2" rx="0.5" fill="currentColor"/>
                              </svg>
                              Apilamiento
                            </button>
                          )}
                          {row.bitacoraFin && f.indirectosDesglose && (
                            <button onClick={() => setShowBitacoraFinanciero(true)} title="Ver desglose de indirectos, honorarios e imprevistos"
                              className="flex items-center gap-1 text-[10px] font-bold text-[#c9a227] border border-[#c9a227]/40 bg-[#c9a227]/10 px-2 py-0.5 rounded-full hover:bg-[#c9a227]/20 transition-colors shrink-0 cursor-pointer">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <rect x="1" y="0.5" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
                                <path d="M3 3.5h4M3 5.5h4M3 7.5h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                              </svg>
                              Desglose
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 border-b border-[#2a3f5c] text-right">
                        <p className={`text-[13px] ${row.highlight ? 'font-bold text-[#4ADE80]' : 'font-semibold text-[#f4f0e6]'}`}>{row.value}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Estructura de Capital */}
          {d.estructuraCapital && (
            <div>
              <SectionTitle>Estructura de Capital</SectionTitle>
              <Card>
                {/* Barra equity / deuda */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-[#4ADE80]">Equity {d.estructuraCapital.equity}%</span>
                    <span className="text-[11px] font-bold text-[#4F46E5]">Deuda {d.estructuraCapital.deuda}%</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div className="bg-[#1D9E75] transition-all duration-700" style={{ width: `${d.estructuraCapital.equity}%` }} />
                    <div className="bg-[#4F46E5]" style={{ width: `${d.estructuraCapital.deuda}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-[#8b96ab]">{fmt(d.estructuraCapital.montoEquity)}</span>
                    <span className="text-[11px] text-[#8b96ab]">{fmt(d.estructuraCapital.montoDeuda)}</span>
                  </div>
                </div>

                {/* Métricas de deuda e ISR */}
                <div className="grid grid-cols-2 gap-x-8 mb-5 divide-y divide-[#2a3f5c]">
                  <MetricRow label="Tipo de deuda" value={d.estructuraCapital.tipoDeuda} />
                  <MetricRow label="Tasa de interés" value={d.estructuraCapital.tasaDeuda} />
                  <MetricRow label="Costo financiero" value={fmt(d.estructuraCapital.costoFinanciero)} />
                  <MetricRow label="TIR — tipo" value={d.estructuraCapital.tasaDescuento} />
                  <MetricRow label="ISR estimado (30%)" value={fmt(d.estructuraCapital.isrEstimado)} />
                  <MetricRow label="Utilidad neta" value={fmt(d.estructuraCapital.utilidadNeta)} valueClass="text-[#4ADE80] font-bold" />
                </div>

                {/* Preventa mínima */}
                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl px-4 py-4">
                  <p className="text-[11px] font-bold text-[#3730A3] uppercase tracking-wide mb-2">Preventa mínima para crédito puente</p>
                  <div className="flex items-center gap-6 mb-2">
                    <div>
                      <p className="text-[28px] font-black text-[#4F46E5] leading-none">{d.estructuraCapital.preventa.unidadesMinimas}</p>
                      <p className="text-[11px] text-[#6366F1]">unidades · {d.estructuraCapital.preventa.porcentajeMinimo}</p>
                    </div>
                    <div>
                      <p className="text-[18px] font-bold text-[#4F46E5] leading-none">{fmt(d.estructuraCapital.preventa.montoMinimo)}</p>
                      <p className="text-[11px] text-[#6366F1]">ingreso mínimo en preventa</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-[#4338CA]">{d.estructuraCapital.preventa.condicion}</p>
                </div>

                {d.estructuraCapital.descripcion && (
                  <p className="text-[12px] text-[#8b96ab] mt-4 px-1 leading-relaxed">{d.estructuraCapital.descripcion}</p>
                )}
              </Card>
            </div>
          )}

          {/* Flujo de Caja Proyectado */}
          {d.flujoMensual && d.flujoMensual.length > 0 && (
            <div>
              <SectionTitle>Flujo de Caja Proyectado</SectionTitle>
              <Card className="pb-4 mb-0">
                <CashFlowChart data={d.flujoMensual} />
              </Card>
              <Card className="p-0 overflow-hidden mt-3">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#132a4d] border-b border-[#2a3f5c]">
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide w-12">Mes</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Fase</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-[#DC2626] uppercase tracking-wide">Egresos</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-[#4ADE80] uppercase tracking-wide">Ingresos</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.flujoMensual.map((row, i) => {
                      const positivo = row.acumulado >= 0
                      return (
                        <tr key={i} className={`border-b border-[#2a3f5c] last:border-0 ${i % 2 === 0 ? 'bg-[#132a4d]' : 'bg-[#0f2340]'}`}>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[11px] font-bold text-[#5f6a80]">{row.mes}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[12px] font-semibold text-[#f4f0e6]">{row.fase}</p>
                            <p className="text-[10px] text-[#5f6a80] leading-snug">{row.nota}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.egresos > 0 && <span className="text-[12px] font-semibold text-[#DC2626]">−{fmt(row.egresos)}</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.ingresos > 0 && <span className="text-[12px] font-semibold text-[#4ADE80]">+{fmt(row.ingresos)}</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-[12px] font-bold ${positivo ? 'text-[#4ADE80]' : 'text-[#DC2626]'}`}>
                              {positivo ? '+' : ''}{fmt(row.acumulado)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* Análisis de Mercado */}
          <div>
            <SectionTitle>Análisis de Mercado</SectionTitle>
            <Card>
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#c9a227]/15 text-[#ddc06a] border border-[#c9a227]/40">
                  <span className="w-2 h-2 rounded-full bg-[#c9a227]" />
                  Demanda {d.mercado.demanda}
                </span>
                <span className="text-[12px] text-[#8b96ab]">{d.mercado.zona}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 mb-5">
                <div className="divide-y divide-[#2a3f5c]">
                  <MetricRow label="Velocidad de absorción" value={d.mercado.absorcion} valueClass="text-[#4ADE80] font-semibold" />
                  <MetricRow label="Proyectos activos radio 500 m" value={d.mercado.proyectosActivos} />
                  <MetricRow label="Precio promedio zona" value={d.mercado.precioPromedioZona} />
                </div>
                <div className="divide-y divide-[#2a3f5c]">
                  <MetricRow label="Perfil comprador NSE" value={d.mercado.perfilNSE} />
                  <MetricRow label="Plusvalía 3 años" value={d.mercado.plusvalia} valueClass="text-[#4ADE80] font-semibold" />
                  <MetricRow label="Inventario promedio" value={d.mercado.inventario} />
                </div>
              </div>
              <div className="bg-[#c9a227]/10 border border-[#c9a227]/30 rounded-xl px-4 py-3">
                <p className="text-[11px] font-bold text-[#c9a227] uppercase tracking-wide mb-1">Producto recomendado</p>
                <p className="text-[13px] font-semibold text-[#f4f0e6]">{d.mercado.productoRecomendado}</p>
              </div>

              {/* Comparables */}
              {d.mercado.comparables && d.mercado.comparables.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Proyectos comparables</p>
                  <div className="flex flex-col gap-2">
                    {d.mercado.comparables.map((c, i) => (
                      <div key={i} className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-[13px] font-semibold text-[#f4f0e6]">{c.nombre}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${c.avanceObra === 'Entregado' ? 'bg-[#c9a227]/15 text-[#ddc06a]' : c.avanceObra === 'En obra' ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#EEF2FF] text-[#4F46E5]'}`}>{c.avanceObra}</span>
                        </div>
                        <p className="text-[11px] text-[#8b96ab] mb-2">{c.direccion} · {c.fechaReferencia}</p>
                        <div className="flex gap-4">
                          {c.precioM2 != null && <span className="text-[11px] text-[#8b96ab]">💰 <b>${c.precioM2.toLocaleString('es-MX')}/m²</b></span>}
                          <span className="text-[11px] text-[#8b96ab]">🏢 {c.unidades} unidades</span>
                          <span className="text-[11px] text-[#8b96ab]">📐 {c.tipologia}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Oferta activa en el corredor */}
              {d.mercado.ofertaActiva && (
                <div className="mt-5">
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Oferta activa en el corredor</p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: 'En preventa', value: d.mercado.ofertaActiva.proyectosEnPreventa, color: '#4F46E5' },
                      { label: 'En obra', value: d.mercado.ofertaActiva.proyectosEnObra, color: '#D97706' },
                      { label: 'Entregados 24m', value: d.mercado.ofertaActiva.proyectosEntregados24m, color: '#4ADE80' },
                    ].map(item => (
                      <div key={item.label} className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl p-3 text-center">
                        <p className="text-[22px] font-bold" style={{ color: item.color }}>{item.value}</p>
                        <p className="text-[10px] text-[#8b96ab]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-[#8b96ab]">Rango de precios activos</p>
                      <p className="text-[13px] font-semibold text-[#f4f0e6]">{d.mercado.ofertaActiva.rangoPrecios}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[#8b96ab]">Unidades disponibles</p>
                      <p className="text-[13px] font-semibold text-[#f4f0e6]">{d.mercado.ofertaActiva.unidadesDisponibles}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8b96ab] mt-2 px-1">{d.mercado.ofertaActiva.saturacion}</p>
                </div>
              )}

              {/* Segmentación por tipo de unidad */}
              {d.mercado.segmentacion && d.mercado.segmentacion.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Segmentación por tipo de unidad</p>
                  <div className="flex flex-col gap-2">
                    {d.mercado.segmentacion.map((s, i) => (
                      <div key={i} className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[13px] font-semibold text-[#f4f0e6]">{s.tipo}</p>
                          <span className="text-[11px] font-bold text-[#c9a227]">{s.participacion}</span>
                        </div>
                        <div className="w-full bg-[#2a3f5c] rounded-full h-1.5 mb-2">
                          <div className="bg-[#c9a227] h-1.5 rounded-full" style={{ width: s.participacion }} />
                        </div>
                        <div className="flex gap-4">
                          <span className="text-[11px] text-[#8b96ab]">⚡ {s.absorcionMensual}</span>
                          <span className="text-[11px] text-[#8b96ab]">💰 ${s.precioM2.toLocaleString('es-MX')}/m²</span>
                          <span className="text-[11px] text-[#8b96ab]">👤 {s.perfilComprador}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estrategia de pricing por fase */}
              {d.mercado.pricingFases && d.mercado.pricingFases.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-bold text-[#8b96ab] uppercase tracking-wide mb-3">Estrategia de pricing por fase</p>
                  <div className="grid grid-cols-3 gap-3">
                    {d.mercado.pricingFases.map((f, i) => (
                      <div key={i} className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-[#8b96ab] uppercase">{f.fase}</p>
                          <span className="text-[10px] font-bold text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">{f.descuento}</span>
                        </div>
                        <p className="text-[16px] font-bold text-[#f4f0e6]">${f.precioM2.toLocaleString('es-MX')}<span className="text-[10px] font-normal text-[#8b96ab]">/m²</span></p>
                        <p className="text-[10px] text-[#8b96ab] mt-1">{f.meta}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Score de Resiliencia */}
          <div>
            <SectionTitle>Score de Resiliencia</SectionTitle>
            <Card>
              <div className="flex items-start gap-8">
                <ScoreGauge score={d.score.total} />
                <div className="flex-1">
                  <p className="text-[14px] text-[#8b96ab] leading-relaxed mb-4">
                    Un puntaje de <strong className="text-[#f4f0e6]">{d.score.total}/100</strong> indica que el proyecto{' '}
                    <strong className="text-[#4ADE80]">absorbe desviaciones moderadas</strong> sin comprometer la rentabilidad mínima requerida (TIR ≥ 12%).
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Solidez financiera', score: d.score.solidezFinanciera, color: d.score.solidezFinanciera >= 70 ? '#1D9E75' : '#D97706' },
                      { label: 'Riesgo regulatorio', score: d.score.riesgoRegulatorio, color: d.score.riesgoRegulatorio >= 70 ? '#1D9E75' : '#D97706' },
                      { label: 'Exposición de mercado', score: d.score.exposicionMercado, color: d.score.exposicionMercado >= 70 ? '#1D9E75' : '#D97706' },
                    ].map(item => (
                      <div key={item.label} className="bg-[#132a4d] rounded-xl p-3">
                        <p className="text-[10px] text-[#5f6a80] mb-2">{item.label}</p>
                        <div className="h-1.5 bg-[#2a3f5c] rounded-full overflow-hidden mb-1">
                          <div className="h-full rounded-full" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                        </div>
                        <p className="text-[12px] font-bold" style={{ color: item.color }}>{item.score}/100</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Metodología del Score */}
          {d.metodologiaScore && (
            <div>
              <SectionTitle>Metodología del Score de Resiliencia</SectionTitle>
              <Card>
                <p className="text-[13px] text-[#8b96ab] leading-relaxed mb-5">{d.metodologiaScore.descripcion}</p>
                <div className="flex flex-col gap-4">
                  {d.metodologiaScore.dimensiones.map((dim, i) => {
                    const color = dim.score >= 70 ? '#1D9E75' : dim.score >= 50 ? '#D97706' : '#DC2626'
                    return (
                      <div key={i} className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-[13px] font-bold text-[#f4f0e6]">{dim.nombre}</p>
                            <p className="text-[11px] text-[#5f6a80]">Ponderación: {dim.peso}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[22px] font-black leading-none" style={{ color }}>{dim.score}</p>
                            <p className="text-[10px] text-[#5f6a80]">/ 100</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#2a3f5c] rounded-full overflow-hidden mb-3">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dim.score}%`, backgroundColor: color }} />
                        </div>
                        <div className="flex flex-col gap-1.5 mb-3">
                          {dim.factores.map((f, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                              <div>
                                <p className="text-[11px] font-semibold text-[#f4f0e6]">{f.factor}</p>
                                <p className="text-[11px] text-[#8b96ab]">{f.contribucion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-lg px-3 py-2">
                          <p className="text-[12px] text-[#8b96ab] leading-relaxed">{dim.interpretacion}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Stress Test */}
          <div>
            <SectionTitle>Stress Test — Escenarios Adversos</SectionTitle>
            <div className="grid grid-cols-1 gap-4">
              {d.stressTest.map((s, i) => <StressCard key={i} {...s} />)}
            </div>
          </div>

          {/* Punto de Quiebre */}
          <div>
            <SectionTitle>Punto de Quiebre</SectionTitle>
            <Card>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Desviación máx. de costos', value: d.puntoQuiebre.desviacionMaxCostos, desc: 'antes de TIR < 12%', color: '#1D9E75' },
                  { label: 'Absorción mínima viable', value: d.puntoQuiebre.absorcionMinViable, desc: 'de las unidades proyectadas', color: '#D97706' },
                  { label: 'Precio venta mínimo', value: d.puntoQuiebre.precioVentaMinimo, desc: 'para recuperar inversión', color: '#D97706' },
                ].map(b => (
                  <div key={b.label} className="bg-[#132a4d] rounded-xl p-4 text-center border border-[#2a3f5c]">
                    <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide mb-2">{b.label}</p>
                    <p className="text-[22px] font-black" style={{ color: b.color }}>{b.value}</p>
                    <p className="text-[11px] text-[#5f6a80] mt-1">{b.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 bg-[#14301f] border border-[#2f6b4a] rounded-xl px-4 py-3">
                <CheckIcon />
                <p className="text-[12px] text-[#4ADE80]">{d.puntoQuiebre.resumen}</p>
              </div>
            </Card>
          </div>

          {/* Entrada a Mastermind */}
          <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[#f4f0e6] font-semibold text-[14px] mb-0.5">¿Quieres ajustar los números en vivo?</p>
              <p className="text-[#8b96ab] text-[12px]">
                Abre Mastermind para editar el proyecto y ver la TIR recalcularse al instante, o fija una TIR objetivo y calcula qué necesitas para alcanzarla.
              </p>
            </div>
            <button
              onClick={() => router.push('/mastermind')}
              className="flex-shrink-0 bg-[#c9a227] text-[#070f22] text-[13px] font-medium px-5 py-2.5 rounded-xl hover:bg-[#ddc06a] transition-colors whitespace-nowrap"
            >
              Abrir Mastermind →
            </button>
          </div>

          {/* Fuentes de Información */}
          {d.fuentes && (d.fuentes.legal?.length || d.fuentes.mercado?.length) && (
            <div>
              <SectionTitle>Fuentes de Información Consultadas</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                {d.fuentes.legal && d.fuentes.legal.length > 0 && (
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#378ADD" strokeWidth="1.3"/>
                          <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="#378ADD" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <p className="text-[11px] font-bold text-[#378ADD] tracking-[0.1em] uppercase">Agente Legal</p>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {d.fuentes.legal.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#378ADD] mt-1.5 shrink-0" />
                          <div>
                            <p className="text-[12px] font-medium text-[#f4f0e6] leading-snug">{f.nombre}</p>
                            <p className="text-[11px] text-[#5f6a80]">{f.tipo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {d.fuentes.mercado && d.fuentes.mercado.length > 0 && (
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-[#F3EEFF] flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 10l3-3.5 2.5 2 2.5-4L12 8" stroke="#8B5CF6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          <rect x="1" y="1" width="12" height="12" rx="2" stroke="#8B5CF6" strokeWidth="1.3"/>
                        </svg>
                      </div>
                      <p className="text-[11px] font-bold text-[#8B5CF6] tracking-[0.1em] uppercase">Agente de Mercado</p>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {d.fuentes.mercado.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] mt-1.5 shrink-0" />
                          <div>
                            <p className="text-[12px] font-medium text-[#f4f0e6] leading-snug">{f.nombre}</p>
                            <p className="text-[11px] text-[#5f6a80]">{f.tipo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Chat con el Agente */}
          <div>
            <SectionTitle>Consulta al Agente Mastermind</SectionTitle>
            <Card className="p-0 overflow-hidden">
              {chatMessages.length === 0 && (
                <div className="px-5 pt-4 pb-3 border-b border-[#2a3f5c]">
                  <p className="text-[11px] text-[#5f6a80] mb-3 uppercase tracking-wide">Preguntas frecuentes</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      '¿Cómo obtuviste el precio del terreno?',
                      '¿Por qué recomiendas esta tipología?',
                      '¿Qué tan confiable es la TIR proyectada?',
                      '¿Cuáles son los mayores riesgos del proyecto?',
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-[12px] text-[#c9a227] border border-[#c9a227]/40 bg-[#c9a227]/10 px-3 py-1.5 rounded-full hover:bg-[#c9a227]/20 transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.length > 0 && (
                <div className="flex flex-col gap-3 px-5 py-4 max-h-[380px] overflow-y-auto">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-[#c9a227] flex items-center justify-center shrink-0 mb-0.5">
                          <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
                          </svg>
                        </div>
                      )}
                      <div className={`max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#c9a227] text-[#070f22] rounded-2xl rounded-br-sm'
                          : 'bg-[#132a4d] border border-[#2a3f5c] text-[#f4f0e6] rounded-2xl rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-end gap-2 justify-start">
                      <div className="w-7 h-7 rounded-full bg-[#c9a227] flex items-center justify-center shrink-0 mb-0.5">
                        <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                          <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                          <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
                        </svg>
                      </div>
                      <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-2xl rounded-bl-sm px-4 py-3">
                        <span className="inline-flex gap-1">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#5f6a80] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              <div className={`flex gap-2 px-4 py-3 ${chatMessages.length > 0 ? 'border-t border-[#2a3f5c]' : ''}`}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Pregunta algo sobre el análisis…"
                  disabled={chatLoading}
                  className="flex-1 text-[13px] bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-2.5 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/10 placeholder:text-[#5f6a80] disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-10 h-10 rounded-xl bg-[#c9a227] flex items-center justify-center disabled:opacity-40 hover:bg-[#ddc06a] transition-colors cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 8H3M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </Card>
          </div>

          {/* Fuentes Consultadas */}
          <FuentesConsultadas />

          {/* CTA */}
          <div className="bg-[#c9a227]/10 border border-[#c9a227]/30 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-[#ddc06a] mb-1">Análisis completo · Listo para presentar</p>
              <p className="text-[13px] text-[#5a9078]">Genera la propuesta ejecutiva con escenarios A/B/C para inversionistas.</p>
            </div>
            <button
              onClick={() => {
                router.push(`/propuesta?proyecto=${encodeURIComponent(proyecto)}`)
              }}
              className="flex items-center gap-2 bg-[#c9a227] text-[#070f22] px-6 py-3.5 rounded-xl text-[14px] font-semibold hover:bg-[#ddc06a] transition-colors cursor-pointer shrink-0 ml-6"
            >
              Generar Propuesta de Inversión
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

        </div>
      </main>
    </div>
    </>
  )
}

export default function AnalisisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070f22] flex items-center justify-center"><p className="text-white/30">Cargando análisis…</p></div>}>
      <AnalisisContent />
    </Suspense>
  )
}
