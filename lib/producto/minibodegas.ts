// Minibodegas (self storage) para RENTA — el pipeline de Flujo A está armado para vivienda en
// venta (mix de recámaras, precio de venta/m², absorción en unidades/mes, crédito puente con
// preventa). JC probó "Otra idea… minibodegas" (2-nov-2026) y todos los agentes respondieron
// como si fueran departamentos. Este módulo concentra lo específico del producto: detección,
// supuestos paramétricos y el modelo de renta (ocupación que sube, NOI, valor por cap rate y TIR).
//
// Módulo puro, sin LLM — mismo espíritu que lib/analisis/flujoFinanciero.ts.

import { calcularTIR } from '@/lib/mastermind/irr'

export const ID_MINIBODEGAS = 'minibodegas'

const PATRON_TEXTO = /mini\s*-?\s*bodega|self\s*-?\s*storage|auto\s*-?\s*almacenaje|guarda\s*-?\s*todo|bodegas?\s+(de|en|para)\s+renta|renta\s+de\s+bodegas/i

export function esMinibodegas(tiposDesarrollo: string[] | undefined, tipoOtroTexto?: string): boolean {
  const tipos = tiposDesarrollo || []
  if (tipos.includes(ID_MINIBODEGAS)) return true
  return tipos.includes('otro') && PATRON_TEXTO.test(tipoOtroTexto || '')
}

// Supuestos paramétricos de prefactibilidad — referencias de la industria, NO datos de esta
// plaza: se muestran en pantalla como "a validar" y Mercado los reemplaza cuando encuentra
// datos de la zona (renta, ocupación, meses para estabilizar).
export const SUPUESTOS_MINIBODEGAS = {
  // Tamaños típicos de bodega y su participación en el área rentable.
  mix: [
    { tipo: 'Bodega 3 m²', m2: 3, participacionArea: 0.10 },
    { tipo: 'Bodega 6 m²', m2: 6, participacionArea: 0.25 },
    { tipo: 'Bodega 9 m²', m2: 9, participacionArea: 0.25 },
    { tipo: 'Bodega 15 m²', m2: 15, participacionArea: 0.20 },
    { tipo: 'Bodega 30 m²', m2: 30, participacionArea: 0.20 },
  ],
  // Área rentable / construida: pasillos, oficina, montacargas y servicios no se rentan.
  eficienciaRentable: { piso: 0.65, base: 0.72, techo: 0.78 },
  ocupacionApertura: 0.10,
  ocupacionEstabilizada: 0.88,
  mesesEstabilizacion: 30,
  // Gastos de operación (personal, predial, seguros, mantenimiento, luz, marketing, software)
  // como % del ingreso estabilizado; 60% es fijo desde la apertura aunque la ocupación sea baja.
  opexPctIngreso: 0.35,
  opexFijoPct: 0.60,
  capRateSalida: 0.10,
  costoVentaActivoPct: 0.02,
  aniosOperacion: 7,
  equityPct: 50,
  tasaDeudaAnual: 13.5,
  // Rango plausible de renta mensual por m² rentable (MXN) — fuera de esto es dato mal leído.
  rentaM2MesMin: 60,
  rentaM2MesMax: 1500,
} as const

export interface EntradaModeloRenta {
  costoTerreno: number
  costoObraTotal: number          // construcción + indirectos + honorarios + imprevistos
  areaRentableM2: number
  rentaM2Mes: number
  plazoObraMeses: number
  ocupacionApertura?: number
  ocupacionEstabilizada?: number
  mesesEstabilizacion?: number
  opexPctIngreso?: number
  capRateSalida?: number
  aniosOperacion?: number
  equityPct?: number
  tasaDeudaAnual?: number
}

