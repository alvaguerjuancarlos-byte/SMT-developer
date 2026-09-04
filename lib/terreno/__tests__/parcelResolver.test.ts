import { describe, it, expect } from 'vitest'
import { areaM2DesdeAnillo, perimetroMDesdeAnillo, longitudesLadosMDesdeAnillo } from '../parcelResolver'

// latRef=0 (ecuador) hace metrosPorGradoLng === metrosPorGradoLat === 111_320, así que un
// cuadrado de 0.001° por lado da un cuadrado real de 111.32 m por lado — números exactos y
// fáciles de verificar a mano, sin depender de ninguna curvatura de latitud.
const CUADRADO: [number, number][] = [
  [0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001],
]
const LADO_M = 111.32

describe('perimetroMDesdeAnillo', () => {
  it('cuadrado conocido: perímetro = 4 × lado', () => {
    const p = perimetroMDesdeAnillo(CUADRADO, 0)
    expect(p).not.toBeNull()
    expect(p!).toBeCloseTo(4 * LADO_M, 0)
  })

  it('anillo con menos de 3 puntos -> null', () => {
    expect(perimetroMDesdeAnillo([[0, 0], [1, 1]], 0)).toBeNull()
  })

  it('es consistente con areaM2DesdeAnillo sobre el mismo cuadrado (área = lado²)', () => {
    const area = areaM2DesdeAnillo(CUADRADO, 0)
    expect(area!).toBeCloseTo(LADO_M * LADO_M, 0)
  })

  it('anillo explícitamente cerrado (primer punto repetido al final) da el mismo resultado', () => {
    const cerrado = [...CUADRADO, CUADRADO[0]]
    expect(perimetroMDesdeAnillo(cerrado, 0)!).toBeCloseTo(4 * LADO_M, 0)
  })
})

describe('longitudesLadosMDesdeAnillo', () => {
  it('cuadrado conocido: 4 lados, cada uno de la misma longitud, suma = perímetro', () => {
    const lados = longitudesLadosMDesdeAnillo(CUADRADO, 0)
    expect(lados).not.toBeNull()
    expect(lados!.length).toBe(4)
    for (const l of lados!) expect(l).toBeCloseTo(LADO_M, 0)
    expect(lados!.reduce((a, b) => a + b, 0)).toBeCloseTo(perimetroMDesdeAnillo(CUADRADO, 0)!, 6)
  })

  it('anillo explícitamente cerrado no genera un 5º lado fantasma de ~0 m', () => {
    const cerrado = [...CUADRADO, CUADRADO[0]]
    const lados = longitudesLadosMDesdeAnillo(cerrado, 0)
    expect(lados!.length).toBe(4)
  })

  it('anillo con menos de 3 puntos -> null', () => {
    expect(longitudesLadosMDesdeAnillo([[0, 0], [1, 1]], 0)).toBeNull()
  })
})
