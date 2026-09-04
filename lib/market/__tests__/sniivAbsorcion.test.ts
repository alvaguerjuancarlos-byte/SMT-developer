import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolverAbsorcionSNIIV } from '../sniivAbsorcion'

// I/O puro (fetch a un servicio real de SEDATU) — se mockea aquí, mismo criterio que el resto
// de lib/market/ y lib/terreno/parcelResolver.ts: la lógica de resolución (branching, fallback
// de años, distinguir "sin cobertura" de "servicio caído") se prueba con fetch controlado; el
// fetch real ya se verificó a mano contra el servicio en vivo (ver comentario en el archivo).
function mockFetchJson(porAnio: Record<number, any[]>) {
  return vi.fn(async (url: string) => {
    const m = url.match(/GetInventarioMunicipal\/(\d+)\//)
    const anio = m ? Number(m[1]) : -1
    const data = porAnio[anio]
    if (data === undefined) return { ok: false, status: 500 } as Response
    return { ok: true, json: async () => data } as Response
  })
}

const FILA_APODACA = { clave_municipio: '006', municipio: 'Apodaca', registro: 153, construccion: 234, venta: 67, total: 377, numero_vivienda: 93 }

describe('resolverAbsorcionSNIIV', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('estado no soportado -> disponible=false, ni siquiera intenta consultar la red', async () => {
    const fetchMock = mockFetchJson({})
    vi.stubGlobal('fetch', fetchMock)
    const r = await resolverAbsorcionSNIIV('Alguna colonia', 'Ciudad de México')
    expect(r.disponible).toBe(false)
    expect(r.motivo).toMatch(/no soportado/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('municipio no reconocido en Nuevo León -> disponible=false, ni siquiera intenta consultar la red', async () => {
    const fetchMock = mockFetchJson({})
    vi.stubGlobal('fetch', fetchMock)
    const r = await resolverAbsorcionSNIIV('Zapopan', 'Nuevo León')
    expect(r.disponible).toBe(false)
    expect(r.motivo).toMatch(/no reconocido/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('municipio con datos reales en el año actual -> disponible=true con los días reales', async () => {
    const anioActual = new Date().getFullYear()
    vi.stubGlobal('fetch', mockFetchJson({ [anioActual]: [FILA_APODACA] }))
    const r = await resolverAbsorcionSNIIV('Apodaca', 'Nuevo León')
    expect(r.disponible).toBe(true)
    expect(r.diasVenta).toBe(67)
    expect(r.diasTotal).toBe(377)
    expect(r.numeroVivienda).toBe(93)
    expect(r.anio).toBe(anioActual)
  })

  it('sin datos en el año actual pero sí el año pasado -> cae al año anterior automáticamente', async () => {
    const anioActual = new Date().getFullYear()
    vi.stubGlobal('fetch', mockFetchJson({ [anioActual]: [], [anioActual - 1]: [FILA_APODACA] }))
    const r = await resolverAbsorcionSNIIV('Apodaca', 'Nuevo León')
    expect(r.disponible).toBe(true)
    expect(r.anio).toBe(anioActual - 1)
  })

  it('consulta exitosa pero el municipio nunca aparece (San Pedro) -> motivo de cobertura, no de servicio caído', async () => {
    const anioActual = new Date().getFullYear()
    const porAnio = { [anioActual]: [FILA_APODACA], [anioActual - 1]: [FILA_APODACA], [anioActual - 2]: [FILA_APODACA] }
    vi.stubGlobal('fetch', mockFetchJson(porAnio))
    const r = await resolverAbsorcionSNIIV('San Pedro Garza García', 'Nuevo León')
    expect(r.disponible).toBe(false)
    expect(r.motivo).toMatch(/premium/i)
    expect(r.motivo).not.toMatch(/no se pudo consultar/i)
  })

  it('las 3 consultas fallan (servicio caído) -> motivo distinto al de "sin cobertura", nunca confunde ambas causas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502 }) as Response))
    const r = await resolverAbsorcionSNIIV('Apodaca', 'Nuevo León')
    expect(r.disponible).toBe(false)
    expect(r.motivo).toMatch(/no se pudo consultar/i)
  })
})
