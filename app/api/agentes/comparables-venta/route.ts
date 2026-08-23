import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import Anthropic from '@anthropic-ai/sdk'
import { validarComparableVenta, evaluarPlausibilidadBanda } from '@/lib/mercado/validarComparableVenta'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import { callClaudeJson } from '@/lib/llmJson'
import { geocodificarTexto, distanciaHaversineKm } from '@/lib/geo/geocodeTexto'

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

  const { colonia, ciudad, estado, codigoPostal, tiposDesarrollo, bandaConstruccion, lat, lng } = await req.json()

  const serperKey = process.env.SERPER_API_KEY?.trim()
  if (!serperKey) {
    return NextResponse.json({ comparables: [], error: 'SERPER_API_KEY no configurado' })
  }

  try {
    const lugar = [colonia, ciudad, estado].filter(Boolean).join(' ')
    const palabraClave = palabraClaveVenta(tiposDesarrollo)
    const queries = [
      `${palabraClave} en venta ${colonia} ${ciudad} precio m2`,
      `preventa ${palabraClave} ${ciudad} ${estado} precio m2 site:lamudi.com.mx OR site:inmuebles24.com`,
    ]

    const snippets: string[] = []
    for (const q of queries) {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'mx', hl: 'es', num: 8 }),
      })
      if (!res.ok) continue
      const json = await res.json()
      ;(json.organic ?? []).forEach((r: any) => {
        snippets.push(`URL: ${r.link}\nTÍTULO: ${r.title}\nSNIPPET: ${r.snippet ?? ''}`)
      })
    }

    if (snippets.length === 0) return NextResponse.json({ comparables: [] })

    const prompt = `Analiza estos resultados de búsqueda de Google sobre ${palabraClave} en venta en ${lugar}${codigoPostal ? ` (CP ${codigoPostal})` : ''}.
Extrae comparables de propiedades TERMINADAS o en preventa/construcción con precio identificable — NO terrenos baldíos.

RESULTADOS:
${snippets.join('\n---\n')}

Para cada propiedad en venta que encuentres con precio, extrae:
- nombre: nombre real del proyecto/desarrollo, o descripción corta si no tiene nombre propio
- direccion: dirección o colonia aproximada real
- colonia: colonia/barrio si se puede identificar en el texto, null si no aparece
- precioM2: precio por m² como número, null si no se puede calcular
- precioTotal: precio total en MXN como número, null si no aparece
- superficieM2: superficie de la unidad en m² como número, null si no aparece
- tipologia: ej. "2 rec · 75 m²", null si no se puede determinar
- avanceObra: EXACTAMENTE "Entregado", "En obra" o "Preventa" SOLO si el snippet lo indica claramente — null si no hay forma de saberlo, NO adivines
- fechaReferencia: fecha o periodo (ej: "Q1 2026", "2025"), null si no aparece
- url: URL completa del anuncio
- origen: siempre "web_search"

Reglas:
- Solo incluye propiedades en VENTA, no renta, y NO terrenos sin construir
- Solo si puedes identificar al menos el precio total O el precio/m²
- Máximo 8 comparables
- Retorna ÚNICAMENTE un array JSON válido, sin markdown`

    const comparablesRaw: ComparableVenta[] = await callClaudeJson(client, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }, /\[[\s\S]*\]/)

    let comparables = comparablesRaw
      .map(validarComparableVenta)
      .filter((c): c is ComparableVenta => c !== null)
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

    return NextResponse.json({ comparables, lugar })
  } catch (e: any) {
    console.error('Comparables venta error:', e)
    return NextResponse.json({ comparables: [], error: e.message })
  }
}
