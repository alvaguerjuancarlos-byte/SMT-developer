// ParcelResolver real para San Pedro Garza García (documento §7-8). I/O — consulta el GeoServer
// municipal público, sin autenticación, verificado por prueba directa 2026-08-29. Mismo patrón
// que lib/market/persistencia.ts: toca la red, no se le escriben tests que dependan del
// servicio real (los tests de la lógica pura viven en parcelMatchScore.test.ts).
//
// Nota de descubrimiento: el endpoint que da el documento (.../geoserver/wfs) NO responde — el
// servidor real está montado en la raíz del subdominio (.../ows), sin repetir "geoserver" en la
// ruta. El bbox debe ir en orden [lng,lat,lng,lat] (no [lat,lng,lat,lng] como sugeriría OGC para
// EPSG:4326 "estricto") — así es como este GeoServer en particular lo espera, confirmado
// probando ambos órdenes contra un punto conocido.

const GEOSERVER_BASE = 'https://geoserver.sanpedro.gob.mx/ows'

export interface PredioWFS {
  claveLote: string | null
  region: string | null
  manzana: string | null
  lote: string | null
  ubicacion: string | null
  colonia: string | null
  // Anillo exterior en [lng, lat] (EPSG:4326) — ya reproyectado por el propio GeoServer
  // (srsName=EPSG:4326 en la consulta), no hace falta reproyectar en el cliente.
  anillo: [number, number][]
}

// ~0.0004° ≈ 44 m en esta latitud — suficiente para capturar el predio que contiene el punto
// más un puñado de vecinos (para que resolverSeleccionParcela tenga con qué detectar
// ambigüedad), sin traer cientos de predios de una consulta demasiado amplia.
const RADIO_GRADOS_DEFAULT = 0.0004

export async function buscarPrediosCercanos(
  lat: number,
  lng: number,
  radioGrados = RADIO_GRADOS_DEFAULT,
): Promise<PredioWFS[]> {
  const bbox = [lng - radioGrados, lat - radioGrados, lng + radioGrados, lat + radioGrados, 'EPSG:4326'].join(',')
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'vu:predio',
    outputFormat: 'application/json', srsName: 'EPSG:4326', bbox,
  })
  const res = await fetch(`${GEOSERVER_BASE}?${params.toString()}`)
  if (!res.ok) throw new Error(`GeoServer (vu:predio): HTTP ${res.status}`)

  const json = await res.json()
  const features: any[] = json.features ?? []

  const predios: PredioWFS[] = features.map((f) => {
    const geom = f.geometry
    const anillo: [number, number][] =
      geom?.type === 'MultiPolygon' ? (geom.coordinates?.[0]?.[0] ?? [])
      : geom?.type === 'Polygon' ? (geom.coordinates?.[0] ?? [])
      : []

    return {
      claveLote: f.properties?.clave_lote ?? null,
      region: f.properties?.region ?? null,
      manzana: f.properties?.manzana ?? null,
      lote: f.properties?.lote ?? null,
      ubicacion: f.properties?.ubicacion ?? null,
      colonia: f.properties?.colonia ?? null,
      anillo,
    }
  })

  return deduplicarPorClaveLote(predios)
}

// Hallazgo real al probar contra el servicio (2026-08-29): un mismo clave_lote puede aparecer
// repetido con distinto texto de `ubicacion` (ej. "Pedro Moya", "José Calazan", "Pedro Moya 103"
// para el MISMO predio físico) — parecen entradas históricas de trámites, no predios distintos.
// Sin este dedup, resolverSeleccionParcela vería 2-3 "candidatos" casi idénticos para el mismo
// lote y siempre dispararía REQUIRES_CONFIRMATION por ambigüedad falsa. Se conserva la entrada
// con el texto de ubicación más específico (más largo) como proxy simple de "más completa" —
// mismo criterio que completitud() en lib/market/dedupEngine.ts.
function deduplicarPorClaveLote(predios: PredioWFS[]): PredioWFS[] {
  const porClave = new Map<string, PredioWFS>()
  const sinClave: PredioWFS[] = []

  for (const p of predios) {
    if (!p.claveLote) { sinClave.push(p); continue }
    const existente = porClave.get(p.claveLote)
    if (!existente || (p.ubicacion?.length ?? 0) > (existente.ubicacion?.length ?? 0)) {
      porClave.set(p.claveLote, p)
    }
  }

  return [...porClave.values(), ...sinClave]
}

// Área en m² del anillo exterior — aproximación equirectangular (metros/grado escalados por
// coseno de la latitud), válida para superficies de predio urbano donde la curvatura terrestre
// es despreciable. latRef: cualquier latitud del propio anillo sirve como referencia local.
const METROS_POR_GRADO_LAT = 111_320

export function areaM2DesdeAnillo(anillo: [number, number][], latRef: number): number | null {
  if (anillo.length < 3) return null
  const metrosPorGradoLng = METROS_POR_GRADO_LAT * Math.cos((latRef * Math.PI) / 180)

  let suma = 0
  for (let i = 0; i < anillo.length; i++) {
    const [lngA, latA] = anillo[i]
    const [lngB, latB] = anillo[(i + 1) % anillo.length]
    const xA = lngA * metrosPorGradoLng, yA = latA * METROS_POR_GRADO_LAT
    const xB = lngB * metrosPorGradoLng, yB = latB * METROS_POR_GRADO_LAT
    suma += xA * yB - xB * yA
  }
  return Math.abs(suma) / 2
}

function distanciaM(a: [number, number], b: [number, number], latRef: number): number {
  const metrosPorGradoLng = METROS_POR_GRADO_LAT * Math.cos((latRef * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * metrosPorGradoLng, (b[1] - a[1]) * METROS_POR_GRADO_LAT)
}

// Longitud de cada lado del anillo, en metros y en el mismo orden en que el GeoServer entrega
// los vértices — el desglose "lado por lado" (equivalente al "cuadro de construcción" que antes
// solo existía si el usuario lo tecleaba a mano). Si el anillo viene explícitamente cerrado
// (primer punto repetido al final, convención GeoJSON), se descarta ese vértice duplicado para
// no mostrar un "lado" fantasma de ~0 m.
export function longitudesLadosMDesdeAnillo(anillo: [number, number][], latRef: number): number[] | null {
  if (anillo.length < 3) return null
  const cerrado = distanciaM(anillo[0], anillo[anillo.length - 1], latRef) < 0.01 // < 1 cm ⇒ mismo punto
  const puntos = cerrado ? anillo.slice(0, -1) : anillo
  if (puntos.length < 3) return null
  return puntos.map((p, i) => distanciaM(p, puntos[(i + 1) % puntos.length], latRef))
}

// Perímetro en m del anillo exterior — misma proyección local que areaM2DesdeAnillo (necesaria
// para que las unidades de ambos ejes sean consistentes entre sí antes de medir distancias).
// Reemplaza al "cuadro de construcción" tecleado a mano cuando el predio ya viene resuelto
// contra el catastro real: el anillo del GeoServer ES el levantamiento, no hace falta que el
// usuario lo vuelva a capturar lado por lado.
export function perimetroMDesdeAnillo(anillo: [number, number][], latRef: number): number | null {
  const lados = longitudesLadosMDesdeAnillo(anillo, latRef)
  return lados ? lados.reduce((a, b) => a + b, 0) : null
}
