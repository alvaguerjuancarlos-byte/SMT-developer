import { describe, it, expect } from 'vitest'
import { calcularTIR } from '../irr'

function npv(rate: number, flujos: number[]): number {
  let total = 0
  for (let t = 0; t < flujos.length; t++) total += flujos[t] / Math.pow(1 + rate, t)
  return total
}

describe('calcularTIR — caso exacto de un solo periodo', () => {
  it('flujo [-100, 110] tiene tasa mensual exacta de 10% (NPV(10%) = 0)', () => {
    const r = calcularTIR([-100, 110])
    expect(r.converged).toBe(true)
    expect(r.tasaMensual).not.toBeNull()
    expect(r.tasaMensual as number).toBeCloseTo(0.10, 4)
    expect(r.tirAnual as number).toBeCloseTo(Math.pow(1.10, 12) - 1, 3)
  })
})

describe('calcularTIR — sin cambio de signo (no hay raíz)', () => {
  it('flujo todo positivo → no calculable', () => {
    const r = calcularTIR([100, 100, 100])
    expect(r.converged).toBe(false)
    expect(r.metodo).toBe('fallido')
    expect(r.tirAnual).toBeNull()
  })
  it('flujo todo negativo → no calculable', () => {
    const r = calcularTIR([-100, -100, -100])
    expect(r.converged).toBe(false)
    expect(r.metodo).toBe('fallido')
  })
  it('flujo vacío o de un solo elemento → no calculable', () => {
    expect(calcularTIR([]).converged).toBe(false)
    expect(calcularTIR([-100]).converged).toBe(false)
  })
})

describe('calcularTIR — flujo realista de proyecto (obra → ventas)', () => {
  it('converge y la tasa encontrada hace NPV ≈ 0', () => {
    // Mes 0 egreso grande, meses 1-12 egresos de obra, meses 6-24 ingresos de venta.
    const flujo = new Array(25).fill(0)
    flujo[0] = -4_000_000
    for (let m = 1; m <= 12; m++) flujo[m] += -1_500_000
    for (let m = 6; m <= 24; m++) flujo[m] += 1_200_000

    const r = calcularTIR(flujo)
    expect(r.converged).toBe(true)
    expect(r.tasaMensual).not.toBeNull()
    expect(Math.abs(npv(r.tasaMensual as number, flujo))).toBeLessThan(1) // NPV ≈ 0 en la tasa encontrada
  })
})

describe('calcularTIR — robustez del fallback de bisección', () => {
  it('un flujo con derivada plana cerca del guess inicial igual converge (vía Newton o bisección)', () => {
    // Egreso muy grande al inicio seguido de un único ingreso tardío — dificulta Newton desde el guess default.
    const flujo = new Array(37).fill(0)
    flujo[0] = -10_000_000
    flujo[36] = 40_000_000
    const r = calcularTIR(flujo)
    expect(r.converged).toBe(true)
    expect(Math.abs(npv(r.tasaMensual as number, flujo))).toBeLessThan(10)
  })
})
