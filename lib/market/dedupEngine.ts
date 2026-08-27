// Fase 6 (documento) — Listing Dedup Engine (§13). Motor puro, sin red ni LLM. Detecta cuando
// dos comparables de un mismo batch (ej. de dos búsquedas de Serper, o el mismo depa publicado
// en dos portales) son en realidad el mismo inmueble, y se queda con el más completo — nunca
// duplica artificialmente el inventario.
//
// De las señales que pide el spec (coordinates, address, surface, bedrooms, parking, project,
// unit, phone, developer, hash), comparables-venta/route.ts solo captura de forma real:
// coordenadas (a veces, si hubo geocodificación), dirección, superficie, tipología (de ahí se
// parsean recámaras) y nombre. parking/unit/phone/developer/hash no existen en el pipeline hoy
// — no se inventan como señal de dedup.

import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { ComparableDescartado, ResultadoDedup } from './tipos'
import { distanciaHaversineKm } from '@/lib/geo/geocodeTexto'
import { parsearRecamaras } from './comparableEngine'

// Dos puntos a esta distancia o menos se consideran el mismo predio/edificio, no dos inmuebles
// vecinos distintos.
const DISTANCIA_MISMO_INMUEBLE_KM = 0.05 // 50 m

// Tolerancia de superficie al comparar por dirección — permite que dos portales redondeen
// distinto (ej. "95 m²" vs "94.5 m²") sin tratarlos como inmuebles distintos.
const TOLERANCIA_SUPERFICIE_PCT = 0.05

// Marcas de acento combinantes (U+0300-U+036F) que quedan sueltas tras normalize('NFD').
// Construido con String.fromCharCode (no un literal unicode ni un escape \u en el código fuente)
// para que el archivo no dependa de que el editor/terminal preserve bytes exactos.
const REGEX_DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g')

// Exportado -- reusado por competitorEngine.ts (Fase 47) para agrupar comparables del mismo
// proyecto por nombre, mismo criterio de normalización que usa el dedup para "mismo nombre".
export function normalizarTexto(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD').replace(REGEX_DIACRITICOS, '') // quitar acentos
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function esMismoInmueble(a: ComparableVenta, b: ComparableVenta): string | null {
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const d = distanciaHaversineKm(a.lat, a.lng, b.lat, b.lng)
    if (d <= DISTANCIA_MISMO_INMUEBLE_KM) return `coordenadas a ${Math.round(d * 1000)}m`
  }

  const nombreA = normalizarTexto(a.nombre)
  const nombreB = normalizarTexto(b.nombre)
  if (nombreA && nombreA === nombreB) {
    const coloniaA = normalizarTexto(a.colonia)
    const coloniaB = normalizarTexto(b.colonia)
    // Sin colonia en alguno de los dos no se puede confirmar zona — se acepta el match por
    // nombre solo (un nombre de proyecto real no suele repetirse entre desarrollos distintos).
    if (!coloniaA || !coloniaB || coloniaA === coloniaB) return 'mismo nombre de proyecto'
  }

  const direccionA = normalizarTexto(a.direccion)
  const direccionB = normalizarTexto(b.direccion)
  if (direccionA && direccionA === direccionB) {
    if (a.superficieM2 == null || b.superficieM2 == null) return 'misma dirección (sin superficie que contrastar)'
    const base = Math.max(a.superficieM2, b.superficieM2)
    const diffPct = base > 0 ? Math.abs(a.superficieM2 - b.superficieM2) / base : 0
    if (diffPct > TOLERANCIA_SUPERFICIE_PCT) return null
    const recA = parsearRecamaras(a.tipologia)
    const recB = parsearRecamaras(b.tipologia)
    if (recA != null && recB != null && recA !== recB) return null
    return 'misma dirección y superficie similar'
  }

  return null
}

// Cuántos campos clave trae un comparable — se usa para decidir cuál de dos duplicados
// conservar (el más completo), no simplemente el primero encontrado.
function completitud(c: ComparableVenta): number {
  return [c.precioM2, c.precioTotal, c.superficieM2, c.tipologia, c.avanceObra, c.colonia, c.lat, c.lng]
    .filter((v) => v != null).length
}

export function deduplicarComparables(candidatos: ComparableVenta[]): ResultadoDedup {
  const originales: ComparableVenta[] = []
  const descartados: ComparableDescartado[] = []

  for (const candidato of candidatos) {
    let indiceDuplicadoDe = -1
    let motivo: string | null = null

    for (let i = 0; i < originales.length; i++) {
      const m = esMismoInmueble(candidato, originales[i])
      if (m) {
        indiceDuplicadoDe = i
        motivo = m
        break
      }
    }

    if (indiceDuplicadoDe === -1) {
      originales.push(candidato)
      continue
    }

    const existente = originales[indiceDuplicadoDe]
    if (completitud(candidato) > completitud(existente)) {
      // El nuevo trae más datos — se queda él, el que estaba se archiva como descartado.
      originales[indiceDuplicadoDe] = candidato
      descartados.push({ duplicado: existente, deQuien: candidato, motivo: motivo! })
    } else {
      descartados.push({ duplicado: candidato, deQuien: existente, motivo: motivo! })
    }
  }

  return { originales, descartados }
}
