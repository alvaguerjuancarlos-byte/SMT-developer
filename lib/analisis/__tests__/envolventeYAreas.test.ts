import { describe, it, expect } from 'vitest'
import { calcularEnvolvente, plazoVentaMeses, validarMix, validarSuperficieConstruida, calcularArquitecturaEnVivo, FACTOR_APROVECHAMIENTO, FACTOR_EFICIENCIA_VENDIBLE } from '../envolventeYAreas'
import type { EntradaEnvolvente, EntradaArquitecturaEnVivo } from '../envolventeYAreas'

// Torre Las Huertas 3 — mismo fixture que scripts/verificar-envolvente.ts
const ENTRADA: EntradaEnvolvente = {
  superficieTerreno: 2300,
  cus: 2.40,
  cos: 0.60,
  nivelesMax: 4,
  densidadMaxUnidades: 46,
  tipologia: 'vertical',
}

describe('calcularEnvolvente', () => {
  it('areaMaxConstruible = MIN(cus × terreno, cos × terreno × niveles)', () => {
    const out = calcularEnvolvente(ENTRADA)
    expect(out.areaMaxConstruible).toBe(5520) // 2.40×2300=5520, 0.60×2300×4=5520
  })

  it('el CUS es el límite duro cuando es menor que COS × niveles', () => {
    const out = calcularEnvolvente({ ...ENTRADA, cus: 1.0 })
    expect(out.areaMaxConstruible).toBe(2300) // 1.0×2300=2300 < 0.60×2300×4=5520
  })

  it('el COS × niveles es el límite duro cuando es menor que CUS', () => {
    const out = calcularEnvolvente({ ...ENTRADA, nivelesMax: 1 })
    expect(out.areaMaxConstruible).toBe(1380) // 0.60×2300×1=1380 < 2.40×2300=5520
  })

  it('areaConstruida = areaMaxConstruible × FACTOR_APROVECHAMIENTO (piso/base/techo)', () => {
    const out = calcularEnvolvente(ENTRADA)
    expect(out.areaConstruida).toEqual({ piso: 4692, base: 4968, techo: 5244 })
  })

  it('areaVendible.base ≈ 3775.7 (rango 3378.2–4195.2) para tipología vertical', () => {
    const out = calcularEnvolvente(ENTRADA)
    expect(out.areaVendible.base).toBeCloseTo(3775.7, 1)
    expect(out.areaVendible.piso).toBeCloseTo(3378.2, 1)
    expect(out.areaVendible.techo).toBeCloseTo(4195.2, 1)
  })

  it('areaNoVendible = areaConstruida − areaVendible, mismo k contra mismo k', () => {
    const out = calcularEnvolvente(ENTRADA)
    expect(out.areaNoVendible.base).toBeCloseTo(out.areaConstruida.base - out.areaVendible.base, 5)
  })

  it('eficienciaVendiblePct reproduce el factor de eficiencia vendible de la tipología (×100)', () => {
    const out = calcularEnvolvente(ENTRADA)
    expect(out.eficienciaVendiblePct).toEqual({ piso: 72, base: 76, techo: 80 })
  })

  it('tipología horizontal usa su propio rango de eficiencia (80/83/85%)', () => {
    const out = calcularEnvolvente({ ...ENTRADA, tipologia: 'horizontal' })
    expect(out.eficienciaVendiblePct).toEqual({ piso: 80, base: 83, techo: 85 })
  })

  it('tipología mixto usa su propio rango de eficiencia (70/74/78%)', () => {
    const out = calcularEnvolvente({ ...ENTRADA, tipologia: 'mixto' })
    expect(out.eficienciaVendiblePct).toEqual({ piso: 70, base: 74, techo: 78 })
  })
})