export interface SalidaModeloRenta {
  inversionTotal: number
  ingresoBrutoEstabilizadoAnual: number   // área × renta × ocupación estabilizada × 12
  opexEstabilizadoAnual: number
  noiEstabilizadoAnual: number
  valorActivo: number                      // NOI estabilizado / cap rate
  yieldOnCostPct: number                   // NOI estabilizado / inversión
  creacionValor: number                    // valor del activo − inversión
  margenDesarrolloPct: number
  mesApertura: number
  mesEstabilizacion: number
  mesSalida: number
  paybackMes: number | null                // mes en que el flujo acumulado del proyecto (sin venta) se vuelve positivo
  flujoProyecto: number[]
  flujoSocio: number[]
  ocupacionPorMes: number[]
  montoEquity: number
  montoDeuda: number
  interesesTotales: number
  tirProyectoAnual: number | null
  tirSocioAnual: number | null
  tirProyectoConverge: boolean
  tirSocioConverge: boolean
  supuestos: {
    ocupacionApertura: number; ocupacionEstabilizada: number; mesesEstabilizacion: number
    opexPctIngreso: number; capRateSalida: number; aniosOperacion: number
    equityPct: number; tasaDeudaAnual: number
  }
}

const S = SUPUESTOS_MINIBODEGAS

