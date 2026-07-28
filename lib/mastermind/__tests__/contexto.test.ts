import { describe, it, expect } from 'vitest'
import { extractProyectoContext, extractTiempoContext, extractMercadoContext } from '../contexto'
import type { AnalisisData } from '@/lib/analisis/tipos'

// Fixture mínimo — solo llenamos lo que extractProyectoContext efectivamente lee.
// El resto de AnalisisData (fichaLegal, mercado, etc.) es irrelevante aquí.
function fixture(
  bitacoraConstruccion: AnalisisData['bitacoraConstruccion'],
  financiero?: Partial<AnalisisData['financiero']>,
): AnalisisData {
  return { bitacoraConstruccion, financiero } as unknown as AnalisisData
}

describe('extractProyectoContext — modo "usuario_define" (construcción interactiva)', () => {
  it('sin tipologiaPropuesta y sin modo usuario_define, no extrae nada (defaults del catálogo se quedan)', () => {
    expect(extractProyectoContext(fixture(undefined))).toEqual({})
  })

  it('en modo usuario_define con envolvente.construibleMax, usa ese valor como superficieConstruccionM2', () => {
    const out = extractProyectoContext(fixture({
      modo: 'usuario_define',
      envolvente: { construibleMax: 1920.4 },
    } as AnalisisData['bitacoraConstruccion']))

    expect(out.superficieConstruccionM2).toBe(1920)
    // niveles/unidadesHabitacionales/m2PromedioDepa no se pueden derivar en este modo —
    // el usuario los ajusta manualmente en el drawer de Mastermind.
    expect(out.niveles).toBeUndefined()
    expect(out.unidadesHabitacionales).toBeUndefined()
  })

  it('en modo usuario_define, deriva el benchmark de construcción del costo/m² paramétrico si está disponible', () => {
    const out = extractProyectoContext(fixture({
      modo: 'usuario_define',
      envolvente: { construibleMax: 1000 },
      indicadores: { costoPorM2Bruto: { base: 17_200 } },
    } as AnalisisData['bitacoraConstruccion']))

    expect(out.benchmarkConstruccion).toBe('habitacional_residencial')
  })

  it('en modo usuario_define sin construibleMax (>0), no extrae nada', () => {
    const out = extractProyectoContext(fixture({ modo: 'usuario_define' } as AnalisisData['bitacoraConstruccion']))
    expect(out).toEqual({})
  })
})

describe('extractProyectoContext — calibración de porcentajeIndirectos desde financiero real', () => {
  it('calcula el % combinado (indirectos + honorarios + imprevistos) / costoTotalConstruccion', () => {
    const out = extractProyectoContext(fixture(undefined, {
      indirectos: 3_000_000, honorarios: 1_800_000, imprevistos: 1_200_000, costoTotalConstruccion: 24_000_000,
    }))
    // (3,000,000 + 1,800,000 + 1,200,000) / 24,000,000 = 25%
    expect(out.porcentajeIndirectos).toBe(25)
  })

  it('aplica igual en modo usuario_define (junto con superficieConstruccionM2)', () => {
    const out = extractProyectoContext(fixture(
      { modo: 'usuario_define', envolvente: { construibleMax: 1000 } } as AnalisisData['bitacoraConstruccion'],
      { indirectos: 2_000_000, honorarios: 1_000_000, imprevistos: 500_000, costoTotalConstruccion: 20_000_000 },
    ))
    expect(out.superficieConstruccionM2).toBe(1000)
    expect(out.porcentajeIndirectos).toBe(17.5)
  })

  it('aplica igual en modo con tipologiaPropuesta (agente_propone)', () => {
    const out = extractProyectoContext(fixture(
      { tipologiaPropuesta: { niveles: 5 } } as AnalisisData['bitacoraConstruccion'],
      { indirectos: 1_800_000, honorarios: 1_200_000, imprevistos: 600_000, costoTotalConstruccion: 20_000_000 },
    ))
    expect(out.niveles).toBe(5)
    expect(out.porcentajeIndirectos).toBe(18)
  })

  it('sin financiero (o costoTotalConstruccion/overhead en 0), no agrega porcentajeIndirectos — se queda en el default del catálogo', () => {
    const out = extractProyectoContext(fixture(undefined, { costoTotalConstruccion: 20_000_000 }))
    expect(out.porcentajeIndirectos).toBeUndefined()
  })
})