describe('validarMix', () => {
  it('mix consistente con el área vendible base: desviación ~0%, sin alertas', () => {
    // 72 unidades × 52 m² ≈ 3744, contra areaVendibleBase 3775.7 → ~-0.8%
    const r = validarMix([{ unidades: 72, m2Promedio: 52 }], 3775.7, 46)
    expect(r.areaMix).toBe(3744)
    expect(r.nUnidades).toBe(72)
    expect(r.desviacionPct).toBeCloseTo(-0.8, 1)
  })

  it('subdensifica = true si nUnidades < 70% de densidadMax', () => {
    const r = validarMix([{ unidades: 20, m2Promedio: 100 }], 3775.7, 46) // 20 < 0.70×46=32.2
    expect(r.subdensifica).toBe(true)
    expect(r.sobredensifica).toBe(false)
  })

  it('no subdensifica si nUnidades ≥ 70% de densidadMax', () => {
    const r = validarMix([{ unidades: 33, m2Promedio: 100 }], 3775.7, 46) // 33 ≥ 32.2
    expect(r.subdensifica).toBe(false)
  })

  it('sobredensifica = true si nUnidades excede el techo legal (densidadMax)', () => {
    const r = validarMix([{ unidades: 72, m2Promedio: 52 }], 3775.7, 46) // 72 > 46
    expect(r.sobredensifica).toBe(true)
    expect(r.subdensifica).toBe(false)
  })

  it('sin densidadMax, ni subdensifica ni sobredensifica se activan', () => {
    const r = validarMix([{ unidades: 5, m2Promedio: 50 }], 3775.7)
    expect(r.subdensifica).toBe(false)
    expect(r.sobredensifica).toBe(false)
  })

  it('suma áreas y unidades de varias filas del mix', () => {
    const r = validarMix([
      { unidades: 18, m2Promedio: 55 },
      { unidades: 12, m2Promedio: 75 },
      { unidades: 6, m2Promedio: 100 },
    ], 2400)
    expect(r.nUnidades).toBe(36)
    expect(r.areaMix).toBe(18 * 55 + 12 * 75 + 6 * 100)
  })
})

describe('validarSuperficieConstruida', () => {
  // areaMaxConstruible=5520, areaConstruida={piso:4692, base:4968, techo:5244} (fixture ENTRADA)
  const envolvente = calcularEnvolvente(ENTRADA)

  it('superficie = base: sin desviación, ninguna bandera activa', () => {
    const r = validarSuperficieConstruida(4968, envolvente)
    expect(r.desviacionPct).toBe(0)
    expect(r.fueraDeRangoPiso).toBe(false)
    expect(r.fueraDeRangoTecho).toBe(false)
    expect(r.excedeAreaMaxConstruible).toBe(false)
  })

  it('superficie por debajo del piso: fueraDeRangoPiso = true', () => {
    const r = validarSuperficieConstruida(4000, envolvente)
    expect(r.fueraDeRangoPiso).toBe(true)
    expect(r.fueraDeRangoTecho).toBe(false)
    expect(r.excedeAreaMaxConstruible).toBe(false)
  })

  it('superficie por encima del techo pero bajo areaMaxConstruible: solo fueraDeRangoTecho', () => {
    const r = validarSuperficieConstruida(5300, envolvente) // techo=5244, areaMaxConstruible=5520
    expect(r.fueraDeRangoTecho).toBe(true)
    expect(r.excedeAreaMaxConstruible).toBe(false)
  })

  it('superficie por encima de areaMaxConstruible: también excedeAreaMaxConstruible', () => {
    const r = validarSuperficieConstruida(5600, envolvente) // > 5520
    expect(r.fueraDeRangoTecho).toBe(true)
    expect(r.excedeAreaMaxConstruible).toBe(true)
  })

  it('borde exacto en piso: no marca fuera de rango (comparación estricta <)', () => {
    const r = validarSuperficieConstruida(envolvente.areaConstruida.piso, envolvente)
    expect(r.fueraDeRangoPiso).toBe(false)
  })

  it('borde exacto en techo: no marca fuera de rango (comparación estricta >)', () => {
    const r = validarSuperficieConstruida(envolvente.areaConstruida.techo, envolvente)
    expect(r.fueraDeRangoTecho).toBe(false)
  })
})

describe('plazoVentaMeses', () => {
  it('divide unidades entre absorción mensual', () => {
    expect(plazoVentaMeses(72, 3)).toBe(24)
  })

  it('con absorción 0, retorna Infinity (nunca se vende)', () => {
    expect(plazoVentaMeses(72, 0)).toBe(Infinity)
  })
})

