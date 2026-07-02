'use client'

import { useMemo } from 'react'
import { useMastermind } from '../state'
import { resolverBenchmarkMaximo, resolverPrecioVentaMinimo, resolverUnidadesMinimas } from '@/lib/mastermind/solvers'
import type { SolverResult } from '@/lib/mastermind/tipos'

function fmtMXN(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

function TarjetaSolver({
  titulo,
  resultado,
  valorActual,
  fmt,
  unidad,
  mejorEsMayor,
  min,
  max,
  step,
  onChange,
}: {
  titulo: string
  resultado: SolverResult
  valorActual: number
  fmt: (n: number) => string
  unidad: string
  mejorEsMayor: boolean
  min: number
  max: number
  step: number
  onChange?: (v: number) => void
}) {
  if (!resultado.converged || resultado.valor === null) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8E4] p-4">
        <h4 className="text-[12px] font-bold text-[#111d17] mb-2">{titulo}</h4>
        <p className="text-[12px] text-[#9aab9f]">No se encontró un valor viable en el rango explorado.</p>
      </div>
    )
  }

  const objetivo = resultado.valor
  const cumple = mejorEsMayor ? valorActual >= objetivo : valorActual <= objetivo
  const margen = mejorEsMayor
    ? objetivo > 0 ? ((valorActual - objetivo) / objetivo) * 100 : 0
    : objetivo > 0 ? ((objetivo - valorActual) / objetivo) * 100 : 0

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] p-4">
      <h4 className="text-[12px] font-bold text-[#111d17] mb-2">{titulo}</h4>
      <p className="text-[20px] font-black" style={{ color: cumple ? '#1D9E75' : '#DC2626' }}>{fmt(objetivo)}</p>
      <p className="text-[10px] text-[#9aab9f] mb-3">{mejorEsMayor ? 'mínimo' : 'máximo'} para {resultado.tirAlcanzada?.toFixed(1)}% TIR</p>

      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#5a7065]">Valor actual: {fmt(valorActual)}</span>
        <span className="text-[10px] font-semibold" style={{ color: cumple ? '#0F6E56' : '#DC2626' }}>
          {cumple ? `+${Math.abs(margen).toFixed(0)}%` : `${margen.toFixed(0)}%`} margen
        </span>
      </div>
      {onChange ? (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={Math.min(max, Math.max(min, valorActual))}
            onChange={e => onChange(e.target.valueAsNumber)}
            className="w-full accent-[#1D9E75] cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#C4CEC8] mt-0.5">
            <span>{fmt(min)}{unidad}</span>
            <span>{fmt(max)}{unidad}</span>
          </div>
        </>
      ) : (
        <div className="h-3 rounded-full bg-[#F0F4F2] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, (valorActual / max) * 100))}%`, backgroundColor: cumple ? '#1D9E75' : '#DC2626' }}
          />
        </div>
      )}
    </div>
  )
}

export default function ReverseEngineeringPanel() {
  const { inputs, outputs, setMercado, setProyecto } = useMastermind()

  const precio = useMemo(() => resolverPrecioVentaMinimo(inputs), [inputs])
  const benchmark = useMemo(() => resolverBenchmarkMaximo(inputs), [inputs])
  const unidades = useMemo(() => resolverUnidadesMinimas(inputs), [inputs])

  const unidadesExcedeConstruido = unidades.converged && unidades.valor !== null
    && unidades.valor * inputs.proyecto.m2PromedioDepa > outputs.costos.m2Construidos

  return (
    <div className="bg-[#0A1F13] rounded-2xl p-5">
      <h3 className="text-[13px] font-bold text-white mb-1">Ingeniería inversa</h3>
      <p className="text-[11px] text-white/50 mb-4">Qué necesita el proyecto para alcanzar {inputs.tirObjetivo}% de TIR Socio</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TarjetaSolver
          titulo="Precio mínimo venta/m²"
          resultado={precio}
          valorActual={inputs.mercado.precioVentaDepasM2}
          fmt={fmtMXN}
          unidad="/m²"
          mejorEsMayor={true}
          min={5_000}
          max={100_000}
          step={500}
          onChange={v => setMercado({ precioVentaDepasM2: v })}
        />
        <TarjetaSolver
          titulo="Costo máximo construcción"
          resultado={benchmark}
          valorActual={outputs.costos.costoDirectoConstruccion / Math.max(1, outputs.costos.m2Construidos)}
          fmt={fmtMXN}
          unidad="/m²"
          mejorEsMayor={false}
          min={3_000}
          max={40_000}
          step={250}
        />
        <TarjetaSolver
          titulo="Unidades mínimas a vender"
          resultado={unidades}
          valorActual={inputs.proyecto.unidadesHabitacionales}
          fmt={n => `${Math.round(n)} uds`}
          unidad=""
          mejorEsMayor={true}
          min={1}
          max={500}
          step={1}
          onChange={v => setProyecto({ unidadesHabitacionales: Math.round(v) })}
        />
      </div>
      <p className="text-[10px] text-white/30 mt-2">
        El costo de construcción se ajusta por categoría en Proyecto → Benchmark construcción; esta tarjeta es de referencia.
      </p>

      {unidadesExcedeConstruido && (
        <p className="text-[11px] text-amber-300 mt-3">
          Las unidades mínimas resueltas no caben en el área construida actual ({outputs.costos.m2Construidos.toLocaleString('es-MX')} m²) — revisa niveles o m² promedio por depa.
        </p>
      )}
    </div>
  )
}
