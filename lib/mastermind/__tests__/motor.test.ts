import { describe, it, expect, beforeAll } from 'vitest'
import { calcularMastermind } from '../motor'
import type { MastermindInputs, MastermindOutputs } from '../tipos'

// ── Fixture de referencia ────────────────────────────────────────────────────
// Terreno 500 m² · 4 niveles · 16 depas de 65 m² · $45,000/m² venta · sin financiamiento.
// Elegido para que m² vendibles (1,040) y m² construidos (1,700) guarden una relación
// plausible (eficiencia ~61%) y el proyecto resulte positivo (~27% margen bruto).

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
  mercado: {
    precioVentaDepasM2: 45_000,
    modalidadLocales: 'venta',
    precioLocalesM2: 0,
    tasaCapRate: 8,
  },
  tiempo: { plazoObraMeses: 18, plazoVentaMeses: 24, inicioVentasMes: 6 },
  financiamiento: { porcentajeFinanciado: 0, tasaAnualCredito: 14 },
  tirObjetivo: 25,
}

let r: MastermindOutputs

beforeAll(() => {
  r = calcularMastermind(inputs)
})

describe('Bloque 1 — Ingresos', () => {
  it('m² vendibles habitacional = 16 × 65 = 1,040', () => {
    expect(r.ingresos.m2VendiblesHabitacional).toBe(1_040)
  })
  it('ingreso bruto habitacional = 1,040 × 45,000 = 46,800,000', () => {
    expect(r.ingresos.ingresoBrutoHabitacional).toBe(46_800_000)
  })
  it('ingreso bruto comercial = 0 (sin m² comerciales)', () => {
    expect(r.ingresos.ingresoBrutoComercial).toBe(0)
  })
  it('descuentos = 5% del bruto total', () => {
    expect(r.ingresos.descuentos).toBe(46_800_000 * 0.05)
  })
  it('ingreso neto = bruto × 0.95 = 44,460,000', () => {
    expect(r.ingresos.ingresoNeto).toBe(44_460_000)
  })
})

describe('Bloque 2 — Costos', () => {
  it('m² construidos = 500 × 4 × 0.85 = 1,700', () => {
    expect(r.costos.m2Construidos).toBe(1_700)
  })
  it('costo directo = 1,700 × 13,500 (benchmark habitacional_medio) = 22,950,000', () => {
    expect(r.costos.costoDirectoConstruccion).toBe(22_950_000)
  })
  it('indirectos = 15% del directo = 3,442,500', () => {
    expect(r.costos.indirectos).toBeCloseTo(22_950_000 * 0.15, 6)
  })
  it('comercialización = 3% del ingreso neto', () => {
    expect(r.costos.comercializacion).toBeCloseTo(44_460_000 * 0.03, 6)
  })
  it('financieros = 0 (sin % financiado)', () => {
    expect(r.costos.financieros).toBe(0)
  })
  it('costo total = terreno + directo + indirectos + comercialización + financieros', () => {
    const esperado = 4_000_000 + 22_950_000 + r.costos.indirectos + r.costos.comercializacion + 0
    expect(r.costos.costoTotal).toBeCloseTo(esperado, 6)
  })
})

describe('Bloque 3 — Utilidad', () => {
  it('UAI = ingreso neto - costo total (positivo en este fixture)', () => {
    const esperado = r.ingresos.ingresoNeto - r.costos.costoTotal
    expect(r.utilidad.utilidadAntesImpuestos).toBeCloseTo(esperado, 6)
    expect(r.utilidad.utilidadAntesImpuestos).toBeGreaterThan(0)
  })
  it('margen bruto% = UAI / ingreso bruto × 100', () => {
    const esperado = (r.utilidad.utilidadAntesImpuestos / r.ingresos.ingresoBrutoTotal) * 100
    expect(r.utilidad.margenBruto).toBeCloseTo(esperado, 6)
  })
  it('margen neto% = UAI / ingreso neto × 100', () => {
    const esperado = (r.utilidad.utilidadAntesImpuestos / r.ingresos.ingresoNeto) * 100
    expect(r.utilidad.margenNeto).toBeCloseTo(esperado, 6)
  })
})

