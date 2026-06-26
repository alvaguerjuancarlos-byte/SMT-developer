import { NextRequest, NextResponse } from 'next/server'
import { fetchIsochrones, OrsError, type IsochroneResult } from '@/lib/geo/isochrone'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const CACHE_DAYS   = 30
const RANGOS       = [15, 30, 45]

function sbHeaders(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

interface CachedRow {
  rango_min: number
  geojson: object
  poblacion_alcanzada: number | null
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    terrenoId: string
    lat: number
    lng: number
    perfil?: 'driving' | 'walking'
  }

  const { terrenoId, lat, lng, perfil = 'driving' } = body

  if (!terrenoId || lat == null || lng == null) {
    return NextResponse.json(
      { error: 'terrenoId, lat y lng son requeridos' },
      { status: 400 },
    )
  }

  // ── 1. Buscar cache válido (< 30 días) ────────────────────────────────────
  const cutoff = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString()
  const cacheUrl =
    `${SUPABASE_URL}/rest/v1/isocronas` +
    `?terreno_id=eq.${terrenoId}` +
    `&perfil=eq.${perfil}` +
    `&fecha_calculo=gte.${cutoff}` +
    `&select=rango_min,geojson,poblacion_alcanzada`

  const cacheRes  = await fetch(cacheUrl, { headers: sbHeaders() })
  const cached: CachedRow[] = cacheRes.ok ? await cacheRes.json() : []

  const cachedSet    = new Set(cached.map(c => c.rango_min))
  const pendingRangos = RANGOS.filter(r => !cachedSet.has(r))

  let fresh: IsochroneResult[] = []

  // ── 2. Llamar a ORS solo para los rangos sin cache ────────────────────────
  if (pendingRangos.length > 0) {
    const apiKey = process.env.ORS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ORS_API_KEY no configurada en el servidor' }, { status: 500 })
    }

    try {
      const all = await fetchIsochrones(lat, lng, perfil, apiKey)
      fresh = all.filter(iso => pendingRangos.includes(iso.rango_min))
    } catch (err) {
      if (err instanceof OrsError) {
        if (err.status === 429) {
          return NextResponse.json(
            { error: 'Límite de peticiones ORS alcanzado, intenta en unos segundos' },
            { status: 429 },
          )
        }
        if (err.status === 403) {
          return NextResponse.json(
            { error: 'ORS_API_KEY inválida o sin permisos' },
            { status: 500 },
          )
        }
        return NextResponse.json(
          { error: `Error de OpenRouteService (${err.status})` },
          { status: 502 },
        )
      }
      throw err
    }

    // ── 3. Guardar en cache (upsert) ─────────────────────────────────────────
    if (fresh.length > 0) {
      const records = fresh.map(iso => ({
        terreno_id:          terrenoId,
        perfil,
        rango_min:           iso.rango_min,
        geojson:             iso.geojson,
        poblacion_alcanzada: iso.poblacion_alcanzada,
        fecha_calculo:       new Date().toISOString(),
      }))

      await fetch(`${SUPABASE_URL}/rest/v1/isocronas`, {
        method:  'POST',
        headers: sbHeaders({ Prefer: 'resolution=merge-duplicates' }),
        body:    JSON.stringify(records),
      })
    }
  }

  // ── 4. Combinar cache + frescos, ordenar por rango ────────────────────────
  const isocronas = [
    ...cached,
    ...fresh.map(f => ({
      rango_min:           f.rango_min,
      geojson:             f.geojson,
      poblacion_alcanzada: f.poblacion_alcanzada,
    })),
  ].sort((a, b) => a.rango_min - b.rango_min)

  return NextResponse.json({ isocronas })
}
