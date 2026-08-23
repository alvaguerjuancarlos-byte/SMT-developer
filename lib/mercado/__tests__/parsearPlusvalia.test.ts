import { describe, it, expect } from 'vitest'
import { parsearPlusvaliaAnual } from '../parsearPlusvalia'

describe('parsearPlusvaliaAnual', () => {
  it('"6% anual" — ya anualizado, se usa tal cual', () => {
    expect(parsearPlusvaliaAnual('6% anual')).toBe(6)
  })

  it('"+18% en 3 años" — acumulado, se anualiza compuesto (~5.7%, no 18%)', () => {
    const r = parsearPlusvaliaAnual('+18% en 3 años')
    expect(r).toBeCloseTo(5.7, 1)
  })

  it('"5%/año" — variante de formato anual', () => {
    expect(parsearPlusvaliaAnual('5%/año')).toBe(5)
  })

  it('"~8% en 1 año" — un año, compuesto no cambia el valor', () => {
    expect(parsearPlusvaliaAnual('~8% en 1 año')).toBe(8)
  })

  it('"12%" suelto, sin calificador de tiempo — fallback: se asume anual', () => {
    expect(parsearPlusvaliaAnual('12%')).toBe(12)
  })

  it('texto sin ningún número — null', () => {
    expect(parsearPlusvaliaAnual('Zona en consolidación, plusvalía moderada')).toBeNull()
  })

  it('null/undefined/vacío — null', () => {
    expect(parsearPlusvaliaAnual(null)).toBeNull()
    expect(parsearPlusvaliaAnual(undefined)).toBeNull()
    expect(parsearPlusvaliaAnual('')).toBeNull()
  })
})
