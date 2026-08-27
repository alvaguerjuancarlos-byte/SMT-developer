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

// ── Inventory Engine acotado (Fase 10 del documento, §35, §73) ────────────────
// El spec pide separar: active, pre-sale, under-construction, delivered, resale, sold. La única
// señal real que captura comparables-venta/route.ts es avanceObra, y solo con 3 valores posibles
// ("Preventa"/"En obra"/"Entregado", o null si el LLM no pudo determinarlo — ver su prompt). No
// hay forma de distinguir "delivered" de "resale"/"sold" con ese único campo — se documenta como
// tal en vez de inventar la distinción. "active" tampoco aplica: no es una etapa de obra, es un
// status de listing (publicado vs. retirado) que este pipeline no rastrea.

export type EtapaInventario = 'preventa' | 'en_obra' | 'entregado' | 'sin_dato'

export interface SegmentoInventario {
  etapa: EtapaInventario
  unidades: number
  precioM2: RobustStats | null
  superficieM2: RobustStats | null
}

// ── Appreciation Engine (Fase 9 del documento) ────────────────────────────────
// §25-28, §61, §97. Motor puro sobre una serie de observaciones YA filtrada por el caller (una
// colonia, una tipología, etc. — este motor no segmenta por geografía/tipología él mismo, ver
// nota en appreciationEngine.ts). No tiene datos reales que consumir todavía: recién se aplicó
// la migración de market_comparable_snapshots (Fase 4) y nada ha vuelto a escribir en ella —
// hace falta conectar lib/market/persistencia.ts a comparables-venta/route.ts antes de que este
// motor calcule algo distinto de NOT_ENOUGH_DATA en producción. Se construye ahora de todos
// modos porque la lógica es independiente de si ya hay datos o no (mismo patrón que
// comparableEngine.ts/priceEngine.ts: motor puro + tests con fixtures, no con la BD real).

export type VentanaPlusvalia = 'mensual' | 'trimestral' | 'anual' | '3_anios' | '5_anios' | '10_anios'

export interface ObservacionPrecio {
  precioM2: number
  observadoEn: string // fecha ISO (YYYY-MM-DD o completa) — solo se usa el mes calendario
}

export interface ResultadoPlusvalia {
  ventana: VentanaPlusvalia
  tasaAnualizada: number | null // % anualizado, null = NOT_ENOUGH_DATA (§97)
  periodoInicio: string | null  // "YYYY-MM"
  periodoFin: string | null     // "YYYY-MM"
  muestraInicio: number         // cuántas observaciones componen la mediana del mes de inicio
  muestraFin: number
  motivo?: string                // por qué es null, cuando aplica — nunca se deja sin explicar
}

// ── Evidence Registry (Fase 3 del documento) ──────────────────────────────────
// §59-60. Cada métrica que produce un motor de lib/market/ se puede envolver en un
// MarketEvidence para que responda ¿qué/cuándo/dónde/de dónde/cuántos datos/cómo se calculó? —
// nunca se presenta un número suelto sin esta trazabilidad. transactionType usa la distinción
// dura del spec (§10): un precio de portal es SIEMPRE 'asking', nunca 'closing' — este pipeline
// no tiene ninguna fuente de precios de cierre real todavía.

export type TipoTransaccion = 'asking' | 'closing'

export interface MarketEvidence {
  evidenceId: string
  metric: string
  value: number | string
  period: string | null        // "YYYY-MM", null si la métrica no es temporal
  geography: string | null     // ej. colonia — 'sin-segmentar' si aplica a todo el set
  propertyType: string | null  // ej. "2 rec", null si no aplica
  transactionType: TipoTransaccion | null
  sampleSize: number
  sourceId: string | null
  method: string                // cómo se calculó, texto corto y específico
  confidence: NivelConfianza | null
}

