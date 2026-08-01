'use client'

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type {
  InputsMercado,
  InputsProyecto,
  MastermindCoreInputs,
  MastermindCoreOutputs,
  TerrenoContext as TerrenoContextData,
} from '@/lib/mastermind/tipos'
import { DEFAULTS } from '@/lib/mastermind/catalogo'
import { calcularMastermindCore } from '@/lib/mastermind/motor'

// Mismo patrón que app/mastermind/state.tsx, pero acotado a terreno+proyecto+mercado — Mastermind
// 1 corre antes de que exista un plan financiero (tiempo/financiamiento/tirObjetivo no aplican).
type Action =
  | { type: 'SET_TERRENO'; payload: TerrenoContextData }
  | { type: 'SET_PROYECTO'; payload: Partial<InputsProyecto> }
  | { type: 'SET_MERCADO'; payload: Partial<InputsMercado> }

function mastermindCoreReducer(state: MastermindCoreInputs, action: Action): MastermindCoreInputs {
  switch (action.type) {
    case 'SET_TERRENO':
      return { ...state, terreno: action.payload }
    case 'SET_PROYECTO':
      return { ...state, proyecto: { ...state.proyecto, ...action.payload } }
    case 'SET_MERCADO':
      return { ...state, mercado: { ...state.mercado, ...action.payload } }
    default:
      return state
  }
}

interface MastermindCoreContextValue {
  inputs: MastermindCoreInputs
  outputs: MastermindCoreOutputs
  setTerreno: (payload: TerrenoContextData) => void
  setProyecto: (payload: Partial<InputsProyecto>) => void
  setMercado: (payload: Partial<InputsMercado>) => void
}

const MastermindCoreContext = createContext<MastermindCoreContextValue | null>(null)

const ESTADO_INICIAL: MastermindCoreInputs = {
  terreno: { costoTerreno: 0, costoTerrenoM2: 0, superficieM2: 0 },
  proyecto: DEFAULTS.proyecto,
  mercado: DEFAULTS.mercado,
}

export function MastermindCoreProvider({ children }: { children: ReactNode }) {
  const [inputs, dispatch] = useReducer(mastermindCoreReducer, ESTADO_INICIAL)

  const outputs = useMemo(() => calcularMastermindCore(inputs), [inputs])

  const value: MastermindCoreContextValue = {
    inputs,
    outputs,
    setTerreno: payload => dispatch({ type: 'SET_TERRENO', payload }),
    setProyecto: payload => dispatch({ type: 'SET_PROYECTO', payload }),
    setMercado: payload => dispatch({ type: 'SET_MERCADO', payload }),
  }

  return <MastermindCoreContext.Provider value={value}>{children}</MastermindCoreContext.Provider>
}

export function useMastermindCore() {
  const ctx = useContext(MastermindCoreContext)
  if (!ctx) throw new Error('useMastermindCore debe usarse dentro de <MastermindCoreProvider>')
  return ctx
}
