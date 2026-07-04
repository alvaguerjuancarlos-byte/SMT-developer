import { describe, it, expect } from 'vitest'
import { construirInputsNormativos, parseCos, parseCus, programaAUsos, type ProgramaUnidades } from '../programaAdapter'

describe('parseCos', () => {
  it('convierte "60%" a 0.6', () => expect(parseCos('60%')).toBeCloseTo(0.6, 6))
  it('convierte "0.6" a 0.6 (ya en fracción)', () => expect(parseCos('0.6')).toBeCloseTo(0.6, 6))
  it('undefined devuelve 0', () => expect(parseCos(undefined)).toBe(0))
})

describe('parseCus', () => {
  it('convierte "2.4" a 2.4', () => expect(parseCus('2.4')).toBeCloseTo(2.4, 6))
  it('convierte "2,4" (coma decimal) a 2.4', () => expect(parseCus('2,4')).toBeCloseTo(2.4, 6))
})

describe('construirInputsNormativos', () => {
  it('usa CAS_DEFAULT cuando no se especifica', () => {
    const n = construirInputsNormativos(2000, '60%', '2.4')
    expect(n).toEqual({ sTerreno: 2000, cos: 0.6, cus: 2.4, cas: 0.15 })
  })
})

describe('programaAUsos — habitacional', () => {
  it('60 unidades: 50% 1rec (55m²), 30% 2rec (75m²), 20% 3rec (100m²)', () => {
    const programa: ProgramaUnidades = {
      habitacional: {
        genero: 'vivienda_residencial_media',
        totalUnidades: 60,
        mix: [
          { label: '1 recámara', pct: 50, m2Promedio: 55 },
          { label: '2 recámaras', pct: 30, m2Promedio: 75 },
          { label: '3 recámaras', pct: 20, m2Promedio: 100 },
        ],
      },
    }
    const usos = programaAUsos(programa)
    expect(usos).toHaveLength(1)
    expect(usos[0].genero).toBe('vivienda_residencial_media')
    expect(usos[0].unidades).toBe(60)
    // 60*0.5*55 + 60*0.3*75 + 60*0.2*100 = 1650 + 1350 + 1200 = 4200
    expect(usos[0].m2Bruto).toBeCloseTo(4200, 4)
  })
})

describe('programaAUsos — mixto habitacional + comercial', () => {
  it('2 niveles x 6 locales, mix 30% 70m² / 40% 90m² / 30% 120m²', () => {
    const programa: ProgramaUnidades = {
      habitacional: {
        genero: 'vivienda_residencial_media',
        totalUnidades: 60,
        mix: [{ label: '1 recámara', pct: 100, m2Promedio: 65 }],
      },
      comercial: {
        niveles: 2,
        localesPorNivel: 6,
        mix: [
          { label: 'Local 70 m²', pct: 30, m2Promedio: 70 },
          { label: 'Local 90 m²', pct: 40, m2Promedio: 90 },
          { label: 'Local 120 m²', pct: 30, m2Promedio: 120 },
        ],
      },
    }
    const usos = programaAUsos(programa)
    expect(usos).toHaveLength(2)
    const comercial = usos.find(u => u.genero === 'comercio')
    expect(comercial).toBeDefined()
    // 12 locales totales: 12*0.3*70 + 12*0.4*90 + 12*0.3*120 = 252 + 432 + 432 = 1116
    expect(comercial!.m2Bruto).toBeCloseTo(1116, 4)
    expect(comercial!.unidades).toBeUndefined()
  })

  it('sin bloque comercial, solo devuelve el uso habitacional', () => {
    const programa: ProgramaUnidades = {
      habitacional: {
        genero: 'vivienda_interes_social',
        totalUnidades: 20,
        mix: [{ label: 'Único', pct: 100, m2Promedio: 45 }],
      },
    }
    expect(programaAUsos(programa)).toHaveLength(1)
  })
})

describe('programaAUsos — amenidadesM2', () => {
  it('agrega un uso "amenidades_comunes" cuando amenidadesM2 > 0', () => {
    const programa: ProgramaUnidades = {
      habitacional: {
        genero: 'vivienda_residencial_media',
        totalUnidades: 20,
        mix: [{ label: 'Único', pct: 100, m2Promedio: 65 }],
      },
      amenidadesM2: 150,
    }
    const usos = programaAUsos(programa)
    expect(usos).toHaveLength(2)
    const amenidades = usos.find(u => u.genero === 'amenidades_comunes')
    expect(amenidades).toBeDefined()
    expect(amenidades!.m2Bruto).toBe(150)
  })

  it('sin amenidadesM2 (o 0), no agrega el uso', () => {
    const programa: ProgramaUnidades = {
      habitacional: {
        genero: 'vivienda_residencial_media',
        totalUnidades: 20,
        mix: [{ label: 'Único', pct: 100, m2Promedio: 65 }],
      },
      amenidadesM2: 0,
    }
    expect(programaAUsos(programa)).toHaveLength(1)
  })
})
