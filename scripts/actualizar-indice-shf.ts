// Refresca lib/market/shfIndice.data.ts con el trimestre más reciente del Índice SHF de Precios
// de la Vivienda (Sociedad Hipotecaria Federal, gob.mx) — NO hay API ni URL estable: hay que ir
// a buscar el link nuevo a mano cada trimestre en
// https://www.gob.mx/shf/acciones-y-programas/estadisticas-e-investigacion (documento "Índice
// SHF de Precios de la Vivienda en México [año] a [año]" → link "datos abiertos" en xlsx).
//
// Uso: npx tsx scripts/actualizar-indice-shf.ts <url-del-xlsx-datos-abiertos>

import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { join } from 'path'

interface FilaSHF {
  Global: string | null
  Estado: string | null
  Municipio: string | null
  Trimestre: number
  Año: number
  Indice: number
}

const SALIDA = join(__dirname, '..', 'lib', 'market', 'shfIndice.data.ts')

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Uso: npx tsx scripts/actualizar-indice-shf.ts <url-del-xlsx-datos-abiertos>')
    console.error('Buscar el link vigente en https://www.gob.mx/shf/acciones-y-programas/estadisticas-e-investigacion')
    process.exit(1)
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar el xlsx: HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())

  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<FilaSHF>(sheet, { defval: null })

  const serie = (filtro: (r: FilaSHF) => boolean) =>
    rows.filter(filtro)
      .sort((a, b) => a.Año - b.Año || a.Trimestre - b.Trimestre)
      .map((r) => ({ anio: r.Año, trimestre: r.Trimestre, indice: r.Indice }))

  const economicaSocial = serie((r) => r.Global === 'Económica - Social')
  const mediaResidencial = serie((r) => r.Global === 'Media - Residencial')
  const zmMonterrey = serie((r) => r.Global === 'ZM Monterrey')
  const municipioMonterrey = serie((r) => r.Estado === 'Nuevo León' && r.Municipio === 'Monterrey')

  for (const [nombre, s] of [
    ['Económica-Social', economicaSocial], ['Media-Residencial', mediaResidencial],
    ['ZM Monterrey', zmMonterrey], ['Monterrey (municipio)', municipioMonterrey],
  ] as const) {
    if (s.length === 0) throw new Error(`Serie "${nombre}" salió vacía — revisar si el SHF cambió los nombres de categoría/municipio en este trimestre.`)
  }

  const tsArray = (nombre: string, arr: { anio: number; trimestre: number; indice: number }[]) => {
    const lineas = arr.map((p) => `  { anio: ${p.anio}, trimestre: ${p.trimestre}, indice: ${p.indice} },`)
    return `export const ${nombre}: PuntoIndiceSHF[] = [\n${lineas.join('\n')}\n]\n`
  }

  const fecha = new Date().toISOString().slice(0, 10)
  const contenido = `// Índice SHF de Precios de la Vivienda en México — Sociedad Hipotecaria Federal (gob.mx).
// Serie real, trimestral, base 2017=100, descargada y verificada en vivo el ${fecha} desde:
// ${url}
// (el link cambia cada trimestre — se busca el más reciente en
// https://www.gob.mx/shf/acciones-y-programas/estadisticas-e-investigacion).
//
// DATA EDITABLE — no contiene lógica de cálculo (mismo criterio que lib/estimador/catalogo.ts).
// Para refrescar: npx tsx scripts/actualizar-indice-shf.ts <url-del-xlsx-nuevo>
//
// Cobertura verificada del archivo fuente:
// - Bandas de precio reales ("Económica - Social" / "Media - Residencial") SOLO existen a nivel
//   NACIONAL — nunca cruzadas con estado/municipio. No existe "banda alta de Monterrey".
// - En Nuevo León el índice SOLO cubre 4 municipios: Monterrey, Apodaca, García, Juárez. San
//   Pedro Garza García NO aparece (el índice se basa en avalúos de crédito hipotecario — San
//   Pedro tiene poco volumen de ese tipo de transacción).
// - Por eso se incluye también "ZM Monterrey" (zona metropolitana completa, todas las bandas
//   mezcladas) como la referencia geográfica más relevante disponible para San Pedro.
export interface PuntoIndiceSHF { anio: number; trimestre: 1 | 2 | 3 | 4; indice: number }

// Nacional, banda económica-social — usada como referencia de "tramo bajo" real para
// lib/market/betaTramoEngine.ts cuando no hay una colonia de referencia interna disponible.
${tsArray('SHF_NACIONAL_ECONOMICA_SOCIAL', economicaSocial)}
// Nacional, banda media-residencial — para calibrar el beta real bajo→alto contra
// SHF_NACIONAL_ECONOMICA_SOCIAL (misma cobertura temporal exacta).
${tsArray('SHF_NACIONAL_MEDIA_RESIDENCIAL', mediaResidencial)}
// Zona Metropolitana de Monterrey completa (todas las bandas mezcladas) — la referencia
// geográfica real más cercana a San Pedro Garza García que cubre el índice (San Pedro no tiene
// municipio propio en esta fuente). Se expone como dato de CONTEXTO regional, nunca como
// sustituto de la plusvalía real de una colonia específica.
${tsArray('SHF_ZM_MONTERREY', zmMonterrey)}
// Municipio de Monterrey (dentro de la ZM) — más acotado que ZM Monterrey, se deja disponible
// por si en el futuro se necesita una referencia municipal en vez de metropolitana.
${tsArray('SHF_MUNICIPIO_MONTERREY', municipioMonterrey)}`

  writeFileSync(SALIDA, contenido)
  console.log(`Escrito ${SALIDA}`)
  console.log(`Económica-Social: ${economicaSocial.length} trimestres (${economicaSocial[0].anio}Q${economicaSocial[0].trimestre} – ${economicaSocial[economicaSocial.length - 1].anio}Q${economicaSocial[economicaSocial.length - 1].trimestre})`)
  console.log('Recuerda correr: npx vitest run lib/market/ -- el beta y las series cambian con cada refresco.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
