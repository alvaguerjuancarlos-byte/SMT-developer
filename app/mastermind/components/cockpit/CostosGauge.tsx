'use client'

import { useMastermind } from '../../state'
import Panel from './Panel'
import Dona from './Dona'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const COLORES: Record<string, string> = {
  Terreno: '#8A6508',
  Construcción: '#c9a227',
  Administrativo: '#ddc06a',
  Financiero: '#DC2626',
}

export default function CostosGauge() {
  const { outputs } = useMastermind()
  const c = outputs.costos

  const filas: [string, number][] = [
    ['Terreno', c.costoTerreno],
    ['Construcción', c.costoDirectoConstruccion],
    ['Administrativo', c.indirectos + c.honorarios + c.imprevistos + c.comercializacion],
    ['Financiero', c.financieros],
  ]

  return (
    <Panel titulo="Costos" accent="#DC2626">
      <Dona
        segmentos={filas.map(([label, valor]) => ({ label, valor, color: COLORES[label] }))}
        total={c.costoTotal}
        centro={fmtCompact(c.costoTotal)}
        sub={`${c.m2Construidos.toLocaleString('es-MX')} m² construidos`}
      />
    </Panel>
  )
}
