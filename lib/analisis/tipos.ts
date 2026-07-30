// Tipos del análisis de terreno generado por el pipeline de agentes IA.
// Hoisted desde app/analisis/page.tsx para que módulos de lib/ (p.ej. lib/mastermind)
// puedan importar el shape sin que lib/ dependa de app/.

import type { ResultadoValidacionMix, ResultadoValidacionSuperficie } from './envolventeYAreas'
import type { ResultadoValidacionIndirectos, ResultadoEscaladoMix } from './validacionFinanciera'

export interface StressItem {
  titulo: string
  escenario: string
  impacto: string
  status: 'green' | 'amber' | 'red'
}

export interface Fuente { nombre: string; tipo: string }
export interface Fuentes { legal?: Fuente[]; mercado?: Fuente[] }

// precioM2 puede venir null en la práctica: desde que Mercado recibe comparables reales
// (ver app/api/agentes/comparables-venta/route.ts), algunos solo traen precioTotal
// identificable, no precioM2 — y el modelo puede copiar ese comparable tal cual (visto en
// producción: tumbaba la página de Análisis con "Cannot read properties of null").
export interface Comparable { nombre: string; direccion: string; fechaReferencia: string; precioM2: number | null; avanceObra: string; unidades: number; tipologia: string }
export interface OfertaActiva { proyectosEnPreventa: number; proyectosEnObra: number; proyectosEntregados24m: number; unidadesDisponibles: number; rangoPrecios: string; saturacion: string }
export interface SegmentoUnidad { tipo: string; absorcionMensual: string; precioM2: number; participacion: string; perfilComprador: string }
export interface PricingFase { fase: string; precioM2: number; descuento: string; meta: string }

export interface Factibilidad { status: 'Disponible' | 'Con condicionante' | 'No disponible'; nota: string }
export interface AlertaLegal { tipo: string; descripcion: string; impacto: string; status: 'green' | 'amber' | 'red' }

export interface EstructuraCapital {
  equity: number; deuda: number; montoEquity: number; montoDeuda: number
  tipoDeuda: string; tasaDeuda: string; costoFinanciero: number
  // tasaDeudaAnual: versión numérica de tasaDeuda (que es texto libre, ej. "TIIE + 3.5%
  // anual (aprox. 14.5%)") — necesaria para calcular financiero.tir/tirProyecto en código
  // (ver lib/analisis/flujoFinanciero.ts). Opcional por compatibilidad con análisis
  // guardados antes de este campo.
  tasaDeudaAnual?: number
  preventa: { unidadesMinimas: number; porcentajeMinimo: string; montoMinimo: number; condicion: string }
  tasaDescuento: string; isrEstimado: number; utilidadNeta: number; descripcion: string
}
export interface FlujoMes { mes: number; fase: string; egresos: number; ingresos: number; acumulado: number; nota: string }
export interface FactorScore { factor: string; contribucion: string }
export interface DimensionScore { nombre: string; peso: string; score: number; factores: FactorScore[]; interpretacion: string }
export interface MetodologiaScore { descripcion: string; dimensiones: DimensionScore[] }

export interface AjusteTerreno {
  concepto: string
  descripcion: string
  factorAjuste: string
  impactoM2: number
}

export interface BitacoraTerreno {
  metodologia: string
  bandaTerreno?: number
  nombreBanda?: string
  justificacionBanda?: string
  nseReferencias?: string
  precioM2Referencia: number
  fuenteReferencia: string
  ajustes: AjusteTerreno[]
  precioM2Final: number
  superficieM2: number
  costoTotalTerreno: number
  formula: string
  razonamiento: string
  supuestos: string[]
  rangoValoracion: { minimo: number; maximo: number; interpretacion: string }
}

export interface AjusteConstruccion {
  concepto: string
  descripcion: string
  factorAjuste: string
  impactoM2: number
}

export interface PartidaConstruccion {
  partida: string
  porcentaje: number
  costoPorM2: number
  descripcion: string
}

export interface MaterialClave {
  material: string
  unidad: string
  cantidadPorM2: number
  precioUnitario: number
  costoPorM2: number
  nota: string
}

export interface ItemDesglose { concepto: string; monto: number }
export interface MixUnidad { tipo: string; unidades: number; m2Promedio: number }
export interface TipologiaPropuesta {
  niveles?: number
  habitacional?: { totalDepartamentos: number; mix: MixUnidad[] }
  comercial?: { totalLocales: number; niveles: number }
  tamanoAmenidades?: number
}

