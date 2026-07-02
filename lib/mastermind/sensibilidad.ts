// Matriz de sensibilidad 5×5: precio de venta vs. costo de construcción → TIR Socio resultante.

import type { MastermindInputs, SensitivityCell } from './tipos'
import { BENCHMARKS_CONSTRUCCION_MXN_M2 } from './catalogo'
import { calcularCostos, calcularIngresos, construirFlujoSocio } from './motor'
import { calcularTIR } from './irr'

const PASOS = [-0.20, -0.10, 0, 0.10, 0.20]

function semaforoDe(tir: number | null, tirObjetivo: number): SensitivityCell['semaforo'] {
  if (tir === null) return 'gris'
  if (tir > tirObjetivo + 10) return 'verde_oscuro'
  if (tir >= tirObjetivo) return 'verde'
  if (tir >= tirObjetivo - 5) return 'amarillo'
  return 'rojo'
}

export function generarMatrizSensibilidad(inputs: MastermindInputs): SensitivityCell[][] {
  const precioBase = inputs.mercado.precioVentaDepasM2
  const benchmarkBase = BENCHMARKS_CONSTRUCCION_MXN_M2[inputs.proyecto.benchmarkConstruccion]

  return PASOS.map(pasoBenchmark => {
    const benchmarkMxnM2 = benchmarkBase * (1 + pasoBenchmark)

    return PASOS.map(pasoPrecio => {
      const precioVentaM2 = precioBase * (1 + pasoPrecio)
      const inputsFila: MastermindInputs = { ...inputs, mercado: { ...inputs.mercado, precioVentaDepasM2: precioVentaM2 } }

      const ingresos = calcularIngresos(inputsFila)
      const costos = calcularCostos(inputsFila, ingresos, benchmarkMxnM2)
      const flujo = construirFlujoSocio(inputsFila, ingresos, costos)
      const tir = calcularTIR(flujo)
      const tirAnual = tir.converged ? (tir.tirAnual as number) * 100 : null

      return {
        precioVentaM2,
        benchmarkMxnM2,
        tirSocio: tirAnual,
        semaforo: semaforoDe(tirAnual, inputs.tirObjetivo),
      }
    })
  })
}
