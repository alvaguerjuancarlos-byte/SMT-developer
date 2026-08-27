import { describe, it, expect } from 'vitest'
import { deduplicarComparables } from '../dedupEngine'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'

function comparable(overrides: Partial<ComparableVenta> = {}): ComparableVenta {
  return {
    nombre: 'Torre Alta', direccion: 'Río Missouri 200', colonia: 'Del Valle',
    precioM2: 40_000, precioTotal: 4_000_000, superficieM2: 100, tipologia: '2 rec · 100 m²',
    avanceObra: 'En obra', fechaReferencia: '2026-06', url: 'https://portal-a.com/x',
    origen: 'web_search', lat: null, lng: null, distanciaKm: null,
    ...overrides,
  }
}

describe('deduplicarComparables', () => {
  it('sin duplicados, regresa todos los originales sin descartar nada', () => {
    const candidatos = [
      comparable({ nombre: 'Torre A' }),
      comparable({ nombre: 'Torre B', direccion: 'Otra calle 50' }),
    ]
    const r = deduplicarComparables(candidatos)
    expect(r.originales).toHaveLength(2)
    expect(r.descartados).toHaveLength(0)
  })

  it('detecta duplicado por coordenadas cercanas (<50m)', () => {
    const a = comparable({ nombre: 'Torre A', lat: 25.6500, lng: -100.3900, url: 'https://portal-a.com' })
    const b = comparable({ nombre: 'Nombre Distinto En Otro Portal', lat: 25.65005, lng: -100.39003, url: 'https://portal-b.com' })
    const r = deduplicarComparables([a, b])
    expect(r.originales).toHaveLength(1)
    expect(r.descartados).toHaveLength(1)
    expect(r.descartados[0].motivo).toContain('coordenadas')
  })

  it('NO combina dos inmuebles distintos a más de 50m aunque tengan nombre distinto', () => {
    const a = comparable({ nombre: 'Torre A', lat: 25.6500, lng: -100.3900 })
    const b = comparable({ nombre: 'Torre B', direccion: 'Otra calle', lat: 25.6600, lng: -100.4000 })
    const r = deduplicarComparables([a, b])
    expect(r.originales).toHaveLength(2)
  })

  it('detecta duplicado por mismo nombre de proyecto + misma colonia, sin importar mayúsculas/acentos', () => {
    const a = comparable({ nombre: 'Torre Álta', colonia: 'Del Valle', url: 'https://portal-a.com' })
    const b = comparable({ nombre: 'torre alta', colonia: 'del valle', url: 'https://portal-b.com' })
    const r = deduplicarComparables([a, b])
    expect(r.originales).toHaveLength(1)
    expect(r.descartados[0].motivo).toContain('nombre de proyecto')
  })

  it('mismo nombre pero colonia distinta NO se combina (podrían ser desarrollos distintos con el mismo nombre)', () => {
    // direccion distinta a propósito -- si no, también dispararía la regla de "misma dirección"
    // y no aislaría lo que este test quiere probar (la regla de nombre+colonia por sí sola).
    const a = comparable({ nombre: 'Torre Central', colonia: 'Del Valle', direccion: 'Calle Uno 100' })
    const b = comparable({ nombre: 'Torre Central', colonia: 'San Pedro', direccion: 'Calle Dos 200' })
    const r = deduplicarComparables([a, b])
    expect(r.originales).toHaveLength(2)
  })

  it('detecta duplicado por misma dirección + superficie similar + mismas recámaras', () => {
    const a = comparable({ nombre: 'A', direccion: 'Calle Real 123', superficieM2: 95, tipologia: '2 rec · 95 m²' })
    const b = comparable({ nombre: 'B', direccion: 'Calle Real 123', superficieM2: 96, tipologia: '2 rec · 96 m²' })
    const r = deduplicarComparables([a, b])
    expect(r.originales).toHaveLength(1)
    expect(r.descartados[0].motivo).toContain('dirección')
  })

  it('misma dirección pero superficie muy distinta NO se combina (podrían ser unidades distintas del mismo edificio)', () => {
    const a = comparable({ nombre: 'A', direccion: 'Calle Real 123', superficieM2: 60 })
    const b = comparable({ nombre: 'B', direccion: 'Calle Real 123', superficieM2: 150 })
    const r = deduplicarComparables([a, b])
    expect(r.originales).toHaveLength(2)
  })

  it('conserva el comparable MÁS COMPLETO entre dos duplicados, no el primero visto', () => {
    const incompleto = comparable({ nombre: 'Torre A', colonia: 'Del Valle', precioM2: null, avanceObra: null })
    const completo = comparable({ nombre: 'Torre A', colonia: 'Del Valle', precioM2: 42_000, avanceObra: 'Preventa' })
    const r = deduplicarComparables([incompleto, completo])
    expect(r.originales).toHaveLength(1)
    expect(r.originales[0].precioM2).toBe(42_000)
    expect(r.descartados[0].duplicado).toBe(incompleto)
  })

  it('3 copias del mismo inmueble colapsan a 1 solo original', () => {
    const candidatos = [
      comparable({ nombre: 'Torre A', colonia: 'Del Valle', url: 'https://a.com' }),
      comparable({ nombre: 'torre a', colonia: 'del valle', url: 'https://b.com' }),
      comparable({ nombre: 'TORRE A', colonia: 'DEL VALLE', url: 'https://c.com' }),
    ]
    const r = deduplicarComparables(candidatos)
    expect(r.originales).toHaveLength(1)
    expect(r.descartados).toHaveLength(2)
  })
})
