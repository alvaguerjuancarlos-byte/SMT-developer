// §47 (documento) — Competitor Engine. Motor puro, sin red ni LLM. Agrupa comparables del mismo
// batch por proyecto (mismo nombre) y arma un CompetitorProfile por cada uno — ver nota de
// alcance en tipos.ts (sin desarrollador ni amenities, sin inventario real del proyecto).

import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { CompetitorProfile, EtapaInventario, ObjetivoComparable, TipoComparable } from './tipos'
import { normalizarTexto } from './dedupEngine'
import { clasificarComparable } from './comparableEngine'
import { clasificarEtapa } from './inventoryEngine'
import { calcularEstadisticasRobustas } from './priceEngine'

function modaClasificacion(clasificaciones: TipoComparable[]): TipoComparable | null {
  if (clasificaciones.length === 0) return null
  const conteo = new Map<TipoComparable, number>()
  for (const c of clasificaciones) conteo.set(c, (conteo.get(c) ?? 0) + 1)
  let mejor: TipoComparable = clasificaciones[0]
  let mejorConteo = 0
  for (const [c, n] of conteo) {
    if (n > mejorConteo) { mejor = c; mejorConteo = n }
  }
  return mejor
}

export function construirCompetitorProfiles(
  candidatos: ComparableVenta[],
  objetivo?: ObjetivoComparable,
): CompetitorProfile[] {
  const grupos = new Map<string, ComparableVenta[]>()
  for (const c of candidatos) {
    const clave = normalizarTexto(c.nombre)
    if (!clave) continue // sin nombre de proyecto no hay competidor que perfilar, no se fuerza
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave)!.push(c)
  }

  return Array.from(grupos.values()).map((items) => {
    const precios = items.map((c) => c.precioM2).filter((p): p is number => p != null)
    const tipologias = [...new Set(items.map((c) => c.tipologia).filter((t): t is string => t != null))]
    const etapas = [...new Set(items.map((c) => clasificarEtapa(c.avanceObra)))] as EtapaInventario[]
    const clasificacion = objetivo
      ? modaClasificacion(items.map((c) => clasificarComparable(c, objetivo)))
      : null

    return {
      nombre: items[0].nombre,
      colonia: items.find((c) => c.colonia)?.colonia ?? null,
      unidadesObservadas: items.length,
      precioM2: calcularEstadisticasRobustas(precios),
      tipologias,
      etapas,
      clasificacion,
    }
  })
}
