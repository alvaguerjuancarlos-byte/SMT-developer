'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { downloadPDF, autoSavePDF } from '@/lib/downloadPDF'
import { saveProyecto } from '@/lib/saveProyecto'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateLegal {
  usoSuelo: string; cos: string; cus: string; altura: string
  cajones: string; restriccion: string; municipio: string
}
interface CandidateMercado {
  label: string; precioZona: string; absorcion: string
  competencia: string; perfilNSE: string; plusvalia: string; producto: string
}
interface Candidate {
  id: number; nombre: string; zona: string; ubicacion?: string
  lat: number; lng: number; precio: string; superficie: string
  preciom2: string; uso: string; mercadoColor: string
  score?: number; tir?: string; pros?: string[]; contras?: string[]
  recomendado?: boolean; legal: CandidateLegal; mercado: CandidateMercado
}
interface StressItem {
  titulo: string; escenario: string; impacto: string; status: 'green' | 'amber' | 'red'
}
interface Financiero {
  costoTerreno?: string; notaTerreno?: string
  costoConstruccion?: string; notaConstruccion?: string
  indirectos?: string; notaIndirectos?: string
  honorarios?: string; notaHonorarios?: string
  permisos?: string; notaPermisos?: string
  imprevistos?: string; notaImprevistos?: string
  inversion?: string
  precioVenta?: string; notaPrecioVenta?: string
  ingresos?: string; notaIngresos?: string
  utilidad?: string; margen?: string; horizonte?: string
}
interface Recomendacion {
  candidatoId: number; scoreResiliencia: number; texto: string
  stressTest: StressItem[]; financiero?: Financiero
}
interface ScoutData {
  candidatos: Candidate[]
  proyecto?: string
  recomendacion?: Recomendacion
}

// ─── Fallback data ────────────────────────────────────────────────────────────

