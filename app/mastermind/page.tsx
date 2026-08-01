'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MastermindProvider, useMastermind } from './state'
import { extractFinanciamientoContext, extractMercadoContext, extractProyectoContext, extractTerrenoContext, extractTiempoContext } from '@/lib/mastermind/contexto'
import { saveProyecto } from '@/lib/saveProyecto'
import type { AnalisisData } from '@/lib/analisis/tipos'
import MastermindCockpit from './components/cockpit/MastermindCockpit'
import ExportButtons from './components/ExportButtons'
import PrintSummary from './components/PrintSummary'

function MastermindContent() {
  const router = useRouter()
  const { inputs, outputs, setTerreno, setProyecto, setMercado, setTiempo, setFinanciamiento } = useMastermind()
  const [nombreProyecto, setNombreProyecto] = useState('proyecto')
  const [analisisData, setAnalisisData] = useState<AnalisisData | null>(null)
  const [origenAnalisis, setOrigenAnalisis] = useState({ proyecto: false, mercado: false, financiamiento: false, costos: false, tiempo: false })
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

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

  // Antes no había forma de que lo calibrado en Mastermind 2 corrigiera el reporte final — era
  // puro "qué pasa si", sin feedback hacia el análisis guardado. Esto parchea SOLO los números
  // (costos/ingresos/margen/TIR/estructura de capital/flujo de caja) con lo que ya calculó
  // calcularMastermind — sin volver a llamar al Agente Financiero. La narrativa (recomendación,
  // stress test, punto de quiebre, metodologiaScore, desgloses de indirectos/honorarios/
  // imprevistos) se deja tal cual — puede quedar desactualizada respecto a los nuevos números,
  // es la contraparte de no gastar otra llamada LLM.
  const guardarCambios = async () => {
    if (!analisisData) return
    setGuardando(true)
    const c = outputs.costos
    const u = outputs.utilidad
    const r = outputs.retorno
    let acumulado = 0
    const flujoMensual = outputs.flujoSocio.map((v, i) => {
      acumulado += v
      return { mes: i + 1, fase: '', egresos: v < 0 ? Math.round(-v) : 0, ingresos: v > 0 ? Math.round(v) : 0, acumulado: Math.round(acumulado), nota: '' }
    })

    const patched: AnalisisData = {
      ...analisisData,
      financiero: {
        ...analisisData.financiero,
        costoTerreno: Math.round(c.costoTerreno),
        costoTerrenoM2: Math.round(inputs.terreno.costoTerrenoM2),
        construccionM2: c.m2Construidos > 0 ? Math.round(c.costoDirectoConstruccion / c.m2Construidos) : analisisData.financiero.construccionM2,
        costoTotalConstruccion: Math.round(c.costoDirectoConstruccion),
        precioVentaM2: Math.round(inputs.mercado.precioVentaDepasM2),
        ingresosProyectados: Math.round(outputs.ingresos.ingresoBrutoTotal),
        descuentos: Math.round(outputs.ingresos.descuentos),
        ingresosNetos: Math.round(outputs.ingresos.ingresoNeto),
        comercializacion: Math.round(c.comercializacion),
        // Mastermind usa un solo % agregado de indirectos (no separa honorarios/imprevistos
        // como el Agente Financiero, ver lib/mastermind/motor.ts) — se dejan en 0 en vez de
        // conservar los montos viejos, que ya no sumarían el nuevo indirectos correctamente.
        indirectos: Math.round(c.indirectos),
        honorarios: 0,
        imprevistos: 0,
        indirectosDesglose: undefined,
        honorariosDesglose: undefined,
        imprevistosDesglose: undefined,
        inversionTotal: Math.round(c.costoTerreno + c.costoDirectoConstruccion + c.indirectos + c.comercializacion),
        utilidadBruta: Math.round(u.utilidadAntesImpuestos),
        margenBruto: u.margenBruto,
        tir: r.tirSocioAnual,
        tirConverge: r.tirSocioConverge,
        tirProyecto: r.tirProyectoAnual,
        tirProyectoConverge: r.tirProyectoConverge,
      },
      estructuraCapital: {
        ...analisisData.estructuraCapital,
        equity: 100 - inputs.financiamiento.porcentajeFinanciado,
        deuda: inputs.financiamiento.porcentajeFinanciado,
        montoEquity: Math.round(r.inversionSocios),
        montoDeuda: Math.round(r.inversionProyecto - r.inversionSocios),
        tasaDeudaAnual: inputs.financiamiento.tasaAnualCredito,
        costoFinanciero: Math.round(c.financieros),
      } as AnalisisData['estructuraCapital'],
      flujoMensual,
    }

    localStorage.setItem('smt_analisis_data', JSON.stringify(patched))
    try {
      const res = await saveProyecto({ nombre: nombreProyecto, datos: patched, flujo: 'A' })
      if (res.ok && res.id) localStorage.setItem('smt_proyecto_id', res.id)
    } finally {
      setAnalisisData(patched)
      setGuardando(false)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0F0E]">
      <div className="px-6 pt-6 pb-0 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-[12px] text-white/30">
          <button onClick={() => router.push('/analisis')} className="text-[#1D9E75] font-medium hover:underline">
            Análisis
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          <span className="text-white font-medium">Mastermind 2 · Plan financiero</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-white mb-1">Mastermind 2</h1>
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
            {analisisData && (
              <button
                onClick={guardarCambios}
                disabled={guardando}
                title="Actualiza costos, ingresos, margen, TIR y flujo de caja en el análisis guardado con lo calibrado aquí — no vuelve a llamar al Agente Financiero, la narrativa del reporte se queda igual."
                className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  guardado ? 'bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/40' : 'bg-[#1D9E75] text-white hover:bg-[#0F6E56]'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {guardado ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Guardado
                  </>
                ) : guardando ? 'Guardando…' : 'Guardar cambios en el análisis'}
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
