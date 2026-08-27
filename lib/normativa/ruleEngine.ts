// Fase 1 (documento PREFORMA_PROMPT_MAESTRO_AGENTE_NORMATIVA.md, §13/14/74) — núcleo del
// NormativeRuleEngine. Motor puro, sin red ni LLM: evalúa reglas normativas condicionales
// (§74, modelo parameter/conditions/result) contra el contexto de un predio y resuelve un
// parámetro con trazabilidad completa (§13, §78).
//
// Hoy NO existe ningún NormativeSourceRegistry real alimentando esto (ver hallazgo de la
// inspección Fase 1: el agente "Legal" actual inventa COS/CUS vía LLM sin fuente). Este motor
// queda listo para el día en que existan reglas reales (aunque sea cargadas a mano) — no asume
// ninguna regla concreta de San Pedro ni de ningún municipio.
//
// Simplificación explícita frente al §6 del documento: la jerarquía normativa completa
// (jurisdiction/scope/date/validity/specificity/geographic intersection/use) requiere un
// NormativeSourceRegistry real que no existe todavía. Mientras tanto, si dos reglas aplicables
// arrojan el MISMO valor se toma como corroborado; si arrojan valores DISTINTOS, el motor NO
// elige en silencio (§12: "No elegir silenciosamente") — reporta CONFLICT y dejar los candidatos
// disponibles para revisión manual.

export type Operador = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'BETWEEN'

export interface CondicionSimple {
  field: string
  operator: Operador
  value: number | string | boolean | (number | string)[]
}

export interface CondicionAND { op: 'AND'; condiciones: Condicion[] }
export interface CondicionOR { op: 'OR'; condiciones: Condicion[] }
export interface CondicionNOT { op: 'NOT'; condicion: Condicion }
export type CondicionCompuesta = CondicionAND | CondicionOR | CondicionNOT
export type Condicion = CondicionSimple | CondicionCompuesta

export type ContextoSitio = Record<string, number | string | boolean | undefined | null>

export interface ResultadoRegla {
  value: number | string
  unit?: string
}

// Modelo de regla del §13 — cada regla debe poder rastrearse hasta un instrumento y artículo
// reales, nunca un número suelto.
export interface ReglaNormativa {
  parameter: string
  conditions: Condicion[] // AND implícito entre los elementos del arreglo, como en el ejemplo del §74
  result: ResultadoRegla
  source: string          // ej. "E3", "Reglamento Art. 45"
  instrument: string      // ej. "Plan de Desarrollo Urbano Municipal 2030"
  jurisdiction: string    // ej. "SPGG"
  article?: string | null
  effectiveDate?: string | null
  exceptions?: string[]
  confidence: number      // 0-1, declarada por quien registra la regla
}

export type EstadoParametro = 'DOCUMENTED' | 'NOT_AVAILABLE' | 'CONFLICT'

export interface ParametroResuelto {
  parameter: string
  value: number | string | null
  unit: string | null
  status: EstadoParametro
  source: string | null
  instrument: string | null
  article: string | null
  jurisdiction: string | null
  confidence: number | null
  conditions: Condicion[]
  exceptions: string[]
  explanation: string
  reglasEnConflicto?: ReglaNormativa[] // solo presente si status === 'CONFLICT'
}

// Dato faltante en el contexto del predio → la condición no se puede evaluar → se trata como no
// cumplida. Nunca se asume verdadero por falta de dato (regla de no inventar, §5).
export function evaluarCondicion(cond: Condicion, ctx: ContextoSitio): boolean {
  if ('op' in cond) {
    switch (cond.op) {
      case 'AND': return cond.condiciones.every((c) => evaluarCondicion(c, ctx))
      case 'OR': return cond.condiciones.some((c) => evaluarCondicion(c, ctx))
      case 'NOT': return !evaluarCondicion(cond.condicion, ctx)
    }
  }

  const actual = ctx[cond.field]
  if (actual == null) return false

  switch (cond.operator) {
    case 'EQ': return actual === cond.value
    case 'NEQ': return actual !== cond.value
    case 'GT': return typeof actual === 'number' && typeof cond.value === 'number' && actual > cond.value
    case 'GTE': return typeof actual === 'number' && typeof cond.value === 'number' && actual >= cond.value
    case 'LT': return typeof actual === 'number' && typeof cond.value === 'number' && actual < cond.value
    case 'LTE': return typeof actual === 'number' && typeof cond.value === 'number' && actual <= cond.value
    case 'IN': return Array.isArray(cond.value) && (cond.value as (number | string)[]).includes(actual as never)
    case 'BETWEEN': {
      const [min, max] = cond.value as [number, number]
      return typeof actual === 'number' && actual >= min && actual <= max
    }
  }
}

function todasLasCondiciones(condiciones: Condicion[], ctx: ContextoSitio): boolean {
  return condiciones.every((c) => evaluarCondicion(c, ctx))
}

export function resolverParametro(
  parameter: string,
  reglas: ReglaNormativa[],
  ctx: ContextoSitio,
): ParametroResuelto {
  const candidatas = reglas.filter((r) => r.parameter === parameter && todasLasCondiciones(r.conditions, ctx))

  if (candidatas.length === 0) {
    return {
      parameter, value: null, unit: null, status: 'NOT_AVAILABLE',
      source: null, instrument: null, article: null, jurisdiction: null,
      confidence: null, conditions: [], exceptions: [],
      explanation: `Ninguna regla registrada para "${parameter}" aplica al contexto del predio (o no hay reglas cargadas para este parámetro todavía).`,
    }
  }

  const valoresUnicos = new Set(candidatas.map((r) => r.result.value))
  if (valoresUnicos.size > 1) {
    return {
      parameter, value: null, unit: null, status: 'CONFLICT',
      source: null, instrument: null, article: null, jurisdiction: null,
      confidence: null, conditions: [], exceptions: [],
      explanation: `${candidatas.length} reglas aplicables a "${parameter}" arrojan valores distintos (${[...valoresUnicos].join(', ')}) — requiere validación manual antes de usarse (§12).`,
      reglasEnConflicto: candidatas,
    }
  }

  // Todas las reglas candidatas coinciden en el valor (corroboración) — se reporta la de mayor
  // confianza declarada como fuente principal.
  const elegida = candidatas.reduce((a, b) => (b.confidence > a.confidence ? b : a))

  return {
    parameter,
    value: elegida.result.value,
    unit: elegida.result.unit ?? null,
    status: 'DOCUMENTED',
    source: elegida.source,
    instrument: elegida.instrument,
    article: elegida.article ?? null,
    jurisdiction: elegida.jurisdiction,
    confidence: elegida.confidence,
    conditions: elegida.conditions,
    exceptions: elegida.exceptions ?? [],
    explanation: `Resuelto por "${elegida.instrument}" (${elegida.source}${elegida.article ? `, art. ${elegida.article}` : ''}).`,
  }
}
