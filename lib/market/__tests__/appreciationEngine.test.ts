import { describe, it, expect } from 'vitest'
import { construirSerieMensual, calcularVentanaPlusvalia, calcularAppreciationEngine } from '../appreciationEngine'
import type { ObservacionPrecio } from '../tipos'

function obs(precioM2: number, observadoEn: string): ObservacionPrecio {
  return { precioM2, observadoEn }
}

describe('construirSerieMensual', () => {
  it('agrupa por mes calendario usando la mediana, no el promedio', () => {
    const serie = construirSerieMensual([
      obs(38_000, '2026-06-01'), obs(42_000, '2026-06-15'), obs(1_000_000, '2026-06-28'), // outlier
      obs(40_000, '2026-07-01'),
    ])
    const junio = serie.find((p) => p.mes === '2026-06')!
    expect(junio.mediana).toBe(42_000) // mediana de [38k,42k,1M], no el promedio inflado
    expect(junio.n).toBe(3)
  })

  it('ordena la serie cronológicamente sin importar el orden de entrada', () => {
    const serie = construirSerieMensual([obs(40_000, '2026-08-01'), obs(38_000, '2026-01-01'), obs(39_000, '2026-05-01')])
    expect(serie.map((p) => p.mes)).toEqual(['2026-01', '2026-05', '2026-08'])
  })
})

describe('calcularVentanaPlusvalia', () => {
  it('con menos de 2 meses distintos, NOT_ENOUGH_DATA (null, no 0)', () => {
    const serie = construirSerieMensual([obs(40_000, '2026-08-01'), obs(41_000, '2026-08-15')])
    const r = calcularVentanaPlusvalia(serie, 'anual')
    expect(r.tasaAnualizada).toBeNull()
    expect(r.motivo).toBeTruthy()
  })

  it('si el historial no alcanza para la ventana pedida, null con motivo explicando por qué', () => {
    // Solo 2 meses de historia, pero se pide una ventana de 3 años.
    const serie = construirSerieMensual([obs(40_000, '2026-06-01'), obs(42_000, '2026-08-01')])
    const r = calcularVentanaPlusvalia(serie, '3_anios')
    expect(r.tasaAnualizada).toBeNull()
    expect(r.motivo).toContain('no alcanza')
  })

  it('ventana anual con exactamente 12 meses de diferencia: tasa = cambio total (sin recomponer)', () => {
    const serie = construirSerieMensual([obs(40_000, '2025-08-01'), obs(44_000, '2026-08-01')])
    const r = calcularVentanaPlusvalia(serie, 'anual')
    expect(r.tasaAnualizada).toBeCloseTo(10, 0) // +10% en exactamente 12 meses = 10% anualizado
    expect(r.periodoInicio).toBe('2025-08')
    expect(r.periodoFin).toBe('2026-08')
  })

  it('usa meses REALES transcurridos, no el nominal de la ventana, cuando el dato más cercano no cae exacto', () => {
    // Se pide "anual" (12 meses) pero el punto más antiguo disponible dentro de la ventana está
    // a 18 meses — debe anualizar sobre 18 meses reales, no fingir que fueron 12.
    const serie = construirSerieMensual([
      obs(40_000, '2025-02-01'), // 18 meses antes de 2026-08
      obs(46_000, '2026-08-01'),
    ])
    const r = calcularVentanaPlusvalia(serie, 'anual')
    // (46000/40000)^(12/18) - 1 ≈ 9.6%, NO 15% (que sería el cambio total sin anualizar)
    expect(r.tasaAnualizada).toBeCloseTo(9.6, 0)
    expect(r.periodoInicio).toBe('2025-02')
  })

  it('usa el punto real más cercano al objetivo sin pasarse de la ventana', () => {
    const serie = construirSerieMensual([
      obs(38_000, '2026-01-01'),
      obs(39_000, '2026-05-01'), // este es el más cercano a "hace 3 meses" desde agosto
      obs(42_000, '2026-08-01'),
    ])
    const r = calcularVentanaPlusvalia(serie, 'trimestral')
    expect(r.periodoInicio).toBe('2026-05')
  })
})

describe('calcularAppreciationEngine', () => {
  it('devuelve las 6 ventanas del spec, cada una con su propio resultado', () => {
    const r = calcularAppreciationEngine([obs(40_000, '2025-08-01'), obs(44_000, '2026-08-01')])
    expect(r.map((x) => x.ventana)).toEqual(['mensual', 'trimestral', 'anual', '3_anios', '5_anios', '10_anios'])
    expect(r.find((x) => x.ventana === 'anual')?.tasaAnualizada).toBeCloseTo(10, 0)
    expect(r.find((x) => x.ventana === '10_anios')?.tasaAnualizada).toBeNull() // no hay 10 años de historial
  })

  it('arreglo vacío no truena — todo NOT_ENOUGH_DATA', () => {
    const r = calcularAppreciationEngine([])
    expect(r.every((x) => x.tasaAnualizada === null)).toBe(true)
  })
})
