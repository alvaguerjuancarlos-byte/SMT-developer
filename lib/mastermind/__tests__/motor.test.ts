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
    porcentajeIndirectos: 15,
  },
  mercado: {
    precioVentaDepasM2: 45_000,
    precioLocalesM2: 0,
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

describe('Base financiable: la deuda cubre terreno + construcción + indirectos, no solo construcción', () => {
  // El análisis exige montoEquity + montoDeuda = inversionTotal — la deuda real se dimensiona
  // sobre todo lo anterior a financieros, no solo el costo directo de construcción. Este test
  // fija el valor exacto para detectar si alguien vuelve a angostar la base sin querer.
  it('financieros e inversionSocios usan costoTerreno + costoDirectoConstruccion + indirectos como base', () => {
    const apalancado = calcularMastermind({
      ...inputs,
      financiamiento: { porcentajeFinanciado: 50, tasaAnualCredito: 14 },
    })
    // baseFinanciable = 4,000,000 (terreno) + 22,950,000 (directo) + 3,442,500 (indirectos 15%) = 30,392,500
    const baseFinanciable = 4_000_000 + 22_950_000 + 3_442_500
    const financierosEsperado = 0.5 * baseFinanciable * (0.14 / 12) * 18
    expect(apalancado.costos.financieros).toBeCloseTo(financierosEsperado, 2)
    // inversionSocios = 50% de la misma base (antes solo el terreno + indirectos quedaban
    // 100% a cargo del socio, y solo costoDirectoConstruccion se apalancaba)
    expect(apalancado.retorno.inversionSocios).toBeCloseTo(0.5 * baseFinanciable, 2)
  })
})

describe('Principal de la deuda: debe repagarse, no regalarse', () => {
  // Bug real encontrado en producción: la porción financiada nunca se restaba del flujo del
  // socio (solo se cobraba el interés), así que un proyecto que pierde dinero sin apalancar
  // podía mostrar una TIR Socio positiva — el banco "regalaba" el principal. La invariante que
  // debe cumplirse siempre (cualquier % financiado) es que la suma del flujo del socio sea
  // igual a la utilidad antes de impuestos del proyecto completo — el apalancamiento cambia
  // CUÁNDO y CONTRA QUÉ BASE se gana o se pierde, no CUÁNTO se gana o se pierde en total.
  it('la suma del flujo del socio = utilidad antes de impuestos, sin importar el % financiado', () => {
    for (const porcentajeFinanciado of [0, 30, 55, 100]) {
      const r = calcularMastermind({
        ...inputs,
        financiamiento: { porcentajeFinanciado, tasaAnualCredito: 14 },
      })
      const sumaFlujoSocio = r.flujoSocio.reduce((a, b) => a + b, 0)
      expect(sumaFlujoSocio).toBeCloseTo(r.utilidad.utilidadAntesImpuestos, 2)
    }
  })

  it('un proyecto que pierde dinero sin apalancar, pierde más (no gana) apalancado — nunca positivo por el solo hecho de financiarse', () => {
    const perdedor: MastermindInputs = {
      ...inputs,
      mercado: { ...inputs.mercado, precioVentaDepasM2: 30_000 }, // fuerza margen negativo
    }
    const sinApalancar = calcularMastermind({ ...perdedor, financiamiento: { porcentajeFinanciado: 0, tasaAnualCredito: 14 } })
    const apalancado = calcularMastermind({ ...perdedor, financiamiento: { porcentajeFinanciado: 55, tasaAnualCredito: 14 } })
    expect(sinApalancar.utilidad.utilidadAntesImpuestos).toBeLessThan(0)
    expect(apalancado.retorno.tirSocioAnual as number).toBeLessThan(0)
    // Apalancar un proyecto perdedor amplifica la pérdida relativa al equity, nunca la convierte en ganancia.
    expect(apalancado.retorno.tirSocioAnual as number).toBeLessThan(apalancado.retorno.tirProyectoAnual as number)
  })
})

describe('superficieConstruccionM2 — anula la estimación por huella de terreno', () => {
  it('sin superficieConstruccionM2, usa superficieM2(terreno) × niveles × factor (comportamiento previo)', () => {
    expect(r.costos.m2Construidos).toBe(1_700)
  })

  it('con superficieConstruccionM2 > 0, la usa tal cual en vez de recalcularla del terreno', () => {
    const rReal = calcularMastermind({
      ...inputs,
      proyecto: { ...inputs.proyecto, superficieConstruccionM2: 1_040 },
    })
    expect(rReal.costos.m2Construidos).toBe(1_040)
    expect(rReal.costos.costoDirectoConstruccion).toBe(1_040 * 13_500)
  })

  it('con superficieConstruccionM2 = 0, cae de vuelta a la estimación por terreno (0 se trata como "sin dato")', () => {
    const rCero = calcularMastermind({
      ...inputs,
      proyecto: { ...inputs.proyecto, superficieConstruccionM2: 0 },
    })
    expect(rCero.costos.m2Construidos).toBe(1_700)
  })
})

describe('porcentajeIndirectos — ahora es un input por proyecto, no una constante fija', () => {
  it('con 15% (default), indirectos = 15% del directo = 3,442,500 (comportamiento previo)', () => {
    expect(r.costos.indirectos).toBe(22_950_000 * 0.15)
  })

  it('con un % distinto (20%), indirectos y costoTotal cambian en consecuencia', () => {
    const r20 = calcularMastermind({
      ...inputs,
      proyecto: { ...inputs.proyecto, porcentajeIndirectos: 20 },
    })
    expect(r20.costos.indirectos).toBe(22_950_000 * 0.20)
    expect(r20.costos.costoTotal).toBe(r.costos.costoTotal + (22_950_000 * 0.05))
  })
})
