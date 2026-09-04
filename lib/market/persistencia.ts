// Fase 4 (Market Data Model) — capa de persistencia sobre market_sources /
// market_comparable_snapshots (ver supabase/migrations/20260826000000_market_data_model.sql).
//
// A diferencia de comparableEngine.ts/priceEngine.ts/geographyEngine.ts (motores puros, sin
// efectos secundarios, con tests), este archivo SÍ toca la base de datos — mismo patrón que el
// resto de app/api/**/route.ts de este repo, no se le escriben tests que golpeen Supabase real.
//
// Server-side ÚNICAMENTE (usa supabaseAdmin, service role — ver lib/supabase-admin.ts). No
// importar desde ningún componente 'use client'.

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { MarketSource } from './tipos'

export async function registrarFuente(
  provider: string,
  sourceType: MarketSource['sourceType'],
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('market_sources')
    .insert({ provider, source_type: sourceType })
    .select('id')
    .single()

  if (error) throw new Error(`registrarFuente: ${error.message}`)
  return data.id as string
}

// Inserta un snapshot por cada comparable — NUNCA hace upsert/update sobre uno existente (§36:
// no sobrescribir el histórico). Llamar una vez por cada corrida real de comparables-venta.
export async function guardarComparablesSnapshot(
  comparables: ComparableVenta[],
  opciones: { proyectoId?: string | null; sourceId?: string | null; ciudad?: string | null } = {},
): Promise<void> {
  if (comparables.length === 0) return

  const filas = comparables.map((c) => ({
    proyecto_id: opciones.proyectoId ?? null,
    source_id: opciones.sourceId ?? null,
    nombre: c.nombre,
    direccion: c.direccion,
    colonia: c.colonia ?? null,
    ciudad: opciones.ciudad ?? null,
    precio_m2: c.precioM2,
    precio_total: c.precioTotal,
    superficie_m2: c.superficieM2,
    tipologia: c.tipologia,
    avance_obra: c.avanceObra,
    fecha_referencia: c.fechaReferencia,
    url: c.url,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    distancia_km: c.distanciaKm ?? null,
  }))

  const { error } = await supabaseAdmin.from('market_comparable_snapshots').insert(filas)
  if (error) throw new Error(`guardarComparablesSnapshot: ${error.message}`)
}

// Fila cruda tal como vive en la tabla — snake_case, a diferencia de ComparableVenta (camelCase)
// que usa el resto de lib/market/. Conversión explícita, no se reusa el tipo de la tabla como si
// fuera el mismo shape que produce el LLM.
export interface ComparableSnapshotRow {
  id: string
  colonia: string | null
  precio_m2: number | null
  superficie_m2: number | null
  tipologia: string | null
  observed_at: string
}

// Punto de entrada que Appreciation Engine (Fase 9, todavía sin construir) va a necesitar:
// traer los snapshots de una colonia en un rango de fechas para calcular la variación real de
// precio en el tiempo. Se deja aquí ya (en vez de esperar a Fase 9) porque es la mitad
// "persistencia" del problema — la mitad "cálculo" se construye después, cuando haya suficiente
// historial acumulado para que el resultado signifique algo (§97: no producir falsa precisión
// con una sola fecha de datos).
export async function obtenerSnapshotsHistoricos(
  colonia: string,
  desde: string,
  hasta: string,
): Promise<ComparableSnapshotRow[]> {
  const { data, error } = await supabaseAdmin
    .from('market_comparable_snapshots')
    .select('id, colonia, precio_m2, superficie_m2, tipologia, observed_at')
    .eq('colonia', colonia)
    .gte('observed_at', desde)
    .lte('observed_at', hasta)
    .order('observed_at', { ascending: true })

  if (error) throw new Error(`obtenerSnapshotsHistoricos: ${error.message}`)
  return data as ComparableSnapshotRow[]
}

// Punto de entrada para lib/market/betaTramoEngine.ts — encuentra, dentro de una ciudad, la
// colonia con más historial reciente y precio/m² mediano más bajo (proxy de "banda económica/
// media") para usarla como referencia real cuando la colonia del predio (típicamente premium,
// con poco o ningún historial propio) no tiene suficiente dato directo. Requiere la columna
// `ciudad` (migración 20260904000000_snapshots_agrega_ciudad.sql) — snapshots guardados antes de
// esa migración tienen ciudad NULL y no participan en esta búsqueda.
export interface ColoniaConHistorial {
  colonia: string
  n: number
  precioM2Mediano: number
}

export async function obtenerColoniasConHistorial(
  ciudad: string,
  desde: string,
  hasta: string,
): Promise<ColoniaConHistorial[]> {
  const { data, error } = await supabaseAdmin
    .from('market_comparable_snapshots')
    .select('colonia, precio_m2')
    .eq('ciudad', ciudad)
    .gte('observed_at', desde)
    .lte('observed_at', hasta)
    .not('colonia', 'is', null)
    .not('precio_m2', 'is', null)

  if (error) throw new Error(`obtenerColoniasConHistorial: ${error.message}`)

  const porColonia = new Map<string, number[]>()
  for (const row of data as { colonia: string; precio_m2: number }[]) {
    if (!porColonia.has(row.colonia)) porColonia.set(row.colonia, [])
    porColonia.get(row.colonia)!.push(row.precio_m2)
  }

  return [...porColonia.entries()]
    .map(([colonia, precios]) => {
      const ordenados = [...precios].sort((a, b) => a - b)
      const mid = Math.floor(ordenados.length / 2)
      const precioM2Mediano = ordenados.length % 2 === 0 ? (ordenados[mid - 1] + ordenados[mid]) / 2 : ordenados[mid]
      return { colonia, n: precios.length, precioM2Mediano }
    })
    .sort((a, b) => a.precioM2Mediano - b.precioM2Mediano)
}
