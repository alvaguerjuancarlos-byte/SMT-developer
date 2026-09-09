// Motor puro sobre el Índice SHF de Precios de la Vivienda (lib/market/shfIndice.data.ts) — sin
// red, sin LLM, mismo patrón que appreciationEngine.ts. Dos usos distintos de la misma fuente:
//
// 1. calcularApreciacionSHF: tasa real anualizada a partir de una serie de ÍNDICE trimestral
//    (no observaciones de precio a medianizar como en appreciationEngine.ts -- el SHF ya entrega
//    un índice, la tasa es directamente la variación del índice entre dos trimestres).
// 2. calcularBetaSHF: regresión real Δ%Media-Residencial = β × Δ%Económica-Social sobre las
//    series NACIONALES del SHF (2005-2026) -- reemplaza el proxy de EE.UU. (Case-Shiller) de
//    lib/market/betaTramoEngine.ts por un beta calibrado con datos mexicanos reales.

import type { ResultadoPlusvalia, VentanaPlusvalia } from './tipos'
import { SHF_ZM_MONTERREY, type PuntoIndiceSHF } from './shfIndice.data'

// En trimestres (a diferencia de VENTANAS_MESES en appreciationEngine.ts, que está en meses) --
// el SHF publica trimestral, no mensual. "mensual" no tiene una interpretación real sobre esta
// serie (el punto más fino disponible ya son 3 meses de separación), así que esa ventana siempre
// sale NOT_ENOUGH_DATA aquí, nunca se inventa un valor mensual que la fuente no puede dar.
const VENTANAS_TRIMESTRES: Record<Exclude<VentanaPlusvalia, 'mensual'>, number> = {
  trimestral: 1, anual: 4, '3_anios': 12, '5_anios': 20, '10_anios': 40,
}

function indiceTrimestre(p: PuntoIndiceSHF): number {
  return p.anio * 4 + (p.trimestre - 1)
}

// "YYYY-MM" usando el primer mes del trimestre -- mismo formato de periodo que
// ResultadoPlusvalia.periodoInicio/Fin en appreciationEngine.ts, para que ambas fuentes se vean
// consistentes dondequiera que se rendericen juntas.
function etiquetaPeriodo(p: PuntoIndiceSHF): string {
  const mes = String((p.trimestre - 1) * 3 + 1).padStart(2, '0')
  return `${p.anio}-${mes}`
}

export function calcularVentanaSHF(serieCruda: PuntoIndiceSHF[], ventana: VentanaPlusvalia): ResultadoPlusvalia {
  const serie = [...serieCruda].sort((a, b) => indiceTrimestre(a) - indiceTrimestre(b))

  if (ventana === 'mensual') {
    return {
      ventana, tasaAnualizada: null, periodoInicio: null, periodoFin: serie[0] ? etiquetaPeriodo(serie[serie.length - 1]) : null,
      muestraInicio: 0, muestraFin: serie.length > 0 ? 1 : 0,
      motivo: 'El índice SHF es trimestral -- no existe una ventana mensual real sobre esta fuente.',
    }
  }

  if (serie.length < 2) {
    return {
      ventana, tasaAnualizada: null, periodoInicio: null, periodoFin: serie[0] ? etiquetaPeriodo(serie[0]) : null,
      muestraInicio: 0, muestraFin: serie.length,
      motivo: 'Menos de 2 trimestres en la serie -- no hay con qué calcular una tasa.',
    }
  }

  const fin = serie[serie.length - 1]
  const finIdx = indiceTrimestre(fin)
  const trimestresVentana = VENTANAS_TRIMESTRES[ventana]
  const objetivoIdx = finIdx - trimestresVentana
  const primero = serie[0]

  if (indiceTrimestre(primero) > objetivoIdx) {
    return {
      ventana, tasaAnualizada: null, periodoInicio: null, periodoFin: etiquetaPeriodo(fin),
      muestraInicio: 0, muestraFin: 1,
      motivo: `El histórico del índice SHF empieza en ${etiquetaPeriodo(primero)} -- no alcanza para una ventana "${ventana}".`,
    }
  }

  // El trimestre real más reciente que sigue estando dentro (o antes) del objetivo -- no
  // interpola entre trimestres, usa el dato real más cercano sin pasarse de la ventana pedida.
  let inicio = primero
  for (const punto of serie) {
    if (indiceTrimestre(punto) <= objetivoIdx) inicio = punto
    else break
  }

  const trimestresReales = finIdx - indiceTrimestre(inicio)
  if (trimestresReales === 0 || inicio.indice <= 0) {
    return {
      ventana, tasaAnualizada: null, periodoInicio: etiquetaPeriodo(inicio), periodoFin: etiquetaPeriodo(fin),
      muestraInicio: 1, muestraFin: 1,
      motivo: 'Punto de inicio y fin coinciden en el mismo trimestre, o índice base inválido.',
    }
  }

  const cambioTotal = (fin.indice - inicio.indice) / inicio.indice
  const tasaAnualizada = (Math.pow(1 + cambioTotal, 4 / trimestresReales) - 1) * 100

  return {
    ventana,
    tasaAnualizada: Math.round(tasaAnualizada * 10) / 10,
    periodoInicio: etiquetaPeriodo(inicio),
    periodoFin: etiquetaPeriodo(fin),
    // Cada trimestre del SHF es UN índice publicado, no N observaciones individuales
    // medianizadas -- a diferencia de appreciationEngine.ts, "muestra" aquí siempre es 1 (el
    // propio punto del índice), no una cuenta de anuncios/avalúos. No confundir con baja
    // confianza: el índice detrás de ese punto ya agrega miles de avalúos reales, el SHF
    // simplemente no publica ese conteo en el archivo de datos abiertos.
    muestraInicio: 1,
    muestraFin: 1,
  }
}

