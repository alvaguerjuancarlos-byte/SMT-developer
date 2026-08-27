import { describe, it, expect } from 'vitest'
import { clasificarEtapa, categorizarInventario } from '../inventoryEngine'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'

function comparable(overrides: Partial<ComparableVenta> = {}): ComparableVenta {
  return {
    nombre: 'X', direccion: 'Y', precioM2: 40_000, precioTotal: 4_000_000, superficieM2: 100,
    tipologia: '2 rec', avanceObra: 'En obra', fechaReferencia: '2026-06',
    url: 'https://example.com', origen: 'web_search', ...overrides,
  }
}

describe('clasificarEtapa', () => {
  it('reconoce los 3 valores exactos que devuelve el LLM', () => {
    expect(clasificarEtapa('Preventa')).toBe('preventa')
    expect(clasificarEtapa('En obra')).toBe('en_obra')
    expect(clasificarEtapa('Entregado')).toBe('entregado')
  })

  it('es insensible a mayúsculas/espacios', () => {
    expect(clasificarEtapa('  PREVENTA  ')).toBe('preventa')
    expect(clasificarEtapa('entregado')).toBe('entregado')
  })

  it('null o un valor inesperado caen en sin_dato, nunca se fuerza a una categoría', () => {
    expect(clasificarEtapa(null)).toBe('sin_dato')
    expect(clasificarEtapa('En construcción')).toBe('sin_dato') // no es el texto exacto esperado
  })
})

describe('categorizarInventario', () => {
  it('agrupa por etapa y cuenta unidades correctamente', () => {
    const comparables = [
      comparable({ avanceObra: 'Preventa' }),
      comparable({ avanceObra: 'Preventa' }),
      comparable({ avanceObra: 'En obra' }),
      comparable({ avanceObra: 'Entregado' }),
      comparable({ avanceObra: null }),
    ]
    const r = categorizarInventario(comparables)
    const preventa = r.find((s) => s.etapa === 'preventa')
    expect(preventa?.unidades).toBe(2)
    expect(r.find((s) => s.etapa === 'en_obra')?.unidades).toBe(1)
    expect(r.find((s) => s.etapa === 'entregado')?.unidades).toBe(1)
    expect(r.find((s) => s.etapa === 'sin_dato')?.unidades).toBe(1)
  })

  it('incluye estadísticas de precio y superficie por etapa', () => {
    const comparables = [
      comparable({ avanceObra: 'Preventa', precioM2: 40_000, superficieM2: 90 }),
      comparable({ avanceObra: 'Preventa', precioM2: 42_000, superficieM2: 95 }),
    ]
    const r = categorizarInventario(comparables)
    const preventa = r.find((s) => s.etapa === 'preventa')!
    expect(preventa.precioM2?.n).toBe(2)
    expect(preventa.superficieM2?.n).toBe(2)
  })

  it('arreglo vacío no truena, devuelve lista vacía', () => {
    expect(categorizarInventario([])).toEqual([])
  })
})
