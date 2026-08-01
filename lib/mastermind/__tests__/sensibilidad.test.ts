import { describe, it, expect } from 'vitest'
import { generarMatrizSensibilidad } from '../sensibilidad'
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

describe('generarMatrizSensibilidad', () => {
  it('genera un grid 5x5', () => {
    const m = generarMatrizSensibilidad(inputs)
    expect(m.length).toBe(5)
    m.forEach(fila => expect(fila.length).toBe(5))
  })

  it('a benchmark fijo (fila central), la TIR crece con el precio de venta', () => {
    const m = generarMatrizSensibilidad(inputs)
    const filaCentral = m[2] // paso de benchmark = 0
    for (let i = 1; i < filaCentral.length; i++) {
      expect(filaCentral[i].tirSocio as number).toBeGreaterThan(filaCentral[i - 1].tirSocio as number)
    }
  })

  it('a precio fijo (columna central), la TIR baja al subir el benchmark de construcción', () => {
    const m = generarMatrizSensibilidad(inputs)
    const columnaCentral = m.map(fila => fila[2]) // paso de precio = 0
    for (let i = 1; i < columnaCentral.length; i++) {
      expect(columnaCentral[i].tirSocio as number).toBeLessThan(columnaCentral[i - 1].tirSocio as number)
    }
  })

  it('la celda central coincide con la TIR del motor sin variaciones', () => {
    const m = generarMatrizSensibilidad(inputs)
    expect(m[2][2].precioVentaM2).toBeCloseTo(inputs.mercado.precioVentaDepasM2, 6)
  })
})
