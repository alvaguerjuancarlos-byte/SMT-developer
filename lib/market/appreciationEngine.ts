// Fase 9 (documento) — Appreciation Engine. Motor puro, sin red ni LLM.
//
// Alcance real (ver nota en tipos.ts): recibe una serie de observaciones YA segmentada por el
// caller (ej. "todas las observaciones de la colonia X, tipología 2 rec") — §26/§27 piden separar
// por geografía y por tipología, pero eso es responsabilidad de quien arme la lista de
// ObservacionPrecio antes de llamar a este motor (misma filosofía que priceEngine.ts: los
// motores no re-implementan la segmentación de sus vecinos). "monthly" del spec se interpreta
// literalmente como variación mes contra mes, no como una ventana de "1 mes hacia atrás" — ver
// calcularAppreciationEngine().
//
// Sin datos reales que consumir hoy (nada escribe en market_comparable_snapshots todavía) —
// probado con fixtures, exactamente igual que el resto de lib/market/.

import type { ObservacionPrecio, ResultadoPlusvalia, VentanaPlusvalia } from './tipos'
import { calcularEstadisticasRobustas } from './priceEngine'

const VENTANAS_MESES: Record<VentanaPlusvalia, number> = {
  mensual: 1, trimestral: 3, anual: 12, '3_anios': 36, '5_anios': 60, '10_anios': 120,
}

interface PuntoSerie {
  mes: string // "YYYY-MM"
  mediana: number
  n: number
}

// "YYYY-MM" o fecha completa -> índice entero comparable (año×12 + mes-1), para poder restar
// meses sin parsear fechas de calendario repetidamente.
function indiceMes(mes: string): number {
  const [y, m] = mes.slice(0, 7).split('-').map(Number)
  return y * 12 + (m - 1)
}

// §11/§61 — agrupa observaciones puntuales (que pueden llegar en cualquier fecha, no en un
// calendario fijo) en una serie mensual real, usando la MEDIANA de cada mes en vez del promedio
// (§11: priorizar mediana sobre promedio cuando hay outliers).
export function construirSerieMensual(observaciones: ObservacionPrecio[]): PuntoSerie[] {
  const grupos = new Map<string, number[]>()
  for (const o of observaciones) {
    const mes = o.observadoEn.slice(0, 7)
    if (!grupos.has(mes)) grupos.set(mes, [])
    grupos.get(mes)!.push(o.precioM2)
  }

  return Array.from(grupos.entries())
    .map(([mes, precios]) => ({ mes, mediana: calcularEstadisticasRobustas(precios)!.median, n: precios.length }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

export function calcularVentanaPlusvalia(serie: PuntoSerie[], ventana: VentanaPlusvalia): ResultadoPlusvalia {
  if (serie.length < 2) {
    return {
      ventana, tasaAnualizada: null, periodoInicio: null, periodoFin: serie[0]?.mes ?? null,
      muestraInicio: 0, muestraFin: serie[0]?.n ?? 0,
      motivo: 'Menos de 2 meses distintos con observaciones — no hay serie de tiempo todavía.',
    }
  }

  const fin = serie[serie.length - 1]
  const finIdx = indiceMes(fin.mes)
  const objetivoIdx = finIdx - VENTANAS_MESES[ventana]
  const primero = serie[0]

  if (indiceMes(primero.mes) > objetivoIdx) {
    return {
      ventana, tasaAnualizada: null, periodoInicio: null, periodoFin: fin.mes,
      muestraInicio: 0, muestraFin: fin.n,
      motivo: `El historial disponible empieza en ${primero.mes} — no alcanza para una ventana "${ventana}" (necesitaría datos anteriores a esa fecha).`,
    }
  }

  // El punto más reciente que sigue estando dentro (o antes) del objetivo — no interpola entre
  // meses, usa el dato real más cercano sin pasarse de la ventana pedida.
  let inicio = primero
  for (const punto of serie) {
    if (indiceMes(punto.mes) <= objetivoIdx) inicio = punto
    else break
  }

  const mesesReales = finIdx - indiceMes(inicio.mes)
  if (mesesReales === 0 || inicio.mediana <= 0) {
    return {
      ventana, tasaAnualizada: null, periodoInicio: inicio.mes, periodoFin: fin.mes,
      muestraInicio: inicio.n, muestraFin: fin.n,
      motivo: 'Punto de inicio y fin coinciden en el mismo mes, o precio base inválido.',
    }
  }

  // Cambio total del periodo, anualizado por composición — mismo método que
  // lib/mercado/parsearPlusvalia.ts (parsearPlusvaliaAnual), pero aquí con meses REALES
  // transcurridos, no los que el LLM haya escrito en un texto libre.
  const cambioTotal = (fin.mediana - inicio.mediana) / inicio.mediana
  const tasaAnualizada = (Math.pow(1 + cambioTotal, 12 / mesesReales) - 1) * 100

  return {
    ventana,
    tasaAnualizada: Math.round(tasaAnualizada * 10) / 10,
    periodoInicio: inicio.mes,
    periodoFin: fin.mes,
    muestraInicio: inicio.n,
    muestraFin: fin.n,
  }
}

export function calcularAppreciationEngine(observaciones: ObservacionPrecio[]): ResultadoPlusvalia[] {
  const serie = construirSerieMensual(observaciones)
  const ventanas: VentanaPlusvalia[] = ['mensual', 'trimestral', 'anual', '3_anios', '5_anios', '10_anios']
  return ventanas.map((v) => calcularVentanaPlusvalia(serie, v))
}
