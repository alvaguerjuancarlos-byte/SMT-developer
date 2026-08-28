// Store central de PREFORMA (Bloque 0) — contiene los datos de los agentes (pipe) y los
// campos de captura dual manual/automático (fields). No toca la orquestación de fetch de
// los agentes (eso sigue viviendo en page.tsx, run*/useEffect encadenados) — solo centraliza
// dónde se guarda el resultado, para que selectores derivados (TIR, margen, sensibilidad...)
// lean de un solo lugar en vez de useState local disperso.
//
// zustand en vez de useState/Context: el Bloque 1 (panel del Agente como overlay) va a
// necesitar leer/escribir este mismo estado desde fuera del árbol de PreformaPage — el
// estado compartido entre componentes no es especulativo, llega en el siguiente bloque.
import { create } from 'zustand'

export type AgentStatus = 'waiting' | 'running' | 'done' | 'error'

export interface PipeState {
  comparables: { status: AgentStatus; data: any[] }
  comparablesVenta: { status: AgentStatus; data: any[] }
  // Resumen de lib/market/ (dedup→comparable→price→geography→inventory→competitor→
  // appreciation→productFit→opportunity→evidence) sobre los mismos comparables de
  // comparablesVenta — ver app/api/market/resumen/route.ts. Independiente del Agente Mercado
  // (LLM, /api/agentes/mercado): si uno falla, no debe tumbar al otro.
  marketResumen: { status: AgentStatus; data: any }
  ubicacion: { status: AgentStatus; data: any }
  terreno: { status: AgentStatus; corridas: any[]; seleccionada: number | null }
  legal: { status: AgentStatus; data: any }
  mercado: { status: AgentStatus; corridas: any[]; seleccionada: number | null }
  arquitectura: { status: AgentStatus; corridas: any[]; seleccionada: number | null }
  construccion: { status: AgentStatus; corridas: any[]; seleccionada: number | null }
  financiero: { status: AgentStatus; data: any }
}

const PIPE_INICIAL: PipeState = {
  comparables: { status: 'waiting', data: [] },
  comparablesVenta: { status: 'waiting', data: [] },
  marketResumen: { status: 'waiting', data: null },
  ubicacion: { status: 'waiting', data: null },
  terreno: { status: 'waiting', corridas: [], seleccionada: null },
  legal: { status: 'waiting', data: null },
  mercado: { status: 'waiting', corridas: [], seleccionada: null },
  arquitectura: { status: 'waiting', corridas: [], seleccionada: null },
  construccion: { status: 'waiting', corridas: [], seleccionada: null },
  financiero: { status: 'waiting', data: null },
}

// Campos duales manual/automático — los 4 de "Supuestos editables" (Bloque 0) + los 3 de
// tasa/plazos (Bloque 3, aplicables desde la matriz de sensibilidad — sin DataField propio
// en Supuestos editables, esa tarjeta se queda como está) + los de TERRENO/NORMATIVA
// (Bloque 4 — agua/drenaje/electricidad son un solo FieldKey compartido entre las dos
// pestañas, porque ya son el mismo dato hoy: TERRENO cae en fallback al mismo
// fichaLegal.factibilidades.x.status que NORMATIVA muestra directo).
export type FieldKey =
  | 'costoTerrenoM2' | 'costoConstruccionM2' | 'precioVentaM2' | 'unidadesObjetivo'
  | 'tasaAnualCredito' | 'plazoObraMeses' | 'plazoVentaMeses'
  // TERRENO
  | 'superficieTerreno' | 'pendienteTerreno' | 'usoSueloTerreno' | 'esquinaTerreno'
  | 'clasificacionVialTerreno' | 'pavimentoTerreno'
  // Compartidos TERRENO + NORMATIVA
  | 'aguaDisponibilidad' | 'drenajeDisponibilidad' | 'electricidadDisponibilidad'
  // NORMATIVA — tabla de parámetros
  | 'cosNormativa' | 'cusNormativa' | 'alturaNormativa' | 'cajonesNormativa'
  | 'retirosNormativa' | 'densidadNormativa' | 'regimenCondominioNormativa'
  // NORMATIVA — compatibilidad
  | 'compatibleNormativa' | 'nivelRiesgoNormativa'
  // Bloque 6 — ARQUITECTURA: niveles/sótanos editables (recálculo en vivo, ver page.tsx)
  | 'nivelesArquitectura' | 'sotanosArquitectura'
  // Bloque 7 — COSTOS: rubros de overhead editables (% del costo directo de construcción)
  | 'porcentajeIndirectos' | 'porcentajeHonorarios' | 'porcentajeImprevistos'
  // Bloque 8 — FINANCIERO: mezcla equity/deuda, tipo de deuda y condiciones de preventa
  | 'porcentajeFinanciado' | 'tipoDeuda'
  | 'preventaUnidadesMinimas' | 'preventaPorcentajeMinimo' | 'preventaMontoMinimo'

