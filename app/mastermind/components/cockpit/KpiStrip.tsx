'use client'

import { useMastermind } from '../../state'

// Franja de indicadores del tablero de control: los seis números que se vigilan al mover una
// palanca, con su semáforo y una barra contra la meta — se leen de un vistazo antes que los
// paneles de detalle.
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString('es-MX')}`
}

const VERDE = '#1D9E75', AMBAR = '#D97706', ROJO = '#DC2626', NEUTRO = 'rgba(255,255,255,0.35)'

function Tile({ label, valor, nota, color, pct }: { label: string; valor: string; nota: string; color: string; pct: number }) {
  return (
    <div className="relative rounded-xl border border-white/[0.08] px-4 py-3.5 overflow-hidden" style={{ background: 'linear-gradient(180deg, #11284a 0%, #0c1f3d 100%)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/45">{label}</span>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <div className="font-mono text-[28px] font-bold leading-none mt-2 tabular-nums" style={{ color: color === NEUTRO ? '#f4f0e6' : color }}>{valor}</div>
      <div className="text-[10px] text-white/35 mt-1.5 truncate">{nota}</div>
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.06]">
        <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function KpiStrip() {
  const { inputs, outputs } = useMastermind()
  const r = outputs.retorno
  const u = outputs.utilidad
  const meta = inputs.tirObjetivo
  const tirColor = (v: number | null, ok: boolean) => (!ok || v === null ? NEUTRO : v >= meta ? VERDE : v >= meta * 0.75 ? AMBAR : ROJO)
  const tirPct = (v: number | null, ok: boolean) => (!ok || v === null ? 0 : (v / (meta * 1.6 || 1)) * 100)
  const margenColor = u.margenNeto > 20 ? VERDE : u.margenNeto >= 10 ? AMBAR : ROJO

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Tile label="TIR socio" valor={r.tirSocioConverge && r.tirSocioAnual !== null ? `${r.tirSocioAnual.toFixed(1)}%` : '—'} nota={`Meta ${meta}%`} color={tirColor(r.tirSocioAnual, r.tirSocioConverge)} pct={tirPct(r.tirSocioAnual, r.tirSocioConverge)} />
      <Tile label="TIR proyecto" valor={r.tirProyectoConverge && r.tirProyectoAnual !== null ? `${r.tirProyectoAnual.toFixed(1)}%` : '—'} nota="Sin apalancamiento" color={tirColor(r.tirProyectoAnual, r.tirProyectoConverge)} pct={tirPct(r.tirProyectoAnual, r.tirProyectoConverge)} />
      <Tile label="Utilidad (UAI)" valor={fmtCompact(u.utilidadAntesImpuestos)} nota="Antes de impuestos" color={u.utilidadAntesImpuestos > 0 ? VERDE : ROJO} pct={Math.min(100, Math.max(0, u.margenNeto * 3))} />
      <Tile label="Margen neto" valor={`${u.margenNeto.toFixed(1)}%`} nota={u.margenNeto > 20 ? 'Saludable' : u.margenNeto >= 10 ? 'Ajustado' : 'En riesgo'} color={margenColor} pct={(u.margenNeto / 30) * 100} />
      <Tile label="ROI" valor={`${r.roiSimple.toFixed(0)}%`} nota="Sobre la inversión total" color={r.roiSimple >= 20 ? VERDE : r.roiSimple >= 10 ? AMBAR : ROJO} pct={(r.roiSimple / 40) * 100} />
      <Tile label="Payback" valor={`${r.paybackMeses.toFixed(0)} m`} nota="Recuperación del capital" color={NEUTRO} pct={100 - (r.paybackMeses / 60) * 100} />
    </div>
  )
}
