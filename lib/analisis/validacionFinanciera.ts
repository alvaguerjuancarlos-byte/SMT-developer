// Validación no bloqueante de los rubros de overhead (indirectos/honorarios/imprevistos) que
// el Agente Financiero calcula libremente vía LLM — ver app/api/agentes/financiero/route.ts.
// El prompt le pide 15-18%/8-10%/5% de costoTotalConstruccion, pero nada en código lo
// garantizaba; mismo espíritu que validarMix/validarSuperficieConstruida en
// lib/analisis/envolventeYAreas.ts (anota desviaciones, no corrige los montos).

function redondear1(n: number): number {
  return Math.round(n * 10) / 10
}

export interface ResultadoValidacionIndirectos {
  indirectosPct: number
  honorariosPct: number
  imprevistosPct: number
  indirectosFueraDeRango: boolean
  honorariosFueraDeRango: boolean
  imprevistosFueraDeRango: boolean
}

const RANGO_INDIRECTOS = { min: 15, max: 18 }
// Rango default de honorarios si el caller no pasa uno específico por banda — banda 2 (Media
// Estándar) de RANGOS_HONORARIOS_POR_BANDA en lib/mastermind/catalogo.ts. El Agente Financiero
// (app/api/agentes/financiero/route.ts) sí pasa el rango real de la banda del proyecto — este
// default solo aplica a callers que todavía no distinguen banda.
const RANGO_HONORARIOS_DEFAULT = { min: 8, max: 10 }
const IMPREVISTOS_OBJETIVO = 5
const IMPREVISTOS_TOLERANCIA = 1.5

export function validarIndirectos(
  indirectos: number,
  honorarios: number,
  imprevistos: number,
  costoTotalConstruccion: number,
  rangoHonorarios: { min: number; max: number } = RANGO_HONORARIOS_DEFAULT,
): ResultadoValidacionIndirectos {
  const pct = (monto: number) => costoTotalConstruccion !== 0 ? redondear1((monto / costoTotalConstruccion) * 100) : 0

  const indirectosPct = pct(indirectos)
  const honorariosPct = pct(honorarios)
  const imprevistosPct = pct(imprevistos)

  return {
    indirectosPct,
    honorariosPct,
    imprevistosPct,
    indirectosFueraDeRango: indirectosPct < RANGO_INDIRECTOS.min || indirectosPct > RANGO_INDIRECTOS.max,
    honorariosFueraDeRango: honorariosPct < rangoHonorarios.min || honorariosPct > rangoHonorarios.max,
    imprevistosFueraDeRango: Math.abs(imprevistosPct - IMPREVISTOS_OBJETIVO) > IMPREVISTOS_TOLERANCIA,
  }
}

// El Agente Construcción costea "Zona 1 / Área vendible" sobre el envolvente legal completo
// (COS/CUS), pero el mix de unidades que realmente se propone construir y vender puede sumar
// mucho menos área (ej. por un tope de densidad de unidades) — visto en producción: costo
// completo de construir 8,701 m² vendibles, pero el mix solo sumaba 3,348 m² (61.5% menos),
// dejando el resto del edificio pagado sin generar ingreso y produciendo TIR catastróficamente
// negativa. Financiero debe costear sobre lo que realmente se va a construir y vender, no sobre
// el máximo legal — se escala el costo hacia abajo proporcionalmente (nunca hacia arriba: si el
// mix excediera el área vendible construida sería sobre-densificación, ya señalada aparte por
// validarMix/sobredensifica, no un tema de costeo).
export interface ResultadoEscaladoMix {
  factorEscalaMix: number
  eficienciaMixPct: number
  eficienciaBaja: boolean
  costoTotalConstruccionOriginal: number
  costoTotalConstruccionEscalado: number
}

const EFICIENCIA_MIX_MINIMA = 85

export function escalarCostoPorMix(
  costoTotalConstruccion: number,
  superficieVendibleMix: number,
  superficieVendibleConstruccion: number,
): ResultadoEscaladoMix {
  const eficienciaMixPct = superficieVendibleConstruccion > 0
    ? redondear1((superficieVendibleMix / superficieVendibleConstruccion) * 100)
    : 100
  const factorEscalaMix = Math.min(1, eficienciaMixPct / 100)

  return {
    factorEscalaMix,
    eficienciaMixPct,
    eficienciaBaja: eficienciaMixPct < EFICIENCIA_MIX_MINIMA,
    costoTotalConstruccionOriginal: costoTotalConstruccion,
    costoTotalConstruccionEscalado: Math.round(costoTotalConstruccion * factorEscalaMix),
  }
}
