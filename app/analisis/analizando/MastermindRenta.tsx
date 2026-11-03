'use client'

// Mastermind para minibodegas en RENTA. El cockpit de venta (precio de venta/m², absorción,
// crédito puente) no aplica: aquí las palancas son renta, ocupación, meses para llenarse,
// costos, gastos de operación, cap rate y crédito, recalculadas en vivo con el MISMO modelo que
// usa el Agente Financiero (armarEntradaRenta + calcularModeloRenta en lib/producto/minibodegas.ts).
// "Aplicar al análisis" fija los ajustes y vuelve a correr Financiero con ellos.

import { useMemo, useState } from 'react'
import Slider from '@/app/mastermind/components/Slider'
import { RANGOS_HONORARIOS_POR_BANDA } from '@/lib/mastermind/catalogo'
import {
  armarEntradaRenta, calcularModeloRenta, rentaParaTir, SUPUESTOS_MINIBODEGAS,
  type SupuestosRentaUsuario,
} from '@/lib/producto/minibodegas'
import type { PipelineState } from './page'

const S = SUPUESTOS_MINIBODEGAS
const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`
const fmtM = (n: number) => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1_000_000).toFixed(1)} M`
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : undefined }
const pct1 = (n: number | null) => n === null ? 'N/D' : `${Math.abs(n) < 0.05 ? '0.0' : n.toFixed(1)}%`

export interface AjustesRenta {
  terrenoM2?: string
  construccionM2?: string
  supuestosRenta: SupuestosRentaUsuario
}