// Bitácora del Agente de Arquitectura (diseño: envolvente legal, tipología, mix de
// unidades) — separado del Agente de Construcción (que ahora solo costea el diseño que
// Arquitectura ya resolvió). Estos mismos campos viven HOY también dentro de
// BitacoraConstruccion por compatibilidad con análisis guardados antes de este split; la
// Fase 7 del refactor los retira de ahí. Usar siempre lib/analisis/bitacoraArquitectura.ts
// (resolveBitacoraArquitectura) para leerlos en vez de acceder a cualquiera de los dos
// campos directamente, así el fallback a datos viejos queda en un solo lugar.
export interface BitacoraArquitectura {
  tipologiaPropuesta?: TipologiaPropuesta
  superficieConstruida?: number
  superficieVendible?: number
  envolventeCalculada?: {
    areaMaxConstruible: number
    areaConstruida: { piso: number; base: number; techo: number }
    areaVendible: { piso: number; base: number; techo: number }
    eficienciaVendiblePct: { piso: number; base: number; techo: number }
  }
  validacionEnvolvente?: ResultadoValidacionMix
  validacionSuperficieConstruida?: ResultadoValidacionSuperficie
}

export interface BitacoraConstruccion {
  bandaElegida: number
  nombreBanda: string
  descripcionBanda: string
  costoPorM2Base: number
  ciudadAjuste: string
  tipologiaAjuste: string
  ajustes: AjusteConstruccion[]
  costoPorM2Final: number
  superficieConstruccionM2: number
  costoTotalConstruccion: number
  formula: string
  fuenteReferencia: string
  razonamiento: string
  supuestos: string[]
  rangoReferencia: { minimo: number; maximo: number; interpretacion: string }
  desglosePorPartidas?: PartidaConstruccion[]
  materialesPrincipales?: MaterialClave[]
  tipologiaPropuesta?: TipologiaPropuesta
  // Presentes solo en modo "usuario_define" (construcción interactiva vía lib/estimador,
  // ver app/analisis/analizando/page.tsx) — en ese modo no hay tipologiaPropuesta ni
  // superficieConstruccionM2, el usuario arma su propio programa y estos campos documentan
  // el resultado del estimador en su lugar (envolvente normativo + costo/m² paramétrico).
  modo?: 'agente_propone' | 'usuario_define'
  envolvente?: { construibleMax: number; huellaMax?: number; unidadesMax?: number }
  indicadores?: { costoPorM2Bruto?: { base: number; piso?: number; techo?: number } }
  // Presentes SOLO en modo "agente_propone" cuando Legal devolvió COS/CUS numéricos (ver
  // app/api/agentes/construccion/route.ts) — rango determinístico completo de
  // lib/analisis/envolventeYAreas.ts (calcularEnvolvente), distinto en forma del campo
  // `envolvente` de arriba (exclusivo de modo "usuario_define"). Ausentes si no había ficha
  // legal numérica para calcular el envolvente.
  envolventeCalculada?: {
    areaMaxConstruible: number
    areaConstruida: { piso: number; base: number; techo: number }
    areaVendible: { piso: number; base: number; techo: number }
    eficienciaVendiblePct: { piso: number; base: number; techo: number }
  }
  validacionEnvolvente?: ResultadoValidacionMix
  validacionSuperficieConstruida?: ResultadoValidacionSuperficie
  // Área vendible TOTAL real (habitacional + comercial, Zona 1 del Agente Construcción) que
  // Financiero usó para calcular ingresos — antes solo vivía de forma transitoria dentro del
  // pipeline en vivo (analizando/page.tsx) y se perdía al guardar el proyecto, dejando a
  // Mastermind sin forma de reconstruir el área vendible real cuando había componente
  // comercial (tip.comercial solo trae conteo de locales, no m²). Ausente en análisis
  // guardados antes de este campo.
  superficieVendible?: number
}

