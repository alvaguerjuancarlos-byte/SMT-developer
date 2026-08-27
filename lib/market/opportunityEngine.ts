// Fase 16 (documento) — Market Opportunity Score acotado (§55-56). Motor puro, sin red ni LLM.
// Ver alcance exacto en tipos.ts: solo 4 de los 11 componentes del spec tienen señal real hoy.

import type { MarketOpportunityScore, ProductFitScore, ResultadoPlusvalia } from './tipos'

export interface PesosOportunidad {
  price_growth: number
  competition: number
  product_fit: number
  data_quality: number
}

export const PESOS_OPORTUNIDAD_DEFAULT: PesosOportunidad = {
  price_growth: 0.25, competition: 0.25, product_fit: 0.25, data_quality: 0.25,
}

export interface OpportunityInput {
  appreciationAnual: ResultadoPlusvalia | null
  productFit: ProductFitScore | null
  priceConfidenceScore: number | null // priceEngine.askingPricePerM2?.confidenceScore ?? null
}

// Mapea % de plusvalía anual a un score 0-100, centrado en 50 = sin crecimiento. +10%/año → 100,
// -10%/año → 0. Es una regla razonada, no del spec (que no da la fórmula) — fácil de ajustar en
// un solo lugar si hace falta otro rango.
function scoreDeCrecimiento(tasaAnualizada: number): number {
  return Math.max(0, Math.min(100, Math.round(50 + tasaAnualizada * 5)))
}

export function calcularOpportunityScore(
  input: OpportunityInput,
  pesos: PesosOportunidad = PESOS_OPORTUNIDAD_DEFAULT,
): MarketOpportunityScore {
  const price_growth = input.appreciationAnual?.tasaAnualizada != null
    ? scoreDeCrecimiento(input.appreciationAnual.tasaAnualizada)
    : null

  const competition = input.productFit?.competitionFit ?? null
  const product_fit = input.productFit?.finalScore ?? null
  const data_quality = input.priceConfidenceScore ?? null

  const rawScores: Partial<PesosOportunidad> = {}
  if (price_growth != null) rawScores.price_growth = price_growth
  if (competition != null) rawScores.competition = competition
  if (product_fit != null) rawScores.product_fit = product_fit
  if (data_quality != null) rawScores.data_quality = data_quality

  const disponibles = Object.keys(rawScores) as (keyof PesosOportunidad)[]
  const sumaPesosDisponibles = disponibles.reduce((s, k) => s + pesos[k], 0)

  const weights: Partial<PesosOportunidad> = {}
  let finalScore: number | null = null
  if (disponibles.length > 0 && sumaPesosDisponibles > 0) {
    let acumulado = 0
    for (const k of disponibles) {
      const pesoNormalizado = pesos[k] / sumaPesosDisponibles
      weights[k] = Math.round(pesoNormalizado * 1000) / 1000
      acumulado += rawScores[k]! * pesoNormalizado
    }
    finalScore = Math.round(acumulado)
  }

  return {
    components: {
      demand: null, price_growth, inventory: null, absorption: null, competition,
      pipeline: null, rent: null, yield: null, market_gap: null, product_fit, data_quality,
    },
    weights,
    finalScore,
  }
}
