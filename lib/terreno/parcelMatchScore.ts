// Fase 1 (documento PREFORMA_PROMPT_MAESTRO_AGENTE_TERRENO.md, §8) — Score de identificación
// de predio. Motor puro, sin red ni LLM: dado un candidato de parcela con sus componentes de
// coincidencia (0-1 cada uno, o null si no hay dato para comparar esa dimensión), calcula un
// score ponderado y decide si se puede auto-seleccionar o si requiere confirmación manual.
//
// Hoy no existe ningún ParcelResolver real alimentando esto (ver hallazgo Fase 1: no hay
// integración catastral/GIS todavía) — este motor queda listo para el día en que un resolver
// real produzca candidatos con estos componentes calculados.

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
