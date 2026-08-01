// Catálogo de datos paramétricos de Mastermind — factibilidad financiera.
// ESTE ARCHIVO ES DATA EDITABLE — no contiene lógica de cálculo.

import type { BenchmarkConstruccion, MastermindInputs } from './tipos'

// ── Benchmarks de costo de construcción (MXN/m² construido) ─────────────────
export const BENCHMARKS_CONSTRUCCION_MXN_M2: Record<BenchmarkConstruccion, number> = {
  habitacional_economico: 10_500,
  habitacional_medio: 13_500,
  habitacional_residencial: 17_000,
  comercial_local: 12_000,
  estacionamiento_sotano: 22_000,
  oficinas: 15_000,
}

// ── Rangos de referencia por banda socioeconómica (MXN/m²) ──────────────────
// Terreno y construcción comparten la misma escala 1-4 que ya usan los Agentes
// Terreno/Construcción/Financiero (ver bandaLabels en app/api/agentes/*/route.ts).
// Solo se usan para diagnóstico de anomalías — el motor de cálculo sigue usando
// BENCHMARKS_CONSTRUCCION_MXN_M2 / el costo de terreno real tal cual, sin snapping.
export const RANGOS_BANDA_MXN_M2: Record<number, { min: number; max: number; nombre: string }> = {
  1: { min: 7_000, max: 10_500, nombre: 'Popular / Económica' },
  2: { min: 10_500, max: 16_000, nombre: 'Media Estándar' },
  3: { min: 16_000, max: 24_000, nombre: 'Media Alta / Residencial' },
  4: { min: 24_000, max: 45_000, nombre: 'Premium / Lujo' },
}

// ── Factores fijos del motor ─────────────────────────────────────────────────
export const FACTOR_EFICIENCIA_CONSTRUCCION = 0.85 // m² construidos → m² vendibles equivalentes
export const DESCUENTOS_CANCELACIONES = 0.05        // -5% sobre ingreso bruto
export const PORCENTAJE_COMERCIALIZACION = 0.03      // 3% sobre ingreso neto
// PORCENTAJE_INDIRECTOS/HONORARIOS/IMPREVISTOS ya no son constantes fijas — son
// DEFAULTS.proyecto.porcentaje{Indirectos,Honorarios,Imprevistos}, editables por proyecto y
// calibrables desde el análisis real (ver lib/mastermind/contexto.ts). Comercialización y
// descuentos sí se quedan fijos para todo proyecto — decisión explícita: se tratan como costos
// reales de cualquier desarrollo, aunque el análisis original no los haya modelado por separado
// (no siempre van a cuadrar centavo a centavo con el análisis).

// ── Rango sugerido de % de honorarios de proyecto, por banda de construcción ────────────────
// A diferencia de indirectos (administración de obra, permisos — escala ~linealmente con el
// costo de construcción sin importar el segmento) y de imprevistos (contingencia, ~fija), los
// honorarios de diseño SÍ varían mucho con la complejidad/segmento del proyecto: un desarrollo
// sencillo en banda popular solo necesita un arquitecto y quizás un ingeniero estructural
// (7-9%), mientras uno complejo o de lujo suma ingenierías especiales, DRO, gerencia de
// proyecto, interiorismo, paisajismo, etc. (hasta 30%). Solo es un rango SUGERIDO para
// prellenar/validar — el usuario lo puede ajustar libremente en Mastermind y el Agente
// Financiero también decide dentro de este rango (ver app/api/agentes/financiero/route.ts).
export const RANGOS_HONORARIOS_POR_BANDA: Record<number, { min: number; max: number }> = {
  1: { min: 7, max: 9 },   // Popular / Económica
  2: { min: 9, max: 13 },  // Media Estándar
  3: { min: 13, max: 20 }, // Media Alta / Residencial
  4: { min: 20, max: 30 }, // Premium / Lujo
}

// Punto medio del rango de la banda 2 (Media Estándar) — default genérico cuando no hay banda
// conocida todavía (ej. Mastermind sin análisis previo cargado).
export const PORCENTAJE_HONORARIOS_DEFAULT = 11
export const PORCENTAJE_IMPREVISTOS_DEFAULT = 5

// ── Defaults de inputs de usuario ────────────────────────────────────────────
export const DEFAULTS: Omit<MastermindInputs, 'terreno'> = {
  proyecto: {
    tipoProyecto: 'vertical_mixto',
    niveles: 4,
    unidadesHabitacionales: 16,
    m2PromedioDepa: 65,
    m2ComercialesPlantaBaja: 0,
    benchmarkConstruccion: 'habitacional_medio',
    porcentajeIndirectos: 15,
    porcentajeHonorarios: PORCENTAJE_HONORARIOS_DEFAULT,
    porcentajeImprevistos: PORCENTAJE_IMPREVISTOS_DEFAULT,
  },
  mercado: {
    precioVentaDepasM2: 0,
    precioLocalesM2: 0,
  },
  tiempo: {
    plazoObraMeses: 18,
    plazoVentaMeses: 24,
    inicioVentasMes: 6,
  },
  financiamiento: {
    porcentajeFinanciado: 0,
    tasaAnualCredito: 14,
  },
  tirObjetivo: 25,
}

// ── Reglas de validación ─────────────────────────────────────────────────────
export interface ReglaValidacion {
  campo: string
  min?: number
  max?: number
  mensaje: string
}

export const REGLAS_VALIDACION: ReglaValidacion[] = [
  { campo: 'unidadesHabitacionales', min: 1, max: 500, mensaje: 'Número de unidades fuera de rango' },
  { campo: 'm2PromedioDepa', min: 30, max: 500, mensaje: 'm² promedio inválido' },
  { campo: 'precioVentaDepasM2', min: 0.0001, mensaje: 'Ingresa precio de venta' },
  { campo: 'niveles', min: 1, max: 30, mensaje: 'Niveles fuera de rango' },
  { campo: 'plazoObraMeses', min: 6, max: 60, mensaje: 'Plazo de obra inválido' },
  { campo: 'porcentajeFinanciado', min: 0, max: 90, mensaje: 'Financiamiento máximo 90%' },
  { campo: 'tirObjetivo', min: 5, max: 60, mensaje: 'TIR objetivo fuera de rango razonable' },
]
