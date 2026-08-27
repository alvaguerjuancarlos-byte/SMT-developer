import { describe, it, expect } from 'vitest'
import { calcularOpportunityScore, PESOS_OPORTUNIDAD_DEFAULT, type OpportunityInput } from '../opportunityEngine'
import type { ProductFitScore, ResultadoPlusvalia } from '../tipos'

function productFit(overrides: Partial<ProductFitScore> = {}): ProductFitScore {
  return {
    demandFit: null, competitionFit: 75, priceFit: 80, sizeFit: 70, typologyFit: 90,
    locationFit: 85, regulatoryFit: 100, supplyFit: null, rentFit: null,
    cumpleNormativa: true, unidadesRecomendadas: 10, finalScore: 85, ...overrides,
  }
}

function plusvalia(tasaAnualizada: number | null): ResultadoPlusvalia {
  return { ventana: 'anual', tasaAnualizada, periodoInicio: '2025-08', periodoFin: '2026-08', muestraInicio: 3, muestraFin: 5 }
}

const inputCompleto: OpportunityInput = {
  appreciationAnual: plusvalia(8),
  productFit: productFit(),
  priceConfidenceScore: 60,
}

describe('calcularOpportunityScore — componentes NOT_AVAILABLE', () => {
  it('demand/inventory/absorption/pipeline/rent/yield/market_gap siempre null (§97)', () => {
    const r = calcularOpportunityScore(inputCompleto)
    expect(r.components.demand).toBeNull()
    expect(r.components.inventory).toBeNull()
    expect(r.components.absorption).toBeNull()
    expect(r.components.pipeline).toBeNull()
    expect(r.components.rent).toBeNull()
    expect(r.components.yield).toBeNull()
    expect(r.components.market_gap).toBeNull()
  })
})

describe('calcularOpportunityScore — price_growth', () => {
  it('+10% anual da un score cercano a 100', () => {
    const r = calcularOpportunityScore({ ...inputCompleto, appreciationAnual: plusvalia(10) })
    expect(r.components.price_growth).toBe(100)
  })

  it('0% anual da 50 (neutral)', () => {
    const r = calcularOpportunityScore({ ...inputCompleto, appreciationAnual: plusvalia(0) })
    expect(r.components.price_growth).toBe(50)
  })

  it('-10% anual da un score cercano a 0', () => {
    const r = calcularOpportunityScore({ ...inputCompleto, appreciationAnual: plusvalia(-10) })
    expect(r.components.price_growth).toBe(0)
  })

  it('null si no hay plusvalía calculable (NOT_ENOUGH_DATA en Appreciation Engine)', () => {
    const r = calcularOpportunityScore({ ...inputCompleto, appreciationAnual: plusvalia(null) })
    expect(r.components.price_growth).toBeNull()
  })
})

describe('calcularOpportunityScore — propagación directa de otros motores', () => {
  it('competition viene de productFit.competitionFit', () => {
    const r = calcularOpportunityScore({ ...inputCompleto, productFit: productFit({ competitionFit: 50 }) })
    expect(r.components.competition).toBe(50)
  })

  it('product_fit viene de productFit.finalScore', () => {
    const r = calcularOpportunityScore({ ...inputCompleto, productFit: productFit({ finalScore: 42 }) })
    expect(r.components.product_fit).toBe(42)
  })

  it('data_quality viene directo de priceConfidenceScore', () => {
    const r = calcularOpportunityScore({ ...inputCompleto, priceConfidenceScore: 33 })
    expect(r.components.data_quality).toBe(33)
  })
})

describe('calcularOpportunityScore — pesos y finalScore', () => {
  it('con los 4 componentes disponibles, los pesos son iguales y suman 1', () => {
    const r = calcularOpportunityScore(inputCompleto)
    const suma = Object.values(r.weights).reduce((s, w) => s + (w ?? 0), 0)
    expect(suma).toBeCloseTo(1, 2)
    expect(Object.keys(r.weights)).toHaveLength(4)
  })

  it('sin ningún componente disponible, finalScore es null, no 0', () => {
    const r = calcularOpportunityScore({ appreciationAnual: null, productFit: null, priceConfidenceScore: null })
    expect(r.finalScore).toBeNull()
  })

  it('pesos personalizados cambian el finalScore de verdad', () => {
    const soloPrecio = calcularOpportunityScore(inputCompleto, { price_growth: 1, competition: 0, product_fit: 0, data_quality: 0 })
    const soloCompetencia = calcularOpportunityScore(inputCompleto, { price_growth: 0, competition: 1, product_fit: 0, data_quality: 0 })
    expect(soloPrecio.finalScore).not.toBe(soloCompetencia.finalScore)
  })

  it('usa PESOS_OPORTUNIDAD_DEFAULT si no se pasan pesos', () => {
    const conDefault = calcularOpportunityScore(inputCompleto)
    const explicito = calcularOpportunityScore(inputCompleto, PESOS_OPORTUNIDAD_DEFAULT)
    expect(conDefault).toEqual(explicito)
  })
})
