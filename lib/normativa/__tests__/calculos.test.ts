import { describe, it, expect } from 'vitest'
import { calcularDensidad, calcularAreaCAAV } from '../calculos'

describe('calcularDensidad', () => {
  it('m²/vivienda: ejemplo exacto del §20 (100 m²/vivienda, terreno 433 m²)', () => {
    const r = calcularDensidad(100, 'm2_por_vivienda', 433)
    expect(r.unidadesTeoricasRaw).toBeCloseTo(4.33, 6)
    expect(r.unidadesMax).toBe(4)
  })

  it('viviendas/ha: 150 viv/ha sobre 433 m² (0.0433 ha) = 6.495 unidades teóricas', () => {
    const r = calcularDensidad(150, 'viviendas_por_ha', 433)
    expect(r.unidadesTeoricasRaw).toBeCloseTo(6.495, 6)
    expect(r.unidadesMax).toBe(6)
  })

  it('nunca redondea hacia arriba, ni siquiera con .99', () => {
    const r = calcularDensidad(100, 'm2_por_vivienda', 499)
    expect(r.unidadesTeoricasRaw).toBeCloseTo(4.99, 6)
    expect(r.unidadesMax).toBe(4)
  })

  it('unidades teóricas exactas no pierden precisión por el floor', () => {
    const r = calcularDensidad(100, 'm2_por_vivienda', 400)
    expect(r.unidadesTeoricasRaw).toBe(4)
    expect(r.unidadesMax).toBe(4)
  })
})

describe('calcularAreaCAAV', () => {
  it('ejemplo exacto del §19 (433 m², CAAV 20%)', () => {
    const r = calcularAreaCAAV(433, 0.20)
    expect(r.areaMinimaM2).toBeCloseTo(86.6, 6)
    expect(r.porcentaje).toBe(0.20)
  })
})
