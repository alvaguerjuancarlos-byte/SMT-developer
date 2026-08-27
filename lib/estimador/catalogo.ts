// Catálogo de datos paramétricos del Estimador de Costos SMT Developer
// ESTE ARCHIVO ES DATA EDITABLE — no contiene lógica de cálculo.
// Fuentes: CMIC, Bimsa Reports, Varela, INEGI — validar antes de fijar valores definitivos.

import type { GeneroConstructivo } from './tipos'
import type { Rango } from '@/lib/shared/tipos'

// ── §8 — Catálogo de costos paramétricos (MXN/m²) ────────────────────────────
// Validado 2026-08-26 contra referencias de mercado agregadas (CEICO-CMIC,
// BIMSA-CMIC) obtenidas por búsqueda web — NO contra el PDF primario de CMIC/
// Bimsa/Varela (el libro de Varela existe y es fuente real, pero su vista
// previa gratuita solo cubre ejemplos de escala chica — casa de 36m², bodega
// de 1,024m², local de 18m² — no la escala de torre/edificio que necesitamos
// aquí; sus páginas de edificio de oficinas/depto de 14-18 niveles/centro
// comercial son de pago, no se consultaron). Tratar como más confiable que
// los valores originales (que eran estimados sin fuente real, calibrados
// solo contra un ejemplo interno de los tests), pero seguir sin ser el
// benchmark definitivo. estacionamiento_sotano y amenidades_comunes NO se
// encontró referencia de mercado confiable — quedaron sin tocar.
export const COSTOS_PARAMETRICOS: Record<GeneroConstructivo, Rango> = {
  vivienda_interes_social:    { piso:  9_500, base: 11_000, techo: 12_500 }, // sin cambio — ya alineado (CEICO-CMIC ~$10,692)
  vivienda_residencial_media: { piso: 12_000, base: 14_000, techo: 16_000 }, // antes 16k/19k/22k — mercado da $12,000-$16,000
  vivienda_residencial_lujo:  { piso: 23_000, base: 31_500, techo: 40_000 }, // antes 28k/36.5k/45k — mercado: "supera $23,000", techo general ~$40,000
  nave_industrial:             { piso:  9_000, base: 10_642, techo: 12_500 }, // antes 7.5k/9.25k/11k — CEICO-CMIC ~$10,642 (caía cerca de nuestro techo viejo, no de la base)
  oficinas:                    { piso: 10_500, base: 12_750, techo: 15_000 }, // antes 14k/16.5k/19k — BIMSA-CMIC media $11,731 / alta $13,802 (nuestro piso viejo ya superaba su "alta")
  comercio:                    { piso: 18_000, base: 24_000, techo: 32_000 }, // antes 13k/15k/18k — CDMX promedio $28,000 (rango $18k-$55k); techo viejo apenas tocaba el piso real
  estacionamiento_sotano:      { piso:  9_000, base: 10_000, techo: 12_000 }, // SIN CAMBIO — no se encontró referencia de mercado confiable
  amenidades_comunes:          { piso: 18_000, base: 20_000, techo: 22_000 }, // SIN CAMBIO — no se encontró referencia de mercado confiable
}

// ── §5 Capa 3 — Factores de eficiencia [min, max] (área útil ÷ área bruta) ──
// 0,0 = uso no vendible (estacionamiento, amenidades)
// Motor usa el punto medio como valor base; piso y techo propagan el rango si se necesita.
export const FACTORES_EFICIENCIA: Record<GeneroConstructivo, [number, number]> = {
  vivienda_interes_social:    [0.80, 0.85],
  vivienda_residencial_media: [0.80, 0.85],
  vivienda_residencial_lujo:  [0.80, 0.85],
  nave_industrial:             [0.85, 0.92],
  oficinas:                    [0.82, 0.88],
  comercio:                    [0.85, 0.90],
  estacionamiento_sotano:      [0,    0   ],
  amenidades_comunes:          [0,    0   ],
}

// ── §5 Capa 5 — Factores de indirectos y costos blandos ──────────────────────
// Honorarios, supervisión, permisos, derechos, contingencia — factor sobre el costo directo.
export const FACTORES_INDIRECTOS: Rango = {
  piso:  1.20,  // +20%
  base:  1.28,  // +28%
  techo: 1.35,  // +35%
}

// ── §6 — Ratios de referencia para derivación de estacionamiento (fallback) ──
// Zona Metropolitana de Monterrey — usar solo cuando el Agente Legal no entrega la norma.
// Si se usan, quedan registrados en supuestos[].
export const RATIOS_CAJONES_REFERENCIA = {
  vivienda: {
    metrica:            'por_unidad' as const,
    ratio:              1.5,          // cajones/unidad (base conservadora)
    ratioMin:           1.5,
    ratioMax:           2.0,
    m2PorUnidadDefault: 80,           // m² típicos/departamento para derivar unidades si no se proveen
  },
  oficinas: {
    metrica:   'por_m2_rentable' as const,
    ratio:     1 / 35,   // 1 cajón / 35 m² rentable (base)
    ratioMin:  1 / 40,
    ratioMax:  1 / 30,
  },
  comercio: {
    metrica:   'por_m2_rentable' as const,
    ratio:     1 / 35,   // 1 cajón / 35 m² rentable (base)
    ratioMin:  1 / 40,
    ratioMax:  1 / 25,
  },
  visitas: {
    fraccion:    0.10,   // 10% sobre subtotal (base conservadora)
    fraccionMin: 0.05,
    fraccionMax: 0.10,
  },
  areaPorCajon: {
    base: 30,  // m² efectivos (rampas + pasillos + maniobras) — conservador, no usar 12.5 (cajón físico)
    min:  25,
    max:  30,
  },
}