// ── Competitor Engine (§47 del documento) ─────────────────────────────────────
// Agrupa los comparables de un mismo batch por proyecto (mismo nombre normalizado, ver
// dedupEngine.ts::normalizarTexto) — un "competidor" es la misma info que ya produce el
// Comparable Engine, vista por proyecto en vez de por listado individual. De los campos que
// pide el spec (proyecto, desarrollador, unidades, tipología, precio, precio/m², etapa, entrega,
// amenities, ubicación), NO hay señal real de desarrollador ni amenities en el pipeline hoy —
// unidadesObservadas es cuántos LISTADOS de ese proyecto se vieron en este batch, no el
// inventario total real del proyecto (eso necesitaría Fase 10 completo con datos del desarrollador).
export interface CompetitorProfile {
  nombre: string
  colonia: string | null
  unidadesObservadas: number
  precioM2: RobustStats | null
  tipologias: string[]
  etapas: EtapaInventario[]
  // Clasificación más frecuente entre sus listados (DIRECT/SUBSTITUTE/ASPIRATIONAL/FLOOR, §19) —
  // null si no se pasó un objetivo contra el cual clasificar.
  clasificacion: TipoComparable | null
}

// ── Product Fit Engine (Fase 15 del documento) ────────────────────────────────
// §50. Cruza SITE_MASTER/NORMATIVE_MASTER (aquí: EnvolventeNormativo real de lib/estimador) con
// MARKET_MASTER (Price/Comparable/Competitor Engine ya construidos). De las 9 dimensiones que
// pide el spec, demandFit y rentFit quedan SIEMPRE null — no existe Demand Engine (Fase 11) ni
// Rent Engine (Fase 12) reales todavía, ambos bloqueados por falta de fuente de datos (ver
// conversación de Fase 1/9/11). supplyFit también queda null: con los datos de hoy sería
// prácticamente la misma señal que competitionFit disfrazada de otro número — no se fabrica un
// noveno indicador redundante solo para llenar el campo.
export interface ProductFitScore {
  demandFit: null       // NOT_AVAILABLE — sin Demand Engine (Fase 11)
  competitionFit: number | null
  priceFit: number | null
  sizeFit: number | null
  typologyFit: number | null
  locationFit: number | null
  regulatoryFit: number | null // 100 o 0 — límite duro, no un score suave
  supplyFit: null        // NOT_AVAILABLE — redundante con competitionFit dado el dato actual
  rentFit: null          // NOT_AVAILABLE — sin Rent Engine (Fase 12)
  // Bandera dura, separada del promedio (§120, §133.29: nunca recomendar más de lo que permite
  // la normativa, sin importar qué tan bien puntúen las demás dimensiones).
  cumpleNormativa: boolean
  unidadesRecomendadas: number
  finalScore: number | null
}

// ── Market Opportunity Score acotado (Fase 16 del documento) ──────────────────
// §55-56, §126. El spec pide 11 componentes: demand, price_growth, inventory, absorption,
// competition, pipeline, rent, yield, market_gap, product_fit, data_quality. Solo 4 tienen señal
// real hoy — el resto necesita motores que no existen (Demand/Absorption/Pipeline/Rent/Yield,
// Fases 11-14) o no tiene un benchmark contra el cual decir si "más" es mejor o peor
// (inventory por sí solo, sin absorción real, no dice nada de oportunidad — ver §44 Market
// Health Matrix, que cruza inventario CON velocidad, algo que no podemos calcular todavía).
export interface MarketOpportunityScore {
  components: {
    demand: null
    price_growth: number | null
    inventory: null
    absorption: null
    competition: number | null
    pipeline: null
    rent: null
    yield: null
    market_gap: null
    product_fit: number | null
    data_quality: number | null
  }
  // §126 — pesos usados, ya normalizados entre los componentes disponibles. Nunca ocultos.
  weights: Partial<Record<'price_growth' | 'competition' | 'product_fit' | 'data_quality', number>>
  finalScore: number | null
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
