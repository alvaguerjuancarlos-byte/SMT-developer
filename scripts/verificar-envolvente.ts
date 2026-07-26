// Script de sanity — NO productivo. Corre la cadena de áreas de lib/analisis/envolventeYAreas.ts
// contra los inputs reales de "Torre Las Huertas 3" e imprime el litmus de viabilidad
// (spread precio de venta / costo de construcción por m² vendible).
//
// Uso: npx tsx scripts/verificar-envolvente.ts

import { calcularEnvolvente } from '../lib/analisis/envolventeYAreas'

const ENTRADA = {
  superficieTerreno: 2300,
  cus: 2.40,
  cos: 0.60,
  nivelesMax: 4,
  densidadMaxUnidades: 46,
  tipologia: 'vertical' as const,
}

const CONSTRUCCION_M2 = 13850
const PRECIO_VENTA_M2 = 17500
const SPREAD_MINIMO_SANO = 1.6

const salida = calcularEnvolvente(ENTRADA)

console.log('=== Torre Las Huertas 3 — cadena de áreas ===')
console.log('Entrada:', ENTRADA)
console.log()
console.log('areaMaxConstruible:', salida.areaMaxConstruible, 'm²')
console.log('areaConstruida:', salida.areaConstruida)
console.log('areaVendible:', salida.areaVendible)
console.log('areaNoVendible:', salida.areaNoVendible)
console.log('eficienciaVendiblePct:', salida.eficienciaVendiblePct)
console.log()

const costoConstruccionBase = salida.areaConstruida.base * CONSTRUCCION_M2
const costoConstruccionPorM2Vendible = costoConstruccionBase / salida.areaVendible.base
const spreadVentaConstruccion = PRECIO_VENTA_M2 / costoConstruccionPorM2Vendible

console.log('=== Litmus de viabilidad ===')
console.log('construccionM2 (input):', CONSTRUCCION_M2)
console.log('precioVentaM2 (input):', PRECIO_VENTA_M2)
console.log('costoConstruccionBase:', Math.round(costoConstruccionBase * 10) / 10)
console.log('costoConstruccionPorM2Vendible:', Math.round(costoConstruccionPorM2Vendible * 10) / 10)
console.log('spreadVentaConstruccion:', Math.round(spreadVentaConstruccion * 100) / 100)

if (spreadVentaConstruccion < SPREAD_MINIMO_SANO) {
  console.log(`\n⚠ ALERTA: spreadVentaConstruccion (${(Math.round(spreadVentaConstruccion * 100) / 100)}) < ${SPREAD_MINIMO_SANO} — el precio de venta/m² vendible no cubre con margen sano el costo de construcción/m² vendible.`)
}
