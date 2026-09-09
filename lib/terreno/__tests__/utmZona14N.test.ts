import { describe, it, expect } from 'vitest'
import { wgs84AUtmZona14N, utmZona14NAWgs84 } from '../utmZona14N'

describe('wgs84AUtmZona14N', () => {
  it('en el meridiano central (-99°) el easting da exactamente 500000 para cualquier latitud', () => {
    // Los términos de corrección de la serie de Snyder solo dependen de A=(lon-lon0)*cos(lat);
    // en el meridiano central A=0, así que todos esos términos se anulan por construcción.
    for (const lat of [0, 10, 25.65, 40]) {
      expect(wgs84AUtmZona14N(lat, -99).easting).toBeCloseTo(500000, 6)
    }
  })

  it('en el ecuador el northing da exactamente 0 para cualquier longitud', () => {
    // M(0)=0 y el término de corrección lleva un factor tan(lat), que en el ecuador es 0.
    for (const lon of [-100.4, -99, -97]) {
      expect(wgs84AUtmZona14N(0, lon).northing).toBeCloseTo(0, 6)
    }
  })
})

describe('utmZona14NAWgs84', () => {
  it('round-trip: forward seguido de inverse recupera el punto original (San Pedro, error < 1e-8°)', () => {
    const casos = [
      { lat: 25.6512, lon: -100.4023 },
      { lat: 25.65069199, lon: -100.40178273 },
      { lat: 25.669071711099576, lon: -100.36534958637502 },
    ]
    for (const { lat, lon } of casos) {
      const { easting, northing } = wgs84AUtmZona14N(lat, lon)
      const inv = utmZona14NAWgs84(easting, northing)
      expect(inv.lat).toBeCloseTo(lat, 8)
      expect(inv.lon).toBeCloseTo(lon, 8)
    }
  })

  it('un punto real de vu:banqueta (EPSG:6369) invierte dentro del municipio de San Pedro', () => {
    // Coordenada tomada de una consulta real al GeoServer (2026-09-09) -- verifica que la
    // proyección coincide con el sistema que el servidor realmente usa, no solo que es
    // matemáticamente autoconsistente (el test de round-trip de arriba no probaría eso solo).
    const { lat, lon } = utmZona14NAWgs84(362970.2772, 2839743.7884)
    expect(lat).toBeGreaterThan(25.6)
    expect(lat).toBeLessThan(25.68)
    expect(lon).toBeGreaterThan(-100.42)
    expect(lon).toBeLessThan(-100.32)
  })
})
