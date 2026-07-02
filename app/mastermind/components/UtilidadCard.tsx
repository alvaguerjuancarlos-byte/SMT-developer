'use client'

import { useMastermind } from '../state'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

function semaforo(margenNeto: number): { color: string; bg: string; label: string } {
  if (margenNeto > 20) return { color: '#0F6E56', bg: '#E1F5EE', label: 'Saludable' }
  if (margenNeto >= 10) return { color: '#D97706', bg: '#FEF3C7', label: 'Ajustado' }
  return { color: '#DC2626', bg: '#FEE2E2', label: 'Riesgo' }
}

export default function UtilidadCard() {
  const { outputs } = useMastermind()
  const u = outputs.utilidad
  const s = semaforo(u.margenNeto)

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] p-6">
      <h3 className="text-[14px] font-bold text-[#111d17] mb-4">Utilidad</h3>

      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: s.bg }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: s.color }}>{s.label}</p>
        <p className="text-[26px] font-bold" style={{ color: s.color }}>{fmt(u.utilidadAntesImpuestos)}</p>
        <p className="text-[11px] text-[#5a7065] mt-0.5">Utilidad antes de impuestos (UAI)</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#F0F4F2] rounded-xl p-3">
          <p className="text-[11px] text-[#5a7065] mb-1">Margen bruto</p>
          <p className="text-[18px] font-bold text-[#111d17]">{u.margenBruto.toFixed(1)}%</p>
        </div>
        <div className="bg-[#F0F4F2] rounded-xl p-3">
          <p className="text-[11px] text-[#5a7065] mb-1">Margen neto</p>
          <p className="text-[18px] font-bold text-[#111d17]">{u.margenNeto.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  )
}
