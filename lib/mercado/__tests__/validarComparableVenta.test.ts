import { describe, it, expect } from 'vitest'
import { validarComparableVenta } from '../validarComparableVenta'
import type { ComparableVenta } from '../validarComparableVenta'

const BASE: ComparableVenta = {
  nombre: 'Torre Ejemplo', direccion: 'Av. Ejemplo 123', precioM2: null, precioTotal: null,
  superficieM2: null, tipologia: '2 rec · 75 m²', avanceObra: 'En obra',
  fechaReferencia: 'Q1 2026', url: 'https://example.com', origen: 'web_search',
}

describe('validarComparableVenta', () => {
  it('precioM2 y precioTotal consistentes entre sí: se conservan tal cual', () => {
    const r = validarComparableVenta({ ...BASE, precioM2: 14_000, precioTotal: 1_050_000, superficieM2: 75 })
    expect(r).not.toBeNull()
    expect(r!.precioM2).toBe(14_000)
    expect(r!.precioTotal).toBe(1_050_000)
  })

  it('campos invertidos (precioM2 era el total y viceversa): se corrigen', () => {
    // precioM2=1_050_000 (en realidad el total), precioTotal=14_000 (en realidad el /m²), superficie=75
    const r = validarComparableVenta({ ...BASE, precioM2: 1_050_000, precioTotal: 14_000, superficieM2: 75 })
    expect(r).not.toBeNull()
    expect(r!.precioM2).toBe(14_000)
    expect(r!.precioTotal).toBe(1_050_000)
  })

  it('inconsistentes y no reconciliables: se descarta', () => {
    const r = validarComparableVenta({ ...BASE, precioM2: 14_000, precioTotal: 3_000_000, superficieM2: 75 })
    expect(r).toBeNull()
  })

  it('solo precioM2 y superficie: deriva precioTotal', () => {
    const r = validarComparableVenta({ ...BASE, precioM2: 14_000, precioTotal: null, superficieM2: 75 })
    expect(r).not.toBeNull()
    expect(r!.precioTotal).toBe(14_000 * 75)
  })

  it('solo precioTotal y superficie: deriva precioM2', () => {
    const r = validarComparableVenta({ ...BASE, precioM2: null, precioTotal: 1_050_000, superficieM2: 75 })
    expect(r).not.toBeNull()
    expect(r!.precioM2).toBe(Math.round(1_050_000 / 75))
  })

  it('precioM2 por debajo del rango de vivienda terminada ($5,000): se descarta', () => {
    const r = validarComparableVenta({ ...BASE, precioM2: 3_500, precioTotal: null, superficieM2: null })
    expect(r).toBeNull()
  })

  it('precioM2 por encima del rango ($150,000): se descarta', () => {
    const r = validarComparableVenta({ ...BASE, precioM2: 200_000, precioTotal: null, superficieM2: null })
    expect(r).toBeNull()
  })

  it('precioM2 en el límite del rango de terreno pero válido para vivienda ($40,000): se conserva', () => {
    // Este valor sería inválido para el validador de terreno (max $60,000 pero mínimo $300 igual lo aceptaría);
    // la prueba real es que $40,000/m² —absurdo para suelo— es perfectamente normal para vivienda banda 3-4.
    const r = validarComparableVenta({ ...BASE, precioM2: 40_000, precioTotal: null, superficieM2: null })
    expect(r).not.toBeNull()
    expect(r!.precioM2).toBe(40_000)
  })

  it('sin ningún precio: se descarta', () => {
    const r = validarComparableVenta({ ...BASE, precioM2: null, precioTotal: null, superficieM2: 75 })
    expect(r).toBeNull()
  })
})
