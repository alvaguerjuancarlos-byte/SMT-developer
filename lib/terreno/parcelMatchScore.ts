// Fase 1 (documento PREFORMA_PROMPT_MAESTRO_AGENTE_TERRENO.md, §8) — Score de identificación
// de predio. Motor puro, sin red ni LLM: dado un candidato de parcela con sus componentes de
// coincidencia (0-1 cada uno, o null si no hay dato para comparar esa dimensión), calcula un
// score ponderado y decide si se puede auto-seleccionar o si requiere confirmación manual.
//
// Actualización (2026-08-29): sí existe un ParcelResolver real — ver parcelResolver.ts, que
// consulta el GeoServer municipal público de San Pedro Garza García (vu:predio, sin
// autenticación, verificado por prueba directa). construirComponentesMatch() de abajo es la
// mitad PURA de ese resolver: traduce un predio real + los datos que ya capturó el usuario en
// componentes de coincidencia, sin tocar la red.

import { puntoDentroDePoligono } from './geometryEngine'

export interface ComponentesMatch {
  cadastralIdMatch: number | null
  pointInsideParcel: number | null
  addressMatch: number | null
  municipalityMatch: number | null
  neighborhoodMatch: number | null
  streetMatch: number | null
  areaConsistency: number | null
  geometryConsistency: number | null
}

export type PesosMatch = Record<keyof ComponentesMatch, number>

// Pesos exactos del §8 — "Los pesos deben ser configurables", de ahí el segundo parámetro.
export const PESOS_MATCH_DEFAULT: PesosMatch = {
  cadastralIdMatch: 0.30,
  pointInsideParcel: 0.20,
  addressMatch: 0.15,
  municipalityMatch: 0.10,
  neighborhoodMatch: 0.10,
  streetMatch: 0.05,
  areaConsistency: 0.05,
  geometryConsistency: 0.05,
}

// Por debajo de este score, "nunca seleccionar automáticamente un candidato con confianza
// baja" (§7, paso 14). Se reutiliza el corte de la banda MEDIA del Confidence Engine de
// Normativa (§46) por consistencia interna del proyecto — el propio documento de Terreno no
// da un número exacto.
const UMBRAL_CONFIANZA_MINIMA = 0.70

// Si el 2º candidato queda a menos de este margen del 1º, se consideran "candidatos
// similares" (§8: "si existen múltiples candidatos similares, mostrar... [Seleccionar]").
const MARGEN_AMBIGUEDAD = 0.05

export function calcularParcelMatchScore(
  componentes: ComponentesMatch,
  pesos: PesosMatch = PESOS_MATCH_DEFAULT,
): number | null {
  const claves = Object.keys(pesos) as (keyof ComponentesMatch)[]
  const disponibles = claves.filter((k) => componentes[k] != null)
  const sumaPesos = disponibles.reduce((s, k) => s + pesos[k], 0)
  if (disponibles.length === 0 || sumaPesos === 0) return null

  const acumulado = disponibles.reduce((s, k) => s + componentes[k]! * pesos[k], 0)
  return acumulado / sumaPesos
}

export interface CandidatoParcela {
  id: string
  componentes: ComponentesMatch
}

export interface CandidatoConScore extends CandidatoParcela {
  score: number | null
}

export function clasificarCandidatos(
  candidatos: CandidatoParcela[],
  pesos: PesosMatch = PESOS_MATCH_DEFAULT,
): CandidatoConScore[] {
  return candidatos
    .map((c) => ({ ...c, score: calcularParcelMatchScore(c.componentes, pesos) }))
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
}

export type ResultadoSeleccion =
  | { status: 'NO_CANDIDATES' }
  | { status: 'REQUIRES_CONFIRMATION'; candidatos: CandidatoConScore[]; motivo: string }
  | { status: 'AUTO_RESOLVED'; seleccionado: CandidatoConScore; candidatos: CandidatoConScore[] }

