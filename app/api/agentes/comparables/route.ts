import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
  const { colonia, ciudad, estado, codigoPostal } = await req.json()

  const serperKey = process.env.SERPER_API_KEY?.trim()
  if (!serperKey) {
    return NextResponse.json({ comparables: [], error: 'SERPER_API_KEY no configurado' })
  }

  try {
    const lugar = [colonia, ciudad, estado].filter(Boolean).join(' ')
    const queries = [
      `terreno en venta ${colonia} ${ciudad} precio m2`,
      `terreno en venta ${ciudad} ${estado} precio m2 site:lamudi.com.mx OR site:inmuebles24.com`,
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

    const prompt = `Analiza estos resultados de búsqueda de Google sobre terrenos en venta en ${lugar}.
Extrae comparables de terrenos con precio identificable.

RESULTADOS:
${snippets.join('\n---\n')}

Para cada terreno en venta que encuentres con precio, extrae:
- portal: nombre del portal (Lamudi, Inmuebles24, Vivanuncios, etc.)
- colonia: colonia o zona del terreno
- superficieM2: superficie en m² como número, null si no aparece
- precioM2: precio por m² como número, null si no se puede calcular
- precioTotal: precio total en MXN como número, null si no aparece
- distanciaRef: distancia estimada a ${colonia || ciudad} (ej: "0.5 km", "zona", "misma colonia")
- fechaPublicacion: fecha o periodo (ej: "Mayo 2026", "2025", null si no aparece)
- url: URL completa del anuncio
- titulo: título corto del listado
- origen: siempre "web_search"

Reglas:
- Solo incluye terrenos en VENTA, no renta
- Solo si puedes identificar al menos el precio total O el precio/m²
- Máximo 8 comparables
- Retorna ÚNICAMENTE un array JSON válido, sin markdown`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (response.content[0] as any).text ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    const comparablesRaw: Comparable[] = match ? JSON.parse(match[0]) : []

    const comparables = comparablesRaw
      .map(validarComparable)
      .filter((c): c is Comparable => c !== null)

    return NextResponse.json({ comparables, lugar })
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
