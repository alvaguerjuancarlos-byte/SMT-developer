// Adapta el "programa de unidades" que arma el usuario (mezcla de tipos de depa,
// locales comerciales) hacia el formato que espera lib/estimador — y parsea los
// valores normativos (COS/CUS) que devuelve el Agente Legal como strings.

import type { GeneroConstructivo, InputsNormativos, UsoDesarrollo } from '@/lib/estimador/tipos'

export interface MixItem {
  label: string       // ej. "1 recámara", "Local 70 m²"
  pct: number         // % del total de unidades/locales de este bloque
  m2Promedio: number
}

export interface ProgramaHabitacional {
  genero: Extract<GeneroConstructivo, 'vivienda_interes_social' | 'vivienda_residencial_media' | 'vivienda_residencial_lujo'>
  totalUnidades: number
  mix: MixItem[]      // los pct deberían sumar ~100
}

export interface ProgramaComercial {
  niveles: number
  localesPorNivel: number
  mix: MixItem[]      // distribución de tamaños de local, pct sobre el total de locales
}

export interface ProgramaUnidades {
  habitacional?: ProgramaHabitacional
  comercial?: ProgramaComercial
  amenidadesM2?: number  // áreas comunes y amenidades — genero 'amenidades_comunes' (no vendible)
}

function m2TotalDeMix(totalUnidades: number, mix: MixItem[]): number {
  return mix.reduce((suma, item) => suma + totalUnidades * (item.pct / 100) * item.m2Promedio, 0)
}

// Convierte el programa a UsoDesarrollo[] — un bucket agregado por género, ya que
// lib/estimador no distingue tipos de unidad dentro de un mismo género (solo
// m2Bruto total + headcount). El desglose por tipo solo sirve para calcular ese total.
export function programaAUsos(programa: ProgramaUnidades): UsoDesarrollo[] {
  const usos: UsoDesarrollo[] = []

  if (programa.habitacional) {
    const { genero, totalUnidades, mix } = programa.habitacional
    usos.push({ genero, m2Bruto: m2TotalDeMix(totalUnidades, mix), unidades: totalUnidades })
  }

  if (programa.comercial) {
    const { niveles, localesPorNivel, mix } = programa.comercial
    const totalLocales = niveles * localesPorNivel
    usos.push({ genero: 'comercio', m2Bruto: m2TotalDeMix(totalLocales, mix) })
  }

  if (programa.amenidadesM2 && programa.amenidadesM2 > 0) {
    usos.push({ genero: 'amenidades_comunes', m2Bruto: programa.amenidadesM2 })
  }

  return usos
}

// El Agente Legal devuelve cos/cus como strings ("60%", "2.4") — lib/estimador
// necesita números. CAS (área permeable) todavía no lo calcula el Agente Legal,
// así que se usa un default ajustable por el usuario (0.15, mínimo municipal típico)
// en vez de bloquear el flujo o expandir el contrato de esa IA en esta fase.
export const CAS_DEFAULT = 0.15

export function parseCos(valor: string | undefined): number {
  if (!valor) return 0
  const n = parseFloat(valor.replace('%', '').replace(',', '.'))
  if (!Number.isFinite(n)) return 0
  return n > 1 ? n / 100 : n
}

export function parseCus(valor: string | undefined): number {
  if (!valor) return 0
  const n = parseFloat(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function construirInputsNormativos(
  sTerreno: number,
  cosStr: string | undefined,
  cusStr: string | undefined,
  cas: number = CAS_DEFAULT,
): InputsNormativos {
  return { sTerreno, cos: parseCos(cosStr), cus: parseCus(cusStr), cas }
}
