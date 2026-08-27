// Fase 10 (documento) — Inventory Engine acotado (§35, §73). Motor puro, sin red ni LLM.
// Ver nota de alcance en tipos.ts: solo 4 etapas reales (preventa/en_obra/entregado/sin_dato),
// no las 6 del spec — el campo avanceObra no alcanza para más sin inventar una distinción.

import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { EtapaInventario, SegmentoInventario } from './tipos'
import { calcularEstadisticasRobustas } from './priceEngine'

export function clasificarEtapa(avanceObra: string | null): EtapaInventario {
  if (!avanceObra) return 'sin_dato'
  switch (avanceObra.trim().toLowerCase()) {
    case 'preventa': return 'preventa'
    case 'en obra': return 'en_obra'
    case 'entregado': return 'entregado'
    // Valor inesperado (el LLM debería devolver exactamente estos 3, ver el prompt de
    // comparables-venta/route.ts) — no se fuerza a una categoría existente.
    default: return 'sin_dato'
  }
}

export function categorizarInventario(comparables: ComparableVenta[]): SegmentoInventario[] {
  const grupos = new Map<EtapaInventario, ComparableVenta[]>()
  for (const c of comparables) {
    const etapa = clasificarEtapa(c.avanceObra)
    if (!grupos.has(etapa)) grupos.set(etapa, [])
    grupos.get(etapa)!.push(c)
  }

  return Array.from(grupos.entries()).map(([etapa, items]) => {
    const precios = items.map((c) => c.precioM2).filter((p): p is number => p != null)
    const superficies = items.map((c) => c.superficieM2).filter((s): s is number => s != null)
    return {
      etapa,
      unidades: items.length,
      precioM2: calcularEstadisticasRobustas(precios),
      superficieM2: calcularEstadisticasRobustas(superficies),
    }
  })
}