export function calcularModeloRenta(e: EntradaModeloRenta): SalidaModeloRenta {
  const ocupacionApertura = e.ocupacionApertura ?? S.ocupacionApertura
  const ocupacionEstabilizada = e.ocupacionEstabilizada ?? S.ocupacionEstabilizada
  const mesesEstabilizacion = Math.max(1, Math.round(e.mesesEstabilizacion ?? S.mesesEstabilizacion))
  const opexPctIngreso = e.opexPctIngreso ?? S.opexPctIngreso
  const capRateSalida = e.capRateSalida ?? S.capRateSalida
  const aniosOperacion = e.aniosOperacion ?? S.aniosOperacion
  const equityPct = e.equityPct ?? S.equityPct
  const tasaDeudaAnual = e.tasaDeudaAnual ?? S.tasaDeudaAnual
  const plazoObra = Math.max(1, Math.round(e.plazoObraMeses))

  const inversionTotal = e.costoTerreno + e.costoObraTotal
  const ingresoPotencialMes = e.areaRentableM2 * e.rentaM2Mes
  const ingresoBrutoEstabilizadoAnual = ingresoPotencialMes * ocupacionEstabilizada * 12
  const opexEstabilizadoAnual = ingresoBrutoEstabilizadoAnual * opexPctIngreso
  const noiEstabilizadoAnual = ingresoBrutoEstabilizadoAnual - opexEstabilizadoAnual
  const valorActivo = capRateSalida > 0 ? noiEstabilizadoAnual / capRateSalida : 0

  const mesApertura = plazoObra + 1
  const mesEstabilizacion = mesApertura + mesesEstabilizacion
  const mesSalida = plazoObra + aniosOperacion * 12
  const N = mesSalida

  const ocupacionPorMes = new Array(N + 1).fill(0)
  for (let m = mesApertura; m <= N; m++) {
    const avance = Math.min(1, (m - mesApertura) / mesesEstabilizacion)
    ocupacionPorMes[m] = ocupacionApertura + (ocupacionEstabilizada - ocupacionApertura) * avance
  }

  const opexEstabilizadoMes = opexEstabilizadoAnual / 12
  const noiMes = (m: number) => {
    if (m < mesApertura) return 0
    const ingreso = ingresoPotencialMes * ocupacionPorMes[m]
    const opex = opexEstabilizadoMes * (S.opexFijoPct + (1 - S.opexFijoPct) * (ocupacionPorMes[m] / ocupacionEstabilizada))
    return ingreso - opex
  }

  // Flujo Proyecto — sin apalancar: terreno al inicio, obra repartida, NOI mensual y venta del
  // activo al final del horizonte a cap rate sobre el NOI estabilizado (menos costo de venta).
  const obraMes = e.costoObraTotal / plazoObra
  const flujoProyecto = new Array(N + 1).fill(0)
  flujoProyecto[0] -= e.costoTerreno
  for (let m = 1; m <= plazoObra; m++) flujoProyecto[m] -= obraMes
  for (let m = mesApertura; m <= N; m++) flujoProyecto[m] += noiMes(m)
  const ventaNeta = valorActivo * (1 - S.costoVentaActivoPct)
  flujoProyecto[N] += ventaNeta

  // Payback operativo: con solo la renta (sin vender el activo), ¿en qué mes se recupera?
  let acumulado = 0
  let paybackMes: number | null = null
  for (let m = 0; m <= N; m++) {
    acumulado += flujoProyecto[m] - (m === N ? ventaNeta : 0)
    if (paybackMes === null && m >= mesApertura && acumulado >= 0) paybackMes = m
  }

  // Flujo Socio — la deuda (crédito con garantía del activo) financia su % de la inversión,
  // paga solo intereses mientras dura y el principal se liquida con la venta del activo.
  const montoDeuda = inversionTotal * (100 - equityPct) / 100
  const montoEquity = inversionTotal - montoDeuda
  const interesMes = montoDeuda * tasaDeudaAnual / 100 / 12
  const flujoSocio = new Array(N + 1).fill(0)
  flujoSocio[0] -= e.costoTerreno * equityPct / 100
  for (let m = 1; m <= plazoObra; m++) flujoSocio[m] -= obraMes * equityPct / 100
  for (let m = 1; m <= N; m++) flujoSocio[m] -= interesMes
  for (let m = mesApertura; m <= N; m++) flujoSocio[m] += noiMes(m)
  flujoSocio[N] += ventaNeta - montoDeuda

  const tirP = calcularTIR(flujoProyecto)
  const tirS = calcularTIR(flujoSocio)

  return {
    inversionTotal,
    ingresoBrutoEstabilizadoAnual,
    opexEstabilizadoAnual,
    noiEstabilizadoAnual,
    valorActivo,
    yieldOnCostPct: inversionTotal > 0 ? (noiEstabilizadoAnual / inversionTotal) * 100 : 0,
    creacionValor: valorActivo - inversionTotal,
    margenDesarrolloPct: inversionTotal > 0 ? ((valorActivo - inversionTotal) / inversionTotal) * 100 : 0,
    mesApertura,
    mesEstabilizacion,
    mesSalida,
    paybackMes,
    flujoProyecto,
    flujoSocio,
    ocupacionPorMes,
    montoEquity,
    montoDeuda,
    interesesTotales: interesMes * N,
    tirProyectoAnual: tirP.tirAnual !== null ? tirP.tirAnual * 100 : null,
    tirSocioAnual: tirS.tirAnual !== null ? tirS.tirAnual * 100 : null,
    tirProyectoConverge: tirP.converged,
    tirSocioConverge: tirS.converged,
    supuestos: { ocupacionApertura, ocupacionEstabilizada, mesesEstabilizacion, opexPctIngreso, capRateSalida, aniosOperacion, equityPct, tasaDeudaAnual },
  }
}

// Escenarios adversos del producto en renta (equivalente al stress test de venta).
export function stressTestRenta(e: EntradaModeloRenta) {
  const base = calcularModeloRenta(e)
  const ocupEst = e.ocupacionEstabilizada ?? S.ocupacionEstabilizada
  const escenarios = [
    { titulo: 'Shock de Costos +15%', entrada: { ...e, costoObraTotal: e.costoObraTotal * 1.15 } },
    { titulo: 'Renta −10%', entrada: { ...e, rentaM2Mes: e.rentaM2Mes * 0.9 } },
    { titulo: 'Ocupación −15 pts y estabilización +12 meses', entrada: { ...e, ocupacionEstabilizada: Math.max(0.3, ocupEst - 0.15), mesesEstabilizacion: (e.mesesEstabilizacion ?? S.mesesEstabilizacion) + 12 } },
  ]
  return escenarios.map(({ titulo, entrada }) => {
    const r = calcularModeloRenta(entrada)
    return { titulo, base, resultado: r }
  })
}
