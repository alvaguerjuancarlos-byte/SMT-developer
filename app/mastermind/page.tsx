'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MastermindProvider, useMastermind } from './state'
import { extractTerrenoContext } from '@/lib/mastermind/contexto'
import type { AnalisisData } from '@/lib/analisis/tipos'
import InputPanel from './components/InputPanel'
import IngresosCard from './components/IngresosCard'
import CostosCard from './components/CostosCard'
import UtilidadCard from './components/UtilidadCard'
import RetornoCard from './components/RetornoCard'
import ReverseEngineeringPanel from './components/ReverseEngineeringPanel'
import SensitivityMatrix from './components/SensitivityMatrix'
import ExportButtons from './components/ExportButtons'
import PrintSummary from './components/PrintSummary'

function MastermindContent() {
  const router = useRouter()
  const { setTerreno, modoInverso } = useMastermind()
  const [nombreProyecto, setNombreProyecto] = useState('proyecto')

  useEffect(() => {
    const raw = localStorage.getItem('smt_analisis_data')
    if (raw) {
      try {
        const parsed: AnalisisData = JSON.parse(raw)
        setTerreno(extractTerrenoContext(parsed))
        if (parsed.proyecto) setNombreProyecto(parsed.proyecto)
      } catch { /* sin datos previos — terreno queda editable manualmente */ }
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
          <ExportButtons nombreProyecto={nombreProyecto} />
        </div>

        {modoInverso && (
          <div className="mb-6">
            <ReverseEngineeringPanel />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
          <InputPanel />
          <div className="space-y-4">
            <IngresosCard />
            <CostosCard />
            <UtilidadCard />
            <RetornoCard />
            <SensitivityMatrix />
          </div>
        </div>
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
