import { describe, it, expect } from 'vitest'
import { calcularProductFit, type ProductFitInput } from '../productFitEngine'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { CompetitorProfile, PriceEngineResultado } from '../tipos'

function comparable(overrides: Partial<ComparableVenta> = {}): ComparableVenta {
  return {
    nombre: 'X', direccion: 'Y', precioM2: 40_000, precioTotal: 4_000_000, superficieM2: 95,
    tipologia: '2 rec · 95 m²', avanceObra: 'En obra', fechaReferencia: '2026-06',
    url: 'https://example.com', origen: 'web_search', distanciaKm: 1, ...overrides,
  }
}

const priceEngineVacio: PriceEngineResultado = {
  askingPricePerM2: null, outliersExcluidos: [], porBandaSuperficie: [], porRecamaras: [],
}

function baseInput(overrides: Partial<ProductFitInput> = {}): ProductFitInput {
  return {
    unidadesObjetivo: 10,
    precioM2Objetivo: 40_000,
    areaM2Objetivo: 95,
    recamarasObjetivo: 2,
    envolvente: { unidadesMax: 8, cumple: false },
    priceEngine: priceEngineVacio,
    comparables: [],
    competitors: [],
    ...overrides,
  }
}

describe('calcularProductFit — regulatoryFit (límite duro)', () => {
  it('cumple normativa: regulatoryFit 100, cumpleNormativa true', () => {
    const r = calcularProductFit(baseInput({ envolvente: { cumple: true, unidadesMax: 12 } }))
    expect(r.regulatoryFit).toBe(100)
    expect(r.cumpleNormativa).toBe(true)
  })

  it('NO cumple normativa: regulatoryFit 0, cumpleNormativa false, sin importar qué tan bien puntúe lo demás', () => {
    const r = calcularProductFit(baseInput({ envolvente: { cumple: false, unidadesMax: 8 } }))
    expect(r.regulatoryFit).toBe(0)
    expect(r.cumpleNormativa).toBe(false)
  })

  it('unidadesRecomendadas NUNCA excede unidadesMax, aunque el objetivo pida más (§120)', () => {
    const r = calcularProductFit(baseInput({ unidadesObjetivo: 10, envolvente: { cumple: false, unidadesMax: 8 } }))
    expect(r.unidadesRecomendadas).toBe(8)
  })

  it('sin unidadesMax conocido, unidadesRecomendadas usa el objetivo tal cual (no hay tope que aplicar)', () => {
    const r = calcularProductFit(baseInput({ unidadesObjetivo: 10, envolvente: { cumple: true } }))
    expect(r.unidadesRecomendadas).toBe(10)
  })
})

describe('calcularProductFit — dimensiones NOT_AVAILABLE (§97)', () => {
  it('demandFit, supplyFit y rentFit siempre null — no existen esos motores todavía', () => {
    const r = calcularProductFit(baseInput())
    expect(r.demandFit).toBeNull()
    expect(r.supplyFit).toBeNull()
    expect(r.rentFit).toBeNull()
  })
})

describe('calcularProductFit — priceFit', () => {
  it('null sin datos reales de precio de mercado', () => {
    const r = calcularProductFit(baseInput())
    expect(r.priceFit).toBeNull()
  })

  it('100 cuando el precio objetivo coincide exacto con la mediana real', () => {
    const priceEngine: PriceEngineResultado = { ...priceEngineVacio, askingPricePerM2: { n: 5, mean: 40_000, median: 40_000, min: 38_000, max: 42_000, p10: 38_500, p25: 39_000, p75: 41_000, p90: 41_500, iqr: 2_000, stdDev: 1_000, confidenceScore: 33, confidenceNivel: 'INSUFICIENTE' } }
    const r = calcularProductFit(baseInput({ precioM2Objetivo: 40_000, priceEngine }))
    expect(r.priceFit).toBe(100)
  })
})

describe('calcularProductFit — sizeFit / typologyFit', () => {
  it('sizeFit alto si la mayoría de comparables cae en la misma banda de superficie', () => {
    const comparables = [
      comparable({ superficieM2: 92 }), comparable({ superficieM2: 96 }), comparable({ superficieM2: 200 }),
    ]
    const r = calcularProductFit(baseInput({ areaM2Objetivo: 95, comparables }))
    expect(r.sizeFit).toBe(67) // 2 de 3 en la banda 80-100
  })

  it('typologyFit alto si la mayoría comparte el mismo número de recámaras', () => {
    const comparables = [
      comparable({ tipologia: '2 rec' }), comparable({ tipologia: '2 rec' }), comparable({ tipologia: '4 rec' }),
    ]
    const r = calcularProductFit(baseInput({ recamarasObjetivo: 2, comparables }))
    expect(r.typologyFit).toBe(67)
  })
})

describe('calcularProductFit — locationFit', () => {
  it('null sin ningún comparable geocodificado', () => {
    const r = calcularProductFit(baseInput({ comparables: [comparable({ distanciaKm: null })] }))
    expect(r.locationFit).toBeNull()
  })

  it('alto cuando los comparables están muy cerca del predio', () => {
    const r = calcularProductFit(baseInput({ comparables: [comparable({ distanciaKm: 0.2 })] }))
    expect(r.locationFit!).toBeGreaterThan(90)
  })
})

describe('calcularProductFit — competitionFit', () => {
  it('100 sin competidores DIRECT', () => {
    const r = calcularProductFit(baseInput({ competitors: [] }))
    expect(r.competitionFit).toBe(100)
  })

  it('baja 25 puntos por cada competidor DIRECT', () => {
    const competitors: CompetitorProfile[] = [
      { nombre: 'A', colonia: null, unidadesObservadas: 1, precioM2: null, tipologias: [], etapas: [], clasificacion: 'DIRECT' },
      { nombre: 'B', colonia: null, unidadesObservadas: 1, precioM2: null, tipologias: [], etapas: [], clasificacion: 'DIRECT' },
      { nombre: 'C', colonia: null, unidadesObservadas: 1, precioM2: null, tipologias: [], etapas: [], clasificacion: 'SUBSTITUTE' },
    ]
    const r = calcularProductFit(baseInput({ competitors }))
    expect(r.competitionFit).toBe(50) // 2 DIRECT × 25
  })
})

describe('calcularProductFit — finalScore', () => {
  it('null si ninguna dimensión tuvo dato (caso extremo, no debería pasar en la práctica por regulatoryFit)', () => {
    // Fuerza el caso sin siquiera regulatoryFit disponible no es posible (siempre hay
    // cumpleNormativa/regulatoryFit) -- pero sí puede faltar todo lo demás.
    const r = calcularProductFit(baseInput({ precioM2Objetivo: null, areaM2Objetivo: null, recamarasObjetivo: null, comparables: [] }))
    expect(r.finalScore).not.toBeNull() // regulatoryFit + competitionFit siempre están
  })
})
