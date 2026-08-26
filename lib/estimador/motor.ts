// Motor de cálculo del Estimador de Costos SMT Developer
// Módulo TypeScript puro — sin LLM, sin efectos secundarios, 100% determinístico.
// Cada función es pura y componible; el orchestrator calcular() las ensambla en secuencia.

import type {
  InputsNormativos,
  InputsProyecto,
  UsoDesarrollo,
  GeneroConstructivo,
  EnvolventeNormativo,
  DesgloseCajones,
  DesgloseCajonPorUso,
  PorcionCosto,
  Rango,
  ResultadoEstimador,
} from './tipos'

import {
  COSTOS_PARAMETRICOS,
  FACTORES_EFICIENCIA,
  FACTORES_INDIRECTOS,
  RATIOS_CAJONES_REFERENCIA,
} from './catalogo'

// ── Helpers internos ──────────────────────────────────────────────────────────

const GENEROS_VIVIENDA: GeneroConstructivo[] = [
  'vivienda_interes_social',
  'vivienda_residencial_media',
  'vivienda_residencial_lujo',
]

function isVivienda(g: GeneroConstructivo): boolean {
  return GENEROS_VIVIENDA.includes(g)
}

function eficienciaBase(g: GeneroConstructivo): Rango {
  const [min, max] = FACTORES_EFICIENCIA[g]
  const base = (min + max) / 2
  return { piso: min, base, techo: max }
}

function fmtMXN(n: number): string {
  return `$${n.toLocaleString('es-MX')}`
}

// ── Capa 2 — Envolvente normativo ─────────────────────────────────────────────
// Deriva las restricciones normativas del predio e identifica cuál limita el proyecto.

export function envolventeNormativo(
  normativos: InputsNormativos,
  proyecto: InputsProyecto,
): EnvolventeNormativo {
  const { sTerreno, cos, cus, cas, densidad } = normativos

  const huellaMax       = sTerreno * cos
  const construibleMax  = sTerreno * cus
  const permeableMin    = sTerreno * cas
  const nivelesTeóricos = cus / cos

  const unidadesMax = densidad !== undefined
    ? (sTerreno / 10_000) * densidad
    : undefined

  const totalSobreRasante = proyecto.usos.reduce((s, u) => s + u.m2Bruto, 0)

  const bindingConstraint = _determinarBindingConstraint(
    normativos, { huellaMax, construibleMax, unidadesMax }, totalSobreRasante, proyecto,
  )

  const { cumple, excesoPct } = _evaluarCumplimiento(
    { construibleMax, unidadesMax }, totalSobreRasante, proyecto,
  )

  return { huellaMax, construibleMax, permeableMin, nivelesTeóricos, unidadesMax, bindingConstraint, cumple, excesoPct }
}

// Chequeo de cumplimiento explícito (booleano) — bindingConstraint arriba es solo texto
// descriptivo para el reporte; esto es lo que la UI usa para el banner cumple/no cumple.
function _evaluarCumplimiento(
  env: { construibleMax: number; unidadesMax?: number },
  totalSobreRasante: number,
  proyecto: InputsProyecto,
): { cumple: boolean; excesoPct?: number } {
  if (env.unidadesMax !== undefined) {
    const totalUnidades = proyecto.usos
      .filter(u => isVivienda(u.genero))
      .reduce((s, u) => {
        const units = u.unidades
          ?? Math.round(u.m2Bruto / RATIOS_CAJONES_REFERENCIA.vivienda.m2PorUnidadDefault)
        return s + units
      }, 0)

    if (totalUnidades > env.unidadesMax) {
      return { cumple: false, excesoPct: ((totalUnidades - env.unidadesMax) / env.unidadesMax) * 100 }
    }
  }

  if (totalSobreRasante > env.construibleMax) {
    return { cumple: false, excesoPct: ((totalSobreRasante - env.construibleMax) / env.construibleMax) * 100 }
  }

  return { cumple: true }
}

