import { describe, it, expect } from 'vitest'
import { calcular } from '../motor'
import type { InputsNormativos, InputsProyecto } from '../tipos'

// Mismo predio de referencia §11: COS 0.65 · CUS 5.0 → construibleMax = 10,000 m²
const normativos: InputsNormativos = { sTerreno: 2_000, cos: 0.65, cus: 5.0, cas: 0.15 }

describe('cumple / excesoPct — programa exactamente en el límite', () => {
  it('Σ m²Bruto = construibleMax (10,000) → cumple, sin excesoPct', () => {
    const proyecto: InputsProyecto = {
      usos: [
        { genero: 'comercio', m2Bruto: 1_200 },
        { genero: 'oficinas', m2Bruto: 2_300 },
        { genero: 'vivienda_residencial_media', m2Bruto: 6_000, unidades: 75 },
        { genero: 'amenidades_comunes', m2Bruto: 500 },
      ],
    }
    const r = calcular(normativos, proyecto)
    expect(r.envolvente.cumple).toBe(true)
    expect(r.envolvente.excesoPct).toBeUndefined()
  })
})

describe('cumple / excesoPct — programa que excede CUS', () => {
  it('Σ m²Bruto = 12,000 sobre construibleMax 10,000 → no cumple, excesoPct = 20%', () => {
    const proyecto: InputsProyecto = {
      usos: [{ genero: 'vivienda_residencial_media', m2Bruto: 12_000, unidades: 100 }],
    }
    const r = calcular(normativos, proyecto)
    expect(r.envolvente.cumple).toBe(false)
    expect(r.envolvente.excesoPct).toBeCloseTo(20, 4)
  })
})

describe('cumple / excesoPct — programa por debajo del límite', () => {
  it('Σ m²Bruto = 5,000 bajo construibleMax 10,000 → cumple', () => {
    const proyecto: InputsProyecto = {
      usos: [{ genero: 'vivienda_residencial_media', m2Bruto: 5_000, unidades: 60 }],
    }
    const r = calcular(normativos, proyecto)
    expect(r.envolvente.cumple).toBe(true)
    expect(r.envolvente.excesoPct).toBeUndefined()
  })
})

describe('cumple / excesoPct — densidad limita antes que CUS', () => {
  it('unidades exceden unidadesMax aunque el m² esté dentro de CUS → no cumple por densidad', () => {
    const normativosConDensidad: InputsNormativos = { ...normativos, densidad: 100 } // unidadesMax = (2000/10000)*100 = 20
    const proyecto: InputsProyecto = {
      // 1,000 m² (muy por debajo de construibleMax 10,000) pero 40 unidades explícitas > unidadesMax (20)
      usos: [{ genero: 'vivienda_residencial_media', m2Bruto: 1_000, unidades: 40 }],
    }
    const r = calcular(normativosConDensidad, proyecto)
    expect(r.envolvente.cumple).toBe(false)
    expect(r.envolvente.excesoPct).toBeCloseTo(100, 4) // 40 unidades vs 20 máx = +100%
  })
})
