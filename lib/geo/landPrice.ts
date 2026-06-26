// Funciones puras para calcular precio de suelo a partir de una zona de referencia.
// Sin dependencia de Request/Response — directamente testeable.

export interface ZonaReferencia {
  id: string
  municipio: string
  colonia: string
  precio_m2_min: number
  precio_m2_base: number
  precio_m2_max: number
  factor_negociacion: number
  n_muestras: number
  fuente: string | null
}

export interface LandPriceFound {
  encontrado: true
  zona: { municipio: string; colonia: string }
  precio_m2_min: number
  precio_m2_base: number
  precio_m2_max: number
  factor_negociacion: number
  precio_cierre_estimado: number
  n_muestras: number
  fuente: string | null
}

export interface LandPriceNotFound {
  encontrado: false
  mensaje: string
}

export type LandPriceResult = LandPriceFound | LandPriceNotFound

export function calcularPrecioCierre(zona: ZonaReferencia): LandPriceFound {
  return {
    encontrado: true,
    zona: { municipio: zona.municipio, colonia: zona.colonia },
    precio_m2_min:          zona.precio_m2_min,
    precio_m2_base:         zona.precio_m2_base,
    precio_m2_max:          zona.precio_m2_max,
    factor_negociacion:     zona.factor_negociacion,
    precio_cierre_estimado: zona.precio_m2_base * zona.factor_negociacion,
    n_muestras:             zona.n_muestras,
    fuente:                 zona.fuente,
  }
}
