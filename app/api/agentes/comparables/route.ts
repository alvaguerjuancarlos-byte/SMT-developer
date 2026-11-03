import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import Anthropic from '@anthropic-ai/sdk'
import { callClaudeJson } from '@smt/shared-realestate'
import { buscarSerper, formatearResultados, numeroDeFuente, portalDeUrl, verificarCampo, type MotivoDescarte } from '@/lib/mercado/serperComparables'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface Comparable {
  portal: string
  colonia: string
  superficieM2: number | null
  precioM2: number | null
  precioTotal: number | null
  distanciaRef: string
  fechaPublicacion: string
  url: string
  titulo: string
  origen: 'web_search'
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const { colonia, ciudad, estado, codigoPostal } = await req.json()

  const serperKey = process.env.SERPER_API_KEY?.trim()
  if (!serperKey) {
    return NextResponse.json({ comparables: [], error: 'SERPER_API_KEY no configurado' })
  }

  try {
    const lugar = [colonia, ciudad, estado].filter(Boolean).join(' ')
    const zona = [colonia, ciudad, codigoPostal].filter(Boolean).join(' ')
    // Una búsqueda por portal: con 2 búsquedas generales salían sobre todo páginas que juntan
    // muchos anuncios ("6 terrenos desde…"), que no traen precio ni superficie de uno solo.
    const queries = [
      `terreno en venta ${zona} precio m2`,
      `terreno en venta ${ciudad} ${estado} precio m2 site:lamudi.com.mx OR site:inmuebles24.com`,
      ...['lamudi.com.mx', 'inmuebles24.com', 'propiedades.com', 'vivanuncios.com.mx', 'mercadolibre.com.mx']
        .map(sitio => `terreno venta ${colonia} ${ciudad} m2 site:${sitio}`),
    ]

    const resultados = await buscarSerper(queries, serperKey)
    if (resultados.length === 0) return NextResponse.json({ comparables: [], descartados: 0 })

    const prompt = `Analiza estos resultados de búsqueda de Google sobre terrenos en venta en ${lugar}.
Cada resultado tiene un número entre corchetes y solo incluye el TEXTO que Google muestra.

RESULTADOS:
${formatearResultados(resultados)}

Para cada terreno en venta que aparezca en los resultados regresa un objeto con:
- fuente: número del resultado entre corchetes (ej. 3)
- tipoAnuncio: "individual" si el TEXTO describe una propiedad concreta con su propio precio o superficie, aunque la página sea un listado (un listado puede dar varios objetos, uno por propiedad); "varios" si los números son un resumen o rango de muchos anuncios (ej. "6 terrenos en venta desde $1,150,000"); "otro" si es renta, no aplica o no es un anuncio
- colonia: colonia o zona del terreno si aparece, si no ""
- precioTotal: precio de venta total en MXN, o null
- citaPrecioTotal: el fragmento EXACTO, copiado letra por letra del TEXTO, que contiene ese precio (ej. "$1,250,000"), o null
- precioM2: precio por m² SOLO si el texto lo dice explícitamente, o null
- citaPrecioM2: fragmento exacto que lo contiene, o null
- superficieM2: superficie del terreno en m², o null
- citaSuperficie: fragmento exacto que la contiene (ej. "250 m²"), o null
- distanciaRef: distancia estimada a ${colonia || ciudad} (ej. "misma colonia", "zona", "2 km")
- fechaPublicacion: fecha o periodo si aparece, si no ""
- titulo: título corto del anuncio

Reglas estrictas:
- Un listado con varias propiedades y sus datos da un objeto por propiedad: ej. "55 Terrenos en venta en Culiacán ; MN 3,150,000. 252 m² lote. Francisco Labastida 157 ; MN 2,000,000. 1500 m² lote" son DOS terrenos individuales
- NO calcules, estimes ni completes números: si un dato no aparece escrito en el TEXTO, va null
- "desde", "a partir de", "pagos de", "mensualidades", "enganche" NO son precio total: precioTotal null
- Solo terrenos en VENTA (no renta, no casas ni departamentos)
- Máximo 15 objetos
- Retorna ÚNICAMENTE un array JSON válido, sin markdown`

    const extraidos: any[] = await callClaudeJson(client, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      temperature: 0, // misma entrada → misma extracción; sin esto el número de comparables variaba entre corridas
      messages: [{ role: 'user', content: prompt }],
    }, /\[[\s\S]*\]/)

    const descartes: Partial<Record<MotivoDescarte, number>> = {}
    const descartar = (m: MotivoDescarte) => { descartes[m] = (descartes[m] ?? 0) + 1 }
    const vistos = new Set<string>()
    const comparables: Comparable[] = []

    for (const x of extraidos) {
      const fuente = resultados.find(r => r.id === numeroDeFuente(x?.fuente))
      if (!fuente) { descartar('sin_evidencia'); continue }
      if (x.tipoAnuncio !== 'individual' && x.tipoAnuncio !== 'varios') { descartar('no_aplica'); continue }

      // Solo se queda lo que se puede comprobar en el texto de Google; la URL y el portal
      // salen del resultado de Serper, no de lo que escriba Haiku.
      const candidato: Comparable = {
        portal: portalDeUrl(fuente.url),
        colonia: x.colonia || '',
        superficieM2: verificarCampo(x.superficieM2, x.citaSuperficie, fuente.texto),
        precioM2: verificarCampo(x.precioM2, x.citaPrecioM2, fuente.texto, { esPrecio: true }),
        precioTotal: verificarCampo(x.precioTotal, x.citaPrecioTotal, fuente.texto, { esPrecio: true }),
        distanciaRef: x.distanciaRef || '',
        fechaPublicacion: x.fechaPublicacion || '',
        url: fuente.url,
        titulo: x.titulo || fuente.titulo,
        origen: 'web_search',
      }
      // Haiku marca "varios" a páginas de listado; se aceptan solo si el anuncio trae precio y
      // superficie comprobados (los rangos "desde…" ya los rechaza verificarCampo).
      if (x.tipoAnuncio === 'varios' && !(candidato.superficieM2 && (candidato.precioM2 || candidato.precioTotal))) { descartar('varios_anuncios'); continue }
      if (!candidato.precioM2 && !(candidato.precioTotal && candidato.superficieM2)) { descartar('sin_precio'); continue }

      const valido = validarComparable(candidato)
      if (!valido) { descartar('fuera_de_rango'); continue }

      const clave = valido.precioTotal && valido.superficieM2
        ? `${valido.precioTotal}|${valido.superficieM2}` : fuente.url
      // Una página de listado puede traer varios anuncios con datos: se repite la URL pero no el par precio|superficie.
      if (vistos.has(clave)) { descartar('repetido'); continue }
      vistos.add(clave)
      comparables.push(valido)
    }

    const descartados = Object.values(descartes).reduce((a, b) => a + (b ?? 0), 0)
    return NextResponse.json({ comparables: comparables.slice(0, 10), descartados, descartes, lugar })
  } catch (e: any) {
    console.error('Comparables error:', e)
    return NextResponse.json({ comparables: [], error: e.message })
  }
}

