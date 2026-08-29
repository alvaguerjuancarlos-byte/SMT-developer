// GIS real para San Pedro Garza García — capas normativas (E2 uso, E3 densidad, E4 altura) del
// mismo GeoServer municipal público que ya usa lib/terreno/parcelResolver.ts (vu:predio,
// verificado 2026-08-29). I/O — mismo patrón que persistencia.ts, sin tests que dependan del
// servicio real.
//
// No hay capa de COS verificada todavía entre las que se exploraron — solo se resuelven uso
// (E2), CUS (E3) y altura (E4). No se inventa un COS a partir de esto.

import { puntoDentroDePoligono } from '@/lib/terreno/geometryEngine'

const GEOSERVER_BASE = 'https://geoserver.sanpedro.gob.mx/ows'

async function wfsGetFeaturesEnPunto(typeName: string, lat: number, lng: number, radioGrados = 0.0006): Promise<any[]> {
  const bbox = [lng - radioGrados, lat - radioGrados, lng + radioGrados, lat + radioGrados, 'EPSG:4326'].join(',')
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: typeName,
    outputFormat: 'application/json', srsName: 'EPSG:4326', bbox,
  })
  const res = await fetch(`${GEOSERVER_BASE}?${params.toString()}`)
  if (!res.ok) throw new Error(`GeoServer (${typeName}): HTTP ${res.status}`)
  const json = await res.json()
  return json.features ?? []
}

function anilloDe(feature: any): [number, number][] {
  const geom = feature?.geometry
  return geom?.type === 'MultiPolygon' ? (geom.coordinates?.[0]?.[0] ?? [])
    : geom?.type === 'Polygon' ? (geom.coordinates?.[0] ?? [])
    : []
}

// De todas las features que cayeron en el bbox, la que en verdad contiene el punto — point-in-
// polygon real, no "la primera que regresó el servidor".
function featureQueContienePunto(features: any[], lat: number, lng: number): any | null {
  return features.find((f) => {
    const anillo = anilloDe(f)
    return anillo.length >= 3 && puntoDentroDePoligono([lng, lat], anillo)
  }) ?? null
}

export interface ZonaUso {
  uso: string | null
  descripcion: string | null
  distrito: string | null
}

export async function buscarUsoZonificacion(lat: number, lng: number): Promise<ZonaUso | null> {
  const f = featureQueContienePunto(await wfsGetFeaturesEnPunto('vu:zonificacionsecundaria', lat, lng), lat, lng)
  if (!f) return null
  return {
    uso: f.properties?.uso ?? null,
    descripcion: f.properties?.descripc_1 ?? f.properties?.descripcion ?? null,
    distrito: f.properties?.nombredistrito ?? null,
  }
}

export interface ZonaDensidad {
  densidadCodigo: string | null
  cusNum: number | null
  programa: string | null
}

export async function buscarDensidad(lat: number, lng: number): Promise<ZonaDensidad | null> {
  const f = featureQueContienePunto(await wfsGetFeaturesEnPunto('vu:Densidades_CV_CZ', lat, lng), lat, lng)
  if (!f) return null

  // "Dens_Base": "HM5 - 1.8" -- SOLO Dens_Base, NUNCA Dens_Opta ("Optativo:..."): el municipio
  // eliminó las densidades optativas en abril 2025 (ver memoria del proyecto/§22 del documento
  // de Normativa) -- usar Dens_Opta aplicaría una regla histórica ya no vigente.
  const densBase: string | undefined = f.properties?.Dens_Base
  const match = densBase?.match(/^([A-Za-z0-9.]+)\s*-\s*([\d.]+)$/)
  return {
    densidadCodigo: match ? match[1] : (densBase ?? null),
    cusNum: match ? Number(match[2]) : null,
    programa: f.properties?.Programa ?? null,
  }
}

export interface ZonaAltura {
  nivelesMax: number | null
  alturaM: number | null
  programa: string | null
}

export async function buscarAltura(lat: number, lng: number): Promise<ZonaAltura | null> {
  const f = featureQueContienePunto(await wfsGetFeaturesEnPunto('vu:Altura', lat, lng), lat, lng)
  if (!f) return null

  const pisos: string | undefined = f.properties?.pisos   // ej. "6 Pisos"
  const altura: string | undefined = f.properties?.altura // ej. "24 metros"
  const nivelesMatch = pisos?.match(/(\d+)/)
  const alturaMatch = altura?.match(/([\d.]+)/)
  return {
    nivelesMax: nivelesMatch ? Number(nivelesMatch[1]) : null,
    alturaM: alturaMatch ? Number(alturaMatch[1]) : null,
    programa: f.properties?.programa ?? null,
  }
}

export interface NormativaGISReal {
  uso: ZonaUso | null
  densidad: ZonaDensidad | null
  altura: ZonaAltura | null
}

// Une las 3 consultas — una sola llamada para quien la use (app/api/agentes/legal/route.ts). Una
// capa que falla no debe tumbar a las otras dos.
export async function consultarNormativaReal(lat: number, lng: number): Promise<NormativaGISReal> {
  const [uso, densidad, altura] = await Promise.all([
    buscarUsoZonificacion(lat, lng).catch(() => null),
    buscarDensidad(lat, lng).catch(() => null),
    buscarAltura(lat, lng).catch(() => null),
  ])
  return { uso, densidad, altura }
}