describe('extractProyectoContext — análisis con superficieConstruccionM2 pero SIN tipologiaPropuesta ni modo', () => {
  // Caso real encontrado en producción: un análisis con bitacoraConstruccion "base" (trae
  // superficieConstruccionM2/costoPorM2Final) pero sin tipologiaPropuesta ni modo — ni
  // "agente_propone" completo ni "usuario_define". Antes de este fix, extractProyectoContext
  // ignoraba por completo estos campos porque solo los leía dentro de la rama que requería
  // tipologiaPropuesta, así que niveles/unidades se quedaban en default pero terreno sí cargaba
  // real → mismatch enorme (10,880 m² construidos vs 1,040 m² vendibles).
  it('extrae superficieConstruccionM2 y benchmark aunque no haya tipologiaPropuesta ni modo', () => {
    const out = extractProyectoContext(fixture({
      superficieConstruccionM2: 4_160,
      costoPorM2Final: 14_887,
    } as AnalisisData['bitacoraConstruccion']))

    expect(out.superficieConstruccionM2).toBe(4_160)
    // benchmarkMasCercano compara por $/m² efectivo, no por categoría semántica —
    // 14,887 cae más cerca de "oficinas" (15,000) que de "habitacional_medio" (13,500).
    expect(out.benchmarkConstruccion).toBe('oficinas')
    // Sin tipologiaPropuesta, niveles/unidades no se pueden derivar — quedan en default.
    expect(out.niveles).toBeUndefined()
    expect(out.unidadesHabitacionales).toBeUndefined()
  })

  it('si tampoco hay costoPorM2Final, deriva el benchmark de financiero.costoTotalConstruccion / superficie', () => {
    const out = extractProyectoContext(fixture(
      { superficieConstruccionM2: 4_160 } as AnalisisData['bitacoraConstruccion'],
      { costoTotalConstruccion: 61_928_640 },
    ))
    // 61,928,640 / 4,160 ≈ 14,887 MXN/m² → más cercano a oficinas (15,000)
    expect(out.benchmarkConstruccion).toBe('oficinas')
  })
})

describe('extractTiempoContext', () => {
  it('sin financiero, no extrae nada (defaults del catálogo se quedan)', () => {
    expect(extractTiempoContext(undefined)).toEqual({})
    expect(extractTiempoContext({ } as AnalisisData)).toEqual({})
  })

  it('extrae plazoObraMeses/plazoVentaMeses/inicioVentasMes cuando el análisis los calculó', () => {
    const d = { financiero: { plazoObraMeses: 14, plazoVentaMeses: 20, inicioVentasMes: 3 } } as unknown as AnalisisData
    expect(extractTiempoContext(d)).toEqual({ plazoObraMeses: 14, plazoVentaMeses: 20, inicioVentasMes: 3 })
  })

  it('inicioVentasMes = 0 es un valor válido (preventa desde el mes 0), no se descarta', () => {
    const d = { financiero: { plazoObraMeses: 12, plazoVentaMeses: 18, inicioVentasMes: 0 } } as unknown as AnalisisData
    expect(extractTiempoContext(d).inicioVentasMes).toBe(0)
  })

  it('análisis viejo sin estos campos (undefined) — extrae solo lo que sí venga poblado', () => {
    const d = { financiero: { plazoObraMeses: 16 } } as unknown as AnalisisData
    expect(extractTiempoContext(d)).toEqual({ plazoObraMeses: 16 })
  })
})

describe('extractProyectoContext — unidadesHabitacionales siempre sale de la suma del mix, no de totalDepartamentos', () => {
  // Caso real encontrado en producción: Construcción reportó totalDepartamentos=96 pero su
  // propio mix solo sumaba unidades para un área mucho menor a la que el resto del análisis
  // (ingresosProyectados) asumía — totalDepartamentos y el mix son dos campos que la IA no
  // valida entre sí. Si Mastermind usa totalDepartamentos para las unidades pero pondera
  // m2PromedioDepa con la suma del mix, el producto final (m2 vendibles) no representa
  // ninguno de los dos números reales — queda descalibrado sin razón.
  it('usa la suma del mix aunque totalDepartamentos diga otra cosa, para que unidades × m2Promedio sea exacto al mix', () => {
    const out = extractProyectoContext(fixture({
      tipologiaPropuesta: {
        niveles: 6,
        habitacional: {
          totalDepartamentos: 96, // inconsistente con el mix a propósito
          mix: [
            { tipo: '1 recámara', unidades: 40, m2Promedio: 45 },
            { tipo: '2 recámaras', unidades: 20, m2Promedio: 75 },
          ],
        },
      },
    } as AnalisisData['bitacoraConstruccion']))

    // totalUnidades real del mix = 60, no 96
    expect(out.unidadesHabitacionales).toBe(60)
    // m2Ponderado = (40×45 + 20×75) / 60 = (1800+1500)/60 = 55
    expect(out.m2PromedioDepa).toBe(55)
    // unidades × m2Promedio = 60 × 55 = 3,300 — coincide exacto con la suma real del mix
    // (40×45 + 20×75 = 3,300), no con 96 × 55 = 5,280 que hubiera dado el bug viejo.
    expect((out.unidadesHabitacionales ?? 0) * (out.m2PromedioDepa ?? 0)).toBe(3_300)
  })
})

