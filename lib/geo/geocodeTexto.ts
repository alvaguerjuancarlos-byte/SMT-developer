// Geocodificación por texto libre — extraída de app/api/geocode/route.ts (modo `?q=`, Bloque 5)
// para que app/api/agentes/comparables-venta/route.ts pueda geocodificar cada comparable sin
// tener que auto-invocarse por HTTP (evita propagar el header de auth entre rutas del propio
// server). Mismo comportamiento exacto que el modo `?q=` original: Photon primero, Nominatim
// como respaldo, país fijo México.

export interface GeoTexto {
  lat: number
  lng: number
  colonia: string
  municipio: string
  estado: string
}

const H = { 'User-Agent': 'SMTDeveloper/1.0', 'Accept-Language': 'es' }

export async function geocodificarTexto(q: string): Promise<GeoTexto | null> {
  // Photon
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
        return {
          lat, lng,
          colonia: p.suburb ?? p.neighbourhood ?? p.quarter ?? '',
          municipio: p.city ?? p.town ?? '',
          estado: p.state ?? '',
        }
      }
    }
  } catch { /* fall through */ }

  // Nominatim
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
        return {
          lat: parseFloat(r.lat), lng: parseFloat(r.lon),
          colonia: a.suburb ?? a.neighbourhood ?? a.quarter ?? '',
          municipio: a.city ?? a.town ?? a.municipality ?? '',
          estado: a.state ?? '',
        }
      }
    }
  } catch { /* fall through */ }

  return null
}

// Distancia en línea recta entre dos coordenadas (km) — usada para filtrar comparables fuera
// del radio de búsqueda (ver comparables-venta/route.ts).
export function distanciaHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}
