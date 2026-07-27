'use client'

import { useMemo } from 'react'
import { useMastermind } from '../state'
import { detectarAnomalias } from '@/lib/mastermind/diagnostico'

export default function VeredictoPanel() {
  const { inputs, outputs } = useMastermind()

  const anomalias = useMemo(() => detectarAnomalias(inputs), [inputs])
  const tirActual = outputs.retorno.tirSocioAnual
  const viable = tirActual !== null && tirActual >= inputs.tirObjetivo

  return (
    <div className="rounded-xl border border-white/10 p-5" style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 60%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(0,0,0,0.2)',
    }}>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: viable ? '#1D9E75' : '#DC2626' }} />
        Veredicto
      </h3>

      {anomalias.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
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

      {tirActual === null ? (
        <p className="text-[12px] text-white/40">TIR no calculable con los datos actuales.</p>
      ) : viable ? (
        <p className="text-[13px] text-[#1D9E75] font-semibold">
          ✓ Proyecto viable — TIR Socio de {tirActual.toFixed(1)}%, {(tirActual - inputs.tirObjetivo).toFixed(1)} pts sobre el objetivo ({inputs.tirObjetivo}%).
        </p>
      ) : (
        <p className="text-[13px] text-red-300 font-semibold">
          ✕ Proyecto no viable — TIR Socio de {tirActual.toFixed(1)}% vs {inputs.tirObjetivo}% objetivo. Ajusta precio de venta, costos o estructura de financiamiento y revisa cómo cambia.
        </p>
      )}
    </div>
  )
}
