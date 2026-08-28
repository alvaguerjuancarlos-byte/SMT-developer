// Fase 1 (documento PREFORMA_PROMPT_MAESTRO_AGENTE_NORMATIVA.md, §44) — "¿Qué está limitando
// el terreno?". Motor puro: no calcula NINGÚN factor por sí mismo (remetimientos, CAAV,
// alineamiento, estacionamiento, altura, densidad, geometría) — cada uno lo calcula su propio
// motor (SetbackEngine, calculos.ts, ParkingEngine, etc., según vayan existiendo). Este solo
// ordena, suma y resta contra el potencial teórico. "No asignar reducciones arbitrarias" (§44):
// por eso cada factor exige `esEstimacion` explícito en vez de mezclar cálculo real y estimado
// sin distinguirlos.

export interface FactorLimitante {
  concepto: string
  impactoM2: number
  esEstimacion: boolean
}

export interface ResultadoConstraintAnalyzer {
  potencialTeoricoM2: number
  limitantes: FactorLimitante[] // de mayor a menor impacto
  impactoTotalM2: number
  potencialOperativoEstimadoM2: number
}

export function analizarLimitantes(
  potencialTeoricoM2: number,
  factores: FactorLimitante[],
): ResultadoConstraintAnalyzer {
  const limitantes = [...factores].sort((a, b) => b.impactoM2 - a.impactoM2)
  const impactoTotalM2 = limitantes.reduce((s, f) => s + f.impactoM2, 0)

  return {
    potencialTeoricoM2,
    limitantes,
    impactoTotalM2,
    potencialOperativoEstimadoM2: Math.max(0, potencialTeoricoM2 - impactoTotalM2),
  }
}
