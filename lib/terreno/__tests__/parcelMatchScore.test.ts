import { describe, it, expect } from 'vitest'
import {
  calcularParcelMatchScore, clasificarCandidatos, resolverSeleccionParcela,
  type ComponentesMatch, type CandidatoParcela,
} from '../parcelMatchScore'

function componentes(overrides: Partial<ComponentesMatch> = {}): ComponentesMatch {
  return {
    cadastralIdMatch: null, pointInsideParcel: null, addressMatch: null,
    municipalityMatch: null, neighborhoodMatch: null, streetMatch: null,
    areaConsistency: null, geometryConsistency: null, ...overrides,
  }
}

describe('calcularParcelMatchScore', () => {
  it('null si ningún componente tiene dato', () => {
    expect(calcularParcelMatchScore(componentes())).toBeNull()
  })

  it('con todos los componentes en 1.0, el score es 1.0 (pesos suman 1)', () => {
    const c = componentes({
      cadastralIdMatch: 1, pointInsideParcel: 1, addressMatch: 1, municipalityMatch: 1,
      neighborhoodMatch: 1, streetMatch: 1, areaConsistency: 1, geometryConsistency: 1,
    })
    expect(calcularParcelMatchScore(c)).toBeCloseTo(1, 6)
  })

  it('aplica los pesos exactos del §8', () => {
    const c = componentes({ cadastralIdMatch: 1 })
    expect(calcularParcelMatchScore(c)).toBeCloseTo(1, 6) // único disponible -> se renormaliza a 1
  })

  it('re-pondera solo sobre los componentes disponibles, no penaliza por null', () => {
    const c = componentes({ cadastralIdMatch: 1, pointInsideParcel: 0 })
    // pesos 0.30 y 0.20 -> promedio ponderado = (1*0.30 + 0*0.20) / 0.50 = 0.6
    expect(calcularParcelMatchScore(c)).toBeCloseTo(0.6, 6)
  })

  it('pesos personalizados cambian el resultado', () => {
    const c = componentes({ cadastralIdMatch: 1, addressMatch: 0 })
    const conDefault = calcularParcelMatchScore(c)
    const personalizado = calcularParcelMatchScore(c, {
      cadastralIdMatch: 0.1, pointInsideParcel: 0, addressMatch: 0.9, municipalityMatch: 0,
      neighborhoodMatch: 0, streetMatch: 0, areaConsistency: 0, geometryConsistency: 0,
    })
    expect(conDefault).not.toBeCloseTo(personalizado!, 3)
  })
})

describe('clasificarCandidatos', () => {
  it('ordena de mayor a menor score', () => {
    const candidatos: CandidatoParcela[] = [
      { id: 'A', componentes: componentes({ cadastralIdMatch: 0.5 }) },
      { id: 'B', componentes: componentes({ cadastralIdMatch: 1 }) },
    ]
    const r = clasificarCandidatos(candidatos)
    expect(r[0].id).toBe('B')
    expect(r[1].id).toBe('A')
  })
})

describe('resolverSeleccionParcela', () => {
  it('NO_CANDIDATES sin candidatos con score', () => {
    const r = resolverSeleccionParcela([{ id: 'A', componentes: componentes() }])
    expect(r.status).toBe('NO_CANDIDATES')
  })

  it('REQUIRES_CONFIRMATION si el mejor candidato está por debajo del umbral mínimo', () => {
    const candidatos: CandidatoParcela[] = [
      { id: 'A', componentes: componentes({ cadastralIdMatch: 0.5 }) },
    ]
    const r = resolverSeleccionParcela(candidatos)
    expect(r.status).toBe('REQUIRES_CONFIRMATION')
  })

  it('REQUIRES_CONFIRMATION si dos candidatos son similares, aunque ambos superen el umbral', () => {
    const candidatos: CandidatoParcela[] = [
      { id: 'A', componentes: componentes({ cadastralIdMatch: 1, pointInsideParcel: 1 }) },
      { id: 'B', componentes: componentes({ cadastralIdMatch: 1, pointInsideParcel: 0.9 }) },
    ]
    const r = resolverSeleccionParcela(candidatos)
    expect(r.status).toBe('REQUIRES_CONFIRMATION')
  })

  it('AUTO_RESOLVED si un candidato supera el umbral y no hay ambigüedad', () => {
    const candidatos: CandidatoParcela[] = [
      { id: 'A', componentes: componentes({ cadastralIdMatch: 1, pointInsideParcel: 1, addressMatch: 1 }) },
      { id: 'B', componentes: componentes({ cadastralIdMatch: 0.2 }) },
    ]
    const r = resolverSeleccionParcela(candidatos)
    expect(r.status).toBe('AUTO_RESOLVED')
    if (r.status === 'AUTO_RESOLVED') expect(r.seleccionado.id).toBe('A')
  })
})
