import { describe, it, expect } from 'vitest'
import {
  bandaSuperficie,
  calcularEstadisticasRobustas,
  detectarOutliersIQR,
  calcularDistribucionPorBanda,
  calcularDistribucionPorRecamaras,
  calcularPriceEngine,
} from '../priceEngine'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'

function comparable(overrides: Partial<ComparableVenta> = {}): ComparableVenta {
  return {
    nombre: 'X', direccion: 'Y', precioM2: 40_000, precioTotal: 4_000_000, superficieM2: 100,
    tipologia: '2 rec · 100 m²', avanceObra: 'En obra', fechaReferencia: '2026-06',
    url: 'https://example.com', origen: 'web_search', ...overrides,
  }
}

describe('bandaSuperficie', () => {
  it('clasifica en las 8 bandas del spec, límite superior exclusivo', () => {
    expect(bandaSuperficie(45)).toBe('<60 m²')
    expect(bandaSuperficie(60)).toBe('60-80 m²')
    expect(bandaSuperficie(79.9)).toBe('60-80 m²')
    expect(bandaSuperficie(100)).toBe('100-120 m²')
    expect(bandaSuperficie(350)).toBe('300+ m²')
  })
})

describe('calcularEstadisticasRobustas', () => {
  it('null (NOT_ENOUGH_DATA) con arreglo vacío, nunca un 0 falso', () => {
    expect(calcularEstadisticasRobustas([])).toBeNull()
  })

  it('con un solo valor, todos los percentiles son ese mismo valor', () => {
    const s = calcularEstadisticasRobustas([50_000])!
    expect(s.n).toBe(1)
    expect(s.median).toBe(50_000)
    expect(s.p10).toBe(50_000)
    expect(s.p90).toBe(50_000)
    expect(s.stdDev).toBe(0)
  })

  it('mediana de un set par es el promedio de los dos centrales', () => {
    const s = calcularEstadisticasRobustas([10, 20, 30, 40])!
    expect(s.median).toBe(25)
    expect(s.min).toBe(10)
    expect(s.max).toBe(40)
  })

  it('con menos de 15 muestras nunca llega a confianza ALTA (límite real del pipeline)', () => {
    const s = calcularEstadisticasRobustas(new Array(8).fill(40_000))!
    expect(s.confidenceNivel).not.toBe('ALTA')
    expect(s.confidenceScore).toBeLessThan(95)
  })

  it('con 15+ muestras sí alcanza confianza ALTA', () => {
    const s = calcularEstadisticasRobustas(new Array(15).fill(40_000))!
    expect(s.confidenceNivel).toBe('ALTA')
  })
})

describe('detectarOutliersIQR', () => {
  it('con menos de 4 valores, todos se consideran limpios (no hay cuartiles confiables)', () => {
    const r = detectarOutliersIQR([10, 20, 1000])
    expect(r.limpios).toEqual([10, 20, 1000])
    expect(r.outliers).toEqual([])
  })

  it('detecta un valor claramente fuera de rango en un set homogéneo', () => {
    const r = detectarOutliersIQR([38_000, 39_000, 40_000, 41_000, 42_000, 150_000])
    expect(r.outliers).toContain(150_000)
    expect(r.limpios).not.toContain(150_000)
    expect(r.limpios).toHaveLength(5)
  })

  it('no marca nada si todos los valores son razonablemente homogéneos', () => {
    const r = detectarOutliersIQR([38_000, 39_000, 40_000, 41_000, 42_000])
    expect(r.outliers).toHaveLength(0)
  })
})

describe('calcularDistribucionPorBanda / calcularDistribucionPorRecamaras', () => {
  it('agrupa por banda de superficie correctamente', () => {
    const comparables = [
      comparable({ superficieM2: 55, precioM2: 50_000 }),
      comparable({ superficieM2: 58, precioM2: 52_000 }),
      comparable({ superficieM2: 110, precioM2: 40_000 }),
    ]
    const dist = calcularDistribucionPorBanda(comparables)
    const bandaChica = dist.find((d) => d.clave === '<60 m²')
    expect(bandaChica?.estadisticas?.n).toBe(2)
    const bandaGrande = dist.find((d) => d.clave === '100-120 m²')
    expect(bandaGrande?.estadisticas?.n).toBe(1)
  })

  it('ignora comparables sin superficie/tipología parseable, sin tronar', () => {
    const comparables = [comparable({ superficieM2: null }), comparable({ tipologia: 'Local comercial' })]
    expect(() => calcularDistribucionPorBanda(comparables)).not.toThrow()
    expect(() => calcularDistribucionPorRecamaras(comparables)).not.toThrow()
  })

  it('agrupa por número de recámaras', () => {
    const comparables = [
      comparable({ tipologia: '2 rec · 90 m²', precioM2: 40_000 }),
      comparable({ tipologia: '3 rec · 120 m²', precioM2: 38_000 }),
    ]
    const dist = calcularDistribucionPorRecamaras(comparables)
    expect(dist.map((d) => d.clave).sort()).toEqual(['2 rec', '3 rec'])
  })
})

describe('calcularPriceEngine', () => {
  it('devuelve askingPricePerM2, outliers y ambas distribuciones', () => {
    const comparables = [
      comparable({ precioM2: 40_000, superficieM2: 90, tipologia: '2 rec · 90 m²' }),
      comparable({ precioM2: 41_000, superficieM2: 92, tipologia: '2 rec · 92 m²' }),
      comparable({ precioM2: 39_000, superficieM2: 88, tipologia: '2 rec · 88 m²' }),
    ]
    const r = calcularPriceEngine(comparables)
    expect(r.askingPricePerM2?.n).toBe(3)
    expect(r.porBandaSuperficie.length).toBeGreaterThan(0)
    expect(r.porRecamaras.length).toBeGreaterThan(0)
  })

  it('con arreglo vacío no truena — askingPricePerM2 null, distribuciones vacías', () => {
    const r = calcularPriceEngine([])
    expect(r.askingPricePerM2).toBeNull()
    expect(r.porBandaSuperficie).toEqual([])
    expect(r.porRecamaras).toEqual([])
  })
})
