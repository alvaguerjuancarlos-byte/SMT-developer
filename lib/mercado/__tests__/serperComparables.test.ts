import { describe, it, expect } from 'vitest'
import { numerosDeCita, verificarCampo, portalDeUrl } from '../serperComparables'

describe('numerosDeCita', () => {
  it('lee miles con coma o punto, decimales y millones', () => {
    expect(numerosDeCita('$1,150,000')).toEqual([1_150_000])
    expect(numerosDeCita('$1.150.000 MXN')).toEqual([1_150_000])
    expect(numerosDeCita('1.2 millones')).toEqual([1_200_000])
    expect(numerosDeCita('2,5 MDP')).toEqual([2_500_000])
    expect(numerosDeCita('250 m²')).toEqual([250])
    expect(numerosDeCita('$450 mil')).toEqual([450_000])
  })
})

describe('verificarCampo', () => {
  const texto = 'Terreno en Valle Alto | Venta de terreno de 1,127 m² en $450,800. Excelente ubicación'

  it('acepta un número cuya cita está en el texto', () => {
    expect(verificarCampo(450800, '$450,800', texto, { esPrecio: true })).toBe(450800)
    expect(verificarCampo(1127, '1,127 m²', texto)).toBe(1127)
  })

  it('rechaza una cita que no aparece en el texto (dato inventado)', () => {
    expect(verificarCampo(600000, '$600,000', texto, { esPrecio: true })).toBeNull()
  })

  it('rechaza cuando la cita no contiene el número reportado', () => {
    expect(verificarCampo(600000, '$450,800', texto, { esPrecio: true })).toBeNull()
  })

  it('rechaza mensualidades y precios "desde" como precio total', () => {
    const t = 'Terrenos en PAGOS $90,000 de contado | 6 terrenos desde $1,150,000'
    expect(verificarCampo(90000, '$90,000', t, { esPrecio: true })).toBeNull()
    expect(verificarCampo(1150000, 'desde $1,150,000', t, { esPrecio: true })).toBeNull()
  })

  it('ignora mayúsculas, acentos y espacios de más', () => {
    expect(verificarCampo(1127, '1,127  M²', texto)).toBe(1127)
  })

  it('regresa null sin valor o sin cita', () => {
    expect(verificarCampo(null, '$450,800', texto)).toBeNull()
    expect(verificarCampo(450800, null, texto)).toBeNull()
  })
})

describe('portalDeUrl', () => {
  it('nombra portales conocidos y deja el dominio en los demás', () => {
    expect(portalDeUrl('https://www.lamudi.com.mx/x')).toBe('Lamudi')
    expect(portalDeUrl('https://terreno.mercadolibre.com.mx/MLM-1')).toBe('Mercado Libre')
    expect(portalDeUrl('https://ejemplo.mx/a')).toBe('ejemplo.mx')
  })
})

describe('numerosDeCita con separador de miles y espacio', () => {
  it('lee "$8, 000 X M2" y "1, 000 m2"', () => {
    expect(numerosDeCita('$8, 000 X M2')).toEqual([8000])
    expect(numerosDeCita('Terreno: 1, 000 m2')).toEqual([1000])
    expect(verificarCampo(8000, '$8, 000 X M2', 'Ubicado sobre el Blvrd. Elbert. $8, 000 X M2. Terreno: 1, 000 m2.', { esPrecio: true })).toBe(8000)
  })
})

describe('verificarCampo revisa el texto alrededor de la cita', () => {
  it('rechaza "$1,150,000" si en el texto va precedido de "a partir de"', () => {
    const t = '6 avisos de terrenos en Valle Alto a partir de $1,150,000 MXN.'
    expect(verificarCampo(1150000, '$1,150,000', t, { esPrecio: true })).toBeNull()
  })
  it('rechaza superficies en rango', () => {
    expect(verificarCampo(76, '76', 'Casas desde $2.3 MDP, 7 modelos de 76 a 136 m²')).toBeNull()
    expect(verificarCampo(120, '120 m²', 'Superficie desde 120 m²')).toBeNull()
  })
  it('acepta anuncios concretos dentro de un listado', () => {
    const t = '55 Terrenos en venta en Culiacán ; MN 3,150,000. 252 m² lote. Francisco Labastida 157 ; MN 2,000,000. 1500 m² lote'
    expect(verificarCampo(3150000, 'MN 3,150,000', t, { esPrecio: true })).toBe(3150000)
    expect(verificarCampo(252, '252 m²', t)).toBe(252)
  })
})
