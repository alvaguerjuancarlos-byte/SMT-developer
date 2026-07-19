'use client'

import { useMastermind } from '../../state'
import Panel from './Panel'

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
  const pctHab = total > 0 ? (i.ingresoBrutoHabitacional / total) * 100 : 0
  const pctComercial = 100 - pctHab

  return (
    <Panel titulo="Ingresos" accent="#1D9E75">
      <div className="text-center mb-4">
        <div className="font-mono text-[32px] font-black text-[#1D9E75] leading-none">{fmtCompact(i.ingresoNeto)}</div>
        <div className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Ingreso neto (bruto {fmtCompact(i.ingresoBrutoTotal)})</div>
      </div>

      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-white/5 mb-2">
          {pctHab > 0 && <div style={{ width: `${pctHab}%` }} className="bg-[#1D9E75]" />}
          {pctComercial > 0 && <div style={{ width: `${pctComercial}%` }} className="bg-[#C9A227]" />}
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
          Habitacional <span className="text-white/25">{pctHab.toFixed(0)}%</span>
        </span>
        {i.ingresoBrutoComercial > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
            Comercial <span className="text-white/25">{pctComercial.toFixed(0)}%</span>
          </span>
        )}
      </div>
    </Panel>
  )
}
