// Fase 1 (documento PREFORMA_PROMPT_MAESTRO_AGENTE_NORMATIVA.md, §19/20) — fórmulas puras de
// densidad y CAAV. Sin red ni LLM. No deciden ningún valor normativo (eso es el RuleEngine,
// ver ruleEngine.ts) — solo convierten un parámetro YA RESUELTO a las magnitudes que pide el
// dashboard (§52/53).

export type UnidadDensidad = 'viviendas_por_ha' | 'm2_por_vivienda'

export interface ResultadoDensidad {
  unidadesTeoricasRaw: number  // §77: nunca redondear en el cálculo intermedio
  unidadesMax: number          // §20: "nunca redondear automáticamente hacia arriba" -> floor
}

// densidad expresada como viviendas/ha o m²/vivienda (según el instrumento, §20) + superficie
// del predio en m² -> unidades teóricas. La conversión solo es válida si la unidad declarada
// coincide con lo que de verdad dice el instrumento — eso lo decide quien llama a esta función,
// no este motor (§20: "crear conversión solamente cuando sea matemáticamente válida").
export function calcularDensidad(
  densidadValor: number,
  unidad: UnidadDensidad,
  superficieTerrenoM2: number,
): ResultadoDensidad {
  const unidadesTeoricasRaw = unidad === 'viviendas_por_ha'
    ? densidadValor * (superficieTerrenoM2 / 10_000)
    : superficieTerrenoM2 / densidadValor

  return {
    unidadesTeoricasRaw,
    unidadesMax: Math.floor(unidadesTeoricasRaw),
  }
}

export interface ResultadoCAAV {
  areaMinimaM2: number
  porcentaje: number
}

// §19: required_green_permeable_area = site_area * required_percentage
export function calcularAreaCAAV(superficieTerrenoM2: number, porcentajeCAAV: number): ResultadoCAAV {
  return {
    areaMinimaM2: superficieTerrenoM2 * porcentajeCAAV,
    porcentaje: porcentajeCAAV,
  }
}
