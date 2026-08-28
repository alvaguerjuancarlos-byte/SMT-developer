import { describe, it, expect } from 'vitest'
import { analizarLimitantes, type FactorLimitante } from '../constraintAnalyzer'

describe('analizarLimitantes', () => {
  it('ejemplo del §44: 1,299 m² teórico -> 1,080 m² operativo con limitantes que suman 219', () => {
    const factores: FactorLimitante[] = [
      { concepto: 'Remetimientos', impactoM2: 90, esEstimacion: false },
      { concepto: 'CAAV', impactoM2: 60, esEstimacion: false },
      { concepto: 'Alineamiento vial', impactoM2: 40, esEstimacion: true },
      { concepto: 'Estacionamiento', impactoM2: 29, esEstimacion: true },
    ]
    const r = analizarLimitantes(1299, factores)
    expect(r.impactoTotalM2).toBe(219)
    expect(r.potencialOperativoEstimadoM2).toBe(1080)
  })

  it('ordena los limitantes de mayor a menor impacto', () => {
    const factores: FactorLimitante[] = [
      { concepto: 'Altura', impactoM2: 10, esEstimacion: true },
      { concepto: 'CAAV', impactoM2: 60, esEstimacion: false },
      { concepto: 'Densidad', impactoM2: 30, esEstimacion: false },
    ]
    const r = analizarLimitantes(1000, factores)
    expect(r.limitantes.map(f => f.concepto)).toEqual(['CAAV', 'Densidad', 'Altura'])
  })

  it('sin limitantes, el potencial operativo iguala al teórico', () => {
    const r = analizarLimitantes(500, [])
    expect(r.impactoTotalM2).toBe(0)
    expect(r.potencialOperativoEstimadoM2).toBe(500)
  })

  it('nunca resulta negativo aunque los limitantes excedan el potencial teórico', () => {
    const factores: FactorLimitante[] = [{ concepto: 'Geometría', impactoM2: 999, esEstimacion: true }]
    const r = analizarLimitantes(500, factores)
    expect(r.potencialOperativoEstimadoM2).toBe(0)
  })

  it('preserva esEstimacion de cada factor (§44: nunca mezclar calculado y estimado sin distinguir)', () => {
    const factores: FactorLimitante[] = [
      { concepto: 'Remetimientos', impactoM2: 10, esEstimacion: false },
      { concepto: 'Alineamiento vial', impactoM2: 20, esEstimacion: true },
    ]
    const r = analizarLimitantes(100, factores)
    expect(r.limitantes.find(f => f.concepto === 'Remetimientos')?.esEstimacion).toBe(false)
    expect(r.limitantes.find(f => f.concepto === 'Alineamiento vial')?.esEstimacion).toBe(true)
  })
})