describe('Bloque 4 — Retorno', () => {
  it('punto de equilibrio = 12 unidades (11 da UAI negativo, 12 positivo)', () => {
    expect(r.retorno.puntoEquilibrioUnidades).toBe(12)
  })
  it('inversión socios = inversión proyecto cuando % financiado = 0 (sin apalancamiento)', () => {
    expect(r.retorno.inversionSocios).toBeCloseTo(r.retorno.inversionProyecto, 6)
  })
  it('TIR Socio y TIR Proyecto coinciden cuando % financiado = 0', () => {
    expect(r.retorno.tirSocioConverge).toBe(true)
    expect(r.retorno.tirProyectoConverge).toBe(true)
    expect(r.retorno.tirSocioAnual).toBeCloseTo(r.retorno.tirProyectoAnual as number, 3)
  })
  it('TIR positiva y razonable para un proyecto rentable', () => {
    expect(r.retorno.tirSocioAnual as number).toBeGreaterThan(0)
    expect(r.retorno.tirSocioAnual as number).toBeLessThan(500)
  })
  it('ROI simple = UAI / inversión socios × 100', () => {
    const esperado = (r.utilidad.utilidadAntesImpuestos / r.retorno.inversionSocios) * 100
    expect(r.retorno.roiSimple).toBeCloseTo(esperado, 6)
  })
})

describe('Apalancamiento: % financiado mueve la TIR Socio pero no la TIR Proyecto', () => {
  it('con 50% financiado, TIR Socio > TIR Proyecto (efecto de apalancamiento clásico)', () => {
    const apalancado = calcularMastermind({
      ...inputs,
      financiamiento: { porcentajeFinanciado: 50, tasaAnualCredito: 14 },
    })
    expect(apalancado.retorno.tirSocioConverge).toBe(true)
    expect(apalancado.retorno.tirProyectoConverge).toBe(true)
    expect(apalancado.retorno.tirSocioAnual as number).toBeGreaterThan(apalancado.retorno.tirProyectoAnual as number)
    // TIR Proyecto no depende del financiamiento (unlevered) — debe mantenerse igual al caso sin apalancar
    expect(apalancado.retorno.tirProyectoAnual).toBeCloseTo(r.retorno.tirProyectoAnual as number, 3)
  })
})

describe('Modalidad renta: no debe duplicar el valor capitalizado de locales', () => {
  it('ingresos totales del flujo = habitacional neto - comercialización + remanente comercial (una sola vez)', () => {
    const rentaInputs: MastermindInputs = {
      ...inputs,
      proyecto: { ...inputs.proyecto, m2ComercialesPlantaBaja: 200 },
      mercado: { ...inputs.mercado, modalidadLocales: 'renta', precioLocalesM2: 150 },
    }
    const rRenta = calcularMastermind(rentaInputs)

    // Los egresos de obra (aportación de construcción + indirectos + financieros) y el egreso de
    // terreno se conocen de antemano; lo que reste del flujo total son los ingresos por ventas +
    // remanente — así se aísla el lado de ingresos sin depender de cómo se reparten mes a mes.
    const aportacionSociosPct = 100 - rentaInputs.financiamiento.porcentajeFinanciado
    const egresoTerreno = rentaInputs.terreno.costoTerreno
    const egresoObra = (aportacionSociosPct / 100) * rRenta.costos.costoDirectoConstruccion
      + rRenta.costos.indirectos + rRenta.costos.financieros
    const totalFlujo = rRenta.flujoSocio.reduce((a, b) => a + b, 0)
    const totalIngresos = totalFlujo + egresoTerreno + egresoObra

    const esperado = rRenta.ingresos.ingresoBrutoHabitacional * 0.95 - rRenta.costos.comercializacion + rRenta.ingresos.ingresoBrutoComercial
    expect(totalIngresos).toBeCloseTo(esperado, 6)
  })
})
