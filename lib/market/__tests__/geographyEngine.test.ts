import { describe, it, expect } from 'vitest'
import { RADIOS_MERCADO_KM, radioPrincipalMercado, detectarMicrozona, construirGeographyContext } from '../geographyEngine'

describe('RADIOS_MERCADO_KM', () => {
  it('genera los 4 radios estándar del spec (500m/1km/3km/5km)', () => {
    expect(RADIOS_MERCADO_KM).toEqual([0.5, 1, 3, 5])
  })
})

describe('radioPrincipalMercado', () => {
  it('boutique_premium usa distancia 0.5-2km', () => {
    expect(radioPrincipalMercado('boutique_premium')).toEqual({ tipo: 'distancia', minKm: 0.5, maxKm: 2 })
  })

  it('residencial usa distancia 1-5km', () => {
    expect(radioPrincipalMercado('residencial')).toEqual({ tipo: 'distancia', minKm: 1, maxKm: 5 })
  })

  it('comercial usa tiempo de viaje 5-15 min, no distancia', () => {
    const r = radioPrincipalMercado('comercial')
    expect(r.tipo).toBe('tiempo_viaje')
    expect(r.minMinutos).toBe(5)
    expect(r.maxMinutos).toBe(15)
    expect(r.minKm).toBeUndefined()
  })
})

describe('detectarMicrozona', () => {
  it('siempre NOT_CONFIDENT hoy — no hay dataset de listings persistente para clustering real', () => {
    const m = detectarMicrozona()
    expect(m.status).toBe('MICROZONE_NOT_CONFIDENT')
    expect(m.motivo.length).toBeGreaterThan(0)
  })
})

describe('construirGeographyContext', () => {
  it('pasa ciudad/colonia del sitio tal cual, sin inventar', () => {
    const ctx = construirGeographyContext({ ciudad: 'San Pedro Garza García', colonia: 'Valle Oriente' }, 'residencial')
    expect(ctx.ciudad).toBe('San Pedro Garza García')
    expect(ctx.colonia).toBe('Valle Oriente')
  })

  it('ciudad/colonia ausentes quedan null, no un string vacío ni un supuesto', () => {
    const ctx = construirGeographyContext({}, 'residencial')
    expect(ctx.ciudad).toBeNull()
    expect(ctx.colonia).toBeNull()
  })

  it('incluye radiosEstandarKm y el radioPrincipal correcto para el tipo de producto', () => {
    const ctx = construirGeographyContext({ colonia: 'Centro' }, 'comercial')
    expect(ctx.radiosEstandarKm).toEqual(RADIOS_MERCADO_KM)
    expect(ctx.radioPrincipal.tipo).toBe('tiempo_viaje')
  })

  it('siempre incluye microzona NOT_CONFIDENT', () => {
    const ctx = construirGeographyContext({ colonia: 'Centro' }, 'boutique_premium')
    expect(ctx.microzona.status).toBe('MICROZONE_NOT_CONFIDENT')
  })
})
