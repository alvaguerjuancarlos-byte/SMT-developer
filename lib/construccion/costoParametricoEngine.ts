// Motor puro de Costos de Construcción — primera versión determinística de lo que hasta hoy
// vivía SOLO como instrucciones de prompt en app/api/agentes/construccion/route.ts, portado del
// documento "PREFORMA — Motor Paramétrico de Costos de Construcción v1.0" (53 secciones,
// C:\Users\Administrator\Documents\smartdeveloper\motor de costos de construccion\). Mismo
// patrón que lib/market/ y lib/terreno/geometryEngine.ts: funciones puras, sin red ni LLM,
// testeadas — el LLM aporta juicio (qué banda, qué tan compleja es la geometría, qué colonia),
// este motor verifica que la aritmética sobre ese juicio sea exacta.
//
// Alcance deliberadamente acotado: el documento cubre además indirectos/honorarios/imprevistos
// (§23-26) y costo de desarrollo (§28) — eso hoy lo calcula el Agente Financiero, aguas abajo,
// sobre el costo directo que este motor produce (ver nota en el prompt de Construcción: "NO se
// calculan aquí"). Este motor cubre §9-22, §29-34, §49: factores de ajuste, partidas, costo por
// m², comparación contra benchmark, rango y alertas — el alcance real del Agente de Construcción.

// ─── §10 — Factor de altura ────────────────────────────────────────────────────
// Tabla fija por niveles — SIN juicio del LLM: niveles ya es un hecho fijado por el Agente de
// Arquitectura, no una estimación. Antes el LLM escribía el factor de memoria (podía fallar la
// tabla); ahora se calcula siempre igual.
export function factorAltura(niveles: number): number {
  if (niveles <= 1) return 0.95
  if (niveles <= 3) return 1.00
  if (niveles <= 6) return 1.07
  if (niveles <= 11) return 1.15
  if (niveles <= 20) return 1.25
  return 1.35
}

// ─── §12 — Factor de topografía ────────────────────────────────────────────────
// El form de Camino A captura pendiente como enum (plano/suave/moderada/pronunciada), no como
// % exacto — se mapea al bucket de la tabla del documento que mejor representa cada rango.
// "moderada" (10-20%) usa el extremo conservador del bucket 10-15% en vez de saltar a 15-25%;
// "pronunciada" (>20%) usa el bucket 25-35% en vez de escalar a 35-50%/60%+ sin más información
// — ninguno de los dos casos tiene el dato preciso para ir más arriba, y el documento es
// explícito: "si no existe información, no inventes la pendiente".
export type PendienteLabel = 'plano' | 'suave' | 'moderada' | 'pronunciada'
export function factorTopografia(pendiente: PendienteLabel | null | undefined): number {
  switch (pendiente) {
    case 'plano': return 1.00       // 0-5%
    case 'suave': return 1.02       // 5-10%
    case 'moderada': return 1.05    // 10-15% (extremo conservador de 10-20%)
    case 'pronunciada': return 1.18 // 25-35% (extremo conservador de >20%, sin % exacto)
    default: return 1.00            // sin dato — nunca se inventa, ver §12
  }
}

// ─── §13 — Factor de complejidad arquitectónica ────────────────────────────────
// El LLM elige la categoría (geometría irregular, voladizos, etc.) — el número es tabla fija.
export type NivelComplejidad = 'C0' | 'C1' | 'C2' | 'C3' | 'C4'
const FACTOR_COMPLEJIDAD: Record<NivelComplejidad, number> = {
  C0: 0.95, C1: 1.00, C2: 1.05, C3: 1.12, C4: 1.20,
}
export function factorComplejidad(nivel: NivelComplejidad): number {
  return FACTOR_COMPLEJIDAD[nivel]
}

// ─── §17 — Factor de sótano ─────────────────────────────────────────────────────
export type ClasificacionSotano = 'simple' | 'estandar' | 'complejo' | 'profundo'
const FACTOR_SOTANO: Record<ClasificacionSotano, number> = {
  simple: 1.20, estandar: 1.30, complejo: 1.45, profundo: 1.60,
}
export function factorSotano(clasificacion: ClasificacionSotano): number {
  return FACTOR_SOTANO[clasificacion]
}

// ─── §21/22 — Partidas: normalización y cálculo exacto ─────────────────────────
// "Nunca permitas que SUMA_PARTIDAS ≠ COSTO_DIRECTO" (§22, CHECK01/CHECK13 de §32). El LLM
// propone porcentajes que rara vez suman exactamente 100 — se normalizan aquí, y el costo de
// cada partida se deriva del costo directo YA CALCULADO (nunca al revés), garantizando que la
// suma cierre exacta por construcción, no por que el LLM haya hecho bien la cuenta.
export interface PartidaPct { concepto: string; porcentaje: number }
export interface PartidaCosto extends PartidaPct { costoPorM2: number; costoTotal: number }

