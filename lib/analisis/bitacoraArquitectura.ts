// Único punto de lectura para los campos de diseño (tipología, envolvente, mix de
// unidades) que hoy pueden vivir en dos lugares distintos según cuándo se generó el
// análisis:
//  - bitacoraArquitectura — análisis nuevos, generados por el Agente de Arquitectura.
//  - bitacoraConstruccion.tipologiaPropuesta (+ envolventeCalculada/validaciones/superficies)
//    — análisis guardados antes del split de Construcción en Arquitectura + Construcción.
// Modo "usuario_define" (construcción interactiva manual) no tiene tipologiaPropuesta en
// ninguno de los dos lugares — este helper regresa undefined y cada consumidor mantiene su
// propio fallback específico de ese modo (bitacoraConstruccion.envolvente/indicadores).
import type { AnalisisData, BitacoraArquitectura } from './tipos'

export function resolveBitacoraArquitectura(
  d: Pick<Partial<AnalisisData>, 'bitacoraArquitectura' | 'bitacoraConstruccion'> | null | undefined
): BitacoraArquitectura | undefined {
  if (d?.bitacoraArquitectura) return d.bitacoraArquitectura

  const bc = d?.bitacoraConstruccion
  if (!bc?.tipologiaPropuesta) return undefined

  return {
    tipologiaPropuesta: bc.tipologiaPropuesta,
    superficieConstruida: bc.superficieConstruccionM2,
    superficieVendible: bc.superficieVendible,
    envolventeCalculada: bc.envolventeCalculada,
    validacionEnvolvente: bc.validacionEnvolvente,
    validacionSuperficieConstruida: bc.validacionSuperficieConstruida,
  }
}
