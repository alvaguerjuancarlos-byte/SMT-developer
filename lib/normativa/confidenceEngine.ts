// Fase 1 (documento PREFORMA_PROMPT_MAESTRO_AGENTE_NORMATIVA.md, §45/46) — Confidence Engine.
// Motor puro, genérico: no sabe nada de COS/CUS/altura en particular, solo combina scores de
// confianza (0-100) ya calculados en otro lado, con pesos — "el score general debe ser
// ponderado, no un promedio ingenuo" (§45). Reutilizable para el Normative Feasibility Score
// del §82 (land_use_compatibility, density_confidence, cos_cus_confidence, ...) el día que
// existan esos componentes reales.

export type NivelConfianzaNormativa = 'ALTA' | 'BUENA' | 'MEDIA' | 'BAJA' | 'INSUFICIENTE'

// Bandas exactas del §46.
export function clasificarNivelConfianza(scoreGeneral: number): NivelConfianzaNormativa {
  if (scoreGeneral >= 95) return 'ALTA'
  if (scoreGeneral >= 85) return 'BUENA'
  if (scoreGeneral >= 70) return 'MEDIA'
  if (scoreGeneral >= 50) return 'BAJA'
  return 'INSUFICIENTE'
}

export interface ComponenteConfianza {
  nombre: string
  score: number | null // 0-100; null si ese parámetro no tiene confianza calculada todavía
  peso: number
}

export interface ResultadoConfianza {
  scoreGeneral: number | null
  nivel: NivelConfianzaNormativa | null
  motivo: string
  componentes: ComponenteConfianza[]
}

export function calcularConfianzaPonderada(componentes: ComponenteConfianza[]): ResultadoConfianza {
  const validos = componentes.filter((c) => c.score != null && Number.isFinite(c.score) && c.peso > 0)
  const sumaPesos = validos.reduce((s, c) => s + c.peso, 0)

  if (validos.length === 0 || sumaPesos === 0) {
    return {
      scoreGeneral: null, nivel: null,
      motivo: 'Sin componentes de confianza disponibles para ponderar.',
      componentes,
    }
  }

  const acumulado = validos.reduce((s, c) => s + c.score! * c.peso, 0)
  const scoreGeneral = Math.round(acumulado / sumaPesos)
  const nivel = clasificarNivelConfianza(scoreGeneral)

  const faltantes = componentes.length - validos.length
  const motivo = faltantes > 0
    ? `Ponderado sobre ${validos.length} de ${componentes.length} componentes — ${faltantes} sin dato todavía.`
    : `Ponderado sobre los ${validos.length} componentes disponibles.`

  return { scoreGeneral, nivel, motivo, componentes }
}
