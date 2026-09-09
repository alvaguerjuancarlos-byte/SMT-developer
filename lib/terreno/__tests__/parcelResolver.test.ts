import { describe, it, expect } from 'vitest'
import { areaM2DesdeAnillo, perimetroMDesdeAnillo, longitudesLadosMDesdeAnillo, verticesLocalesDesdeAnillo, simplificarVerticesColineales, longitudesLadosDesdeVertices, aLocalXY, recortarSegmentosCercanos, type VerticeLocal } from '../parcelResolver'

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

describe('verticesLocalesDesdeAnillo', () => {
  it('cuadrado conocido: origen en el primer vértice, "arriba" es norte (y crece con lat)', () => {
    const vertices = verticesLocalesDesdeAnillo(CUADRADO, 0)
    expect(vertices).not.toBeNull()
    expect(vertices).toHaveLength(4)
    expect(vertices![0]).toEqual({ x: 0, y: 0 }) // origen = primer vértice del anillo
    expect(vertices![1].x).toBeCloseTo(LADO_M, 0) // segundo punto: mismo lat, +1 lado en lng (este)
    expect(vertices![1].y).toBeCloseTo(0, 0)
    expect(vertices![3].y).toBeCloseTo(LADO_M, 0) // cuarto punto: mismo lng, +1 lado en lat (norte)
  })

  it('el polígono reconstruido de los vértices tiene el mismo perímetro que perimetroMDesdeAnillo', () => {
    const vertices = verticesLocalesDesdeAnillo(CUADRADO, 0)!
    let perimetro = 0
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length]
      perimetro += Math.hypot(b.x - a.x, b.y - a.y)
    }
    expect(perimetro).toBeCloseTo(perimetroMDesdeAnillo(CUADRADO, 0)!, 6)
  })

  it('anillo explícitamente cerrado no genera un 5º vértice duplicado', () => {
    const cerrado = [...CUADRADO, CUADRADO[0]]
    expect(verticesLocalesDesdeAnillo(cerrado, 0)).toHaveLength(4)
  })

  it('anillo con menos de 3 puntos -> null', () => {
    expect(verticesLocalesDesdeAnillo([[0, 0], [1, 1]], 0)).toBeNull()
  })
})

describe('simplificarVerticesColineales', () => {
  const CUADRADO_LOCAL: VerticeLocal[] = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
  ]

  it('elimina un vértice exactamente colineal en medio de un lado (ángulo 180°)', () => {
    // (5,0) cae justo a la mitad del lado (0,0)-(10,0) -- no es una 5ª esquina, es el mismo lado
    // partido en dos, igual que el vértice a 179.8° encontrado en un predio real de San Pedro.
    const conColineal: VerticeLocal[] = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    const simplificado = simplificarVerticesColineales(conColineal)
    expect(simplificado).toEqual(CUADRADO_LOCAL)
  })

  it('conserva una esquina real aunque el lado sea corto (ángulo lejos de 180°)', () => {
    // Notch real: una 5ª esquina genuina con ángulo marcado (~90°), como el jog real encontrado
    // en un predio de San Pedro (ángulos 81°/82° en lados de 1.7-2.6 m) -- no debe confundirse
    // con ruido de digitalización solo por tener un lado corto.
    const conNotchReal: VerticeLocal[] = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 10 }, { x: 0, y: 10 },
    ]
    const simplificado = simplificarVerticesColineales(conNotchReal)
    expect(simplificado).toHaveLength(6) // ninguna esquina real se pierde
  })

  it('reduce una curva digitalizada como muchos micro-segmentos casi rectos a sus esquinas reales', () => {
    // Imita el caso real de 244 vértices (frente a calle curva, ~179° y lados de 0.20 m): una
    // "curva" de 5 puntos casi colineales entre dos esquinas reales de 90°.
    const curvaDigitalizada: VerticeLocal[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10.2, y: 0.05 }, { x: 10.4, y: 0.1 }, { x: 10.6, y: 0.15 }, { x: 10.8, y: 0.2 }, // "curva" ~recta
      { x: 11, y: 0.25 },
      { x: 11, y: 10 },
      { x: 0, y: 10 },
    ]
    const simplificado = simplificarVerticesColineales(curvaDigitalizada)
    expect(simplificado.length).toBeLessThan(curvaDigitalizada.length)
    expect(simplificado.length).toBeGreaterThanOrEqual(3)
  })

  it('polígono de 3 vértices se regresa sin tocar (no hay colinealidad posible en un triángulo real)', () => {
    const triangulo: VerticeLocal[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]
    expect(simplificarVerticesColineales(triangulo)).toEqual(triangulo)
  })
})

