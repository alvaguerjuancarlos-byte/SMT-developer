// Extracción defensiva del contexto de terreno/proyecto/mercado/financiamiento desde
// el análisis IA ya generado (localStorage['smt_analisis_data']) para precargar
// Mastermind sin que el usuario tenga que reingresar datos ya conocidos.

import type { AnalisisData } from '@/lib/analisis/tipos'
import { BENCHMARKS_CONSTRUCCION_MXN_M2 } from './catalogo'
import type { BenchmarkConstruccion, InputsFinanciamiento, InputsMercado, InputsProyecto, InputsTiempo, TerrenoContext, TipoProyecto } from './tipos'

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

// Benchmark de costo de construcción más cercano al costo real que ya validó el
// Agente Construcción — más robusto que mapear por número de banda porque se
// ancla al $/m² efectivo en vez de una escala 1-4 que no corresponde 1:1 con
// las 6 categorías del catálogo.
function benchmarkMasCercano(costoPorM2Final: number): BenchmarkConstruccion {
  let mejor: BenchmarkConstruccion = 'habitacional_medio'
  let mejorDiff = Infinity
  for (const [key, valor] of Object.entries(BENCHMARKS_CONSTRUCCION_MXN_M2)) {
    const diff = Math.abs(valor - costoPorM2Final)
    if (diff < mejorDiff) { mejorDiff = diff; mejor = key as BenchmarkConstruccion }
  }
  return mejor
}

// El Agente Financiero corre igual sin importar el modo de construcción (agente_propone o
// usuario_define), así que la calibración de indirectos aplica a ambos por igual — se calcula
// una sola vez y se mezcla en el resultado de cualquier rama de extractProyectoContext.
// Nota: comercialización y descuentos NO se calibran — se quedan fijos (decisión del usuario,
// ver catalogo.ts), el análisis no modela esos rubros por separado.
function calibrarPorcentajeIndirectos(d: AnalisisData | null | undefined): number | undefined {
  const overheadReal = (d?.financiero?.indirectos ?? 0) + (d?.financiero?.honorarios ?? 0) + (d?.financiero?.imprevistos ?? 0)
  const costoConstruccionReal = d?.financiero?.costoTotalConstruccion ?? 0
  return costoConstruccionReal > 0 && overheadReal > 0
    ? Math.round((overheadReal / costoConstruccionReal) * 1000) / 10
    : undefined
}

