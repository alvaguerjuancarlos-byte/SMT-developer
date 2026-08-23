import { describe, it, expect } from 'vitest'
import { generarMatrizSensibilidadFlexible, valorBaseDe, aplicarVariableSensibilidad } from '../sensibilidadFlexible'
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
    porcentajeIndirectos: 15,
    porcentajeHonorarios: 10,
    porcentajeImprevistos: 5,
  },
  mercado: { precioVentaDepasM2: 45_000, precioLocalesM2: 0 },
  tiempo: { plazoObraMeses: 18, plazoVentaMeses: 24, inicioVentasMes: 6 },
  financiamiento: { porcentajeFinanciado: 0, tasaAnualCredito: 14 },
  tirObjetivo: 25,
}

describe('valorBaseDe / aplicarVariableSensibilidad', () => {
  it('lee el valor base de cada una de las 6 variables', () => {
    expect(valorBaseDe(inputs, 'precioVenta')).toBe(45_000)
    expect(valorBaseDe(inputs, 'costoTerreno')).toBe(8_000)
    expect(valorBaseDe(inputs, 'tasaInteres')).toBe(14)
    expect(valorBaseDe(inputs, 'plazoObra')).toBe(18)
    expect(valorBaseDe(inputs, 'plazoVenta')).toBe(24)
  })

  it('costoConstruccion cae al benchmark del catálogo cuando no hay override', () => {
    expect(valorBaseDe(inputs, 'costoConstruccion')).toBeGreaterThan(0)
  })

  it('aplicarVariableSensibilidad no muta el objeto original', () => {
    const out = aplicarVariableSensibilidad(inputs, 'precioVenta', 50_000)
    expect(inputs.mercado.precioVentaDepasM2).toBe(45_000)
    expect(out.mercado.precioVentaDepasM2).toBe(50_000)
  })

  it('plazoObra/plazoVenta se redondean a mes entero y no bajan de 1', () => {
    expect(aplicarVariableSensibilidad(inputs, 'plazoObra', 12.6).tiempo.plazoObraMeses).toBe(13)
    expect(aplicarVariableSensibilidad(inputs, 'plazoVenta', 0.2).tiempo.plazoVentaMeses).toBe(1)
  })

  it('costoTerreno recalcula el costo total del terreno con la nueva superficie base', () => {
    const out = aplicarVariableSensibilidad(inputs, 'costoTerreno', 10_000)
    expect(out.terreno.costoTerreno).toBeCloseTo(10_000 * inputs.terreno.superficieM2, 6)
  })
})

describe('generarMatrizSensibilidadFlexible', () => {
  it('genera un grid 5x5 con precio de venta (fila) x costo de terreno (columna)', () => {
    const m = generarMatrizSensibilidadFlexible(
      inputs,
      { variable: 'precioVenta', rango: 0.2 },
      { variable: 'costoTerreno', rango: 0.2 },
    )
    expect(m.length).toBe(5)
    m.forEach((fila) => expect(fila.length).toBe(5))
  })

  it('la celda central coincide con el caso base (sin variación)', () => {
    const m = generarMatrizSensibilidadFlexible(
      inputs,
      { variable: 'precioVenta', rango: 0.2 },
      { variable: 'tasaInteres', rango: 0.1 },
    )
    expect(m[2][2].fila.valor).toBeCloseTo(inputs.mercado.precioVentaDepasM2, 6)
    expect(m[2][2].columna.valor).toBeCloseTo(inputs.financiamiento.tasaAnualCredito, 6)
  })

  it('a tasa fija (columna central), la TIR sube junto con el precio de venta', () => {
    const m = generarMatrizSensibilidadFlexible(
      inputs,
      { variable: 'precioVenta', rango: 0.2 },
      { variable: 'tasaInteres', rango: 0.1 },
    )
    const columnaCentral = m.map((fila) => fila[2]) // paso de tasa = 0
    for (let i = 1; i < columnaCentral.length; i++) {
      expect(columnaCentral[i].tirSocio as number).toBeGreaterThan(columnaCentral[i - 1].tirSocio as number)
    }
  })

  it('funciona con una variable de tiempo como eje (plazo de venta)', () => {
    const m = generarMatrizSensibilidadFlexible(
      inputs,
      { variable: 'plazoVenta', rango: 0.2 },
      { variable: 'precioVenta', rango: 0.2 },
    )
    expect(m[0][2].fila.variable).toBe('plazoVenta')
    expect(m[0][2].fila.valor).toBeLessThan(inputs.tiempo.plazoVentaMeses)
  })
})
