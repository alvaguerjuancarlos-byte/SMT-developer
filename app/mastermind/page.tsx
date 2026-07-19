'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MastermindProvider, useMastermind } from './state'
import { extractFinanciamientoContext, extractMercadoContext, extractProyectoContext, extractTerrenoContext } from '@/lib/mastermind/contexto'
import type { AnalisisData } from '@/lib/analisis/tipos'
import MastermindCockpit from './components/cockpit/MastermindCockpit'
import ExportButtons from './components/ExportButtons'
import PrintSummary from './components/PrintSummary'

function MastermindContent() {
  const router = useRouter()
  const { setTerreno, setProyecto, setMercado, setFinanciamiento } = useMastermind()
  const [nombreProyecto, setNombreProyecto] = useState('proyecto')
  const [analisisData, setAnalisisData] = useState<AnalisisData | null>(null)
  const [origenAnalisis, setOrigenAnalisis] = useState({ proyecto: false, mercado: false, financiamiento: false, costos: false })

  const cargarDelAnalisis = (parsed: AnalisisData) => {
    setTerreno(extractTerrenoContext(parsed))
    setProyecto(extractProyectoContext(parsed))
    setMercado(extractMercadoContext(parsed))
    setFinanciamiento(extractFinanciamientoContext(parsed))
    setOrigenAnalisis({
      proyecto: !!(parsed.bitacoraConstruccion?.tipologiaPropuesta || parsed.bitacoraConstruccion?.envolvente?.construibleMax),
      mercado: !!(parsed.financiero?.precioVentaM2 || parsed.mercado?.precioPromedioZona),
      financiamiento: !!parsed.estructuraCapital,
      costos: !!(parsed.financiero?.indirectos || parsed.financiero?.honorarios),
    })
  }

  useEffect(() => {
    const raw = localStorage.getItem('smt_analisis_data')
    if (raw) {
      try {
        const parsed: AnalisisData = JSON.parse(raw)
        setAnalisisData(parsed)
        cargarDelAnalisis(parsed)
        if (parsed.proyecto) setNombreProyecto(parsed.proyecto)
      } catch { /* sin datos previos — todo queda editable manualmente */ }
    }
    // Carga única al montar, igual que app/analisis/page.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#0C0F0E]">
      <div className="px-6 pt-6 pb-0 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-[12px] text-white/30">
          <button onClick={() => router.push('/analisis')} className="text-[#1D9E75] font-medium hover:underline">
            Análisis
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          <span className="text-white font-medium">Mastermind · Factibilidad financiera</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-white mb-1">Mastermind</h1>
            <p className="text-[14px] text-white/50">
              Ajusta los parámetros del proyecto y ve la TIR recalcularse en vivo, o fija una TIR objetivo para saber qué necesitas alcanzarla.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {analisisData && (
              <button
                onClick={() => cargarDelAnalisis(analisisData)}
                className="flex items-center gap-1.5 text-[12px] font-medium text-white/70 hover:text-white border border-white/15 hover:border-white/30 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M12 7A5 5 0 1 1 10.5 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M12 2.5V6H8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Restaurar valores del análisis
              </button>
            )}
            <ExportButtons nombreProyecto={nombreProyecto} />
          </div>
        </div>

        <MastermindCockpit origenAnalisis={origenAnalisis} tirAnalisisOriginal={analisisData?.financiero?.tir} />
      </div>

      <PrintSummary nombreProyecto={nombreProyecto} />
    </div>
  )
}

export default function MastermindPage() {
  return (
    <MastermindProvider>
      <MastermindContent />
    </MastermindProvider>
  )
}
