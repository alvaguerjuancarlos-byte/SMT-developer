import { describe, it, expect } from 'vitest'
import { crearEvidencia, evidenciaDePrecio, evidenciaDePlusvalia } from '../evidenceEngine'
import type { RobustStats, ResultadoPlusvalia } from '../tipos'

function stats(overrides: Partial<RobustStats> = {}): RobustStats {
  return {
    n: 8, mean: 40_000, median: 39_500, min: 35_000, max: 45_000,
    p10: 36_000, p25: 38_000, p75: 41_000, p90: 43_000, iqr: 3_000, stdDev: 2_500,
    confidenceScore: 53, confidenceNivel: 'BAJA', ...overrides,
  }
}

describe('crearEvidencia', () => {
  it('genera un evidenceId con el prefijo MKT-EV-', () => {
    const e = crearEvidencia('price_per_m2', 40_000, 8, 'mediana')
    expect(e.evidenceId).toMatch(/^MKT-EV-/)
  })

  it('dos llamadas generan evidenceId distintos', () => {
    const a = crearEvidencia('x', 1, 1, 'm')
    const b = crearEvidencia('x', 1, 1, 'm')
    expect(a.evidenceId).not.toBe(b.evidenceId)
  })

  it('campos opcionales ausentes quedan null, no undefined ni inventados', () => {
    const e = crearEvidencia('metric', 100, 5, 'method')
    expect(e.period).toBeNull()
    expect(e.geography).toBeNull()
    expect(e.sourceId).toBeNull()
    expect(e.confidence).toBeNull()
  })
})

describe('evidenciaDePrecio', () => {
  it('usa la mediana como value, no el promedio', () => {
    const e = evidenciaDePrecio(stats({ mean: 41_000, median: 39_500 }))
    expect(e.value).toBe(39_500)
    expect(e.metric).toBe('price_per_m2_median')
  })

  it('siempre marca transactionType asking (§10 — nunca "precio de mercado" sin fuente de cierre real)', () => {
    const e = evidenciaDePrecio(stats())
    expect(e.transactionType).toBe('asking')
  })

  it('propaga el nivel de confianza del Price Engine', () => {
    const e = evidenciaDePrecio(stats({ confidenceNivel: 'MEDIA' }))
    expect(e.confidence).toBe('MEDIA')
  })

  it('propaga sampleSize desde stats.n, no un valor inventado', () => {
    const e = evidenciaDePrecio(stats({ n: 12 }))
    expect(e.sampleSize).toBe(12)
  })
})

describe('evidenciaDePlusvalia', () => {
  const resultadoConDato: ResultadoPlusvalia = {
    ventana: 'anual', tasaAnualizada: 8.4, periodoInicio: '2025-08', periodoFin: '2026-08',
    muestraInicio: 3, muestraFin: 5,
  }

  const resultadoSinDato: ResultadoPlusvalia = {
    ventana: 'anual', tasaAnualizada: null, periodoInicio: null, periodoFin: '2026-08',
    muestraInicio: 0, muestraFin: 5, motivo: 'sin historial suficiente',
  }

  it('null si la ventana no tuvo suficiente historial — no genera evidencia de la nada', () => {
    expect(evidenciaDePlusvalia(resultadoSinDato)).toBeNull()
  })

  it('con dato real, arma la evidencia con el periodo y la tasa', () => {
    const e = evidenciaDePlusvalia(resultadoConDato)!
    expect(e.value).toBe(8.4)
    expect(e.metric).toBe('appreciation_anual')
    expect(e.period).toBe('2026-08')
    expect(e.sampleSize).toBe(5)
  })
})