function _determinarBindingConstraint(
  normativos: InputsNormativos,
  env: { huellaMax: number; construibleMax: number; unidadesMax?: number },
  totalSobreRasante: number,
  proyecto: InputsProyecto,
): string {
  // Densidad puede limitar antes que CUS en proyectos residenciales
  if (env.unidadesMax !== undefined) {
    const totalUnidades = proyecto.usos
      .filter(u => isVivienda(u.genero))
      .reduce((s, u) => {
        const units = u.unidades
          ?? Math.round(u.m2Bruto / RATIOS_CAJONES_REFERENCIA.vivienda.m2PorUnidadDefault)
        return s + units
      }, 0)

    if (totalUnidades >= env.unidadesMax) {
      return (
        `Densidad: máx ${Math.ceil(env.unidadesMax)} unidades ` +
        `(${normativos.densidad} viv/ha) — limita antes que CUS`
      )
    }
  }

  if (totalSobreRasante >= env.construibleMax) {
    return (
      `CUS ${normativos.cus}: construible máx ` +
      `${Math.round(env.construibleMax).toLocaleString('es-MX')} m²`
    )
  }

  return (
    `COS ${normativos.cos}: huella máx ${Math.round(env.huellaMax).toLocaleString('es-MX')} m² ` +
    `(programa usa ${totalSobreRasante.toLocaleString('es-MX')} m² — CUS no es la restricción activa)`
  )
}

// ── Capa 3a — Derivación de estacionamiento (§6) ─────────────────────────────
// Tres pasos: cajones por uso → total con visitas → área de sótano.
// Si falta la norma del Agente Legal, cae al ratio de referencia y lo registra en supuestos[].

export function derivarEstacionamiento(
  proyecto: InputsProyecto,
  normativos: InputsNormativos,
): { cajones: DesgloseCajones; supuestos: string[] } {
  const supuestos: string[] = []
  const normaCaj = normativos.normaCajones
  const sinNorma = !normaCaj

  if (sinNorma) {
    supuestos.push(
      '[Estacionamiento §6] Sin norma de cajones del Agente Legal — ' +
      'se usan ratios de referencia ZMM (§6). Resultado SUJETO A VALIDACIÓN NORMATIVA. ' +
      'Corregir: proveer InputsNormativos.normaCajones con la norma del municipio.',
    )
  }

  // Área efectiva por cajón (nunca usar 12.5 m² del cajón físico — §6)
  const areaPorCajon = normaCaj?.areaPorCajonM2 ?? RATIOS_CAJONES_REFERENCIA.areaPorCajon.base
  if (!normaCaj?.areaPorCajonM2) {
    supuestos.push(
      `[Estacionamiento §6] Área efectiva por cajón: ${areaPorCajon} m² ` +
      `(referencia conservadora, rango 25–30 m² — nunca usar 12.5 m² del cajón físico). ` +
      `Corregir: normaCajones.areaPorCajonM2 o RATIOS_CAJONES_REFERENCIA.areaPorCajon.base en catalogo.ts.`,
    )
  }

  // PASO 1: cajones por uso
  const porUso: DesgloseCajonPorUso[] = []
  let subtotal = 0

  for (const uso of proyecto.usos) {
    if (uso.genero === 'estacionamiento_sotano' || uso.genero === 'amenidades_comunes') continue

    if (isVivienda(uso.genero)) {
      const normViv = normaCaj?.vivienda
      const ratio   = normViv?.ratio ?? RATIOS_CAJONES_REFERENCIA.vivienda.ratio

      // Derivar unidades si no se proveen explícitamente
      let units = uso.unidades
      if (units === undefined) {
        const m2PorUnid = RATIOS_CAJONES_REFERENCIA.vivienda.m2PorUnidadDefault
        units = Math.round(uso.m2Bruto / m2PorUnid)
        supuestos.push(
          `[Estacionamiento §6] ${uso.genero}: UsoDesarrollo.unidades NO provistas — ` +
          `se estiman ${units} unidades (${uso.m2Bruto} m² ÷ ${m2PorUnid} m²/unidad por defecto). ` +
          `Corregir: proveer UsoDesarrollo.unidades para mayor exactitud.`,
        )
      }

      const cajones = units * ratio
      subtotal += cajones

      porUso.push({
        genero: uso.genero,
        cajones,
        supuesto: normViv
          ? `Norma del reglamento: ${ratio} cajones/unidad`
          : `Fallback §6 (ZMM): ${ratio} cajones/unidad ` +
            `(rango ${RATIOS_CAJONES_REFERENCIA.vivienda.ratioMin}–${RATIOS_CAJONES_REFERENCIA.vivienda.ratioMax}). ` +
            `${units} unidades × ${ratio} = ${cajones} cajones.`,
      })

    } else if (uso.genero === 'oficinas') {
      const normOfi  = normaCaj?.oficinas
      const ratio    = normOfi?.ratio ?? RATIOS_CAJONES_REFERENCIA.oficinas.ratio
      const efic     = eficienciaBase('oficinas').base
      const m2Rent   = uso.m2Bruto * efic
      const cajones  = m2Rent * ratio
      subtotal += cajones

      porUso.push({
        genero: 'oficinas',
        cajones,
        supuesto: normOfi
          ? `Norma del reglamento: 1 cajón / ${Math.round(1 / ratio)} m² rentable`
          : `Fallback §6 (ZMM): 1 cajón / ${Math.round(1 / ratio)} m² rentable ` +
            `(rango 1/${Math.round(1 / RATIOS_CAJONES_REFERENCIA.oficinas.ratioMax)}–` +
            `1/${Math.round(1 / RATIOS_CAJONES_REFERENCIA.oficinas.ratioMin)}). ` +
            `${uso.m2Bruto} m² × efic. ${efic.toFixed(2)} = ${m2Rent.toFixed(0)} m² rentables → ${cajones.toFixed(1)} cajones.`,
      })

    } else if (uso.genero === 'comercio') {
      const normCom  = normaCaj?.comercio
      const ratio    = normCom?.ratio ?? RATIOS_CAJONES_REFERENCIA.comercio.ratio
      const efic     = eficienciaBase('comercio').base
      const m2Rent   = uso.m2Bruto * efic
      const cajones  = m2Rent * ratio
      subtotal += cajones

      porUso.push({
        genero: 'comercio',
        cajones,
        supuesto: normCom
          ? `Norma del reglamento: 1 cajón / ${Math.round(1 / ratio)} m² rentable`
          : `Fallback §6 (ZMM): 1 cajón / ${Math.round(1 / ratio)} m² rentable ` +
            `(rango 1/${Math.round(1 / RATIOS_CAJONES_REFERENCIA.comercio.ratioMax)}–` +
            `1/${Math.round(1 / RATIOS_CAJONES_REFERENCIA.comercio.ratioMin)}). ` +
            `${uso.m2Bruto} m² × efic. ${efic.toFixed(2)} = ${m2Rent.toFixed(0)} m² rentables → ${cajones.toFixed(1)} cajones.`,
      })

    } else if (uso.genero !== 'nave_industrial') {
      // Géneros sin ratio definido — registrar en supuestos
      supuestos.push(
        `[Estacionamiento §6] ${uso.genero}: sin ratio de cajones en el catálogo — ` +
        `no contribuye al cómputo. Revisar si el reglamento aplica cajones para este uso.`,
      )
    }
  }

  // PASO 2: cajones de visita
  const fraccVisitas = normaCaj?.visitas ?? RATIOS_CAJONES_REFERENCIA.visitas.fraccion
  if (!normaCaj?.visitas) {
    supuestos.push(
      `[Estacionamiento §6] Cajones de visita: ${fraccVisitas * 100}% sobre subtotal ` +
      `(referencia §6, rango ` +
      `${RATIOS_CAJONES_REFERENCIA.visitas.fraccionMin * 100}–` +
      `${RATIOS_CAJONES_REFERENCIA.visitas.fraccionMax * 100}%). ` +
      `Corregir: normaCajones.visitas.`,
    )
  }

  const cajonesVisitaFloat = subtotal * fraccVisitas
  const cajonesTotales     = Math.ceil(subtotal + cajonesVisitaFloat)
  const cajonesVisita      = Math.round(cajonesVisitaFloat)

  // PASO 3: área de sótano
  const areaM2 = cajonesTotales * areaPorCajon

  const supuestoAplicado = sinNorma
    ? `Estacionamiento por fallback §6: ${cajonesTotales} cajones × ${areaPorCajon} m²/cajón = ${areaM2.toLocaleString('es-MX')} m²`
    : undefined

  return {
    cajones: { porUso, cajonesVisita, cajonesTotales, areaPorCajon, areaM2, supuestoAplicado },
    supuestos,
  }
}

