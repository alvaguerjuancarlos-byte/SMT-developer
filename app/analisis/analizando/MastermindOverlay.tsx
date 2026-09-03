'use client'

// Overlay único y adaptativo de Mastermind — Fase 2. Reemplaza el stopgap de Fase 1
// (navegar a /mastermind-core) por una capa que vive DENTRO del cockpit: mismo
// MastermindProvider/MastermindCoreProvider + MastermindCockpit/CoreCockpit que ya usan
// /mastermind y /mastermind-core (no se tocan, no se extraen a props — ver plan), solo que
// aquí los alimenta el pipeline en vivo en vez de un page.tsx que lee localStorage al montar.
//
// Nivel se decide solo, en base a pipe.financiero.status: 'esperando_aprobacion'/'cola'/etc
// (antes de Financiero) → Core (terreno+proyecto+mercado, sin TIR); 'done' → Completo (con
// TIR/veredicto/matriz de sensibilidad). No hay "Mastermind 1"/"Mastermind 2" — es la misma
// herramienta madurando conforme el pipeline avanza.

import { useEffect, useRef, useState } from 'react'
import { MastermindProvider, useMastermind } from '@/app/mastermind/state'
import { MastermindCoreProvider, useMastermindCore } from '@/app/mastermind-core/state'
import {
  extractFinanciamientoContext, extractMercadoContext, extractProyectoContext,
  extractTerrenoContext, extractTiempoContext,
} from '@/lib/mastermind/contexto'
import { resolveBitacoraArquitectura } from '@/lib/analisis/bitacoraArquitectura'
import { saveProyecto } from '@/lib/saveProyecto'
import { calcularIngresos } from '@/lib/mastermind/motor'
import type { MastermindCoreInputs } from '@/lib/mastermind/tipos'
import type { AnalisisData, MixUnidad } from '@/lib/analisis/tipos'
import type { PipelineState } from './page'
import { EditableM2 } from './page'
import MastermindCockpit from '@/app/mastermind/components/cockpit/MastermindCockpit'
import ExportButtons from '@/app/mastermind/components/ExportButtons'
import PrintSummary from '@/app/mastermind/components/PrintSummary'
import CoreCockpit from '@/app/mastermind-core/components/CoreCockpit'

const BG_TEXTURE = {
  backgroundColor: '#0b1d3a',
  backgroundImage:
    'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
  backgroundSize: '64px 64px',
} as const

// ─── Nivel Preliminar (Terreno/Arquitectura/Mercado listos, Construcción todavía no) ────────
// calcularCostos() usa un benchmark genérico como costo de construcción cuando Construcción no
// ha corrido (motor.ts:64) — mostrar margen/utilidad en este punto sería un número fabricado
// disfrazado de real. calcularIngresos() en cambio NO necesita costo de construcción — es un
// ingreso potencial real, calculado con tipología (Arquitectura) × precio de venta (Mercado).
// Este nivel solo muestra eso, más costo de terreno (real) y contexto de mercado — nada de
// costos/margen/TIR hasta que Construcción corra de verdad.

function ChipDato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
      <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-[15px] font-bold text-[#f4f0e6]">{value}</p>
    </div>
  )
}

