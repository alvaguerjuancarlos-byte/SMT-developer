// Cálculo determinista de TIR Proyecto (sin apalancar) y TIR Socio (apalancada) para el
// Análisis — antes esto lo "razonaba" el Agente Financiero (LLM) como un solo número, sin
// separar quién pone el dinero, y podía contradecir su propio margenBruto (ver
// tirPuedeEstarDesactualizada, ahora removido porque ya no hace falta: el análisis es el
// origen de estos datos, así que se calculan aquí con la misma metodología ya probada en
// lib/mastermind/motor.ts (construirFlujoProyecto/construirFlujoSocio) — equity aporta su %
// de terreno+obra, paga 100% del interés, y el principal de la deuda se repaga con el
// producto de las ventas (no se regala, bug real encontrado y corregido en Mastermind).
//
// Módulo puro, sin LLM, sin efectos secundarios — mismo espíritu que lib/mastermind/motor.ts.

import { calcularTIR } from '@/lib/mastermind/irr'

export interface InputsFlujoFinanciero {
  costoTerreno: number
  costoTotalConstruccion: number
  indirectos: number
  honorarios: number
  imprevistos: number
  ingresosNetos: number       // ya neto de descuentos y cancelaciones (5%)
  comercializacion: number    // 3% del ingreso neto, ya calculado en código
  plazoObraMeses: number
  plazoVentaMeses: number
  inicioVentasMes: number
  porcentajeEquity: number    // estructuraCapital.equity
  tasaAnualCredito: number    // numérica (%), no el string descriptivo de estructuraCapital.tasaDeuda
}

export interface ResultadoFlujoFinanciero {
  montoEquity: number
  montoDeuda: number
  costoFinanciero: number
  flujoProyecto: number[]
  flujoSocio: number[]
  tirProyectoAnual: number | null
  tirSocioAnual: number | null
  tirProyectoConverge: boolean
  tirSocioConverge: boolean
}

export function calcularFlujoFinanciero(inputs: InputsFlujoFinanciero): ResultadoFlujoFinanciero {
  const {
    costoTerreno, costoTotalConstruccion, indirectos, honorarios, imprevistos,
    ingresosNetos, comercializacion, plazoObraMeses, plazoVentaMeses, inicioVentasMes,
    porcentajeEquity, tasaAnualCredito,
  } = inputs

  const porcentajeDeuda = 100 - porcentajeEquity
  // Todo lo "financiable" aparte del terreno — construcción + los tres rubros de overhead,
  // que tanto el análisis como Mastermind desglosan por separado (ver lib/mastermind/motor.ts).
  const costoObraTotal = costoTotalConstruccion + indirectos + honorarios + imprevistos
  const baseFinanciable = costoTerreno + costoObraTotal
  const montoEquity = (porcentajeEquity / 100) * baseFinanciable
  const montoDeuda = (porcentajeDeuda / 100) * baseFinanciable
  const costoFinanciero = plazoObraMeses > 0 ? montoDeuda * (tasaAnualCredito / 100 / 12) * plazoObraMeses : 0

  const ingresoNetoVentas = ingresosNetos - comercializacion
  const N = Math.max(0, plazoVentaMeses)
  const mesesVenta = plazoVentaMeses - inicioVentasMes + 1
  const ingresoMensual = mesesVenta > 0 ? ingresoNetoVentas / mesesVenta : 0
  const costoObraMensual = plazoObraMeses > 0 ? costoObraTotal / plazoObraMeses : 0

  // Flujo Proyecto — sin apalancar, como si todo se pagara de contado (100% equity, sin deuda).
  const flujoProyecto = new Array(N + 1).fill(0)
  flujoProyecto[0] -= costoTerreno
  for (let m = 1; m <= Math.min(plazoObraMeses, N); m++) flujoProyecto[m] -= costoObraMensual
  for (let m = Math.max(0, inicioVentasMes); m <= Math.min(N, plazoVentaMeses); m++) flujoProyecto[m] += ingresoMensual

  // Flujo Socio — apalancado: el socio solo aporta su % de terreno+obra, paga 100% del
  // interés (financiero), y el principal de la deuda se descuenta del producto de las
  // ventas — práctica estándar de "liberación de garantías" (ver motor.ts para el mismo
  // razonamiento aplicado a Mastermind).
  const flujoSocio = new Array(N + 1).fill(0)
  flujoSocio[0] -= (porcentajeEquity / 100) * costoTerreno
  const costoObraMensualEquity = (porcentajeEquity / 100) * costoObraMensual
  const financierosMensual = plazoObraMeses > 0 ? costoFinanciero / plazoObraMeses : 0
  for (let m = 1; m <= Math.min(plazoObraMeses, N); m++) flujoSocio[m] -= costoObraMensualEquity + financierosMensual
  for (let m = Math.max(0, inicioVentasMes); m <= Math.min(N, plazoVentaMeses); m++) flujoSocio[m] += ingresoMensual
  if (montoDeuda > 0 && mesesVenta > 0) {
    const repagoMensual = montoDeuda / mesesVenta
    for (let m = Math.max(0, inicioVentasMes); m <= Math.min(N, plazoVentaMeses); m++) flujoSocio[m] -= repagoMensual
  }

  const tirProyecto = calcularTIR(flujoProyecto)
  const tirSocio = calcularTIR(flujoSocio)

  return {
    montoEquity,
    montoDeuda,
    costoFinanciero,
    flujoProyecto,
    flujoSocio,
    tirProyectoAnual: tirProyecto.tirAnual !== null ? tirProyecto.tirAnual * 100 : null,
    tirSocioAnual: tirSocio.tirAnual !== null ? tirSocio.tirAnual * 100 : null,
    tirProyectoConverge: tirProyecto.converged,
    tirSocioConverge: tirSocio.converged,
  }
}