// ── Capa 3b — Programa de áreas ───────────────────────────────────────────────
// Separa área total construida vs área vendible (§5 Capa 3).
// ÁREA QUE CUESTA ≠ ÁREA QUE SE VENDE — la brecha es el estacionamiento + amenidades.

export function programaDeAreas(
  usos: UsoDesarrollo[],
  cajones: DesgloseCajones,
): { sobreRasante: number; sotano: number; total: number; vendible: number; vendibleRango: Rango; supuestos: string[] } {
  const supuestos: string[] = []

  const sobreRasante = usos.reduce((s, u) => s + u.m2Bruto, 0)
  const sotano       = cajones.areaM2
  const total        = sobreRasante + sotano

  let vendiblePisoFloat = 0
  let vendibleBaseFloat = 0
  let vendibleTechoFloat = 0
  for (const uso of usos) {
    const efic    = eficienciaBase(uso.genero)
    const m2Vend: Rango = {
      piso:  uso.m2Bruto * efic.piso,
      base:  uso.m2Bruto * efic.base,
      techo: uso.m2Bruto * efic.techo,
    }
    vendiblePisoFloat  += m2Vend.piso
    vendibleBaseFloat  += m2Vend.base
    vendibleTechoFloat += m2Vend.techo

    if (efic.base > 0) {
      supuestos.push(
        `[Eficiencia §5] ${uso.genero}: rango ${efic.piso.toFixed(3)}–${efic.techo.toFixed(3)} ` +
        `(base ${efic.base.toFixed(3)}). ` +
        `Área vendible estimada: ${Math.round(m2Vend.base).toLocaleString('es-MX')} m² ` +
        `(rango ${Math.round(m2Vend.piso).toLocaleString('es-MX')}–${Math.round(m2Vend.techo).toLocaleString('es-MX')} m²). ` +
        `Corregir rango en FACTORES_EFICIENCIA en lib/estimador/catalogo.ts.`,
      )
    }
  }

  // Redondear a 2 decimales para evitar drift de punto flotante
  const vendibleRango: Rango = {
    piso:  Math.round(vendiblePisoFloat * 100) / 100,
    base:  Math.round(vendibleBaseFloat * 100) / 100,
    techo: Math.round(vendibleTechoFloat * 100) / 100,
  }
  // Campo escalar de compatibilidad — mismo valor que antes del fix (colapsado a .base).
  const vendible = vendibleRango.base

  return { sobreRasante, sotano, total, vendible, vendibleRango, supuestos }
}

