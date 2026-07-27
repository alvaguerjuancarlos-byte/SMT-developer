// Detección de anomalías — compara costos reales contra el rango esperado de su banda
// socioeconómica antes de confiar en los KPIs financieros.
//
// Módulo TypeScript puro — sin LLM, sin efectos secundarios, 100% determinístico.

import type { MastermindInputs } from './tipos'
import { RANGOS_BANDA_MXN_M2 } from './catalogo'

export interface AlertaAnomalia {
  campo: 'costoTerrenoM2' | 'costoConstruccionM2'
  valorReal: number
  rangoEsperado: { min: number; max: number }
  bandaNombre: string
  severidad: 'leve' | 'alta'
  mensaje: string
}

// % fuera del límite del rango antes de considerar la desviación "alta" en vez de "leve".
const TOLERANCIA_ANOMALIA = 0.15

function evaluarRango(valor: number, min: number, max: number): { fuera: boolean; severidad: 'leve' | 'alta' } {
  if (valor >= min && valor <= max) return { fuera: false, severidad: 'leve' }
  const limite = valor < min ? min : max
  const desviacion = Math.abs(valor - limite) / limite
  return { fuera: true, severidad: desviacion > TOLERANCIA_ANOMALIA ? 'alta' : 'leve' }
}

// Detecta valores absurdos ANTES de confiar en el diagnóstico de causas — ej. costo de
// construcción calculado en $12,000/m² cuando la banda seleccionada (Económica) espera
// $7,000–$10,500/m². No corrige nada: solo avisa, para no confundir "terreno caro porque
// el mercado es caro" con "terreno caro por un error de captura o de cálculo".
export function detectarAnomalias(inputs: MastermindInputs): AlertaAnomalia[] {
  const alertas: AlertaAnomalia[] = []

  const bandaTerreno = inputs.terreno.bandaTerreno
  if (bandaTerreno && RANGOS_BANDA_MXN_M2[bandaTerreno] && inputs.terreno.costoTerrenoM2 > 0) {
    const rango = RANGOS_BANDA_MXN_M2[bandaTerreno]
    const r = evaluarRango(inputs.terreno.costoTerrenoM2, rango.min, rango.max)
    if (r.fuera) {
      alertas.push({
        campo: 'costoTerrenoM2',
        valorReal: inputs.terreno.costoTerrenoM2,
        rangoEsperado: rango,
        bandaNombre: rango.nombre,
        severidad: r.severidad,
        mensaje: `El costo de terreno ($${Math.round(inputs.terreno.costoTerrenoM2).toLocaleString('es-MX')}/m²) está fuera del rango esperado para Banda ${bandaTerreno} — ${rango.nombre} ($${rango.min.toLocaleString('es-MX')}–$${rango.max.toLocaleString('es-MX')}/m²). Verifica el dato antes de confiar en el diagnóstico.`,
      })
    }
  }

  const bandaConstruccion = inputs.proyecto.bandaConstruccion
  const costoRealM2 = inputs.proyecto.costoConstruccionRealM2
  if (bandaConstruccion && RANGOS_BANDA_MXN_M2[bandaConstruccion] && costoRealM2 && costoRealM2 > 0) {
    const rango = RANGOS_BANDA_MXN_M2[bandaConstruccion]
    const r = evaluarRango(costoRealM2, rango.min, rango.max)
    if (r.fuera) {
      alertas.push({
        campo: 'costoConstruccionM2',
        valorReal: costoRealM2,
        rangoEsperado: rango,
        bandaNombre: rango.nombre,
        severidad: r.severidad,
        mensaje: `El costo de construcción calculado ($${Math.round(costoRealM2).toLocaleString('es-MX')}/m²) está fuera del rango esperado para Banda ${bandaConstruccion} — ${rango.nombre} ($${rango.min.toLocaleString('es-MX')}–$${rango.max.toLocaleString('es-MX')}/m²). Verifica el dato antes de confiar en el diagnóstico.`,
      })
    }
  }

  return alertas
}
