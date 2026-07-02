'use client'

import { useMastermind } from '../state'

function fmtTir(v: number | null, converge: boolean) {
  if (!converge || v === null) return 'No calculable'
  return `${v.toFixed(1)}%`
}

// Gauge circular de TIR Socio vs TIR objetivo — misma técnica de arco SVG que
// ScoreGauge en app/analisis/page.tsx, con una marca radial señalando el objetivo.
function TirGauge({ tirSocio, tirObjetivo, converge }: { tirSocio: number | null; tirObjetivo: number; converge: boolean }) {
  const cx = 70, cy = 74, r = 54
  const circ = Math.PI * r
  const scaleMax = Math.max(tirObjetivo * 1.6, (tirSocio ?? 0) * 1.2, 40)

  const valorClamp = converge && tirSocio !== null ? Math.max(0, Math.min(scaleMax, tirSocio)) : 0
  const dash = (valorClamp / scaleMax) * circ

  const color = !converge ? '#9aab9f' : (tirSocio as number) >= tirObjetivo ? '#1D9E75' : '#DC2626'

  const fObjetivo = Math.min(1, tirObjetivo / scaleMax)
  const angulo = Math.PI * (1 - fObjetivo)
  const marcaX1 = cx + 42 * Math.cos(angulo), marcaY1 = cy - 42 * Math.sin(angulo)
  const marcaX2 = cx + 66 * Math.cos(angulo), marcaY2 = cy - 66 * Math.sin(angulo)

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 90 }}>
        <svg width="140" height="90" viewBox="0 0 140 90" fill="none">
          <path d="M 16 74 A 54 54 0 0 1 124 74" stroke="#F0F4F2" strokeWidth="12" strokeLinecap="round" fill="none" />
          <path d="M 16 74 A 54 54 0 0 1 124 74" stroke={color} strokeWidth="12" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
          <line x1={marcaX1} y1={marcaY1} x2={marcaX2} y2={marcaY2} stroke="#111d17" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1">
          <span className="text-[26px] font-black leading-none" style={{ color }}>{converge ? `${(tirSocio as number).toFixed(0)}%` : '—'}</span>
          <span className="text-[10px] text-[#9aab9f]">TIR Socio</span>
        </div>
      </div>
      <span className="text-[11px] text-[#9aab9f] mt-1">Marca negra = objetivo ({tirObjetivo}%)</span>
    </div>
  )
}

export default function RetornoCard() {
  const { outputs, inputs } = useMastermind()
  const r = outputs.retorno

  const viable = r.tirSocioConverge && (r.tirSocioAnual as number) >= inputs.tirObjetivo

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] p-6">
      <h3 className="text-[14px] font-bold text-[#111d17] mb-4">Retorno</h3>

      <div className="flex justify-center mb-4">
        <TirGauge tirSocio={r.tirSocioAnual} tirObjetivo={inputs.tirObjetivo} converge={r.tirSocioConverge} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#F0F4F2] rounded-xl p-3">
          <p className="text-[11px] text-[#5a7065] mb-1">TIR Socio (apalancada)</p>
          <p className="text-[20px] font-bold text-[#111d17]">{fmtTir(r.tirSocioAnual, r.tirSocioConverge)}</p>
          <p className="text-[10px] text-[#9aab9f] mt-0.5">vs objetivo {inputs.tirObjetivo}%</p>
        </div>
        <div className="bg-[#F0F4F2] rounded-xl p-3">
          <p className="text-[11px] text-[#5a7065] mb-1">TIR Proyecto (sin apalancar)</p>
          <p className="text-[20px] font-bold text-[#111d17]">{fmtTir(r.tirProyectoAnual, r.tirProyectoConverge)}</p>
          <p className="text-[10px] text-[#9aab9f] mt-0.5">referencia unlevered</p>
        </div>
      </div>

      <div
        className="rounded-xl p-3 mb-4 text-[13px] font-semibold"
        style={{
          backgroundColor: r.tirSocioConverge ? (viable ? '#E1F5EE' : '#FEE2E2') : '#F0F4F2',
          color: r.tirSocioConverge ? (viable ? '#0F6E56' : '#DC2626') : '#5a7065',
        }}
      >
        {!r.tirSocioConverge ? 'TIR no calculable con estos parámetros' : viable ? '✓ Proyecto viable' : '✕ Ajustar parámetros'}
      </div>

      <table className="w-full text-[13px]">
        <tbody>
          <tr className="border-b border-[#F0F4F2]">
            <td className="py-2 text-[#5a7065]">ROI simple</td>
            <td className="py-2 text-right font-medium text-[#111d17]">{r.roiSimple.toFixed(1)}%</td>
          </tr>
          <tr className="border-b border-[#F0F4F2]">
            <td className="py-2 text-[#5a7065]">Payback</td>
            <td className="py-2 text-right font-medium text-[#111d17]">{r.paybackMeses.toFixed(1)} meses</td>
          </tr>
          <tr>
            <td className="py-2 text-[#5a7065]">Punto de equilibrio</td>
            <td className="py-2 text-right font-medium text-[#111d17]">{r.puntoEquilibrioUnidades} unidades</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
