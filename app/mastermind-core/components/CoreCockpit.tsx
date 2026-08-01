'use client'

import { useMemo, useState } from 'react'
import { useMastermindCore } from '../state'
import { detectarAnomalias } from '@/lib/mastermind/diagnostico'
import type { MixUnidad } from '@/lib/analisis/tipos'
import Palanca from '@/app/mastermind/components/cockpit/Palanca'
import CostosGaugeCore from './CostosGaugeCore'
import IngresosGaugeCore from './IngresosGaugeCore'
import CoreKpiPanel from './CoreKpiPanel'
import DetailDrawerCore, { type LeverIdCore } from './DetailDrawerCore'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}
function pctRango(v: number, min: number, max: number) {
  return max > min ? ((v - min) / (max - min)) * 100 : 0
}

// Subconjunto de app/mastermind/components/cockpit/MastermindCockpit.tsx — 5 palancas
// (terreno/construccion/administrativo/volumen/precio, sin financiero/velocidad) + panel de
// KPIs core en vez de TIR/equity. Mismo layout de 3 columnas para que se sienta como "la misma
// familia" de UI que Mastermind 2.
export default function CoreCockpit({ mixHabitacional, totalLocales }: { mixHabitacional: MixUnidad[]; totalLocales: number }) {
  const { inputs, outputs } = useMastermindCore()
  const [leverActive, setLeverActive] = useState<LeverIdCore | null>(null)
  const c = outputs.costos

  const anomalias = useMemo(() => detectarAnomalias(inputs), [inputs])

  const toggle = (id: LeverIdCore) => setLeverActive(cur => (cur === id ? null : id))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="space-y-2">
          <CostosGaugeCore />
          <div className="flex gap-2">
            <Palanca label="Terreno" value={fmtCompact(c.costoTerreno)} pct={c.costoTotal > 0 ? (c.costoTerreno / c.costoTotal) * 100 : 0} active={leverActive === 'terreno'} onClick={() => toggle('terreno')} />
            <Palanca label="Construcción" value={fmtCompact(c.costoDirectoConstruccion)} pct={c.costoTotal > 0 ? (c.costoDirectoConstruccion / c.costoTotal) * 100 : 0} active={leverActive === 'construccion'} onClick={() => toggle('construccion')} />
            <Palanca label="Administrativo" value={fmtCompact(c.indirectos + c.comercializacion)} pct={c.costoTotal > 0 ? ((c.indirectos + c.comercializacion) / c.costoTotal) * 100 : 0} active={leverActive === 'administrativo'} onClick={() => toggle('administrativo')} />
          </div>
        </div>

        <div className="space-y-2">
          <CoreKpiPanel />
        </div>

        <div className="space-y-2">
          <IngresosGaugeCore />
          <div className="flex gap-2">
            <Palanca label="Volumen" value={`${inputs.proyecto.unidadesHabitacionales} uds`} pct={pctRango(inputs.proyecto.unidadesHabitacionales, 1, 500)} active={leverActive === 'volumen'} onClick={() => toggle('volumen')} />
            <Palanca label="Precio" value={fmtCompact(inputs.mercado.precioVentaDepasM2)} pct={pctRango(inputs.mercado.precioVentaDepasM2, 5_000, 100_000)} active={leverActive === 'precio'} onClick={() => toggle('precio')} />
          </div>
        </div>
      </div>

      {leverActive && <DetailDrawerCore leverId={leverActive} mixHabitacional={mixHabitacional} totalLocales={totalLocales} />}

      {anomalias.length > 0 && (
        <div className="flex flex-col gap-2">
          {anomalias.map((a, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2.5 border text-[11px] leading-snug ${
                a.severidad === 'alta' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              ⚠ {a.mensaje}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
