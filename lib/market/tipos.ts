// Fase 2 — MarketMaster: contrato central del Agente de Mercado nuevo.
// Ver Documents/smartdeveloper/buenas notasde mejora de JCAS/
// PREFORMA_PROMPT_MAESTRO_AGENTE_MERCADO.md (§4, §107) para el spec completo.
//
// Este módulo es ADITIVO — vive aparte de app/api/agentes/mercado/route.ts (que sigue
// funcionando sin cambios) y de lib/mercado/ (comparables-venta, validación, plusvalía). No se
// conecta todavía a PREFORMA ni al dashboard — eso es una fase posterior, una vez que haya más
// motores construidos (Price/Appreciation/Demand/etc.) y se decida cómo migrar sin romper lo
// que ya funciona.
//
// Alcance real de esta fase: solo el Comparable Engine (lib/market/comparableEngine.ts) tiene
// motor determinístico detrás. El resto de los campos del MarketMaster completo (prices,
// appreciation, inventory, pipeline, demand, absorption, opportunityScore) se declaran en el
// tipo para que el contrato no tenga que romperse cuando esos motores se construyan en fases
// futuras (§131 Fase 8-16) — hoy siempre valen null, nunca se inventan.

import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'

// ── Comparable Engine (Fase 3) ───────────────────────────────────────────────

// Datos del proyecto contra los que se compara cada candidato — subconjunto de lo que ya
// captura PREFORMA (precio objetivo, área, recámaras). Cualquier campo ausente degrada esa
// dimensión del score a null, nunca se rellena con un supuesto. No incluye lat/lng: la distancia
// (comparable.distanciaKm) ya viene precalculada por comparables-venta/route.ts contra el predio
// — este motor no vuelve a geocodificar ni a calcular distancias.
export interface ObjetivoComparable {
  precioM2Objetivo?: number | null
  areaM2Objetivo?: number | null
  recamarasObjetivo?: number | null
}

// Pesos de las 4 dimensiones calculables — input configurable de calcularComparableScore()
// (default: PESOS_BASE_DEFAULT en comparableEngine.ts). No hace falta que sumen 1: se
// renormalizan según cuáles dimensiones estén disponibles para cada comparable.
export type PesosComparable = Record<'location' | 'typology' | 'area' | 'price', number>

// §18 del spec pide 8 dimensiones. Hoy solo 4 son calculables con los datos que ya captura
// comparables-venta/route.ts (precioM2, superficieM2, tipologia de texto libre, distanciaKm).
// Las otras 4 (edad del inmueble, amenidades, desarrollador, etapa de obra estructurada) NO se
// capturan hoy en ningún lado del pipeline — se dejan en null explícito (§97: nunca fabricar
// una dimensión sin dato real detrás) hasta que exista esa fuente.
export interface ComparableScore {
  locationSimilarity: number | null
  typologySimilarity: number | null
  areaSimilarity: number | null
  priceSimilarity: number | null
  ageSimilarity: null       // NOT_AVAILABLE — sin fuente de antigüedad del inmueble hoy
  amenitySimilarity: null   // NOT_AVAILABLE — comparables-venta no captura amenidades
  developerSimilarity: null // NOT_AVAILABLE — comparables-venta no captura desarrollador
  stageSimilarity: null     // NOT_AVAILABLE — avanceObra es texto libre, no una similitud
  // §126 — pesos usados (ya normalizados a sumar 1 entre las dimensiones disponibles) y cuántas
  // de las 8 dimensiones del spec se pudieron calcular con datos reales, para que el consumidor
  // sepa qué tan robusto es finalScore sin tener que adivinar.
  weights: Partial<PesosComparable>
  dimensionesDisponibles: number
  finalScore: number | null
}

// §19 del spec.
export type TipoComparable = 'DIRECT' | 'SUBSTITUTE' | 'ASPIRATIONAL' | 'FLOOR'

export interface ComparableConScore {
  comparable: ComparableVenta
  score: ComparableScore
  tipo: TipoComparable
}

// ── Geography Engine (Fase 4) ─────────────────────────────────────────────────
// Ver §14-17 del spec. Jerarquía completa (metropolitana → municipio → colonia → microzona →
// corredor → radio → isócrona) — hoy solo se llenan municipio/colonia (ya vienen de Terreno/
// Normativa) y radios/microzona (nuevo en esta fase). corredor e isócrona quedan fuera de esta
// fase: isócrona ya tiene cliente real (lib/geo/isochrone.ts, ORS) para OTRO feature (accesibilidad
// de terreno) con rangos 15/30/45 min — no se modifica aquí para no romperlo; el spec pide
// 5/10/15/20 min para Mercado específicamente, así que reusarlo tal cual es una desviación menor
// documentada, no un olvido.

export type TipoProductoMercado = 'boutique_premium' | 'residencial' | 'comercial'

