// Fase 8 (documento) — Price Engine. Motor puro, sin LLM, sin red. Calcula estadística robusta
// (§11), detecta outliers (§12) y segmenta precios (§21-22) sobre los comparables que ya
// extrajo/validó comparables-venta/route.ts. No vuelve a buscar ni a validar nada.
//
// Alcance real (ver nota en tipos.ts): segmenta por banda de superficie y por recámaras, no por
// zona/microzona/new-resale — esas dimensiones no tienen todavía una fuente confiable.

import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { NivelConfianza, PriceEngineResultado, RobustStats, SegmentoPrecio } from './tipos'
import { parsearRecamaras } from './comparableEngine'

// §22 — bandas fijas del spec. Límite superior EXCLUSIVO (ej. "60-80 m²" es [60, 80)).
const BANDAS_SUPERFICIE: { max: number; label: string }[] = [
  { max: 60, label: '<60 m²' },
  { max: 80, label: '60-80 m²' },
  { max: 100, label: '80-100 m²' },
  { max: 120, label: '100-120 m²' },
  { max: 150, label: '120-150 m²' },
  { max: 200, label: '150-200 m²' },
  { max: 300, label: '200-300 m²' },
  { max: Infinity, label: '300+ m²' },
]

export function bandaSuperficie(m2: number): string {
  return (BANDAS_SUPERFICIE.find((b) => m2 < b.max) ?? BANDAS_SUPERFICIE[BANDAS_SUPERFICIE.length - 1]).label
}

// Con el límite actual de comparables-venta/route.ts ("Máximo 8 comparables" por búsqueda), una
// muestra de este tamaño NUNCA alcanza el nivel de confianza más alto — es una limitación real
// del pipeline de datos, no de esta fórmula. Documentado explícitamente en vez de inflar el
// número para que se vea mejor de lo que es.
const N_MUESTRA_IDEAL = 15

function confianzaDeMuestra(n: number): { score: number; nivel: NivelConfianza } {
  const score = Math.min(100, Math.round((n / N_MUESTRA_IDEAL) * 100))
  const nivel: NivelConfianza =
    score >= 95 ? 'ALTA' : score >= 85 ? 'BUENA' : score >= 70 ? 'MEDIA' : score >= 50 ? 'BAJA' : 'INSUFICIENTE'
  return { score, nivel }
}

// Percentil por interpolación lineal entre rangos más cercanos (mismo método que el default de
// numpy/R-7) — `sorted` debe venir ya ordenado ascendente.
function percentil(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// §97 — con 0 valores no se produce ninguna estadística (NOT_ENOUGH_DATA), nunca un 0 falso.
export function calcularEstadisticasRobustas(valores: number[]): RobustStats | null {
  if (valores.length === 0) return null

  const sorted = [...valores].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  const median = percentil(sorted, 50)
  const p25 = percentil(sorted, 25)
  const p75 = percentil(sorted, 75)
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const { score, nivel } = confianzaDeMuestra(n)

  return {
    n,
    mean: Math.round(mean),
    median: Math.round(median),
    min: sorted[0],
    max: sorted[n - 1],
    p10: Math.round(percentil(sorted, 10)),
    p25: Math.round(p25),
    p75: Math.round(p75),
    p90: Math.round(percentil(sorted, 90)),
    iqr: Math.round(p75 - p25),
    stdDev: Math.round(Math.sqrt(variance)),
    confidenceScore: score,
    confidenceNivel: nivel,
  }
}

export interface ResultadoOutliersIQR {
  limpios: number[]
  outliers: number[]
}

// §12 — regla estándar de valla 1.5×IQR. Con menos de 4 valores no hay forma confiable de
// calcular cuartiles con sentido — se devuelven todos como "limpios" en vez de fingir un rango.
export function detectarOutliersIQR(valores: number[]): ResultadoOutliersIQR {
  if (valores.length < 4) return { limpios: [...valores], outliers: [] }

  const sorted = [...valores].sort((a, b) => a - b)
  const p25 = percentil(sorted, 25)
  const p75 = percentil(sorted, 75)
  const iqr = p75 - p25
  const vallaInferior = p25 - 1.5 * iqr
  const vallaSuperior = p75 + 1.5 * iqr

  const limpios: number[] = []
  const outliers: number[] = []
  for (const v of valores) {
    if (v < vallaInferior || v > vallaSuperior) outliers.push(v)
    else limpios.push(v)
  }
  return { limpios, outliers }
}

// Une detección de outliers + estadísticas robustas sobre las llaves de precioM2 de un grupo de
// comparables — helper interno, no exportado, para no duplicar esta secuencia en cada segmento.
function segmentar(comparables: ComparableVenta[], claveDe: (c: ComparableVenta) => string | null): SegmentoPrecio[] {
  const grupos = new Map<string, number[]>()
  for (const c of comparables) {
    if (c.precioM2 == null) continue
    const clave = claveDe(c)
    if (clave == null) continue
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave)!.push(c.precioM2)
  }

  return Array.from(grupos.entries()).map(([clave, valores]) => {
    const { limpios, outliers } = detectarOutliersIQR(valores)
    return { clave, estadisticas: calcularEstadisticasRobustas(limpios), outliersExcluidos: outliers }
  })
}

export function calcularDistribucionPorBanda(comparables: ComparableVenta[]): SegmentoPrecio[] {
  return segmentar(comparables, (c) => (c.superficieM2 != null ? bandaSuperficie(c.superficieM2) : null))
}

export function calcularDistribucionPorRecamaras(comparables: ComparableVenta[]): SegmentoPrecio[] {
  return segmentar(comparables, (c) => {
    const rec = parsearRecamaras(c.tipologia)
    return rec != null ? `${rec} rec` : null
  })
}

export function calcularPriceEngine(comparables: ComparableVenta[]): PriceEngineResultado {
  const preciosM2 = comparables.map((c) => c.precioM2).filter((p): p is number => p != null)
  const { limpios, outliers } = detectarOutliersIQR(preciosM2)

  return {
    askingPricePerM2: calcularEstadisticasRobustas(limpios),
    outliersExcluidos: outliers,
    porBandaSuperficie: calcularDistribucionPorBanda(comparables),
    porRecamaras: calcularDistribucionPorRecamaras(comparables),
  }
}
