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

export default function IngresosGauge() {
  const { outputs } = useMastermind()
  const i = outputs.ingresos
  const total = i.ingresoBrutoHabitacional + i.ingresoBrutoComercial

  return (
    <Panel titulo="Ingresos" accent="#818CF8">
      <Dona
        segmentos={[
          { label: 'Habitacional', valor: i.ingresoBrutoHabitacional, color: '#818CF8' },
          ...(i.ingresoBrutoComercial > 0 ? [{ label: 'Comercial', valor: i.ingresoBrutoComercial, color: '#C9A227' }] : []),
        ]}
        total={total}
        centro={fmtCompact(i.ingresoNeto)}
        sub={`Neto · bruto ${fmtCompact(i.ingresoBrutoTotal)}`}
      />
    </Panel>
  )
}
