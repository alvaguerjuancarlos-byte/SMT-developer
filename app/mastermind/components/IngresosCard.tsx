'use client'

import { useMastermind } from '../state'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

function BarraProporcional({ hab, comercial }: { hab: number; comercial: number }) {
  const total = hab + comercial
  if (total <= 0) return null
  const pctHab = (hab / total) * 100
  const pctComercial = 100 - pctHab

  return (
    <div className="mb-4">
      <div className="flex h-3 rounded-full overflow-hidden bg-[#F0F4F2]">
        {pctHab > 0 && <div style={{ width: `${pctHab}%` }} className="bg-[#1D9E75]" />}
        {pctComercial > 0 && <div style={{ width: `${pctComercial}%` }} className="bg-[#C9A227]" />}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-[#5a7065]">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1D9E75]" />Habitacional {pctHab.toFixed(0)}%</span>
        {comercial > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C9A227]" />Comercial {pctComercial.toFixed(0)}%</span>}
      </div>
    </div>
  )
}

export default function IngresosCard() {
  const { outputs } = useMastermind()
  const i = outputs.ingresos

  const filas: [string, string][] = [
    ['m² vendibles habitacional', `${i.m2VendiblesHabitacional.toLocaleString('es-MX')} m²`],
    ['m² vendibles comercial', `${i.m2VendiblesComercial.toLocaleString('es-MX')} m²`],
    ['Ingreso bruto habitacional', fmt(i.ingresoBrutoHabitacional)],
    ['Ingreso bruto comercial', fmt(i.ingresoBrutoComercial)],
    ['Ingreso bruto total', fmt(i.ingresoBrutoTotal)],
    ['Descuentos y cancelaciones (-5%)', `-${fmt(i.descuentos)}`],
  ]

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] p-6">
      <h3 className="text-[14px] font-bold text-[#111d17] mb-4">Ingresos</h3>
      <BarraProporcional hab={i.ingresoBrutoHabitacional} comercial={i.ingresoBrutoComercial} />
      <table className="w-full text-[13px]">
        <tbody>
          {filas.map(([label, valor]) => (
            <tr key={label} className="border-b border-[#F0F4F2] last:border-0">
              <td className="py-2 text-[#5a7065]">{label}</td>
              <td className="py-2 text-right font-medium text-[#111d17]">{valor}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 font-bold text-[#111d17]">Ingreso neto</td>
            <td className="py-2 text-right font-bold text-[#1D9E75]">{fmt(i.ingresoNeto)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
