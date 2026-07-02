'use client'

import { useMemo } from 'react'
import { useMastermind } from '../state'
import { resolverBenchmarkMaximo, resolverPrecioVentaMinimo, resolverUnidadesMinimas } from '@/lib/mastermind/solvers'

function fmtMXN(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

function FlujoAcumuladoChart({ flujo }: { flujo: number[] }) {
  const W = 720, H = 160
  const pad = { top: 10, right: 10, bottom: 20, left: 10 }
  const iW = W - pad.left - pad.right
  const iH = H - pad.top - pad.bottom

  let acumulado = 0
  const puntos = flujo.map(f => (acumulado += f))
  const min = Math.min(...puntos, 0)
  const max = Math.max(...puntos, 0)
  const rango = max - min || 1

  const x = (i: number) => pad.left + (i / (puntos.length - 1)) * iW
  const y = (v: number) => pad.top + ((max - v) / rango) * iH
  const zeroY = y(0)

  const linea = puntos.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      <line x1={pad.left} y1={zeroY} x2={W - pad.right} y2={zeroY} stroke="#E2E8E4" strokeWidth="1" strokeDasharray="4 3" />
      <polyline points={linea} fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <text x={pad.left} y={H - 4} fontSize="9" fill="#9aab9f">Mes 0</text>
      <text x={W - pad.right} y={H - 4} fontSize="9" fill="#9aab9f" textAnchor="end">Mes {puntos.length - 1}</text>
    </svg>
  )
}

function FilaTabla({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-[#F0F4F2] last:border-0">
      <td className="py-1.5 text-[#5a7065]">{label}</td>
      <td className="py-1.5 text-right font-medium text-[#111d17]">{value}</td>
    </tr>
  )
}

// Resumen ejecutivo estático para exportación a PDF — separado de la UI interactiva
// (sin sliders/acordeones) porque el PDF necesita un layout de "reporte", no de editor.
export default function PrintSummary({ nombreProyecto }: { nombreProyecto: string }) {
  const { inputs, outputs } = useMastermind()

  const precio = useMemo(() => resolverPrecioVentaMinimo(inputs), [inputs])
  const benchmark = useMemo(() => resolverBenchmarkMaximo(inputs), [inputs])
  const unidades = useMemo(() => resolverUnidadesMinimas(inputs), [inputs])

  const viable = outputs.retorno.tirSocioConverge && (outputs.retorno.tirSocioAnual as number) >= inputs.tirObjetivo

  return (
    <div id="mastermind-print" className="fixed -left-[9999px] top-0 w-[800px] bg-[#F7F8F6] p-10 text-[#111d17]">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8E4]">
        <div>
          <h1 className="text-[20px] font-bold">Mastermind — Reporte de Factibilidad</h1>
          <p className="text-[12px] text-[#5a7065]">{nombreProyecto}</p>
        </div>
        <p className="text-[11px] text-[#9aab9f]">
          {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Terreno</h2>
      <table className="w-full text-[12px] mb-6">
        <tbody>
          <FilaTabla label="Superficie" value={`${inputs.terreno.superficieM2.toLocaleString('es-MX')} m²`} />
          <FilaTabla label="Costo terreno" value={fmtMXN(inputs.terreno.costoTerreno)} />
        </tbody>
      </table>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Inputs del proyecto</h2>
      <table className="w-full text-[12px] mb-6">
        <tbody>
          <FilaTabla label="Tipo de proyecto" value={inputs.proyecto.tipoProyecto} />
          <FilaTabla label="Niveles" value={String(inputs.proyecto.niveles)} />
          <FilaTabla label="Unidades habitacionales" value={String(inputs.proyecto.unidadesHabitacionales)} />
          <FilaTabla label="Precio venta depas" value={`${fmtMXN(inputs.mercado.precioVentaDepasM2)}/m²`} />
          <FilaTabla label="Plazo obra / venta" value={`${inputs.tiempo.plazoObraMeses} / ${inputs.tiempo.plazoVentaMeses} meses`} />
          <FilaTabla label="% financiado" value={`${inputs.financiamiento.porcentajeFinanciado}%`} />
          <FilaTabla label="TIR objetivo" value={`${inputs.tirObjetivo}%`} />
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Ingresos</h2>
          <table className="w-full text-[12px]">
            <tbody>
              <FilaTabla label="Ingreso bruto total" value={fmtMXN(outputs.ingresos.ingresoBrutoTotal)} />
              <FilaTabla label="Ingreso neto" value={fmtMXN(outputs.ingresos.ingresoNeto)} />
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Costos</h2>
          <table className="w-full text-[12px]">
            <tbody>
              <FilaTabla label="Costo total" value={fmtMXN(outputs.costos.costoTotal)} />
              <FilaTabla label="m² construidos" value={`${outputs.costos.m2Construidos.toLocaleString('es-MX')} m²`} />
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Utilidad</h2>
          <table className="w-full text-[12px]">
            <tbody>
              <FilaTabla label="UAI" value={fmtMXN(outputs.utilidad.utilidadAntesImpuestos)} />
              <FilaTabla label="Margen neto" value={`${outputs.utilidad.margenNeto.toFixed(1)}%`} />
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Retorno</h2>
          <table className="w-full text-[12px]">
            <tbody>
              <FilaTabla label="TIR Socio" value={outputs.retorno.tirSocioConverge ? `${(outputs.retorno.tirSocioAnual as number).toFixed(1)}%` : 'No calculable'} />
              <FilaTabla label="TIR Proyecto" value={outputs.retorno.tirProyectoConverge ? `${(outputs.retorno.tirProyectoAnual as number).toFixed(1)}%` : 'No calculable'} />
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="rounded-xl p-3 mb-6 text-[13px] font-semibold text-center"
        style={{
          backgroundColor: outputs.retorno.tirSocioConverge ? (viable ? '#E1F5EE' : '#FEE2E2') : '#F0F4F2',
          color: outputs.retorno.tirSocioConverge ? (viable ? '#0F6E56' : '#DC2626') : '#5a7065',
        }}
      >
        {!outputs.retorno.tirSocioConverge ? 'TIR no calculable con estos parámetros' : viable ? 'Proyecto viable' : 'Ajustar parámetros'}
      </div>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Flujo de caja acumulado (Socio)</h2>
      <div className="mb-6">
        <FlujoAcumuladoChart flujo={outputs.flujoSocio} />
      </div>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#9aab9f] mb-2">Ingeniería inversa — para {inputs.tirObjetivo}% de TIR Socio</h2>
      <table className="w-full text-[12px] mb-8">
        <thead>
          <tr className="text-left text-[11px] text-[#9aab9f]">
            <th className="pb-1 font-semibold">Variable</th>
            <th className="pb-1 font-semibold text-right">Valor resuelto</th>
          </tr>
        </thead>
        <tbody>
          <FilaTabla label="Precio mínimo venta/m²" value={precio.converged ? fmtMXN(precio.valor as number) : 'No convergió'} />
          <FilaTabla label="Costo máximo construcción/m²" value={benchmark.converged ? fmtMXN(benchmark.valor as number) : 'No convergió'} />
          <FilaTabla label="Unidades mínimas a vender" value={unidades.converged ? `${Math.round(unidades.valor as number)} uds` : 'No convergió'} />
        </tbody>
      </table>

      <p className="text-[10px] text-[#C4CEC8] text-center pt-4 border-t border-[#E2E8E4]">
        Generado por SMT Developer — {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}
