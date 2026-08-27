// Fase 3 (documento) — Evidence Registry (§59-60). No es un motor de cálculo — es la capa de
// trazabilidad que envuelve lo que YA calculan los otros motores (Price/Appreciation/Inventory)
// para que cada número pueda responder ¿qué/cuándo/dónde/de dónde/cuántos datos/cómo?, en vez de
// aparecer como un número suelto sin origen.
//
// evidenceId se genera con crypto.randomUUID() (no es una función "pura" en sentido estricto,
// pero generar IDs es inherentemente no-determinístico — mismo criterio que gen_random_uuid()
// en las tablas de Supabase de este mismo módulo). Los tests verifican forma, no el valor exacto.

import type { MarketEvidence, NivelConfianza, ResultadoPlusvalia, RobustStats, TipoTransaccion } from './tipos'

function generarEvidenceId(): string {
  return `MKT-EV-${crypto.randomUUID()}`
}

export interface ContextoEvidencia {
  geography?: string | null
  propertyType?: string | null
  sourceId?: string | null
}

// §10 — todo lo que sale de comparables-venta/route.ts es precio de publicación, nunca de
// cierre. Se deja como parámetro (no hardcodeado a 'asking') solo por si algún día existe una
// fuente real de cierres — hoy siempre se le pasa 'asking' desde los wrappers de abajo.
export function crearEvidencia(
  metric: string,
  value: number | string,
  sampleSize: number,
  method: string,
  opciones: ContextoEvidencia & { period?: string | null; transactionType?: TipoTransaccion | null; confidence?: NivelConfianza | null } = {},
): MarketEvidence {
  return {
    evidenceId: generarEvidenceId(),
    metric,
    value,
    period: opciones.period ?? null,
    geography: opciones.geography ?? null,
    propertyType: opciones.propertyType ?? null,
    transactionType: opciones.transactionType ?? null,
    sampleSize,
    sourceId: opciones.sourceId ?? null,
    method,
    confidence: opciones.confidence ?? null,
  }
}

// Envuelve un RobustStats del Price Engine (Fase 8) — la mediana es la métrica principal (§11:
// priorizar mediana sobre promedio), el resto de percentiles queda en `value` como referencia
// secundaria dentro del mismo registro en vez de generar 5 evidencias sueltas por cada stat.
export function evidenciaDePrecio(stats: RobustStats, contexto: ContextoEvidencia = {}): MarketEvidence {
  return crearEvidencia('price_per_m2_median', stats.median, stats.n, 'Mediana, outliers excluidos por valla 1.5×IQR', {
    ...contexto,
    transactionType: 'asking',
    confidence: stats.confidenceNivel,
  })
}

// Envuelve un ResultadoPlusvalia del Appreciation Engine (Fase 9) — null si la ventana no tuvo
// suficiente historial (§97: no generar evidencia de un NOT_ENOUGH_DATA, sería trazabilidad de
// la nada).
export function evidenciaDePlusvalia(resultado: ResultadoPlusvalia, contexto: ContextoEvidencia = {}): MarketEvidence | null {
  if (resultado.tasaAnualizada == null) return null
  return crearEvidencia(
    `appreciation_${resultado.ventana}`,
    resultado.tasaAnualizada,
    resultado.muestraFin,
    `Composición sobre mediana mensual, ${resultado.periodoInicio}→${resultado.periodoFin}`,
    { ...contexto, period: resultado.periodoFin, transactionType: 'asking' },
  )
}
