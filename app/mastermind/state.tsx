'use client'

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type {
  InputsFinanciamiento,
  InputsMercado,
  InputsProyecto,
  InputsTiempo,
  MastermindInputs,
  MastermindOutputs,
  TerrenoContext as TerrenoContextData,
} from '@/lib/mastermind/tipos'
import { DEFAULTS } from '@/lib/mastermind/catalogo'
import { calcularMastermind } from '@/lib/mastermind/motor'
import { validarInputs } from '@/lib/mastermind/validacion'
import type { ValidationError } from '@/lib/mastermind/tipos'

type Action =
  | { type: 'SET_TERRENO'; payload: TerrenoContextData }
  | { type: 'SET_PROYECTO'; payload: Partial<InputsProyecto> }
  | { type: 'SET_MERCADO'; payload: Partial<InputsMercado> }
  | { type: 'SET_TIEMPO'; payload: Partial<InputsTiempo> }
  | { type: 'SET_FINANCIAMIENTO'; payload: Partial<InputsFinanciamiento> }
  | { type: 'SET_TIR_OBJETIVO'; payload: number }

function mastermindReducer(state: MastermindInputs, action: Action): MastermindInputs {
  switch (action.type) {
    case 'SET_TERRENO':
      return { ...state, terreno: action.payload }
    case 'SET_PROYECTO':
      return { ...state, proyecto: { ...state.proyecto, ...action.payload } }
    case 'SET_MERCADO':
      return { ...state, mercado: { ...state.mercado, ...action.payload } }
    case 'SET_TIEMPO':
      return { ...state, tiempo: { ...state.tiempo, ...action.payload } }
    case 'SET_FINANCIAMIENTO':
      return { ...state, financiamiento: { ...state.financiamiento, ...action.payload } }
    case 'SET_TIR_OBJETIVO':
      return { ...state, tirObjetivo: action.payload }
    default:
      return state
  }
}

interface MastermindContextValue {
  inputs: MastermindInputs
  outputs: MastermindOutputs
  errores: ValidationError[]
  setTerreno: (payload: TerrenoContextData) => void
  setProyecto: (payload: Partial<InputsProyecto>) => void
  setMercado: (payload: Partial<InputsMercado>) => void
  setTiempo: (payload: Partial<InputsTiempo>) => void
  setFinanciamiento: (payload: Partial<InputsFinanciamiento>) => void
  setTirObjetivo: (v: number) => void
}

const MastermindContext = createContext<MastermindContextValue | null>(null)

const ESTADO_INICIAL: MastermindInputs = {
  terreno: { costoTerreno: 0, costoTerrenoM2: 0, superficieM2: 0 },
  ...DEFAULTS,
}

export function MastermindProvider({ children }: { children: ReactNode }) {
  const [inputs, dispatch] = useReducer(mastermindReducer, ESTADO_INICIAL)

  const outputs = useMemo(() => calcularMastermind(inputs), [inputs])
  const errores = useMemo(() => validarInputs(inputs), [inputs])

  const value: MastermindContextValue = {
    inputs,
    outputs,
    errores,
    setTerreno: payload => dispatch({ type: 'SET_TERRENO', payload }),
    setProyecto: payload => dispatch({ type: 'SET_PROYECTO', payload }),
    setMercado: payload => dispatch({ type: 'SET_MERCADO', payload }),
    setTiempo: payload => dispatch({ type: 'SET_TIEMPO', payload }),
    setFinanciamiento: payload => dispatch({ type: 'SET_FINANCIAMIENTO', payload }),
    setTirObjetivo: v => dispatch({ type: 'SET_TIR_OBJETIVO', payload: v }),
  }

  return <MastermindContext.Provider value={value}>{children}</MastermindContext.Provider>
}

export function useMastermind() {
  const ctx = useContext(MastermindContext)
  if (!ctx) throw new Error('useMastermind debe usarse dentro de <MastermindProvider>')
  return ctx
}
