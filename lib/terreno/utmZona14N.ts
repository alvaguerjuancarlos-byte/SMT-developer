// Proyección Transverse Mercator estándar (Snyder 1987) para UTM zona 14N — mismo huso que usa
// el GeoServer municipal de San Pedro para las capas de líneas (vu:banqueta, vu:vialidadexistente,
// vu:redosm: DefaultCRS EPSG:6369 "México ITRF2008 / UTM zona 14N"), a diferencia de vu:predio que
// ya viene en EPSG:4326 (lng/lat) directo. La diferencia entre datum ITRF2008 y WGS84 es de
// centímetros, muy por debajo de la precisión que necesita este croquis semitécnico -- se trata
// como WGS84 estándar.
//
// Verificado (2026-09-09): en el meridiano central (-99°) el easting da exactamente 500000 para
// cualquier latitud, y en el ecuador el northing da exactamente 0 para cualquier longitud (ambos
// casos anulan los términos de corrección de la serie por construcción) -- ver tests. Round-trip
// forward->inverse sobre coordenadas reales de San Pedro recupera el punto original con error
// menor a 1e-9 grados.
const A = 6378137.0 // semieje mayor WGS84
const F = 1 / 298.257223563
const E2 = F * (2 - F)
const EP2 = E2 / (1 - E2)
const K0 = 0.9996
const LON0_DEG = -99

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

export interface PuntoUTM { easting: number; northing: number }

export function wgs84AUtmZona14N(latDeg: number, lonDeg: number): PuntoUTM {
  const lat = toRad(latDeg), lon = toRad(lonDeg), lon0 = toRad(LON0_DEG)
  const N = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2)
  const T = Math.tan(lat) ** 2
  const C = EP2 * Math.cos(lat) ** 2
  const Acoef = (lon - lon0) * Math.cos(lat)
  const M = A * (
    (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * lat
    - ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * lat)
    + ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * lat)
    - ((35 * E2 ** 3) / 3072) * Math.sin(6 * lat)
  )
  const easting = K0 * N * (
    Acoef + ((1 - T + C) * Acoef ** 3) / 6
    + ((5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * Acoef ** 5) / 120
  ) + 500000
  const northing = K0 * (
    M + N * Math.tan(lat) * (
      Acoef ** 2 / 2
      + ((5 - T + 9 * C + 4 * C ** 2) * Acoef ** 4) / 24
      + ((61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * Acoef ** 6) / 720
    )
  )
  return { easting, northing }
}

export interface PuntoWGS84 { lat: number; lon: number }

export function utmZona14NAWgs84(easting: number, northing: number): PuntoWGS84 {
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const M = northing / K0
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256))
  const phi1 = mu
    + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2)
  const T1 = Math.tan(phi1) ** 2
  const C1 = EP2 * Math.cos(phi1) ** 2
  const R1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5
  const D = (easting - 500000) / (N1 * K0)
  const lat = phi1 - ((N1 * Math.tan(phi1)) / R1) * (
    D ** 2 / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6) / 720
  )
  const lon = toRad(LON0_DEG) + (
    D - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5) / 120
  ) / Math.cos(phi1)
  return { lat: toDeg(lat), lon: toDeg(lon) }
}
