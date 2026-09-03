'use client'

import { useMemo } from 'react'
import { useMastermind } from '../state'
import { generarMatrizSensibilidad } from '@/lib/mastermind/sensibilidad'
import type { SensitivityCell } from '@/lib/mastermind/tipos'

const COLOR_SEMAFORO: Record<SensitivityCell['semaforo'], { bg: string; text: string }> = {
  verde_oscuro: { bg: '#0A5C47', text: '#FFFFFF' },
  verde: { bg: '#1D9E75', text: '#FFFFFF' },
  amarillo: { bg: '#D97706', text: '#FFFFFF' },
  rojo: { bg: '#DC2626', text: '#FFFFFF' },
  gris: { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.3)' },
}

function fmtMXN(n: number) { return `$${Math.round(n / 1000).toLocaleString('es-MX')}k` }

export default function SensitivityMatrix() {
  const { inputs } = useMastermind()
  const matriz = useMemo(() => generarMatrizSensibilidad(inputs), [inputs])

  const columnas = matriz[0].map(c => c.precioVentaM2)
  const filas = matriz.map(fila => fila[0].benchmarkMxnM2)

  return (
    <div className="rounded-xl border border-white/10 p-5" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 60%)' }}>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227]" />
        Matriz de sensibilidad
      </h3>
      <p className="text-[11px] text-white/30 mb-4">Precio de venta (columnas) vs. costo de construcción (filas) → TIR Socio</p>

      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-20" />
              {columnas.map((c, i) => (
                <th key={i} className="text-[10px] font-mono font-semibold text-white/40 px-1 pb-1">{fmtMXN(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.map((fila, fi) => (
              <tr key={fi}>
                <td className="text-[10px] font-mono font-semibold text-white/40 text-right pr-2 whitespace-nowrap">{fmtMXN(filas[fi])}</td>
                {fila.map((celda, ci) => {
                  const c = COLOR_SEMAFORO[celda.semaforo]
                  return (
                    <td key={ci} className="p-0.5">
                      <div
                        className="w-16 h-12 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold"
                        style={{ backgroundColor: c.bg, color: c.text }}
                        title={`Precio ${fmtMXN(celda.precioVentaM2)}/m² · Benchmark ${fmtMXN(celda.benchmarkMxnM2)}/m²`}
                      >
                        {celda.tirSocio !== null ? `${celda.tirSocio.toFixed(0)}%` : '—'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SEMAFORO.verde_oscuro.bg }} />&gt; objetivo +10%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SEMAFORO.verde.bg }} />&gt;= objetivo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SEMAFORO.amarillo.bg }} />objetivo -5% a objetivo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: COLOR_SEMAFORO.rojo.bg }} />&lt; objetivo -5%</span>
      </div>
    </div>
  )
}
