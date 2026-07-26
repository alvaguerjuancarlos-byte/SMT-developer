// Cadena determinística de áreas — fuente única de verdad para envolvente normativo →
// área construida → área vendible → validación de mix de unidades. Módulo puro, sin LLM,
// sin efectos secundarios. Reemplaza el cálculo por "participación típica" que hoy vive
// disperso en el prompt del Agente Construcción con constantes explícitas y auditable.

export type Rango = { piso: number; base: number; techo: number }

export interface EntradaEnvolvente {
  superficieTerreno: number
  cus: number
  cos: number
  nivelesMax: number
  densidadMaxUnidades?: number
  tipologia: 'vertical' | 'horizontal' | 'mixto'
}

export interface SalidaEnvolvente {
  areaMaxConstruible: number
  areaConstruida: Rango
  areaVendible: Rango
  areaNoVendible: Rango
  eficienciaVendiblePct: Rango
}

export interface ResultadoValidacionMix {
  areaMix: number
  nUnidades: number
  desviacionPct: number
  subdensifica: boolean
  sobredensifica: boolean
}

// % del área máxima construible (envolvente COS/CUS) que realmente se materializa en obra —
// nunca se ocupa el 100% del techo normativo (retiros, circulaciones perimetrales, etc.).
export const FACTOR_APROVECHAMIENTO: Rango = { piso: 0.85, base: 0.90, techo: 0.95 }

// % del área construida que resulta vendible, por tipología — el resto es estacionamiento,
// circulaciones, núcleos verticales, amenidades y cuartos de servicio (no vendibles).
export const FACTOR_EFICIENCIA_VENDIBLE: Record<EntradaEnvolvente['tipologia'], Rango> = {
  vertical: { piso: 0.72, base: 0.76, techo: 0.80 },
  horizontal: { piso: 0.80, base: 0.83, techo: 0.85 },
  mixto: { piso: 0.70, base: 0.74, techo: 0.78 },
}

// Debajo de este % de la densidad máxima autorizada, el proyecto está subdensificando el
// predio respecto a lo que la normativa permite.
export const SUBDENSIFICACION_ALERTA = 0.70

const CLAVES_RANGO: (keyof Rango)[] = ['piso', 'base', 'techo']

function redondear1(n: number): number {
  return Math.round(n * 10) / 10
}

export function calcularEnvolvente(e: EntradaEnvolvente): SalidaEnvolvente {
  // Punto duro: lo que la normativa permite es lo menor entre el múltiplo de utilización de
  // suelo (CUS × terreno) y la huella máxima × niveles (COS × terreno × nivelesMax) — un
  // proyecto no puede exceder ninguno de los dos techos simultáneamente.
  const areaMaxConstruible = Math.min(
    e.cus * e.superficieTerreno,
    e.cos * e.superficieTerreno * e.nivelesMax,
  )

  const factorVendible = FACTOR_EFICIENCIA_VENDIBLE[e.tipologia]

  const areaConstruida = {} as Rango
  const areaVendible = {} as Rango
  const areaNoVendible = {} as Rango
  const eficienciaVendiblePct = {} as Rango

  for (const k of CLAVES_RANGO) {
    const construida = areaMaxConstruible * FACTOR_APROVECHAMIENTO[k]
    const vendible = construida * factorVendible[k]
    areaConstruida[k] = redondear1(construida)
    areaVendible[k] = redondear1(vendible)
    areaNoVendible[k] = redondear1(construida - vendible)
    eficienciaVendiblePct[k] = redondear1(construida > 0 ? (vendible / construida) * 100 : 0)
  }

  return {
    areaMaxConstruible: redondear1(areaMaxConstruible),
    areaConstruida,
    areaVendible,
    areaNoVendible,
    eficienciaVendiblePct,
  }
}

export function validarMix(
  mix: { unidades: number; m2Promedio: number }[],
  areaVendibleBase: number,
  densidadMax?: number,
): ResultadoValidacionMix {
  const areaMix = mix.reduce((s, r) => s + r.unidades * r.m2Promedio, 0)
  const nUnidades = mix.reduce((s, r) => s + r.unidades, 0)
  const desviacionPct = areaVendibleBase !== 0 ? ((areaMix - areaVendibleBase) / areaVendibleBase) * 100 : 0
  const subdensifica = densidadMax !== undefined ? nUnidades < SUBDENSIFICACION_ALERTA * densidadMax : false
  // A diferencia de subdensifica (un umbral de "aprovechamiento razonable"), este es el techo
  // legal duro — nUnidades nunca debería superar densidadMax, sin importar qué tan bien
  // aproveche el área vendible.
  const sobredensifica = densidadMax !== undefined ? nUnidades > densidadMax : false

  return {
    areaMix: redondear1(areaMix),
    nUnidades,
    desviacionPct: redondear1(desviacionPct),
    subdensifica,
    sobredensifica,
  }
}

export interface ResultadoValidacionSuperficie {
  superficiePropuesta: number
  piso: number
  techo: number
  desviacionPct: number
  fueraDeRangoPiso: boolean
  fueraDeRangoTecho: boolean
  excedeAreaMaxConstruible: boolean
}

export function validarSuperficieConstruida(
  superficiePropuesta: number,
  envolvente: SalidaEnvolvente,
): ResultadoValidacionSuperficie {
  const { piso, base, techo } = envolvente.areaConstruida
  const desviacionPct = base !== 0 ? ((superficiePropuesta - base) / base) * 100 : 0

  return {
    superficiePropuesta,
    piso,
    techo,
    desviacionPct: redondear1(desviacionPct),
    fueraDeRangoPiso: superficiePropuesta < piso,
    fueraDeRangoTecho: superficiePropuesta > techo,
    excedeAreaMaxConstruible: superficiePropuesta > envolvente.areaMaxConstruible,
  }
}

export function plazoVentaMeses(nUnidades: number, absorcionUdsMes: number): number {
  return absorcionUdsMes > 0 ? nUnidades / absorcionUdsMes : Infinity
}
