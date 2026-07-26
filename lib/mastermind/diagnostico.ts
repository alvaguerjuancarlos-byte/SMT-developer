// Diagnóstico de viabilidad — sintetiza 3 solvers de ingeniería inversa (precio de venta,
// costo de terreno, costo de construcción) en un veredicto rankeado: qué palanca(s) EXTERNAS
// (mercado/costos, no decisiones de diseño) explican que el proyecto no alcance el TIR
// objetivo, y qué tendría que valer cada una para lograrlo por sí sola.
//
// "unidades mínimas a vender" queda deliberadamente fuera de este ranking: no es una causa
// de inviabilidad (nadie dice "el proyecto no jala porque faltan unidades"), es una palanca
// de diseño/remedio — y al ser altamente apalancada (pasar de 16 a 200 unidades es un salto
// de %) distorsionaría el ranking sin aportar una causa real. Esa palanca la sigue cubriendo
// ReverseEngineeringPanel como una de las opciones de "qué podría cambiar".
//
// Módulo TypeScript puro — sin LLM, sin efectos secundarios, 100% determinístico.

import type { MastermindInputs, MastermindOutputs, SolverResult } from './tipos'
import { resolverBenchmarkMaximo, resolverCostoTerrenoMaximo, resolverPrecioVentaMinimo } from './solvers'
import { RANGOS_BANDA_MXN_M2 } from './catalogo'

export type CausaPalanca = 'precioVenta' | 'costoTerreno' | 'costoConstruccion'

export interface CausaViabilidad {
  palanca: CausaPalanca
  etiqueta: string
  valorActual: number
  valorObjetivo: number | null
  convergio: boolean
  brechaPct: number // % de ajuste que le falta a esta palanca para volver viable ella sola; 0 = ya viable
  cumple: boolean
}

export interface DiagnosticoViabilidad {
  tirActual: number | null
  tirObjetivo: number
  viable: boolean
  causas: CausaViabilidad[] // ordenadas de mayor a menor brecha
  causaPrincipal: CausaViabilidad | null
}

// brechaPct se expresa relativa al VALOR ACTUAL de la palanca ("¿qué % tendría que moverse
// desde donde está hoy?"), no al objetivo — dividir entre el objetivo se distorsiona cuando
// otra palanca está en un extremo (ej. precio de venta muy bajo empuja el "costo máximo de
// construcción sostenible" hacia casi cero, y dividir entre ese casi-cero infla artificialmente
// la brecha de construcción aunque construcción no haya cambiado). Dividir entre valorActual
// (que no se mueve por lo que pase en las demás palancas) da una comparación estable entre ellas.
function margen(resultado: SolverResult, valorActual: number, mejorEsMayor: boolean): { objetivo: number | null; brechaPct: number; cumple: boolean } {
  if (!resultado.converged || resultado.valor === null) {
    return { objetivo: null, brechaPct: 0, cumple: true } // no se pudo resolver en el rango — no se cuenta como causa
  }
  const objetivo = resultado.valor
  const cumple = mejorEsMayor ? valorActual >= objetivo : valorActual <= objetivo
  if (cumple || valorActual <= 0) return { objetivo, brechaPct: 0, cumple }
  const brechaPct = mejorEsMayor
    ? ((objetivo - valorActual) / valorActual) * 100
    : ((valorActual - objetivo) / valorActual) * 100
  return { objetivo, brechaPct, cumple: false }
}

export function diagnosticarViabilidad(inputs: MastermindInputs, outputs: MastermindOutputs): DiagnosticoViabilidad {
  const tirActual = outputs.retorno.tirSocioAnual
  const viable = tirActual !== null && tirActual >= inputs.tirObjetivo

  const precioR = resolverPrecioVentaMinimo(inputs)
  const terrenoR = resolverCostoTerrenoMaximo(inputs)
  const construccionR = resolverBenchmarkMaximo(inputs)

  const costoConstruccionActual = outputs.costos.m2Construidos > 0
    ? outputs.costos.costoDirectoConstruccion / outputs.costos.m2Construidos
    : 0

  const filas: { palanca: CausaPalanca; etiqueta: string; valorActual: number; resultado: SolverResult; mejorEsMayor: boolean }[] = [
    { palanca: 'precioVenta', etiqueta: 'Precio de venta/m² insuficiente', valorActual: inputs.mercado.precioVentaDepasM2, resultado: precioR, mejorEsMayor: true },
    { palanca: 'costoTerreno', etiqueta: 'Terreno demasiado caro', valorActual: inputs.terreno.costoTerreno, resultado: terrenoR, mejorEsMayor: false },
    { palanca: 'costoConstruccion', etiqueta: 'Costo de construcción demasiado alto', valorActual: costoConstruccionActual, resultado: construccionR, mejorEsMayor: false },
  ]

  const causas: CausaViabilidad[] = filas
    .map(f => {
      const m = margen(f.resultado, f.valorActual, f.mejorEsMayor)
      return {
        palanca: f.palanca,
        etiqueta: f.etiqueta,
        valorActual: f.valorActual,
        valorObjetivo: m.objetivo,
        convergio: f.resultado.converged,
        brechaPct: m.brechaPct,
        cumple: m.cumple,
      }
    })
    .sort((a, b) => b.brechaPct - a.brechaPct)

  const causaPrincipal = causas.find(c => !c.cumple) ?? null

  return { tirActual, tirObjetivo: inputs.tirObjetivo, viable, causas, causaPrincipal }
}

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
