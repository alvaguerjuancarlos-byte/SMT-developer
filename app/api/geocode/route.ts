import { NextRequest, NextResponse } from 'next/server'

interface GeoResult {
  found: true
  lat: number
  lng: number
  colonia: string
  municipio: string
  estado: string
}

const H = { 'User-Agent': 'SMTDeveloper/1.0', 'Accept-Language': 'es' }

function pick(addr: Record<string, string>, ...keys: string[]) {
  return keys.map(k => addr[k]).find(Boolean) ?? ''
}

function matchCtx(text: string, ciudad: string, estado: string) {
  const t = text.toLowerCase()
  return (ciudad && t.includes(ciudad.toLowerCase())) ||
         (estado  && t.includes(estado.toLowerCase()))
}

export async function GET(req: NextRequest) {
  const cp        = req.nextUrl.searchParams.get('cp') ?? ''
  const ciudad    = req.nextUrl.searchParams.get('ciudad') ?? ''
  const estado    = req.nextUrl.searchParams.get('estado') ?? ''
  const direccion = req.nextUrl.searchParams.get('direccion') ?? ''
  const colonia   = req.nextUrl.searchParams.get('colonia') ?? ''
  const q         = req.nextUrl.searchParams.get('q') ?? ''   // free-text mode, no CP required

  // ── MODO TEXTO LIBRE (sin CP) ─────────────────────────────────────────────
  if (q) {
    // Photon free-text
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=es&limit=5&countrycodes=mx`,
        { headers: H },
      )
      if (res.ok) {
        const json = await res.json()
        const feats: any[] = json.features ?? []
        const feat = feats[0]
        if (feat) {
          const [lng, lat] = feat.geometry.coordinates
          const p = feat.properties
          return NextResponse.json({
            found: true, lat, lng,
            colonia: p.suburb ?? p.neighbourhood ?? p.quarter ?? colonia,
            municipio: p.city ?? p.town ?? ciudad,
            estado: p.state ?? estado,
          } satisfies GeoResult)
        }
      }
    } catch { /* fall through */ }

    // Nominatim free-text
    try {
      const u = new URL('https://nominatim.openstreetmap.org/search')
      u.searchParams.set('q', q)
      u.searchParams.set('countrycodes', 'mx')
      u.searchParams.set('format', 'json')
      u.searchParams.set('addressdetails', '1')
      u.searchParams.set('limit', '3')
      const res = await fetch(u.toString(), { headers: H })
      if (res.ok) {
        const json: any[] = await res.json()
        const r = json[0]
        if (r) {
          const a = r.address ?? {}
          return NextResponse.json({
            found: true,
            lat: parseFloat(r.lat), lng: parseFloat(r.lon),
            colonia: pick(a, 'suburb', 'neighbourhood', 'quarter') || colonia,
            municipio: pick(a, 'city', 'town', 'municipality') || ciudad,
            estado: a.state || estado,
          } satisfies GeoResult)
        }
      }
    } catch { /* fall through */ }

    return NextResponse.json({ found: false })
  }

  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ found: false, error: 'CP inválido' }, { status: 400 })
  }

  // ── MODO DIRECCIÓN (Flujo A) ──────────────────────────────────────────────
  if (direccion) {

    // 1. Google Maps — mayor precisión de calle en México
    try {
      const q = [direccion, colonia, ciudad, estado, 'México'].filter(Boolean).join(', ')
      const key = process.env.GOOGLE_GEOCODING_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:MX&key=${key}`,
      )
      const json = await res.json()
      console.log('[geocode] Google Maps status:', json.status, json.error_message ?? '')
      if (json.status === 'OK' && json.results?.length) {
        const r = json.results[0]
        const comps: { types: string[]; long_name: string }[] = r.address_components
        const get = (...t: string[]) => comps.find(c => t.some(x => c.types.includes(x)))?.long_name ?? ''
        return NextResponse.json({
          found: true,
          lat: r.geometry.location.lat, lng: r.geometry.location.lng,
          colonia: get('sublocality_level_1', 'neighborhood', 'sublocality') || colonia,
          municipio: get('locality', 'administrative_area_level_2') || ciudad,
          estado: get('administrative_area_level_1') || estado,
        } satisfies GeoResult)
      }
    } catch { /* fall through */ }

    // 2. Nominatim STRUCTURED
    try {
      const u = new URL('https://nominatim.openstreetmap.org/search')
      u.searchParams.set('street', [direccion, colonia].filter(Boolean).join(', '))
      u.searchParams.set('city', ciudad)
      u.searchParams.set('state', estado)
      u.searchParams.set('postalcode', cp)
      u.searchParams.set('country', 'México')
      u.searchParams.set('countrycodes', 'mx')
      u.searchParams.set('format', 'json')
      u.searchParams.set('addressdetails', '1')
      u.searchParams.set('limit', '5')
      const res = await fetch(u.toString(), { headers: H })
      if (res.ok) {
        const json: any[] = await res.json()
        const r = json[0]
        if (r) {
          const a = r.address ?? {}
          return NextResponse.json({
            found: true,
            lat: parseFloat(r.lat), lng: parseFloat(r.lon),
            colonia: pick(a, 'suburb', 'neighbourhood', 'quarter', 'city_district') || colonia,
            municipio: pick(a, 'city', 'town', 'municipality') || ciudad,
            estado: a.state || estado,
          } satisfies GeoResult)
        }
      }
    } catch { /* fall through */ }

    // 3. Nominatim FREE-TEXT
    try {
      const q = [direccion, colonia, ciudad, estado, 'México'].filter(Boolean).join(', ')
      const u = new URL('https://nominatim.openstreetmap.org/search')
      u.searchParams.set('q', q)
      u.searchParams.set('countrycodes', 'mx')
      u.searchParams.set('format', 'json')
      u.searchParams.set('addressdetails', '1')
      u.searchParams.set('limit', '5')
      const res = await fetch(u.toString(), { headers: H })
      if (res.ok) {
        const json: any[] = await res.json()
        const r = json.find(x => matchCtx(Object.values(x.address ?? {}).join(' '), ciudad, estado)) ?? json[0]
        if (r) {
          const a = r.address ?? {}
          return NextResponse.json({
            found: true,
            lat: parseFloat(r.lat), lng: parseFloat(r.lon),
            colonia: pick(a, 'suburb', 'neighbourhood', 'quarter') || colonia,
            municipio: pick(a, 'city', 'town', 'municipality') || ciudad,
            estado: a.state || estado,
          } satisfies GeoResult)
        }
      }
    } catch { /* fall through */ }

    // 4. Photon
    try {
      const q = [direccion, colonia, ciudad, estado, 'México'].filter(Boolean).join(', ')
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=es&limit=5`,
        { headers: H },
      )
      if (res.ok) {
        const json = await res.json()
        const feats: any[] = json.features ?? []
        const feat = feats.find(f => {
          const p = f.properties
          return matchCtx([p.city, p.state].join(' '), ciudad, estado)
        }) ?? feats[0]
        if (feat) {
          const [lng, lat] = feat.geometry.coordinates
          const p = feat.properties
          return NextResponse.json({
            found: true, lat, lng,
            colonia: p.suburb ?? p.neighbourhood ?? p.quarter ?? colonia,
            municipio: p.city ?? p.town ?? ciudad,
            estado: p.state ?? estado,
          } satisfies GeoResult)
        }
      }
    } catch { /* fall through */ }
  }

  // ── MODO CP (Flujo B, o fallback Flujo A) ────────────────────────────────

  // 5. Nominatim — solo CP, sin filtro de ciudad (el CP es autoritativo)
  try {
    const u = new URL('https://nominatim.openstreetmap.org/search')
    u.searchParams.set('postalcode', cp)
    u.searchParams.set('countrycodes', 'mx')
    u.searchParams.set('format', 'json')
    u.searchParams.set('addressdetails', '1')
    u.searchParams.set('limit', '5')
    const res = await fetch(u.toString(), { headers: H })
    if (res.ok) {
      const json: any[] = await res.json()
      const r = json[0]
      if (r) {
        const a = r.address ?? {}
        return NextResponse.json({
          found: true,
          lat: parseFloat(r.lat), lng: parseFloat(r.lon),
          colonia: pick(a, 'suburb', 'neighbourhood', 'quarter', 'city_district') || colonia,
          municipio: pick(a, 'city', 'town', 'municipality') || ciudad,
          estado: a.state || estado,
        } satisfies GeoResult)
      }
    }
  } catch { /* fall through */ }

  // 6. Photon — CP + ciudad sin dirección
  try {
    const q = [cp, ciudad, estado, 'México'].filter(Boolean).join(', ')
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=es&limit=5`,
      { headers: H },
    )
    if (res.ok) {
      const json = await res.json()
      const feats: any[] = json.features ?? []
      const feat = feats.find(f => matchCtx([f.properties.city, f.properties.state].join(' '), ciudad, estado)) ?? feats[0]
      if (feat) {
        const [lng, lat] = feat.geometry.coordinates
        const p = feat.properties
        return NextResponse.json({
          found: true, lat, lng,
          colonia: p.suburb ?? p.neighbourhood ?? colonia,
          municipio: p.city ?? p.town ?? ciudad,
          estado: p.state ?? estado,
        } satisfies GeoResult)
      }
    }
  } catch { /* fall through */ }

  // 7. Zippopotam — último recurso
  try {
    const res = await fetch(`https://api.zippopotam.us/mx/${cp}`, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const json = await res.json()
      const place = json.places?.[0]
      if (place) {
        return NextResponse.json({
          found: true,
          lat: parseFloat(place.latitude), lng: parseFloat(place.longitude),
          colonia: colonia || place['place name'] || '',
          municipio: ciudad || place['place name'] || '',
          estado: estado || place.state || '',
        } satisfies GeoResult)
      }
    }
  } catch { /* fall through */ }

  return NextResponse.json({ found: false })
}
