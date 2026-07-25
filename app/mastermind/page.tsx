'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MastermindProvider, useMastermind } from './state'
import { extractFinanciamientoContext, extractMercadoContext, extractProyectoContext, extractTerrenoContext, extractTiempoContext } from '@/lib/mastermind/contexto'
import type { AnalisisData } from '@/lib/analisis/tipos'
import MastermindCockpit from './components/cockpit/MastermindCockpit'
import ExportButtons from './components/ExportButtons'
import PrintSummary from './components/PrintSummary'

// DEBUG TEMPORAL — quitar cuando se resuelva el desfase de TIR.
function PanelDebug({ analisisData, inputs, outputs }: {
  analisisData: AnalisisData | null
  inputs: ReturnType<typeof useMastermind>['inputs']
  outputs: ReturnType<typeof useMastermind>['outputs']
}) {
  if (!analisisData) return null
  const bc = analisisData.bitacoraConstruccion
  const f = analisisData.financiero
  const fila = (label: string, value: unknown) => (
    <div className="flex justify-between gap-4 py-1 border-b border-white/5 last:border-0">
      <span className="text-white/40">{label}</span>
      <span className="text-white font-mono">{value === undefined ? 'undefined' : value === null ? 'null' : String(value)}</span>
    </div>
  )
  return (
    <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-[12px]">
      <p className="text-amber-400 font-bold uppercase tracking-wide mb-2 text-[11px]">🔧 Debug temporal — datos del análisis</p>
      <p className="text-white/50 font-semibold mt-2 mb-1">bitacoraConstruccion</p>
      {fila('modo', bc?.modo)}
      {fila('tipologiaPropuesta presente', !!bc?.tipologiaPropuesta)}
      {fila('superficieConstruccionM2', bc?.superficieConstruccionM2)}
      {fila('costoPorM2Final', bc?.costoPorM2Final)}
      <p className="text-white/50 font-semibold mt-3 mb-1">financiero</p>
      {fila('indirectos', f?.indirectos)}
      {fila('honorarios', f?.honorarios)}
      {fila('imprevistos', f?.imprevistos)}
      {fila('costoTotalConstruccion', f?.costoTotalConstruccion)}
      {fila('precioVentaM2', f?.precioVentaM2)}
      {fila('ingresosProyectados', f?.ingresosProyectados)}
      {fila('plazoObraMeses', f?.plazoObraMeses)}
      {fila('plazoVentaMeses', f?.plazoVentaMeses)}
      {fila('tir', f?.tir)}
      <p className="text-white/50 font-semibold mt-3 mb-1">Inputs cargados en Mastermind ahora mismo</p>
      {fila('terreno.superficieM2', inputs.terreno.superficieM2)}
      {fila('terreno.costoTerreno', inputs.terreno.costoTerreno)}
      {fila('proyecto.niveles', inputs.proyecto.niveles)}
      {fila('proyecto.unidadesHabitacionales', inputs.proyecto.unidadesHabitacionales)}
      {fila('proyecto.m2PromedioDepa', inputs.proyecto.m2PromedioDepa)}
      {fila('proyecto.m2ComercialesPlantaBaja', inputs.proyecto.m2ComercialesPlantaBaja)}
      {fila('proyecto.superficieConstruccionM2', inputs.proyecto.superficieConstruccionM2)}
      {fila('proyecto.benchmarkConstruccion', inputs.proyecto.benchmarkConstruccion)}
      {fila('proyecto.porcentajeIndirectos', inputs.proyecto.porcentajeIndirectos)}
      {fila('mercado.precioVentaDepasM2', inputs.mercado.precioVentaDepasM2)}
      {fila('tiempo.plazoObraMeses', inputs.tiempo.plazoObraMeses)}
      {fila('tiempo.plazoVentaMeses', inputs.tiempo.plazoVentaMeses)}
      {fila('tiempo.inicioVentasMes', inputs.tiempo.inicioVentasMes)}
      {fila('financiamiento.porcentajeFinanciado', inputs.financiamiento.porcentajeFinanciado)}
      {fila('financiamiento.tasaAnualCredito', inputs.financiamiento.tasaAnualCredito)}
      <p className="text-white/50 font-semibold mt-3 mb-1">Outputs de Mastermind ahora mismo</p>
      {fila('costos.costoDirectoConstruccion', Math.round(outputs.costos.costoDirectoConstruccion))}
      {fila('costos.costoTotal', Math.round(outputs.costos.costoTotal))}
      {fila('costos.financieros', Math.round(outputs.costos.financieros))}
      {fila('ingresos.m2VendiblesHabitacional', outputs.ingresos.m2VendiblesHabitacional)}
      {fila('ingresos.ingresoNeto', Math.round(outputs.ingresos.ingresoNeto))}
      {fila('retorno.tirSocioAnual', outputs.retorno.tirSocioAnual?.toFixed(1))}
      {fila('retorno.inversionSocios', Math.round(outputs.retorno.inversionSocios))}
    </div>
  )
}

function MastermindContent() {
  const router = useRouter()
  const { inputs, outputs, setTerreno, setProyecto, setMercado, setTiempo, setFinanciamiento } = useMastermind()
  const [nombreProyecto, setNombreProyecto] = useState('proyecto')
  const [analisisData, setAnalisisData] = useState<AnalisisData | null>(null)
  const [origenAnalisis, setOrigenAnalisis] = useState({ proyecto: false, mercado: false, financiamiento: false, costos: false, tiempo: false })

  const cargarDelAnalisis = (parsed: AnalisisData) => {
    setTerreno(extractTerrenoContext(parsed))
    setProyecto(extractProyectoContext(parsed))
    setMercado(extractMercadoContext(parsed))
    setTiempo(extractTiempoContext(parsed))
    setFinanciamiento(extractFinanciamientoContext(parsed))
    setOrigenAnalisis({
      proyecto: !!(parsed.bitacoraConstruccion?.tipologiaPropuesta || parsed.bitacoraConstruccion?.envolvente?.construibleMax),
      mercado: !!(parsed.financiero?.precioVentaM2 || parsed.mercado?.precioPromedioZona),
      financiamiento: !!parsed.estructuraCapital,
      costos: !!(parsed.financiero?.indirectos || parsed.financiero?.honorarios),
      tiempo: !!parsed.financiero?.plazoObraMeses,
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
        <PanelDebug analisisData={analisisData} inputs={inputs} outputs={outputs} />
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

        <MastermindCockpit origenAnalisis={origenAnalisis} tirAnalisisOriginal={analisisData?.financiero?.tir ?? undefined} />
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
