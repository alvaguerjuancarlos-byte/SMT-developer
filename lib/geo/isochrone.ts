// Funciones puras para llamar a OpenRouteService Isochrones v2.
// Sin dependencia de Request/Response — directamente testeable.

export interface IsochroneResult {
  rango_min: number
  geojson: object
  poblacion_alcanzada: number | null
}

interface OrsFeatureProperties {
  value: number        // rango en segundos
  total_pop?: number
  [key: string]: unknown
}

interface OrsFeature {
  type: 'Feature'
  properties: OrsFeatureProperties
  geometry: object
}

interface OrsResponse {
  type: 'FeatureCollection'
  features: OrsFeature[]
}

export class OrsError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`ORS error ${status}: ${body.slice(0, 200)}`)
  }
}

export function orsEndpoint(perfil: 'driving' | 'walking'): string {
  return perfil === 'walking'
    ? 'https://api.openrouteservice.org/v2/isochrones/foot-walking'
    : 'https://api.openrouteservice.org/v2/isochrones/driving-car'
}

export function parseOrsResponse(response: OrsResponse): IsochroneResult[] {
  return response.features.map(feature => ({
    rango_min: Math.round(feature.properties.value / 60),
    geojson: feature.geometry,
    poblacion_alcanzada: feature.properties.total_pop ?? null,
  }))
}

export async function fetchIsochrones(
  lat: number,
  lng: number,
  perfil: 'driving' | 'walking',
  apiKey: string,
): Promise<IsochroneResult[]> {
  const res = await fetch(orsEndpoint(perfil), {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json, application/geo+json',
    },
    body: JSON.stringify({
      locations: [[lng, lat]],
      range: [900, 1800, 2700],   // 15 / 30 / 45 min en segundos
      range_type: 'time',
      attributes: ['total_pop'],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new OrsError(res.status, body)
  }

  const data = await res.json() as OrsResponse
  return parseOrsResponse(data)
}
