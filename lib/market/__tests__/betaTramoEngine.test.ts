import { describe, it, expect } from 'vitest'
import { estimarPlusvaliaTramoAlto, BETA_TRAMO_ALTO_SOBRE_BAJO, BETA_POR_METRO_REFERENCIA } from '../betaTramoEngine'

describe('BETA_TRAMO_ALTO_SOBRE_BAJO', () => {
  it('el promedio de los 3 metros de referencia coincide con la constante publicada', () => {
    const promedio = BETA_POR_METRO_REFERENCIA.reduce((s, m) => s + m.beta, 0) / BETA_POR_METRO_REFERENCIA.length
    expect(promedio).toBeCloseTo(BETA_TRAMO_ALTO_SOBRE_BAJO.promedio, 2)
  })
  it('min/max son el min/max real de los 3 metros', () => {
    const betas = BETA_POR_METRO_REFERENCIA.map(m => m.beta)
    expect(BETA_TRAMO_ALTO_SOBRE_BAJO.min).toBeCloseTo(Math.min(...betas), 3)
    expect(BETA_TRAMO_ALTO_SOBRE_BAJO.max).toBeCloseTo(Math.max(...betas), 3)
  })
})

describe('estimarPlusvaliaTramoAlto', () => {
  it('plusvalía positiva: aplica el beta promedio, rango ordenado min<max', () => {
    const r = estimarPlusvaliaTramoAlto(10, 'Colonia Referencia', 24)
    expect(r.tasaAnualizadaEstimada).toBeCloseTo(4.78, 1)
    expect(r.rangoMin).toBeLessThan(r.rangoMax)
    expect(r.rangoMin).toBeCloseTo(3.17, 1)
    expect(r.rangoMax).toBeCloseTo(6.01, 1)
    expect(r.coloniaReferencia).toBe('Colonia Referencia')
    expect(r.tasaAnualizadaReferencia).toBe(10)
    expect(r.muestraReferencia).toBe(24)
  })

  it('plusvalía negativa (depreciación): el rango sigue ordenado min<max aunque el signo se invierte', () => {
    const r = estimarPlusvaliaTramoAlto(-10, 'Colonia X', 12)
    expect(r.tasaAnualizadaEstimada).toBeCloseTo(-4.78, 1)
    expect(r.rangoMin).toBeLessThan(r.rangoMax)
    // con tasa negativa, el beta MAYOR (0.601) da el resultado MAS negativo -> ese es rangoMin
    expect(r.rangoMin).toBeCloseTo(-6.01, 1)
    expect(r.rangoMax).toBeCloseTo(-3.17, 1)
  })

  it('plusvalía 0 -> estimación y rango en 0', () => {
    const r = estimarPlusvaliaTramoAlto(0, 'Colonia X', 5)
    expect(r.tasaAnualizadaEstimada).toBe(0)
    expect(r.rangoMin).toBe(0)
    expect(r.rangoMax).toBe(0)
  })

  it('siempre estima MENOS movimiento que el tramo bajo (beta < 1) — nunca amplifica', () => {
    const r = estimarPlusvaliaTramoAlto(20, 'Colonia X', 30)
    expect(Math.abs(r.tasaAnualizadaEstimada)).toBeLessThan(20)
    expect(Math.abs(r.rangoMax)).toBeLessThan(20)
  })
})
