import { describe, it, expect } from 'vitest'
import { evaluarCondicion, resolverParametro, type ReglaNormativa, type Condicion } from '../ruleEngine'

function regla(overrides: Partial<ReglaNormativa> = {}): ReglaNormativa {
  return {
    parameter: 'CUS',
    conditions: [],
    result: { value: 3, unit: 'ratio' },
    source: 'E3',
    instrument: 'Plan de Desarrollo Urbano Municipal 2030',
    jurisdiction: 'SPGG',
    confidence: 0.98,
    ...overrides,
  }
}

describe('evaluarCondicion — operadores simples', () => {
  it('EQ/NEQ/GT/GTE/LT/LTE sobre un campo numérico', () => {
    const ctx = { frontage: 15 }
    expect(evaluarCondicion({ field: 'frontage', operator: 'EQ', value: 15 }, ctx)).toBe(true)
    expect(evaluarCondicion({ field: 'frontage', operator: 'NEQ', value: 15 }, ctx)).toBe(false)
    expect(evaluarCondicion({ field: 'frontage', operator: 'GT', value: 15 }, ctx)).toBe(false)
    expect(evaluarCondicion({ field: 'frontage', operator: 'GTE', value: 15 }, ctx)).toBe(true)
    expect(evaluarCondicion({ field: 'frontage', operator: 'LT', value: 20 }, ctx)).toBe(true)
    expect(evaluarCondicion({ field: 'frontage', operator: 'LTE', value: 10 }, ctx)).toBe(false)
  })

  it('IN evalúa pertenencia a una lista', () => {
    const ctx = { uso: 'habitacional' }
    expect(evaluarCondicion({ field: 'uso', operator: 'IN', value: ['habitacional', 'mixto'] }, ctx)).toBe(true)
    expect(evaluarCondicion({ field: 'uso', operator: 'IN', value: ['comercial'] }, ctx)).toBe(false)
  })

  it('BETWEEN evalúa un rango cerrado', () => {
    expect(evaluarCondicion({ field: 'pendiente', operator: 'BETWEEN', value: [5, 10] }, { pendiente: 7 })).toBe(true)
    expect(evaluarCondicion({ field: 'pendiente', operator: 'BETWEEN', value: [5, 10] }, { pendiente: 11 })).toBe(false)
  })

  it('dato faltante en el contexto: la condición nunca se asume verdadera (§5)', () => {
    expect(evaluarCondicion({ field: 'frontage', operator: 'GT', value: 10 }, {})).toBe(false)
  })
})

describe('evaluarCondicion — AND/OR/NOT', () => {
  it('AND requiere que todas las subcondiciones se cumplan', () => {
    const cond: Condicion = { op: 'AND', condiciones: [
      { field: 'frontage', operator: 'GT', value: 10 },
      { field: 'uso', operator: 'EQ', value: 'habitacional' },
    ] }
    expect(evaluarCondicion(cond, { frontage: 15, uso: 'habitacional' })).toBe(true)
    expect(evaluarCondicion(cond, { frontage: 5, uso: 'habitacional' })).toBe(false)
  })

  it('OR requiere que al menos una subcondición se cumpla', () => {
    const cond: Condicion = { op: 'OR', condiciones: [
      { field: 'esquina', operator: 'EQ', value: true },
      { field: 'frontage', operator: 'GT', value: 20 },
    ] }
    expect(evaluarCondicion(cond, { esquina: true, frontage: 5 })).toBe(true)
    expect(evaluarCondicion(cond, { esquina: false, frontage: 5 })).toBe(false)
  })

  it('NOT niega una condición', () => {
    const cond: Condicion = { op: 'NOT', condicion: { field: 'esquina', operator: 'EQ', value: true } }
    expect(evaluarCondicion(cond, { esquina: false })).toBe(true)
    expect(evaluarCondicion(cond, { esquina: true })).toBe(false)
  })
})

describe('resolverParametro — sin reglas aplicables', () => {
  it('NOT_AVAILABLE cuando ninguna regla coincide con el parámetro o el contexto', () => {
    const r = resolverParametro('CUS', [], {})
    expect(r.status).toBe('NOT_AVAILABLE')
    expect(r.value).toBeNull()
  })

  it('NOT_AVAILABLE cuando las condiciones de la única regla no se cumplen', () => {
    const reglas = [regla({ conditions: [{ field: 'frontage', operator: 'GT', value: 100 }] })]
    const r = resolverParametro('CUS', reglas, { frontage: 10 })
    expect(r.status).toBe('NOT_AVAILABLE')
  })
})

describe('resolverParametro — regla única aplicable', () => {
  it('DOCUMENTED con trazabilidad completa (§13, §78)', () => {
    const reglas = [regla({ article: 'Art. 45' })]
    const r = resolverParametro('CUS', reglas, {})
    expect(r.status).toBe('DOCUMENTED')
    expect(r.value).toBe(3)
    expect(r.unit).toBe('ratio')
    expect(r.source).toBe('E3')
    expect(r.article).toBe('Art. 45')
    expect(r.instrument).toBe('Plan de Desarrollo Urbano Municipal 2030')
    expect(r.confidence).toBe(0.98)
  })
})

describe('resolverParametro — varias reglas aplicables', () => {
  it('mismo valor desde dos fuentes: corrobora y reporta la de mayor confianza', () => {
    const reglas = [
      regla({ source: 'E3', confidence: 0.9, result: { value: 3, unit: 'ratio' } }),
      regla({ source: 'Reglamento Art. 45', confidence: 0.98, result: { value: 3, unit: 'ratio' } }),
    ]
    const r = resolverParametro('CUS', reglas, {})
    expect(r.status).toBe('DOCUMENTED')
    expect(r.value).toBe(3)
    expect(r.source).toBe('Reglamento Art. 45')
  })

  it('valores distintos: CONFLICT, nunca elige en silencio (§12)', () => {
    const reglas = [
      regla({ source: 'E3', result: { value: 3 } }),
      regla({ source: 'Programa Parcial', result: { value: 2.4 } }),
    ]
    const r = resolverParametro('CUS', reglas, {})
    expect(r.status).toBe('CONFLICT')
    expect(r.value).toBeNull()
    expect(r.reglasEnConflicto).toHaveLength(2)
  })

  it('solo se comparan las reglas cuyas condiciones se cumplen — una regla condicionada que no aplica no genera conflicto', () => {
    const reglas = [
      regla({ source: 'E3', result: { value: 3 }, conditions: [] }),
      regla({ source: 'Programa Parcial', result: { value: 2.4 }, conditions: [{ field: 'frontage', operator: 'GT', value: 100 }] }),
    ]
    const r = resolverParametro('CUS', reglas, { frontage: 10 })
    expect(r.status).toBe('DOCUMENTED')
    expect(r.value).toBe(3)
  })
})
