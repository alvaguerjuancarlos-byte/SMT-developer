// Bloque 8 — parsea la plusvalía de zona que devuelve el Agente Mercado (texto libre, ej.
// "+18% en 3 años", "6% anual") a una tasa ANUAL numérica. NO reusa el parsearNumero() genérico
// de app/preforma/page.tsx (extrae el primer número sin noción de unidad de tiempo): un texto
// como "+18% en 3 años" es un acumulado de 3 años, no 18%/año — tratarlo como anual sobrestima
// la tasa real (~5.7%/año compuesto) casi 3x. Este parser distingue explícitamente los 3 casos.

function redondear1(n: number): number {
  return Math.round(n * 10) / 10
}

export function parsearPlusvaliaAnual(texto: string | null | undefined): number | null {
  if (!texto) return null
  const t = texto.toLowerCase()

  // Caso 1: ya anualizado — "6% anual", "5%/año", "4% por año".
  const anual = t.match(/(\d+(?:\.\d+)?)\s*%[^\d]{0,15}(anual|\/\s*año|por\s*año)/)
  if (anual) return Number(anual[1])

  // Caso 2: acumulado en N años — "+18% en 3 años" → se anualiza compuesto.
  const acumulado = t.match(/(\d+(?:\.\d+)?)\s*%[^\d]{0,15}en\s*(\d+)\s*años?/)
  if (acumulado) {
    const pct = Number(acumulado[1])
    const anios = Number(acumulado[2])
    if (anios > 0) return redondear1((Math.pow(1 + pct / 100, 1 / anios) - 1) * 100)
  }

  // Caso 3: % suelto sin calificador de tiempo — fallback documentado: se asume ya anual.
  const suelto = t.match(/(\d+(?:\.\d+)?)\s*%/)
  if (suelto) return Number(suelto[1])

  return null
}
