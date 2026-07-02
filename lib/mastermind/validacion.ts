// Validación de inputs de Mastermind contra la tabla de reglas del PRD.

import type { MastermindInputs, ValidationError } from './tipos'
import { REGLAS_VALIDACION } from './catalogo'

const GETTERS: Record<string, (inputs: MastermindInputs) => number> = {
  unidadesHabitacionales: i => i.proyecto.unidadesHabitacionales,
  m2PromedioDepa: i => i.proyecto.m2PromedioDepa,
  precioVentaDepasM2: i => i.mercado.precioVentaDepasM2,
  niveles: i => i.proyecto.niveles,
  plazoObraMeses: i => i.tiempo.plazoObraMeses,
  porcentajeFinanciado: i => i.financiamiento.porcentajeFinanciado,
  tirObjetivo: i => i.tirObjetivo,
}

export function validarInputs(inputs: MastermindInputs): ValidationError[] {
  const errores: ValidationError[] = []

  for (const regla of REGLAS_VALIDACION) {
    const getter = GETTERS[regla.campo]
    if (!getter) continue
    const valor = getter(inputs)
    if (regla.min !== undefined && valor < regla.min) errores.push({ campo: regla.campo, mensaje: regla.mensaje })
    else if (regla.max !== undefined && valor > regla.max) errores.push({ campo: regla.campo, mensaje: regla.mensaje })
  }

  const { tiempo } = inputs
  if (tiempo.plazoVentaMeses < tiempo.plazoObraMeses) {
    errores.push({ campo: 'plazoVentaMeses', mensaje: 'Plazo venta debe ser >= plazo obra' })
  }
  if (tiempo.inicioVentasMes >= tiempo.plazoVentaMeses) {
    errores.push({ campo: 'inicioVentasMes', mensaje: 'Inicio ventas debe ser antes del fin' })
  }

  return errores
}
