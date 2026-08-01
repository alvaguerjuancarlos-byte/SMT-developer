'use client'

import { useMastermindCore } from '../state'
import Panel from '@/app/mastermind/components/cockpit/Panel'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

function semaforoMargen(margenBruto: number): { color: string; label: string } {
  if (margenBruto > 25) return { color: '#1D9E75', label: 'Saludable' }
  if (margenBruto >= 12) return { color: '#D97706', label: 'Ajustado' }
  return { color: '#DC2626', label: 'Riesgo' }
}

// Umbral de alerta del spread precio-venta/costo-construcción — mismo criterio que
// litmusViabilidad en app/api/agentes/construccion/route.ts (spread < 1.6 = señal temprana de
// proyecto probablemente inviable).
const SPREAD_MINIMO_SANO = 1.6

// Panel de KPIs para Mastermind 1 — sin TIR/equity/ROI/payback (eso es Mastermind 2, capa
// financiamiento). Muestra margen bruto + los 4 indicadores acordados con el usuario: costo/m²
// vendible, spread venta/construcción, punto de equilibrio en unidades, utilidad bruta en $.
export default function CoreKpiPanel() {
  const { outputs } = useMastermindCore()
  const { utilidad, costoPorM2Vendible, spreadVentaConstruccion, puntoEquilibrioUnidades } = outputs
  const sMargen = semaforoMargen(utilidad.margenBruto)
  const spreadBajo = spreadVentaConstruccion !== null && spreadVentaConstruccion < SPREAD_MINIMO_SANO

  return (
    <Panel titulo="Indicadores core" accent="#1D9E75">
      <div className="text-center mb-4">
        <div className="font-mono text-[32px] font-black leading-none" style={{ color: sMargen.color }}>
          {utilidad.margenBruto.toFixed(1)}%
        </div>
        <div className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: sMargen.color }}>
          Margen bruto · {sMargen.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg px-3 py-2.5 bg-white/[0.03] text-center">
          <div className="font-mono text-[15px] font-bold text-white">{fmtCompact(costoPorM2Vendible)}</div>
          <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Costo / m² vendible</div>
        </div>
        <div
          className="rounded-lg px-3 py-2.5 text-center"
          style={{ backgroundColor: spreadBajo ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.03)' }}
        >
          <div className="font-mono text-[15px] font-bold" style={{ color: spreadBajo ? '#DC2626' : 'white' }}>
            {spreadVentaConstruccion !== null ? `${spreadVentaConstruccion.toFixed(2)}x` : '—'}
          </div>
          <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: spreadBajo ? '#DC2626' : 'rgba(255,255,255,0.3)' }}>
            Spread venta / construcción
          </div>
        </div>
        <div className="rounded-lg px-3 py-2.5 bg-white/[0.03] text-center">
          <div className="font-mono text-[15px] font-bold text-white">{puntoEquilibrioUnidades} uds</div>
          <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Punto de equilibrio</div>
        </div>
        <div className="rounded-lg px-3 py-2.5 bg-white/[0.03] text-center">
          <div className="font-mono text-[15px] font-bold text-white">{fmtCompact(utilidad.utilidadAntesImpuestos)}</div>
          <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Utilidad bruta</div>
        </div>
      </div>

      {spreadBajo && (
        <p className="text-[10px] text-red-300/80 mt-3 leading-snug">
          ⚠ Spread por debajo de {SPREAD_MINIMO_SANO}x — señal temprana de que el proyecto puede
          no ser viable, antes incluso de correr el plan financiero.
        </p>
      )}
    </Panel>
  )
}
