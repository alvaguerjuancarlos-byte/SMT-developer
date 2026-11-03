import { describe, it, expect } from 'vitest'
import { esMinibodegas, calcularModeloRenta, stressTestRenta, armarEntradaRenta, rentaParaTir } from '../minibodegas'

describe('esMinibodegas', () => {
  it('detecta el tipo propio y el texto de "Otra idea"', () => {
    expect(esMinibodegas(['minibodegas'])).toBe(true)
    expect(esMinibodegas(['otro'], 'Construcción de minibodegas')).toBe(true)
    expect(esMinibodegas(['otro'], 'mini-bodegas para renta')).toBe(true)
    expect(esMinibodegas(['otro'], 'Self Storage')).toBe(true)
    expect(esMinibodegas(['otro'], 'renta de bodegas pequeñas')).toBe(true)
  })
  it('no confunde otros proyectos', () => {
    expect(esMinibodegas(['industrial'])).toBe(false)
    expect(esMinibodegas(['otro'], 'nave industrial con bodega')).toBe(false)
    expect(esMinibodegas(['residencial-vertical'], 'minibodegas')).toBe(false)
    expect(esMinibodegas(undefined)).toBe(false)
  })
})

const BASE = { costoTerreno: 5_000_000, costoObraTotal: 20_000_000, areaRentableM2: 2_000, rentaM2Mes: 250, plazoObraMeses: 10 }

describe('calcularModeloRenta', () => {
  const r = calcularModeloRenta(BASE)

  it('NOI y valor del activo estabilizados', () => {
    // 2,000 m² × $250 × 88% × 12 = $5.28M; opex 35% → NOI $3.432M; cap 10% → $34.32M
    expect(r.ingresoBrutoEstabilizadoAnual).toBeCloseTo(5_280_000, 0)
    expect(r.noiEstabilizadoAnual).toBeCloseTo(3_432_000, 0)
    expect(r.valorActivo).toBeCloseTo(34_320_000, 0)
    expect(r.yieldOnCostPct).toBeCloseTo(13.728, 2)
    expect(r.margenDesarrolloPct).toBeCloseTo(37.28, 1)
  })

  it('ocupación sube de la apertura a la estabilización y no pasa del tope', () => {
    expect(r.mesApertura).toBe(11)
    expect(r.ocupacionPorMes[10]).toBe(0)
    expect(r.ocupacionPorMes[11]).toBeCloseTo(0.10, 5)
    expect(r.ocupacionPorMes[r.mesEstabilizacion]).toBeCloseTo(0.88, 5)
    expect(Math.max(...r.ocupacionPorMes)).toBeCloseTo(0.88, 5)
  })

  it('horizonte de 7 años de operación con venta del activo al final', () => {
    expect(r.mesSalida).toBe(10 + 84)
    expect(r.flujoProyecto.length).toBe(95)
    expect(r.flujoProyecto[94]).toBeGreaterThan(30_000_000)
  })

  it('TIR calculables; apalancar ayuda solo si la deuda cuesta menos que la TIR del proyecto', () => {
    expect(r.tirProyectoConverge).toBe(true)
    expect(r.tirSocioConverge).toBe(true)
    expect(r.tirProyectoAnual!).toBeGreaterThan(5)
    // Deuda al 13.5% > TIR proyecto (~12.4%): el socio gana menos que el proyecto.
    expect(r.tirSocioAnual!).toBeLessThan(r.tirProyectoAnual!)
    const barata = calcularModeloRenta({ ...BASE, tasaDeudaAnual: 8 })
    expect(barata.tirSocioAnual!).toBeGreaterThan(barata.tirProyectoAnual!)
  })

  it('primeros meses de operación pierden dinero (opex fijo con baja ocupación)', () => {
    expect(r.flujoProyecto[r.mesApertura]).toBeLessThan(0)
  })

  it('deuda y equity suman la inversión', () => {
    expect(r.montoEquity + r.montoDeuda).toBeCloseTo(25_000_000, 0)
  })
})

describe('stressTestRenta', () => {
  it('los tres escenarios empeoran la TIR de proyecto', () => {
    for (const s of stressTestRenta(BASE)) {
      expect(s.resultado.tirProyectoAnual!).toBeLessThan(s.base.tirProyectoAnual!)
    }
  })
})

describe('armarEntradaRenta', () => {
  const base = { costoTerreno: 5_000_000, costoTotalConstruccion: 20_000_000, superficieConstruida: 2_800, areaRentableM2: 2_000, rentaM2Mes: 250, rangoHonorarios: { min: 7, max: 9 } }
  it('suma indirectos, honorarios e imprevistos a la obra y fija el plazo por superficie', () => {
    const r = armarEntradaRenta(base)
    expect(r.indirectos).toBe(3_300_000)
    expect(r.honorarios).toBe(1_600_000)
    expect(r.imprevistos).toBe(1_000_000)
    expect(r.entrada.costoObraTotal).toBe(25_900_000)
    expect(r.plazoObraMeses).toBe(10)
  })
  it('los ajustes del usuario tienen prioridad sobre Mercado', () => {
    const r = armarEntradaRenta({ ...base, ocupacionEstabilizadaPct: 80, usuario: { rentaM2Mes: 300, ocupacionEstabilizadaPct: 90, capRatePct: 9, tasaDeudaAnual: 11 } })
    expect(r.entrada.rentaM2Mes).toBe(300)
    expect(r.entrada.ocupacionEstabilizada).toBeCloseTo(0.9)
    expect(r.entrada.capRateSalida).toBeCloseTo(0.09)
    expect(r.entrada.tasaDeudaAnual).toBe(11)
    expect(armarEntradaRenta({ ...base, ocupacionEstabilizadaPct: 80 }).entrada.ocupacionEstabilizada).toBeCloseTo(0.8)
  })
})

describe('rentaParaTir', () => {
  it('encuentra la renta mínima que da la TIR objetivo', () => {
    const renta = rentaParaTir(BASE, 15)!
    expect(renta).toBeGreaterThan(250)
    expect(calcularModeloRenta({ ...BASE, rentaM2Mes: renta }).tirProyectoAnual!).toBeGreaterThanOrEqual(15)
    expect(calcularModeloRenta({ ...BASE, rentaM2Mes: renta - 2 }).tirProyectoAnual!).toBeLessThan(15)
  })
  it('null si ni con la renta máxima se alcanza', () => {
    expect(rentaParaTir({ ...BASE, costoObraTotal: 2_000_000_000 }, 15)).toBeNull()
  })
})
