import { describe, it, expect, beforeAll } from 'vitest'
import { calcular } from '../motor'
import type { InputsNormativos, InputsProyecto, ResultadoEstimador } from '../tipos'

// ── Ejemplo de referencia §11 ────────────────────────────────────────────────
// Predio: 2,000 m² · COS 0.65 · CUS 5.0 · CAS 0.15
// Mezcla: Comercio 1,200 m² · Oficinas 2,300 m² · Vivienda media 6,000 m² · Amenidades 500 m²
// Sin norma de cajones → ejercita el path de fallback §6

const normativos: InputsNormativos = {
  sTerreno: 2_000,
  cos: 0.65,
  cus: 5.0,
  cas: 0.15,
  // normaCajones ausente → fallback §6
}

const proyecto: InputsProyecto = {
  usos: [
    { genero: 'comercio',                   m2Bruto: 1_200 },
    { genero: 'oficinas',                   m2Bruto: 2_300 },
    { genero: 'vivienda_residencial_media', m2Bruto: 6_000, unidades: 75 },
    { genero: 'amenidades_comunes',         m2Bruto:   500 },
  ],
}

let r: ResultadoEstimador

beforeAll(() => {
  r = calcular(normativos, proyecto)
})

// ── Envolvente normativo ──────────────────────────────────────────────────────

describe('Envolvente normativo', () => {
  it('huella máx = 1,300 m²', () => {
    expect(r.envolvente.huellaMax).toBe(1_300)
  })
  it('construible máx = 10,000 m²', () => {
    expect(r.envolvente.construibleMax).toBe(10_000)
  })
  it('permeable mín = 300 m²', () => {
    expect(r.envolvente.permeableMin).toBe(300)
  })
  it('niveles teóricos ≈ 7.69 (CUS/COS)', () => {
    expect(r.envolvente.nivelesTeóricos).toBeCloseTo(5.0 / 0.65, 4)
  })
  it('binding constraint no vacío', () => {
    expect(r.envolvente.bindingConstraint.length).toBeGreaterThan(0)
  })
})

// ── Costo directo §11 — tolerancia ±0.5% ─────────────────────────────────────

describe('Costo directo — ejemplo §11', () => {
  // Target recalculado 2026-08-26 tras validar COSTOS_PARAMETRICOS contra
  // referencias de mercado (ver catalogo.ts) — antes eran 246M/315M/$18,950,
  // calibrados contra los valores viejos del catálogo (sin fuente real), no
  // contra un resultado independiente verificado.
  const TARGET = 217_825_000

  it(`base ≈ ${TARGET.toLocaleString('es-MX')} MXN (±0.5%)`, () => {
    const { base } = r.costoDirectoTotal
    expect(base / TARGET, `obtenido: ${base.toLocaleString('es-MX')}`).toBeGreaterThan(0.995)
    expect(base / TARGET, `obtenido: ${base.toLocaleString('es-MX')}`).toBeLessThan(1.005)
  })

  it('piso < base < techo', () => {
    expect(r.costoDirectoTotal.piso).toBeLessThan(r.costoDirectoTotal.base)
    expect(r.costoDirectoTotal.base).toBeLessThan(r.costoDirectoTotal.techo)
  })

  it('suma de porciones.base == costoDirectoTotal.base', () => {
    const suma = r.porciones.reduce((s, p) => s + p.costoDirecto.base, 0)
    expect(suma).toBeCloseTo(r.costoDirectoTotal.base, 0)
  })
})

// ── Costo total (con indirectos) §11 — tolerancia ±1% ────────────────────────

describe('Costo total (×1.28 base) — ejemplo §11', () => {
  const TARGET = 278_816_000

  it(`base ≈ ${TARGET.toLocaleString('es-MX')} MXN (±1%)`, () => {
    const { base } = r.costoTotal
    expect(base / TARGET, `obtenido: ${base.toLocaleString('es-MX')}`).toBeGreaterThan(0.99)
    expect(base / TARGET, `obtenido: ${base.toLocaleString('es-MX')}`).toBeLessThan(1.01)
  })

  it('costoTotal.base = costoDirecto.base × 1.28', () => {
    expect(r.costoTotal.base).toBeCloseTo(r.costoDirectoTotal.base * 1.28, 0)
  })

  it('costoTotal.piso = costoDirecto.piso × 1.20', () => {
    expect(r.costoTotal.piso).toBeCloseTo(r.costoDirectoTotal.piso * 1.20, 0)
  })

  it('costoTotal.techo = costoDirecto.techo × 1.35', () => {
    expect(r.costoTotal.techo).toBeCloseTo(r.costoDirectoTotal.techo * 1.35, 0)
  })
})

