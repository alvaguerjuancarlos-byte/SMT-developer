// Exportación a Excel de Mastermind — SheetJS (xlsx), 4 hojas.
// Solo escribimos workbooks desde datos internos, nunca parseamos archivos subidos por el
// usuario (XLSX.read/readFile no se usan aquí), así que las vulnerabilidades conocidas de
// SheetJS relacionadas con el parseo de archivos no confiables no aplican a este uso.

import * as XLSX from 'xlsx'
import type { MastermindInputs, MastermindOutputs, SensitivityCell } from './tipos'
import { generarMatrizSensibilidad } from './sensibilidad'

function hojaInputs(inputs: MastermindInputs): (string | number)[][] {
  return [
    ['Mastermind — Inputs del proyecto', ''],
    ['Generado', new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })],
    [''],
    ['Terreno', ''],
    ['Superficie (m²)', inputs.terreno.superficieM2],
    ['Costo terreno (MXN)', inputs.terreno.costoTerreno],
    [''],
    ['Proyecto', ''],
    ['Tipo de proyecto', inputs.proyecto.tipoProyecto],
    ['Niveles', inputs.proyecto.niveles],
    ['Unidades habitacionales', inputs.proyecto.unidadesHabitacionales],
    ['m² promedio depa', inputs.proyecto.m2PromedioDepa],
    ['m² comerciales PB', inputs.proyecto.m2ComercialesPlantaBaja],
    ['Benchmark construcción', inputs.proyecto.benchmarkConstruccion],
    [''],
    ['Mercado', ''],
    ['Precio venta depas (MXN/m²)', inputs.mercado.precioVentaDepasM2],
    ['Precio locales (MXN/m²)', inputs.mercado.precioLocalesM2],
    [''],
    ['Tiempo', ''],
    ['Plazo obra (meses)', inputs.tiempo.plazoObraMeses],
    ['Plazo venta (meses)', inputs.tiempo.plazoVentaMeses],
    ['Inicio ventas (mes)', inputs.tiempo.inicioVentasMes],
    [''],
    ['Financiamiento', ''],
    ['% financiado', inputs.financiamiento.porcentajeFinanciado],
    ['Tasa anual crédito (%)', inputs.financiamiento.tasaAnualCredito],
    [''],
    ['TIR objetivo (%)', inputs.tirObjetivo],
  ]
}

function hojaFlujoCaja(outputs: MastermindOutputs): (string | number)[][] {
  const filas: (string | number)[][] = [['Mes', 'Flujo Socio (MXN)', 'Flujo Proyecto (MXN)', 'Acumulado Socio (MXN)']]
  let acumulado = 0
  outputs.flujoSocio.forEach((f, i) => {
    acumulado += f
    filas.push([i, Math.round(f), Math.round(outputs.flujoProyecto[i] ?? 0), Math.round(acumulado)])
  })
  return filas
}

function hojaSensibilidad(matriz: SensitivityCell[][]): (string | number)[][] {
  const columnas = matriz[0].map(c => c.precioVentaM2)
  const filas: (string | number)[][] = [['Benchmark \\ Precio venta', ...columnas.map(c => Math.round(c))]]
  matriz.forEach(fila => {
    filas.push([Math.round(fila[0].benchmarkMxnM2), ...fila.map(c => c.tirSocio !== null ? Math.round(c.tirSocio * 10) / 10 : 'N/D')])
  })
  return filas
}

export function exportarMastermindExcel(inputs: MastermindInputs, outputs: MastermindOutputs, nombreProyecto = 'proyecto') {
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hojaInputs(inputs)), 'Inputs')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hojaFlujoCaja(outputs)), 'Flujo de caja mensual')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hojaSensibilidad(generarMatrizSensibilidad(inputs))), 'Sensibilidad')

  const filename = `mastermind-${nombreProyecto.replace(/\s+/g, '-').toLowerCase()}.xlsx`
  XLSX.writeFile(wb, filename)
}
