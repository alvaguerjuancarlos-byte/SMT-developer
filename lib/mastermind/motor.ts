// Motor de cálculo de Mastermind — factibilidad financiera SMT Developer.
// Módulo TypeScript puro — sin LLM, sin efectos secundarios, 100% determinístico.
// Cada función es pura y componible; calcularMastermind() las ensambla en secuencia.
//
// El flujo de caja y la TIR (Socio/Proyecto) se calculan con lib/analisis/flujoFinanciero.ts
// — la MISMA función que usa el Agente Financiero del pipeline de Análisis — en vez de una
// reimplementación propia. Antes Mastermind tenía su propia versión de
// construirFlujoSocio/construirFlujoProyecto que había que sincronizar a mano con cada fix
// del otro motor (y ya se había atrasado: le faltaba el fix de escalar costo por mix). Un solo
// motor de flujo de caja para los dos evita que esto vuelva a pasar.

import type {
  BloqueCostos,
  BloqueIngresos,
  BloqueRetorno,
  BloqueUtilidad,
  MastermindInputs,
  MastermindOutputs,
} from './tipos'
import { BENCHMARKS_CONSTRUCCION_MXN_M2, FACTOR_EFICIENCIA_CONSTRUCCION, DESCUENTOS_CANCELACIONES, PORCENTAJE_COMERCIALIZACION } from './catalogo'
import { calcularFlujoFinanciero } from '@/lib/analisis/flujoFinanciero'

export function calcularIngresos(inputs: MastermindInputs): BloqueIngresos {
  const { proyecto, mercado } = inputs

  const m2VendiblesHabitacional = proyecto.unidadesHabitacionales * proyecto.m2PromedioDepa
  const m2VendiblesComercial = proyecto.m2ComercialesPlantaBaja

  const ingresoBrutoHabitacional = m2VendiblesHabitacional * mercado.precioVentaDepasM2
  const ingresoBrutoComercial = m2VendiblesComercial * mercado.precioLocalesM2

  const ingresoBrutoTotal = ingresoBrutoHabitacional + ingresoBrutoComercial
  const descuentos = ingresoBrutoTotal * DESCUENTOS_CANCELACIONES
  const ingresoNeto = ingresoBrutoTotal - descuentos

  return {
    m2VendiblesHabitacional,
    m2VendiblesComercial,
    ingresoBrutoHabitacional,
    ingresoBrutoComercial,
    ingresoBrutoTotal,
    descuentos,
    ingresoNeto,
  }
}

// benchmarkOverrideMxnM2 permite evaluar el motor con un costo de construcción continuo
// (MXN/m²) en vez del catálogo discreto — lo usa la matriz de sensibilidad.
// Prioridad del $/m² de construcción: override explícito > costo real ya validado por el
// Agente Construcción (proyecto.costoConstruccionRealM2, disponible cuando Mastermind se abre
// desde un análisis) > benchmark del catálogo (solo si no hay análisis cargado — sesión nueva
// desde cero). Antes siempre se usaba el benchmark, "snapeado" a 1 de solo 6 valores fijos,
// descartando el dato real y preciso aunque estuviera disponible.
export function calcularCostos(inputs: MastermindInputs, benchmarkOverrideMxnM2?: number): Omit<BloqueCostos, 'comercializacion' | 'financieros' | 'costoTotal'> {
  const { terreno, proyecto } = inputs

  // Preferimos la superficie de construcción real (validada por el Agente Construcción)
  // sobre la estimación por huella de terreno — ver nota en tipos.ts InputsProyecto.
  const m2Construidos = proyecto.superficieConstruccionM2 && proyecto.superficieConstruccionM2 > 0
    ? proyecto.superficieConstruccionM2
    : terreno.superficieM2 * proyecto.niveles * FACTOR_EFICIENCIA_CONSTRUCCION
  const benchmarkMxnM2 = benchmarkOverrideMxnM2 ?? proyecto.costoConstruccionRealM2 ?? BENCHMARKS_CONSTRUCCION_MXN_M2[proyecto.benchmarkConstruccion]
  const costoDirectoConstruccion = m2Construidos * benchmarkMxnM2

  const indirectos = costoDirectoConstruccion * (proyecto.porcentajeIndirectos / 100)

  return {
    m2Construidos,
    costoTerreno: terreno.costoTerreno,
    costoDirectoConstruccion,
    indirectos,
  }
}

