// Agente Financiero para minibodegas en RENTA. El modelo residencial (precio de venta/m²,
// absorción, crédito puente con preventa) no aplica. Aquí todos los números salen de
// calcularModeloRenta (código) y el LLM solo escribe la recomendación, el score y las
// narrativas con esas cifras. Se conservan las llaves del JSON de venta para que la pantalla,
// la propuesta y Mastermind sigan funcionando, con este significado:
//   ingresosProyectados = valor del activo estabilizado (NOI / cap rate)
//   utilidadBruta / margenBruto = creación de valor (valor del activo − inversión)
//   precioVentaM2 = valor del activo por m² rentable
//   plazoVentaMeses = mes de salida (venta del activo al final del horizonte)
// y se agrega financiero.renta con las métricas de operación.

import type Anthropic from '@anthropic-ai/sdk'
import { callClaudeJson } from '@smt/shared-realestate'
import { calcularModeloRenta, stressTestRenta, armarEntradaRenta, rentaParaTir, SUPUESTOS_MINIBODEGAS, type EntradaModeloRenta, type SupuestosRentaUsuario } from './minibodegas'

const S = SUPUESTOS_MINIBODEGAS
const r1 = (n: number | null) => n === null ? null : Math.round(n * 10) / 10
const mxn = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`

export interface EntradaFinancieroMinibodegas {
  data: any
  costoTerreno: number
  costoTerrenoM2: number
  construccionM2: number
  costoTotalConstruccion: number
  escaladoMix: unknown
  superficieRentable: number
  rangoHonorarios: { min: number; max: number }
}

export async function financieroMinibodegas(client: Anthropic, e: EntradaFinancieroMinibodegas) {
  const { data, costoTerreno, costoTotalConstruccion, superficieRentable } = e
  const renta = data.mercado?.renta ?? {}
  const usuario: SupuestosRentaUsuario = data.supuestosRenta || {}
  const rentaM2Mes = Number(usuario.rentaM2Mes) || Number(renta.rentaM2MesPromedio) || 0
  if (rentaM2Mes < S.rentaM2MesMin || rentaM2Mes > S.rentaM2MesMax) {
    throw new Error('Mercado no regresó una renta por m² válida para minibodegas')
  }

  const { entrada, indirectos, honorarios, imprevistos, plazoObraMeses } = armarEntradaRenta({
    costoTerreno, costoTotalConstruccion,
    superficieConstruida: Number(data.superficieConstruida) || 0,
    areaRentableM2: superficieRentable,
    rentaM2Mes,
    ocupacionEstabilizadaPct: Number(renta.ocupacionEstabilizadaPct) || undefined,
    mesesEstabilizacion: Number(renta.mesesEstabilizacion) || undefined,
    rangoHonorarios: e.rangoHonorarios,
    usuario,
  })
  const m = calcularModeloRenta(entrada)
  const stress = stressTestRenta(entrada)
  const totalBodegas = (data.unidadesObjetivo && Number(data.unidadesObjetivo)) || null

  const resumen = `- Área rentable: ${superficieRentable} m²${totalBodegas ? ` en ${totalBodegas} bodegas` : ''}
- Renta de lista: ${mxn(rentaM2Mes)}/m²/mes (${renta.fuente || 'mercado'}${renta.comparablesVerificados ? `, ${renta.comparablesVerificados} rentas verificadas en Google` : ''})
- Ocupación: ${Math.round(S.ocupacionApertura * 100)}% al abrir → ${Math.round(m.supuestos.ocupacionEstabilizada * 100)}% en ${m.supuestos.mesesEstabilizacion} meses
- Inversión total: ${mxn(m.inversionTotal)} (terreno ${mxn(costoTerreno)}, construcción ${mxn(costoTotalConstruccion)}, indirectos ${mxn(indirectos)}, honorarios ${mxn(honorarios)}, imprevistos ${mxn(imprevistos)})
- Obra: ${plazoObraMeses} meses; apertura mes ${m.mesApertura}; estabilizada mes ${m.mesEstabilizacion}; venta del activo mes ${m.mesSalida}
- Ingreso estabilizado: ${mxn(m.ingresoBrutoEstabilizadoAnual)}/año; gastos de operación ${Math.round(m.supuestos.opexPctIngreso * 100)}% → NOI ${mxn(m.noiEstabilizadoAnual)}/año
- Yield on cost: ${r1(m.yieldOnCostPct)}% · Cap rate de salida ${Math.round(m.supuestos.capRateSalida * 100)}% → valor del activo ${mxn(m.valorActivo)} (creación de valor ${mxn(m.creacionValor)}, ${r1(m.margenDesarrolloPct)}%)
- TIR proyecto ${r1(m.tirProyectoAnual) ?? 'N/D'}% · TIR socio ${r1(m.tirSocioAnual) ?? 'N/D'}% (equity ${m.supuestos.equityPct}%, deuda al ${m.supuestos.tasaDeudaAnual}% con garantía del activo)
- Payback solo con rentas: ${m.paybackMes ? `mes ${m.paybackMes}` : 'no se alcanza en el horizonte'}
- Stress test (TIR proyecto): ${stress.map(s => `${s.titulo}: ${r1(s.resultado.tirProyectoAnual) ?? 'N/D'}%`).join(' · ')}`

  const prompt = `Eres el Agente Financiero y Mastermind de SMT Land. El proyecto es de MINIBODEGAS PARA RENTA
