import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface MLListing {
  id: string
  titulo: string
  precio: number
  moneda: string
  urlAnuncio: string
  foto: string | null
  ubicacion: {
    direccion: string
    colonia: string
    municipio: string
    estado: string
    cp: string
    lat: number | null
    lng: number | null
  }
  superficie: number | null
  frente: number | null
  descripcion: string
  portal: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const estado    = searchParams.get('estado') ?? ''
  const municipio = searchParams.get('municipio') ?? ''
  const colonia   = searchParams.get('colonia') ?? ''
  const cp        = searchParams.get('cp') ?? ''

  if (!estado) return NextResponse.json({ error: 'Estado requerido' }, { status: 400 })
  const serperKey = process.env.SERPER_API_KEY?.trim()
  if (!serperKey) return NextResponse.json({ error: 'SERPER_API_KEY no configurado' }, { status: 503 })

  try {
    // Construir queries de búsqueda
    const lugar = [colonia, municipio, estado].filter(Boolean).join(' ')
    const queries = [
      `terreno en venta ${lugar} precio site:lamudi.com.mx OR site:inmuebles24.com`,
      `terreno en venta ${lugar} m2`,
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
      const organic: any[] = json.organic ?? []
      organic.forEach((r: any) => {
        snippets.push(`URL: ${r.link}\nTÍTULO: ${r.title}\nSNIPPET: ${r.snippet ?? ''}`)
      })
    }

    if (snippets.length === 0) {
      return NextResponse.json({ total: 0, results: [], query: lugar })
    }

    // Claude extrae datos estructurados de los snippets
    const extractPrompt = `Eres un extractor de datos de listados inmobiliarios.
Analiza estos resultados de búsqueda de Google sobre terrenos en venta y extrae listados individuales.

RESULTADOS:
${snippets.join('\n---\n')}

Extrae hasta 10 listados únicos de terrenos en venta. Para cada uno retorna un objeto JSON con estos campos:
- id: string único (usa el dominio + número aleatorio)
- titulo: título del listado
- precio: número (precio en MXN, 0 si no está claro)
- moneda: "MXN" siempre
- urlAnuncio: URL del listado
- foto: null siempre
- ubicacion: { direccion: "", colonia: "${colonia || ''}", municipio: "${municipio || ''}", estado: "${estado}", cp: "${cp || ''}", lat: null, lng: null }
- superficie: número en m² o null si no aparece
- frente: número en metros o null
- descripcion: snippet relevante del listado
- portal: nombre del portal (Lamudi, Inmuebles24, etc.)

Ignora resultados que no sean listados de terrenos en venta (artículos, guías, etc.).
Retorna ÚNICAMENTE un array JSON válido, sin markdown ni texto extra.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: extractPrompt }],
    })

    const text = (response.content[0] as any).text ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ total: 0, results: [], query: lugar })

    const results: MLListing[] = JSON.parse(match[0])

    return NextResponse.json({ total: results.length, results, query: lugar })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