describe('extractProyectoContext — m2ComercialesPlantaBaja no se inventa del "sobrante" de superficieConstruida', () => {
  // Caso real encontrado en producción: un proyecto casi puro habitacional con tip.comercial
  // presente (solo trae totalLocales/niveles, sin área) terminó con 69% de sus ingresos en
  // Mastermind marcados como "comercial" porque el código restaba el área habitacional de
  // superficieConstruida y trataba TODO el resto (estacionamiento, circulaciones, amenidades,
  // cuartos de servicio) como si fuera local comercial vendible — ingresos fantasma.
  it('con tip.comercial presente pero sin dato de área real, NO estima m2ComercialesPlantaBaja', () => {
    const out = extractProyectoContext(fixture({
      superficieConstruccionM2: 13_515,
      tipologiaPropuesta: {
        niveles: 6,
        habitacional: {
          totalDepartamentos: 72,
          mix: [{ tipo: '2 recámaras', unidades: 72, m2Promedio: 65 }],
        },
        comercial: { totalLocales: 3, niveles: 1 },
      },
    } as AnalisisData['bitacoraConstruccion']))

    expect(out.m2ComercialesPlantaBaja).toBeUndefined()
    // El resto de la extracción (habitacional) no se ve afectado.
    expect(out.unidadesHabitacionales).toBe(72)
  })

  it('con superficieVendible persistido (análisis corrido después del fix), SÍ estima el sobrante como comercial', () => {
    const out = extractProyectoContext(fixture({
      superficieConstruccionM2: 13_515,
      superficieVendible: 8_001, // área vendible real total (habitacional + comercial), Zona 1
      tipologiaPropuesta: {
        niveles: 6,
        habitacional: {
          totalDepartamentos: 72,
          mix: [{ tipo: '2 recámaras', unidades: 72, m2Promedio: 65 }], // 72×65 = 4,680 m² habitacional
        },
        comercial: { totalLocales: 3, niveles: 1 },
      },
    } as AnalisisData['bitacoraConstruccion']))

    // 8,001 (vendible real) − 4,680 (habitacional) = 3,321 — no el sobrante de 13,515 (bug viejo)
    expect(out.m2ComercialesPlantaBaja).toBe(3_321)
  })

  it('sin tip.comercial, un desfase entre el mix y superficieVendible NO se atribuye a comercial (evita ruido)', () => {
    const out = extractProyectoContext(fixture({
      superficieConstruccionM2: 7_000,
      superficieVendible: 6_000,
      tipologiaPropuesta: {
        niveles: 6,
        habitacional: {
          totalDepartamentos: 72,
          mix: [{ tipo: '2 recámaras', unidades: 72, m2Promedio: 65 }], // 4,680 m², distinto a 6,000 por inconsistencia de la IA
        },
        comercial: null,
      },
    } as unknown as AnalisisData['bitacoraConstruccion']))

    expect(out.m2ComercialesPlantaBaja).toBeUndefined()
  })
})

describe('extractMercadoContext — precioLocalesM2 sin segmento comercial explícito', () => {
  it('sin segmento "local/comercial" en mercado.segmentacion, usa el mismo precio habitacional', () => {
    const d = { financiero: { precioVentaM2: 18_200 }, mercado: { segmentacion: [] } } as unknown as AnalisisData
    const out = extractMercadoContext(d)
    expect(out.precioVentaDepasM2).toBe(18_200)
    expect(out.precioLocalesM2).toBe(18_200)
  })

  it('con segmento comercial explícito, usa ese precio en vez del habitacional', () => {
    const d = {
      financiero: { precioVentaM2: 18_200 },
      mercado: { segmentacion: [{ tipo: 'Locales comerciales', precioM2: 25_000 }] },
    } as unknown as AnalisisData
    const out = extractMercadoContext(d)
    expect(out.precioLocalesM2).toBe(25_000)
  })
})