export function extractProyectoContext(d: AnalisisData | null | undefined): Partial<InputsProyecto> {
  const bc = d?.bitacoraConstruccion
  const tip = bc?.tipologiaPropuesta
  const out: Partial<InputsProyecto> = {}

  const porcentajeIndirectos = calibrarPorcentajeIndirectos(d)
  if (porcentajeIndirectos !== undefined) out.porcentajeIndirectos = porcentajeIndirectos

  // superficieConstruccionM2/costoPorM2Final son campos "base" de BitacoraConstruccion que
  // existen desde antes de que se agregara tipologiaPropuesta (el desglose de tipología es
  // más nuevo, solo para el bridge con Mastermind) — así que se leen SIEMPRE, sin importar si
  // hay tipologiaPropuesta o no. Un análisis viejo, o uno en modo "usuario_define", puede tener
  // uno sin el otro. Fallbacks en orden: campo base → envolvente/indicadores (usuario_define)
  // → derivado del financiero real (costoTotalConstruccion / superficie), si no hay nada mejor.
  const superficieConstruida = (bc?.superficieConstruccionM2 && bc.superficieConstruccionM2 > 0)
    ? bc.superficieConstruccionM2
    : bc?.envolvente?.construibleMax
  if (superficieConstruida && superficieConstruida > 0) out.superficieConstruccionM2 = Math.round(superficieConstruida)

  const costoPorM2 = bc?.costoPorM2Final
    ?? bc?.indicadores?.costoPorM2Bruto?.base
    ?? (superficieConstruida && superficieConstruida > 0 && d?.financiero?.costoTotalConstruccion
      ? d.financiero.costoTotalConstruccion / superficieConstruida
      : undefined)
  if (costoPorM2) {
    out.benchmarkConstruccion = benchmarkMasCercano(costoPorM2)
    out.costoConstruccionRealM2 = Math.round(costoPorM2)
  }
  if (bc?.bandaElegida) out.bandaConstruccion = bc.bandaElegida

  // Lo que sigue SÍ requiere tipologiaPropuesta — solo el modo "agente_propone" desglosa
  // niveles/unidades/mix de tipologías. Sin eso (análisis viejo o modo "usuario_define"),
  // estos campos se quedan en los defaults del catálogo, editables a mano en el drawer.
  if (!tip) return out

  const tieneHab = !!tip.habitacional
  const tieneCom = !!tip.comercial
  const tipoProyecto: TipoProyecto | undefined =
    tieneHab && tieneCom ? 'vertical_mixto' : tieneCom ? 'comercial' : tieneHab ? 'habitacional' : undefined
  if (tipoProyecto) out.tipoProyecto = tipoProyecto

  if (tip.niveles) out.niveles = tip.niveles

  const mix = tip.habitacional?.mix ?? []
  const totalUnidades = mix.reduce((s, r) => s + (r.unidades || 0), 0)
  if (tip.habitacional && totalUnidades > 0) {
    // unidadesHabitacionales SIEMPRE sale de totalUnidades (suma del mix), no de
    // totalDepartamentos — son dos campos separados que la IA no valida entre sí, y si
    // no coinciden, unidadesHabitacionales × m2PromedioDepa deja de representar el área
    // real del mix (unidadesHabitacionales sería de una fuente, m2PromedioDepa de otra).
    // Usar totalUnidades para ambos garantiza que el producto sea exacto al mix real.
    out.unidadesHabitacionales = totalUnidades
    const m2Ponderado = mix.reduce((s, r) => s + (r.unidades || 0) * (r.m2Promedio || 0), 0) / totalUnidades
    out.m2PromedioDepa = Math.round(m2Ponderado)
  }

  if (tip.comercial) {
    const areaHab = (out.unidadesHabitacionales ?? 0) * (out.m2PromedioDepa ?? 0)
    out.m2ComercialesPlantaBaja = Math.max(0, Math.round((superficieConstruida ?? 0) - areaHab))
  }

  return out
}

export function extractMercadoContext(d: AnalisisData | null | undefined): Partial<InputsMercado> {
  if (!d) return {}
  const out: Partial<InputsMercado> = {}

  const precioVentaM2 = d.financiero?.precioVentaM2
  if (precioVentaM2) {
    out.precioVentaDepasM2 = precioVentaM2
  } else {
    const digitos = Number((d.mercado?.precioPromedioZona ?? '').replace(/[^0-9]/g, ''))
    if (digitos > 0) out.precioVentaDepasM2 = digitos
  }

  const segmentoLocal = d.mercado?.segmentacion?.find(s => /local|comercial/i.test(s.tipo))
  if (segmentoLocal?.precioM2) out.precioLocalesM2 = segmentoLocal.precioM2

  return out
}

// Solo disponible si el análisis se corrió después de que el Agente Financiero empezara a
// calcular duraciones reales (en vez de la plantilla fija de 9 hitos con meses 1,2,3,4,6,10,
// 14,16,18) — análisis previos a ese cambio no traen estos campos, y Mastermind se queda en
// los defaults del catálogo (18/24/6 meses), igual que hoy.
export function extractTiempoContext(d: AnalisisData | null | undefined): Partial<InputsTiempo> {
  const f = d?.financiero
  const out: Partial<InputsTiempo> = {}
  if (f?.plazoObraMeses && f.plazoObraMeses > 0) out.plazoObraMeses = f.plazoObraMeses
  if (f?.plazoVentaMeses && f.plazoVentaMeses > 0) out.plazoVentaMeses = f.plazoVentaMeses
  if (f?.inicioVentasMes !== undefined && f.inicioVentasMes >= 0) out.inicioVentasMes = f.inicioVentasMes
  return out
}

export function extractFinanciamientoContext(d: AnalisisData | null | undefined): Partial<InputsFinanciamiento> {
  if (!d?.estructuraCapital) return {}
  const out: Partial<InputsFinanciamiento> = {}

  if (typeof d.estructuraCapital.deuda === 'number') {
    out.porcentajeFinanciado = d.estructuraCapital.deuda
  }

  const tasas = [...(d.estructuraCapital.tasaDeuda ?? '').matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
  if (tasas.length > 0) {
    out.tasaAnualCredito = Number(tasas[tasas.length - 1][1])
  }

  return out
}