// El extractor (Haiku) lee snippets de Google truncados/ambiguos — a veces confunde
// precio total con precio/m² (ej. "$1,200,000" sin aclarar unidad). Antes de dejar
// que el Agente Terreno use estos comparables para calibrar su valuación, verificamos
// que los números cuadren entre sí y caigan en un rango plausible para terreno urbano.
const PRECIO_M2_MIN = 300
const PRECIO_M2_MAX = 60000
const TOLERANCIA = 0.20

function validarComparable(c: Comparable): Comparable | null {
  let precioM2 = c.precioM2
  let precioTotal = c.precioTotal
  const superficieM2 = c.superficieM2

  if (precioM2 && precioTotal && superficieM2 && superficieM2 > 0) {
    const impliedM2 = precioTotal / superficieM2
    const diff = Math.abs(impliedM2 - precioM2) / precioM2
    if (diff > TOLERANCIA) {
      // No cuadran — probar si el modelo invirtió los campos (precioM2 era el total y viceversa).
      const impliedM2Swapped = precioM2 / superficieM2
      const diffSwapped = Math.abs(impliedM2Swapped - precioTotal) / precioTotal
      if (diffSwapped < TOLERANCIA) {
        ;[precioM2, precioTotal] = [precioTotal, precioM2]
      } else {
        return null // inconsistente y no reconciliable — no confiable como comparable
      }
    }
  } else if (precioM2 && !precioTotal && superficieM2 && superficieM2 > 0) {
    precioTotal = Math.round(precioM2 * superficieM2)
  } else if (precioTotal && !precioM2 && superficieM2 && superficieM2 > 0) {
    precioM2 = Math.round(precioTotal / superficieM2)
  }

  if (precioM2 && (precioM2 < PRECIO_M2_MIN || precioM2 > PRECIO_M2_MAX)) {
    return null // fuera de rango plausible — probable campo mal clasificado
  }

  if (!precioM2 && !precioTotal) {
    return null // sin ningún precio no sirve como comparable de valuación
  }

  return { ...c, precioM2, precioTotal }
}
