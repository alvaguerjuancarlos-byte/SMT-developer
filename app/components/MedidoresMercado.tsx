// Medidores del Agente de Mercado (pedido de JC, 6-nov): dos semicírculos paralelos con zonas
// verde / amarillo / rojo y aguja.
//  - Precio vs mercado: dónde cae el precio de venta propuesto dentro del rango de los comparables
//    verificados (verde hasta la mediana = competitivo, amarillo hasta el máximo = parte alta del
//    rango, rojo arriba del comparable más caro = fuera de mercado).
//  - Absorción: meses para vender todas las unidades al ritmo de la zona (verde ≤ 18, amarillo
//    ≤ 30, rojo > 30). Sin número de unidades, el medidor usa el ritmo mensual directamente.
// Son lecturas ilustrativas de los mismos datos que ya muestra la tarjeta, no un cálculo nuevo.

import type { ReactNode } from 'react'

const VERDE = '#1D9E75', AMARILLO = '#E3B341', ROJO = '#DC2626'

type Zona = { hasta: number; color: string }

function Semicirculo({ min, max, valor, zonas, centro, sub, estado, colorEstado }: {
  min: number; max: number; valor: number; zonas: Zona[]; centro: string; sub: string; estado: string; colorEstado: string
}) {
  const cx = 110, cy = 104, r = 84, grosor = 16
  const ang = (v: number) => Math.PI * (1 - Math.max(0, Math.min(1, (v - min) / (max - min || 1))))
  const punto = (v: number, rr: number) => [cx + rr * Math.cos(ang(v)), cy - rr * Math.sin(ang(v))]
  const arco = (a: number, b: number) => {
    const [x1, y1] = punto(a, r), [x2, y2] = punto(b, r)
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
  }
  const [ax, ay] = punto(valor, r - grosor / 2 - 10), [bx, by] = punto(valor, r + grosor / 2 + 5)
  return (
    <svg viewBox="0 0 220 122" className="w-full h-auto max-w-[300px]">
      {zonas.map((z, i) => {
        const d = arco(i === 0 ? min : zonas[i - 1].hasta, Math.min(z.hasta, max))
        return <path key={i} d={d} stroke={z.color} strokeWidth={grosor} fill="none" strokeOpacity="0.9" />
      })}
      {/* marcador sobre el arco (no aguja desde el centro, para no tapar la cifra) */}
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#0b1d3a" strokeWidth="7" strokeLinecap="round" />
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#f4f0e6" strokeWidth="3.5" strokeLinecap="round" />
      <text x={cx} y={cy - 22} textAnchor="middle" fontSize="19" fontWeight="800" fill="#f4f0e6">{centro}</text>
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="9" fontWeight="700" fill={colorEstado} style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{estado}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="8.5" fill="#8b96ab">{sub}</text>
    </svg>
  )
}

const num = (t: string | null | undefined) => {
  const v = (t ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/g)?.map(Number) ?? []
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const mx = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`

export function MedidoresMercado({ precioVenta, preciosComparables, precioZonaTexto, absorcionTexto, unidades }: {
  precioVenta: number | null | undefined
  preciosComparables: number[]
  precioZonaTexto?: string | null
  absorcionTexto?: string | null
  unidades?: number | null
}) {
  // ── precio ──
  let precio: ReactNode = null
  const comps = preciosComparables.filter(p => p > 0).sort((a, b) => a - b)
  const zonaRef = num(precioZonaTexto)
  const base = comps.length >= 2 ? comps : zonaRef ? [zonaRef * 0.85, zonaRef, zonaRef * 1.15] : []
  if (precioVenta && base.length >= 2) {
    const lo = base[0], hi = base[base.length - 1], med = base[Math.floor(base.length / 2)]
    const min = lo * 0.85, max = Math.max(hi * 1.2, precioVenta * 1.05)
    const estado = precioVenta <= med ? ['Competitivo', VERDE] : precioVenta <= hi ? ['Parte alta del rango', AMARILLO] : ['Arriba del mercado', ROJO]
    const dif = ((precioVenta - med) / med) * 100
    precio = (
      <Semicirculo min={min} max={max} valor={precioVenta} zonas={[{ hasta: med, color: VERDE }, { hasta: hi, color: AMARILLO }, { hasta: max, color: ROJO }]}
        centro={`${mx(precioVenta)}/m²`} estado={estado[0]} colorEstado={estado[1]}
        sub={`Mediana comparables ${mx(med)}/m² (${dif >= 0 ? '+' : ''}${dif.toFixed(0)}%)`} />
    )
  }

  // ── absorción ──
  let absorcion: ReactNode = null
  const ritmo = num(absorcionTexto)
  if (ritmo && ritmo > 0) {
    if (unidades && unidades > 0) {
      const meses = unidades / ritmo
      const estado = meses <= 18 ? ['Rápida', VERDE] : meses <= 30 ? ['Media', AMARILLO] : ['Lenta', ROJO]
      absorcion = (
        <Semicirculo min={0} max={48} valor={meses} zonas={[{ hasta: 18, color: VERDE }, { hasta: 30, color: AMARILLO }, { hasta: 48, color: ROJO }]}
          centro={`${meses.toFixed(0)} meses`} estado={estado[0]} colorEstado={estado[1]}
          sub={`${unidades} unidades a ${ritmo.toFixed(ritmo % 1 ? 1 : 0)} por mes`} />
      )
    } else {
      const estado = ritmo >= 6 ? ['Rápida', VERDE] : ritmo >= 3 ? ['Media', AMARILLO] : ['Lenta', ROJO]
      absorcion = (
        <Semicirculo min={0} max={12} valor={ritmo} zonas={[{ hasta: 3, color: ROJO }, { hasta: 6, color: AMARILLO }, { hasta: 12, color: VERDE }]}
          centro={`${ritmo.toFixed(ritmo % 1 ? 1 : 0)} uds/mes`} estado={estado[0]} colorEstado={estado[1]} sub="Ritmo de venta de la zona" />
      )
    }
  }

  if (!precio && !absorcion) return null
  const panel = 'bg-[#0f2343] border border-[#2a3f5c] rounded-xl px-3 pt-3 pb-2 flex flex-col items-center'
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={panel}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b96ab] mb-1 self-start">Precio vs mercado</p>
        {precio ?? <p className="text-[11px] text-[#5f6a80] py-8">Sin comparables suficientes</p>}
      </div>
      <div className={panel}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b96ab] mb-1 self-start">Absorción</p>
        {absorcion ?? <p className="text-[11px] text-[#5f6a80] py-8">Sin dato de absorción</p>}
      </div>
    </div>
  )
}