export interface AnalisisData {
  proyecto?: string
  bitacoraTerreno?: BitacoraTerreno
  bitacoraArquitectura?: BitacoraArquitectura
  bitacoraConstruccion?: BitacoraConstruccion
  recomendacion: { tipologia: string; descripcion: string }
  fichaLegal: {
    usoSueloActual?: string; usoSueloPermitido?: string; usoSuelo?: string
    compatible?: boolean; densidadAutorizada?: string
    cos: string; cus: string; altura: string; cajones: string
    retiros?: string; municipio: string; restriccion: string
    factibilidades?: { agua: Factibilidad; drenaje: Factibilidad; cfe: Factibilidad }
    regimenCondominio?: string; restriccionesAmbientales?: string
    nivelRiesgo?: 'Bajo' | 'Medio' | 'Alto'; alertasLegales?: AlertaLegal[]
  }
  financiero: {
    costoTerreno: number; costoTerrenoM2: number; construccionM2: number
    costoTotalConstruccion: number; indirectos: number; honorarios: number
    imprevistos: number; inversionTotal: number; precioVentaM2: number
    ingresosProyectados: number; utilidadBruta: number; margenBruto: number
    // tir = TIR Socio (apalancada, la que le toca a quien pone el equity) — antes la
    // "razonaba" el modelo como un solo número que podía contradecir margenBruto; ahora se
    // calcula en código a partir de un flujo de caja mensual determinista (ver
    // lib/analisis/flujoFinanciero.ts), igual que ya hacía Mastermind. Puede ser null si el
    // flujo no tiene una raíz calculable (caso raro, ver tirConverge).
    tir: number | null
    tirConverge?: boolean
    // tirProyecto = TIR sin apalancar (como si todo el proyecto se pagara de contado) —
    // separa "qué tan bueno es el negocio" de "qué tan bien le va a quien puso el equity
    // con esta estructura de deuda". Opcional por compatibilidad con análisis guardados
    // antes de este campo.
    tirProyecto?: number | null
    tirProyectoConverge?: boolean
    // Duraciones calculadas por el Agente Financiero según escala del proyecto y absorción
    // de mercado (no la plantilla fija de flujoMensual) — opcionales porque análisis previos
    // a este campo no lo traen. Ver lib/mastermind/contexto.ts para cómo se usan en Mastermind.
    plazoObraMeses?: number; plazoVentaMeses?: number; inicioVentasMes?: number
    // Desglose de indirectos/honorarios/imprevistos por concepto — opcional (análisis previos
    // a este campo solo traen el total). Cada arreglo debe sumar aproximadamente el total
    // correspondiente (indirectos/honorarios/imprevistos), que NO cambia — esto es un desglose
    // informativo del mismo monto, no un recálculo.
    indirectosDesglose?: ItemDesglose[]
    honorariosDesglose?: ItemDesglose[]
    imprevistosDesglose?: ItemDesglose[]
    // Legado — de cuando tir venía del modelo y podía quedar desactualizada respecto al
    // margenBruto recalculado en código. Ya no se genera para análisis nuevos (tir ahora es
    // determinista, ver arriba), se deja opcional solo para no romper análisis guardados viejos.
    tirPuedeEstarDesactualizada?: boolean
    // Costos reales que antes no se modelaban aquí (Mastermind sí los cobraba desde el
    // principio) — se calculan en código con las mismas constantes de lib/mastermind/catalogo.ts
    // (DESCUENTOS_CANCELACIONES, PORCENTAJE_COMERCIALIZACION), no los estima el modelo.
    // ingresosProyectados sigue siendo el ingreso BRUTO (sin cambiar su significado anterior);
    // ingresosNetos = ingresosProyectados − descuentos, y es lo que ya usa utilidadBruta/margenBruto.
    descuentos?: number
    comercializacion?: number
    ingresosNetos?: number
    // Señala si indirectos/honorarios/imprevistos (montos que el modelo elige libremente)
    // se salieron del % esperado sobre costoTotalConstruccion — ver
    // lib/analisis/validacionFinanciera.ts. No bloqueante, solo anota.
    validacionIndirectos?: ResultadoValidacionIndirectos
    // costoTotalConstruccion (arriba) ya viene escalado hacia abajo si el mix de unidades
    // aprovecha menos área vendible de la que Construcción costeó — este campo documenta el
    // ajuste (factor, eficiencia, costo original) para que el reporte no se vea como un error
    // de aritmética. Ver lib/analisis/validacionFinanciera.ts (escalarCostoPorMix).
    escaladoPorMix?: ResultadoEscaladoMix
    // precioVentaM2 (arriba) ya viene limitado al techo plausible de la banda de construcción
    // si el modelo eligió un precio de zona premium no representativo — este campo documenta
    // el ajuste (valor original del modelo vs. el usado) para que el reporte sea transparente.
    // Ver lib/mercado/validarComparableVenta.ts (evaluarPlausibilidadBanda).
    precioVentaAjustadoPorBanda?: {
      precioVentaM2Modelo: number
      precioVentaM2Ajustado: number
      techoBandaConstruccion: number
    }
  }
  mercado: {
    demanda: string; zona: string; absorcion: string; proyectosActivos: string
    precioPromedioZona: string; perfilNSE: string; plusvalia: string; inventario: string
    productoRecomendado: string
    comparables?: Comparable[]
    ofertaActiva?: OfertaActiva
    segmentacion?: SegmentoUnidad[]
    pricingFases?: PricingFase[]
  }
  estructuraCapital?: EstructuraCapital
  flujoMensual?: FlujoMes[]
  score: { total: number; solidezFinanciera: number; riesgoRegulatorio: number; exposicionMercado: number }
  metodologiaScore?: MetodologiaScore
  stressTest: StressItem[]
  puntoQuiebre: { desviacionMaxCostos: string; absorcionMinViable: string; precioVentaMinimo: string; resumen: string }
  fuentes?: Fuentes
}
