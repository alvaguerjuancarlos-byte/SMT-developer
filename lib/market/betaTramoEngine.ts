// Motor heurístico que relaciona la plusvalía real de zonas económicas/medias (banda 1-2) con
// la plusvalía esperada de zonas premium (banda 3-4) — inspirado en el Case-Shiller Tiered Price
// Index (S&P/Cotality), que desde los años 80 separa cada metro de EE.UU. en tramos Low/Medium/
// High precisamente porque no se mueven igual: el tramo bajo es sistemáticamente más volátil,
// amplifica tanto subidas como caídas.
//
// No existe un índice mexicano segmentado por tramo de precio — este es el mejor proxy
// disponible hoy. El beta se calibró con datos REALES (no un número inventado ni copiado de un
// blog): se descargaron las series públicas de FRED (Reserva Federal de St. Louis) de índices
// Low-Tier y High-Tier con historia completa 1987/1992-2026 para 3 metros de EE.UU. (Los
// Ángeles, San Francisco, Chicago) y se calculó la regresión empírica mes a mes
// (Δ%_high = β × Δ%_low) — verificado 2026-09-04, ver detalle de cada metro abajo.
//
// SIEMPRE es una ESTIMACIÓN, nunca un dato real — todo output de este motor debe etiquetarse
// como tal en la UI (mismo criterio que el resto de la app: nunca mezclar calculado/estimado sin
// distinguir).

export interface BetaTramoMetroReferencia {
  metro: string
  ratioVolatilidad: number // volatilidad mensual del tramo bajo / volatilidad del tramo alto
  beta: number             // Δ%_high = beta × Δ%_low (regresión OLS sobre 1987/1992-2026)
}

// Calculado en vivo el 2026-09-04 desde series FRED reales (LXXRLTSA/LXXRHTSA, SFXRLTSA/
// SFXRHTSA, CHXRLTSA/CHXRHTSA) — no re-derivar de memoria, si se necesita refrescar, repetir el
// cálculo contra las series públicas actualizadas.
export const BETA_POR_METRO_REFERENCIA: BetaTramoMetroReferencia[] = [
  { metro: 'Los Angeles', ratioVolatilidad: 1.306, beta: 0.601 },
  { metro: 'San Francisco', ratioVolatilidad: 1.343, beta: 0.516 },
  { metro: 'Chicago', ratioVolatilidad: 1.774, beta: 0.317 },
]

export const BETA_TRAMO_ALTO_SOBRE_BAJO = {
  promedio: 0.478,
  min: 0.317,
  max: 0.601,
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
