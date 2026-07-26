'use client'

import { useMemo } from 'react'
import { useMastermind } from '../state'
import { detectarAnomalias, diagnosticarViabilidad } from '@/lib/mastermind/diagnostico'
import type { CausaViabilidad } from '@/lib/mastermind/diagnostico'

function fmtMXN(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

function fmtValor(palanca: CausaViabilidad['palanca'], n: number): string {
  if (palanca === 'precioVenta' || palanca === 'costoConstruccion') return `${fmtMXN(n)}/m²`
  return fmtMXN(n)
}

function FilaCausa({ causa, esPrincipal }: { causa: CausaViabilidad; esPrincipal: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${esPrincipal ? 'bg-red-500/10 border border-red-500/25' : 'bg-white/[0.03] border border-white/10'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-semibold ${esPrincipal ? 'text-red-300' : 'text-white/70'}`}>{causa.etiqueta}</span>
        {!causa.cumple && (
          <span className={`text-[11px] font-mono font-bold ${esPrincipal ? 'text-red-300' : 'text-amber-300/80'}`}>
            -{causa.brechaPct.toFixed(0)}%
          </span>
        )}
      </div>
      {causa.valorObjetivo !== null && !causa.cumple && (
        <p className="text-[10px] text-white/35 mt-0.5">
          Actual: {fmtValor(causa.palanca, causa.valorActual)} · Necesitaría: {fmtValor(causa.palanca, causa.valorObjetivo)}
        </p>
      )}
      {causa.cumple && (
        <p className="text-[10px] text-white/30 mt-0.5">Dentro de rango — no es una causa del problema.</p>
      )}
      {!causa.convergio && (
        <p className="text-[10px] text-amber-300/70 mt-0.5">No se encontró un valor de esta palanca, por sí sola, que arregle el proyecto en el rango explorado.</p>
      )}
    </div>
  )
}

export default function VeredictoPanel() {
  const { inputs, outputs } = useMastermind()

  const diagnostico = useMemo(() => diagnosticarViabilidad(inputs, outputs), [inputs, outputs])
  const anomalias = useMemo(() => detectarAnomalias(inputs), [inputs])

  const { viable, tirActual, causaPrincipal, causas } = diagnostico
  // Causas secundarias: cualquier otra que no cumpla y cuya brecha esté cerca de la principal
  // (dentro del 60% de su magnitud) — si hay 2-3 palancas rotas a la vez, no ocultamos las demás.
  const causasSecundarias = causas.filter(c => c !== causaPrincipal && !c.cumple && causaPrincipal && c.brechaPct >= causaPrincipal.brechaPct * 0.6)

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
          ✓ Proyecto viable — TIR Socio de {tirActual.toFixed(1)}%, {(tirActual - diagnostico.tirObjetivo).toFixed(1)} pts sobre el objetivo ({diagnostico.tirObjetivo}%).
        </p>
      ) : (
        <>
          <p className="text-[13px] text-red-300 font-semibold mb-3">
            ✕ Proyecto no viable — TIR Socio de {tirActual.toFixed(1)}% vs {diagnostico.tirObjetivo}% objetivo.
            {causaPrincipal && ` Causa principal: ${causaPrincipal.etiqueta.toLowerCase()}.`}
          </p>
          <div className="flex flex-col gap-2">
            {causaPrincipal && <FilaCausa causa={causaPrincipal} esPrincipal />}
            {causasSecundarias.map(c => <FilaCausa key={c.palanca} causa={c} esPrincipal={false} />)}
          </div>
        </>
      )}
    </div>
  )
}
