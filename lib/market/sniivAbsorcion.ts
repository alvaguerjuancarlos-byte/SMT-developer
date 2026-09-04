// Absorción real — SNIIV (Sistema Nacional de Información e Indicadores de Vivienda, SEDATU),
// indicador "Días de inventario" por municipio y trimestre: días entre pago y certificado de
// habitabilidad (`venta`) es la señal real de velocidad de venta que hoy NO existe en ningún
// otro lado de la app — el campo "absorcion" del Agente Mercado (LLM) es pura estimación del
// modelo, sin ninguna fuente citada ni verificable.
//
// La API no está documentada públicamente — se obtuvo por ingeniería inversa del propio sitio
// (sniiv.sedatu.gob.mx/js/cubo_v2.js, sniiv.sedatu.gob.mx/Oferta/Dias_inventario), verificada
// en vivo 2026-09-04 contra el servicio real (no fixtures): catálogos de estado/municipio y el
// endpoint de días de inventario responden JSON real con datos consistentes.
//
// LIMITACIÓN DE COBERTURA REAL, verificada empíricamente (no solo documentada): esta fuente es
// vivienda con financiamiento formal (INFONAVIT/FOVISSSTE/RUV) — en los últimos 4 trimestres
// consultados para Nuevo León, los municipios con datos fueron Apodaca, García, Escobedo,
// Juárez, Guadalupe, Cadereyta, Ciénega de Flores, El Carmen, Montemorelos, Pesquería, Sabinas
// Hidalgo, Salinas Victoria — vivienda económica/media. San Pedro Garza García, Monterrey y San
// Nicolás NO aparecieron en ningún trimestre — cero registros, no error de la consulta. Es de
// esperarse: desarrollos premium sin financiamiento hipotecario tradicional no pasan por este
// sistema. resolverAbsorcionSNIIV() lo declara explícito en `motivo`, nunca lo esconde.

const SNIIV_API_BASE = 'https://sniiv.sedatu.gob.mx/api'

// Solo Nuevo León hoy — mismo alcance que el resto de la app (GeoServer de Terreno también solo
// cubre San Pedro). Ampliar agregando más entradas si se necesita otro estado.
const ESTADOS_INEGI: Record<string, string> = {
  'nuevo leon': '19',
}

// Claves INEGI reales de municipio, obtenidas de CatalogoAPI/GetMunicipio/19/1 (verificado en
// vivo) — OJO: no coinciden con las claves arbitrarias que usa app/api/catastro/route.ts (ese
// sistema, egobierno.nl.gob.mx, tiene su propia numeración interna sin relación con INEGI).
const MUNICIPIOS_NL_INEGI: Record<string, string> = {
  'apodaca': '006', 'cadereyta jimenez': '009', 'cadereyta': '009', 'el carmen': '010',
  'cienega de flores': '012', 'garcia': '018', 'general escobedo': '021', 'escobedo': '021',
  'general zuazua': '025', 'guadalupe': '026', 'juarez': '031', 'montemorelos': '038',
  'monterrey': '039', 'pesqueria': '041', 'sabinas hidalgo': '044', 'salinas victoria': '045',
  'san nicolas de los garza': '046', 'san nicolas': '046', 'san pedro garza garcia': '019',
  'san pedro': '019', 'santa catarina': '048',
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function resolverClaveEstado(estado: string): string | null {
  return ESTADOS_INEGI[normalizar(estado)] ?? null
}

function resolverClaveMunicipio(ciudad: string): string | null {
  const key = normalizar(ciudad)
  return MUNICIPIOS_NL_INEGI[key]
    ?? MUNICIPIOS_NL_INEGI[Object.keys(MUNICIPIOS_NL_INEGI).find(k => k.includes(key) || key.includes(k)) ?? '']
    ?? null
}

export interface DiasInventarioMunicipio {
  claveMunicipio: string
  municipio: string
  diasRegistro: number
  diasConstruccion: number
  diasVenta: number
  diasTotal: number
  numeroVivienda: number
}

// I/O puro — sin caché, sin reintentos (mismo criterio que buscarPrediosCercanos() en
// lib/terreno/parcelResolver.ts). trimestre=5 es el sentinel de "Último Trimestre" que usa el
// propio sitio (confirmado vía CatalogoAPI/GetTrimestreInventario).
export async function obtenerDiasInventarioMunicipal(
  anio: number,
  claveEstado: string,
  trimestre: 1 | 2 | 3 | 5 = 5,
): Promise<DiasInventarioMunicipio[]> {
  const url = `${SNIIV_API_BASE}/OfertaAPI/GetInventarioMunicipal/${anio}/${trimestre}/${claveEstado}/1`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`SNIIV OfertaAPI: HTTP ${res.status}`)
  const json: any[] = await res.json()
  return json.map(r => ({
    claveMunicipio: r.clave_municipio,
    municipio: r.municipio,
    diasRegistro: r.registro,
    diasConstruccion: r.construccion,
    diasVenta: r.venta,
    diasTotal: r.total,
    numeroVivienda: r.numero_vivienda,
  }))
}

