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
