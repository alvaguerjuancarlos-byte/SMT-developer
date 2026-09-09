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

import { wgs84AUtmZona14N, utmZona14NAWgs84 } from './utmZona14N'

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

// vu:banqueta (líneas de guarnición/banqueta) -- a diferencia de vu:predio, esta capa viene en
// EPSG:6369 (UTM zona 14N, ver utmZona14N.ts), no en lng/lat, y el GeoServer NO la reproyecta al
// pedir srsName=EPSG:4326 (verificado 2026-09-09: devuelve 0 features con un bbox en grados,
// aunque sí hay banquetas reales ahí -- la capa simplemente ignora el srsName pedido). Por eso el
// bbox de esta consulta va en metros UTM, no en grados.
//
// Se eligió banqueta sobre vu:vialidadexistente/vu:redosm (las otras capas de líneas con
// geometría real) porque son mucho más dispersas: vu:vialidadexistente no tuvo NINGÚN segmento a
// menos de 300-600 m de un predio real de prueba, y vu:redosm (red vial de OSM) solo cubre vías
// primarias/secundarias con nombre, no calles residenciales -- ninguna de las dos sirve para "la
// calle frente a ESTE predio". Banqueta, en cambio, tuvo 23 líneas dentro de 60 m del mismo
// predio de prueba, corriendo justo junto al lindero -- es lo más cercano a "dibujar la calle
// real" que el catastro de San Pedro expone hoy.
export async function buscarBanquetasCercanas(
  lat: number,
  lng: number,
  margenMetros = 60,
): Promise<[number, number][][]> {
  const { easting, northing } = wgs84AUtmZona14N(lat, lng)
  const bbox = [easting - margenMetros, northing - margenMetros, easting + margenMetros, northing + margenMetros].join(',')
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'vu:banqueta',
    outputFormat: 'application/json', bbox,
  })
  const res = await fetch(`${GEOSERVER_BASE}?${params.toString()}`)
  if (!res.ok) throw new Error(`GeoServer (vu:banqueta): HTTP ${res.status}`)

  const json = await res.json()
  const features: any[] = json.features ?? []

  return features.map((f) => {
    const geom = f.geometry
    // MultiLineString (lo normal en esta capa) o LineString -- ambas a una sola lista de líneas.
    const lineas: [number, number][][] =
      geom?.type === 'MultiLineString' ? geom.coordinates ?? []
      : geom?.type === 'LineString' ? [geom.coordinates ?? []]
      : []
    return lineas
  }).flat().map((linea) =>
    linea.map(([easting, northing]: [number, number]) => {
      const { lat, lon } = utmZona14NAWgs84(easting, northing)
      return [lon, lat] as [number, number]
    })
  )
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

// Vértices en metros locales (x = este, y = norte; mismo signo que lat/lng crecientes, así que
// "arriba" en el plano ES norte sin tener que invertir nada) — misma proyección equirectangular
// que el resto del archivo, origen en el primer vértice del anillo. Para dibujar el croquis del
// predio (PlanoTerreno) a partir de coordenadas reales, sin volver a pedirle al usuario que
// capture rumbo+distancia cuando el predio ya viene resuelto contra el catastro.
export interface VerticeLocal { x: number; y: number }

// Un solo punto lng/lat a metros locales, dado un origen (lng0,lat0) y una latRef para la
// corrección de la longitud por coseno de latitud -- misma fórmula que usa
// verticesLocalesDesdeAnillo abajo, factorizada para reusarse también al proyectar la vialidad
// (vu:banqueta) al MISMO marco local del predio, para que ambos dibujos alineen en el croquis.
export function aLocalXY(lng: number, lat: number, lng0: number, lat0: number, latRef: number): VerticeLocal {
  const metrosPorGradoLng = METROS_POR_GRADO_LAT * Math.cos((latRef * Math.PI) / 180)
  return {
    x: (lng - lng0) * metrosPorGradoLng,
    y: (lat - lat0) * METROS_POR_GRADO_LAT,
  }
}

export function verticesLocalesDesdeAnillo(anillo: [number, number][], latRef: number): VerticeLocal[] | null {
  if (anillo.length < 3) return null
  const cerrado = distanciaM(anillo[0], anillo[anillo.length - 1], latRef) < 0.01
  const puntos = cerrado ? anillo.slice(0, -1) : anillo
  if (puntos.length < 3) return null
  const [lng0, lat0] = puntos[0]
  return puntos.map(([lng, lat]) => aLocalXY(lng, lat, lng0, lat0, latRef))
}

