import { describe, it, expect } from 'vitest'
import { validarIndirectos, escalarCostoPorMix } from '../validacionFinanciera'

const COSTO_TOTAL_CONSTRUCCION = 100_000_000

describe('validarIndirectos', () => {
  it('indirectos 16.5%, honorarios 9%, imprevistos 5%: todos dentro de rango', () => {
    const r = validarIndirectos(16_500_000, 9_000_000, 5_000_000, COSTO_TOTAL_CONSTRUCCION)
    expect(r.indirectosPct).toBe(16.5)
    expect(r.honorariosPct).toBe(9)
    expect(r.imprevistosPct).toBe(5)
    expect(r.indirectosFueraDeRango).toBe(false)
    expect(r.honorariosFueraDeRango).toBe(false)
    expect(r.imprevistosFueraDeRango).toBe(false)
  })

  it('indirectos por debajo de 15%: fueraDeRango = true', () => {
    const r = validarIndirectos(10_000_000, 9_000_000, 5_000_000, COSTO_TOTAL_CONSTRUCCION)
    expect(r.indirectosPct).toBe(10)
    expect(r.indirectosFueraDeRango).toBe(true)
  })

  it('indirectos muy por encima de 18% (obra implícita mayor a la aprobada): fueraDeRango = true', () => {
    // Caso real reportado: indirectos calculados como si la obra fuera ~$70-100M cuando el
    // ancla aprobada es más chica — se refleja como un % fuera del rango 15-18% esperado.
    const r = validarIndirectos(25_000_000, 9_000_000, 5_000_000, COSTO_TOTAL_CONSTRUCCION)
    expect(r.indirectosPct).toBe(25)
    expect(r.indirectosFueraDeRango).toBe(true)
  })

  it('honorarios por encima de 10%: fueraDeRango = true', () => {
    const r = validarIndirectos(16_500_000, 12_000_000, 5_000_000, COSTO_TOTAL_CONSTRUCCION)
    expect(r.honorariosPct).toBe(12)
    expect(r.honorariosFueraDeRango).toBe(true)
  })

  it('imprevistos fuera de la tolerancia de ±1.5 pts alrededor de 5%: fueraDeRango = true', () => {
    const r = validarIndirectos(16_500_000, 9_000_000, 8_000_000, COSTO_TOTAL_CONSTRUCCION)
    expect(r.imprevistosPct).toBe(8)
    expect(r.imprevistosFueraDeRango).toBe(true)
  })

  it('imprevistos dentro de la tolerancia (6.4%, dentro de ±1.5 de 5%): no marca fuera de rango', () => {
    const r = validarIndirectos(16_500_000, 9_000_000, 6_400_000, COSTO_TOTAL_CONSTRUCCION)
    expect(r.imprevistosPct).toBe(6.4)
    expect(r.imprevistosFueraDeRango).toBe(false)
  })

  it('bordes exactos de indirectos (15% y 18%): no marcan fuera de rango', () => {
    const bajo = validarIndirectos(15_000_000, 9_000_000, 5_000_000, COSTO_TOTAL_CONSTRUCCION)
    const alto = validarIndirectos(18_000_000, 9_000_000, 5_000_000, COSTO_TOTAL_CONSTRUCCION)
    expect(bajo.indirectosFueraDeRango).toBe(false)
    expect(alto.indirectosFueraDeRango).toBe(false)
  })

  it('costoTotalConstruccion = 0: no divide entre cero, porcentajes en 0', () => {
    const r = validarIndirectos(1_000, 500, 200, 0)
    expect(r.indirectosPct).toBe(0)
    expect(r.honorariosPct).toBe(0)
    expect(r.imprevistosPct).toBe(0)
  })
})

describe('escalarCostoPorMix', () => {
  it('el mix aprovecha el 100% del área vendible construida: sin escalar', () => {
    const r = escalarCostoPorMix(100_000_000, 8_700, 8_700)
    expect(r.eficienciaMixPct).toBe(100)
    expect(r.factorEscalaMix).toBe(1)
    expect(r.costoTotalConstruccionEscalado).toBe(100_000_000)
    expect(r.eficienciaBaja).toBe(false)
  })

  it('el mix aprovecha más del 100% (excede el área vendible construida): factor topado en 1, no escala hacia arriba', () => {
    const r = escalarCostoPorMix(100_000_000, 9_500, 8_700)
    expect(r.eficienciaMixPct).toBeGreaterThan(100)
    expect(r.factorEscalaMix).toBe(1)
    expect(r.costoTotalConstruccionEscalado).toBe(100_000_000)
  })

  it('caso real "torre granja 4": mix 3,348 m² sobre 8,701 m² construidos, costo $100,170,000', () => {
    const r = escalarCostoPorMix(100_170_000, 3_348, 8_701)
    expect(r.eficienciaMixPct).toBeCloseTo(38.5, 1)
    expect(r.factorEscalaMix).toBeCloseTo(0.385, 2)
    expect(r.costoTotalConstruccionEscalado).toBe(Math.round(100_170_000 * 0.385))
    expect(r.eficienciaBaja).toBe(true)
    expect(r.costoTotalConstruccionOriginal).toBe(100_170_000)
  })

  it('eficienciaBaja = true justo debajo de 85%, false justo en 85% o arriba', () => {
    const debajo = escalarCostoPorMix(100_000_000, 8_490, 10_000) // 84.9%
    const enUmbral = escalarCostoPorMix(100_000_000, 8_500, 10_000) // 85%
    expect(debajo.eficienciaBaja).toBe(true)
    expect(enUmbral.eficienciaBaja).toBe(false)
  })

  it('superficieVendibleConstruccion = 0: no divide entre cero, eficiencia 100% por defecto', () => {
    const r = escalarCostoPorMix(50_000_000, 3_000, 0)
    expect(r.eficienciaMixPct).toBe(100)
    expect(r.factorEscalaMix).toBe(1)
    expect(r.costoTotalConstruccionEscalado).toBe(50_000_000)
  })
})
