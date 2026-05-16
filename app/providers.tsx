'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export type TerrainData = {
  nombre: string
  direccion: string
  colonia: string
  municipio: string
  estado: string
  superficieTotal: string
  frente: string
  fondo: string
  formaTerreno: string
  topografia: string
  usoSuelo: string
  cus: string
  cos: string
  nivelesMax: string
  densidad: string
  agua: boolean
  drenaje: boolean
  electricidad: boolean
  gas: boolean
  telecomunicaciones: boolean
  precioTotal: string
  precioPorM2: string
  formaPago: string
  situacionFiscal: string
  escrituras: boolean
  planoCatastral: boolean
  docUsoSuelo: boolean
  observaciones: string
}

const defaultTerrain: TerrainData = {
  nombre: '',
  direccion: '',
  colonia: '',
  municipio: '',
  estado: '',
  superficieTotal: '',
  frente: '',
  fondo: '',
  formaTerreno: 'rectangular',
  topografia: 'plano',
  usoSuelo: '',
  cus: '',
  cos: '',
  nivelesMax: '',
  densidad: '',
  agua: false,
  drenaje: false,
  electricidad: false,
  gas: false,
  telecomunicaciones: false,
  precioTotal: '',
  precioPorM2: '',
  formaPago: 'contado',
  situacionFiscal: 'escriturado',
  escrituras: false,
  planoCatastral: false,
  docUsoSuelo: false,
  observaciones: '',
}

type AppContextType = {
  currentStep: 1 | 2 | 3
  setCurrentStep: (s: 1 | 2 | 3) => void
  terrain: TerrainData
  setTerrain: (d: TerrainData) => void
  prospectionSaved: boolean
  setProspectionSaved: (v: boolean) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [terrain, setTerrain] = useState<TerrainData>(defaultTerrain)
  const [prospectionSaved, setProspectionSaved] = useState(false)

  useEffect(() => {
    const ensureAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        await supabase.auth.signInWithPassword({
          email: 'jcalvarez@mindbridge.com.mx',
          password: 'JCAGxy1960',
        })
      }
    }
    ensureAuth()
  }, [])

  return (
    <AppContext.Provider value={{ currentStep, setCurrentStep, terrain, setTerrain, prospectionSaved, setProspectionSaved }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
