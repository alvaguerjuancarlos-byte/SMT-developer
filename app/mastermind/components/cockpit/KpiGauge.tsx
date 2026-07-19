'use client'

import { useMastermind } from '../../state'
import Panel from './Panel'
import InstrumentDial from './InstrumentDial'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

function semaforoMargen(margenNeto: number): { color: string; label: string } {
  if (margenNeto > 20) return { color: '#1D9E75', label: 'Saludable' }
  if (margenNeto >= 10) return { color: '#D97706', label: 'Ajustado' }
  return { color: '#DC2626', label: 'Riesgo' }
}

export default function KpiGauge({ tirAnalisisOriginal }: { tirAnalisisOriginal?: number }) {
  const { inputs, outputs, modoInverso, setModoInverso } = useMastermind()
  const r = outputs.retorno
  const u = outputs.utilidad
  const viable = r.tirSocioConverge && (r.tirSocioAnual as number) >= inputs.tirObjetivo
  const sMargen = semaforoMargen(u.margenNeto)

  return (
    <Panel
      titulo="KPIs financieros"
      accent="#1D9E75"
      action={
        <button
          onClick={() => setModoInverso(!modoInverso)}
          className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border transition-colors cursor-pointer ${
            modoInverso
              ? 'bg-[#1D9E75]/15 border-[#1D9E75]/50 text-[#1D9E75]'
              : 'bg-white/[0.03] border-white/15 text-white/40 hover:text-white/60'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${modoInverso ? 'bg-[#1D9E75]' : 'bg-white/25'}`} />
          Autopilot
        </button>
      }
    >
      <div className="flex justify-center mb-3">
        <InstrumentDial
          value={r.tirSocioAnual}
          target={inputs.tirObjetivo}
          converge={r.tirSocioConverge}
          size="lg"
          label="TIR Socio"
          formatValue={v => `${v.toFixed(0)}%`}
        />
      </div>

      {tirAnalisisOriginal !== undefined && (
        <p className="text-center text-[10px] text-white/30 -mt-2 mb-3">
          TIR del análisis original: <span className="font-mono text-white/50">{tirAnalisisOriginal.toFixed(1)}%</span>
        </p>
      )}

      <div
        className="rounded-lg py-2 mb-3 text-center text-[11px] font-semibold uppercase tracking-wide"
        style={{
          backgroundColor: r.tirSocioConverge ? (viable ? 'rgba(29,158,117,0.12)' : 'rgba(220,38,38,0.12)') : 'rgba(255,255,255,0.04)',
          color: r.tirSocioConverge ? (viable ? '#1D9E75' : '#DC2626') : 'rgba(255,255,255,0.4)',
        }}
      >
        {!r.tirSocioConverge ? 'No calculable' : viable ? '✓ Viable' : '✕ Ajustar parámetros'}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <div className="font-mono text-[14px] font-bold text-white">
            {r.tirProyectoConverge ? `${(r.tirProyectoAnual as number).toFixed(0)}%` : '—'}
          </div>
          <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">TIR Proyecto</div>
        </div>
        <div>
          <div className="font-mono text-[14px] font-bold text-white">{r.roiSimple.toFixed(0)}%</div>
          <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">ROI</div>
        </div>
        <div>
          <div className="font-mono text-[14px] font-bold text-white">{r.paybackMeses.toFixed(0)}m</div>
          <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Payback</div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: sMargen.color }}>{sMargen.label} · UAI</div>
          <div className="font-mono text-[15px] font-bold text-white">{fmtCompact(u.utilidadAntesImpuestos)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-white/30 uppercase tracking-wider">Margen neto</div>
          <div className="font-mono text-[15px] font-bold" style={{ color: sMargen.color }}>{u.margenNeto.toFixed(1)}%</div>
        </div>
      </div>
    </Panel>
  )
}
