// Matriz de sensibilidad 5×5: precio de venta vs. costo de construcción → TIR Socio resultante.

import type { MastermindInputs, SensitivityCell } from './tipos'
import { BENCHMARKS_CONSTRUCCION_MXN_M2, PORCENTAJE_COMERCIALIZACION } from './catalogo'
import { calcularCostos, calcularIngresos } from './motor'
import { calcularFlujoFinanciero } from '@/lib/analisis/flujoFinanciero'

const PASOS = [-0.20, -0.10, 0, 0.10, 0.20]

function semaforoDe(tir: number | null, tirObjetivo: number): SensitivityCell['semaforo'] {
  if (tir === null) return 'gris'
  if (tir > tirObjetivo + 10) return 'verde_oscuro'
  if (tir >= tirObjetivo) return 'verde'
  if (tir >= tirObjetivo - 5) return 'amarillo'
  return 'rojo'
}

export function generarMatrizSensibilidad(inputs: MastermindInputs): SensitivityCell[][] {
  const { tiempo, financiamiento } = inputs
  const precioBase = inputs.mercado.precioVentaDepasM2
  // Mismo criterio que calcularCostos en motor.ts: preferir el costo real ya validado sobre
  // el benchmark del catálogo, para que la matriz centre alrededor del mismo número que usan
  // los demás KPIs.
  const benchmarkBase = inputs.proyecto.costoConstruccionRealM2 ?? BENCHMARKS_CONSTRUCCION_MXN_M2[inputs.proyecto.benchmarkConstruccion]

  return PASOS.map(pasoBenchmark => {
    const benchmarkMxnM2 = benchmarkBase * (1 + pasoBenchmark)

    return PASOS.map(pasoPrecio => {
      const precioVentaM2 = precioBase * (1 + pasoPrecio)
      const inputsFila: MastermindInputs = { ...inputs, mercado: { ...inputs.mercado, precioVentaDepasM2: precioVentaM2 } }

      const ingresos = calcularIngresos(inputsFila)
      const costos = calcularCostos(inputsFila, benchmarkMxnM2)
      const flujo = calcularFlujoFinanciero({
        costoTerreno: costos.costoTerreno,
        costoTotalConstruccion: costos.costoDirectoConstruccion,
        indirectos: costos.indirectos, honorarios: 0, imprevistos: 0,
        ingresosNetos: ingresos.ingresoNeto,
        comercializacion: ingresos.ingresoNeto * PORCENTAJE_COMERCIALIZACION,
        plazoObraMeses: tiempo.plazoObraMeses, plazoVentaMeses: tiempo.plazoVentaMeses, inicioVentasMes: tiempo.inicioVentasMes,
        porcentajeEquity: 100 - financiamiento.porcentajeFinanciado,
        tasaAnualCredito: financiamiento.tasaAnualCredito,
      })

      return {
        precioVentaM2,
        benchmarkMxnM2,
        tirSocio: flujo.tirSocioConverge ? flujo.tirSocioAnual : null,
        semaforo: semaforoDe(flujo.tirSocioConverge ? flujo.tirSocioAnual : null, inputs.tirObjetivo),
      }
    })
  })
}
