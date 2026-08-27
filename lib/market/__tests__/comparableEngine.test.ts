import { describe, it, expect } from 'vitest'
import { calcularComparableScore, clasificarComparable, construirComparablesConScore, parsearRecamaras, PESOS_BASE_DEFAULT } from '../comparableEngine'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { ObjetivoComparable } from '../tipos'

function comparable(overrides: Partial<ComparableVenta> = {}): ComparableVenta {
  return {
    nombre: 'Torre X',
    direccion: 'Calle Falsa 123',
    precioM2: 42_000,
    precioTotal: 3_990_000,
    superficieM2: 95,
    tipologia: '2 rec · 95 m²',
    avanceObra: 'En obra',
    fechaReferencia: '2026-06',
    url: 'https://example.com',
    origen: 'web_search',
    distanciaKm: 0.8,
    ...overrides,
  }
}

const objetivo: ObjetivoComparable = {
  precioM2Objetivo: 42_000,
  areaM2Objetivo: 95,
  recamarasObjetivo: 2,
}

describe('parsearRecamaras', () => {
  it('extrae el número antes de "rec"', () => {
    expect(parsearRecamaras('2 rec · 95 m²')).toBe(2)
    expect(parsearRecamaras('3 recámaras')).toBe(3)
  })

  it('null si no hay patrón reconocible', () => {
    expect(parsearRecamaras('Local comercial 80 m²')).toBeNull()
    expect(parsearRecamaras(null)).toBeNull()
  })
})

describe('calcularComparableScore — caso ideal (match perfecto en las 4 dimensiones)', () => {
  const score = calcularComparableScore(comparable(), objetivo)

  it('las 4 dimensiones calculables dan 100 (match exacto)', () => {
    expect(score.locationSimilarity).toBeGreaterThan(80) // 0.8km sobre radio de 5km, no es 0km exacto
    expect(score.typologySimilarity).toBe(100)
    expect(score.areaSimilarity).toBe(100)
    expect(score.priceSimilarity).toBe(100)
  })

  it('las 4 dimensiones sin fuente real quedan explícitamente null, no inventadas', () => {
    expect(score.ageSimilarity).toBeNull()
    expect(score.amenitySimilarity).toBeNull()
    expect(score.developerSimilarity).toBeNull()
    expect(score.stageSimilarity).toBeNull()
  })

  it('dimensionesDisponibles = 4 y los pesos suman ~1', () => {
    expect(score.dimensionesDisponibles).toBe(4)
    const sumaPesos = Object.values(score.weights).reduce((s, w) => s + (w ?? 0), 0)
    expect(sumaPesos).toBeCloseTo(1, 2)
  })

  it('finalScore alto (>90) cuando todo coincide bien', () => {
    expect(score.finalScore).toBeGreaterThan(90)
  })
})

describe('calcularComparableScore — degradación por falta de datos', () => {
  it('sin distanciaKm, locationSimilarity es null y su peso se redistribuye entre las otras 3', () => {
    const score = calcularComparableScore(comparable({ distanciaKm: null }), objetivo)
    expect(score.locationSimilarity).toBeNull()
    expect(score.dimensionesDisponibles).toBe(3)
    expect(score.weights.location).toBeUndefined()
    const sumaPesos = Object.values(score.weights).reduce((s, w) => s + (w ?? 0), 0)
    expect(sumaPesos).toBeCloseTo(1, 2)
  })

  it('objetivo vacío deja disponible solo location (depende del comparable, no del objetivo)', () => {
    const score = calcularComparableScore(comparable(), {})
    expect(score.dimensionesDisponibles).toBe(1)
    expect(score.locationSimilarity).not.toBeNull()
    expect(score.typologySimilarity).toBeNull()
    expect(score.areaSimilarity).toBeNull()
    expect(score.priceSimilarity).toBeNull()
  })

  it('sin ningún dato ni del comparable ni del objetivo, todas las dimensiones son null y finalScore es null (no 0)', () => {
    const score = calcularComparableScore(comparable({ distanciaKm: null, precioM2: null, precioTotal: null, superficieM2: null, tipologia: null }), {})
    expect(score.dimensionesDisponibles).toBe(0)
    expect(score.finalScore).toBeNull()
  })

  it('tipología no parseable ("Local comercial") deja typologySimilarity en null sin tronar', () => {
    const score = calcularComparableScore(comparable({ tipologia: 'Local comercial 80 m²' }), objetivo)
    expect(score.typologySimilarity).toBeNull()
  })
})

