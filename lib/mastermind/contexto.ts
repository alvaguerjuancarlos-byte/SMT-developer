// Extracción defensiva del contexto de terreno desde el análisis IA ya generado
// (localStorage['smt_analisis_data']) para precargar Mastermind sin que el usuario
// tenga que reingresar datos ya conocidos.

import type { AnalisisData } from '@/lib/analisis/tipos'
import type { TerrenoContext } from './tipos'

export function extractTerrenoContext(d: AnalisisData | null | undefined): TerrenoContext {
  if (!d) {
    return { costoTerreno: 0, costoTerrenoM2: 0, superficieM2: 0 }
  }

  const costoTerreno = d.bitacoraTerreno?.costoTotalTerreno ?? d.financiero?.costoTerreno ?? 0
  const superficieM2 = d.bitacoraTerreno?.superficieM2 ?? 0
  const costoTerrenoM2 = d.financiero?.costoTerrenoM2 ?? (superficieM2 > 0 ? costoTerreno / superficieM2 : 0)

  return {
    costoTerreno,
    costoTerrenoM2,
    superficieM2,
    bandaTerreno: d.bitacoraTerreno?.bandaTerreno,
    municipio: d.fichaLegal?.municipio,
  }
}
