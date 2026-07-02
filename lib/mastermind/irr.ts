// Solver de TIR (tasa interna de retorno) sobre un vector de flujos de caja mensuales.
// Newton-Raphson como método primario, con fallback a bisección si no converge.

import type { IRRResult } from './tipos'

function npv(rate: number, flujos: number[]): number {
  let total = 0
  for (let t = 0; t < flujos.length; t++) {
    total += flujos[t] / Math.pow(1 + rate, t)
  }
  return total
}

function npvDerivative(rate: number, flujos: number[]): number {
  let total = 0
  for (let t = 1; t < flujos.length; t++) {
    total += (-t * flujos[t]) / Math.pow(1 + rate, t + 1)
  }
  return total
}

function tieneCambioDeSigno(flujos: number[]): boolean {
  const positivos = flujos.some(f => f > 0)
  const negativos = flujos.some(f => f < 0)
  return positivos && negativos
}

function newtonRaphson(flujos: number[], guess: number, maxIter: number, tol: number): { rate: number; converged: boolean; iter: number } {
  let rate = guess
  for (let i = 0; i < maxIter; i++) {
    const valor = npv(rate, flujos)
    if (Math.abs(valor) < tol) return { rate, converged: true, iter: i }

    const derivada = npvDerivative(rate, flujos)
    if (Math.abs(derivada) < 1e-12) break // derivada plana — no seguir, usar fallback

    const siguiente = rate - valor / derivada
    if (!Number.isFinite(siguiente) || siguiente <= -1) break // tasa fuera de dominio válido

    if (Math.abs(siguiente - rate) < tol) return { rate: siguiente, converged: true, iter: i }
    rate = siguiente
  }
  return { rate, converged: false, iter: maxIter }
}

function bisectionFallback(flujos: number[], tol: number): { rate: number; converged: boolean; iter: number } {
  // Escanea un rango amplio de tasas mensuales buscando un cambio de signo en NPV.
  const candidatos = [-0.5, -0.2, -0.1, -0.05, 0, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
  let lo: number | null = null
  let hi: number | null = null
  let npvLo = 0

  for (let i = 0; i < candidatos.length - 1; i++) {
    const a = candidatos[i]
    const b = candidatos[i + 1]
    const npvA = npv(a, flujos)
    const npvB = npv(b, flujos)
    if ((npvA > 0 && npvB < 0) || (npvA < 0 && npvB > 0)) {
      lo = a
      hi = b
      npvLo = npvA
      break
    }
  }

  if (lo === null || hi === null) return { rate: 0, converged: false, iter: 0 }

  let loNum: number = lo
  let hiNum: number = hi
  let iter = 0
  const maxIter = 200
  while (iter < maxIter) {
    const mid = (loNum + hiNum) / 2
    const npvMid = npv(mid, flujos)
    if (Math.abs(npvMid) < tol || hiNum - loNum < tol) return { rate: mid, converged: true, iter }

    if ((npvMid > 0 && npvLo > 0) || (npvMid < 0 && npvLo < 0)) {
      loNum = mid
      npvLo = npvMid
    } else {
      hiNum = mid
    }
    iter++
  }
  return { rate: (loNum + hiNum) / 2, converged: false, iter }
}

export function calcularTIR(
  flujoMensual: number[],
  guess = 0.02,
  maxIter = 100,
  tol = 1e-7,
): IRRResult {
  if (flujoMensual.length < 2 || !tieneCambioDeSigno(flujoMensual)) {
    return { tasaMensual: null, tirAnual: null, converged: false, iteraciones: 0, metodo: 'fallido' }
  }

  const newton = newtonRaphson(flujoMensual, guess, maxIter, tol)
  if (newton.converged) {
    return {
      tasaMensual: newton.rate,
      tirAnual: Math.pow(1 + newton.rate, 12) - 1,
      converged: true,
      iteraciones: newton.iter,
      metodo: 'newton',
    }
  }

  const biseccion = bisectionFallback(flujoMensual, tol)
  if (biseccion.converged) {
    return {
      tasaMensual: biseccion.rate,
      tirAnual: Math.pow(1 + biseccion.rate, 12) - 1,
      converged: true,
      iteraciones: biseccion.iter,
      metodo: 'biseccion',
    }
  }

  return { tasaMensual: null, tirAnual: null, converged: false, iteraciones: biseccion.iter, metodo: 'fallido' }
}