describe('calcularArquitecturaEnVivo', () => {
  const base: EntradaArquitecturaEnVivo = {
    cosPermitidoPct: 60, cusPermitido: 3.0, superficieTerreno: 1000, niveles: 4,
    tipologia: 'vertical', unidadesBase: 40, areaVendibleBase: 1500,
  }

  it('dentro del CUS permitido: no excede, calcula área construida/vendible con las mismas constantes que calcularEnvolvente', () => {
    const r = calcularArquitecturaEnVivo(base)!
    expect(r.cosFraccion).toBeCloseTo(0.6, 6)
    expect(r.areaConstruidaPropuesta).toBeCloseTo(1000 * 0.6 * 4 * FACTOR_APROVECHAMIENTO.base, 6)
    expect(r.areaVendiblePropuesta).toBeCloseTo(r.areaConstruidaPropuesta * FACTOR_EFICIENCIA_VENDIBLE.vertical.base, 6)
    expect(r.cusImplicito).toBeCloseTo(2.4, 6)
    expect(r.excede).toBe(false)
    expect(r.excedenteM2).toBe(0)
  })

  it('nunca topa al máximo legal (a diferencia de calcularEnvolvente) — detecta excedente cuando el usuario sube niveles', () => {
    const r = calcularArquitecturaEnVivo({ ...base, niveles: 6 })!
    expect(r.cusImplicito).toBeCloseTo(3.6, 6) // > cusPermitido (3.0)
    expect(r.excede).toBe(true)
    expect(r.excedenteM2).toBeCloseTo(600, 1) // (3.6-3.0) × 1000
    // el área SÍ crece más allá del techo legal — no se capa
    expect(r.areaConstruidaPropuesta).toBeGreaterThan(1000 * 3.0) // > areaMaxConstruible legal
  })

  it('nivelesSugerido es el máximo entero de niveles que cabe en el CUS permitido', () => {
    const r = calcularArquitecturaEnVivo(base)!
    expect(r.nivelesSugerido).toBe(5) // 3.0 / 0.6 = 5 exacto
  })

  it('unidadesEfectivas escala proporcional al cambio de área vendible respecto al diseño base', () => {
    const r4 = calcularArquitecturaEnVivo(base)! // areaVendiblePropuesta a 4 niveles
    const r6 = calcularArquitecturaEnVivo({ ...base, niveles: 6 })!
    expect(r4.unidadesEfectivas).toBe(Math.round(40 * (r4.areaVendiblePropuesta / 1500)))
    expect(r6.unidadesEfectivas!).toBeGreaterThan(r4.unidadesEfectivas!) // más niveles -> más área -> más unidades
  })

  it('sin unidadesBase/areaVendibleBase, no inventa unidades', () => {
    const r = calcularArquitecturaEnVivo({ ...base, unidadesBase: null, areaVendibleBase: null })!
    expect(r.unidadesEfectivas).toBeNull()
  })

  it('sótanos: cajones estimados a partir del footprint (COS × terreno), sin costo asociado', () => {
    const r = calcularArquitecturaEnVivo({ ...base, sotanos: 1 })!
    // footprint = 0.6 × 1000 = 600; 600/28 ≈ 21.4 -> floor 21
    expect(r.cajonesSotano).toBe(21)
  })

  it('sin sótanos, cajonesSotano es null (no cero fabricado)', () => {
    const r = calcularArquitecturaEnVivo(base)!
    expect(r.sotanos).toBe(0)
    expect(r.cajonesSotano).toBeNull()
  })

  it('sin datos suficientes (COS/superficie/niveles), retorna null en vez de un cálculo inventado', () => {
    expect(calcularArquitecturaEnVivo({ ...base, cosPermitidoPct: null as any })).toBeNull()
    expect(calcularArquitecturaEnVivo({ ...base, niveles: 0 })).toBeNull()
    expect(calcularArquitecturaEnVivo({ ...base, superficieTerreno: null as any })).toBeNull()
  })
})