describe('longitudesLadosDesdeVertices', () => {
  it('cuadrado conocido en metros locales: 4 lados iguales', () => {
    const cuadrado: VerticeLocal[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    const lados = longitudesLadosDesdeVertices(cuadrado)
    expect(lados).toHaveLength(4)
    for (const l of lados) expect(l).toBeCloseTo(10, 6)
  })
})

describe('aLocalXY', () => {
  it('el origen mismo da (0,0)', () => {
    expect(aLocalXY(-100.4, 25.65, -100.4, 25.65, 25.65)).toEqual({ x: 0, y: 0 })
  })

  it('es consistente con verticesLocalesDesdeAnillo sobre el mismo anillo (mismo origen y latRef)', () => {
    const anillo: [number, number][] = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]]
    const viaAnillo = verticesLocalesDesdeAnillo(anillo, 0)!
    const viaPunto = anillo.map(([lng, lat]) => aLocalXY(lng, lat, anillo[0][0], anillo[0][1], 0))
    expect(viaPunto).toEqual(viaAnillo)
  })
})

describe('recortarSegmentosCercanos', () => {
  const referencias: VerticeLocal[] = [{ x: 0, y: 0 }]

  it('conserva completa una línea que ya está toda dentro del radio', () => {
    const linea: VerticeLocal[] = [{ x: 0, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 0 }]
    expect(recortarSegmentosCercanos([linea], referencias, 20)).toEqual([linea])
  })

  it('descarta por completo una línea que cae totalmente fuera del radio', () => {
    const linea: VerticeLocal[] = [{ x: 100, y: 100 }, { x: 110, y: 100 }]
    expect(recortarSegmentosCercanos([linea], referencias, 20)).toEqual([])
  })

  it('corta una línea larga al tramo contiguo que cae dentro del radio', () => {
    // Simula el caso real: una banqueta de +200 m donde solo una parte pasa cerca del predio.
    const linea: VerticeLocal[] = [
      { x: -200, y: 0 }, { x: -100, y: 0 }, { x: -10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 100, y: 0 },
    ]
    const recortado = recortarSegmentosCercanos([linea], referencias, 15)
    expect(recortado).toEqual([[{ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }]])
  })

  it('un solo punto dentro del radio no forma una línea dibujable -- se descarta', () => {
    const linea: VerticeLocal[] = [{ x: 100, y: 100 }, { x: 5, y: 0 }, { x: 100, y: 100 }]
    expect(recortarSegmentosCercanos([linea], referencias, 15)).toEqual([])
  })

  it('usa la referencia más cercana entre varias -- un lote con fondo cuyo centroide queda lejos de la banqueta del frente', () => {
    // Simula un lote angosto y profundo: frente en x=0 (banqueta ahí cerca), fondo en x=-40.
    // El centroide (x=-20) quedaría a 20 m de la banqueta -- dentro de un radio chico igual,
    // pero con un radio de 15 (como el resto de estos tests) un solo centroide la perdería.
    const verticesLote: VerticeLocal[] = [{ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 2, y: -40 }, { x: -2, y: -40 }]
    const banqueta: VerticeLocal[] = [{ x: -10, y: 3 }, { x: 0, y: 3 }, { x: 10, y: 3 }]
    expect(recortarSegmentosCercanos([banqueta], verticesLote, 15)).toEqual([banqueta])
  })
})