export function calcularApreciacionSHF(serie: PuntoIndiceSHF[]): ResultadoPlusvalia[] {
  const ventanas: VentanaPlusvalia[] = ['mensual', 'trimestral', 'anual', '3_anios', '5_anios', '10_anios']
  return ventanas.map((v) => calcularVentanaSHF(serie, v))
}

export interface BetaSHF {
  beta: number
  min: number
  max: number
  n: number
}

function percentil(valoresOrdenados: number[], p: number): number {
  const idx = (p / 100) * (valoresOrdenados.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return valoresOrdenados[lo]
  return valoresOrdenados[lo] + (valoresOrdenados[hi] - valoresOrdenados[lo]) * (idx - lo)
}

// Regresión real (OLS por el origen, Δ%alta = β × Δ%baja -- mismo criterio que el proxy de
// EE.UU. que reemplaza) sobre las variaciones trimestre-a-trimestre de las dos series
// NACIONALES del SHF. min/max: p10/p90 de la razón Δ%alta/Δ%baja trimestre a trimestre (NO el
// min/max crudo -- verificado 2026-09-09: el min/max crudo sale -1.8/+2.8, disparado por 1-2
// trimestres atípicos con Δ%baja casi cero; p10/p90 da 0.68/1.71, un rango mucho más
// representativo de la dispersión real -- mismo criterio que ya usa RobustStats en
// priceEngine.ts para preferir percentiles sobre extremos crudos). Se descartan trimestres con
// Δ%baja casi cero (< 0.3 pp) del cálculo -- una razón dividida entre un denominador casi cero
// dispara a valores absurdos sin aportar información real sobre el beta.
export function calcularBetaSHF(serieBajaCruda: PuntoIndiceSHF[], serieAltaCruda: PuntoIndiceSHF[]): BetaSHF {
  const porTrimestre = (serie: PuntoIndiceSHF[]) => {
    const m = new Map<number, number>()
    for (const p of serie) m.set(indiceTrimestre(p), p.indice)
    return m
  }
  const bajaPorT = porTrimestre(serieBajaCruda)
  const altaPorT = porTrimestre(serieAltaCruda)
  const trimestresComunes = [...bajaPorT.keys()].filter((t) => altaPorT.has(t)).sort((a, b) => a - b)

  const deltasBaja: number[] = []
  const deltasAlta: number[] = []
  for (let i = 1; i < trimestresComunes.length; i++) {
    const tPrev = trimestresComunes[i - 1]
    const tCur = trimestresComunes[i]
    const bajaPrev = bajaPorT.get(tPrev)!, bajaCur = bajaPorT.get(tCur)!
    const altaPrev = altaPorT.get(tPrev)!, altaCur = altaPorT.get(tCur)!
    if (bajaPrev <= 0 || altaPrev <= 0) continue
    deltasBaja.push(((bajaCur - bajaPrev) / bajaPrev) * 100)
    deltasAlta.push(((altaCur - altaPrev) / altaPrev) * 100)
  }

  const n = deltasBaja.length
  const sumXY = deltasBaja.reduce((s, x, i) => s + x * deltasAlta[i], 0)
  const sumXX = deltasBaja.reduce((s, x) => s + x * x, 0)
  const beta = sumXX > 0 ? sumXY / sumXX : 0

  const razones = deltasBaja
    .map((x, i) => ({ x, y: deltasAlta[i] }))
    .filter(({ x }) => Math.abs(x) >= 0.3)
    .map(({ x, y }) => y / x)
    .sort((a, b) => a - b)

  return {
    beta: Math.round(beta * 1000) / 1000,
    min: razones.length > 0 ? Math.round(percentil(razones, 10) * 1000) / 1000 : beta,
    max: razones.length > 0 ? Math.round(percentil(razones, 90) * 1000) / 1000 : beta,
    n,
  }
}

// Ciudad (mismo texto que ya manda formData.ciudad / sitio.ciudad en el resto de lib/market/) ->
// serie SHF de referencia más cercana disponible. Mismo criterio que MUNICIPIOS_NL_INEGI en
// lib/market/sniivAbsorcion.ts: objeto explícito, ampliar si se necesita cubrir otra ciudad. San
// Pedro Garza García no tiene municipio propio en el SHF (ver shfIndice.data.ts) -- se usa ZM
// Monterrey completa, la referencia real más cercana disponible.
export const SHF_CIUDAD_A_SERIE: Record<string, { nombre: string; serie: PuntoIndiceSHF[] }> = {
  'san pedro garza garcía': { nombre: 'ZM Monterrey (índice SHF)', serie: SHF_ZM_MONTERREY },
  'san pedro garza garcia': { nombre: 'ZM Monterrey (índice SHF)', serie: SHF_ZM_MONTERREY },
  'monterrey': { nombre: 'ZM Monterrey (índice SHF)', serie: SHF_ZM_MONTERREY },
}

export function serieSHFParaCiudad(ciudad: string | null | undefined): { nombre: string; serie: PuntoIndiceSHF[] } | null {
  if (!ciudad) return null
  const key = ciudad.trim().toLowerCase()
  return SHF_CIUDAD_A_SERIE[key] ?? null
}
