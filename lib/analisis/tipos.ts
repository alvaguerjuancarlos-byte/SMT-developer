// Tipos del análisis de terreno generado por el pipeline de agentes IA.
// Hoisted desde app/analisis/page.tsx para que módulos de lib/ (p.ej. lib/mastermind)
// puedan importar el shape sin que lib/ dependa de app/.

export interface StressItem {
  titulo: string
  escenario: string
  impacto: string
  status: 'green' | 'amber' | 'red'
}

export interface Fuente { nombre: string; tipo: string }
export interface Fuentes { legal?: Fuente[]; mercado?: Fuente[] }

export interface Comparable { nombre: string; direccion: string; fechaReferencia: string; precioM2: number; avanceObra: string; unidades: number; tipologia: string }
export interface OfertaActiva { proyectosEnPreventa: number; proyectosEnObra: number; proyectosEntregados24m: number; unidadesDisponibles: number; rangoPrecios: string; saturacion: string }
export interface SegmentoUnidad { tipo: string; absorcionMensual: string; precioM2: number; participacion: string; perfilComprador: string }
export interface PricingFase { fase: string; precioM2: number; descuento: string; meta: string }

export interface Factibilidad { status: 'Disponible' | 'Con condicionante' | 'No disponible'; nota: string }
export interface AlertaLegal { tipo: string; descripcion: string; impacto: string; status: 'green' | 'amber' | 'red' }

export interface EstructuraCapital {
  equity: number; deuda: number; montoEquity: number; montoDeuda: number
  tipoDeuda: string; tasaDeuda: string; costoFinanciero: number
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

export interface MixUnidad { tipo: string; unidades: number; m2Promedio: number }
export interface TipologiaPropuesta {
  niveles?: number
  habitacional?: { totalDepartamentos: number; mix: MixUnidad[] }
  comercial?: { totalLocales: number; niveles: number }
  tamanoAmenidades?: number
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
}

export interface AnalisisData {
  proyecto?: string
  bitacoraTerreno?: BitacoraTerreno
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
    ingresosProyectados: number; utilidadBruta: number; margenBruto: number; tir: number
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
