'use client'

import { useState } from 'react'
import { useMastermind } from '../../state'
import VeredictoPanel from '../VeredictoPanel'
import SensitivityMatrix from '../SensitivityMatrix'
import CostosGauge from './CostosGauge'
import KpiGauge from './KpiGauge'
import IngresosGauge from './IngresosGauge'
import Palanca from './Palanca'
import DetailDrawer from './DetailDrawer'
import type { LeverId } from './types'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}
function pctRango(v: number, min: number, max: number) {
  return max > min ? ((v - min) / (max - min)) * 100 : 0
}

export default function MastermindCockpit({ origenAnalisis, tirAnalisisOriginal }: {
  origenAnalisis?: { proyecto: boolean; mercado: boolean; financiamiento: boolean; costos: boolean; tiempo: boolean }
  tirAnalisisOriginal?: number
}) {
  const { inputs, outputs, errores } = useMastermind()
  const [leverActive, setLeverActive] = useState<LeverId | null>(null)
  const c = outputs.costos

  const toggle = (id: LeverId) => setLeverActive(cur => (cur === id ? null : id))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="space-y-2">
          <CostosGauge />
          <div className="flex gap-2">
            <Palanca label="Terreno" value={fmtCompact(c.costoTerreno)} pct={c.costoTotal > 0 ? (c.costoTerreno / c.costoTotal) * 100 : 0} active={leverActive === 'terreno'} onClick={() => toggle('terreno')} readOnly />
            <Palanca label="Construcción" value={fmtCompact(c.costoDirectoConstruccion)} pct={c.costoTotal > 0 ? (c.costoDirectoConstruccion / c.costoTotal) * 100 : 0} active={leverActive === 'construccion'} onClick={() => toggle('construccion')} />
            <Palanca label="Administrativo" value={fmtCompact(c.indirectos + c.honorarios + c.imprevistos + c.comercializacion)} pct={c.costoTotal > 0 ? ((c.indirectos + c.honorarios + c.imprevistos + c.comercializacion) / c.costoTotal) * 100 : 0} active={leverActive === 'administrativo'} onClick={() => toggle('administrativo')} />
          </div>
        </div>

        <div className="space-y-2">
          <KpiGauge tirAnalisisOriginal={tirAnalisisOriginal} />
          <div className="flex gap-2">
            <Palanca label="Financiero" value={fmtCompact(c.financieros)} pct={c.costoTotal > 0 ? (c.financieros / c.costoTotal) * 100 : 0} active={leverActive === 'financiero'} onClick={() => toggle('financiero')} />
          </div>
        </div>

        <div className="space-y-2">
          <IngresosGauge />
          <div className="flex gap-2">
            <Palanca label="Volumen" value={`${inputs.proyecto.unidadesHabitacionales} uds`} pct={pctRango(inputs.proyecto.unidadesHabitacionales, 1, 500)} active={leverActive === 'volumen'} onClick={() => toggle('volumen')} />
            <Palanca label="Precio" value={fmtCompact(inputs.mercado.precioVentaDepasM2)} pct={pctRango(inputs.mercado.precioVentaDepasM2, 5_000, 100_000)} active={leverActive === 'precio'} onClick={() => toggle('precio')} />
            <Palanca label="Velocidad" value={`${inputs.tiempo.plazoVentaMeses}m`} pct={pctRango(inputs.tiempo.plazoVentaMeses, 6, 60)} active={leverActive === 'velocidad'} onClick={() => toggle('velocidad')} />
          </div>
        </div>
      </div>

      {leverActive && <DetailDrawer leverId={leverActive} origenAnalisis={origenAnalisis} />}

      <VeredictoPanel />

      {errores.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <p className="text-[12px] font-semibold text-red-400 mb-1">Revisa estos campos:</p>
          <ul className="text-[12px] text-red-400/90 list-disc pl-4 space-y-0.5">
            {errores.map(err => <li key={err.campo}>{err.mensaje}</li>)}
          </ul>
        </div>
      )}

      <SensitivityMatrix />
    </div>
  )
}
