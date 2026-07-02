import { describe, it, expect } from 'vitest'
import { resolverBenchmarkMaximo, resolverPrecioVentaMinimo, resolverUnidadesMinimas } from '../solvers'
import { calcularCostos, calcularIngresos, construirFlujoSocio } from '../motor'
import { calcularTIR } from '../irr'
import type { MastermindInputs } from '../tipos'

const inputs: MastermindInputs = {
  terreno: { costoTerreno: 4_000_000, costoTerrenoM2: 8_000, superficieM2: 500 },
  proyecto: {
    tipoProyecto: 'vertical_mixto',
    niveles: 4,
    unidadesHabitacionales: 16,
    m2PromedioDepa: 65,
    m2ComercialesPlantaBaja: 0,
    benchmarkConstruccion: 'habitacional_medio',
  },
  mercado: { precioVentaDepasM2: 45_000, modalidadLocales: 'venta', precioLocalesM2: 0, tasaCapRate: 8 },
  tiempo: { plazoObraMeses: 18, plazoVentaMeses: 24, inicioVentasMes: 6 },
  financiamiento: { porcentajeFinanciado: 0, tasaAnualCredito: 14 },
  tirObjetivo: 25,
}

function tirSocioCon(overrides: Partial<MastermindInputs>, benchmarkOverrideMxnM2?: number): number | null {
  const inputsFinal = { ...inputs, ...overrides }
  const ingresos = calcularIngresos(inputsFinal)
  const costos = calcularCostos(inputsFinal, ingresos, benchmarkOverrideMxnM2)
  const flujo = construirFlujoSocio(inputsFinal, ingresos, costos)
  const tir = calcularTIR(flujo)
  return tir.converged ? (tir.tirAnual as number) * 100 : null
}

describe('resolverPrecioVentaMinimo', () => {
  it('el precio resuelto, aplicado de vuelta al motor, reproduce la TIR objetivo', () => {
    const r = resolverPrecioVentaMinimo(inputs)
    expect(r.converged).toBe(true)
    expect(r.valor).not.toBeNull()

    const tirReal = tirSocioCon({ mercado: { ...inputs.mercado, precioVentaDepasM2: r.valor as number } })
    expect(tirReal).not.toBeNull()
    expect(tirReal as number).toBeCloseTo(inputs.tirObjetivo, 1)
  })

  it('un precio menor al resuelto da una TIR menor al objetivo (monotonicidad)', () => {
    const r = resolverPrecioVentaMinimo(inputs)
    const tirMenor = tirSocioCon({ mercado: { ...inputs.mercado, precioVentaDepasM2: (r.valor as number) * 0.8 } })
    expect(tirMenor as number).toBeLessThan(inputs.tirObjetivo)
  })
})

describe('resolverBenchmarkMaximo', () => {
  it('el benchmark resuelto, aplicado de vuelta al motor, reproduce la TIR objetivo', () => {
    const r = resolverBenchmarkMaximo(inputs)
    expect(r.converged).toBe(true)
    expect(r.valor).not.toBeNull()

    const tirReal = tirSocioCon({}, r.valor as number)
    expect(tirReal).not.toBeNull()
    expect(tirReal as number).toBeCloseTo(inputs.tirObjetivo, 1)
  })

  it('un benchmark mayor al resuelto da una TIR menor al objetivo (monotonicidad inversa)', () => {
    const r = resolverBenchmarkMaximo(inputs)
    const tirMayor = tirSocioCon({}, (r.valor as number) * 1.2)
    expect(tirMayor as number).toBeLessThan(inputs.tirObjetivo)
  })
})

describe('resolverUnidadesMinimas', () => {
  it('las unidades resueltas, aplicadas de vuelta al motor, reproducen la TIR objetivo', () => {
    const r = resolverUnidadesMinimas(inputs)
    expect(r.converged).toBe(true)
    expect(r.valor).not.toBeNull()

    const tirReal = tirSocioCon({ proyecto: { ...inputs.proyecto, unidadesHabitacionales: r.valor as number } })
    expect(tirReal).not.toBeNull()
    expect(tirReal as number).toBeCloseTo(inputs.tirObjetivo, 1)
  })
})
