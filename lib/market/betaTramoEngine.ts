// Motor heurístico que relaciona la plusvalía real de zonas económicas/medias (banda 1-2) con
// la plusvalía esperada de zonas premium (banda 3-4).
//
// Hasta 2026-09-04 este beta se calibraba con un proxy de EE.UU. (FRED, Case-Shiller Tiered
// Price Index de Los Ángeles/San Francisco/Chicago) porque no se conocía un índice mexicano
// segmentado por banda de precio. El 2026-09-09 se encontró que el Índice SHF de Precios de la
// Vivienda (Sociedad Hipotecaria Federal, gob.mx) SÍ segmenta por banda a nivel nacional
// ("Económica-Social" vs "Media-Residencial", 2005-2026, 86 trimestres) — ver
// lib/market/shfIndice.data.ts. Se reemplazó el proxy de EE.UU. por la regresión real sobre esas
// series (lib/market/shfAppreciationEngine.ts::calcularBetaSHF).
//
// HALLAZGO IMPORTANTE (verificado, no es ruido — consistente calculado trimestre-a-trimestre,
// año-a-año, y cada 2 años, con correlación 0.67-0.76): en México la banda alta se APRECIA MÁS
// que la banda baja (beta ≈1.04, crecimiento acumulado 2005-2026: económica-social +288% vs
// media-residencial +351%) — lo CONTRARIO de EE.UU., donde el tramo bajo es el más volátil. No
// se sabe la causa exacta (podría ser una diferencia real del mercado mexicano, o un artefacto
// de cómo el SHF define sus dos bandas vs. la metodología de ventas repetidas de Case-Shiller) —
// pero es el dato real disponible, y JC confirmó usarlo tal cual en vez de mantener el proxy.
//
// SIEMPRE es una ESTIMACIÓN, nunca un dato real — todo output de este motor debe etiquetarse
// como tal en la UI (mismo criterio que el resto de la app: nunca mezclar calculado/estimado sin
// distinguir).

import { calcularBetaSHF } from './shfAppreciationEngine'
import { SHF_NACIONAL_ECONOMICA_SOCIAL, SHF_NACIONAL_MEDIA_RESIDENCIAL } from './shfIndice.data'

const BETA_SHF = calcularBetaSHF(SHF_NACIONAL_ECONOMICA_SOCIAL, SHF_NACIONAL_MEDIA_RESIDENCIAL)

export const BETA_TRAMO_ALTO_SOBRE_BAJO = {
  promedio: BETA_SHF.beta,
  min: BETA_SHF.min,
  max: BETA_SHF.max,
} as const

export interface EstimacionPlusvaliaPremium {
  tasaAnualizadaEstimada: number
  rangoMin: number
  rangoMax: number
  betaUsado: number
  coloniaReferencia: string
  tasaAnualizadaReferencia: number
  muestraReferencia: number
}

// tasaAnualizadaTramoBajo: la plusvalía REAL (ResultadoPlusvalia.tasaAnualizada, ventana "anual")
// ya calculada por appreciationEngine.ts sobre la colonia de referencia — este motor NUNCA
// calcula plusvalía él mismo, solo transforma una tasa real ya verificada.
export function estimarPlusvaliaTramoAlto(
  tasaAnualizadaTramoBajo: number,
  coloniaReferencia: string,
  muestraReferencia: number,
): EstimacionPlusvaliaPremium {
  const redondear1 = (n: number) => Math.round(n * 10) / 10
  const aMin = tasaAnualizadaTramoBajo * BETA_TRAMO_ALTO_SOBRE_BAJO.min
  const aMax = tasaAnualizadaTramoBajo * BETA_TRAMO_ALTO_SOBRE_BAJO.max
  // El signo de tasaAnualizadaTramoBajo puede ser negativo (depreciación) — en ese caso
  // "min de beta" da el resultado MENOS negativo, así que no se puede asumir min<max sin
  // ordenar explícitamente después de multiplicar.
  return {
    tasaAnualizadaEstimada: redondear1(tasaAnualizadaTramoBajo * BETA_TRAMO_ALTO_SOBRE_BAJO.promedio),
    rangoMin: redondear1(Math.min(aMin, aMax)),
    rangoMax: redondear1(Math.max(aMin, aMax)),
    betaUsado: BETA_TRAMO_ALTO_SOBRE_BAJO.promedio,
    coloniaReferencia,
    tasaAnualizadaReferencia: tasaAnualizadaTramoBajo,
    muestraReferencia,
  }
}
