'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StressItem {
  titulo: string
  escenario: string
  impacto: string
  status: 'green' | 'amber' | 'red'
}

interface Fuente { nombre: string; tipo: string }
interface Fuentes { legal?: Fuente[]; mercado?: Fuente[] }

interface AnalisisData {
  proyecto?: string
  recomendacion: { tipologia: string; descripcion: string }
  fichaLegal: { usoSuelo: string; cos: string; cus: string; altura: string; cajones: string; municipio: string; restriccion: string }
  financiero: {
    costoTerreno: number; costoTerrenoM2: number; construccionM2: number
    costoTotalConstruccion: number; indirectos: number; honorarios: number
    imprevistos: number; inversionTotal: number; precioVentaM2: number
    ingresosProyectados: number; utilidadBruta: number; margenBruto: number; tir: number
  }
  mercado: { demanda: string; zona: string; absorcion: string; proyectosActivos: string; precioPromedioZona: string; perfilNSE: string; plusvalia: string; inventario: string; productoRecomendado: string }
  score: { total: number; solidezFinanciera: number; riesgoRegulatorio: number; exposicionMercado: number }
  stressTest: StressItem[]
  puntoQuiebre: { desviacionMaxCostos: string; absorcionMinViable: string; precioVentaMinimo: string; resumen: string }
  fuentes?: Fuentes
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

function CheckIcon({ color = '#1D9E75' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7l3 3 6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-bold text-[#9aab9f] tracking-[0.12em] uppercase mb-4">{children}</h2>
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-6 ${className}`}>{children}</div>
}

function MetricRow({ label, value, valueClass = 'text-[#111d17]', border = true }: { label: string; value: React.ReactNode; valueClass?: string; border?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${border ? 'border-b border-[#F0F4F2]' : ''} last:border-0`}>
      <p className="text-[13px] text-[#5a7065]">{label}</p>
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
  const labelColor = score >= 70 ? 'text-[#0F6E56]' : score >= 50 ? 'text-[#92600A]' : 'text-red-700'
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 90 }}>
        <svg width="140" height="90" viewBox="0 0 140 90" fill="none">
          <path d="M 16 74 A 54 54 0 0 1 124 74" stroke="#F0F4F2" strokeWidth="12" strokeLinecap="round" fill="none"/>
          <path d="M 16 74 A 54 54 0 0 1 124 74" stroke={color} strokeWidth="12" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1">
          <span className="text-[32px] font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[11px] text-[#9aab9f]">/ 100</span>
        </div>
      </div>
      <span className={`text-[12px] font-bold mt-2 ${labelColor}`}>{label}</span>
    </div>
  )
}

