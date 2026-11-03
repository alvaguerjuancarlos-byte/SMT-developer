import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import Anthropic from '@anthropic-ai/sdk'
import { validarComparableVenta, evaluarPlausibilidadBanda } from '@/lib/mercado/validarComparableVenta'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import { callClaudeJson } from '@smt/shared-realestate'
import { geocodificarTexto, distanciaHaversineKm } from '@/lib/geo/geocodeTexto'
import { buscarSerper, formatearResultados, numeroDeFuente, verificarCampo, type MotivoDescarte } from '@/lib/mercado/serperComparables'
import { buscarRentasMinibodegas } from '@/lib/mercado/rentasMinibodegas'
import { esMinibodegas } from '@/lib/producto/minibodegas'
import { registrarFuente, guardarComparablesSnapshot } from '@/lib/market/persistencia'

// Bloque 5 — "ningún comparable proviene de más de 5km" (criterio de aceptación del bloque
// MERCADO): tope fijo, no configurable por el usuario — ver plan.
const RADIO_MAX_KM = 5

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Palabra clave de búsqueda según el tipo de desarrollo — mismo espíritu que
// tipologiaEnvolvente() en app/api/agentes/construccion/route.ts (mapeo pragmático, sin
// categoría 1:1 para todo). Por defecto usa "departamentos" (el caso más común).
function palabraClaveVenta(tiposDesarrollo: string[] | undefined): string {
  const tipos = tiposDesarrollo || []
  if (tipos.includes('comercial')) return 'locales comerciales'
  if (tipos.includes('industrial')) return 'naves industriales'
  if (tipos.includes('unifamiliar') || tipos.includes('residencial-horizontal')) return 'casas'
  return 'departamentos'
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const { colonia, ciudad, estado, codigoPostal, tiposDesarrollo, tipoOtroTexto, bandaConstruccion, lat, lng, proyectoId } = await req.json()

  const serperKey = process.env.SERPER_API_KEY?.trim()
  if (!serperKey) {
    return NextResponse.json({ comparables: [], error: 'SERPER_API_KEY no configurado' })
  }

  try {
    // Minibodegas se rentan: los comparables son rentas de bodegas, no ventas. No se guardan en
    // el snapshot de mercado (ese histórico es de precios de venta/m²).
    if (esMinibodegas(tiposDesarrollo, tipoOtroTexto)) {
      return NextResponse.json(await buscarRentasMinibodegas(client, serperKey, { colonia, ciudad, estado }))
    }

    const lugar = [colonia, ciudad, estado].filter(Boolean).join(' ')
    const palabraClave = palabraClaveVenta(tiposDesarrollo)
    const zona = [colonia, ciudad, codigoPostal].filter(Boolean).join(' ')
    // Una búsqueda por portal — ver comparables/route.ts (terreno), mismo motivo.
    const queries = [
      `${palabraClave} en venta ${zona} precio m2`,
      `preventa ${palabraClave} ${colonia} ${ciudad} precio`,
      `preventa ${palabraClave} ${ciudad} ${estado} precio m2 site:lamudi.com.mx OR site:inmuebles24.com`,
      ...['lamudi.com.mx', 'inmuebles24.com', 'propiedades.com', 'vivanuncios.com.mx']
        .map(sitio => `${palabraClave} venta ${colonia} ${ciudad} m2 site:${sitio}`),
    ]

    const resultados = await buscarSerper(queries, serperKey)
    if (resultados.length === 0) return NextResponse.json({ comparables: [], descartados: 0 })

    const prompt = `Analiza estos resultados de búsqueda de Google sobre ${palabraClave} en venta en ${lugar}${codigoPostal ? ` (CP ${codigoPostal})` : ''}.
Cada resultado tiene un número entre corchetes y solo incluye el TEXTO que Google muestra.

RESULTADOS:
${formatearResultados(resultados)}

Para cada propiedad TERMINADA o en preventa/construcción EN VENTA (no terreno baldío) regresa:
- fuente: número del resultado entre corchetes
- tipoAnuncio: "individual" si el TEXTO describe una propiedad concreta con su propio precio o superficie, aunque la página sea un listado (un listado puede dar varios objetos, uno por propiedad); "varios" si los números son un resumen o rango de muchos anuncios (ej. "1,240 departamentos desde $1,200,000"); "otro" si es renta, no aplica o no es un anuncio
- nombre: nombre real del proyecto/desarrollo, o descripción corta si no tiene nombre propio
- direccion: dirección o colonia aproximada real
- colonia: colonia/barrio si aparece en el texto, null si no
- precioTotal: precio de venta total en MXN, o null
- citaPrecioTotal: fragmento EXACTO, copiado letra por letra del TEXTO, que contiene ese precio, o null
- precioM2: precio por m² SOLO si el texto lo dice explícitamente, o null
- citaPrecioM2: fragmento exacto que lo contiene, o null
- superficieM2: superficie de la unidad en m², o null
- citaSuperficie: fragmento exacto que la contiene (ej. "75 m²"), o null
- tipologia: ej. "2 rec · 75 m²", null si no se puede determinar
- avanceObra: EXACTAMENTE "Entregado", "En obra" o "Preventa" SOLO si el texto lo indica claramente — null si no, NO adivines
- fechaReferencia: fecha o periodo si aparece, si no ""

Reglas estrictas:
- Un listado con varias propiedades y sus datos da un objeto por propiedad: ej. "37 Departamentos en Valle Alto ; MN 850,000. 46 m² ; MN 3,252,000. 89 m²" son DOS departamentos individuales
- NO calcules, estimes ni completes números: si un dato no aparece escrito en el TEXTO, va null
- "desde", "a partir de", "pagos de", "mensualidades", "enganche" NO son precio total: precioTotal null
- Solo propiedades en VENTA, no renta, y NO terrenos sin construir
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
    const verificados: ComparableVenta[] = []

    for (const x of extraidos) {
      const fuente = resultados.find(r => r.id === numeroDeFuente(x?.fuente))
      if (!fuente) { descartar('sin_evidencia'); continue }
      if (x.tipoAnuncio !== 'individual' && x.tipoAnuncio !== 'varios') { descartar('no_aplica'); continue }

      // Solo lo comprobable en el texto de Google; la URL sale de Serper, no de Haiku.
      const candidato: ComparableVenta = {
        nombre: x.nombre || fuente.titulo,
        direccion: x.direccion || '',
        colonia: x.colonia ?? null,
        precioM2: verificarCampo(x.precioM2, x.citaPrecioM2, fuente.texto, { esPrecio: true }),
        precioTotal: verificarCampo(x.precioTotal, x.citaPrecioTotal, fuente.texto, { esPrecio: true }),
        superficieM2: verificarCampo(x.superficieM2, x.citaSuperficie, fuente.texto),
        tipologia: x.tipologia ?? null,
        avanceObra: ['Entregado', 'En obra', 'Preventa'].includes(x.avanceObra) ? x.avanceObra : null,
        fechaReferencia: x.fechaReferencia || '',
        url: fuente.url,
        origen: 'web_search',
      }
      // A diferencia de terreno, el precio total sin m² sí sirve aquí: es el ticket por unidad.
      if (!candidato.precioM2 && !candidato.precioTotal) { descartar('sin_precio'); continue }
      // Haiku marca "varios" a páginas de listado; se aceptan solo si el anuncio trae precio y
      // superficie comprobados (los rangos "desde…" ya los rechaza verificarCampo).
      if (x.tipoAnuncio === 'varios' && !(candidato.superficieM2 && (candidato.precioM2 || candidato.precioTotal))) { descartar('varios_anuncios'); continue }

      const valido = validarComparableVenta(candidato)
      if (!valido) { descartar('fuera_de_rango'); continue }

      const clave = valido.precioTotal && valido.superficieM2
        ? `${valido.precioTotal}|${valido.superficieM2}` : fuente.url
      // Una página de listado puede traer varios anuncios con datos: se repite la URL pero no el par precio|superficie.
      if (vistos.has(clave)) { descartar('repetido'); continue }
      vistos.add(clave)
      verificados.push(valido)
    }

    let comparables = verificados.slice(0, 10)
      // No se descarta ninguno por esto — solo se anota si el precio parece de un
      // desarrollo/zona no representativo de la banda de construcción declarada (ver
      // evaluarPlausibilidadBanda: puede ser plusvalía real de ubicación, no un error).
      .map(c => ({
        ...c,
        sospechosoPorBanda: evaluarPlausibilidadBanda(c.precioM2, bandaConstruccion)?.sospechosoPorBanda ?? false,
      }))

    // Bloque 5 — radio real de 5km: solo cuando el caller manda lat/lng del predio (PREFORMA,
    // desde Bloque 2). Sin coordenadas se preserva el comportamiento anterior sin filtrar —
    // cambio aditivo para no romper otros callers de esta misma ruta.
    if (typeof lat === 'number' && typeof lng === 'number') {
      const geocodificados = await Promise.all(
        comparables.map(async (c) => {
          const q = [c.direccion, c.colonia, ciudad, estado, 'México'].filter(Boolean).join(', ')
          const g = await geocodificarTexto(q)
          if (!g) return { ...c, lat: null, lng: null, colonia: c.colonia ?? null, distanciaKm: null }
          return {
            ...c,
            lat: g.lat, lng: g.lng,
            colonia: g.colonia || c.colonia || null,
            distanciaKm: distanciaHaversineKm(lat, lng, g.lat, g.lng),
          }
        }),
      )
      // Se descartan (no solo marcan) los que exceden el radio — "ningún comparable proviene
      // de más de 5km" es un criterio duro. Los que no se pudieron geocodificar se conservan
      // (no hay forma de verificar su distancia, no es lo mismo que estar fuera de rango).
      comparables = geocodificados.filter((c) => c.distanciaKm == null || c.distanciaKm <= RADIO_MAX_KM)
    }

    // Persistencia — efecto secundario, no debe tumbar la respuesta al cliente si falla (§36:
    // solo empieza a construirse el histórico real; la ruta sigue funcionando igual si esto
    // truena, como cualquier otro almacenamiento best-effort del repo).
    if (comparables.length > 0) {
      try {
        const sourceId = await registrarFuente('serper', 'web_search')
        await guardarComparablesSnapshot(comparables, { proyectoId: proyectoId ?? null, sourceId, ciudad: ciudad ?? null })
      } catch (persistError) {
        console.error('Comparables venta — error al guardar snapshot:', persistError)
      }
    }

    const descartados = Object.values(descartes).reduce((a, b) => a + (b ?? 0), 0)
    return NextResponse.json({ comparables, descartados, descartes, lugar })
  } catch (e: any) {
    console.error('Comparables venta error:', e)
    return NextResponse.json({ comparables: [], error: e.message })
  }
}
