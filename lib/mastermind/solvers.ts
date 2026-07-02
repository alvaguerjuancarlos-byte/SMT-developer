// Solvers de ingeniería inversa — bisección numérica sobre el motor directo + TIR Socio,
// ya que la TIR no es invertible en forma cerrada. Ver justificación de monotonicidad en el
// plan: precioVentaM2 ↑ ⇒ TIR ↑, benchmark de construcción ↑ ⇒ TIR ↓, unidades ↑ ⇒ TIR ↑
// (a m2PromedioDepa fijo).

import type { MastermindInputs, SolverResult } from './tipos'
import { calcularCostos, calcularIngresos, construirFlujoSocio } from './motor'
import { calcularTIR } from './irr'

function evaluarTIRSocio(inputs: MastermindInputs, benchmarkOverrideMxnM2?: number): number | null {
  const ingresos = calcularIngresos(inputs)
  const costos = calcularCostos(inputs, ingresos, benchmarkOverrideMxnM2)
  const flujo = construirFlujoSocio(inputs, ingresos, costos)
  const tir = calcularTIR(flujo)
  return tir.converged ? (tir.tirAnual as number) * 100 : null
}

// Bisección genérica: encuentra x en [lo,hi] tal que evalTIR(x) ≈ target, asumiendo
// monotonicidad conocida. Escanea primero un bracket con cambio de signo (saltando
// evaluaciones no convergentes, comunes cerca de los extremos del rango) y luego bisecta.
function bisectSolve(
  evalTIR: (x: number) => number | null,
  lo: number,
  hi: number,
  target: number,
  direction: 'increasing' | 'decreasing',
  tol = 1e-3,
  maxIter = 60,
): SolverResult {
  const signo = direction === 'increasing' ? 1 : -1
  const f = (x: number): number | null => {
    const v = evalTIR(x)
    return v === null ? null : signo * (v - target)
  }

  const PASOS = 40
  let a: number | null = null
  let b: number | null = null
  let fa = 0
  let ultimoX: number | null = null
  let ultimoF: number | null = null

  for (let i = 0; i <= PASOS; i++) {
    const x = lo + (hi - lo) * (i / PASOS)
    const fx = f(x)
    if (fx === null) continue
    if (ultimoX !== null && ultimoF !== null && ((ultimoF <= 0 && fx >= 0) || (ultimoF >= 0 && fx <= 0))) {
      a = ultimoX
      b = x
      fa = ultimoF
      break
    }
    ultimoX = x
    ultimoF = fx
  }

  if (a === null || b === null) {
    return { valor: null, converged: false, tirAlcanzada: null, iteraciones: 0 }
  }

  let loB = a
  let hiB = b
  let faB = fa
  let iter = 0

  while (iter < maxIter) {
    const mid = (loB + hiB) / 2
    const fMid = f(mid)

    if (fMid === null) {
      // Punto no convergente dentro del bracket — angosta hacia el lado ya conocido como válido.
      hiB = mid
      iter++
      continue
    }
    if (Math.abs(fMid) < tol || hiB - loB < tol) {
      return { valor: mid, converged: true, tirAlcanzada: evalTIR(mid), iteraciones: iter }
    }
    if ((fMid <= 0 && faB <= 0) || (fMid >= 0 && faB >= 0)) {
      loB = mid
      faB = fMid
    } else {
      hiB = mid
    }
    iter++
  }

  const mid = (loB + hiB) / 2
  return { valor: mid, converged: false, tirAlcanzada: evalTIR(mid), iteraciones: iter }
}

export function resolverPrecioVentaMinimo(inputs: MastermindInputs): SolverResult {
  const precioActual = inputs.mercado.precioVentaDepasM2 || 10_000
  const lo = Math.max(100, precioActual * 0.1)
  const hi = Math.max(precioActual * 5, 100_000)
  const evalTIR = (x: number) => evaluarTIRSocio({ ...inputs, mercado: { ...inputs.mercado, precioVentaDepasM2: x } })
  return bisectSolve(evalTIR, lo, hi, inputs.tirObjetivo, 'increasing')
}

export function resolverBenchmarkMaximo(inputs: MastermindInputs): SolverResult {
  const evalTIR = (x: number) => evaluarTIRSocio(inputs, x)
  return bisectSolve(evalTIR, 3_000, 40_000, inputs.tirObjetivo, 'decreasing')
}

export function resolverUnidadesMinimas(inputs: MastermindInputs): SolverResult {
  const evalTIR = (x: number) => evaluarTIRSocio({ ...inputs, proyecto: { ...inputs.proyecto, unidadesHabitacionales: x } })
  return bisectSolve(evalTIR, 1, 500, inputs.tirObjetivo, 'increasing')
}