export interface ResultadoAbsorcionSNIIV {
  disponible: boolean
  fuente: 'SNIIV (SEDATU) — Días de inventario, vivienda con financiamiento formal'
  municipio: string | null
  anio: number | null
  trimestre: number | null
  diasVenta: number | null
  diasTotal: number | null
  numeroVivienda: number | null
  motivo: string | null
}

// Resuelve absorción real para ciudad/estado en el formato que ya usa el resto de la app
// (form.ciudad/form.estado) — intenta el año actual y hasta 2 años atrás por si el servicio no
// tiene todavía el periodo más reciente cargado. Nunca fabrica un número: si el municipio no
// está cubierto por este sistema (ver limitación de cobertura arriba), regresa
// disponible=false con el motivo explícito, no null silencioso ni una estimación de respaldo.
export async function resolverAbsorcionSNIIV(ciudad: string, estado: string): Promise<ResultadoAbsorcionSNIIV> {
  const base: Omit<ResultadoAbsorcionSNIIV, 'motivo' | 'disponible'> = {
    fuente: 'SNIIV (SEDATU) — Días de inventario, vivienda con financiamiento formal',
    municipio: null, anio: null, trimestre: null, diasVenta: null, diasTotal: null, numeroVivienda: null,
  }

  const claveEstado = resolverClaveEstado(estado)
  if (!claveEstado) {
    return { ...base, disponible: false, motivo: `Estado "${estado}" no soportado todavía por este motor (solo Nuevo León hoy).` }
  }
  const claveMunicipio = resolverClaveMunicipio(ciudad)
  if (!claveMunicipio) {
    return { ...base, disponible: false, motivo: `Municipio "${ciudad}" no reconocido en el catálogo de Nuevo León.` }
  }

  const anioActual = new Date().getFullYear()
  let algunaConsultaExitosa = false
  for (const anio of [anioActual, anioActual - 1, anioActual - 2]) {
    let filas: DiasInventarioMunicipio[]
    try {
      filas = await obtenerDiasInventarioMunicipal(anio, claveEstado)
      algunaConsultaExitosa = true
    } catch {
      continue // este año puntual falló (timeout/HTTP) — probar el año anterior antes de rendirse
    }
    const fila = filas.find(f => f.claveMunicipio === claveMunicipio)
    if (fila) {
      return {
        ...base, disponible: true, motivo: null,
        municipio: fila.municipio, anio, trimestre: 5,
        diasVenta: fila.diasVenta, diasTotal: fila.diasTotal, numeroVivienda: fila.numeroVivienda,
      }
    }
  }

  // Distingue "consultamos y el municipio de verdad no tiene datos" (cobertura real, ver nota
  // arriba) de "no pudimos consultar nada" (servicio caído) — son causas distintas y confundirlas
  // le haría creer al usuario que es un problema de cobertura de la zona cuando en realidad es
  // que SNIIV no respondió ninguna de las 3 veces.
  return algunaConsultaExitosa
    ? { ...base, disponible: false, motivo: `Sin vivienda registrada en RUV/INFONAVIT para este municipio en los últimos periodos — típico en zonas premium sin financiamiento hipotecario tradicional (ver nota de cobertura del motor).` }
    : { ...base, disponible: false, motivo: 'No se pudo consultar el servicio de SNIIV/SEDATU (sin respuesta en los últimos 3 años intentados).' }
}
