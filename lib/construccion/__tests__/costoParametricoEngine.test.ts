import { describe, it, expect } from 'vitest'
import {
  factorAltura, factorTopografia, factorComplejidad, factorSotano,
  normalizarPartidas, calcularPartidas, calcularCostoTotalDesdeZonas,
  calcularCostosPorM2, compararConBenchmark, calcularRango,
  calcularConfidenceScore, generarAlertas, ejecutarSanityChecks, incertidumbreDesdeConfianza,
} from '../costoParametricoEngine'

describe('factorAltura (§10)', () => {
  it('tabla exacta del documento', () => {
    expect(factorAltura(1)).toBe(0.95)
    expect(factorAltura(2)).toBe(1.00)
    expect(factorAltura(3)).toBe(1.00)
    expect(factorAltura(4)).toBe(1.07)
    expect(factorAltura(6)).toBe(1.07)
    expect(factorAltura(7)).toBe(1.15)
    expect(factorAltura(11)).toBe(1.15)
    expect(factorAltura(12)).toBe(1.25)
    expect(factorAltura(20)).toBe(1.25)
    expect(factorAltura(21)).toBe(1.35)
  })
})

describe('factorTopografia (§12)', () => {
  it('mapea cada label a su bucket', () => {
    expect(factorTopografia('plano')).toBe(1.00)
    expect(factorTopografia('suave')).toBe(1.02)
    expect(factorTopografia('moderada')).toBe(1.05)
    expect(factorTopografia('pronunciada')).toBe(1.18)
  })
  it('sin dato -> 1.00, nunca se inventa (§12)', () => {
    expect(factorTopografia(null)).toBe(1.00)
    expect(factorTopografia(undefined)).toBe(1.00)
  })
})

describe('factorComplejidad (§13) y factorSotano (§17)', () => {
  it('tabla exacta', () => {
    expect(factorComplejidad('C0')).toBe(0.95)
    expect(factorComplejidad('C1')).toBe(1.00)
    expect(factorComplejidad('C2')).toBe(1.05)
    expect(factorComplejidad('C3')).toBe(1.12)
    expect(factorComplejidad('C4')).toBe(1.20)
  })
  it('sotano', () => {
    expect(factorSotano('simple')).toBe(1.20)
    expect(factorSotano('estandar')).toBe(1.30)
    expect(factorSotano('complejo')).toBe(1.45)
    expect(factorSotano('profundo')).toBe(1.60)
  })
})

describe('normalizarPartidas + calcularPartidas (§21/22 — regla matemática fundamental)', () => {
  it('normaliza porcentajes que no suman 100 a que sumen exactamente 100', () => {
    const norm = normalizarPartidas([{ concepto: 'A', porcentaje: 30 }, { concepto: 'B', porcentaje: 30 }, { concepto: 'C', porcentaje: 30 }])
    const suma = norm.reduce((s, p) => s + p.porcentaje, 0)
    expect(suma).toBeCloseTo(100, 6)
  })

  it('la suma de costoTotal de las partidas SIEMPRE cierra exacto al costo directo, incluso con redondeos feos', () => {
    const partidas = calcularPartidas(23_760_000, 1440, [
      { concepto: 'Preliminares', porcentaje: 4 },
      { concepto: 'Cimentación', porcentaje: 10 },
      { concepto: 'Estructura', porcentaje: 28 },
      { concepto: 'Instalaciones', porcentaje: 18 },
      { concepto: 'Acabados', porcentaje: 24 },
      { concepto: 'Carpintería', porcentaje: 8 },
      { concepto: 'Equipamiento', porcentaje: 5 },
      { concepto: 'Exteriores', porcentaje: 3 },
    ])
    const suma = partidas.reduce((s, p) => s + p.costoTotal, 0)
    expect(suma).toBe(23_760_000)
    expect(partidas).toHaveLength(8)
  })

  it('porcentajes que no suman 100 (error del LLM) igual cierran exacto tras normalizar', () => {
    const partidas = calcularPartidas(1_000_000, 100, [
      { concepto: 'A', porcentaje: 50 },
      { concepto: 'B', porcentaje: 60 }, // suma 110, no 100
    ])
    const suma = partidas.reduce((s, p) => s + p.costoTotal, 0)
    expect(suma).toBe(1_000_000)
  })
})

describe('calcularCostoTotalDesdeZonas', () => {
  it('suma m2 × costoM2 de cada zona + urbanización, ignora cualquier "costoTotal" declarado aparte', () => {
    const total = calcularCostoTotalDesdeZonas([
      { zona: 'Área vendible', m2: 921, costoM2: 13000 },
      { zona: 'Estacionamiento', m2: 288, costoM2: 6240 },
      { zona: 'Circulaciones', m2: 144, costoM2: 9100 },
      { zona: 'Áreas comunes', m2: 72, costoM2: 11700 },
      { zona: 'Cuartos de servicio', m2: 15, costoM2: 7150 },
    ], 480_000)
    // 921*13000 + 288*6240 + 144*9100 + 72*11700 + 15*7150 + 480000
    const esperado = 921 * 13000 + 288 * 6240 + 144 * 9100 + 72 * 11700 + 15 * 7150 + 480_000
    expect(total).toBe(esperado)
  })
})

describe('calcularCostosPorM2 (§29/30)', () => {
  it('caso Tampiquito (§38): 1000 m² construidos, 750 m² vendibles', () => {
    const r = calcularCostosPorM2(23_760_000, 1000, 750)
    expect(r.costoM2Construido).toBe(23_760)
    expect(r.costoM2Vendible).toBe(31_680)
    expect(r.eficienciaPct).toBe(75)
  })
  it('sin área vendible -> costoM2Vendible y eficiencia null, nunca 0 fabricado', () => {
    const r = calcularCostosPorM2(1_000_000, 100, null)
    expect(r.costoM2Vendible).toBeNull()
    expect(r.eficienciaPct).toBeNull()
  })
})

