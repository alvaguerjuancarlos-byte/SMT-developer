// Catálogo de datos paramétricos del Estimador de Costos SMT Developer
// ESTE ARCHIVO ES DATA EDITABLE — no contiene lógica de cálculo.
// Fuentes: CMIC, Bimsa Reports, Varela, INEGI — validar antes de fijar valores definitivos.

import type { GeneroConstructivo } from './tipos'
import type { Rango } from '@/lib/shared/tipos'

// ── §8 — Catálogo de costos paramétricos (MXN/m², 2026) ─────────────────────
// Nota sobre base de comercio y estacionamiento:
//   • comercio base = $15,000 (ejemplo §11); midpoint aritmético del rango sería $15,500
//   • estacionamiento_sotano base = $10,000 (ejemplo §11); midpoint sería $10,500
//   Los valores base se calibraron contra el ejemplo de referencia §11 para coherencia.
//   Si CMIC/Bimsa actualizan rangos, recalibrar la base aquí.
export const COSTOS_PARAMETRICOS: Record<GeneroConstructivo, Rango> = {
  vivienda_interes_social:    { piso:  9_500, base: 11_000, techo: 12_500 },
  vivienda_residencial_media: { piso: 16_000, base: 19_000, techo: 22_000 },
  vivienda_residencial_lujo:  { piso: 28_000, base: 36_500, techo: 45_000 },
  nave_industrial:             { piso:  7_500, base:  9_250, techo: 11_000 },
  oficinas:                    { piso: 14_000, base: 16_500, techo: 19_000 },
  comercio:                    { piso: 13_000, base: 15_000, techo: 18_000 },
  estacionamiento_sotano:      { piso:  9_000, base: 10_000, techo: 12_000 },
  amenidades_comunes:          { piso: 18_000, base: 20_000, techo: 22_000 },
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
