// Géneros constructivos disponibles en el catálogo §8
export type GeneroConstructivo =
  | 'vivienda_interes_social'
  | 'vivienda_residencial_media'
  | 'vivienda_residencial_lujo'
  | 'nave_industrial'
  | 'oficinas'
  | 'comercio'
  | 'estacionamiento_sotano'
  | 'amenidades_comunes'

// Norma de cajones para un uso específico (proviene del Agente Legal — §3.1)
export interface NormaCajonPorUso {
  // por_unidad: cajones por departamento/unidad
  // por_m2_rentable: fracción cajones/m² rentable (ej. 1/35 → 0.02857)
  metrica: 'por_unidad' | 'por_m2_rentable'
  ratio: number
}

// Norma completa de estacionamiento del Agente Legal
// Si ausente → motor usa fallback §6 y lo registra en supuestos[]
export interface NormaCajones {
  vivienda?: NormaCajonPorUso
  oficinas?: NormaCajonPorUso
  comercio?: NormaCajonPorUso
  visitas?: number          // fracción sobre subtotal, ej. 0.08
  areaPorCajonM2?: number   // área efectiva por cajón (25–30 m²), parametrizable
}

// Inputs normativos del predio — del Agente Legal (§3.1)
export interface InputsNormativos {
  sTerreno: number          // m² del lote
  cos: number               // Coef. de Ocupación del Suelo (0–1)
  cus: number               // Coef. de Utilización del Suelo (múltiplo)
  cas: number               // Coef. de Absorción del Suelo (0–1)
  densidad?: number         // viv/ha (opcional)
  alturaMax?: number        // niveles máximos (opcional)
  normaCajones?: NormaCajones
  exigeSotano?: boolean
}

// Un uso dentro del programa de áreas — del Agente de Estrategia (§3.2)
export interface UsoDesarrollo {
  genero: GeneroConstructivo
  m2Bruto: number           // m² brutos sobre rasante para este uso
  unidades?: number         // vivienda: unidades explícitas (mejora exactitud del cómputo de cajones)
}

// Inputs del proyecto
export interface InputsProyecto {
  usos: UsoDesarrollo[]
}

// Rango piso / base / techo — toda salida numérica es un rango (§7 regla 3)
export interface Rango {
  piso: number
  base: number
  techo: number
}

// ── Outputs ───────────────────────────────────────────────────────────────────

export interface EnvolventeNormativo {
  huellaMax: number         // S_terreno × COS
  construibleMax: number    // S_terreno × CUS (sobre rasante)
  permeableMin: number      // S_terreno × CAS
  nivelesTeóricos: number   // CUS / COS — intuición de la forma del edificio
  unidadesMax?: number      // (S_terreno/10000) × densidad si densidad provista
  bindingConstraint: string // cuál restricción limita realmente el proyecto
  cumple: boolean           // el programa (Σ m²Bruto) cabe dentro de construibleMax (y unidadesMax si aplica)
  excesoPct?: number        // % por el que excede el límite más restrictivo, solo si !cumple
}

export interface DesgloseCajonPorUso {
  genero: GeneroConstructivo
  cajones: number           // cajones derivados para este uso (float antes de ceil)
  supuesto?: string         // descripción del fallback o norma aplicada
}

export interface DesgloseCajones {
  porUso: DesgloseCajonPorUso[]
  cajonesVisita: number     // cajones de visita (redondeados para display)
  cajonesTotales: number    // total final (Math.ceil del float)
  areaPorCajon: number      // m² efectivos por cajón (25–30)
  areaM2: number            // cajonesTotales × areaPorCajon
  supuestoAplicado?: string // descripción global si no hay normaCajones
}

export interface PorcionCosto {
  genero: GeneroConstructivo
  areaM2: number
  costoM2: Rango            // $/m² piso/base/techo del catálogo
  costoDirecto: Rango       // areaM2 × costoM2 en cada escenario
}

export interface ResultadoEstimador {
  envolvente: EnvolventeNormativo
  cajones: DesgloseCajones
  areas: {
    sobreRasante: number    // Σ m² de todos los usos sobre rasante
    sotano: number          // m² de sótano (estacionamiento derivado)
    total: number           // sobreRasante + sotano — esto es lo que CUESTA
    vendible: number        // Σ (m²_uso × factor_eficiencia) — denominador comercial
  }
  porciones: PorcionCosto[]
  costoDirectoTotal: Rango  // Σ costos directos de todas las porciones
  costoTotal: Rango         // directo × (1.20 / 1.28 / 1.35)
  indicadores: {
    costoPorM2Bruto: Rango     // costoTotal / areas.total
    costoPorM2Vendible: Rango  // costoTotal / areas.vendible
  }
  // BITÁCORA: registro completo de todos los supuestos, fallbacks y valores usados.
  // Cada entrada indica qué se asumió, qué valor se aplicó y cómo corregirlo.
  supuestos: string[]
}
