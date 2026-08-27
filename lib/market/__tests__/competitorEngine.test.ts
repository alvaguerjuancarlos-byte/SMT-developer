import { describe, it, expect } from 'vitest'
import { construirCompetitorProfiles } from '../competitorEngine'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { ObjetivoComparable } from '../tipos'

function comparable(overrides: Partial<ComparableVenta> = {}): ComparableVenta {
  return {
    nombre: 'Torre Alta', direccion: 'Río Missouri 200', colonia: 'Del Valle',
    precioM2: 40_000, precioTotal: 4_000_000, superficieM2: 100, tipologia: '2 rec · 100 m²',
    avanceObra: 'En obra', fechaReferencia: '2026-06', url: 'https://a.com',
    origen: 'web_search', ...overrides,
  }
}

const objetivo: ObjetivoComparable = { precioM2Objetivo: 40_000, areaM2Objetivo: 100, recamarasObjetivo: 2 }

describe('construirCompetitorProfiles', () => {
  it('agrupa múltiples listados del mismo proyecto en un solo perfil', () => {
    const candidatos = [
      comparable({ nombre: 'Torre Alta', tipologia: '2 rec · 90 m²', precioM2: 40_000 }),
      comparable({ nombre: 'torre alta', tipologia: '3 rec · 120 m²', precioM2: 42_000 }),
      comparable({ nombre: 'TORRE ALTA', tipologia: '2 rec · 92 m²', precioM2: 41_000 }),
    ]
    const perfiles = construirCompetitorProfiles(candidatos)
    expect(perfiles).toHaveLength(1)
    expect(perfiles[0].unidadesObservadas).toBe(3)
    expect(perfiles[0].precioM2?.n).toBe(3)
  })

  it('proyectos distintos generan perfiles separados', () => {
    const candidatos = [
      comparable({ nombre: 'Torre A' }),
      comparable({ nombre: 'Torre B' }),
    ]
    expect(construirCompetitorProfiles(candidatos)).toHaveLength(2)
  })

  it('junta las tipologías y etapas únicas observadas del proyecto', () => {
    const candidatos = [
      comparable({ tipologia: '2 rec · 90 m²', avanceObra: 'Preventa' }),
      comparable({ tipologia: '3 rec · 120 m²', avanceObra: 'En obra' }),
      comparable({ tipologia: '2 rec · 92 m²', avanceObra: 'Preventa' }), // tipología/etapa repetida, no debe duplicarse
    ]
    const perfil = construirCompetitorProfiles(candidatos)[0]
    expect(perfil.tipologias.sort()).toEqual(['2 rec · 90 m²', '2 rec · 92 m²', '3 rec · 120 m²'])
    expect(perfil.etapas.sort()).toEqual(['en_obra', 'preventa'])
  })

  it('sin objetivo, clasificacion queda null', () => {
    const perfil = construirCompetitorProfiles([comparable()])[0]
    expect(perfil.clasificacion).toBeNull()
  })

  it('con objetivo, calcula la clasificación más frecuente entre sus listados', () => {
    const candidatos = [
      comparable({ precioM2: 40_000, distanciaKm: 3 }), // SUBSTITUTE
      comparable({ precioM2: 41_000, distanciaKm: 3 }), // SUBSTITUTE
      comparable({ precioM2: 60_000, distanciaKm: 3 }), // ASPIRATIONAL
    ]
    const perfil = construirCompetitorProfiles(candidatos, objetivo)[0]
    expect(perfil.clasificacion).toBe('SUBSTITUTE')
  })

  it('comparables sin nombre de proyecto no generan un perfil vacío', () => {
    const candidatos = [comparable({ nombre: '' })]
    expect(construirCompetitorProfiles(candidatos)).toHaveLength(0)
  })

  it('arreglo vacío no truena', () => {
    expect(construirCompetitorProfiles([])).toEqual([])
  })
})
