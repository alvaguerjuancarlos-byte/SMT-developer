// Fase 1 (documento PREFORMA_PROMPT_MAESTRO_AGENTE_TERRENO.md) — Geometry Engine (§ ParcelResolver/
// GeometryEngine). Motor puro, sin red ni LLM. Traduce un "cuadro de construcción" (rumbo + distancia
// por lado, la forma estándar en que un levantamiento catastral mexicano describe un polígono) en
// vértices, área, perímetro y validación de cierre.
//
// Convención interna: un polígono de N lados se representa como N+1 vértices, donde vertices[0] es
// el origen (vértice de partida) y vertices[N] es el punto al que se llega tras recorrer los N lados
// — que en un levantamiento perfecto coincide con vertices[0] (cierre exacto). El error de cierre es
// la distancia real entre ambos. Por eso todas las funciones que recorren lados usan pares
// consecutivos SIN dar la vuelta al arreglo (evita contar dos veces el lado de cierre).

export type Cuadrante = 'NE' | 'NO' | 'SE' | 'SO'

// Rumbo tradicional de agrimensura: ángulo (0-90°) medido desde el Norte o Sur hacia el Este u Oeste,
// según el cuadrante. Ej. "NE 45°30'" = rumboAAzimut → 45.5° de azimut.
export interface RumboCuadrante {
  cuadrante: Cuadrante
  grados: number // 0-90
}

export interface Lado {
  rumbo: RumboCuadrante
  distancia: number // metros
}

export interface Vertice {
  x: number
  y: number
}

export interface ResultadoCierre {
  errorCierreM: number
  cerrado: boolean
}

export interface ResultadoValidacionPoligono {
  vertices: Vertice[]
  areaM2: number
  perimetroM: number
  longitudesLadosM: number[]
  azimutsLadosGrados: number[]
  cierre: ResultadoCierre
}

// Tolerancia típica de cierre en levantamientos catastrales urbanos (norma técnica de agrimensura
// en México ronda unos cuantos centímetros por cada 100 m de perímetro; se usa un valor fijo simple
// como umbral por ahora — ajustable si en el futuro se calibra contra normativa específica).
const TOLERANCIA_CIERRE_M = 0.05

export function rumboAAzimut(r: RumboCuadrante): number {
  switch (r.cuadrante) {
    case 'NE': return r.grados
    case 'SE': return 180 - r.grados
    case 'SO': return 180 + r.grados
    case 'NO': return 360 - r.grados
  }
}

export function construirVertices(lados: Lado[], origen: Vertice = { x: 0, y: 0 }): Vertice[] {
  const vertices: Vertice[] = [origen]
  let actual = origen
  for (const lado of lados) {
    const az = rumboAAzimut(lado.rumbo) * Math.PI / 180
    const dx = lado.distancia * Math.sin(az)
    const dy = lado.distancia * Math.cos(az)
    actual = { x: actual.x + dx, y: actual.y + dy }
    vertices.push(actual)
  }
  return vertices
}

export function calcularErrorCierre(vertices: Vertice[]): ResultadoCierre {
  const origen = vertices[0]
  const final = vertices[vertices.length - 1]
  const errorCierreM = Math.hypot(final.x - origen.x, final.y - origen.y)
  return { errorCierreM, cerrado: errorCierreM <= TOLERANCIA_CIERRE_M }
}

// Ajuste de cierre por regla de la brújula (Bowditch): distribuye el error de cierre entre los
// vértices proporcionalmente a la distancia acumulada, método estándar en agrimensura para
// compensar el error de medición y obtener un polígono exactamente cerrado.
export function cerrarPoligono(lados: Lado[], origen: Vertice = { x: 0, y: 0 }): Vertice[] {
  const vertices = construirVertices(lados, origen)
  const { errorCierreM } = calcularErrorCierre(vertices)
  if (errorCierreM === 0) return vertices

  const perimetro = lados.reduce((s, l) => s + l.distancia, 0)
  const final = vertices[vertices.length - 1]
  const errX = final.x - origen.x
  const errY = final.y - origen.y

  const ajustados: Vertice[] = [origen]
  let acumulado = 0
  for (let i = 0; i < lados.length; i++) {
    acumulado += lados[i].distancia
    const factor = acumulado / perimetro
    const bruto = vertices[i + 1]
    ajustados.push({ x: bruto.x - errX * factor, y: bruto.y - errY * factor })
  }
  return ajustados
}

// Fórmula del shoelace (Gauss). Ver convención de representación arriba: recorre pares
// consecutivos SIN volver al primer vértice (el "lado de cierre" ya está implícito en que
// vertices[N] ≈ vertices[0]).
export function calcularAreaM2(vertices: Vertice[]): number {
  let suma = 0
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i]
    const b = vertices[i + 1]
    suma += a.x * b.y - b.x * a.y
  }
  return Math.abs(suma) / 2
}

export function calcularLongitudesLados(vertices: Vertice[]): number[] {
  const longitudes: number[] = []
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i]
    const b = vertices[i + 1]
    longitudes.push(Math.hypot(b.x - a.x, b.y - a.y))
  }
  return longitudes
}

// Azimut real entre dos vértices consecutivos — permite comparar el rumbo declarado en el
// cuadro de construcción contra el que realmente implica la geometría (validación cruzada).
export function azimutEntreVertices(a: Vertice, b: Vertice): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let az = Math.atan2(dx, dy) * 180 / Math.PI
  if (az < 0) az += 360
  return az
}

export function calcularAzimutsLados(vertices: Vertice[]): number[] {
  const azimuts: number[] = []
  for (let i = 0; i < vertices.length - 1; i++) {
    azimuts.push(azimutEntreVertices(vertices[i], vertices[i + 1]))
  }
  return azimuts
}

export function validarPoligono(lados: Lado[], origen: Vertice = { x: 0, y: 0 }): ResultadoValidacionPoligono {
  const vertices = construirVertices(lados, origen)
  const longitudesLadosM = calcularLongitudesLados(vertices)
  return {
    vertices,
    areaM2: calcularAreaM2(vertices),
    perimetroM: longitudesLadosM.reduce((s, l) => s + l, 0),
    longitudesLadosM,
    azimutsLadosGrados: calcularAzimutsLados(vertices),
    cierre: calcularErrorCierre(vertices),
  }
}

// Bandas de pendiente ya usadas como enum fijo (elegido a ojo por el usuario) en
// app/api/agentes/terreno/route.ts — aquí quedan disponibles como cálculo real a partir de un
// porcentaje, para cuando exista una fuente real de elevación (DEM) que lo alimente.
export type ClasificacionPendiente = 'PLANO' | 'SUAVE' | 'MODERADA' | 'PRONUNCIADA'

export function clasificarPendiente(porcentaje: number): ClasificacionPendiente {
  if (porcentaje < 5) return 'PLANO'
  if (porcentaje < 10) return 'SUAVE'
  if (porcentaje < 20) return 'MODERADA'
  return 'PRONUNCIADA'
}
