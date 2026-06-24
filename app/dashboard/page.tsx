'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Proyecto {
  id: string
  nombre: string
  created_at: string
  status: string
  flujo: 'A' | 'B'
  datos?: Record<string, unknown>
  pdf_url?: string
}

interface FuenteCategoria {
  color: string
  titulo: string
  sub: string
  items: [string, string][]
}

const FUENTES_DATA: FuenteCategoria[] = [
  { color: '#3B82F6', titulo: 'Normativa Urbana',         sub: 'Planes y zonificación',
    items: [['Plan de Desarrollo Urbano Municipal', 'Usos de suelo, densidades y alturas permitidas'],
            ['Plan Parcial de Desarrollo Urbano',   'Detalle normativo de zona específica'],
            ['Tabla de Compatibilidades de Uso',    'CUS / COS / CAS aplicables al predio'],
            ['Programa de Ordenamiento Territorial','Macro-zonificación y vocación regional']] },
  { color: '#D97706', titulo: 'Marco Legal Federal',       sub: 'Legislación nacional',
    items: [['LGAHOTDU',             'Ley de Asentamientos Humanos y Ordenamiento Territorial'],
            ['Ley de Vivienda',      'Criterios de habitabilidad y acceso a financiamiento'],
            ['LGEEPA',               'Equilibrio Ecológico y Protección al Ambiente'],
            ['Código Civil Federal', 'Régimen de propiedad, contratos y garantías']] },
  { color: '#F97316', titulo: 'Reglamentación Local',      sub: 'Estatal y municipal',
    items: [['Reglamento de Construcciones',     'Normas técnicas y especificaciones de edificación'],
            ['Ley de Desarrollo Urbano Estatal', 'Marco regulatorio del estado donde se ubica'],
            ['Reglamento de Zonificación',       'Restricciones específicas por zona y uso'],
            ['Ley de Catastro Municipal',         'Valuación catastral y registro predial']] },
  { color: '#1D9E75', titulo: 'Mercado Inmobiliario',      sub: 'Comparables y absorción',
    items: [['Inmuebles24 / Vivanuncios',           'Base de oferta activa y precios por zona'],
            ['CBRE / JLL / Colliers',              'Reportes de mercado comercial e industrial'],
            ['AMPI',                               'Índices de precios y velocidad de absorción'],
            ['SHF — Índice de Precios de Vivienda','Evolución histórica del valor habitacional']] },
  { color: '#059669', titulo: 'Financiero y Fiscal',       sub: 'Costos, tasas e impuestos',
    items: [['BANXICO',               'Tasa de referencia, inflación y tipo de cambio'],
            ['INFONAVIT / FOVISSSTE', 'Mezcla de crédito y elegibilidad de compradores'],
            ['CMIC',                  'Índice Nacional de Costos de Construcción por m²'],
            ['SAT',                   'Marco fiscal: ISR, IVA, ISAI y CFDI de operaciones']] },
  { color: '#7C3AED', titulo: 'Catastro y Registro',       sub: 'Propiedad y linderos',
    items: [['Registro Público de la Propiedad', 'Titularidad, gravámenes e historial jurídico'],
            ['Catastro Municipal',               'Valor catastral, superficie y colindancias'],
            ['RAN — Registro Agrario Nacional',  'Régimen ejidal y regularización de suelo'],
            ['INEGI — Marco Geoestadístico',     'Cartografía, coordenadas y delimitación']] },
  { color: '#0D9488', titulo: 'Ambiental y Riesgos',       sub: 'Impacto y vulnerabilidad',
    items: [['SEMARNAT — MIA',            'Manifestación de Impacto Ambiental requerida'],
            ['CENAPRED — Atlas de Riesgos','Vulnerabilidad: inundaciones, sismos, deslaves'],
            ['CONAGUA',                   'Zonas de riesgo hídrico y aguas nacionales'],
            ['INEGI — Carta Geológica',   'Tipo de suelo, topografía y estratigrafía']] },
  { color: '#6366F1', titulo: 'Estadístico / Demográfico', sub: 'Población y economía local',
    items: [['INEGI — Censo de Población y Vivienda','Crecimiento, densidad y composición de hogares'],
            ['DENUE',  'Actividad económica por zona y sector productivo'],
            ['CONAPO', 'Proyecciones de población y flujos migratorios'],
            ['ENOE',   'Empleo, ingresos y demanda habitacional efectiva']] },
]

