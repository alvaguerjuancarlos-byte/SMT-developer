import { describe, it, expect } from 'vitest'
import {
  rumboAAzimut, construirVertices, calcularErrorCierre, cerrarPoligono,
  calcularAreaM2, calcularLongitudesLados, calcularAzimutsLados, validarPoligono,
  clasificarPendiente, puntoDentroDePoligono, type Lado,
} from '../geometryEngine'

// Rectángulo 40 x 25 m recorrido en sentido horario desde el origen: Este, Sur, Oeste, Norte.
// Cierra exacto (perímetro cuadrado, sin error de medición).
const rectangulo: Lado[] = [
  { rumbo: { cuadrante: 'NE', grados: 90 }, distancia: 40 }, // Este
  { rumbo: { cuadrante: 'SE', grados: 0 }, distancia: 25 },  // Sur
  { rumbo: { cuadrante: 'SO', grados: 90 }, distancia: 40 }, // Oeste
  { rumbo: { cuadrante: 'NO', grados: 0 }, distancia: 25 },  // Norte
]

describe('rumboAAzimut', () => {
  it('convierte los 4 cuadrantes a azimut 0-360 medido desde el Norte', () => {
    expect(rumboAAzimut({ cuadrante: 'NE', grados: 90 })).toBe(90)   // Este
    expect(rumboAAzimut({ cuadrante: 'SE', grados: 0 })).toBe(180)   // Sur
    expect(rumboAAzimut({ cuadrante: 'SO', grados: 90 })).toBe(270)  // Oeste
    expect(rumboAAzimut({ cuadrante: 'NO', grados: 0 })).toBe(360)   // Norte (=0)
  })
})

describe('construirVertices / calcularAreaM2 / calcularLongitudesLados', () => {
  it('un rectángulo 40x25 cierra exacto y da área 1000 m²', () => {
    const vertices = construirVertices(rectangulo)
    expect(vertices).toHaveLength(5) // origen + 4 lados
    const ultimo = vertices[vertices.length - 1]
    expect(ultimo.x).toBeCloseTo(0, 6)
    expect(ultimo.y).toBeCloseTo(0, 6)
    expect(calcularAreaM2(vertices)).toBeCloseTo(1000, 6)
  })

  it('las longitudes de lado recalculadas coinciden con las distancias declaradas', () => {
    const vertices = construirVertices(rectangulo)
    expect(calcularLongitudesLados(vertices)).toEqual([40, 25, 40, 25].map(n => expect.closeTo(n, 6)))
  })

  it('los azimuts recalculados coinciden con los rumbos declarados', () => {
    const vertices = construirVertices(rectangulo)
    const azimuts = calcularAzimutsLados(vertices)
    // El 4º lado (rumbo 0°/Norte) puede caer del lado 359.999... por ruido de punto flotante
    // al cruzar el límite 0/360 — se compara la distancia angular más corta a 0, no el valor crudo.
    const distanciaA0 = (az: number) => Math.min(Math.abs(az - 0), Math.abs(az - 360))
    expect(azimuts[0]).toBeCloseTo(90, 6)
    expect(azimuts[1]).toBeCloseTo(180, 6)
    expect(azimuts[2]).toBeCloseTo(270, 6)
    expect(distanciaA0(azimuts[3])).toBeLessThan(1e-6)
  })
})

describe('calcularErrorCierre', () => {
  it('polígono perfecto: error 0, cerrado', () => {
    const r = calcularErrorCierre(construirVertices(rectangulo))
    expect(r.errorCierreM).toBeCloseTo(0, 6)
    expect(r.cerrado).toBe(true)
  })

  it('polígono con error de medición mayor a la tolerancia: no cerrado', () => {
    const conError: Lado[] = [...rectangulo.slice(0, 3), { rumbo: { cuadrante: 'NO', grados: 0 }, distancia: 24 }]
    const r = calcularErrorCierre(construirVertices(conError))
    expect(r.errorCierreM).toBeCloseTo(1, 6)
    expect(r.cerrado).toBe(false)
  })
})

describe('cerrarPoligono — ajuste por regla de la brújula (Bowditch)', () => {
  it('distribuye el error de cierre y el polígono ajustado cierra exacto', () => {
    const conError: Lado[] = [...rectangulo.slice(0, 3), { rumbo: { cuadrante: 'NO', grados: 0 }, distancia: 24 }]
    const ajustados = cerrarPoligono(conError)
    const ultimo = ajustados[ajustados.length - 1]
    expect(ultimo.x).toBeCloseTo(0, 6)
    expect(ultimo.y).toBeCloseTo(0, 6)
  })

  it('un polígono ya cerrado no se modifica (más allá de ruido de punto flotante)', () => {
    const ajustados = cerrarPoligono(rectangulo)
    const vertices = construirVertices(rectangulo)
    ajustados.forEach((v, i) => {
      expect(v.x).toBeCloseTo(vertices[i].x, 9)
      expect(v.y).toBeCloseTo(vertices[i].y, 9)
    })
  })
})

describe('validarPoligono — orquestador', () => {
  it('devuelve área, perímetro, lados, azimuts y cierre juntos', () => {
    const r = validarPoligono(rectangulo)
    expect(r.areaM2).toBeCloseTo(1000, 6)
    expect(r.perimetroM).toBeCloseTo(130, 6)
    expect(r.longitudesLadosM).toHaveLength(4)
    expect(r.azimutsLadosGrados).toHaveLength(4)
    expect(r.cierre.cerrado).toBe(true)
  })
})

describe('clasificarPendiente', () => {
  it('respeta las bandas del documento: PLANO<5%, SUAVE 5-10%, MODERADA 10-20%, PRONUNCIADA>20%', () => {
    expect(clasificarPendiente(4.9)).toBe('PLANO')
    expect(clasificarPendiente(5)).toBe('SUAVE')
    expect(clasificarPendiente(9.9)).toBe('SUAVE')
    expect(clasificarPendiente(10)).toBe('MODERADA')
    expect(clasificarPendiente(19.9)).toBe('MODERADA')
    expect(clasificarPendiente(20)).toBe('PRONUNCIADA')
  })
})

describe('puntoDentroDePoligono', () => {
  const cuadrado: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]

  it('un punto claramente adentro da true', () => {
    expect(puntoDentroDePoligono([5, 5], cuadrado)).toBe(true)
  })

  it('un punto claramente afuera da false', () => {
    expect(puntoDentroDePoligono([15, 5], cuadrado)).toBe(false)
    expect(puntoDentroDePoligono([5, -5], cuadrado)).toBe(false)
  })

  it('funciona igual con coordenadas [lng, lat] típicas de GeoJSON', () => {
    // Un "cuadrado" alrededor de un punto en San Pedro Garza García.
    const anillo: [number, number][] = [
      [-100.383, 25.648], [-100.382, 25.648], [-100.382, 25.649], [-100.383, 25.649],
    ]
    expect(puntoDentroDePoligono([-100.3825, 25.6485], anillo)).toBe(true)
    expect(puntoDentroDePoligono([-100.390, 25.6485], anillo)).toBe(false)
  })
})