// ── Capa 4 — Costo directo de obra ───────────────────────────────────────────
// Aplica el $/m² del catálogo a cada porción de área.
// El estacionamiento se agrega como porción separada (§7 regla 2).

export function calcularCostoDirecto(
  usos: UsoDesarrollo[],
  cajones: DesgloseCajones,
): { porciones: PorcionCosto[]; total: Rango; supuestos: string[] } {
  const supuestos: string[] = []
  const porciones: PorcionCosto[] = []

  for (const uso of usos) {
    const c = COSTOS_PARAMETRICOS[uso.genero]
    porciones.push({
      genero: uso.genero,
      areaM2: uso.m2Bruto,
      costoM2: c,
      costoDirecto: {
        piso:  uso.m2Bruto * c.piso,
        base:  uso.m2Bruto * c.base,
        techo: uso.m2Bruto * c.techo,
      },
    })
    supuestos.push(
      `[Catálogo §8] ${uso.genero}: ` +
      `${fmtMXN(c.base)}/m² base (rango ${fmtMXN(c.piso)}–${fmtMXN(c.techo)}). ` +
      `Fuente: CMIC/Bimsa 2026. ` +
      `Corregir: COSTOS_PARAMETRICOS.${uso.genero} en lib/estimador/catalogo.ts.`,
    )
  }

  // Estacionamiento como porción propia (§7 regla 2) — puede ser la 2ª partida más grande
  if (cajones.areaM2 > 0) {
    const c = COSTOS_PARAMETRICOS['estacionamiento_sotano']
    porciones.push({
      genero: 'estacionamiento_sotano',
      areaM2: cajones.areaM2,
      costoM2: c,
      costoDirecto: {
        piso:  cajones.areaM2 * c.piso,
        base:  cajones.areaM2 * c.base,
        techo: cajones.areaM2 * c.techo,
      },
    })
    supuestos.push(
      `[Catálogo §8] estacionamiento_sotano ` +
      `(${cajones.cajonesTotales} cajones, ${cajones.areaM2.toLocaleString('es-MX')} m²): ` +
      `${fmtMXN(c.base)}/m² base (rango ${fmtMXN(c.piso)}–${fmtMXN(c.techo)}). ` +
      `Si es sótano excavado, considerar sobrecoste de cimentación especial. ` +
      `Corregir: COSTOS_PARAMETRICOS.estacionamiento_sotano en lib/estimador/catalogo.ts.`,
    )
  }

  const total: Rango = {
    piso:  porciones.reduce((s, p) => s + p.costoDirecto.piso,  0),
    base:  porciones.reduce((s, p) => s + p.costoDirecto.base,  0),
    techo: porciones.reduce((s, p) => s + p.costoDirecto.techo, 0),
  }

  return { porciones, total, supuestos }
}

// ── Capa 5 — Indirectos y costos blandos ─────────────────────────────────────
// Aplica el factor agregado piso/base/techo sobre el costo directo.

export function calcularCostoTotal(directo: Rango): Rango {
  return {
    piso:  directo.piso  * FACTORES_INDIRECTOS.piso,
    base:  directo.base  * FACTORES_INDIRECTOS.base,
    techo: directo.techo * FACTORES_INDIRECTOS.techo,
  }
}