const FALLBACK: ScoutData = {
  candidatos: [
    {
      id: 1, nombre: 'Valle Oriente', zona: 'San Pedro Garza García',
      ubicacion: 'Av. Vasconcelos 300 Pte., San Pedro Garza García, N.L.',
      lat: 25.658, lng: -100.367, precio: '$8,500,000', superficie: '1,200 m²',
      preciom2: '$7,083/m²', uso: 'Hab. Plurifamiliar', mercadoColor: 'green',
      score: 88, tir: '23.1%', recomendado: true,
      pros: ['Plusvalía +18% · mayor de la zona', 'Normativa plurifamiliar vigente · 12 niveles', 'Absorción 8 u/mes · NSE A/B consolidado'],
      contras: ['Precio/m² más alto del comparativo', 'Requiere sótano para cajones'],
      legal: { usoSuelo: 'Hab. Plurifamiliar', cos: '60%', cus: '2.4', altura: '12 niveles', cajones: '1.2 por unidad', restriccion: 'Requiere sótano para cajones', municipio: 'San Pedro Garza García' },
      mercado: { label: 'Demanda Alta', precioZona: '$38,500/m²', absorcion: '8 unidades/mes', competencia: '3 proyectos en radio 500 m', perfilNSE: 'A/B · 28–45 años', plusvalia: '+18% últimos 3 años', producto: 'Departamentos 80–120 m² NSE A/B' },
    },
    {
      id: 2, nombre: 'Cumbres Elite', zona: 'García, Nuevo León',
      ubicacion: 'Blvd. Cumbres 450, García, Nuevo León',
      lat: 25.734, lng: -100.408, precio: '$5,200,000', superficie: '1,850 m²',
      preciom2: '$2,811/m²', uso: 'Mixto / Comercial', mercadoColor: 'blue',
      score: 74, tir: '16.8%', recomendado: false,
      pros: ['Mayor superficie al precio más bajo', 'Precio/m² más competitivo ($2,811)', 'Zona en expansión con baja competencia'],
      contras: ['Cambio de uso de suelo requerido', 'Absorción baja (5 u/mes) · horizonte extendido'],
      legal: { usoSuelo: 'Mixto / Comercial', cos: '50%', cus: '1.8', altura: '8 niveles', cajones: '1.0 por unidad', restriccion: 'Cambio de uso de suelo requerido', municipio: 'García' },
      mercado: { label: 'Demanda Media', precioZona: '$22,000/m²', absorcion: '5 unidades/mes', competencia: '1 proyecto en radio 500 m', perfilNSE: 'B/C · 25–40 años', plusvalia: '+11% últimos 3 años', producto: 'Casas 80–100 m² NSE B/C' },
    },
    {
      id: 3, nombre: 'Distrito Tec', zona: 'Monterrey, N.L.',
      ubicacion: 'Calle Eugenio Garza Sada 2501, Monterrey',
      lat: 25.646, lng: -100.307, precio: '$7,100,000', superficie: '980 m²',
      preciom2: '$7,245/m²', uso: 'Hab. Plurifamiliar', mercadoColor: 'purple',
      score: 79, tir: '19.1%', recomendado: false,
      pros: ['Ubicación premium junto al Tec de Monterrey', 'Demanda alta y mercado estudiantil consolidado', 'Normativa plurifamiliar sin trámite adicional'],
      contras: ['Superficie más pequeña · menos unidades', 'Alta competencia en radio 300 m'],
      legal: { usoSuelo: 'Hab. Plurifamiliar', cos: '60%', cus: '2.2', altura: '10 niveles', cajones: '1.0 por unidad', restriccion: 'Alta competencia — diferenciación necesaria', municipio: 'Monterrey' },
      mercado: { label: 'Demanda Alta', precioZona: '$35,000/m²', absorcion: '7 unidades/mes', competencia: '5 proyectos en radio 500 m', perfilNSE: 'B · 22–35 años', plusvalia: '+14% últimos 3 años', producto: 'Departamentos compactos 50–70 m² NSE B' },
    },
  ],
  recomendacion: {
    candidatoId: 1, scoreResiliencia: 81,
    texto: 'El Terreno A (Valle Oriente) lidera el comparativo con el score más alto (88/100), la normativa más favorable para desarrollo vertical (Plurifamiliar, 12 niveles, CUS 2.4) y la mayor plusvalía de zona (+18% en 3 años). La velocidad de absorción de 8 unidades/mes en el segmento NSE A/B respalda un horizonte de 18 meses con una TIR de 23.1% anual y Score de Resiliencia de 81/100 frente a escenarios adversos simultáneos.',
    stressTest: [
      { titulo: 'Shock de Costos +15%', escenario: 'Costo total sube de $38.5 M a $43.1 M por incremento en materiales y mano de obra.', impacto: 'TIR: 23.1% → 18.2% · Margen: 37.0% → 26.8% · Proyecto sigue viable', status: 'amber' },
      { titulo: 'Freno de Ventas −50%', escenario: 'Absorción cae de 8 a 4 unidades/mes. Plazo se extiende 6 meses adicionales.', impacto: 'TIR: 23.1% → 15.0% · Margen: 37.0% → 28.4% · Viable con ajuste de plazo', status: 'amber' },
      { titulo: 'Ajuste de Mercado −10% en Precio', escenario: 'Precio de venta cae de $38,500 a $34,650/m². Ingresos bajan $6.7 M.', impacto: 'TIR: 23.1% → 10.4% · Margen: 37.0% → 15.1% · Al límite — revisar supuestos', status: 'red' },
    ],
    financiero: {
      costoTerreno: '$8,500,000 MXN', notaTerreno: '$7,083/m² · 1,200 m²',
      costoConstruccion: '$22,752,000 MXN', notaConstruccion: 'Acabados premium · clase A/B',
      indirectos: '$2,940,000 MXN', notaIndirectos: '8% sobre costo de obra',
      honorarios: '$1,620,000 MXN', notaHonorarios: '4.5% sobre costo de obra',
      permisos: '$680,000 MXN', notaPermisos: 'Municipio San Pedro Garza García',
      imprevistos: '$1,008,000 MXN', notaImprevistos: 'Reserva de contingencia',
      inversion: '$38,500,000 MXN',
      precioVenta: '$38,500/m²', notaPrecioVenta: 'Mercado Valle Oriente · NSE A/B',
      ingresos: '$66,759,000 MXN', notaIngresos: '1,734 m² vendibles',
      utilidad: '$14,259,000 MXN', margen: '37.0%', horizonte: '18 meses',
    },
  },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#9aab9f] tracking-[0.14em] uppercase mb-4 flex items-center gap-3">
      <span className="flex-1 h-px bg-[#E2E8E4]" />
      {children}
      <span className="flex-1 h-px bg-[#E2E8E4]" />
    </h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E2E8E4] shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function TableRow({ label, value, highlight = false, sub }: {
  label: string; value: string; highlight?: boolean; sub?: string
}) {
  return (
    <tr className={`${highlight ? 'bg-[#F0FBF6]' : ''} border-b border-[#F0F4F2] last:border-0`}>
      <td className="px-6 py-3">
        <p className={`text-[13px] ${highlight ? 'font-bold text-[#0F6E56]' : 'text-[#5a7065]'}`}>{label}</p>
        {sub && <p className="text-[11px] text-[#9aab9f]">{sub}</p>}
      </td>
      <td className="px-6 py-3 text-right">
        <p className={`text-[13px] ${highlight ? 'font-bold text-[#0F6E56]' : 'font-semibold text-[#111d17]'}`}>{value}</p>
      </td>
    </tr>
  )
}

