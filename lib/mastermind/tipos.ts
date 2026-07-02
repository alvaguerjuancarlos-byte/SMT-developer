// Tipos del motor Mastermind — factibilidad financiera con ingeniería inversa.
// Módulo TypeScript puro — sin LLM, sin efectos secundarios, 100% determinístico.

export type TipoProyecto = 'vertical_mixto' | 'horizontal' | 'comercial' | 'habitacional'
export type ModalidadLocales = 'venta' | 'renta'

export type BenchmarkConstruccion =
  | 'habitacional_economico'
  | 'habitacional_medio'
  | 'habitacional_residencial'
  | 'comercial_local'
  | 'estacionamiento_sotano'
  | 'oficinas'

export interface TerrenoContext {
  costoTerreno: number
  costoTerrenoM2: number
  superficieM2: number
  bandaTerreno?: number
  municipio?: string
}

export interface InputsProyecto {
  tipoProyecto: TipoProyecto
  niveles: number
  unidadesHabitacionales: number
  m2PromedioDepa: number
  m2ComercialesPlantaBaja: number
  benchmarkConstruccion: BenchmarkConstruccion
}

export interface InputsMercado {
  precioVentaDepasM2: number
  modalidadLocales: ModalidadLocales
  precioLocalesM2: number
  tasaCapRate: number
}

export interface InputsTiempo {
  plazoObraMeses: number
  plazoVentaMeses: number
  inicioVentasMes: number
}

export interface InputsFinanciamiento {
  porcentajeFinanciado: number
  tasaAnualCredito: number
}

export interface MastermindInputs {
  terreno: TerrenoContext
  proyecto: InputsProyecto
  mercado: InputsMercado
  tiempo: InputsTiempo
  financiamiento: InputsFinanciamiento
  tirObjetivo: number
}

export interface BloqueIngresos {
  m2VendiblesHabitacional: number
  m2VendiblesComercial: number
  ingresoBrutoHabitacional: number
  ingresoBrutoComercial: number
  ingresoBrutoTotal: number
  descuentos: number
  ingresoNeto: number
}

export interface BloqueCostos {
  m2Construidos: number
  costoTerreno: number
  costoDirectoConstruccion: number
  indirectos: number
  comercializacion: number
  financieros: number
  costoTotal: number
}

export interface BloqueUtilidad {
  utilidadAntesImpuestos: number
  margenBruto: number
  margenNeto: number
}

export interface BloqueRetorno {
  tirSocioAnual: number | null
  tirProyectoAnual: number | null
  tirSocioConverge: boolean
  tirProyectoConverge: boolean
  roiSimple: number
  paybackMeses: number
  puntoEquilibrioUnidades: number
  inversionSocios: number
  inversionProyecto: number
}

export interface MastermindOutputs {
  ingresos: BloqueIngresos
  costos: BloqueCostos
  utilidad: BloqueUtilidad
  retorno: BloqueRetorno
  flujoSocio: number[]
  flujoProyecto: number[]
}

export interface IRRResult {
  tasaMensual: number | null
  tirAnual: number | null
  converged: boolean
  iteraciones: number
  metodo: 'newton' | 'biseccion' | 'fallido'
}

export interface SolverResult {
  valor: number | null
  converged: boolean
  tirAlcanzada: number | null
  iteraciones: number
}

export interface SensitivityCell {
  precioVentaM2: number
  benchmarkMxnM2: number
  tirSocio: number | null
  semaforo: 'verde_oscuro' | 'verde' | 'amarillo' | 'rojo' | 'gris'
}

export interface ValidationError {
  campo: string
  mensaje: string
}
