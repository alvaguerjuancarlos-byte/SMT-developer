// Matriz de sensibilidad con ejes elegibles — PREFORMA, Bloque 3 (§3.1/3.2).
//
// Deliberadamente en un archivo aparte de lib/mastermind/sensibilidad.ts: ese archivo (y su
// tipo SensitivityCell) también los usa app/mastermind/components/SensitivityMatrix.tsx y
// lib/mastermind/exportExcel.ts — cambiarle la forma para soportar ejes configurables
// rompería esas otras pantallas. Mismo patrón "duplicado a propósito" que ya sigue este repo.

import type { MastermindInputs, MastermindOutputs } from './tipos'
import { calcularMastermind } from './motor'
import { BENCHMARKS_CONSTRUCCION_MXN_M2 } from './catalogo'

export type VariableSensibilidad = 'precioVenta' | 'costoConstruccion' | 'costoTerreno' | 'tasaInteres' | 'plazoObra' | 'plazoVenta'

export const VARIABLES_SENSIBILIDAD: { id: VariableSensibilidad; label: string; unidad: string }[] = [
  { id: 'precioVenta', label: 'Precio de venta', unidad: '$/m²' },
  { id: 'costoConstruccion', label: 'Costo de construcción', unidad: '$/m²' },
  { id: 'costoTerreno', label: 'Costo de terreno', unidad: '$/m²' },
  { id: 'tasaInteres', label: 'Tasa de interés', unidad: '%' },
  { id: 'plazoObra', label: 'Plazo de obra', unidad: 'meses' },
  { id: 'plazoVenta', label: 'Plazo de venta', unidad: 'meses' },
]

// Mismos 5 pasos relativos que ya usaba lib/mastermind/sensibilidad.ts (±20/10/0/10/20% con
// rango=0.2) — aquí el rango es elegible (0.1 | 0.2 | 0.3), pero la forma es la misma.
const PASOS_REL = [-1, -0.5, 0, 0.5, 1]

export interface EjeSensibilidad {
  variable: VariableSensibilidad
  rango: number // 0.1 | 0.2 | 0.3
}

export interface SensitivityCellFlex {
  fila: { variable: VariableSensibilidad; valor: number }
  columna: { variable: VariableSensibilidad; valor: number }
  tirSocio: number | null
  semaforo: 'verde_oscuro' | 'verde' | 'amarillo' | 'rojo' | 'gris'
}

export function valorBaseDe(inputs: MastermindInputs, variable: VariableSensibilidad): number {
  switch (variable) {
    case 'precioVenta': return inputs.mercado.precioVentaDepasM2
    case 'costoConstruccion': return inputs.proyecto.costoConstruccionRealM2 ?? BENCHMARKS_CONSTRUCCION_MXN_M2[inputs.proyecto.benchmarkConstruccion]
    case 'costoTerreno': return inputs.terreno.costoTerrenoM2
    case 'tasaInteres': return inputs.financiamiento.tasaAnualCredito
    case 'plazoObra': return inputs.tiempo.plazoObraMeses
    case 'plazoVenta': return inputs.tiempo.plazoVentaMeses
  }
}

export function aplicarVariableSensibilidad(inputs: MastermindInputs, variable: VariableSensibilidad, valor: number): MastermindInputs {
  switch (variable) {
    case 'precioVenta':
      return { ...inputs, mercado: { ...inputs.mercado, precioVentaDepasM2: valor } }
    case 'costoConstruccion':
      return { ...inputs, proyecto: { ...inputs.proyecto, costoConstruccionRealM2: valor } }
    case 'costoTerreno':
      return { ...inputs, terreno: { ...inputs.terreno, costoTerrenoM2: valor, costoTerreno: valor * inputs.terreno.superficieM2 } }
    case 'tasaInteres':
      return { ...inputs, financiamiento: { ...inputs.financiamiento, tasaAnualCredito: valor } }
    case 'plazoObra':
      return { ...inputs, tiempo: { ...inputs.tiempo, plazoObraMeses: Math.max(1, Math.round(valor)) } }
    case 'plazoVenta':
      return { ...inputs, tiempo: { ...inputs.tiempo, plazoVentaMeses: Math.max(1, Math.round(valor)) } }
  }
}

function semaforoDe(tir: number | null, tirObjetivo: number): SensitivityCellFlex['semaforo'] {
  if (tir === null) return 'gris'
  if (tir > tirObjetivo + 10) return 'verde_oscuro'
  if (tir >= tirObjetivo) return 'verde'
  if (tir >= tirObjetivo - 5) return 'amarillo'
  return 'rojo'
}

export function generarMatrizSensibilidadFlexible(
  inputs: MastermindInputs,
  ejeFila: EjeSensibilidad,
  ejeColumna: EjeSensibilidad,
): SensitivityCellFlex[][] {
  const baseFila = valorBaseDe(inputs, ejeFila.variable)
  const baseColumna = valorBaseDe(inputs, ejeColumna.variable)

  return PASOS_REL.map((pf) => {
    const valorFila = baseFila * (1 + pf * ejeFila.rango)
    const inputsFila = aplicarVariableSensibilidad(inputs, ejeFila.variable, valorFila)

    return PASOS_REL.map((pc) => {
      const valorColumna = baseColumna * (1 + pc * ejeColumna.rango)
      const inputsCelda = aplicarVariableSensibilidad(inputsFila, ejeColumna.variable, valorColumna)
      const out: MastermindOutputs = calcularMastermind(inputsCelda)
      const tirSocio = out.retorno.tirSocioConverge ? out.retorno.tirSocioAnual : null
      return {
        fila: { variable: ejeFila.variable, valor: valorFila },
        columna: { variable: ejeColumna.variable, valor: valorColumna },
        tirSocio,
        semaforo: semaforoDe(tirSocio, inputs.tirObjetivo),
      }
    })
  })
}
