// Tipos compartidos entre motores de cálculo (lib/estimador, lib/analisis, ...).
// Ver lib/estimador/tipos.ts §7 regla 3: toda salida numérica de un motor de
// costeo es un rango piso/base/techo, nunca un solo punto.

export interface Rango {
  piso: number
  base: number
  techo: number
}