describe('compararConBenchmark (§31)', () => {
  it('clasifica NORMAL/REVISAR/ALERTA/INCONSISTENCIA por % de diferencia contra el centro del rango', () => {
    // centro = 20000
    expect(compararConBenchmark(20_500, 18_000, 22_000).semaforo).toBe('NORMAL')   // +2.5%
    expect(compararConBenchmark(23_000, 18_000, 22_000).semaforo).toBe('REVISAR')  // +15%
    expect(compararConBenchmark(24_500, 18_000, 22_000).semaforo).toBe('ALERTA')   // +22.5%
    expect(compararConBenchmark(27_000, 18_000, 22_000).semaforo).toBe('INCONSISTENCIA') // +35%
  })
})

describe('calcularRango (§34/42)', () => {
  it('LOW/BASE/HIGH alrededor del costo base', () => {
    const r = calcularRango(21_000, 8.6, 13.3)
    expect(r.base).toBe(21_000)
    expect(r.low).toBe(Math.round(21_000 * 0.914))
    expect(r.high).toBe(Math.round(21_000 * 1.133))
  })
})

describe('calcularConfidenceScore (§33)', () => {
  it('todos los factores presentes -> 100, Alta', () => {
    const r = calcularConfidenceScore({
      ubicacionConocida: true, superficieConocida: true, programaDefinido: true, nivelesDefinidos: true,
      topografiaConocida: true, mecanicaSuelosDisponible: true, acabadosDefinidos: true,
      estacionamientoDefinido: true, costosLocalesRecientes: true, benchmarkComparable: true,
    })
    expect(r.score).toBe(100)
    expect(r.clasificacion).toBe('Alta')
  })
  it('sin nada -> 0, Muy baja', () => {
    const r = calcularConfidenceScore({
      ubicacionConocida: false, superficieConocida: false, programaDefinido: false, nivelesDefinidos: false,
      topografiaConocida: false, mecanicaSuelosDisponible: false, acabadosDefinidos: false,
      estacionamientoDefinido: false, costosLocalesRecientes: false, benchmarkComparable: false,
    })
    expect(r.score).toBe(0)
    expect(r.clasificacion).toBe('Muy baja')
  })
  it('caso típico (falta mecánica de suelos y topografía) cae en Media/Buena, no Alta', () => {
    const r = calcularConfidenceScore({
      ubicacionConocida: true, superficieConocida: true, programaDefinido: true, nivelesDefinidos: true,
      topografiaConocida: false, mecanicaSuelosDisponible: false, acabadosDefinidos: true,
      estacionamientoDefinido: true, costosLocalesRecientes: false, benchmarkComparable: true,
    })
    expect(r.score).toBe(75)
    expect(r.clasificacion).toBe('Buena')
  })
})

describe('generarAlertas (§49)', () => {
  it('dispara alerta de costo elevado, baja eficiencia y confianza baja simultáneamente', () => {
    const alertas = generarAlertas({
      costoM2: 25_000, benchmarkLow: 18_000, benchmarkHigh: 22_000,
      eficienciaPct: 55, areaSotanosM2: 100, areaConstruidaM2: 1000,
      pendienteLabel: 'pronunciada', confidenceScore: 55,
    })
    expect(alertas).toContain('Costo potencialmente elevado.')
    expect(alertas).toContain('El proyecto presenta baja eficiencia entre superficie construida y vendible.')
    expect(alertas).toContain('El costo de contención/cimentación puede tener alta sensibilidad por la pendiente del terreno.')
    expect(alertas.some(a => a.includes('Resultado preliminar'))).toBe(true)
  })
  it('proyecto sano no dispara ninguna alerta', () => {
    const alertas = generarAlertas({
      costoM2: 20_000, benchmarkLow: 18_000, benchmarkHigh: 22_000,
      eficienciaPct: 75, areaSotanosM2: 0, areaConstruidaM2: 1000,
      pendienteLabel: 'plano', confidenceScore: 90,
    })
    expect(alertas).toHaveLength(0)
  })
})

describe('ejecutarSanityChecks (§32, subset)', () => {
  it('proyecto sano pasa los 4 checks', () => {
    const partidas = calcularPartidas(1_000_000, 100, [
      { concepto: 'A', porcentaje: 60 }, { concepto: 'B', porcentaje: 40 },
    ])
    const checks = ejecutarSanityChecks({ partidas, costoDirectoTotal: 1_000_000, areaConstruidaM2: 100, areaVendibleM2: 80 })
    expect(checks.every(c => c.ok)).toBe(true)
  })
  it('detecta vendible > construida (dato imposible)', () => {
    const partidas = calcularPartidas(1_000_000, 100, [{ concepto: 'A', porcentaje: 100 }])
    const checks = ejecutarSanityChecks({ partidas, costoDirectoTotal: 1_000_000, areaConstruidaM2: 100, areaVendibleM2: 150 })
    const check04 = checks.find(c => c.check.startsWith('CHECK04'))
    expect(check04?.ok).toBe(false)
  })
})

describe('incertidumbreDesdeConfianza (§52)', () => {
  it('mayor confianza -> menor incertidumbre (rango más angosto)', () => {
    expect(incertidumbreDesdeConfianza(95)).toBe(10)
    expect(incertidumbreDesdeConfianza(75)).toBe(15)
    expect(incertidumbreDesdeConfianza(55)).toBe(20)
    expect(incertidumbreDesdeConfianza(30)).toBe(25)
  })
})
