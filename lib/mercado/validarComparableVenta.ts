// Validación numérica de comparables de venta (departamentos/casas terminadas) extraídos de
// snippets de Google — mismo espíritu que validarComparable en
// app/api/agentes/comparables/route.ts (terreno), pero con rango de precio para vivienda
// TERMINADA, no suelo ($5,000-$150,000/m² vs. $300-$60,000/m² del terreno). Se extrae a lib/
// (a diferencia del original, que vive inline sin tests) para poder testearla de forma aislada.

export interface ComparableVenta {
  nombre: string
  direccion: string
  precioM2: number | null
  precioTotal: number | null
  superficieM2: number | null
  tipologia: string | null
  avanceObra: string | null
  fechaReferencia: string
  url: string
  origen: 'web_search'
  // Ver evaluarPlausibilidadBanda — no bloqueante, solo señala que el precio puede ser de un
  // desarrollo/zona no representativo de la banda de construcción del proyecto.
  sospechosoPorBanda?: boolean
}

const PRECIO_M2_MIN = 5_000
const PRECIO_M2_MAX = 150_000
const TOLERANCIA = 0.20

export function validarComparableVenta(c: ComparableVenta): ComparableVenta | null {
  let precioM2 = c.precioM2
  let precioTotal = c.precioTotal
  const superficieM2 = c.superficieM2

  if (precioM2 && precioTotal && superficieM2 && superficieM2 > 0) {
    const impliedM2 = precioTotal / superficieM2
    const diff = Math.abs(impliedM2 - precioM2) / precioM2
    if (diff > TOLERANCIA) {
      // No cuadran — probar si el modelo invirtió los campos (precioM2 era el total y viceversa).
      const impliedM2Swapped = precioM2 / superficieM2
      const diffSwapped = Math.abs(impliedM2Swapped - precioTotal) / precioTotal
      if (diffSwapped < TOLERANCIA) {
        ;[precioM2, precioTotal] = [precioTotal, precioM2]
      } else {
        return null // inconsistente y no reconciliable — no confiable como comparable
      }
    }
  } else if (precioM2 && !precioTotal && superficieM2 && superficieM2 > 0) {
    precioTotal = Math.round(precioM2 * superficieM2)
  } else if (precioTotal && !precioM2 && superficieM2 && superficieM2 > 0) {
    precioM2 = Math.round(precioTotal / superficieM2)
  }

  if (precioM2 && (precioM2 < PRECIO_M2_MIN || precioM2 > PRECIO_M2_MAX)) {
    return null // fuera de rango plausible para vivienda terminada — probable campo mal clasificado
  }

  if (!precioM2 && !precioTotal) {
    return null // sin ningún precio no sirve como comparable
  }

  return { ...c, precioM2, precioTotal }
}

// El buscador de comparables puede agarrar desarrollos vecinos con nombre parecido pero de un
// segmento distinto (visto en producción: "Rincón de las Huertas" en Santa Catarina, NL —
// $68,674-$132,140/m² encontrados para un proyecto con banda de construcción 2/Media Estándar,
// $12,847/m² — un desface de 6-10x que el usuario confirmó no representativo de su predio real).
// No se rechaza el comparable (podría ser plusvalía real de ubicación, no de banda de acabados —
// ver caso "Cruz de Huanacaxtle": banda 3, precio real ~6x por ubicación frente a playa,
// legítimo) — solo se anota para que el desarrollador, que conoce la zona real, decida.
export interface EvaluacionPlausibilidadBanda {
  techoBandaConstruccion: number
  precioVentaMaxPlausible: number
  sospechosoPorBanda: boolean
}

// Mismos rangos ya usados como texto en los prompts de construccion/financiero/mercado
// route.ts (bandaLabels) — aquí como números para poder compararlos.
const TECHO_BANDA_CONSTRUCCION: Record<string, number> = {
  '1': 10_500, '2': 16_000, '3': 24_000, '4': 45_000,
}

// Multiplicador generoso — solo atrapa desfaces claros (6-10x, como el caso real de arriba),
// no penaliza el spread normal de ubicación/plusvalía sobre banda de acabados.
const MULTIPLICADOR_MAX_VENTA_SOBRE_BANDA = 3

export function evaluarPlausibilidadBanda(
  precioM2: number | null,
  bandaConstruccion: string | undefined,
): EvaluacionPlausibilidadBanda | null {
  if (!precioM2 || !bandaConstruccion) return null
  const techo = TECHO_BANDA_CONSTRUCCION[bandaConstruccion]
  if (!techo) return null
  const precioVentaMaxPlausible = techo * MULTIPLICADOR_MAX_VENTA_SOBRE_BANDA
  return {
    techoBandaConstruccion: techo,
    precioVentaMaxPlausible,
    sospechosoPorBanda: precioM2 > precioVentaMaxPlausible,
  }
}
