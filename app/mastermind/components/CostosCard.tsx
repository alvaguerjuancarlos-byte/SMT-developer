'use client'

import { useMastermind } from '../state'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

const COLORES: Record<string, string> = {
  Terreno: '#0F6E56',
  'Construcción (directo)': '#1D9E75',
  'Indirectos (15%)': '#5DCAA5',
  'Comercialización (3%)': '#C9A227',
  Financieros: '#DC2626',
}

function BarraApilada({ filas, total }: { filas: [string, number][]; total: number }) {
  if (total <= 0) return null
  return (
    <div className="mb-4">
      <div className="flex h-3 rounded-full overflow-hidden bg-[#F0F4F2]">
        {filas.map(([label, valor]) => valor > 0 && (
          <div key={label} style={{ width: `${(valor / total) * 100}%`, backgroundColor: COLORES[label] }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#5a7065]">
        {filas.map(([label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORES[label] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function CostosCard() {
  const { outputs } = useMastermind()
  const c = outputs.costos

  const filas: [string, number][] = [
    ['Terreno', c.costoTerreno],
    ['Construcción (directo)', c.costoDirectoConstruccion],
    ['Indirectos (15%)', c.indirectos],
    ['Comercialización (3%)', c.comercializacion],
    ['Financieros', c.financieros],
  ]

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] p-6">
      <h3 className="text-[14px] font-bold text-[#111d17] mb-1">Costos</h3>
      <p className="text-[11px] text-[#9aab9f] mb-4">m² construidos: {c.m2Construidos.toLocaleString('es-MX')} m²</p>
      <BarraApilada filas={filas} total={c.costoTotal} />
      <table className="w-full text-[13px]">
        <tbody>
          {filas.map(([label, valor]) => (
            <tr key={label} className="border-b border-[#F0F4F2] last:border-0">
              <td className="py-2 text-[#5a7065]">{label}</td>
              <td className="py-2 text-right font-medium text-[#111d17]">{fmt(valor)}</td>
              <td className="py-2 pl-3 text-right text-[11px] text-[#9aab9f] w-16">
                {c.costoTotal > 0 ? `${((valor / c.costoTotal) * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-2 font-bold text-[#111d17]">Costo total</td>
            <td className="py-2 text-right font-bold text-[#111d17]">{fmt(c.costoTotal)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