// ── Capa 6 — Indicadores ──────────────────────────────────────────────────────
// La brecha entre $/m²_bruto y $/m²_vendible debe hacerse explícita (§10).

export function calcularIndicadores(
  costoTotal: Rango,
  areas: { total: number; vendibleRango: Rango },
): { costoPorM2Bruto: Rango; costoPorM2Vendible: Rango } {
  return {
    costoPorM2Bruto: {
      piso:  costoTotal.piso  / areas.total,
      base:  costoTotal.base  / areas.total,
      techo: costoTotal.techo / areas.total,
    },
    costoPorM2Vendible: {
      piso:  costoTotal.piso  / areas.vendibleRango.piso,
      base:  costoTotal.base  / areas.vendibleRango.base,
      techo: costoTotal.techo / areas.vendibleRango.techo,
    },
  }
}

// ── Orchestrator — calcular() ─────────────────────────────────────────────────
// Ensambla las 6 capas en secuencia y agrega todos los supuestos en un único array.

export function calcular(
  normativos: InputsNormativos,
  proyecto: InputsProyecto,
): ResultadoEstimador {
  const allSupuestos: string[] = []

  // Capa 2
  const envolvente = envolventeNormativo(normativos, proyecto)
  allSupuestos.push(
    `[Envolvente §5] Binding constraint: ${envolvente.bindingConstraint}.`,
  )
  allSupuestos.push(
    `[Envolvente §5] Niveles teóricos: ${envolvente.nivelesTeóricos.toFixed(1)} ` +
    `(CUS ${normativos.cus} / COS ${normativos.cos}).`,
  )
  if (envolvente.unidadesMax !== undefined) {
    allSupuestos.push(
      `[Envolvente §5] Unidades máx por densidad: ${Math.ceil(envolvente.unidadesMax)} ` +
      `(${normativos.densidad} viv/ha sobre ${normativos.sTerreno.toLocaleString('es-MX')} m²).`,
    )
  }

  // Capa 3a — Estacionamiento
  const { cajones, supuestos: supCajones } = derivarEstacionamiento(proyecto, normativos)
  allSupuestos.push(...supCajones)
  if (cajones.supuestoAplicado) {
    allSupuestos.push(`[Estacionamiento resumen] ${cajones.supuestoAplicado}`)
  }
  // Supuestos por uso
  for (const porUso of cajones.porUso) {
    if (porUso.supuesto) {
      allSupuestos.push(`[Cajones] ${porUso.genero}: ${porUso.supuesto}`)
    }
  }

  // Capa 3b — Áreas
  const { sobreRasante, sotano, total, vendible, vendibleRango, supuestos: supAreas } =
    programaDeAreas(proyecto.usos, cajones)
  allSupuestos.push(...supAreas)
  allSupuestos.push(
    `[Programa de áreas] Sobre rasante: ${sobreRasante.toLocaleString('es-MX')} m² | ` +
    `Sótano: ${sotano.toLocaleString('es-MX')} m² | ` +
    `Total que CUESTA: ${total.toLocaleString('es-MX')} m² | ` +
    `Vendible (denom. comercial): ${Math.round(vendible).toLocaleString('es-MX')} m² ` +
    `(rango ${Math.round(vendibleRango.piso).toLocaleString('es-MX')}–${Math.round(vendibleRango.techo).toLocaleString('es-MX')} m²).`,
  )

  // Capa 4 — Costo directo
  const { porciones, total: costoDirectoTotal, supuestos: supCostos } =
    calcularCostoDirecto(proyecto.usos, cajones)
  allSupuestos.push(...supCostos)

  // Capa 5 — Costo total
  const costoTotal = calcularCostoTotal(costoDirectoTotal)
  allSupuestos.push(
    `[Indirectos §5] Factores aplicados — ` +
    `piso ×${FACTORES_INDIRECTOS.piso}, ` +
    `base ×${FACTORES_INDIRECTOS.base}, ` +
    `techo ×${FACTORES_INDIRECTOS.techo}. ` +
    `Corregir: FACTORES_INDIRECTOS en lib/estimador/catalogo.ts.`,
  )

  // Capa 6 — Indicadores
  const indicadores = calcularIndicadores(costoTotal, { total, vendibleRango })

  return {
    envolvente,
    cajones,
    areas: { sobreRasante, sotano, total, vendible, vendibleRango },
    porciones,
    costoDirectoTotal,
    costoTotal,
    indicadores,
    supuestos: allSupuestos,
  }
}
