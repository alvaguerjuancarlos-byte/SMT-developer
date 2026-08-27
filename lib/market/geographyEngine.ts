// Fase 4 — Geography Engine (§14-17 del spec). Motor puro, sin llamadas de red ni LLM.
//
// Alcance real de esta fase, dado lo que existe hoy (ver Fase 1):
//   - radios estándar de mercado y el "radio principal" según tipo de producto (§15): sí, es
//     una regla determinística simple, se construye completa.
//   - detección automática de microzonas por clustering espacial (§17): NO — requeriría un
//     dataset de listings persistente con densidad suficiente (Fase 6: ingestion + dedup +
//     Fase 4-completa: Market Data Model + snapshots), que todavía no existe (cero tablas
//     market_* en Supabase). Se devuelve MICROZONE_NOT_CONFIDENT explícito, nunca una microzona
//     inventada.
//   - isócronas (§16): ya existe un cliente ORS real en lib/geo/isochrone.ts, construido para
//     otro feature (accesibilidad de terreno) con rangos 15/30/45 min. No se toca ese archivo
//     aquí -- reusarlo para Mercado es responsabilidad de quien conecte esta fase al pipeline,
//     no de este motor.

import type { GeographyContext, MicrozonaResultado, RadioPrincipal, TipoProductoMercado } from './tipos'

// §15 — radios estándar que siempre se generan, independientemente del producto.
export const RADIOS_MERCADO_KM = [0.5, 1, 3, 5]

// §15 — ejemplos textuales del spec convertidos a regla: boutique premium busca cercanía
// hiperlocal (walkability/exclusividad), residencial tolera un radio más amplio (el comprador
// se mueve en coche dentro de la zona), comercial se mide en tiempo de traslado real del
// cliente/empleado, no en distancia en línea recta.
export function radioPrincipalMercado(tipoProducto: TipoProductoMercado): RadioPrincipal {
  switch (tipoProducto) {
    case 'boutique_premium':
      return { tipo: 'distancia', minKm: 0.5, maxKm: 2 }
    case 'residencial':
      return { tipo: 'distancia', minKm: 1, maxKm: 5 }
    case 'comercial':
      return { tipo: 'tiempo_viaje', minMinutos: 5, maxMinutos: 15 }
  }
}

// §17 — ver nota de alcance arriba. Siempre NOT_CONFIDENT hasta que exista Fase 6.
export function detectarMicrozona(): MicrozonaResultado {
  return {
    status: 'MICROZONE_NOT_CONFIDENT',
    motivo: 'No existe todavía un dataset de listings persistente (Fase 6: ingestion + dedup) '
      + 'con densidad suficiente para clustering espacial real — ver lib/market tipos.ts.',
  }
}

export function construirGeographyContext(
  sitio: { ciudad?: string | null; colonia?: string | null },
  tipoProducto: TipoProductoMercado,
): GeographyContext {
  return {
    ciudad: sitio.ciudad ?? null,
    colonia: sitio.colonia ?? null,
    microzona: detectarMicrozona(),
    radiosEstandarKm: RADIOS_MERCADO_KM,
    radioPrincipal: radioPrincipalMercado(tipoProducto),
  }
}
