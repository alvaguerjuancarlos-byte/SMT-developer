import { describe, it, expect } from 'vitest'
import { calcularVentanaSHF, calcularApreciacionSHF, calcularBetaSHF, serieSHFParaCiudad } from '../shfAppreciationEngine'
import { SHF_NACIONAL_ECONOMICA_SOCIAL, SHF_NACIONAL_MEDIA_RESIDENCIAL, type PuntoIndiceSHF } from '../shfIndice.data'

// Serie sintética simple: índice se duplica en exactamente 4 trimestres (1 año) -> 100% anual,
// números redondos y fáciles de verificar a mano.
const SERIE_DUPLICA_EN_UN_ANIO: PuntoIndiceSHF[] = [
  { anio: 2020, trimestre: 1, indice: 100 },
  { anio: 2020, trimestre: 2, indice: 130 },
  { anio: 2020, trimestre: 3, indice: 160 },
  { anio: 2020, trimestre: 4, indice: 180 },
  { anio: 2021, trimestre: 1, indice: 200 },
]

describe('calcularVentanaSHF', () => {
  it('"mensual" siempre sale null -- el SHF es trimestral, no tiene ventana mensual real', () => {
    const r = calcularVentanaSHF(SERIE_DUPLICA_EN_UN_ANIO, 'mensual')
    expect(r.tasaAnualizada).toBeNull()
    expect(r.motivo).toMatch(/trimestral/i)
  })

  it('ventana "anual" sobre una serie que duplica en 4 trimestres da ~100% anualizado', () => {
    const r = calcularVentanaSHF(SERIE_DUPLICA_EN_UN_ANIO, 'anual')
    expect(r.tasaAnualizada).toBeCloseTo(100, 0)
    expect(r.periodoInicio).toBe('2020-01')
    expect(r.periodoFin).toBe('2021-01')
  })

  it('ventana "trimestral" usa los dos últimos trimestres reales, anualizado por composición', () => {
    const r = calcularVentanaSHF(SERIE_DUPLICA_EN_UN_ANIO, 'trimestral')
    // (200/180)^4 - 1, en %
    const esperado = (Math.pow(200 / 180, 4) - 1) * 100
    expect(r.tasaAnualizada).toBeCloseTo(Math.round(esperado * 10) / 10, 1)
  })

  it('sin suficiente historial para la ventana pedida -> null con motivo explícito', () => {
    const r = calcularVentanaSHF(SERIE_DUPLICA_EN_UN_ANIO, '10_anios')
    expect(r.tasaAnualizada).toBeNull()
    expect(r.motivo).toMatch(/empieza en/i)
  })

  it('menos de 2 puntos -> null', () => {
    const r = calcularVentanaSHF([{ anio: 2020, trimestre: 1, indice: 100 }], 'anual')
    expect(r.tasaAnualizada).toBeNull()
  })
})

describe('calcularApreciacionSHF', () => {
  it('devuelve las 6 ventanas', () => {
    const r = calcularApreciacionSHF(SERIE_DUPLICA_EN_UN_ANIO)
    expect(r).toHaveLength(6)
    expect(r.map(v => v.ventana)).toEqual(['mensual', 'trimestral', 'anual', '3_anios', '5_anios', '10_anios'])
  })
})

describe('calcularBetaSHF', () => {
  it('con una serie alta que es exactamente 0.5x la variación de la baja, el beta sale ~0.5', () => {
    const baja: PuntoIndiceSHF[] = [
      { anio: 2020, trimestre: 1, indice: 100 },
      { anio: 2020, trimestre: 2, indice: 110 }, // +10%
      { anio: 2020, trimestre: 3, indice: 99 },  // -10%
      { anio: 2020, trimestre: 4, indice: 108.9 }, // +10%
    ]
    const alta: PuntoIndiceSHF[] = [
      { anio: 2020, trimestre: 1, indice: 100 },
      { anio: 2020, trimestre: 2, indice: 105 },  // +5% (0.5x de +10%)
      { anio: 2020, trimestre: 3, indice: 99.75 }, // -5% (0.5x de -10%)
      { anio: 2020, trimestre: 4, indice: 104.74 }, // +5%
    ]
    const r = calcularBetaSHF(baja, alta)
    expect(r.beta).toBeCloseTo(0.5, 1)
    expect(r.n).toBe(3)
  })

  it('con los datos reales embebidos, el beta cae en el rango real verificado (~1.04, banda alta amplifica)', () => {
    const r = calcularBetaSHF(SHF_NACIONAL_ECONOMICA_SOCIAL, SHF_NACIONAL_MEDIA_RESIDENCIAL)
    expect(r.beta).toBeGreaterThan(0.9)
    expect(r.beta).toBeLessThan(1.2)
    expect(r.min).toBeLessThan(r.beta)
    expect(r.max).toBeGreaterThan(r.beta)
    expect(r.n).toBe(85)
  })
})

describe('serieSHFParaCiudad', () => {
  it('resuelve San Pedro Garza García (con y sin acento) a ZM Monterrey', () => {
    expect(serieSHFParaCiudad('San Pedro Garza García')?.nombre).toBe('ZM Monterrey (índice SHF)')
    expect(serieSHFParaCiudad('san pedro garza garcia')?.nombre).toBe('ZM Monterrey (índice SHF)')
  })

  it('ciudad sin mapeo -> null, nunca un fallback inventado', () => {
    expect(serieSHFParaCiudad('Guadalajara')).toBeNull()
    expect(serieSHFParaCiudad(null)).toBeNull()
    expect(serieSHFParaCiudad(undefined)).toBeNull()
  })
})