// ── Indicadores §11 — tolerancia ±1% ─────────────────────────────────────────

describe('Indicadores — ejemplo §11', () => {
  it('m²/bruto base ≈ $16,827 (±1%)', () => {
    const { base } = r.indicadores.costoPorM2Bruto
    expect(base / 16_827, `obtenido: ${base.toFixed(0)}`).toBeGreaterThan(0.99)
    expect(base / 16_827, `obtenido: ${base.toFixed(0)}`).toBeLessThan(1.01)
  })

  it('costoPorM2Bruto.base = costoTotal.base / areas.total', () => {
    const calc = r.costoTotal.base / r.areas.total
    expect(r.indicadores.costoPorM2Bruto.base).toBeCloseTo(calc, 0)
  })

  it('m² vendible < área total construida', () => {
    expect(r.areas.vendible).toBeLessThan(r.areas.total)
  })

  it('m² vendible > 0', () => {
    expect(r.areas.vendible).toBeGreaterThan(0)
  })

  it('costoPorM2Vendible.base = costoTotal.base / areas.vendible', () => {
    const calc = r.costoTotal.base / r.areas.vendible
    expect(r.indicadores.costoPorM2Vendible.base).toBeCloseTo(calc, 0)
  })

  it('$/m²_vendible > $/m²_bruto (encarecimiento por zonas no vendibles)', () => {
    expect(r.indicadores.costoPorM2Vendible.base)
      .toBeGreaterThan(r.indicadores.costoPorM2Bruto.base)
  })
})

// ── Programa de áreas ─────────────────────────────────────────────────────────

describe('Programa de áreas', () => {
  it('sobre rasante = 10,000 m² (suma de usos)', () => {
    expect(r.areas.sobreRasante).toBe(10_000)
  })

  it('sótano > 0 (estacionamiento derivado)', () => {
    expect(r.areas.sotano).toBeGreaterThan(0)
  })

  it('total = sobreRasante + sotano', () => {
    expect(r.areas.total).toBe(r.areas.sobreRasante + r.areas.sotano)
  })

  it('porciones incluye estacionamiento_sotano', () => {
    const tieneEst = r.porciones.some(p => p.genero === 'estacionamiento_sotano')
    expect(tieneEst).toBe(true)
  })
})

// ── Bitácora de supuestos ─────────────────────────────────────────────────────

describe('Bitácora de supuestos (supuestos[])', () => {
  it('supuestos[] no vacío', () => {
    expect(r.supuestos.length).toBeGreaterThan(0)
  })

  it('registra el fallback de cajones por falta de normaCajones', () => {
    const tiene = r.supuestos.some(s => s.includes('Sin norma') || s.includes('fallback'))
    expect(tiene, 'debe haber supuesto de fallback de cajones').toBe(true)
  })

  it('registra el área efectiva por cajón', () => {
    const tiene = r.supuestos.some(s => s.includes('Área efectiva por cajón'))
    expect(tiene).toBe(true)
  })

  it('registra los valores del catálogo §8 usados', () => {
    const tiene = r.supuestos.some(s => s.includes('Catálogo §8'))
    expect(tiene).toBe(true)
  })

  it('registra los factores de eficiencia aplicados', () => {
    const tiene = r.supuestos.some(s => s.includes('Eficiencia §5'))
    expect(tiene).toBe(true)
  })

  it('registra los factores de indirectos', () => {
    const tiene = r.supuestos.some(s => s.includes('Indirectos §5'))
    expect(tiene).toBe(true)
  })

  it('registra el binding constraint', () => {
    const tiene = r.supuestos.some(s =>
      s.toLowerCase().includes('binding constraint') || s.includes('Binding constraint')
    )
    expect(tiene).toBe(true)
  })

  it('todos los supuestos son strings no vacíos', () => {
    expect(r.supuestos.every(s => typeof s === 'string' && s.length > 0)).toBe(true)
  })
})