export interface FieldState {
  value: number | string | null
  source: 'user' | 'agent' | 'empty'
  // Último valor sugerido por el agente, aunque el usuario esté en manual — para poder
  // detectar y mostrar conflictos sin perder el override del usuario.
  agentValue: number | string | null
  confidence?: number
  sourceUrl?: string
  updatedAt?: number
  conflicto?: boolean
}

const FIELD_VACIO: FieldState = { value: null, source: 'empty', agentValue: null }

const FIELDS_INICIAL: Record<FieldKey, FieldState> = {
  costoTerrenoM2: { ...FIELD_VACIO },
  costoConstruccionM2: { ...FIELD_VACIO },
  precioVentaM2: { ...FIELD_VACIO },
  unidadesObjetivo: { ...FIELD_VACIO },
  tasaAnualCredito: { ...FIELD_VACIO },
  plazoObraMeses: { ...FIELD_VACIO },
  plazoVentaMeses: { ...FIELD_VACIO },
  superficieTerreno: { ...FIELD_VACIO },
  pendienteTerreno: { ...FIELD_VACIO },
  usoSueloTerreno: { ...FIELD_VACIO },
  esquinaTerreno: { ...FIELD_VACIO },
  clasificacionVialTerreno: { ...FIELD_VACIO },
  pavimentoTerreno: { ...FIELD_VACIO },
  aguaDisponibilidad: { ...FIELD_VACIO },
  drenajeDisponibilidad: { ...FIELD_VACIO },
  electricidadDisponibilidad: { ...FIELD_VACIO },
  cosNormativa: { ...FIELD_VACIO },
  cusNormativa: { ...FIELD_VACIO },
  alturaNormativa: { ...FIELD_VACIO },
  cajonesNormativa: { ...FIELD_VACIO },
  retirosNormativa: { ...FIELD_VACIO },
  densidadNormativa: { ...FIELD_VACIO },
  regimenCondominioNormativa: { ...FIELD_VACIO },
  compatibleNormativa: { ...FIELD_VACIO },
  nivelRiesgoNormativa: { ...FIELD_VACIO },
  nivelesArquitectura: { ...FIELD_VACIO },
  sotanosArquitectura: { ...FIELD_VACIO },
  porcentajeIndirectos: { ...FIELD_VACIO },
  porcentajeHonorarios: { ...FIELD_VACIO },
  porcentajeImprevistos: { ...FIELD_VACIO },
  porcentajeFinanciado: { ...FIELD_VACIO },
  tipoDeuda: { ...FIELD_VACIO },
  preventaUnidadesMinimas: { ...FIELD_VACIO },
  preventaPorcentajeMinimo: { ...FIELD_VACIO },
  preventaMontoMinimo: { ...FIELD_VACIO },
}

// Escenario guardado (comparación A/B/C...) — vacío en Bloque 0, lo llena el Bloque 3.
export interface ScenarioSnapshot {
  id: string
  nombre: string
  tir: number | null
  inputs: Record<string, unknown>
}