(self storage) en ${data.colonia ? `${data.colonia}, ` : ''}${data.ciudad}, ${data.estado}. No se venden unidades: el negocio es
rentar bodegas por mes, llenar el inmueble y quedarse con el flujo (o vender el activo estabilizado).

El modelo financiero YA está calculado en código — NO recalcules ni cambies ningún número:
${resumen}

NORMATIVA (Agente Legal): uso de suelo ${data.fichaLegal?.compatible ? 'compatible' : 'requiere cambio o verificación'}; riesgo ${data.fichaLegal?.nivelRiesgo || 'no indicado'}; restricción principal: ${data.fichaLegal?.restriccion || 'sin restricciones críticas'}
MERCADO: ${data.mercado?.demanda || '—'} demanda; ${data.mercado?.proyectosActivos || '—'}; ${renta.notas || ''}

Escribe SOLO este JSON (sin markdown):
{
  "recomendacion": { "tipologia": "Minibodegas · N bodegas · X niveles", "descripcion": "2-3 oraciones con las cifras de arriba: si conviene, por qué y qué validar primero" },
  "indirectosDesglose": [{ "concepto": "Supervisión de obra", "monto": 0 }],
  "honorariosDesglose": [{ "concepto": "Proyecto arquitectónico", "monto": 0 }],
  "imprevistosDesglose": [{ "concepto": "Incremento de materiales", "monto": 0 }],
  "estructuraCapitalDescripcion": "1-2 oraciones: equity ${m.supuestos.equityPct}% y crédito con garantía del activo, por qué tiene sentido o qué cambiar",
  "score": { "solidezFinanciera": 0, "riesgoRegulatorio": 0, "exposicionMercado": 0 },
  "metodologiaScore": {
    "descripcion": "El Score de Resiliencia es un índice compuesto de 0–100 que pondera tres dimensiones de riesgo del proyecto.",
    "dimensiones": [
      { "nombre": "Solidez Financiera", "peso": "40%", "score": 0, "factores": [ { "factor": "Yield on cost vs cap rate", "contribucion": "…" }, { "factor": "TIR vs costo de la deuda", "contribucion": "…" }, { "factor": "Payback con rentas", "contribucion": "…" } ], "interpretacion": "…" },
      { "nombre": "Riesgo Regulatorio", "peso": "35%", "score": 0, "factores": [ { "factor": "Compatibilidad de uso de suelo para almacenamiento", "contribucion": "…" }, { "factor": "Protección civil y contra incendio", "contribucion": "…" }, { "factor": "Tiempos de permiso", "contribucion": "…" } ], "interpretacion": "…" },
      { "nombre": "Exposición de Mercado", "peso": "25%", "score": 0, "factores": [ { "factor": "Renta verificada vs estimada", "contribucion": "…" }, { "factor": "Competencia de minibodegas cercana", "contribucion": "…" }, { "factor": "Velocidad de llenado", "contribucion": "…" } ], "interpretacion": "…" }
    ]
  },
  "stressTextos": ["conclusión de 1 oración para cada escenario del stress test, en el mismo orden"],
  "puntoQuiebreResumen": "1-2 oraciones: principal vulnerabilidad y qué vigilar"
}
REGLAS: scores enteros 0–100; los desgloses suman aprox. indirectos ${mxn(indirectos)}, honorarios ${mxn(honorarios)}, imprevistos ${mxn(imprevistos)} (3–6 conceptos cada uno, sin conceptos de vivienda); stressTextos exactamente 3.`

  const n: any = await callClaudeJson(client, {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const sc = n.score || {}
  const solidez = Math.round(Number(sc.solidezFinanciera) || 0)
  const regulatorio = Math.round(Number(sc.riesgoRegulatorio) || 0)
  const mercadoScore = Math.round(Number(sc.exposicionMercado) || 0)
  const scoreTotal = Math.round(solidez * 0.4 + regulatorio * 0.35 + mercadoScore * 0.25)

  // Punto de quiebre — búsqueda en código: cuánto aguanta cada variable antes de que la TIR
  // de proyecto caiga abajo del costo de la deuda.
  const umbral = m.supuestos.tasaDeudaAnual
  const tirCon = (cambio: Partial<EntradaModeloRenta>) => calcularModeloRenta({ ...entrada, ...cambio }).tirProyectoAnual ?? -100
  const buscar = (f: (x: number) => number, pasos: number[]) => pasos.find(x => f(x) < umbral) ?? null
  const costoMax = buscar(x => tirCon({ costoObraTotal: entrada.costoObraTotal * (1 + x) }), Array.from({ length: 41 }, (_, i) => i * 0.025))
  const rentaMin = buscar(x => tirCon({ rentaM2Mes: rentaM2Mes * (1 - x) }), Array.from({ length: 41 }, (_, i) => i * 0.0125))
  const ocupMin = buscar(x => tirCon({ ocupacionEstabilizada: x }), Array.from({ length: 50 }, (_, i) => m.supuestos.ocupacionEstabilizada - i * 0.01))
  // Si el caso base ya está abajo del umbral, lo útil es al revés: qué hace falta para llegar.
  const llega = (f: (x: number) => number, pasos: number[]) => pasos.find(x => f(x) >= umbral) ?? null
  const bajaCostoNecesaria = llega(x => tirCon({ costoObraTotal: entrada.costoObraTotal * (1 - x) }), Array.from({ length: 31 }, (_, i) => i * 0.02))
  const ocupNecesaria = llega(x => tirCon({ ocupacionEstabilizada: x }), Array.from({ length: 46 }, (_, i) => 0.5 + i * 0.01))
  const rentaNecesaria = rentaParaTir(entrada, umbral)

  const statusTir = (t: number | null) => t === null ? 'red' : t > 18 ? 'green' : t >= 12 ? 'amber' : 'red'
  const tirBase = r1(m.tirProyectoAnual)

  // Hitos del flujo (mismo formato de 9 hitos que el modelo de venta) tomados del flujo mensual.
  const acumulado: number[] = []
  m.flujoProyecto.reduce((a, v, i) => (acumulado[i] = a + v), 0)
  const hito = (mes: number, fase: string, nota: string) => {
    const v = m.flujoProyecto[mes] ?? 0
    return { mes, fase, egresos: Math.round(Math.max(0, -v)), ingresos: Math.round(Math.max(0, v)), acumulado: Math.round(acumulado[mes] ?? 0), nota }
  }
  const mitadObra = Math.max(1, Math.round(plazoObraMeses / 2))
  const flujoMensual = [
    hito(0, 'Adquisición', 'Compra del terreno'),
    hito(1, 'Permisos e inicio de obra', 'Licencias, proyecto ejecutivo y arranque'),
    hito(mitadObra, 'Construcción avanzada', '50% de avance'),
    hito(plazoObraMeses, 'Construcción finaliza', 'Divisiones, seguridad y oficina terminadas'),
    hito(m.mesApertura, 'Apertura', `Ocupación inicial ~${Math.round(S.ocupacionApertura * 100)}%`),
    hito(Math.min(m.mesSalida, m.mesApertura + Math.round(m.supuestos.mesesEstabilizacion / 2)), 'Llenado', 'Ocupación a media subida'),
    hito(Math.min(m.mesSalida, m.mesEstabilizacion), 'Estabilizada', `Ocupación ${Math.round(m.supuestos.ocupacionEstabilizada * 100)}%`),
    ...(m.paybackMes ? [hito(m.paybackMes, 'Payback con rentas', 'Se recupera la inversión solo con rentas')] : []),
    hito(m.mesSalida, 'Venta del activo', `Valor a cap rate ${Math.round(m.supuestos.capRateSalida * 100)}%`),
  ].sort((a, b) => a.mes - b.mes)

  const pct = (x: number | null, signo = '') => x === null ? 'más de lo probado' : `${signo}${Math.round(x * 100)}%`

  return {
    recomendacion: n.recomendacion ?? { tipologia: 'Minibodegas para renta', descripcion: '' },
    producto: 'minibodegas',
    financiero: {
      costoTerreno,
      costoTerrenoM2: e.costoTerrenoM2,
      construccionM2: e.construccionM2,
      costoTotalConstruccion,
      escaladoPorMix: e.escaladoMix,
      indirectos, indirectosDesglose: n.indirectosDesglose ?? [],
      honorarios, honorariosDesglose: n.honorariosDesglose ?? [],
      imprevistos, imprevistosDesglose: n.imprevistosDesglose ?? [],
      inversionTotal: Math.round(m.inversionTotal),
      precioVentaM2: superficieRentable > 0 ? Math.round(m.valorActivo / superficieRentable) : 0,
      ingresosProyectados: Math.round(m.valorActivo),
      descuentos: 0,
      ingresosNetos: Math.round(m.valorActivo),
      comercializacion: 0,
      utilidadBruta: Math.round(m.creacionValor),
      margenBruto: r1(m.margenDesarrolloPct),
      tir: r1(m.tirSocioAnual),
      tirConverge: m.tirSocioConverge,
      tirProyecto: tirBase,
      tirProyectoConverge: m.tirProyectoConverge,
      plazoObraMeses,
      plazoVentaMeses: m.mesSalida,
      inicioVentasMes: m.mesApertura,
      renta: {
        rentaM2Mes,
        fuenteRenta: renta.fuente || null,
        rentasVerificadas: renta.comparablesVerificados ?? 0,
        rentaAjustada: renta.rentaAjustada ?? null,
        rentaFijadaPorUsuario: !!usuario.rentaM2Mes,
        areaRentableM2: superficieRentable,
        ingresoBrutoEstabilizadoAnual: Math.round(m.ingresoBrutoEstabilizadoAnual),
        opexEstabilizadoAnual: Math.round(m.opexEstabilizadoAnual),
        noiEstabilizadoAnual: Math.round(m.noiEstabilizadoAnual),
        valorActivo: Math.round(m.valorActivo),
        yieldOnCostPct: r1(m.yieldOnCostPct),
        paybackMes: m.paybackMes,
        mesApertura: m.mesApertura,
        mesEstabilizacion: m.mesEstabilizacion,
        mesSalida: m.mesSalida,
        supuestos: m.supuestos,
      },
    },
    estructuraCapital: {
      equity: m.supuestos.equityPct,
      deuda: 100 - m.supuestos.equityPct,
      montoEquity: Math.round(m.montoEquity),
      montoDeuda: Math.round(m.montoDeuda),
      tipoDeuda: 'Crédito con garantía del activo (largo plazo)',
      tasaDeuda: `${m.supuestos.tasaDeudaAnual}% anual`,
      tasaDeudaAnual: m.supuestos.tasaDeudaAnual,
      costoFinanciero: Math.round(m.interesesTotales),
      tasaDescuento: 'Nominal · Antes de ISR',
      descripcion: n.estructuraCapitalDescripcion || '',
    },
    flujoMensual,
    score: { total: scoreTotal, solidezFinanciera: solidez, riesgoRegulatorio: regulatorio, exposicionMercado: mercadoScore },
    metodologiaScore: n.metodologiaScore,
    stressTest: stress.map((s, i) => ({
      titulo: s.titulo,
      escenario: n.stressTextos?.[i] || '',
      impacto: `TIR proyecto ${tirBase ?? 'N/D'}% → ${r1(s.resultado.tirProyectoAnual) ?? 'N/D'}% · Valor del activo ${mxn(s.base.valorActivo)} → ${mxn(s.resultado.valorActivo)}`,
      status: statusTir(r1(s.resultado.tirProyectoAnual)),
    })),
    puntoQuiebre: (m.tirProyectoAnual ?? -100) < umbral ? {
      desviacionMaxCostos: bajaCostoNecesaria === null ? 'Ni bajando 60%' : `Bajar ${Math.round(bajaCostoNecesaria * 100)}%`,
      absorcionMinViable: ocupNecesaria === null ? 'Ni con 95%' : `${Math.round(ocupNecesaria * 100)}% necesaria`,
      precioVentaMinimo: rentaNecesaria === null ? 'Fuera de rango' : `${mxn(rentaNecesaria)}/m²/mes necesaria`,
      resumen: `La TIR de proyecto (${tirBase ?? 'N/D'}%) ya está abajo del costo de la deuda (${umbral}%). Arriba: lo que haría falta, cada variable por separado, para llegar a ${umbral}%. ${n.puntoQuiebreResumen || ''}`.trim(),
    } : {
      desviacionMaxCostos: pct(costoMax, '+'),
      absorcionMinViable: ocupMin === null ? 'menos de lo probado' : `${Math.round(ocupMin * 100)}% de ocupación`,
      precioVentaMinimo: rentaMin === null ? 'más de lo probado' : `${mxn(rentaM2Mes * (1 - rentaMin))}/m²/mes de renta`,
      resumen: `Con TIR de proyecto abajo de ${umbral}% (costo de la deuda) deja de convenir. ${n.puntoQuiebreResumen || ''}`.trim(),
    },
  }
}
