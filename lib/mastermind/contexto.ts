// Extracción defensiva del contexto de terreno/proyecto/mercado/financiamiento desde
// el análisis IA ya generado (localStorage['smt_analisis_data']) para precargar
// Mastermind sin que el usuario tenga que reingresar datos ya conocidos.

import type { AnalisisData } from '@/lib/analisis/tipos'
import { BENCHMARKS_CONSTRUCCION_MXN_M2 } from './catalogo'
import type { BenchmarkConstruccion, InputsFinanciamiento, InputsMercado, InputsProyecto, TerrenoContext, TipoProyecto } from './tipos'

export function extractTerrenoContext(d: AnalisisData | null | undefined): TerrenoContext {
  if (!d) {
    return { costoTerreno: 0, costoTerrenoM2: 0, superficieM2: 0 }
  }

  const costoTerreno = d.bitacoraTerreno?.costoTotalTerreno ?? d.financiero?.costoTerreno ?? 0
  const superficieM2 = d.bitacoraTerreno?.superficieM2 ?? 0
  const costoTerrenoM2 = d.financiero?.costoTerrenoM2 ?? (superficieM2 > 0 ? costoTerreno / superficieM2 : 0)

  return {
    costoTerreno,
    costoTerrenoM2,
    superficieM2,
    bandaTerreno: d.bitacoraTerreno?.bandaTerreno,
    municipio: d.fichaLegal?.municipio,
  }
}

// Benchmark de costo de construcción más cercano al costo real que ya validó el
// Agente Construcción — más robusto que mapear por número de banda porque se
// ancla al $/m² efectivo en vez de una escala 1-4 que no corresponde 1:1 con
// las 6 categorías del catálogo.
function benchmarkMasCercano(costoPorM2Final: number): BenchmarkConstruccion {
  let mejor: BenchmarkConstruccion = 'habitacional_medio'
  let mejorDiff = Infinity
  for (const [key, valor] of Object.entries(BENCHMARKS_CONSTRUCCION_MXN_M2)) {
    const diff = Math.abs(valor - costoPorM2Final)
    if (diff < mejorDiff) { mejorDiff = diff; mejor = key as BenchmarkConstruccion }
  }
  return mejor
}

export function extractProyectoContext(d: AnalisisData | null | undefined): Partial<InputsProyecto> {
  const tip = d?.bitacoraConstruccion?.tipologiaPropuesta
  if (!tip) return {}

  const out: Partial<InputsProyecto> = {}

  const tieneHab = !!tip.habitacional
  const tieneCom = !!tip.comercial
  const tipoProyecto: TipoProyecto | undefined =
    tieneHab && tieneCom ? 'vertical_mixto' : tieneCom ? 'comercial' : tieneHab ? 'habitacional' : undefined
  if (tipoProyecto) out.tipoProyecto = tipoProyecto

  if (tip.niveles) out.niveles = tip.niveles

  const mix = tip.habitacional?.mix ?? []
  const totalUnidades = mix.reduce((s, r) => s + (r.unidades || 0), 0)
  if (tip.habitacional && totalUnidades > 0) {
    out.unidadesHabitacionales = tip.habitacional.totalDepartamentos ?? totalUnidades
    const m2Ponderado = mix.reduce((s, r) => s + (r.unidades || 0) * (r.m2Promedio || 0), 0) / totalUnidades
    out.m2PromedioDepa = Math.round(m2Ponderado)
  }

  const superficieConstruida = d?.bitacoraConstruccion?.superficieConstruccionM2 ?? 0
  if (tip.comercial) {
    const areaHab = (out.unidadesHabitacionales ?? 0) * (out.m2PromedioDepa ?? 0)
    out.m2ComercialesPlantaBaja = Math.max(0, Math.round(superficieConstruida - areaHab))
  }

  const costoPorM2Final = d?.bitacoraConstruccion?.costoPorM2Final
  if (costoPorM2Final) out.benchmarkConstruccion = benchmarkMasCercano(costoPorM2Final)

  return out
}

export function extractMercadoContext(d: AnalisisData | null | undefined): Partial<InputsMercado> {
  if (!d) return {}
  const out: Partial<InputsMercado> = {}

  const precioVentaM2 = d.financiero?.precioVentaM2
  if (precioVentaM2) {
    out.precioVentaDepasM2 = precioVentaM2
  } else {
    const digitos = Number((d.mercado?.precioPromedioZona ?? '').replace(/[^0-9]/g, ''))
    if (digitos > 0) out.precioVentaDepasM2 = digitos
  }

  const segmentoLocal = d.mercado?.segmentacion?.find(s => /local|comercial/i.test(s.tipo))
  if (segmentoLocal?.precioM2) out.precioLocalesM2 = segmentoLocal.precioM2

  return out
}

export function extractFinanciamientoContext(d: AnalisisData | null | undefined): Partial<InputsFinanciamiento> {
  if (!d?.estructuraCapital) return {}
  const out: Partial<InputsFinanciamiento> = {}

  if (typeof d.estructuraCapital.deuda === 'number') {
    out.porcentajeFinanciado = d.estructuraCapital.deuda
  }

  const tasas = [...(d.estructuraCapital.tasaDeuda ?? '').matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
  if (tasas.length > 0) {
    out.tasaAnualCredito = Number(tasas[tasas.length - 1][1])
  }

  return out
}