function OverlayPreliminar({
  pipe, setPipe, mastermindCoreInputsActuales,
}: {
  pipe: PipelineState
  setPipe: React.Dispatch<React.SetStateAction<PipelineState>>
  mastermindCoreInputsActuales: () => MastermindCoreInputs
}) {
  // Mismo helper que ya usa el panel de Financiero (Step 6) y el sidebar del FAB — ya aplica
  // DEFAULTS y cualquier override que el usuario haya puesto (terreno.overrideM2,
  // financiero.precioVentaObjetivo), así que el ingreso potencial de aquí es exactamente el
  // mismo dato que el resto del cockpit ya usa, no una extracción aparte.
  const { terreno, proyecto, mercado } = mastermindCoreInputsActuales()
  const ingresos = calcularIngresos({ proyecto, mercado })

  const arquitecturaActual = pipe.arquitectura.seleccionada !== null ? pipe.arquitectura.corridas[pipe.arquitectura.seleccionada] : null
  const mercadoActual = pipe.mercado.seleccionada !== null ? pipe.mercado.corridas[pipe.mercado.seleccionada] : null
  const tip = arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta
  const mixHabitacional: { tipo: string; unidades: number; m2Promedio: number }[] = tip?.habitacional?.mix ?? []
  // TipologiaPropuesta.comercial no trae mix por tipo de local (solo totalLocales/niveles, ver
  // línea ~846) — el ingreso comercial "real" (calcularIngresos) da $0 hasta que Construcción
  // resuelva la superficie vendible. Mientras tanto, mostramos un ESTIMADO explícito: precio/m²
  // comercial real de Mercado (mercado.precioLocalesM2, no depende de Construcción) × un tamaño
  // de local supuesto — no inventado desde superficie construida, que es justo lo que causó el
  // bug documentado arriba (ingresos fantasma). Se marca como estimado en la UI a propósito.
  const M2_PROMEDIO_LOCAL_SUPUESTO = 60
  const tieneComercial = !!tip?.comercial?.totalLocales
  const precioPromedioLocalReal = tieneComercial && tip.comercial.totalLocales > 0
    ? ingresos.ingresoBrutoComercial / tip.comercial.totalLocales
    : null
  const precioPromedioLocalEstimado = !precioPromedioLocalReal && mercado.precioLocalesM2 > 0
    ? mercado.precioLocalesM2 * M2_PROMEDIO_LOCAL_SUPUESTO
    : null
  const precioPromedioLocal = precioPromedioLocalReal || precioPromedioLocalEstimado

  const ratioTerreno = ingresos.ingresoBrutoTotal > 0 ? (terreno.costoTerreno / ingresos.ingresoBrutoTotal) * 100 : null
  const semaforo = ratioTerreno == null ? null
    : ratioTerreno < 15 ? { label: 'Sano', bg: 'bg-[#14301f]', text: 'text-[#0F6E56]' }
    : ratioTerreno < 22 ? { label: 'Ajustado', bg: 'bg-[#2e2510]', text: 'text-[#FBBF24]' }
    : { label: 'Elevado', bg: 'bg-[#2e1414]', text: 'text-[#F87171]' }

  return (
    <div className="max-w-5xl mx-auto px-8 py-6">
      <p className="text-[13px] text-[#8b96ab] max-w-[640px] mb-6">
        Terreno, tipología y mercado ya tienen datos reales — Construcción todavía no corre, así
        que aquí no se muestra costo de construcción, margen ni TIR: se calcularían sobre un
        estimado genérico de la industria, no sobre lo que este proyecto realmente va a costar.
      </p>

      <div className="bg-[#1c304b] border border-[#a68f52] rounded-2xl p-6 mb-6">
        <p className="text-[11px] font-bold text-[#ddc06a] uppercase tracking-wide mb-2">Ingreso potencial estimado</p>
        <p className="text-[38px] font-bold text-[#f4f0e6] mb-1" style={{ fontFamily: 'var(--font-fraunces)' }}>
          ${Math.round(ingresos.ingresoBrutoTotal).toLocaleString('es-MX')}
        </p>
        <p className="text-[12px] text-[#8b96ab]">
          {ingresos.m2VendiblesHabitacional > 0 && `Habitacional: ${Math.round(ingresos.m2VendiblesHabitacional).toLocaleString('es-MX')} m² vendibles`}
          {ingresos.m2VendiblesComercial > 0 && ` · Comercial: ${Math.round(ingresos.m2VendiblesComercial).toLocaleString('es-MX')} m²`}
          {tieneComercial && ingresos.m2VendiblesComercial === 0 && ' · Comercial: pendiente (falta Construcción)'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-2">
          <EditableM2
            label="Costo de terreno / m²"
            value={terreno.costoTerrenoM2}
            override={pipe.terreno.overrideM2}
            onOverride={v => setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: v } }))}
            unit=" MXN/m²"
          />
          <ChipDato label="Costo de terreno total" value={`$${Math.round(terreno.costoTerreno).toLocaleString('es-MX')}`} />
        </div>
        <div className="flex flex-col gap-2">
          <EditableM2
            label="Precio de venta / m² vendible (promedio)"
            value={mercado.precioVentaDepasM2}
            override={pipe.financiero.precioVentaObjetivo}
            onOverride={v => setPipe(p => ({ ...p, financiero: { ...p.financiero, precioVentaObjetivo: v } }))}
            unit=" MXN/m²"
          />
          <ChipDato label="Ingreso habitacional potencial" value={`$${Math.round(ingresos.ingresoBrutoHabitacional).toLocaleString('es-MX')}`} />
        </div>
      </div>

      {mixHabitacional.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Precio estimado por tipo de unidad</p>
          <div className="grid grid-cols-3 gap-2">
            {mixHabitacional.map((r, i) => (
              <ChipDato
                key={i}
                label={`${r.tipo} · ${r.unidades} unid.`}
                value={`$${Math.round(r.m2Promedio * mercado.precioVentaDepasM2).toLocaleString('es-MX')} · ${r.m2Promedio} m²`}
              />
            ))}
          </div>
        </div>
      )}

      {tieneComercial && (
        <div className="mb-6">
          <p className="text-[11px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Uso mixto — locales comerciales</p>
          <div className="grid grid-cols-3 gap-2">
            <ChipDato label="Locales" value={tip!.comercial.totalLocales} />
            <ChipDato label="Niveles" value={tip!.comercial.niveles} />
            <div className="bg-[#132a4d] border border-dashed border-[#a68f52] rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Precio promedio por local</p>
                {precioPromedioLocalEstimado && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#2e2510] text-[#FBBF24] uppercase tracking-wide shrink-0">Estimado</span>
                )}
              </div>
              <p className="text-[15px] font-bold text-[#f4f0e6]">
                {precioPromedioLocal ? `${precioPromedioLocalEstimado ? '≈ ' : ''}$${Math.round(precioPromedioLocal).toLocaleString('es-MX')}` : 'Pendiente'}
              </p>
            </div>
          </div>
          {precioPromedioLocalEstimado && (
            <p className="text-[10.5px] text-[#5f6a80] mt-2 leading-snug">
              Estimado con precio/m² comercial real de Mercado × {M2_PROMEDIO_LOCAL_SUPUESTO} m² supuestos por local
              (tamaño típico de planta baja) — Arquitectura no reporta m² por local. Sujeto a revisión;
              se reemplaza por el dato real en cuanto Construcción resuelva la superficie vendible.
            </p>
          )}
          {!precioPromedioLocal && (
            <p className="text-[10.5px] text-[#5f6a80] mt-2 leading-snug">
              Sin precio/m² comercial de Mercado todavía — no se puede ni estimar. Se calculará en
              cuanto haya datos suficientes.
            </p>
          )}
        </div>
      )}

      {ratioTerreno != null && semaforo && (
        <div className="flex items-center gap-3 bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3 mb-6">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${semaforo.bg} ${semaforo.text}`}>{semaforo.label}</span>
          <p className="text-[12px] text-[#8b96ab]">
            El costo de terreno representa <b className="text-[#f4f0e6]">{ratioTerreno.toFixed(1)}%</b> del ingreso potencial —
            heurística general de la industria (sano &lt;15%, ajustado 15–22%, elevado &gt;22%).
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-[11px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Tipología · Agente de Arquitectura</p>
          <div className="grid grid-cols-2 gap-2">
            <ChipDato label="Unidades habitacionales" value={tip?.habitacional?.totalDepartamentos ?? '—'} />
            <ChipDato label="Niveles" value={tip?.niveles ?? '—'} />
            <ChipDato label="Superficie vendible" value={arquitecturaActual ? `${Math.round(arquitecturaActual.superficieVendible ?? 0).toLocaleString('es-MX')} m²` : '—'} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Mercado</p>
          <div className="grid grid-cols-2 gap-2">
            <ChipDato label="Precio venta zona" value={mercadoActual?.mercado?.precioPromedioZona ?? '—'} />
            <ChipDato label="Absorción" value={mercadoActual?.mercado?.absorcion ?? '—'} />
            <ChipDato label="Plusvalía" value={mercadoActual?.mercado?.plusvalia ?? '—'} />
            <ChipDato label="Demanda" value={mercadoActual?.mercado?.demanda ?? '—'} />
          </div>
        </div>
      </div>

      <div className="border border-dashed border-[#2a3f5c] rounded-xl px-4 py-3.5 flex items-center gap-3 opacity-70">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6a80" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p className="text-[12px] text-[#5f6a80]">Margen, costos, TIR y punto de equilibrio se calculan aquí mismo en cuanto Costos de Construcción termine.</p>
      </div>
    </div>
  )
}

// ─── Nivel Core (antes de Financiero) — copiado de app/mastermind-core/page.tsx:21-136,
// sin su chrome de página. Única diferencia real: el seed viene de construirSnapshotAnalisis()
// (pipeline en vivo) en vez de localStorage['smt_mastermind1_prefill'], y "Aplicar" llama
// setPipe directo en vez de escribir localStorage + navegar. ────────────────────────────────

interface Baseline {
  costoTerrenoM2: number
  costoConstruccionRealM2: number
  precioVentaDepasM2: number
  unidadesHabitacionales: number
}

function OverlayCore({
  construirSnapshotAnalisis, setPipe, onClose,
}: {
  construirSnapshotAnalisis: () => Partial<AnalisisData>
  setPipe: React.Dispatch<React.SetStateAction<PipelineState>>
  onClose: () => void
}) {
  const { inputs, setTerreno, setProyecto, setMercado } = useMastermindCore()
  const baselineRef = useRef<Baseline | null>(null)
  const [mixHabitacional, setMixHabitacional] = useState<MixUnidad[]>([])
  const [totalLocales, setTotalLocales] = useState(0)

  useEffect(() => {
    const parsed = construirSnapshotAnalisis()
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
    // Carga única al abrir el overlay (se remonta cada vez que open pasa a true).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mismo diff-contra-baseline que aplicarYVolver() en mastermind-core/page.tsx:69-94 — pero
  // en vez de localStorage['smt_mastermind1_overrides'] + navegar, aplica directo al pipe en
  // memoria y cierra el overlay. Ningún override reabre Arquitectura/Construcción ni llama
  // de nuevo al LLM — igual que el mecanismo original.
  const aplicarCalibracion = () => {
    const b = baselineRef.current
    const cambio = (actual: number, base: number) => Math.abs(actual - base) > Math.max(1, Math.abs(base) * 0.005)

    if (b) {
      if (cambio(inputs.terreno.costoTerrenoM2, b.costoTerrenoM2)) {
        const v = String(Math.round(inputs.terreno.costoTerrenoM2))
        setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: v } }))
      }
      const costoConstruccionActual = inputs.proyecto.costoConstruccionRealM2 ?? 0
      if (cambio(costoConstruccionActual, b.costoConstruccionRealM2)) {
        const v = String(Math.round(costoConstruccionActual))
        setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: v } }))
      }
      if (cambio(inputs.mercado.precioVentaDepasM2, b.precioVentaDepasM2)) {
        const v = String(Math.round(inputs.mercado.precioVentaDepasM2))
        setPipe(p => ({ ...p, financiero: { ...p.financiero, precioVentaObjetivo: v } }))
      }
      if (cambio(inputs.proyecto.unidadesHabitacionales, b.unidadesHabitacionales)) {
        const v = String(Math.round(inputs.proyecto.unidadesHabitacionales))
        setPipe(p => ({ ...p, financiero: { ...p.financiero, unidadesObjetivo: v } }))
      }
    }
    onClose()
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <p className="text-[13px] text-[#8b96ab] max-w-[560px]">
          Calibra el core del proyecto — terreno, construcción, precio y unidades — antes de correr el plan financiero completo. Lo que ajustes aquí alimenta el resto del pipeline.
        </p>
        <button
          onClick={aplicarCalibracion}
          className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold text-[#070f22] bg-[#c9a227] hover:bg-[#ddc06a] px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          Aplicar calibración
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="#070f22" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <CoreCockpit mixHabitacional={mixHabitacional} totalLocales={totalLocales} />
    </div>
  )
}

// ─── Nivel Completo (Financiero ya corrió) — copiado de app/mastermind/page.tsx:13-188, sin
// su chrome de página. El seed sigue leyendo localStorage['smt_analisis_data'] tal cual (ya se
// escribe solo cuando Financiero termina — no hay snapshot en vivo mejor que ese). ──────────

function OverlayFull({ proyecto }: { proyecto: string }) {
  const { inputs, outputs, setTerreno, setProyecto, setMercado, setTiempo, setFinanciamiento } = useMastermind()
  const [nombreProyecto, setNombreProyecto] = useState(proyecto || 'proyecto')
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
    // Carga única al abrir el overlay (se remonta cada vez que open pasa a true).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Idéntico a guardarCambios() en app/mastermind/page.tsx:58-126 — persiste a
  // smt_analisis_data + Supabase, no navega (nunca navegó, así que no cambia nada aquí).
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
        indirectos: Math.round(c.indirectos),
        honorarios: Math.round(c.honorarios),
        imprevistos: Math.round(c.imprevistos),
        indirectosDesglose: undefined,
        honorariosDesglose: undefined,
        imprevistosDesglose: undefined,
        inversionTotal: Math.round(c.costoTerreno + c.costoDirectoConstruccion + c.indirectos + c.honorarios + c.imprevistos + c.comercializacion),
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
    <div className="max-w-7xl mx-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <p className="text-[13px] text-[#8b96ab] max-w-[560px]">
          Ajusta los parámetros del proyecto y ve la TIR recalcularse en vivo, o fija una TIR objetivo para saber qué necesitas alcanzarla.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {analisisData && (
            <button
              onClick={() => cargarDelAnalisis(analisisData)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] hover:border-[#a68f52] px-3 py-2 rounded-xl transition-colors cursor-pointer"
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
                guardado ? 'bg-[#c9a227]/20 text-[#ddc06a] border border-[#c9a227]/40' : 'bg-[#c9a227] text-[#070f22] hover:bg-[#ddc06a]'
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

      <PrintSummary nombreProyecto={nombreProyecto} />
    </div>
  )
}

// ─── Shell — pantalla completa, decide el nivel, header con regreso al cockpit ──────────────

export default function MastermindOverlay({
  open, onClose, pipe, setPipe, proyecto, construirSnapshotAnalisis, mastermindCoreInputsActuales,
}: {
  open: boolean
  onClose: () => void
  pipe: PipelineState
  setPipe: React.Dispatch<React.SetStateAction<PipelineState>>
  proyecto: string
  construirSnapshotAnalisis: () => Partial<AnalisisData>
  mastermindCoreInputsActuales: () => MastermindCoreInputs
}) {
  if (!open) return null

  const nivelCompleto = pipe.financiero.status === 'done'
  const nivelCore = !nivelCompleto && pipe.construccion.status === 'done'
  const nivelPreliminar = !nivelCompleto && !nivelCore

  const etiquetaNivel = nivelCompleto ? 'Veredicto financiero completo'
    : nivelCore ? 'Calibración de costos e ingresos · antes de Financiero'
    : 'Panorama preliminar · antes de Costos de Construcción'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={BG_TEXTURE}>
      <header className="flex items-center gap-4 px-8 h-16 border-b border-[#2a3f5c] bg-[#070f22] shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 border border-[#2a3f5c] hover:border-[#a68f52] rounded-full px-4 py-2 cursor-pointer transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="#ddc06a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-[12px] font-semibold text-[#ddc06a]">Regresar a cuadrantes</span>
        </button>
        <div className="w-px h-5 bg-[#2a3f5c]" />
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(201,162,39,0.15)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ddc06a" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="#ddc06a"/></svg>
          </span>
          <span className="text-[17px] font-semibold text-[#f4f0e6]" style={{ fontFamily: 'var(--font-fraunces)' }}>Mastermind</span>
        </div>
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide" style={{ color: nivelCompleto ? '#ddc06a' : '#8b96ab' }}>
          {etiquetaNivel}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {nivelCompleto ? (
          <MastermindProvider>
            <OverlayFull proyecto={proyecto} />
          </MastermindProvider>
        ) : nivelCore ? (
          <MastermindCoreProvider>
            <OverlayCore construirSnapshotAnalisis={construirSnapshotAnalisis} setPipe={setPipe} onClose={onClose} />
          </MastermindCoreProvider>
        ) : (
          <OverlayPreliminar pipe={pipe} setPipe={setPipe} mastermindCoreInputsActuales={mastermindCoreInputsActuales} />
        )}
      </div>
    </div>
  )
}