export function normalizarPartidas(partidas: PartidaPct[]): PartidaPct[] {
  const suma = partidas.reduce((s, p) => s + Math.max(0, p.porcentaje), 0)
  if (suma <= 0) return partidas.map(p => ({ ...p, porcentaje: 0 }))
  return partidas.map(p => ({ ...p, porcentaje: (Math.max(0, p.porcentaje) / suma) * 100 }))
}

export function calcularPartidas(costoDirectoTotal: number, areaConstruida: number, partidasPct: PartidaPct[]): PartidaCosto[] {
  const normalizadas = normalizarPartidas(partidasPct)
  // Cada costoTotal se calcula del % normalizado; el redondeo se absorbe en la ÚLTIMA partida
  // para que la suma cierre exacta a costoDirectoTotal (nunca "casi" por acumulación de round()).
  const resultado: PartidaCosto[] = []
  let acumulado = 0
  normalizadas.forEach((p, i) => {
    const esUltima = i === normalizadas.length - 1
    const costoTotal = esUltima
      ? Math.round(costoDirectoTotal - acumulado)
      : Math.round(costoDirectoTotal * (p.porcentaje / 100))
    acumulado += costoTotal
    resultado.push({
      ...p,
      costoTotal,
      costoPorM2: areaConstruida > 0 ? Math.round(costoTotal / areaConstruida) : 0,
    })
  })
  return resultado
}

// ─── Reconciliación del total desde las zonas ya costeadas ─────────────────────
// Mismo cálculo que ya hacía app/api/agentes/construccion/route.ts en línea (ad-hoc, sin test) —
// extraído aquí como función pura para poder probarlo. costoTotal de cada zona SIEMPRE se deriva
// de m2 (fijado por Arquitectura) × costoM2 (lo único que decide el LLM de Construcción), nunca
// del "costoTotal" que el LLM haya podido escribir directamente.
export interface ZonaCosto { zona: string; m2: number; costoM2: number }
export function calcularCostoTotalDesdeZonas(zonas: ZonaCosto[], costoUrbanizacion: number): number {
  const sumaZonas = zonas.reduce((s, z) => s + Math.round(z.m2 * z.costoM2), 0)
  return sumaZonas + Math.max(0, costoUrbanizacion)
}

// ─── §29/30 — Costo por m² construido y vendible ────────────────────────────────
export interface CostosPorM2 {
  costoM2Construido: number
  costoM2Vendible: number | null
  eficienciaPct: number | null
}
export function calcularCostosPorM2(costoTotal: number, areaConstruida: number, areaVendible: number | null): CostosPorM2 {
  const costoM2Construido = areaConstruida > 0 ? Math.round(costoTotal / areaConstruida) : 0
  const costoM2Vendible = areaVendible != null && areaVendible > 0 ? Math.round(costoTotal / areaVendible) : null
  const eficienciaPct = areaVendible != null && areaConstruida > 0 ? Math.round((areaVendible / areaConstruida) * 1000) / 10 : null
  return { costoM2Construido, costoM2Vendible, eficienciaPct }
}

// ─── §31 — Calibración contra benchmark de mercado ──────────────────────────────
// "Nunca modificar automáticamente el resultado únicamente para acercarlo al benchmark" — esto
// solo clasifica la divergencia, nunca corrige el número.
export type SemaforoBenchmark = 'NORMAL' | 'REVISAR' | 'ALERTA' | 'INCONSISTENCIA'
export function compararConBenchmark(costoM2: number, benchmarkLow: number, benchmarkHigh: number): { semaforo: SemaforoBenchmark; diferenciaPct: number } {
  const centro = (benchmarkLow + benchmarkHigh) / 2
  const diferenciaPct = centro > 0 ? ((costoM2 - centro) / centro) * 100 : 0
  const abs = Math.abs(diferenciaPct)
  const semaforo: SemaforoBenchmark = abs <= 10 ? 'NORMAL' : abs <= 20 ? 'REVISAR' : abs <= 30 ? 'ALERTA' : 'INCONSISTENCIA'
  return { semaforo, diferenciaPct: Math.round(diferenciaPct * 10) / 10 }
}

// ─── §34/42 — Rango LOW / BASE / HIGH ───────────────────────────────────────────
export interface RangoCosto { low: number; base: number; high: number }
export function calcularRango(costoBase: number, incertidumbreLowPct: number, incertidumbreHighPct: number): RangoCosto {
  return {
    low: Math.round(costoBase * (1 - Math.max(0, incertidumbreLowPct) / 100)),
    base: Math.round(costoBase),
    high: Math.round(costoBase * (1 + Math.max(0, incertidumbreHighPct) / 100)),
  }
}