describe('calcularComparableScore — similitud por diferencia relativa', () => {
  it('precio 50% más alto que el objetivo da priceSimilarity de ~50, no 100 ni 0', () => {
    const score = calcularComparableScore(comparable({ precioM2: 63_000 }), objetivo)
    expect(score.priceSimilarity).toBe(50)
  })

  it('1 recámara de diferencia da 60, 2+ de diferencia da 20 (escalón, no lineal)', () => {
    const unaDiferencia = calcularComparableScore(comparable({ tipologia: '3 rec · 95 m²' }), objetivo)
    const dosDiferencias = calcularComparableScore(comparable({ tipologia: '4 rec · 95 m²' }), objetivo)
    expect(unaDiferencia.typologySimilarity).toBe(60)
    expect(dosDiferencias.typologySimilarity).toBe(20)
  })
})

describe('calcularComparableScore — pesos configurables (Opción 2)', () => {
  it('sin pesos explícitos, usa PESOS_BASE_DEFAULT', () => {
    const conDefault = calcularComparableScore(comparable(), objetivo)
    const explicito = calcularComparableScore(comparable(), objetivo, PESOS_BASE_DEFAULT)
    expect(conDefault).toEqual(explicito)
  })

  it('pesos personalizados cambian finalScore de verdad, no solo la etiqueta', () => {
    // Predio a 4km (locationSimilarity bajo) pero precio/área/tipología perfectos.
    const candidato = comparable({ distanciaKm: 4 })
    const pesandoUbicacion = calcularComparableScore(candidato, objetivo, { location: 0.9, price: 0.1 / 3, area: 0.1 / 3, typology: 0.1 / 3 })
    const ignorandoUbicacion = calcularComparableScore(candidato, objetivo, { location: 0, price: 1 / 3, area: 1 / 3, typology: 1 / 3 })
    expect(pesandoUbicacion.finalScore!).toBeLessThan(ignorandoUbicacion.finalScore!)
  })

  it('no truena si el peso de las dimensiones disponibles suma 0', () => {
    const score = calcularComparableScore(comparable(), objetivo, { location: 0, price: 0, area: 0, typology: 0 })
    expect(score.finalScore).toBeNull()
  })
})

describe('clasificarComparable', () => {
  it('DIRECT si está a 1.5km o menos', () => {
    expect(clasificarComparable(comparable({ distanciaKm: 1.2 }), objetivo)).toBe('DIRECT')
  })

  it('ASPIRATIONAL si el precio supera el objetivo por más del 20%', () => {
    expect(clasificarComparable(comparable({ precioM2: 55_000, distanciaKm: 3 }), objetivo)).toBe('ASPIRATIONAL')
  })

  it('FLOOR si el precio está por debajo del objetivo por más del 20%', () => {
    expect(clasificarComparable(comparable({ precioM2: 30_000, distanciaKm: 3 }), objetivo)).toBe('FLOOR')
  })

  it('SUBSTITUTE si no es DIRECT ni se desvía de precio lo suficiente', () => {
    expect(clasificarComparable(comparable({ precioM2: 44_000, distanciaKm: 3 }), objetivo)).toBe('SUBSTITUTE')
  })

  it('SUBSTITUTE (no DIRECT) si no hay distanciaKm conocida, aunque el precio coincida', () => {
    expect(clasificarComparable(comparable({ distanciaKm: null }), objetivo)).toBe('SUBSTITUTE')
  })
})

describe('construirComparablesConScore', () => {
  it('ordena de mayor a menor finalScore', () => {
    const candidatos = [
      comparable({ nombre: 'Lejano', distanciaKm: 4.5, precioM2: 30_000 }),
      comparable({ nombre: 'Ideal', distanciaKm: 0.3 }),
      comparable({ nombre: 'Medio', distanciaKm: 2, precioM2: 50_000 }),
    ]
    const resultado = construirComparablesConScore(candidatos, objetivo)
    expect(resultado.map(r => r.comparable.nombre)).toEqual(['Ideal', 'Medio', 'Lejano'])
  })

  it('un comparable sin ningún dato propio (precio/superficie/tipología/distancia) queda al final, no se descarta', () => {
    const candidatos = [comparable({ nombre: 'Sin datos', distanciaKm: null, precioM2: null, precioTotal: null, superficieM2: null, tipologia: null })]
    const resultado = construirComparablesConScore(candidatos, objetivo)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].score.finalScore).toBeNull()
  })
})
