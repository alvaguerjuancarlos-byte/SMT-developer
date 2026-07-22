import { describe, it, expect } from 'vitest'
import { calcularFlujoFinanciero } from '../flujoFinanciero'
import type { InputsFlujoFinanciero } from '../flujoFinanciero'

// Fixture de referencia — proyecto rentable, 40% equity / 60% deuda, similar a lo que
// propone el Agente Financiero para un proyecto de tamaño medio.
const inputs: InputsFlujoFinanciero = {
  costoTerreno: 23_913_600,
  costoTotalConstruccion: 95_691_900,
  indirectos: 15_310_704,
  honorarios: 8_612_271,
  imprevistos: 4_784_580,
  ingresosNetos: 87_934_755,
  comercializacion: 2_638_043,
  plazoObraMeses: 30,
  plazoVentaMeses: 38,
  inicioVentasMes: 3,
  porcentajeEquity: 45,
  tasaAnualCredito: 14.5,
}

describe('calcularFlujoFinanciero — caso real (proyecto "Torre del Angel", perdedor)', () => {
  const r = calcularFlujoFinanciero(inputs)

  it('montoEquity + montoDeuda = costoTerreno + costoObraTotal (base financiable completa)', () => {
    const baseFinanciable = inputs.costoTerreno + inputs.costoTotalConstruccion + inputs.indirectos + inputs.honorarios + inputs.imprevistos
    expect(r.montoEquity + r.montoDeuda).toBeCloseTo(baseFinanciable, 2)
  })

  it('TIR Proyecto y TIR Socio ambas negativas — un proyecto que pierde 42% de margen bruto no puede dar TIR positiva', () => {
    expect(r.tirProyectoConverge).toBe(true)
    expect(r.tirSocioConverge).toBe(true)
    expect(r.tirProyectoAnual as number).toBeLessThan(0)
    expect(r.tirSocioAnual as number).toBeLessThan(0)
  })

  it('apalancar un proyecto perdedor amplifica la pérdida — TIR Socio < TIR Proyecto', () => {
    expect(r.tirSocioAnual as number).toBeLessThan(r.tirProyectoAnual as number)
  })
})

describe('calcularFlujoFinanciero — invariante de apalancamiento', () => {
  it('la suma del flujo del socio = utilidad total (ingresoNetoVentas - baseFinanciable - costoFinanciero), sin importar el % de equity', () => {
    const costoObraTotal = inputs.costoTotalConstruccion + inputs.indirectos + inputs.honorarios + inputs.imprevistos
    const ingresoNetoVentas = inputs.ingresosNetos - inputs.comercializacion
    for (const porcentajeEquity of [0, 30, 45, 100]) {
      const r = calcularFlujoFinanciero({ ...inputs, porcentajeEquity })
      const sumaFlujoSocio = r.flujoSocio.reduce((a, b) => a + b, 0)
      const utilidadEsperada = ingresoNetoVentas - inputs.costoTerreno - costoObraTotal - r.costoFinanciero
      expect(sumaFlujoSocio).toBeCloseTo(utilidadEsperada, 2)
    }
  })

  it('con 0% financiado, TIR Socio = TIR Proyecto (sin deuda no hay nada que separar)', () => {
    const r = calcularFlujoFinanciero({ ...inputs, porcentajeEquity: 100 })
    expect(r.montoDeuda).toBe(0)
    expect(r.tirSocioAnual as number).toBeCloseTo(r.tirProyectoAnual as number, 4)
  })
})

describe('calcularFlujoFinanciero — proyecto rentable, el apalancamiento debe ayudar (no dañar)', () => {
  it('con un margen positivo, TIR Socio > TIR Proyecto (apalancamiento clásico)', () => {
    const rentable: InputsFlujoFinanciero = {
      ...inputs,
      ingresosNetos: 220_000_000, // sube el precio de venta hasta que el proyecto sea rentable
    }
    const r = calcularFlujoFinanciero(rentable)
    expect(r.tirProyectoConverge).toBe(true)
    expect(r.tirSocioConverge).toBe(true)
    expect(r.tirProyectoAnual as number).toBeGreaterThan(0)
    expect(r.tirSocioAnual as number).toBeGreaterThan(r.tirProyectoAnual as number)
  })
})
