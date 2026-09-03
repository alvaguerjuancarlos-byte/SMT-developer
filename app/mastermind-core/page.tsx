'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MastermindCoreProvider, useMastermindCore } from './state'
import { extractMercadoContext, extractProyectoContext, extractTerrenoContext } from '@/lib/mastermind/contexto'
import { resolveBitacoraArquitectura } from '@/lib/analisis/bitacoraArquitectura'
import type { AnalisisData, MixUnidad } from '@/lib/analisis/tipos'
import CoreCockpit from './components/CoreCockpit'

// Snapshot de los 4 valores que sí pueden alimentar hacia adelante el pipeline (ver
// app/analisis/analizando/page.tsx) — se compara contra esto al "Aplicar" para solo mandar de
// vuelta lo que el usuario de verdad calibró, no todo el estado completo cada vez.
interface Baseline {
  costoTerrenoM2: number
  costoConstruccionRealM2: number
  precioVentaDepasM2: number
  unidadesHabitacionales: number
}

function MastermindCoreContent() {
  const router = useRouter()
  const { inputs, setTerreno, setProyecto, setMercado } = useMastermindCore()
  const [cargado, setCargado] = useState(false)
  const baselineRef = useRef<Baseline | null>(null)
  // Mix real de tipologías (1/2/3 recámaras, etc.) que resolvió Arquitectura — no vive en
  // MastermindCoreInputs (el motor solo trabaja con unidadesHabitacionales/m2PromedioDepa como
  // promedio ponderado, ver extractProyectoContext), así que se guarda aparte solo para mostrar
  // el desglose por tipo en la palanca "Precio" — no alimenta el cálculo.
  const [mixHabitacional, setMixHabitacional] = useState<MixUnidad[]>([])
  const [totalLocales, setTotalLocales] = useState(0)

  useEffect(() => {
    const raw = localStorage.getItem('smt_mastermind1_prefill')
    if (raw) {
      try {
        const parsed: Partial<AnalisisData> = JSON.parse(raw)
        const terreno = extractTerrenoContext(parsed)
        const proyecto = extractProyectoContext(parsed)
        const mercado = extractMercadoContext(parsed)
        setTerreno(terreno)
        setProyecto(proyecto)
        setMercado(mercado)
        baselineRef.current = {
          costoTerrenoM2: terreno.costoTerrenoM2,
          costoConstruccionRealM2: proyecto.costoConstruccionRealM2 ?? 0,
          precioVentaDepasM2: mercado.precioVentaDepasM2 ?? 0,
          unidadesHabitacionales: proyecto.unidadesHabitacionales ?? 0,
        }
        const tip = resolveBitacoraArquitectura(parsed)?.tipologiaPropuesta
        setMixHabitacional(tip?.habitacional?.mix ?? [])
        setTotalLocales(tip?.comercial?.totalLocales ?? 0)
      } catch { /* sin prefill — todo queda en los defaults del catálogo, editable a mano */ }
    }
    setCargado(true)
    // Carga única al montar, igual que app/mastermind/page.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El nombre del proyecto vive en la URL de analizando (?proyecto=...), no en el snapshot —
  // sin reconstruirlo aquí, router.push('/analisis/analizando') a secas perdía el query string y
  // saveProyecto fallaba con "nombre requerido" al aprobar Financiero (bug real visto en
  // producción). Esta ruta standalone queda como fallback de deep-link — el camino normal hoy
  // es el overlay de Mastermind dentro del cockpit (MastermindOverlay.tsx), que no navega.
  const volverAlPipeline = () => {
    const proyecto = localStorage.getItem('smt_mastermind1_return_proyecto') || ''
    router.push(proyecto ? `/analisis/analizando?proyecto=${encodeURIComponent(proyecto)}` : '/analisis/analizando')
  }

  const aplicarYVolver = () => {
    const b = baselineRef.current
    const overrides: Record<string, string> = {}
    // Tolerancia chica para no marcar como "cambiado" un redondeo — el usuario tuvo que mover
    // el slider/input de verdad, no un ruido de punto flotante del prefill.
    const cambio = (actual: number, base: number) => Math.abs(actual - base) > Math.max(1, Math.abs(base) * 0.005)

    if (b) {
      if (cambio(inputs.terreno.costoTerrenoM2, b.costoTerrenoM2)) {
        overrides.costoTerrenoM2 = String(Math.round(inputs.terreno.costoTerrenoM2))
      }
      const costoConstruccionActual = inputs.proyecto.costoConstruccionRealM2 ?? 0
      if (cambio(costoConstruccionActual, b.costoConstruccionRealM2)) {
        overrides.costoConstruccionM2 = String(Math.round(costoConstruccionActual))
      }
      if (cambio(inputs.mercado.precioVentaDepasM2, b.precioVentaDepasM2)) {
        overrides.precioVentaObjetivo = String(Math.round(inputs.mercado.precioVentaDepasM2))
      }
      if (cambio(inputs.proyecto.unidadesHabitacionales, b.unidadesHabitacionales)) {
        // unidadesObjetivo ancla directo a Financiero (igual patrón que precioVentaObjetivo) —
        // NO reabre Arquitectura ni Construcción. Antes disparaba runArquitectura(), lo que
        // volvía a llamar al LLM y recalculaba el diseño en vez de solo llevar el número
        // calibrado hacia adelante.
        overrides.unidadesObjetivo = String(Math.round(inputs.proyecto.unidadesHabitacionales))
      }
    }

    localStorage.setItem('smt_mastermind1_overrides', JSON.stringify(overrides))
    volverAlPipeline()
  }

  if (!cargado) return null

  return (
    <div className="min-h-screen bg-[#0b1d3a]">
      <div className="px-6 pt-6 pb-0 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-[12px] text-[#5f6a80]">
          <button onClick={volverAlPipeline} className="text-[#c9a227] font-medium hover:underline">
            Pipeline
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          <span className="text-[#f4f0e6] font-medium">Mastermind · Costos e ingresos</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-[#f4f0e6] mb-1">Mastermind</h1>
            <p className="text-[14px] text-[#8b96ab]">
              Calibra el core del proyecto — terreno, construcción, precio y unidades — antes de
              correr el plan financiero completo. Lo que ajustes aquí alimenta el resto del pipeline.
            </p>
          </div>
          <button
            onClick={aplicarYVolver}
            className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold text-[#070f22] bg-[#c9a227] hover:bg-[#ddc06a] px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Aplicar calibración y volver al pipeline
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="#070f22" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <CoreCockpit mixHabitacional={mixHabitacional} totalLocales={totalLocales} />
      </div>
    </div>
  )
}

export default function MastermindCorePage() {
  return (
    <MastermindCoreProvider>
      <MastermindCoreContent />
    </MastermindCoreProvider>
  )
}