// §15 — el radio/tiempo de viaje relevante depende del tipo de producto, no es una sola
// distancia universal.
export interface RadioPrincipal {
  tipo: 'distancia' | 'tiempo_viaje'
  minKm?: number
  maxKm?: number
  minMinutos?: number
  maxMinutos?: number
}

// §17 — status explícito en vez de fingir una microzona sin datos reales detrás.
export interface MicrozonaResultado {
  status: 'MICROZONE_NOT_CONFIDENT' | 'CONFIDENT'
  motivo: string
}

export interface GeographyContext {
  // "ciudad" para ser consistente con el resto del código (comparables-venta/route.ts, mercado/
  // route.ts ya usan colonia/ciudad/estado) — el spec le llama MUNICIPALITY (§14), mismo concepto.
  ciudad: string | null
  colonia: string | null
  microzona: MicrozonaResultado
  radiosEstandarKm: number[]
  radioPrincipal: RadioPrincipal
}

// ── Price Engine (Fase 8 del documento) ───────────────────────────────────────
// §11, §12, §21, §22, §57-58. Alcance real: segmenta por banda de superficie y por número de
// recámaras (reusa parsearRecamaras de comparableEngine.ts) — NO por zona/microzona (Geography
// Engine todavía no puede segmentar con confianza, ver detectarMicrozona) ni por new/resale (el
// campo avanceObra — Entregado/En obra/Preventa — no mapea limpio a esa distinción sin
// inventar una regla). confidenceScore hoy es SOLO función de sampleSize (§57 pide también
// sourceQuality/recency/geographicPrecision/methodologyQuality — deferred, no hay señal real
// para esos todavía).

export type NivelConfianza = 'ALTA' | 'BUENA' | 'MEDIA' | 'BAJA' | 'INSUFICIENTE'

export interface RobustStats {
  n: number
  mean: number
  median: number
  min: number
  max: number
  p10: number
  p25: number
  p75: number
  p90: number
  iqr: number
  stdDev: number
  confidenceScore: number
  confidenceNivel: NivelConfianza
}

export interface SegmentoPrecio {
  clave: string
  estadisticas: RobustStats | null
  outliersExcluidos: number[]
}

export interface PriceEngineResultado {
  askingPricePerM2: RobustStats | null
  outliersExcluidos: number[]
  porBandaSuperficie: SegmentoPrecio[]
  porRecamaras: SegmentoPrecio[]
}

// ── Listing Dedup Engine (Fase 6 del documento) ───────────────────────────────
// §13. Alcance real: comparables-venta/route.ts NO captura coordinates garantizadas (solo si
// PREFORMA mandó lat/lng del predio y la geocodificación resolvió), ni parking/project/unit/
// phone/developer/hash — de la lista del spec solo hay señal real en: coordenadas (a veces),
// dirección, superficie, recámaras (parseadas de tipologia) y nombre de proyecto. Deduplicar
// contra las señales que sí existen, nunca fingir las que no.

export interface ComparableDescartado {
  duplicado: ComparableVenta
  deQuien: ComparableVenta
  motivo: string
}

export interface ResultadoDedup {
  originales: ComparableVenta[]
  descartados: ComparableDescartado[]
}

// ── MarketMaster (Fase 2) ─────────────────────────────────────────────────────

export interface MarketSource {
  sourceId: string
  provider: string
  // Únicos dos tipos reales hoy: comparables-venta (Serper + Claude Haiku extrayendo de
  // snippets) y el resto del Agente Mercado (Claude Sonnet generando texto libre sin grounding
  // — ver hallazgo de Fase 1). No agregar un tercer tipo sin que exista de verdad.
  sourceType: 'web_search' | 'llm_estimate'
  retrievedAt: string
}

export interface MarketMaster {
  siteId: string

  // GeographyContext (Fase 4) + coordenadas/estado, que no forman parte del motor de geografía
  // en sí (son datos crudos del predio, no algo que ese motor calcule).
  geography: GeographyContext & {
    lat: number | null
    lng: number | null
    estado?: string | null
  }

  comparables: ComparableConScore[]

  // Price Engine (Fase 8, ver arriba) — único motor de estos ya construido.
  prices: PriceEngineResultado | null

  // Motores todavía sin construir (§131 Fase 9-16) — se declaran para no romper el contrato
  // cuando se implementen, pero HOY siempre son null. No poblar con texto libre del LLM.
  appreciation: null
  inventory: null
  pipeline: null
  demand: null
  absorption: null
  opportunityScore: null

  // Promedio simple de finalScore entre los comparables DIRECT (null si no hay ninguno) — única
  // señal de confianza real disponible en esta fase, no un Data Quality Score completo (§56).
  dataConfidence: number | null

  sources: MarketSource[]
  warnings: string[]

  version: '0.2.0-fase2-4-8'
  generatedAt: string
}