function Kpi({ label, value, sub, tono }: { label: string; value: string; sub?: string; tono?: 'bien' | 'mal' | 'neutro' }) {
  const color = tono === 'bien' ? 'text-[#1D9E75]' : tono === 'mal' ? 'text-[#F87171]' : 'text-[#f4f0e6]'
  return (
    <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-3">
      <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className={`text-[20px] font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10.5px] text-[#8b96ab] mt-0.5 leading-snug">{sub}</p>}
    </div>
  )
}

// Lo que necesita el panel, armado desde el pipeline en vivo (overlay del análisis) o desde un
// análisis guardado (página /mastermind) — mismo cálculo en los dos lados.
export interface DatosRenta {
  mix: { tipo: string; unidades: number; m2Promedio: number }[]
  areaRentable: number
  superficieConstruida: number
  construccionM2Agente: number          // costo/m² que calculó Construcción
  costoTotalConstruccionAgente: number  // total de Construcción (suma de zonas)
  construccionM2Inicial: number         // con el ajuste del usuario si lo hay
  banda: number
  terreno: { costoTerrenoM2: number; superficieM2: number }
  rentaMercado: { rentaM2MesPromedio?: number; ocupacionEstabilizadaPct?: number; mesesEstabilizacion?: number; comparablesVerificados?: number } | null
  rentaAnalisis: number | null           // renta que usó el último Financiero
  previos: SupuestosRentaUsuario
}

const areaDelMix = (mix: DatosRenta['mix']) => mix.reduce((s, r) => s + (r.unidades || 0) * (r.m2Promedio || 0), 0)

export function datosRentaDesdePipe(pipe: PipelineState, terreno: DatosRenta['terreno']): DatosRenta | null {
  const arq = pipe.arquitectura.seleccionada !== null ? pipe.arquitectura.corridas[pipe.arquitectura.seleccionada] : null
  const cons = pipe.construccion.seleccionada !== null ? pipe.construccion.corridas[pipe.construccion.seleccionada] : null
  const merc = pipe.mercado.seleccionada !== null ? pipe.mercado.corridas[pipe.mercado.seleccionada] : null
  if (!arq) return null
  const mix = arq.bitacoraArquitectura?.tipologiaPropuesta?.habitacional?.mix ?? []
  return {
    mix,
    areaRentable: areaDelMix(mix) || Number(arq.superficieVendible) || 0,
    superficieConstruida: Number(cons?.superficieConstruida) || 0,
    construccionM2Agente: Number(cons?.construccionM2) || 0,
    costoTotalConstruccionAgente: Number(cons?.costoTotalConstruccion) || 0,
    construccionM2Inicial: pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : Number(cons?.construccionM2) || 0,
    banda: Number(cons?.bitacoraConstruccion?.bandaElegida) || 2,
    terreno,
    rentaMercado: merc?.mercado?.renta ?? null,
    rentaAnalisis: num(pipe.financiero.data?.financiero?.renta?.rentaM2Mes) ?? null,
    previos: pipe.financiero.supuestosRenta || {},
  }
}

// Análisis guardado (smt_analisis_data): los supuestos del último Financiero son el punto de partida.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function datosRentaDesdeAnalisis(d: any): DatosRenta | null {
  const f = d?.financiero
  const r = f?.renta
  if (!r) return null
  const mix = d.bitacoraArquitectura?.tipologiaPropuesta?.habitacional?.mix ?? []
  const sup = r.supuestos || {}
  const superficieConstruida = Number(d.bitacoraArquitectura?.superficieConstruida) || (f.construccionM2 > 0 ? f.costoTotalConstruccion / f.construccionM2 : 0)
  return {
    mix,
    areaRentable: Number(r.areaRentableM2) || areaDelMix(mix),
    superficieConstruida,
    construccionM2Agente: Number(f.construccionM2) || 0,
    costoTotalConstruccionAgente: Number(f.costoTotalConstruccion) || 0,
    construccionM2Inicial: Number(f.construccionM2) || 0,
    banda: Number(d.bitacoraConstruccion?.bandaElegida) || 2,
    terreno: { costoTerrenoM2: Number(f.costoTerrenoM2) || 0, superficieM2: f.costoTerrenoM2 > 0 ? f.costoTerreno / f.costoTerrenoM2 : 0 },
    rentaMercado: d.mercado?.renta ?? null,
    rentaAnalisis: num(r.rentaM2Mes) ?? null,
    previos: {
      ocupacionEstabilizadaPct: sup.ocupacionEstabilizada ? sup.ocupacionEstabilizada * 100 : undefined,
      mesesEstabilizacion: sup.mesesEstabilizacion, opexPct: sup.opexPctIngreso ? sup.opexPctIngreso * 100 : undefined,
      capRatePct: sup.capRateSalida ? sup.capRateSalida * 100 : undefined, aniosOperacion: sup.aniosOperacion,
      equityPct: sup.equityPct, tasaDeudaAnual: sup.tasaDeudaAnual,
    },
  }
}

export default function MastermindRenta({
  datos, onAplicar,
}: {
  datos: DatosRenta
  // Sin onAplicar (página /mastermind, fuera del pipeline) el panel solo simula.
  onAplicar?: (ajustes: AjustesRenta) => void
}) {
  const { mix, areaRentable, superficieConstruida, terreno, rentaMercado, previos } = datos
  const totalBodegas = mix.reduce((s, r) => s + (r.unidades || 0), 0)
  const rangoHonorarios = RANGOS_HONORARIOS_POR_BANDA[datos.banda] ?? RANGOS_HONORARIOS_POR_BANDA[2]

  const inicial = {
    rentaM2Mes: num(previos.rentaM2Mes) ?? datos.rentaAnalisis ?? num(rentaMercado?.rentaM2MesPromedio) ?? 0,
    ocupacionEstabilizadaPct: num(previos.ocupacionEstabilizadaPct) ?? num(rentaMercado?.ocupacionEstabilizadaPct) ?? S.ocupacionEstabilizada * 100,
    mesesEstabilizacion: num(previos.mesesEstabilizacion) ?? num(rentaMercado?.mesesEstabilizacion) ?? S.mesesEstabilizacion,
    opexPct: previos.opexPct ?? S.opexPctIngreso * 100,
    capRatePct: previos.capRatePct ?? S.capRateSalida * 100,
    aniosOperacion: previos.aniosOperacion ?? S.aniosOperacion,
    equityPct: previos.equityPct ?? S.equityPct,
    tasaDeudaAnual: previos.tasaDeudaAnual ?? S.tasaDeudaAnual,
    terrenoM2: terreno.costoTerrenoM2,
    construccionM2: datos.construccionM2Inicial,
  }
  const [v, setV] = useState(inicial)
  const [tirObjetivo, setTirObjetivo] = useState(15)
  const set = (k: keyof typeof inicial) => (n: number) => setV(p => ({ ...p, [k]: n }))

  const hayCostos = superficieConstruida > 0 && v.construccionM2 > 0

  const calc = useMemo(() => {
    if (areaRentable <= 0 || v.rentaM2Mes <= 0) return null
    // Mismo costo que manda la pantalla a Financiero: el total del Agente Construcción, o
    // costo/m² × superficie construida cuando el usuario lo cambia.
    const costoTotalConstruccion = v.construccionM2 === datos.construccionM2Agente && datos.costoTotalConstruccionAgente > 0
      ? datos.costoTotalConstruccionAgente
      : v.construccionM2 * superficieConstruida
    const usuario: SupuestosRentaUsuario = {
      rentaM2Mes: v.rentaM2Mes, ocupacionEstabilizadaPct: v.ocupacionEstabilizadaPct, mesesEstabilizacion: v.mesesEstabilizacion,
      opexPct: v.opexPct, capRatePct: v.capRatePct, aniosOperacion: v.aniosOperacion, equityPct: v.equityPct, tasaDeudaAnual: v.tasaDeudaAnual,
    }
    const armado = armarEntradaRenta({
      costoTerreno: v.terrenoM2 * terreno.superficieM2, costoTotalConstruccion, superficieConstruida,
      areaRentableM2: areaRentable, rentaM2Mes: v.rentaM2Mes, rangoHonorarios, usuario,
    })
    const m = calcularModeloRenta(armado.entrada)
    const sens = [-0.2, -0.1, 0, 0.1, 0.2].map(dc => ({
      dc,
      fila: [-0.2, -0.1, 0, 0.1, 0.2].map(dr => calcularModeloRenta({
        ...armado.entrada,
        rentaM2Mes: v.rentaM2Mes * (1 + dr),
        costoObraTotal: armado.entrada.costoObraTotal * (1 + dc),
      }).tirProyectoAnual),
    }))
    return { m, armado, usuario, sens, rentaNecesaria: rentaParaTir(armado.entrada, tirObjetivo) }
  }, [v, tirObjetivo, areaRentable, superficieConstruida, terreno.superficieM2, rangoHonorarios, datos])

  const aplicar = () => {
    if (!calc || !onAplicar) return
    onAplicar({
      terrenoM2: Math.abs(v.terrenoM2 - terreno.costoTerrenoM2) > 0.5 ? String(Math.round(v.terrenoM2)) : undefined,
      construccionM2: Math.abs(v.construccionM2 - datos.construccionM2Agente) > 0.5 ? String(Math.round(v.construccionM2)) : undefined,
      supuestosRenta: calc.usuario,
    })
  }

  if (areaRentable <= 0) {
    return <p className="max-w-5xl mx-auto px-8 py-10 text-[13px] text-[#8b96ab]">Mastermind de renta necesita el mix de bodegas del Agente de Arquitectura.</p>
  }

  const m = calc?.m
  const tasa = v.tasaDeudaAnual
  const tonoTir = (t: number | null) => t === null ? 'mal' : t >= tasa ? 'bien' : 'mal'
  const celda = (t: number | null) => t === null ? 'bg-[#2e1414] text-[#F87171]'
    : t >= tirObjetivo ? 'bg-[#14301f] text-[#1D9E75]'
    : t >= tasa ? 'bg-[#2e2510] text-[#FBBF24]'
    : 'bg-[#2e1414] text-[#F87171]'

  return (
    <div className="max-w-7xl mx-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <p className="text-[13px] text-[#8b96ab] max-w-[640px]">
          Minibodegas para renta: mueve la renta, la ocupación, los costos y el crédito y ve la TIR recalcularse en vivo con el
          mismo modelo del Agente Financiero. {totalBodegas > 0 && <>{totalBodegas} bodegas · {Math.round(areaRentable).toLocaleString('es-MX')} m² rentables.</>}
        </p>
        {onAplicar ? <button
          onClick={aplicar}
          disabled={!calc || !hayCostos}
          title={hayCostos ? 'Guarda estos ajustes y vuelve a correr el Agente Financiero con ellos' : 'Falta que Costos de Construcción termine'}
          className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold text-[#070f22] bg-[#c9a227] hover:bg-[#ddc06a] px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Aplicar al análisis y recalcular Financiero
        </button> : <p className="shrink-0 max-w-[260px] text-[11px] text-[#5f6a80] text-right">Simulación — para guardar ajustes, abre Mastermind desde el análisis.</p>}
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-6">
        <div className="bg-[#0f1f3a] border border-[#2a3f5c] rounded-2xl p-5 grid grid-cols-2 gap-x-4 gap-y-5 content-start">
          <p className="col-span-2 text-[11px] font-bold text-[#ddc06a] uppercase tracking-wide">Mercado</p>
          <Slider label="Renta de lista" value={v.rentaM2Mes} min={S.rentaM2MesMin} max={800} step={5} unit=" $/m²/mes" onChange={set('rentaM2Mes')} />
          <Slider label="Ocupación estabilizada" value={v.ocupacionEstabilizadaPct} min={50} max={95} unit="%" onChange={set('ocupacionEstabilizadaPct')} />
          <Slider label="Meses para llenarse" value={v.mesesEstabilizacion} min={12} max={48} unit=" m" onChange={set('mesesEstabilizacion')} />
          <p className="col-span-2 text-[11px] font-bold text-[#ddc06a] uppercase tracking-wide mt-1">Costos</p>
          <Slider label="Terreno" value={v.terrenoM2} min={0} max={Math.max(20000, Math.round(terreno.costoTerrenoM2 * 2))} step={50} unit=" $/m²" onChange={set('terrenoM2')} />
          {hayCostos
            ? <Slider label="Construcción" value={v.construccionM2} min={4000} max={20000} step={100} unit=" $/m²" onChange={set('construccionM2')} />
            : <p className="col-span-2 text-[11px] text-[#5f6a80]">Construcción todavía no corre: sin costo de obra no hay TIR.</p>}
          <Slider label="Gastos de operación" value={v.opexPct} min={20} max={55} unit="%" onChange={set('opexPct')} />
          <Slider label="Años operando" value={v.aniosOperacion} min={3} max={15} unit=" a" onChange={set('aniosOperacion')} />
          <p className="col-span-2 text-[11px] font-bold text-[#ddc06a] uppercase tracking-wide mt-1">Salida y crédito</p>
          <Slider label="Cap rate de salida" value={v.capRatePct} min={6} max={14} step={0.25} unit="%" onChange={set('capRatePct')} />
          <Slider label="Equity" value={v.equityPct} min={20} max={100} step={5} unit="%" onChange={set('equityPct')} />
          <Slider label="Tasa del crédito" value={v.tasaDeudaAnual} min={6} max={20} step={0.25} unit="%" onChange={set('tasaDeudaAnual')} />
          <button onClick={() => setV(inicial)} className="col-span-2 text-[11px] text-[#8b96ab] hover:text-[#f4f0e6] border border-[#2a3f5c] rounded-lg py-1.5 cursor-pointer">
            Regresar a los valores del análisis
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {m && (
            <>
              <div className="grid grid-cols-4 gap-3">
                {hayCostos ? (
                  <>
                    <Kpi label="TIR proyecto" value={pct1(m.tirProyectoAnual)} sub={`sin deuda · vs crédito ${tasa}%`} tono={tonoTir(m.tirProyectoAnual)} />
                    <Kpi label="TIR socio" value={pct1(m.tirSocioAnual)} sub={`equity ${v.equityPct}%`} tono={tonoTir(m.tirSocioAnual)} />
                    <Kpi label="Yield on cost" value={`${m.yieldOnCostPct.toFixed(1)}%`} sub={`vs cap rate ${v.capRatePct}%`} tono={m.yieldOnCostPct >= v.capRatePct ? 'bien' : 'mal'} />
                    <Kpi label="Creación de valor" value={fmtM(m.creacionValor)} sub={`${m.margenDesarrolloPct.toFixed(1)}% sobre la inversión`} tono={m.creacionValor >= 0 ? 'bien' : 'mal'} />
                  </>
                ) : (
                  <Kpi label="Ingreso anual estabilizado" value={fmtM(m.ingresoBrutoEstabilizadoAnual)} sub="potencial, antes de costos de obra" />
                )}
                <Kpi label="NOI anual estabilizado" value={fmtM(m.noiEstabilizadoAnual)} sub={`ingreso ${fmtM(m.ingresoBrutoEstabilizadoAnual)} − gastos ${v.opexPct}%`} />
                <Kpi label="Valor del activo" value={fmtM(m.valorActivo)} sub={`NOI / cap rate ${v.capRatePct}%`} />
                {hayCostos && <Kpi label="Inversión total" value={fmtM(m.inversionTotal)} sub={`obra ${calc!.armado.plazoObraMeses} meses`} />}
                {hayCostos && <Kpi label="Payback con rentas" value={m.paybackMes ? `mes ${m.paybackMes}` : 'No se alcanza'} sub={`venta del activo en el mes ${m.mesSalida}`} tono={m.paybackMes ? 'neutro' : 'mal'} />}
              </div>

              {hayCostos && (
                <div className="bg-[#1c304b] border border-[#a68f52] rounded-2xl p-5 flex items-center gap-6">
                  <div className="w-[220px] shrink-0">
                    <Slider label="TIR objetivo (proyecto)" value={tirObjetivo} min={8} max={25} step={0.5} unit="%" onChange={setTirObjetivo} />
                  </div>
                  <p className="text-[13px] text-[#f4f0e6] leading-relaxed">
                    {calc!.rentaNecesaria === null
                      ? <>Ni con renta de {fmt(S.rentaM2MesMax)}/m²/mes se llega a {tirObjetivo}% — hay que bajar costos.</>
                      : <>Para una TIR de proyecto de <b>{tirObjetivo}%</b> necesitas una renta de lista de <b className="text-[#ddc06a]">{fmt(calc!.rentaNecesaria)}/m²/mes</b>
                        {' '}({calc!.rentaNecesaria > v.rentaM2Mes ? `+${Math.round((calc!.rentaNecesaria / v.rentaM2Mes - 1) * 100)}%` : `${Math.round((calc!.rentaNecesaria / v.rentaM2Mes - 1) * 100)}%`} vs la actual), con la ocupación y los costos de la izquierda.</>}
                  </p>
                </div>
              )}

              {hayCostos && (
                <div className="bg-[#0f1f3a] border border-[#2a3f5c] rounded-2xl p-5">
                  <p className="text-[11px] font-bold text-[#5f6a80] uppercase tracking-wide mb-3">Sensibilidad · TIR proyecto (renta × costo de obra)</p>
                  <table className="w-full text-center text-[11.5px]">
                    <thead>
                      <tr>
                        <th className="text-[10px] text-[#5f6a80] font-semibold text-left pb-2">Costo obra ↓ · Renta →</th>
                        {[-20, -10, 0, 10, 20].map(d => (
                          <th key={d} className="text-[10px] text-[#8b96ab] font-semibold pb-2">{fmt(v.rentaM2Mes * (1 + d / 100))} {d !== 0 && <span className="text-[#5f6a80]">({d > 0 ? '+' : ''}{d}%)</span>}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {calc!.sens.map(({ dc, fila }) => (
                        <tr key={dc}>
                          <td className="text-left text-[10.5px] text-[#8b96ab] pr-2 py-1">{dc === 0 ? 'Base' : `${dc > 0 ? '+' : ''}${Math.round(dc * 100)}%`}</td>
                          {fila.map((t, i) => (
                            <td key={i} className="p-0.5"><div className={`rounded-md py-1.5 font-semibold ${celda(t)} ${dc === 0 && i === 2 ? 'ring-1 ring-[#ddc06a]' : ''}`}>{pct1(t)}</div></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-[#5f6a80] mt-2">Verde: llega a la TIR objetivo · Ámbar: arriba del costo del crédito · Rojo: abajo del crédito.</p>
                </div>
              )}

              {mix.length > 0 && (
                <div className="bg-[#0f1f3a] border border-[#2a3f5c] rounded-2xl p-5">
                  <p className="text-[11px] font-bold text-[#5f6a80] uppercase tracking-wide mb-3">Renta de lista por tamaño</p>
                  <div className="grid grid-cols-5 gap-2">
                    {mix.map((r, i) => (
                      <div key={i} className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-[#5f6a80] font-semibold">{r.tipo} · {r.unidades}</p>
                        <p className="text-[13px] font-bold text-[#f4f0e6]">{fmt(r.m2Promedio * v.rentaM2Mes)}/mes</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#5f6a80] mt-2">Renta de lista con la renta promedio por m²; en la práctica las bodegas chicas se cobran más caro por m².</p>
                </div>
              )}

              <p className="text-[10.5px] text-[#5f6a80] leading-snug">
                Ocupación al abrir {Math.round(S.ocupacionApertura * 100)}%, {Math.round(S.opexFijoPct * 100)}% de los gastos de operación fijos desde la apertura,
                crédito solo intereses con garantía del activo y venta del activo al final del horizonte. Son supuestos de la industria a validar con datos de la plaza.
                {rentaMercado && <> Renta de Mercado: {fmt(Number(rentaMercado.rentaM2MesPromedio) || 0)}/m²/mes{rentaMercado.comparablesVerificados ? ` (${rentaMercado.comparablesVerificados} rentas verificadas)` : ' (estimada)'}.</>}
              </p>
            </>
          )}
          {!m && <p className="text-[13px] text-[#8b96ab]">Falta la renta de Mercado para calcular.</p>}
        </div>
      </div>
    </div>
  )
}
