import { describe, it, expect } from 'vitest'
import { detectarAnomalias } from '../diagnostico'
import type { MastermindInputs } from '../tipos'

const inputsViable: MastermindInputs = {
  terreno: { costoTerreno: 4_000_000, costoTerrenoM2: 8_000, superficieM2: 500 },
  proyecto: {
    tipoProyecto: 'vertical_mixto',
    niveles: 4,
    unidadesHabitacionales: 16,
    m2PromedioDepa: 65,
    m2ComercialesPlantaBaja: 0,
    benchmarkConstruccion: 'habitacional_medio',
    porcentajeIndirectos: 15,
  },
  mercado: { precioVentaDepasM2: 45_000, precioLocalesM2: 0 },
  tiempo: { plazoObraMeses: 18, plazoVentaMeses: 24, inicioVentasMes: 6 },
  financiamiento: { porcentajeFinanciado: 0, tasaAnualCredito: 14 },
  tirObjetivo: 25,
}

describe('detectarAnomalias', () => {
  it('sin banda ni costo real de referencia, no genera alertas', () => {
    expect(detectarAnomalias(inputsViable)).toEqual([])
  })

  it('costo de terreno dentro del rango de su banda, sin alerta', () => {
    const inputs: MastermindInputs = {
      ...inputsViable,
      terreno: { ...inputsViable.terreno, bandaTerreno: 1, costoTerrenoM2: 9_000 }, // Banda 1: 7,000-10,500
    }
    expect(detectarAnomalias(inputs)).toEqual([])
  })

  it('costo de terreno muy por encima de su banda, genera alerta de severidad alta', () => {
    const inputs: MastermindInputs = {
      ...inputsViable,
      terreno: { ...inputsViable.terreno, bandaTerreno: 1, costoTerrenoM2: 20_000 }, // Banda 1: 7,000-10,500
    }
    const alertas = detectarAnomalias(inputs)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].campo).toBe('costoTerrenoM2')
    expect(alertas[0].severidad).toBe('alta')
  })

  it('costo de construcción calculado ($12,000/m²) fuera de la banda económica ($7,000-$10,500), genera alerta', () => {
    const inputs: MastermindInputs = {
      ...inputsViable,
      proyecto: { ...inputsViable.proyecto, bandaConstruccion: 1, costoConstruccionRealM2: 12_000 },
    }
    const alertas = detectarAnomalias(inputs)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].campo).toBe('costoConstruccionM2')
    expect(alertas[0].valorReal).toBe(12_000)
  })

  it('costo de construcción apenas fuera de rango (dentro de la tolerancia), severidad leve', () => {
    const inputs: MastermindInputs = {
      ...inputsViable,
      proyecto: { ...inputsViable.proyecto, bandaConstruccion: 1, costoConstruccionRealM2: 10_800 }, // 2.9% sobre 10,500
    }
    const alertas = detectarAnomalias(inputs)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].severidad).toBe('leve')
  })
})
