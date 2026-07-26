import { describe, it, expect } from 'vitest'
import { detectarAnomalias, diagnosticarViabilidad } from '../diagnostico'
import { calcularMastermind } from '../motor'
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
  mercado: { precioVentaDepasM2: 45_000, modalidadLocales: 'venta', precioLocalesM2: 0, tasaCapRate: 8 },
  tiempo: { plazoObraMeses: 18, plazoVentaMeses: 24, inicioVentasMes: 6 },
  financiamiento: { porcentajeFinanciado: 0, tasaAnualCredito: 14 },
  tirObjetivo: 25,
}

describe('diagnosticarViabilidad', () => {
  it('proyecto viable: viable=true y sin causa principal', () => {
    const outputs = calcularMastermind(inputsViable)
    const d = diagnosticarViabilidad(inputsViable, outputs)
    expect(d.viable).toBe(true)
    expect(d.causaPrincipal).toBeNull()
    expect(d.causas.every(c => c.cumple)).toBe(true)
  })

  it('terreno carísimo: la causa principal es costoTerreno y su brecha es la mayor', () => {
    const inputsCaros: MastermindInputs = {
      ...inputsViable,
      terreno: { ...inputsViable.terreno, costoTerreno: 15_000_000, costoTerrenoM2: 30_000 },
    }
    const outputs = calcularMastermind(inputsCaros)
    const d = diagnosticarViabilidad(inputsCaros, outputs)
    expect(d.viable).toBe(false)
    expect(d.causaPrincipal?.palanca).toBe('costoTerreno')
    // la brecha del terreno debe ser la más grande de todas
    expect(d.causas[0].palanca).toBe('costoTerreno')
  })

  it('precio de venta muy bajo: la causa principal es precioVenta', () => {
    const inputsBaratos: MastermindInputs = {
      ...inputsViable,
      mercado: { ...inputsViable.mercado, precioVentaDepasM2: 15_000 },
    }
    const outputs = calcularMastermind(inputsBaratos)
    const d = diagnosticarViabilidad(inputsBaratos, outputs)
    expect(d.viable).toBe(false)
    expect(d.causaPrincipal?.palanca).toBe('precioVenta')
  })

  it('las causas que sí cumplen quedan marcadas cumple=true con brecha 0', () => {
    const outputs = calcularMastermind(inputsViable)
    const d = diagnosticarViabilidad(inputsViable, outputs)
    for (const c of d.causas) {
      if (c.cumple) expect(c.brechaPct).toBe(0)
    }
  })
})

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
