// Fase 15 (documento) — Product Fit Engine (§50). Motor puro, sin red ni LLM. Cruza el
// envolvente normativo real (lib/estimador) con lo que ya calculan Price/Comparable/Competitor
// Engine — ver alcance exacto en tipos.ts (demandFit/rentFit/supplyFit siempre null hoy).

import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { CompetitorProfile, PriceEngineResultado, ProductFitScore } from './tipos'
import { parsearRecamaras } from './comparableEngine'
import { bandaSuperficie } from './priceEngine'

// Mismo radio duro que usa el resto de lib/market/ (comparableEngine.ts, priceEngine.ts) para
// convertir distancia en score 0-100.
const RADIO_MAX_KM = 5

export interface EnvolventeParaFit {
  unidadesMax?: number
  cumple: boolean
}

export interface ProductFitInput {
  unidadesObjetivo: number
  precioM2Objetivo?: number | null
  areaM2Objetivo?: number | null
  recamarasObjetivo?: number | null
  envolvente: EnvolventeParaFit
  priceEngine: PriceEngineResultado
  comparables: ComparableVenta[]
  competitors: CompetitorProfile[]
}

function similitudPorDiferenciaRelativa(valor: number, objetivo: number): number {
  if (objetivo <= 0) return 0
  const diffPct = Math.abs(valor - objetivo) / objetivo
  return Math.max(0, Math.round(100 * (1 - diffPct)))
}

export function calcularProductFit(input: ProductFitInput): ProductFitScore {
  const { unidadesObjetivo, precioM2Objetivo, areaM2Objetivo, recamarasObjetivo, envolvente, priceEngine, comparables, competitors } = input

  // regulatoryFit — límite duro (§120: Normativa/Terreno/Mercado convergen, gana el más
  // restrictivo). unidadesRecomendadas NUNCA excede unidadesMax si se conoce.
  const regulatoryFit = envolvente.cumple ? 100 : 0
  const unidadesRecomendadas = envolvente.unidadesMax != null
    ? Math.min(unidadesObjetivo, envolvente.unidadesMax)
    : unidadesObjetivo

  // priceFit — qué tan cerca está el precio objetivo de la mediana real del mercado.
  let priceFit: number | null = null
  if (priceEngine.askingPricePerM2 && precioM2Objetivo != null) {
    priceFit = similitudPorDiferenciaRelativa(precioM2Objetivo, priceEngine.askingPricePerM2.median)
  }

  // sizeFit — qué tan representada está esa superficie en el mercado observado (% de
  // comparables en la misma banda de superficie que el objetivo).
  let sizeFit: number | null = null
  if (areaM2Objetivo != null && comparables.length > 0) {
    const bandaObjetivo = bandaSuperficie(areaM2Objetivo)
    const enBanda = comparables.filter((c) => c.superficieM2 != null && bandaSuperficie(c.superficieM2) === bandaObjetivo).length
    sizeFit = Math.round(100 * (enBanda / comparables.length))
  }

  // typologyFit — mismo criterio, pero por número de recámaras.
  let typologyFit: number | null = null
  if (recamarasObjetivo != null && comparables.length > 0) {
    const mismasRecamaras = comparables.filter((c) => parsearRecamaras(c.tipologia) === recamarasObjetivo).length
    typologyFit = Math.round(100 * (mismasRecamaras / comparables.length))
  }

  // locationFit — promedio de qué tan cerca están los comparables geocodificados del predio.
  const distancias = comparables.map((c) => c.distanciaKm).filter((d): d is number => d != null)
  const locationFit = distancias.length > 0
    ? Math.round(distancias.reduce((s, d) => s + Math.max(0, 100 * (1 - d / RADIO_MAX_KM)), 0) / distancias.length)
    : null

  // competitionFit — más competidores DIRECT (misma microzona, mismo segmento de precio)
  // penaliza el fit; escalón simple: cada DIRECT resta 25 puntos, piso en 0.
  const directos = competitors.filter((c) => c.clasificacion === 'DIRECT').length
  const competitionFit = Math.max(0, 100 - directos * 25)

  const disponibles = [priceFit, sizeFit, typologyFit, locationFit, regulatoryFit, competitionFit]
    .filter((v): v is number => v != null)
  const finalScore = disponibles.length > 0
    ? Math.round(disponibles.reduce((s, v) => s + v, 0) / disponibles.length)
    : null

  return {
    demandFit: null,
    competitionFit,
    priceFit,
    sizeFit,
    typologyFit,
    locationFit,
    regulatoryFit,
    supplyFit: null,
    rentFit: null,
    cumpleNormativa: envolvente.cumple,
    unidadesRecomendadas,
    finalScore,
  }
}