// Elimina vértices casi-colineales (ángulo interno a menos de toleranciaGrados de 180°) --
// artefactos reales de la digitalización del catastro, no esquinas del predio. Verificado contra
// predios reales de San Pedro (2026-09-07): un predio normal de 4 esquinas trae un 7° vértice a
// 179.8° (una línea recta partida en dos, no una 5ª esquina); otro predio con frente a calle
// curva trae 244 vértices, la mayoría a ~179° con lados de 0.20 m (la curva digitalizada como
// micro-segmentos, no 244 esquinas reales). Las esquinas reales en esos mismos predios están muy
// lejos de 180° (81°-95°), así que una tolerancia chica separa limpio "esquina real" de "ruido de
// digitalización" sin arriesgar borrar una esquina legítima (ej. un jog/notch real del lindero,
// que SÍ tiene un ángulo marcado, se conserva). Se aplica SOLO al croquis/lista de lados
// (PlanoTerreno) -- areaM2DesdeAnillo/perimetroMDesdeAnillo siguen usando el anillo completo sin
// tocar, son la medida real declarada, no un dibujo.
export function simplificarVerticesColineales(vertices: VerticeLocal[], toleranciaGrados = 3): VerticeLocal[] {
  if (vertices.length <= 3) return vertices
  const n = vertices.length
  const anguloInternoGrados = (i: number): number => {
    const prev = vertices[(i - 1 + n) % n]
    const cur = vertices[i]
    const next = vertices[(i + 1) % n]
    const v1 = { x: prev.x - cur.x, y: prev.y - cur.y }
    const v2 = { x: next.x - cur.x, y: next.y - cur.y }
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
    if (mag === 0) return 180 // vértice duplicado exacto (longitud cero) -- también se descarta
    const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / mag))
    return (Math.acos(cos) * 180) / Math.PI
  }
  const simplificados = vertices.filter((_, i) => Math.abs(anguloInternoGrados(i) - 180) > toleranciaGrados)
  // Salvaguarda: si por algún motivo el filtro dejara menos de 3 vértices (no debería, un
  // polígono real siempre tiene al menos 3 esquinas con ángulo lejano a 180°), regresar el
  // original sin tocar en vez de un polígono degenerado.
  return simplificados.length >= 3 ? simplificados : vertices
}

// Longitud de cada lado a partir de vértices YA en metros locales (x=este, y=norte) -- para usar
// después de simplificarVerticesColineales, donde ya no tiene sentido volver a las coordenadas
// lat/lng originales (los vértices colineales ya no existen en este arreglo).
export function longitudesLadosDesdeVertices(vertices: VerticeLocal[]): number[] {
  return vertices.map((v, i) => {
    const siguiente = vertices[(i + 1) % vertices.length]
    return Math.hypot(siguiente.x - v.x, siguiente.y - v.y)
  })
}

// Recorta las líneas de banqueta (ya en el marco local del predio, ver buscarBanquetasCercanas +
// aLocalXY) a solo los tramos cerca del predio -- el bbox de la consulta trae un margen fijo en
// metros, pero varias líneas reales de banqueta se extienden mucho más allá de esa vecindad (se
// vio una de +200 m en pruebas reales). Dibujar la línea COMPLETA distorsionaría la escala del
// croquis (el predio se vería minúsculo junto a una banqueta que sigue kilómetros de calle). En
// vez de eso, cada línea se corta en tramos contiguos cuyos puntos caen dentro de radioM del
// centro del predio -- conserva la forma real de la banqueta cerca del predio sin arrastrar el
// resto de la calle. Un tramo de un solo punto no es dibujable (no forma una línea), se descarta.
export function recortarSegmentosCercanos(
  lineas: VerticeLocal[][],
  centro: VerticeLocal,
  radioM: number,
): VerticeLocal[][] {
  const resultado: VerticeLocal[][] = []
  for (const linea of lineas) {
    let tramo: VerticeLocal[] = []
    for (const p of linea) {
      if (Math.hypot(p.x - centro.x, p.y - centro.y) <= radioM) {
        tramo.push(p)
      } else {
        if (tramo.length >= 2) resultado.push(tramo)
        tramo = []
      }
    }
    if (tramo.length >= 2) resultado.push(tramo)
  }
  return resultado
}
