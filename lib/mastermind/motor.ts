// Motor de cálculo de Mastermind — factibilidad financiera SMT Developer.
// Módulo TypeScript puro — sin LLM, sin efectos secundarios, 100% determinístico.
// Cada función es pura y componible; calcularMastermind() las ensambla en secuencia.

import type {
  BloqueCostos,
  BloqueIngresos,
  BloqueRetorno,
  BloqueUtilidad,
  MastermindInputs,
  MastermindOutputs,
} from './tipos'
import {
  BENCHMARKS_CONSTRUCCION_MXN_M2,
  DESCUENTOS_CANCELACIONES,
  FACTOR_EFICIENCIA_CONSTRUCCION,
  PORCENTAJE_COMERCIALIZACION,
} from './catalogo'
import { calcularTIR } from './irr'

export function calcularIngresos(inputs: MastermindInputs): BloqueIngresos {
  const { proyecto, mercado } = inputs

  const m2VendiblesHabitacional = proyecto.unidadesHabitacionales * proyecto.m2PromedioDepa
  const m2VendiblesComercial = proyecto.m2ComercialesPlantaBaja

  const ingresoBrutoHabitacional = m2VendiblesHabitacional * mercado.precioVentaDepasM2

  const ingresoBrutoComercial = mercado.modalidadLocales === 'renta'
    ? (m2VendiblesComercial * mercado.precioLocalesM2 * 12) / (mercado.tasaCapRate / 100)
    : m2VendiblesComercial * mercado.precioLocalesM2

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
// (MXN/m²) en vez del catálogo discreto — lo usa el solver de "costo máximo" en ingeniería inversa.
export function calcularCostos(inputs: MastermindInputs, ingresos: BloqueIngresos, benchmarkOverrideMxnM2?: number): BloqueCostos {
  const { terreno, proyecto, tiempo, financiamiento } = inputs

  // Preferimos la superficie de construcción real (validada por el Agente Construcción)
  // sobre la estimación por huella de terreno — ver nota en tipos.ts InputsProyecto.
  const m2Construidos = proyecto.superficieConstruccionM2 && proyecto.superficieConstruccionM2 > 0
    ? proyecto.superficieConstruccionM2
    : terreno.superficieM2 * proyecto.niveles * FACTOR_EFICIENCIA_CONSTRUCCION
  const benchmarkMxnM2 = benchmarkOverrideMxnM2 ?? BENCHMARKS_CONSTRUCCION_MXN_M2[proyecto.benchmarkConstruccion]
  const costoDirectoConstruccion = m2Construidos * benchmarkMxnM2

  const indirectos = costoDirectoConstruccion * (proyecto.porcentajeIndirectos / 100)
  const comercializacion = ingresos.ingresoNeto * PORCENTAJE_COMERCIALIZACION
  // La deuda real se dimensiona sobre terreno + construcción + indirectos (el análisis exige
  // montoEquity + montoDeuda = inversionTotal, no solo % de la construcción) — antes solo se
  // financiaba costoDirectoConstruccion, subestimando el costo financiero real. Ver también
  // construirFlujoSocio y calcularRetorno, que deben repartir equity/deuda sobre esta misma
  // base para quedar consistentes entre sí (si no, el interés implicaría deuda que el flujo de
  // caja del socio nunca refleja como alivio real).
  const baseFinanciable = terreno.costoTerreno + costoDirectoConstruccion + indirectos
  const financieros =
    (financiamiento.porcentajeFinanciado / 100) *
    baseFinanciable *
    (financiamiento.tasaAnualCredito / 100 / 12) *
    tiempo.plazoObraMeses

  const costoTotal = terreno.costoTerreno + costoDirectoConstruccion + indirectos + comercializacion + financieros

  return {
    m2Construidos,
    costoTerreno: terreno.costoTerreno,
    costoDirectoConstruccion,
    indirectos,
    comercializacion,
    financieros,
    costoTotal,
  }
}

export function calcularUtilidad(ingresos: BloqueIngresos, costos: BloqueCostos): BloqueUtilidad {
  const utilidadAntesImpuestos = ingresos.ingresoNeto - costos.costoTotal
  const margenBruto = ingresos.ingresoBrutoTotal > 0 ? (utilidadAntesImpuestos / ingresos.ingresoBrutoTotal) * 100 : 0
  const margenNeto = ingresos.ingresoNeto > 0 ? (utilidadAntesImpuestos / ingresos.ingresoNeto) * 100 : 0
  return { utilidadAntesImpuestos, margenBruto, margenNeto }
}

// Ingresos por ventas mensuales, compartidos entre el flujo de Socio y el de Proyecto —
// la línea temporal en que se monetiza el proyecto no depende de cómo se financió.
//
// En modalidad "renta": los locales generan valor vía remanente capitalizado en el mes
// final (no se venden mes a mes), así que se excluyen del reparto mensual de ingresoNeto
// para no contar dos veces el mismo valor capitalizado (una vez distribuido, otra como
// remanente). En modalidad "venta" el ingreso neto ya viene mezclado (hab. + comercial)
// y se reparte tal cual, sin remanente.
function construirFlujoIngresos(inputs: MastermindInputs, ingresos: BloqueIngresos, costos: BloqueCostos): number[] {
  const { tiempo, mercado } = inputs
  const N = tiempo.plazoVentaMeses
  const flujo = new Array(N + 1).fill(0)

  const mesesVenta = tiempo.plazoVentaMeses - tiempo.inicioVentasMes + 1
  if (mesesVenta <= 0) return flujo

  const esRenta = mercado.modalidadLocales === 'renta'
  const ingresoNetoDistribuible = esRenta
    ? ingresos.ingresoBrutoHabitacional * (1 - DESCUENTOS_CANCELACIONES)
    : ingresos.ingresoNeto

  const ingresoMensual = ingresoNetoDistribuible / mesesVenta
  const comercializacionMensual = costos.comercializacion / mesesVenta

  for (let m = Math.max(0, tiempo.inicioVentasMes); m <= Math.min(N, tiempo.plazoVentaMeses); m++) {
    flujo[m] += ingresoMensual - comercializacionMensual
  }

  if (esRenta) {
    flujo[N] += ingresos.ingresoBrutoComercial // remanente capitalizado al cierre del horizonte
  }

  return flujo
}

// Flujo del socio (apalancado): la porción financiada de construcción NO sale del
// bolsillo del socio; solo paga el interés (financieros) como costo real — pero el
// PRINCIPAL de esa deuda sí hay que devolverlo (ver deudaPrincipal más abajo).
export function construirFlujoSocio(inputs: MastermindInputs, ingresos: BloqueIngresos, costos: BloqueCostos): number[] {
  const { terreno, tiempo, financiamiento } = inputs
  const N = tiempo.plazoVentaMeses
  const flujo = new Array(N + 1).fill(0)

  // La deuda financia terreno + construcción + indirectos (misma base que calcularCostos
  // usa para financieros) — el socio solo pone de su bolsillo aportacionSociosPct de cada
  // uno, no el 100% de terreno/indirectos como antes.
  const aportacionSociosPct = 100 - financiamiento.porcentajeFinanciado
  flujo[0] = -(aportacionSociosPct / 100) * terreno.costoTerreno

  const costoDirectoMensual = costos.costoDirectoConstruccion / tiempo.plazoObraMeses
  const financierosMensual = costos.financieros / tiempo.plazoObraMeses
  const indirectosMensual = costos.indirectos / tiempo.plazoObraMeses

  for (let m = 1; m <= Math.min(tiempo.plazoObraMeses, N); m++) {
    flujo[m] += -(aportacionSociosPct / 100) * costoDirectoMensual - (aportacionSociosPct / 100) * indirectosMensual - financierosMensual
  }

  const flujoIngresos = construirFlujoIngresos(inputs, ingresos, costos)
  for (let m = 0; m <= N; m++) flujo[m] += flujoIngresos[m]

  // El principal del crédito puente (porcentajeFinanciado de terreno+construcción+indirectos)
  // se liquida con el producto de las ventas — práctica estándar de "liberación de garantías"
  // hipotecarias por unidad escriturada: el banco cobra su parte de cada venta antes de que el
  // remanente llegue al socio. Antes esto no se restaba en ningún lado, así que la porción
  // financiada se veía como dinero regalado — inflaba la TIR Socio incluso en proyectos que,
  // sin apalancar, pierden dinero. Se reparte durante el período de ventas (misma ventana que
  // construirFlujoIngresos usa para repartir ingresoNeto), no en un solo pago al final de obra.
  const deudaPrincipal = (financiamiento.porcentajeFinanciado / 100) * (terreno.costoTerreno + costos.costoDirectoConstruccion + costos.indirectos)
  const mesesVenta = tiempo.plazoVentaMeses - tiempo.inicioVentasMes + 1
  if (deudaPrincipal > 0 && mesesVenta > 0) {
    const repagoMensual = deudaPrincipal / mesesVenta
    for (let m = Math.max(0, tiempo.inicioVentasMes); m <= Math.min(N, tiempo.plazoVentaMeses); m++) {
      flujo[m] -= repagoMensual
    }
  }

  return flujo
}

// Flujo de proyecto (sin apalancar, "as if all-equity"): 100% del costo de construcción
// sale como flujo negativo sin importar el % financiado; no incluye costo de interés.
export function construirFlujoProyecto(inputs: MastermindInputs, ingresos: BloqueIngresos, costos: BloqueCostos): number[] {
  const { terreno, tiempo } = inputs
  const N = tiempo.plazoVentaMeses
  const flujo = new Array(N + 1).fill(0)
  flujo[0] = -terreno.costoTerreno

  const costoConstruccionMensual = (costos.costoDirectoConstruccion + costos.indirectos) / tiempo.plazoObraMeses
  for (let m = 1; m <= Math.min(tiempo.plazoObraMeses, N); m++) {
    flujo[m] += -costoConstruccionMensual
  }

  const flujoIngresos = construirFlujoIngresos(inputs, ingresos, costos)
  for (let m = 0; m <= N; m++) flujo[m] += flujoIngresos[m]

  return flujo
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

export function calcularRetorno(
  inputs: MastermindInputs,
  ingresos: BloqueIngresos,
  costos: BloqueCostos,
  utilidad: BloqueUtilidad,
  flujoSocio: number[],
  flujoProyecto: number[],
): BloqueRetorno {
  const { financiamiento, tiempo } = inputs

  // Misma base financiable que calcularCostos/construirFlujoSocio (terreno + construcción +
  // indirectos) — antes solo costoDirectoConstruccion se beneficiaba del apalancamiento aquí,
  // inconsistente con financieros ya cobrando intereses sobre una base más amplia.
  const aportacionSociosPct = 100 - financiamiento.porcentajeFinanciado
  const baseFinanciable = costos.costoTerreno + costos.costoDirectoConstruccion + costos.indirectos
  const inversionSocios = (aportacionSociosPct / 100) * baseFinanciable
  const inversionProyecto = costos.costoTerreno + costos.costoDirectoConstruccion + costos.indirectos

  const roiSimple = inversionSocios > 0 ? (utilidad.utilidadAntesImpuestos / inversionSocios) * 100 : 0
  const ingresoMensualPromedio = ingresos.ingresoNeto / tiempo.plazoVentaMeses
  const paybackMeses = ingresoMensualPromedio > 0 ? inversionSocios / ingresoMensualPromedio : 0

  const puntoEquilibrioUnidades = calcularPuntoEquilibrioUnidades(inputs, costos, ingresos.ingresoBrutoComercial)

  const tirSocio = calcularTIR(flujoSocio)
  const tirProyecto = calcularTIR(flujoProyecto)

  return {
    tirSocioAnual: tirSocio.tirAnual !== null ? tirSocio.tirAnual * 100 : null,
    tirProyectoAnual: tirProyecto.tirAnual !== null ? tirProyecto.tirAnual * 100 : null,
    tirSocioConverge: tirSocio.converged,
    tirProyectoConverge: tirProyecto.converged,
    roiSimple,
    paybackMeses,
    puntoEquilibrioUnidades,
    inversionSocios,
    inversionProyecto,
  }
}

export function calcularMastermind(inputs: MastermindInputs): MastermindOutputs {
  const ingresos = calcularIngresos(inputs)
  const costos = calcularCostos(inputs, ingresos)
  const utilidad = calcularUtilidad(ingresos, costos)
  const flujoSocio = construirFlujoSocio(inputs, ingresos, costos)
  const flujoProyecto = construirFlujoProyecto(inputs, ingresos, costos)
  const retorno = calcularRetorno(inputs, ingresos, costos, utilidad, flujoSocio, flujoProyecto)

  return { ingresos, costos, utilidad, retorno, flujoSocio, flujoProyecto }
}