export default function DashboardPage() {
  const router = useRouter()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [tab, setTab] = useState<'proyectos' | 'fuentes'>('proyectos')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proyectos')
      const data = await res.json()
      setProyectos(Array.isArray(data) ? data : [])
    } catch {
      setProyectos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { proyectoId, pdfUrl } = (e as CustomEvent).detail
      setProyectos(prev => prev.map(p => p.id === proyectoId ? { ...p, pdf_url: pdfUrl } : p))
    }
    window.addEventListener('pdf-uploaded', handler)
    return () => window.removeEventListener('pdf-uploaded', handler)
  }, [])

  const statusCfg = (status: string) => {
    if (status === 'aprobado') return {
      label: 'Aprobado',
      badge: 'bg-[#E1F5EE] text-[#0F6E56]',
      dot: 'bg-[#1D9E75]',
    }
    return {
      label: 'En revisión',
      badge: 'bg-[#FEF3C7] text-[#92600A]',
      dot: 'bg-[#D97706]',
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  const handleToggleStatus = async (p: Proyecto) => {
    const newStatus = p.status === 'aprobado' ? 'en-revision' : 'aprobado'
    setToggling(p.id)
    setProyectos(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x))
    await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status: newStatus }),
    })
    setToggling(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto?')) return
    setProyectos(prev => prev.filter(p => p.id !== id))
    fetch('/api/delete-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f] text-[14px]">Cargando proyectos…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8E4] px-8 py-4 flex items-center gap-3 sticky top-0 z-20">
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
        <span className="text-[10px] text-[#9aab9f] font-medium ml-3">v2.3 · Jun 2026</span>
        <div className="ml-auto">
          <button
            onClick={() => router.push('/prospeccion')}
            className="flex items-center gap-1.5 text-[13px] text-[#9aab9f] hover:text-[#111d17] border border-[#E2E8E4] px-3 py-1.5 rounded-xl transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L2 7L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Nuevo análisis
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="w-full max-w-[860px] mx-auto flex flex-col gap-6">

          <div className="flex gap-0 border-b border-[#E2E8E4]">
            <button
              onClick={() => setTab('proyectos')}
              className={`px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                tab === 'proyectos' ? 'border-[#1D9E75] text-[#1D9E75]' : 'border-transparent text-[#9aab9f] hover:text-[#111d17]'
              }`}
            >
              Mis Proyectos
            </button>
            <button
              onClick={() => setTab('fuentes')}
              className={`px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                tab === 'fuentes' ? 'border-[#1D9E75] text-[#1D9E75]' : 'border-transparent text-[#9aab9f] hover:text-[#111d17]'
              }`}
            >
              Fuentes Consultadas
            </button>
          </div>

          {tab === 'proyectos' && (<>
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-black text-[#111d17] leading-tight">Mis Proyectos</h1>
              <p className="text-[13px] text-[#9aab9f] mt-0.5">
                {proyectos.length} {proyectos.length === 1 ? 'proyecto guardado' : 'proyectos guardados'}
              </p>
            </div>
            <button
              onClick={() => router.push('/prospeccion')}
              className="flex items-center gap-2 bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Nuevo análisis
            </button>
          </div>

          {/* Lista */}
          <div>
            {proyectos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm px-8 py-14 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#F7F8F6] border border-[#E2E8E4] flex items-center justify-center mb-1">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M9 13h6M9 17h4M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="#C4CFC8" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M9 7h6" stroke="#C4CFC8" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-[#111d17]">Sin proyectos aún</p>
                <p className="text-[13px] text-[#9aab9f] max-w-[280px]">
                  Inicia un análisis con Flujo A o Flujo B para ver tus proyectos aquí.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm overflow-hidden">
                {proyectos.map((p, i) => {
                  const { label, badge, dot } = statusCfg(p.status)
                  const isToggling = toggling === p.id
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-4 px-6 py-4 ${
                        i !== proyectos.length - 1 ? 'border-b border-[#F0F4F2]' : ''
                      } hover:bg-[#FAFBFA] transition-colors`}
                    >
                      {/* Flujo badge */}
                      <div className="w-9 h-9 rounded-xl bg-[#F7F8F6] border border-[#E2E8E4] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-[#9aab9f]">{p.flujo || 'A'}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#111d17] truncate">{p.nombre}</p>
                        <p className="text-[11px] text-[#9aab9f] mt-0.5">{formatDate(p.created_at)}</p>
                      </div>

                      {/* Status toggle button */}
                      <button
                        onClick={() => handleToggleStatus(p)}
                        disabled={isToggling}
                        title={p.status === 'aprobado' ? 'Marcar como En revisión' : 'Marcar como Aprobado'}
                        className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 ${badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                        {isToggling ? '…' : label}
                      </button>

                      {/* Análisis */}
                      <button
                        onClick={() => {
                          if (p.datos) {
                            const { _inputData, ...analysisData } = p.datos as Record<string, unknown>
                            const key = p.flujo === 'B' ? 'smt_scout_data' : 'smt_analisis_data'
                            localStorage.setItem(key, JSON.stringify({ ...analysisData, proyecto: p.nombre }))
                            if (_inputData) localStorage.setItem('smt_flujo_a_data', JSON.stringify(_inputData))
                            else localStorage.removeItem('smt_flujo_a_data')
                          }
                          localStorage.setItem('smt_proyecto_id', p.id)
                          const path = p.flujo === 'B' ? '/analisis/flujo-b' : '/analisis'
                          router.push(`${path}?proyecto=${encodeURIComponent(p.nombre)}`)
                        }}
                        className="shrink-0 text-[12px] font-semibold text-[#1D9E75] hover:text-[#0F6E56] border border-[#D4EFE3] hover:border-[#1D9E75] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Análisis
                      </button>

                      {/* Propuesta PDF */}
                      {p.pdf_url ? (
                        <a
                          href={p.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[12px] font-semibold text-white bg-[#1D9E75] hover:bg-[#0F6E56] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Propuesta
                        </a>
                      ) : (
                        <button
                          onClick={() => {
                            if (p.datos) {
                              const { _inputData, ...analysisData } = p.datos as Record<string, unknown>
                              const key = p.flujo === 'B' ? 'smt_scout_data' : 'smt_analisis_data'
                              localStorage.setItem(key, JSON.stringify({ ...analysisData, proyecto: p.nombre }))
                              if (_inputData) localStorage.setItem('smt_flujo_a_data', JSON.stringify(_inputData))
                              else localStorage.removeItem('smt_flujo_a_data')
                            }
                            localStorage.setItem('smt_proyecto_id', p.id)
                            const path = p.flujo === 'B' ? '/propuesta/flujo-b' : '/propuesta'
                            router.push(`${path}?proyecto=${encodeURIComponent(p.nombre)}`)
                          }}
                          className="shrink-0 text-[12px] font-semibold text-[#9aab9f] hover:text-[#0F6E56] border border-[#E2E8E4] hover:border-[#1D9E75] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Propuesta
                        </button>
                      )}

                      {/* Eliminar */}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#9aab9f] hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </>)}

          {tab === 'fuentes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {FUENTES_DATA.map(cat => (
                <div key={cat.titulo} className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm overflow-hidden flex flex-col">
                  <div className="px-5 pt-5 pb-4 border-b border-[#F0F4F2]">
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-[13px] font-bold text-[#111d17]">{cat.titulo}</span>
                    </div>
                    <p className="text-[11px] text-[#9aab9f] uppercase tracking-widest font-semibold pl-5">{cat.sub}</p>
                  </div>
                  <ul className="px-5 py-4 space-y-3 flex-1">
                    {cat.items.map(([nombre, uso]) => (
                      <li key={nombre}>
                        <div className="text-[12px] font-semibold text-[#111d17] leading-tight">{nombre}</div>
                        <div className="text-[11px] text-[#9aab9f] mt-0.5 leading-snug">{uso}</div>
                      </li>
                    ))}
                  </ul>
                  <div className="px-5 pb-4">
                    <div className="h-0.5 w-6 rounded-full" style={{ background: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
