import { describe, it, expect } from 'vitest'
import { estimarPlusvaliaTramoAlto, BETA_TRAMO_ALTO_SOBRE_BAJO } from '../betaTramoEngine'
import { calcularBetaSHF } from '../shfAppreciationEngine'
import { SHF_NACIONAL_ECONOMICA_SOCIAL, SHF_NACIONAL_MEDIA_RESIDENCIAL } from '../shfIndice.data'

describe('BETA_TRAMO_ALTO_SOBRE_BAJO', () => {
  it('coincide con calcularBetaSHF sobre las series nacionales reales', () => {
    const beta = calcularBetaSHF(SHF_NACIONAL_ECONOMICA_SOCIAL, SHF_NACIONAL_MEDIA_RESIDENCIAL)
    expect(BETA_TRAMO_ALTO_SOBRE_BAJO.promedio).toBe(beta.beta)
    expect(BETA_TRAMO_ALTO_SOBRE_BAJO.min).toBe(beta.min)
    expect(BETA_TRAMO_ALTO_SOBRE_BAJO.max).toBe(beta.max)
  })

  // Hallazgo real verificado 2026-09-09 (ver comentario en betaTramoEngine.ts): en México la
  // banda alta se aprecia MÁS que la banda baja, lo contrario del proxy de EE.UU. que este beta
  // reemplazó -- este test documenta el hallazgo, no lo asume como debería ser.
  it('el beta real de México es mayor a 1 (banda alta amplifica, no amortigua)', () => {
    expect(BETA_TRAMO_ALTO_SOBRE_BAJO.promedio).toBeGreaterThan(1)
  })
})

describe('estimarPlusvaliaTramoAlto', () => {
  const { promedio, min, max } = BETA_TRAMO_ALTO_SOBRE_BAJO

  it('plusvalía positiva: aplica el beta promedio, rango ordenado min<max', () => {
    const r = estimarPlusvaliaTramoAlto(10, 'Colonia Referencia', 24)
    expect(r.tasaAnualizadaEstimada).toBeCloseTo(10 * promedio, 1)
    expect(r.rangoMin).toBeLessThan(r.rangoMax)
    expect(r.rangoMin).toBeCloseTo(10 * min, 1)
    expect(r.rangoMax).toBeCloseTo(10 * max, 1)
    expect(r.coloniaReferencia).toBe('Colonia Referencia')
    expect(r.tasaAnualizadaReferencia).toBe(10)
    expect(r.muestraReferencia).toBe(24)
  })

  it('plusvalía negativa (depreciación): el rango sigue ordenado min<max aunque el signo se invierte', () => {
    const r = estimarPlusvaliaTramoAlto(-10, 'Colonia X', 12)
    expect(r.tasaAnualizadaEstimada).toBeCloseTo(-10 * promedio, 1)
    expect(r.rangoMin).toBeLessThan(r.rangoMax)
    // con tasa negativa, el beta MAYOR da el resultado MAS negativo -> ese es rangoMin
    expect(r.rangoMin).toBeCloseTo(-10 * max, 1)
    expect(r.rangoMax).toBeCloseTo(-10 * min, 1)
  })

  it('plusvalía 0 -> estimación y rango en 0', () => {
    const r = estimarPlusvaliaTramoAlto(0, 'Colonia X', 5)
    expect(r.tasaAnualizadaEstimada).toBe(0)
    expect(r.rangoMin).toBe(0)
    expect(r.rangoMax).toBe(0)
  })
})