interface ProjectStore {
  pipe: PipeState
  fields: Record<FieldKey, FieldState>
  escenarios: ScenarioSnapshot[]

  setPipe: (updater: (p: PipeState) => PipeState) => void
  setFieldManual: (key: FieldKey, value: number | string) => void
  setFieldFromAgent: (key: FieldKey, value: number | string, meta?: { confidence?: number; sourceUrl?: string }) => void
  resolverConflicto: (key: FieldKey, aceptarAgente: boolean) => void
  resetField: (key: FieldKey) => void
  resetAllFields: () => void
  // Reinicia pipe y fields a su estado vacío inicial — para "Nuevo análisis", no confundir
  // con resetAllFields (que conserva el último valor sugerido por el agente).
  resetProyecto: () => void

  // Bloque 3 (3.1): guardar una celda de la matriz de sensibilidad como escenario para
  // comparar contra el actual (B, C, D...) — hasta ahora `escenarios` era solo scaffolding
  // del Bloque 0, sin ninguna acción que lo tocara.
  agregarEscenario: (nombre: string, inputs: Record<string, unknown>, tir: number | null) => void
  eliminarEscenario: (id: string) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  pipe: PIPE_INICIAL,
  fields: FIELDS_INICIAL,
  escenarios: [],

  setPipe: (updater) => set((s) => ({ pipe: updater(s.pipe) })),

  setFieldManual: (key, value) =>
    set((s) => ({
      fields: {
        ...s.fields,
        [key]: { ...s.fields[key], value, source: 'user', conflicto: false, updatedAt: Date.now() },
      },
    })),

  setFieldFromAgent: (key, value, meta) =>
    set((s) => {
      const actual = s.fields[key]
      // Manual siempre gana: si el usuario ya capturó a mano y el agente trae algo
      // distinto, no se sobrescribe — se marca conflicto para que el usuario decida.
      if (actual.source === 'user') {
        if (actual.value === value) return { fields: s.fields }
        return {
          fields: { ...s.fields, [key]: { ...actual, agentValue: value, conflicto: true } },
        }
      }
      return {
        fields: {
          ...s.fields,
          [key]: {
            value,
            source: 'agent',
            agentValue: value,
            confidence: meta?.confidence,
            sourceUrl: meta?.sourceUrl,
            updatedAt: Date.now(),
            conflicto: false,
          },
        },
      }
    }),

  resolverConflicto: (key, aceptarAgente) =>
    set((s) => {
      const actual = s.fields[key]
      if (!aceptarAgente) return { fields: { ...s.fields, [key]: { ...actual, conflicto: false } } }
      return {
        fields: {
          ...s.fields,
          [key]: { ...actual, value: actual.agentValue, source: 'agent', conflicto: false, updatedAt: Date.now() },
        },
      }
    }),

  resetField: (key) =>
    set((s) => ({
      fields: {
        ...s.fields,
        [key]: { ...FIELD_VACIO, agentValue: s.fields[key].agentValue, value: s.fields[key].agentValue, source: s.fields[key].agentValue != null ? 'agent' : 'empty' },
      },
    })),

  resetAllFields: () => set((s) => ({ fields: Object.fromEntries((Object.keys(s.fields) as FieldKey[]).map((k) => {
    const agentValue = s.fields[k].agentValue
    return [k, { ...FIELD_VACIO, agentValue, value: agentValue, source: agentValue != null ? 'agent' as const : 'empty' as const }]
  })) as Record<FieldKey, FieldState> })),

  resetProyecto: () => set({ pipe: PIPE_INICIAL, fields: FIELDS_INICIAL, escenarios: [] }),

  agregarEscenario: (nombre, inputs, tir) =>
    set((s) => ({
      escenarios: [...s.escenarios, { id: crypto.randomUUID(), nombre, inputs, tir }],
    })),

  eliminarEscenario: (id) =>
    set((s) => ({ escenarios: s.escenarios.filter((e) => e.id !== id) })),
}))