function ScoreArc({ score }: { score: number }) {
  const r = 46
  const circ = Math.PI * r
  const dash = (score / 100) * circ
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
    red:   { badge: 'bg-[#FEE2E2] text-[#991B1B]', dot: '#DC2626', label: 'Crítico'   },
  }[status]
  return (
    <div className="flex items-start gap-4 py-4 border-b border-[#F0F4F2] last:border-0">
      <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: cfg.dot }} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[13px] font-bold text-[#111d17]">{titulo}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
        </div>
        <p className="text-[12px] text-[#5a7065] mb-1">{escenario}</p>
        <p className="text-[12px] font-semibold text-[#111d17]">{impacto}</p>
      </div>
    </div>
  )
}

const ID_LABELS = ['A', 'B', 'C']

// ─── Main page ────────────────────────────────────────────────────────────────

function abbrevMXN(s: string): string {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (!n) return s
  return `$${(n / 1_000_000).toFixed(1)} M`
}

function PropuestaFlujoBContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyectoParam = params.get('proyecto') || ''
  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  const [scoutData, setScoutData] = useState<ScoutData>(FALLBACK)
  const [aiGenerated, setAiGenerated] = useState(false)
  const handleDownloadPDF = () => {
    const proyectoId = localStorage.getItem('smt_proyecto_id') || undefined
    downloadPDF(`propuesta-${proyecto.replace(/\s+/g, '-').toLowerCase()}.pdf`, proyectoId)
  }

  useEffect(() => {
    const raw = localStorage.getItem('smt_scout_data')
    if (raw) {
      try {
        const parsed: ScoutData = JSON.parse(raw)
        if (parsed?.candidatos?.length) {
          setScoutData(parsed)
          setAiGenerated(true)
          if (!localStorage.getItem('smt_proyecto_id')) {
            const nombre = proyectoParam || parsed.proyecto || 'Proyecto Scout'
            saveProyecto({ nombre, datos: parsed, flujo: 'B' })
              .then(r => { if (r.ok && r.id) localStorage.setItem('smt_proyecto_id', r.id) })
              .catch(() => {})
          }
        }
      } catch { /* keep fallback */ }
    }
  }, [])

  // Auto-guardar PDF en Mis Proyectos cuando carga la propuesta
  useEffect(() => {
    const proyectoId = localStorage.getItem('smt_proyecto_id') || undefined
    if (!proyectoId) return
    const filename = `propuesta-${(proyectoParam || 'proyecto').replace(/\s+/g, '-').toLowerCase()}.pdf`
    const timer = setTimeout(() => {
      autoSavePDF(filename, proyectoId).catch(err => console.warn('[propuesta-b] autoSave:', err))
    }, 3500)
    return () => clearTimeout(timer)
  }, [])

  const candidates = scoutData.candidatos
  const rec = scoutData.recomendacion
  const recCand = candidates.find(c => c.recomendado || c.id === rec?.candidatoId) || candidates[0]
  const recIdx = candidates.indexOf(recCand)
  const proyecto = proyectoParam || scoutData.proyecto || 'Proyecto Scout'
  const fin = rec?.financiero || FALLBACK.recomendacion!.financiero!

  const backUrl = `/analisis/flujo-b${proyecto ? `?proyecto=${encodeURIComponent(proyecto)}` : ''}`

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">

      {/* Sticky header */}
      <header className="px-8 py-4 flex items-center gap-3 border-b border-[#E2E8E4] bg-white sticky top-0 z-20">
        <div className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] font-medium text-[#1a1a1a] tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-[#6b7c74] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {aiGenerated && (
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#E1F5EE] border border-[#9FE1CB] text-[#0F6E56] px-2.5 py-1 rounded-full">
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
          <button
            onClick={() => router.push(backUrl)}
            className="flex items-center gap-1.5 text-[13px] text-[#5a7065] hover:text-[#111d17] transition-colors mr-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver al Análisis
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl border transition-colors text-[#0F6E56] border-[#9FE1CB] bg-[#E1F5EE] hover:bg-[#1D9E75] hover:text-white hover:border-[#1D9E75] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Descargar PDF
          </button>
          <div className="relative group">
            <button disabled className="flex items-center gap-1.5 text-[13px] font-medium text-[#9aab9f] border border-[#E2E8E4] bg-[#F7F8F6] px-4 py-2 rounded-xl cursor-not-allowed">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="3" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4.3 6.3l5.4-2.6M4.3 7.7l5.4 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Compartir
            </button>
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#111d17] text-white text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Próximamente
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div id="propuesta-print" className="w-full max-w-[800px] mx-auto flex flex-col gap-10">

          {/* 1 · Cover */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1a12 0%, #111d17 55%, #0c1f15 100%)' }}>
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
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75]/20 border border-[#1D9E75]/40 text-[#9FE1CB] px-3 py-1 rounded-full">
                  Confidencial
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#9FE1CB] tracking-[0.14em] uppercase mb-2">
                Propuesta Comparativa de Inversión · {candidates.length} Candidatos
              </p>
              <h1 className="text-[34px] font-black text-white leading-tight mb-2">{proyecto}</h1>
              <p className="text-[14px] text-white/50">{recCand?.zona || ''} · {today}</p>
            </div>
            <div className="grid grid-cols-4 divide-x divide-white/10">
              {[
                { label: 'Candidatos evaluados', value: String(candidates.length), sub: 'Flujo B · Scout IA', green: false },
                { label: 'TIR recomendado', value: recCand?.tir || '—', sub: 'anual · caso base', green: true },
                { label: 'Inversión estimada', value: fin.inversion ? abbrevMXN(fin.inversion) : '—', sub: `MXN · ${recCand?.nombre || '—'}`, green: false },
                { label: 'Score Resiliencia', value: `${rec?.scoreResiliencia ?? recCand?.score ?? 81}/100`, sub: 'Proyecto viable', green: true },
              ].map((m, i) => (
                <div key={i} className="px-6 py-5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className={`text-[24px] font-black leading-none ${m.green ? 'text-[#4ade80]' : 'text-white'}`}>{m.value}</p>
                  <p className="text-[11px] text-white/30 mt-1">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2 · Executive summary — candidate cards */}
          <div>
            <SectionTitle>Resumen Ejecutivo · Comparativa de Candidatos</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              {candidates.map((c, i) => {
                const isRec = c.recomendado || c.id === rec?.candidatoId
                const scoreBg = (c.score ?? 75) >= 80 ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-[#FEF3C7] text-[#92600A]'
                return (
                  <div key={c.id} className={`rounded-2xl border overflow-hidden shadow-sm ${isRec ? 'border-[#1D9E75]' : 'border-[#E2E8E4]'}`}>
                    <div className={`px-5 py-4 border-b ${isRec ? 'bg-[#E1F5EE] border-[#9FE1CB]' : 'bg-white border-[#F0F4F2]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-[#111d17] flex items-center justify-center text-white font-black text-[12px]">{ID_LABELS[i]}</div>
                        {isRec && (
                          <span className="text-[9px] font-bold tracking-[0.12em] uppercase bg-[#1D9E75] text-white px-2 py-0.5 rounded-full">Recomendado</span>
                        )}
                      </div>
                      <p className={`text-[13px] font-bold leading-tight ${isRec ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{c.nombre}</p>
                      <p className="text-[10px] text-[#9aab9f] mt-0.5">{c.zona}</p>
                    </div>
                    <div className="px-5 py-4 bg-white flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#9aab9f]">TIR estimada</span>
                        <span className={`text-[13px] font-bold ${isRec ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{c.tir || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#9aab9f]">Precio terreno</span>
                        <span className="text-[13px] font-semibold text-[#111d17]">{c.precio} MXN</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#9aab9f]">Score global</span>
                        <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${scoreBg}`}>{c.score ?? '—'}/100</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3 · Recommended terreno */}
          {recCand && (
            <div>
              <SectionTitle>Terreno Recomendado · {recCand.nombre}</SectionTitle>
              <div className="rounded-2xl overflow-hidden border border-[#9FE1CB]" style={{ background: 'linear-gradient(135deg, #0a1a12 0%, #0f2a1c 100%)' }}>
                <div className="px-8 py-7">
                  <div className="flex items-start gap-6 mb-6">
                    <div className="shrink-0">
                      <ScoreArc score={rec?.scoreResiliencia ?? recCand.score ?? 81} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75]/20 border border-[#1D9E75]/40 text-[#9FE1CB] px-3 py-1 rounded-full">
                          Candidato {ID_LABELS[recIdx] || 'A'} · Seleccionado
                        </span>
                      </div>
                      <h3 className="text-[22px] font-black text-white mb-1">{recCand.nombre}</h3>
                      <p className="text-[13px] text-white/50 mb-4">{recCand.ubicacion || recCand.zona}</p>
                      <p className="text-[13px] text-white/70 leading-relaxed">{rec?.texto || FALLBACK.recomendacion!.texto}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 pt-6 border-t border-white/10">
                    {[
                      { label: 'TIR Anual',        value: recCand.tir || '—',                      green: true  },
                      { label: 'Precio Terreno',    value: recCand.precio,                           green: false },
                      { label: 'Score Resiliencia', value: `${rec?.scoreResiliencia ?? recCand.score ?? 81}/100`, green: true  },
                      { label: 'Horizonte',         value: fin.horizonte || '—',                    green: false },
                    ].map((m, i) => (
                      <div key={i} className="text-center">
                        <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{m.label}</p>
                        <p className={`text-[20px] font-black leading-none ${m.green ? 'text-[#4ade80]' : 'text-white'}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4 · Comparative pros/cons */}
          <div>
            <SectionTitle>Comparativa de Fortalezas y Riesgos</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8E4] bg-[#F7F8F6]">
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide w-[120px]">Candidato</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-[#1D9E75] uppercase tracking-wide">Fortalezas</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-[#D97706] uppercase tracking-wide">Riesgos</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => {
                    const isRec = c.recomendado || c.id === rec?.candidatoId
                    return (
                      <tr key={c.id} className={`border-b border-[#F0F4F2] last:border-0 ${isRec ? 'bg-[#F0FBF6]' : i % 2 !== 0 ? 'bg-[#FAFBFA]' : ''}`}>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-[#111d17] flex items-center justify-center text-white font-black text-[11px] shrink-0">{ID_LABELS[i]}</div>
                            <div>
                              <p className={`text-[12px] font-bold ${isRec ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{c.nombre}</p>
                              {isRec && <p className="text-[9px] text-[#1D9E75] font-semibold">Recomendado</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <ul className="flex flex-col gap-1">
                            {(c.pros || []).map((p, pi) => (
                              <li key={pi} className="flex items-start gap-1.5">
                                <span className="text-[#1D9E75] font-bold text-[11px] mt-0.5">✓</span>
                                <span className="text-[12px] text-[#5a7065]">{p}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <ul className="flex flex-col gap-1">
                            {(c.contras || []).map((con, ci) => (
                              <li key={ci} className="flex items-start gap-1.5">
                                <span className="text-[#D97706] font-bold text-[11px] mt-0.5">▲</span>
                                <span className="text-[12px] text-[#5a7065]">{con}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          {/* 5 · Financial structure */}
          {recCand && (
            <div>
              <SectionTitle>Estructura Financiera · {recCand.nombre}</SectionTitle>
              <Card className="p-0 overflow-hidden">
                <table className="w-full">
                  <tbody>
                    <TableRow label="Costo del terreno" value={fin.costoTerreno || recCand.precio} sub={fin.notaTerreno || `${recCand.preciom2} · ${recCand.superficie}`} />
                    <TableRow label="Costo de construcción" value={fin.costoConstruccion || '—'} sub={fin.notaConstruccion || ''} />
                    <TableRow label="Indirectos y administración" value={fin.indirectos || '—'} sub={fin.notaIndirectos || '8% sobre costo de obra'} />
                    <TableRow label="Honorarios y diseño" value={fin.honorarios || '—'} sub={fin.notaHonorarios || '4.5% sobre costo de obra'} />
                    <TableRow label="Permisos y licencias" value={fin.permisos || '—'} sub={fin.notaPermisos || ''} />
                    <TableRow label="Imprevistos (5%)" value={fin.imprevistos || '—'} sub={fin.notaImprevistos || 'Reserva de contingencia'} />
                    <TableRow label="Inversión Total" value={fin.inversion || '—'} highlight />
                    <TableRow label="Precio de venta estimado / m²" value={fin.precioVenta || '—'} sub={fin.notaPrecioVenta || ''} />
                    <TableRow label="Ingresos proyectados (100%)" value={fin.ingresos || '—'} sub={fin.notaIngresos || ''} />
                    <TableRow label="Utilidad bruta" value={fin.utilidad || '—'} />
                    <TableRow label="Margen bruto sobre inversión" value={fin.margen || '—'} highlight />
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* 6 · Stress test */}
          <div>
            <SectionTitle>Stress Test · {recCand?.nombre || 'Terreno Recomendado'}</SectionTitle>
            <Card className="p-6">
              {(rec?.stressTest || FALLBACK.recomendacion!.stressTest).map((s, i) => (
                <StressRow key={i} {...s} />
              ))}
            </Card>
          </div>

          {/* 7 · Próximos Pasos */}
          <div>
            <SectionTitle>Próximos Pasos</SectionTitle>
            <Card className="p-6">
              <div className="flex flex-col gap-4">
                {[
                  {
                    n: '01',
                    title: `Negociar y reservar ${recCand?.nombre || 'el terreno recomendado'}`,
                    desc: 'Iniciar contacto formal con el propietario. Firma de carta intención y depósito en garantía equivalente al 3–5% del precio acordado. Plazo estimado: 1–2 semanas.',
                    color: '#1D9E75',
                  },
                  {
                    n: '02',
                    title: 'Completar debida diligencia',
                    desc: 'Obtener escrituras, constancia de uso de suelo, estudio de suelo y factibilidad de servicios. Verificar libertad de gravámenes ante Registro Público. Plazo: 3–4 semanas.',
                    color: '#1D9E75',
                  },
                  {
                    n: '03',
                    title: 'Estructurar esquema de capital',
                    desc: 'Definir la mezcla equity / crédito puente (propuesta: 40% / 60%). Gestionar carta de intención de crédito con institución financiera seleccionada.',
                    color: '#D97706',
                  },
                  {
                    n: '04',
                    title: 'Iniciar diseño arquitectónico y permisos',
                    desc: `Contratar despacho de arquitectura para proyecto ejecutivo. Gestionar licencia de construcción ante ${recCand?.legal?.municipio || 'el municipio correspondiente'}. Plazo estimado: 2–3 meses.`,
                    color: '#D97706',
                  },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[13px] text-white" style={{ backgroundColor: s.color }}>
                      {s.n}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-[14px] font-bold text-[#111d17] mb-1">{s.title}</p>
                      <p className="text-[13px] text-[#5a7065] leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 8 · Footer */}
          <div className="rounded-2xl overflow-hidden border border-[#E2E8E4]">
            <div className="bg-[#111d17] px-8 py-6 flex items-center justify-between">
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
                <p className="text-[11px] text-white/40 mt-0.5">Análisis Mastermind v1.0 · Flujo B</p>
              </div>
            </div>
            <div className="bg-white px-8 py-4">
              <p className="text-[11px] text-[#9aab9f] leading-relaxed">
                <strong className="text-[#5a7065]">Aviso de confidencialidad:</strong> Este documento ha sido generado por SMT Developer con base en información de mercado disponible al {today} y constituye una proyección con fines informativos para inversionistas calificados. Las cifras son estimaciones y no garantizan rendimientos futuros. Se recomienda complementar con debida diligencia completa. Distribución restringida — uso exclusivo del destinatario.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

export default function PropuestaFlujoBPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f]">Generando propuesta comparativa…</p>
      </div>
    }>
      <PropuestaFlujoBContent />
    </Suspense>
  )
}