export function resolverSeleccionParcela(
  candidatos: CandidatoParcela[],
  pesos: PesosMatch = PESOS_MATCH_DEFAULT,
): ResultadoSeleccion {
  const clasificados = clasificarCandidatos(candidatos, pesos)
  const conScore = clasificados.filter((c): c is CandidatoConScore & { score: number } => c.score != null)

  if (conScore.length === 0) return { status: 'NO_CANDIDATES' }

  const [mejor, segundo] = conScore

  if (mejor.score < UMBRAL_CONFIANZA_MINIMA) {
    return {
      status: 'REQUIRES_CONFIRMATION',
      candidatos: clasificados,
      motivo: `El mejor candidato tiene ${Math.round(mejor.score * 100)}% de coincidencia, por debajo del umbral mínimo de auto-selección (${Math.round(UMBRAL_CONFIANZA_MINIMA * 100)}%).`,
    }
  }

  if (segundo && mejor.score - segundo.score < MARGEN_AMBIGUEDAD) {
    return {
      status: 'REQUIRES_CONFIRMATION',
      candidatos: clasificados,
      motivo: `Hay candidatos con coincidencia similar (${Math.round(mejor.score * 100)}% vs ${Math.round(segundo.score * 100)}%) — requiere confirmación manual (§8).`,
    }
  }

  return { status: 'AUTO_RESOLVED', seleccionado: mejor, candidatos: clasificados }
}

// ── Construcción de componentes desde un predio real (parcelResolver.ts) ─────────────────────

// Mismo criterio de normalización que dedupEngine.ts (independiente, no se comparte el import
// entre lib/terreno y lib/market a propósito — son dominios distintos que hoy coinciden en la
// necesidad, no en la fuente).
const REGEX_DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g')
function normalizarTexto(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(REGEX_DIACRITICOS, '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Similitud de Jaccard sobre tokens — más realista que exigir coincidencia exacta entre una
// dirección tecleada por el usuario y el campo "ubicacion" del catastro, que casi nunca se
// escriben idéntico ("Pedro Moya" vs "Calle Pedro Moya #123").
function similitudTexto(a: string, b: string): number | null {
  const tokensA = new Set(normalizarTexto(a).split(' ').filter(Boolean))
  const tokensB = new Set(normalizarTexto(b).split(' ').filter(Boolean))
  if (tokensA.size === 0 || tokensB.size === 0) return null
  const interseccion = [...tokensA].filter((t) => tokensB.has(t)).length
  const union = new Set([...tokensA, ...tokensB]).size
  return union > 0 ? interseccion / union : 0
}

export interface FeaturePredio {
  claveLote: string | null
  ubicacion: string | null
  colonia: string | null
  areaM2: number | null
  // Anillo exterior en [lng, lat] (EPSG:4326) — mismo orden que devuelve GeoJSON/parcelResolver.ts.
  anillo: [number, number][]
}

export interface SitioParaMatch {
  lat: number
  lng: number
  direccion?: string | null
  colonia?: string | null
  superficieDeclaradaM2?: number | null
}

// De las 8 dimensiones del §8, hoy solo hay dato real para 4: el resto queda null porque no se
// captura folio catastral esperado, ni frente/calle por separado, ni una segunda geometría
// independiente contra la cual comparar (§97 — nunca rellenar con un valor inventado).
export function construirComponentesMatch(predio: FeaturePredio, sitio: SitioParaMatch): ComponentesMatch {
  const pointInsideParcel = predio.anillo.length >= 3
    ? (puntoDentroDePoligono([sitio.lng, sitio.lat], predio.anillo) ? 1 : 0)
    : null

  const addressMatch = similitudTexto(predio.ubicacion ?? '', sitio.direccion ?? '')
  const neighborhoodMatch = similitudTexto(predio.colonia ?? '', sitio.colonia ?? '')

  let areaConsistency: number | null = null
  if (predio.areaM2 != null && sitio.superficieDeclaradaM2 != null && sitio.superficieDeclaradaM2 > 0) {
    const diffPct = Math.abs(predio.areaM2 - sitio.superficieDeclaradaM2) / sitio.superficieDeclaradaM2
    areaConsistency = Math.max(0, 1 - diffPct)
  }

  return {
    cadastralIdMatch: null, // el usuario no captura un folio esperado contra el cual comparar
    pointInsideParcel,
    addressMatch,
    municipalityMatch: null, // este adaptador es específico de San Pedro; lo resuelve quien llama
    neighborhoodMatch,
    streetMatch: null, // no se separa calle de dirección completa todavía
    areaConsistency,
    geometryConsistency: null, // requeriría una segunda geometría independiente (ej. cuadro de
    // construcción ya capturado a mano) contra la cual comparar — no en este primer corte
  }
}
