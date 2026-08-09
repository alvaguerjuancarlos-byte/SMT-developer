import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'

// Maps OSM highway tags → our classification
function mapHighway(tag: string): string {
  if (['motorway', 'trunk', 'primary'].includes(tag)) return 'arterial'
  if (['secondary'].includes(tag)) return 'colectora'
  if (['tertiary', 'unclassified'].includes(tag)) return 'secundaria'
  if (['residential', 'living_street'].includes(tag)) return 'local'
  if (['service', 'footway', 'path', 'pedestrian'].includes(tag)) return 'privada'
  return ''
}

// Maps OSM landuse tags → our uso de suelo
function mapLanduse(tag: string): string {
  if (['residential'].includes(tag)) return 'habitacional'
  if (['commercial', 'retail'].includes(tag)) return 'comercial'
  if (['mixed_use', 'civic'].includes(tag)) return 'mixto'
  if (['industrial'].includes(tag)) return 'industrial'
  if (['farmland', 'farmyard', 'meadow', 'orchard', 'greenhouse_horticulture'].includes(tag)) return 'agricola'
  return ''
}

// Overpass API query
async function overpass(query: string): Promise<any> {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}`)
  return res.json()
}

// Open Elevation — batch query for slope estimation
async function getElevations(points: { latitude: number; longitude: number }[]): Promise<number[]> {
  const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: points }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`OpenElevation ${res.status}`)
  const json = await res.json()
  return json.results.map((r: any) => r.elevation as number)
}

// Estimate slope % from elevation delta across ~100m span
function estimateSlope(elevations: number[]): { pendiente: string; delta: number } {
  const [center, north, south, east, west] = elevations
  const deltaNS = Math.abs(north - south)
  const deltaEW = Math.abs(east - west)
  const maxDelta = Math.max(deltaNS, deltaEW)
  // 100m span → slope = (delta / 100) * 100 = delta %
  const pct = maxDelta
  if (pct < 5) return { pendiente: 'plano', delta: pct }
  if (pct < 10) return { pendiente: 'suave', delta: pct }
  if (pct < 20) return { pendiente: 'moderada', delta: pct }
  return { pendiente: 'pronunciada', delta: pct }
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat y lng requeridos' }, { status: 400 })
  }

  const result: Record<string, any> = {}

  // ── 1. Overpass: roads, landuse, services ────────────────────────────────
  try {
    const q = `
[out:json][timeout:8];
(
  way(around:60,${lat},${lng})["highway"];
  way(around:200,${lat},${lng})["landuse"];
  node(around:150,${lat},${lng})["amenity"="water_point"];
  way(around:80,${lat},${lng})["waterway"];
  way(around:30,${lat},${lng})["highway"]["surface"];
  way(around:10,${lat},${lng})["power"="line"];
);
out body;
`
    const data = await overpass(q)
    const elements: any[] = data.elements ?? []

    // Clasificación vial — take the most prominent road type within 60m
    const roads = elements.filter(e => e.type === 'way' && e.tags?.highway)
    const highwayPriority = ['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','service','footway']
    let bestRoad = ''
    for (const tag of highwayPriority) {
      if (roads.some(r => r.tags.highway === tag)) { bestRoad = tag; break }
    }
    if (bestRoad) result.clasificacionVial = mapHighway(bestRoad)

    // Pavimento — check if the nearest road has a surface tag
    const pavimentoWay = roads.find(r => r.tags?.surface)
    if (pavimentoWay) {
      const surf = pavimentoWay.tags.surface
      result.pavimento = ['asphalt','concrete','paving_stones','sett'].includes(surf) ? 'si' : 'no'
    } else if (roads.some(r => ['primary','secondary','tertiary','residential'].includes(r.tags?.highway))) {
      result.pavimento = 'si'  // likely paved if it's a classified road
    }

    // Esquina — detect if 2+ different road names meet near the point
    const roadNames = new Set(roads.map(r => r.tags?.name).filter(Boolean))
    if (roadNames.size >= 2) result.esEsquina = 'si'
    else if (roadNames.size === 1) result.esEsquina = 'no'

    // Uso de suelo — from landuse ways
    const landuses = elements.filter(e => e.type === 'way' && e.tags?.landuse)
    if (landuses.length > 0) {
      const mapped = mapLanduse(landuses[0].tags.landuse)
      if (mapped) result.usoSuelo = mapped
    }

    // Agua — OSM water points or waterways nearby hint at municipal water
    const hasWaterInfra = elements.some(e => e.tags?.amenity === 'water_point' || e.tags?.waterway)
    // Better heuristic: if residential area → likely has water
    if (hasWaterInfra) result.agua = 'red-municipal'

    // Electricidad — power lines
    const hasPower = elements.some(e => e.tags?.power === 'line')
    if (hasPower) result.electricidad = 'cfe-frente'

  } catch (err) {
    console.error('Overpass error:', err)
    // non-fatal — continue with elevation
  }

  // ── 2. Open Elevation: slope ─────────────────────────────────────────────
  try {
    // 50m in degrees: ~0.00045° lat, ~0.00045°/cos(lat) lng
    const dLat = 0.00045
    const dLng = 0.00045 / Math.cos((lat * Math.PI) / 180)

    const points = [
      { latitude: lat,         longitude: lng },          // center
      { latitude: lat + dLat,  longitude: lng },          // north
      { latitude: lat - dLat,  longitude: lng },          // south
      { latitude: lat,         longitude: lng + dLng },   // east
      { latitude: lat,         longitude: lng - dLng },   // west
    ]

    const elevations = await getElevations(points)
    const { pendiente, delta } = estimateSlope(elevations)
    result.pendiente = pendiente
    result.elevacionDelta = Math.round(delta * 10) / 10

  } catch (err) {
    console.error('OpenElevation error:', err)
    // non-fatal
  }

    // ── 3. Nominatim reverse geocode ────────────────────────────────────────
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'User-Agent': 'SMTDeveloper/1.0', 'Accept-Language': 'es' }, signal: AbortSignal.timeout(6000) },
    )
    if (res.ok) {
      const json = await res.json()
      const a = json.address ?? {}
      const pick = (...keys: string[]) => keys.map(k => a[k]).find(Boolean) ?? ''
      result.direccion = [a.road, a.house_number].filter(Boolean).join(' ')
      result.colonia = pick('suburb', 'neighbourhood', 'quarter', 'city_district')
      result.ciudad = pick('city', 'town', 'municipality', 'county')
      result.estado = a.state ?? ''
      result.codigoPostal = a.postcode ?? ''
    }
  } catch (err) {
    console.error('Nominatim reverse error:', err)
  }

  // Always return 200 — partial results are fine
  return NextResponse.json({ ok: true, inferred: result })
}
