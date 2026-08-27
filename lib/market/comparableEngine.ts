// Fase 3 — Comparable Engine. Motor puro (sin LLM, sin efectos secundarios) que asigna un
// ComparableScore (§18-20 del spec) a cada comparable de venta ya extraído por
// app/api/agentes/comparables-venta/route.ts. No vuelve a buscar ni a validar comparables — solo
// los puntúa y clasifica contra el objetivo del proyecto.
//
// Principio de honestidad (§97, §124): una dimensión sin dato real detrás nunca se rellena con
// un valor inventado. Se deja en null y se excluye del promedio ponderado, redistribuyendo el
// peso entre las dimensiones que sí se pudieron calcular (weights[] documenta exactamente qué
// se usó, nunca queda oculto).

import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { ComparableScore, ComparableConScore, ObjetivoComparable, PesosComparable, TipoComparable } from './tipos'

// §18: pesos por defecto cuando las 4 dimensiones calculables están disponibles. Location y
// price pesan más porque son las dos variables que más mueven si un comparable es realmente
// relevante para tasar este predio específico (spread de zona y de segmento). Exportados para
// que un caller (ej. un futuro control en la UI de PREFORMA) pueda mostrarlos o partir de ellos
// al construir un override — ver calcularComparableScore(comparable, objetivo, pesos?).
export const PESOS_BASE_DEFAULT: PesosComparable = {
  location: 0.35, price: 0.30, area: 0.20, typology: 0.15,
}

// Mismo radio duro que ya usa comparables-venta/route.ts (Bloque 5) — un comparable a esta
// distancia o más ya fue descartado antes de llegar aquí si el caller mandó lat/lng, pero el
// score de locationSimilarity igual necesita el mismo denominador para ser consistente con ese
// criterio (0 en el radio máximo, 100 a distancia 0).
const RADIO_MAX_KM = 5

// Distancia bajo la cual un comparable se considera de la misma microzona (§19 DIRECT).
const DISTANCIA_DIRECT_KM = 1.5

// Umbral de desviación de precio para clasificar ASPIRATIONAL/FLOOR (§19) — mismo espíritu que
// TOLERANCIA en validarComparableVenta.ts, pero aplicado a la desviación contra el objetivo del
// proyecto, no a la consistencia interna precioM2×superficie=precioTotal.
const UMBRAL_PRECIO_ASPIRACIONAL = 0.20

function similitudPorDiferenciaRelativa(valor: number, objetivo: number): number {
  if (objetivo <= 0) return 0
  const diffPct = Math.abs(valor - objetivo) / objetivo
  return Math.max(0, Math.round(100 * (1 - diffPct)))
}

// Extrae el número de recámaras de un texto libre tipo "2 rec · 75 m²" o "3 recámaras". Devuelve
// null si no se puede parsear — nunca asume un valor por defecto (ej. no asumir "2" cuando el
// LLM no lo especificó).
export function parsearRecamaras(tipologia: string | null): number | null {
  if (!tipologia) return null
  const m = tipologia.match(/(\d+)\s*rec/i)
  return m ? Number(m[1]) : null
}

export function calcularComparableScore(
  comparable: ComparableVenta,
  objetivo: ObjetivoComparable,
  pesos: PesosComparable = PESOS_BASE_DEFAULT,
): ComparableScore {
  const rawScores: Partial<Record<'location' | 'typology' | 'area' | 'price', number>> = {}

  if (comparable.distanciaKm != null) {
    rawScores.location = Math.max(0, Math.round(100 * (1 - comparable.distanciaKm / RADIO_MAX_KM)))
  }

  const recamarasComparable = parsearRecamaras(comparable.tipologia)
  if (recamarasComparable != null && objetivo.recamarasObjetivo != null) {
    const diff = Math.abs(recamarasComparable - objetivo.recamarasObjetivo)
    // Coincidencia exacta = 100, 1 recámara de diferencia = 60, 2+ = 20 — escalón discreto, no
    // lineal, porque para un comprador 2 vs 3 recámaras es un salto de decisión, no un continuo.
    rawScores.typology = diff === 0 ? 100 : diff === 1 ? 60 : 20
  }

  if (comparable.superficieM2 != null && objetivo.areaM2Objetivo != null) {
    rawScores.area = similitudPorDiferenciaRelativa(comparable.superficieM2, objetivo.areaM2Objetivo)
  }

  if (comparable.precioM2 != null && objetivo.precioM2Objetivo != null) {
    rawScores.price = similitudPorDiferenciaRelativa(comparable.precioM2, objetivo.precioM2Objetivo)
  }

  const disponibles = Object.keys(rawScores) as (keyof PesosComparable)[]
  const sumaPesosDisponibles = disponibles.reduce((s, k) => s + pesos[k], 0)

  const weights: Partial<PesosComparable> = {}
  let finalScore: number | null = null

  if (disponibles.length > 0 && sumaPesosDisponibles > 0) {
    let acumulado = 0
    for (const k of disponibles) {
      // Redistribuir el peso de las dimensiones ausentes proporcionalmente entre las presentes,
      // en vez de simplemente ignorarlas (eso subestimaría el score cuando falta un dato, no
      // reflejaría la similitud real de lo que sí se pudo medir).
      const pesoNormalizado = pesos[k] / sumaPesosDisponibles
      weights[k] = Math.round(pesoNormalizado * 1000) / 1000
      acumulado += rawScores[k]! * pesoNormalizado
    }
    finalScore = Math.round(acumulado)
  }

  return {
    locationSimilarity: rawScores.location ?? null,
    typologySimilarity: rawScores.typology ?? null,
    areaSimilarity: rawScores.area ?? null,
    priceSimilarity: rawScores.price ?? null,
    ageSimilarity: null,
    amenitySimilarity: null,
    developerSimilarity: null,
    stageSimilarity: null,
    weights,
    dimensionesDisponibles: disponibles.length,
    finalScore,
  }
}

export function clasificarComparable(
  comparable: ComparableVenta,
  objetivo: ObjetivoComparable,
): TipoComparable {
  if (comparable.precioM2 != null && objetivo.precioM2Objetivo != null && objetivo.precioM2Objetivo > 0) {
    const diffPct = (comparable.precioM2 - objetivo.precioM2Objetivo) / objetivo.precioM2Objetivo
    if (diffPct > UMBRAL_PRECIO_ASPIRACIONAL) return 'ASPIRATIONAL'
    if (diffPct < -UMBRAL_PRECIO_ASPIRACIONAL) return 'FLOOR'
  }

  if (comparable.distanciaKm != null && comparable.distanciaKm <= DISTANCIA_DIRECT_KM) return 'DIRECT'

  // Sin distancia conocida o fuera del radio DIRECT, y sin desviación de precio marcada — se
  // trata como sustituto (zona distinta, comprador similar) en vez de asumir DIRECT sin
  // evidencia de cercanía real.
  return 'SUBSTITUTE'
}

// Punto de entrada de la Fase 3 — construye el score+clasificación de cada comparable y ordena
// de mayor a menor finalScore (los que no se pudieron puntuar, al final, sin descartarlos).
export function construirComparablesConScore(
  candidatos: ComparableVenta[],
  objetivo: ObjetivoComparable,
  pesos: PesosComparable = PESOS_BASE_DEFAULT,
): ComparableConScore[] {
  return candidatos
    .map((comparable) => ({
      comparable,
      score: calcularComparableScore(comparable, objetivo, pesos),
      tipo: clasificarComparable(comparable, objetivo),
    }))
    .sort((a, b) => (b.score.finalScore ?? -1) - (a.score.finalScore ?? -1))
}