export function calcularUtilidad(ingresos: BloqueIngresos, costos: BloqueCostos): BloqueUtilidad {
  const utilidadAntesImpuestos = ingresos.ingresoNeto - costos.costoTotal
  const margenBruto = ingresos.ingresoBrutoTotal > 0 ? (utilidadAntesImpuestos / ingresos.ingresoBrutoTotal) * 100 : 0
  const margenNeto = ingresos.ingresoNeto > 0 ? (utilidadAntesImpuestos / ingresos.ingresoNeto) * 100 : 0
  return { utilidadAntesImpuestos, margenBruto, margenNeto }
}

// Punto de equilibrio: unidades mínimas a m2PromedioDepa/precioVentaM2 actuales para UAI = 0.
// Cerrado en forma algebraica porque, en este modelo, el costo de construcción depende de
// superficieM2(terreno) × niveles — no de unidades — así que UAI es lineal en unidades.
function calcularPuntoEquilibrioUnidades(inputs: MastermindInputs, costos: BloqueCostos, ingresoBrutoComercial: number): number {
  const { proyecto, mercado } = inputs
  const denom = proyecto.m2PromedioDepa * mercado.precioVentaDepasM2
  if (denom <= 0) return 0

  const costoFijo = costos.costoTerreno + costos.costoDirectoConstruccion + costos.indirectos + costos.financieros
  const factorNeto = (1 - PORCENTAJE_COMERCIALIZACION) * (1 - DESCUENTOS_CANCELACIONES)
  const ingresoBrutoHabRequerido = costoFijo / factorNeto - ingresoBrutoComercial

  return Math.max(0, Math.ceil(ingresoBrutoHabRequerido / denom))
}

export function calcularMastermind(inputs: MastermindInputs): MastermindOutputs {
  const { tiempo, financiamiento } = inputs

  const ingresos = calcularIngresos(inputs)
  const costosBase = calcularCostos(inputs)

  const flujo = calcularFlujoFinanciero({
    costoTerreno: costosBase.costoTerreno,
    costoTotalConstruccion: costosBase.costoDirectoConstruccion,
    // Mastermind usa un solo % agregado de indirectos (no separa honorarios/imprevistos como
    // el Agente Financiero) — pasarlo todo en "indirectos" y 0 en los otros dos es equivalente,
    // calcularFlujoFinanciero solo usa la suma de los tres para la base financiable.
    indirectos: costosBase.indirectos, honorarios: 0, imprevistos: 0,
    ingresosNetos: ingresos.ingresoNeto,
    comercializacion: ingresos.ingresoNeto * PORCENTAJE_COMERCIALIZACION,
    plazoObraMeses: tiempo.plazoObraMeses, plazoVentaMeses: tiempo.plazoVentaMeses, inicioVentasMes: tiempo.inicioVentasMes,
    porcentajeEquity: 100 - financiamiento.porcentajeFinanciado,
    tasaAnualCredito: financiamiento.tasaAnualCredito,
  })

  const comercializacion = ingresos.ingresoNeto * PORCENTAJE_COMERCIALIZACION
  const costos: BloqueCostos = {
    ...costosBase,
    comercializacion,
    financieros: flujo.costoFinanciero,
    costoTotal: costosBase.costoTerreno + costosBase.costoDirectoConstruccion + costosBase.indirectos + comercializacion + flujo.costoFinanciero,
  }

  const utilidad = calcularUtilidad(ingresos, costos)

  const roiSimple = flujo.montoEquity > 0 ? (utilidad.utilidadAntesImpuestos / flujo.montoEquity) * 100 : 0
  const ingresoMensualPromedio = ingresos.ingresoNeto / tiempo.plazoVentaMeses
  const paybackMeses = ingresoMensualPromedio > 0 ? flujo.montoEquity / ingresoMensualPromedio : 0
  const puntoEquilibrioUnidades = calcularPuntoEquilibrioUnidades(inputs, costos, ingresos.ingresoBrutoComercial)

  const retorno: BloqueRetorno = {
    tirSocioAnual: flujo.tirSocioAnual,
    tirProyectoAnual: flujo.tirProyectoAnual,
    tirSocioConverge: flujo.tirSocioConverge,
    tirProyectoConverge: flujo.tirProyectoConverge,
    roiSimple,
    paybackMeses,
    puntoEquilibrioUnidades,
    inversionSocios: flujo.montoEquity,
    inversionProyecto: flujo.montoEquity + flujo.montoDeuda,
  }

  return { ingresos, costos, utilidad, retorno, flujoSocio: flujo.flujoSocio, flujoProyecto: flujo.flujoProyecto }
}