function StressCard({ titulo, escenario, impacto, status }: StressItem) {
  const colors = {
    green: { bg: 'bg-[#F0FBF6]', border: 'border-[#9FE1CB]', badge: 'bg-[#E1F5EE] text-[#0F6E56]', dot: '#1D9E75' },
    amber: { bg: 'bg-[#FFFBEB]', border: 'border-[#F5D97A]', badge: 'bg-[#FEF3C7] text-[#92600A]', dot: '#D97706' },
    red: { bg: 'bg-[#FFF5F5]', border: 'border-[#FECACA]', badge: 'bg-[#FEE2E2] text-[#991B1B]', dot: '#DC2626' },
  }
  const c = colors[status]
  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
          <p className="text-[13px] font-bold text-[#111d17]">{titulo}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
          {status === 'green' ? 'Tolerable' : status === 'amber' ? 'Monitorear' : 'Crítico'}
        </span>
      </div>
      <p className="text-[12px] text-[#5a7065] mb-3">{escenario}</p>
      <p className="text-[13px] font-semibold text-[#111d17]">{impacto}</p>
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
      const res = await fetch('/api/chat-analisis', {
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

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">
      <header className="px-8 py-5 flex items-center gap-3 border-b border-[#E2E8E4] bg-white sticky top-0 z-10">
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
        <div className="ml-auto flex items-center gap-3">
          {aiGenerated && (
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#E1F5EE] border border-[#9FE1CB] text-[#0F6E56] px-3 py-1 rounded-full">
              IA generado
            </span>
          )}
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[13px] text-[#5a7065] hover:text-[#111d17] border border-[#E2E8E4] hover:border-[#C8D5CF] px-3 py-1.5 rounded-xl transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Mis Proyectos
          </button>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] text-[#5a7065] hover:text-[#111d17] transition-colors">
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
          <div className="bg-[#111d17] rounded-2xl p-7 text-white">
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75] text-white px-3 py-1 rounded-full mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Análisis Completado
                </span>
                <h1 className="text-[26px] font-bold text-white leading-tight">{proyecto}</h1>
                <p className="text-[13px] text-white/50 mt-1">Reporte de inversión · Flujo A · {d.mercado.zona}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/10">
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">TIR Proyectada</p>
                <p className="text-[28px] font-black text-[#4ade80]">{f.tir}%</p>
                <p className="text-[11px] text-white/40">anual</p>
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">Inversión Total</p>
                <p className="text-[28px] font-black text-white">{fmt(f.inversionTotal)}</p>
                <p className="text-[11px] text-white/40">MXN</p>
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">Score Resiliencia</p>
                <p className="text-[28px] font-black text-[#4ade80]">{d.score.total}</p>
                <p className="text-[11px] text-white/40">/ 100</p>
              </div>
            </div>
          </div>

          {/* Recomendación */}
          <div>
            <SectionTitle>Recomendación Principal</SectionTitle>
            <div className="bg-[#F0FBF6] border border-[#1D9E75]/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1D9E75] flex items-center justify-center shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8"/>
                    <path d="M3 9h18M9 21V9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#1D9E75] tracking-[0.12em] uppercase mb-1">Tipología recomendada</p>
                  <h3 className="text-[20px] font-bold text-[#111d17] mb-2">{d.recomendacion.tipologia}</h3>
                  <p className="text-[14px] text-[#5a7065] leading-relaxed">{d.recomendacion.descripcion}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ficha Legal */}
          <div>
            <SectionTitle>Ficha Legal y Normativa</SectionTitle>
            <Card>
              <div className="grid grid-cols-2 gap-x-8">
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Uso de suelo" value={d.fichaLegal.usoSuelo} />
                  <MetricRow label="COS permitido" value={d.fichaLegal.cos} />
                  <MetricRow label="CUS" value={d.fichaLegal.cus} />
                </div>
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Altura máxima" value={d.fichaLegal.altura} />
                  <MetricRow label="Cajones por unidad" value={d.fichaLegal.cajones} />
                  <MetricRow label="Municipio" value={d.fichaLegal.municipio} />
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 bg-[#FFFBEB] border border-[#F5D97A] rounded-xl px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                  <path d="M7 2L12.5 11.5H1.5L7 2Z" stroke="#D97706" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M7 6v3" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="10" r="0.5" fill="#D97706"/>
                </svg>
                <p className="text-[12px] text-[#92600A]"><strong>Restricción:</strong> {d.fichaLegal.restriccion}</p>
              </div>
            </Card>
          </div>

          {/* Estimación de costos */}
          <div>
            <SectionTitle>Estimación de Costos e Ingresos</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <tbody>
                  {[
                    { label: 'Costo del terreno', value: fmt(f.costoTerreno), sub: `${fmt(f.costoTerrenoM2)}/m²`, highlight: false },
                    { label: 'Construcción por m²', value: `${fmt(f.construccionM2)}/m²`, sub: 'Clase media-alta, acabados premium', highlight: false },
                    { label: 'Costo total construcción', value: fmt(f.costoTotalConstruccion), sub: '', highlight: false },
                    { label: 'Indirectos y permisos', value: fmt(f.indirectos), sub: '8% sobre costo de obra', highlight: false },
                    { label: 'Honorarios y diseño', value: fmt(f.honorarios), sub: '4.5% sobre costo de obra', highlight: false },
                    { label: 'Imprevistos (5%)', value: fmt(f.imprevistos), sub: 'Reserva de contingencia', highlight: false },
                    { label: 'Inversión Total', value: fmt(f.inversionTotal), sub: '', highlight: true },
                    { label: 'Precio venta estimado / m²', value: `${fmt(f.precioVentaM2)}/m²`, sub: `Mercado ${d.mercado.zona} · NSE ${d.mercado.perfilNSE.split('·')[0].trim()}`, highlight: false },
                    { label: 'Ingresos proyectados', value: fmt(f.ingresosProyectados), sub: '100% absorción', highlight: false },
                    { label: 'Utilidad bruta', value: fmt(f.utilidadBruta), sub: '', highlight: false },
                    { label: 'Margen bruto', value: `${f.margenBruto}%`, sub: 'sobre inversión total', highlight: true },
                  ].map((row, i) => (
                    <tr key={i} className={row.highlight ? 'bg-[#F0FBF6]' : i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFA]'}>
                      <td className="px-6 py-3 border-b border-[#F0F4F2]">
                        <p className={`text-[13px] ${row.highlight ? 'font-bold text-[#0F6E56]' : 'text-[#5a7065]'}`}>{row.label}</p>
                        {row.sub && <p className="text-[11px] text-[#9aab9f]">{row.sub}</p>}
                      </td>
                      <td className="px-6 py-3 border-b border-[#F0F4F2] text-right">
                        <p className={`text-[13px] ${row.highlight ? 'font-bold text-[#0F6E56]' : 'font-semibold text-[#111d17]'}`}>{row.value}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Análisis de Mercado */}
          <div>
            <SectionTitle>Análisis de Mercado</SectionTitle>
            <Card>
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#9FE1CB]">
                  <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                  Demanda {d.mercado.demanda}
                </span>
                <span className="text-[12px] text-[#5a7065]">{d.mercado.zona}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 mb-5">
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Velocidad de absorción" value={d.mercado.absorcion} valueClass="text-[#0F6E56] font-semibold" />
                  <MetricRow label="Proyectos activos radio 500 m" value={d.mercado.proyectosActivos} />
                  <MetricRow label="Precio promedio zona" value={d.mercado.precioPromedioZona} />
                </div>
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Perfil comprador NSE" value={d.mercado.perfilNSE} />
                  <MetricRow label="Plusvalía 3 años" value={d.mercado.plusvalia} valueClass="text-[#0F6E56] font-semibold" />
                  <MetricRow label="Inventario promedio" value={d.mercado.inventario} />
                </div>
              </div>
              <div className="bg-[#F0FBF6] border border-[#D4EFE3] rounded-xl px-4 py-3">
                <p className="text-[11px] font-bold text-[#1D9E75] uppercase tracking-wide mb-1">Producto recomendado</p>
                <p className="text-[13px] font-semibold text-[#111d17]">{d.mercado.productoRecomendado}</p>
              </div>
            </Card>
          </div>

          {/* Score de Resiliencia */}
          <div>
            <SectionTitle>Score de Resiliencia</SectionTitle>
            <Card>
              <div className="flex items-start gap-8">
                <ScoreGauge score={d.score.total} />
                <div className="flex-1">
                  <p className="text-[14px] text-[#5a7065] leading-relaxed mb-4">
                    Un puntaje de <strong className="text-[#111d17]">{d.score.total}/100</strong> indica que el proyecto{' '}
                    <strong className="text-[#0F6E56]">absorbe desviaciones moderadas</strong> sin comprometer la rentabilidad mínima requerida (TIR ≥ 12%).
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Solidez financiera', score: d.score.solidezFinanciera, color: d.score.solidezFinanciera >= 70 ? '#1D9E75' : '#D97706' },
                      { label: 'Riesgo regulatorio', score: d.score.riesgoRegulatorio, color: d.score.riesgoRegulatorio >= 70 ? '#1D9E75' : '#D97706' },
                      { label: 'Exposición de mercado', score: d.score.exposicionMercado, color: d.score.exposicionMercado >= 70 ? '#1D9E75' : '#D97706' },
                    ].map(item => (
                      <div key={item.label} className="bg-[#F7F8F6] rounded-xl p-3">
                        <p className="text-[10px] text-[#9aab9f] mb-2">{item.label}</p>
                        <div className="h-1.5 bg-[#E2E8E4] rounded-full overflow-hidden mb-1">
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
                  <div key={b.label} className="bg-[#F7F8F6] rounded-xl p-4 text-center border border-[#E2E8E4]">
                    <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-2">{b.label}</p>
                    <p className="text-[22px] font-black" style={{ color: b.color }}>{b.value}</p>
                    <p className="text-[11px] text-[#9aab9f] mt-1">{b.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 bg-[#F0FBF6] border border-[#9FE1CB] rounded-xl px-4 py-3">
                <CheckIcon />
                <p className="text-[12px] text-[#0F6E56]">{d.puntoQuiebre.resumen}</p>
              </div>
            </Card>
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
                            <p className="text-[12px] font-medium text-[#111d17] leading-snug">{f.nombre}</p>
                            <p className="text-[11px] text-[#9aab9f]">{f.tipo}</p>
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
                            <p className="text-[12px] font-medium text-[#111d17] leading-snug">{f.nombre}</p>
                            <p className="text-[11px] text-[#9aab9f]">{f.tipo}</p>
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
                <div className="px-5 pt-4 pb-3 border-b border-[#F0F4F2]">
                  <p className="text-[11px] text-[#9aab9f] mb-3 uppercase tracking-wide">Preguntas frecuentes</p>
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
                        className="text-[12px] text-[#1D9E75] border border-[#9FE1CB] bg-[#F0FBF6] px-3 py-1.5 rounded-full hover:bg-[#E1F5EE] transition-colors cursor-pointer"
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
                        <div className="w-7 h-7 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0 mb-0.5">
                          <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
                          </svg>
                        </div>
                      )}
                      <div className={`max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#1D9E75] text-white rounded-2xl rounded-br-sm'
                          : 'bg-[#F7F8F6] border border-[#E2E8E4] text-[#111d17] rounded-2xl rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-end gap-2 justify-start">
                      <div className="w-7 h-7 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0 mb-0.5">
                        <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                          <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                          <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
                        </svg>
                      </div>
                      <div className="bg-[#F7F8F6] border border-[#E2E8E4] rounded-2xl rounded-bl-sm px-4 py-3">
                        <span className="inline-flex gap-1">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#9aab9f] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              <div className={`flex gap-2 px-4 py-3 ${chatMessages.length > 0 ? 'border-t border-[#F0F4F2]' : ''}`}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Pregunta algo sobre el análisis…"
                  disabled={chatLoading}
                  className="flex-1 text-[13px] bg-[#F7F8F6] border border-[#E2E8E4] rounded-xl px-4 py-2.5 outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 placeholder:text-[#c0cdc7] disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-10 h-10 rounded-xl bg-[#1D9E75] flex items-center justify-center disabled:opacity-40 hover:bg-[#0F6E56] transition-colors cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 8H3M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </Card>
          </div>

          {/* CTA */}
          <div className="bg-[#F0FBF6] border border-[#1D9E75]/30 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-[#0F6E56] mb-1">Análisis completo · Listo para presentar</p>
              <p className="text-[13px] text-[#5a9078]">Genera la propuesta ejecutiva con escenarios A/B/C para inversionistas.</p>
            </div>
            <button
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                  const raw = localStorage.getItem('smt_analisis_data')
                  if (raw) {
                    const datos = JSON.parse(raw)
                    await supabase.from('proyectos').insert(
                      { usuario_id: user.id, nombre: proyecto, datos, flujo: 'A', status: 'propuesta' }
                    )
                  }
                }
                router.push(`/propuesta?proyecto=${encodeURIComponent(proyecto)}`)
              }}
              className="flex items-center gap-2 bg-[#1D9E75] text-white px-6 py-3.5 rounded-xl text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors cursor-pointer shrink-0 ml-6"
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
  )
}

export default function AnalisisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center"><p className="text-[#9aab9f]">Cargando análisis…</p></div>}>
      <AnalisisContent />
    </Suspense>
  )
}