// ─── §33 — Nivel de confianza ────────────────────────────────────────────────────
// Rúbrica aditiva exacta del documento — evita que el LLM "sienta" un score subjetivo sin
// relación con qué tan completos están los datos reales del proyecto.
export interface FactoresConfianza {
  ubicacionConocida: boolean
  superficieConocida: boolean
  programaDefinido: boolean
  nivelesDefinidos: boolean
  topografiaConocida: boolean
  mecanicaSuelosDisponible: boolean
  acabadosDefinidos: boolean
  estacionamientoDefinido: boolean
  costosLocalesRecientes: boolean
  benchmarkComparable: boolean
}
export type ClasificacionConfianza = 'Alta' | 'Buena' | 'Media' | 'Baja' | 'Muy baja'
const PESOS_CONFIANZA: Record<keyof FactoresConfianza, number> = {
  ubicacionConocida: 15, superficieConocida: 15, programaDefinido: 10, nivelesDefinidos: 10,
  topografiaConocida: 10, mecanicaSuelosDisponible: 10, acabadosDefinidos: 10,
  estacionamientoDefinido: 10, costosLocalesRecientes: 5, benchmarkComparable: 5,
}
export function calcularConfidenceScore(factores: FactoresConfianza): { score: number; clasificacion: ClasificacionConfianza } {
  const score = (Object.keys(PESOS_CONFIANZA) as (keyof FactoresConfianza)[])
    .reduce((s, k) => s + (factores[k] ? PESOS_CONFIANZA[k] : 0), 0)
  const clasificacion: ClasificacionConfianza =
    score >= 90 ? 'Alta' : score >= 75 ? 'Buena' : score >= 60 ? 'Media' : score >= 40 ? 'Baja' : 'Muy baja'
  return { score, clasificacion }
}

// ─── §49 — Alertas inteligentes ──────────────────────────────────────────────────
export function generarAlertas(input: {
  costoM2: number
  benchmarkLow: number
  benchmarkHigh: number
  eficienciaPct: number | null
  areaSotanosM2: number
  areaConstruidaM2: number
  pendienteLabel: PendienteLabel | null | undefined
  confidenceScore: number
}): string[] {
  const alertas: string[] = []
  if (input.costoM2 < input.benchmarkLow) alertas.push('Costo potencialmente subestimado.')
  if (input.costoM2 > input.benchmarkHigh) alertas.push('Costo potencialmente elevado.')
  if (input.eficienciaPct != null && input.eficienciaPct < 60) {
    alertas.push('El proyecto presenta baja eficiencia entre superficie construida y vendible.')
  }
  if (input.areaConstruidaM2 > 0 && input.areaSotanosM2 / input.areaConstruidaM2 > 0.30) {
    alertas.push('El estacionamiento/sótano puede estar penalizando significativamente el costo.')
  }
  if (input.pendienteLabel === 'moderada' || input.pendienteLabel === 'pronunciada') {
    alertas.push('El costo de contención/cimentación puede tener alta sensibilidad por la pendiente del terreno.')
  }
  if (input.confidenceScore < 70) {
    alertas.push('Resultado preliminar. Se recomienda validar mecánica de suelos, programa y cotizaciones locales.')
  }
  return alertas
}

// ─── §32 — Control de sanidad del modelo ────────────────────────────────────────
// Subset aplicable al alcance real de este agente (costo directo por zonas/partidas — indirectos/
// honorarios/imprevistos/terreno los maneja el Agente Financiero aguas abajo, así que sus checks
// correspondientes del documento, CHECK07-10, se dan por cumplidos aquí por diseño, no se repiten).
export interface SanityCheckResultado { check: string; ok: boolean; mensaje: string }
export function ejecutarSanityChecks(input: {
  partidas: PartidaCosto[]
  costoDirectoTotal: number
  areaConstruidaM2: number
  areaVendibleM2: number | null
}): SanityCheckResultado[] {
  const sumaPartidas = input.partidas.reduce((s, p) => s + p.costoTotal, 0)
  const sumaPct = input.partidas.reduce((s, p) => s + p.porcentaje, 0)
  return [
    {
      check: 'CHECK01 — Σ partidas = costo directo',
      ok: Math.abs(sumaPartidas - input.costoDirectoTotal) <= 1, // tolerancia de redondeo, 1 peso
      mensaje: `Suma de partidas $${sumaPartidas.toLocaleString('es-MX')} vs. costo directo $${input.costoDirectoTotal.toLocaleString('es-MX')}`,
    },
    {
      check: 'CHECK04 — m² construidos ≥ m² vendibles',
      ok: input.areaVendibleM2 == null || input.areaConstruidaM2 >= input.areaVendibleM2,
      mensaje: `Construida ${input.areaConstruidaM2} m² vs. vendible ${input.areaVendibleM2 ?? '—'} m²`,
    },
    {
      check: 'CHECK11 — ningún costo negativo',
      ok: input.partidas.every(p => p.costoTotal >= 0) && input.costoDirectoTotal >= 0,
      mensaje: input.partidas.some(p => p.costoTotal < 0) ? 'Hay partidas con costo negativo' : 'Sin costos negativos',
    },
    {
      check: 'CHECK13 — Σ % de partidas = 100%',
      ok: Math.abs(sumaPct - 100) <= 0.5,
      mensaje: `Suma de porcentajes: ${sumaPct.toFixed(1)}%`,
    },
  ]
}
