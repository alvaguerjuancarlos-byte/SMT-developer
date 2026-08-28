import { describe, it, expect } from 'vitest'
import { calcularConfianzaPonderada, clasificarNivelConfianza } from '../confidenceEngine'

describe('clasificarNivelConfianza — bandas exactas del §46', () => {
  it('respeta los cortes de cada banda', () => {
    expect(clasificarNivelConfianza(100)).toBe('ALTA')
    expect(clasificarNivelConfianza(95)).toBe('ALTA')
    expect(clasificarNivelConfianza(94)).toBe('BUENA')
    expect(clasificarNivelConfianza(85)).toBe('BUENA')
    expect(clasificarNivelConfianza(84)).toBe('MEDIA')
    expect(clasificarNivelConfianza(70)).toBe('MEDIA')
    expect(clasificarNivelConfianza(69)).toBe('BAJA')
    expect(clasificarNivelConfianza(50)).toBe('BAJA')
    expect(clasificarNivelConfianza(49)).toBe('INSUFICIENTE')
    expect(clasificarNivelConfianza(0)).toBe('INSUFICIENTE')
  })
})

describe('calcularConfianzaPonderada', () => {
  it('null si no hay ningún componente con score', () => {
    const r = calcularConfianzaPonderada([{ nombre: 'cos', score: null, peso: 1 }])
    expect(r.scoreGeneral).toBeNull()
    expect(r.nivel).toBeNull()
  })

  it('no es un promedio ingenuo — pesos distintos cambian el resultado', () => {
    const componentes = [
      { nombre: 'cos', score: 98, peso: 0.9 },
      { nombre: 'riesgo', score: 40, peso: 0.1 },
    ]
    const r = calcularConfianzaPonderada(componentes)
    // promedio ingenuo sería 69; ponderado = 98*0.9+40*0.1 = 92.2
    expect(r.scoreGeneral).not.toBe(69)
    expect(r.scoreGeneral).toBe(92)
    expect(r.nivel).toBe('BUENA')
  })

  it('ignora componentes sin score y re-pondera sobre los disponibles', () => {
    const componentes = [
      { nombre: 'cos', score: 90, peso: 0.5 },
      { nombre: 'programaParcial', score: null, peso: 0.5 },
    ]
    const r = calcularConfianzaPonderada(componentes)
    expect(r.scoreGeneral).toBe(90)
    expect(r.motivo).toContain('1 de 2')
  })

  it('reporta el motivo cuando todos los componentes están disponibles', () => {
    const r = calcularConfianzaPonderada([{ nombre: 'cos', score: 98, peso: 1 }])
    expect(r.motivo).toContain('1 componentes')
  })
})
