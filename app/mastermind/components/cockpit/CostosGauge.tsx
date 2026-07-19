'use client'

import { useMastermind } from '../../state'
import Panel from './Panel'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const COLORES: Record<string, string> = {
  Terreno: '#0F6E56',
  Construcción: '#1D9E75',
  Administrativo: '#5DCAA5',
  Financiero: '#DC2626',
}

export default function CostosGauge() {
  const { outputs } = useMastermind()
  const c = outputs.costos

  const filas: [string, number][] = [
    ['Terreno', c.costoTerreno],
    ['Construcción', c.costoDirectoConstruccion],
    ['Administrativo', c.indirectos + c.comercializacion],
    ['Financiero', c.financieros],
  ]

  return (
    <Panel titulo="Costos" accent="#DC2626">
      <div className="text-center mb-4">
        <div className="font-mono text-[32px] font-black text-white leading-none">{fmtCompact(c.costoTotal)}</div>
        <div className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">{c.m2Construidos.toLocaleString('es-MX')} m² construidos</div>
      </div>

      {c.costoTotal > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-white/5 mb-2">
          {filas.map(([label, valor]) => valor > 0 && (
            <div key={label} style={{ width: `${(valor / c.costoTotal) * 100}%`, backgroundColor: COLORES[label] }} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40">
        {filas.map(([label, valor]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORES[label] }} />
            {label} <span className="text-white/25">{c.costoTotal > 0 ? `${((valor / c.costoTotal) * 100).toFixed(0)}%` : '—'}</span>
          </span>
        ))}
      </div>
    </Panel>
  )
}
