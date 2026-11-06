import type { TipologiaPropuesta, ZonaArquitectura } from '@/lib/analisis/tipos'

// Vistas ilustrativas del Agente de Arquitectura (no un plano real): perspectiva isométrica del
// edificio sobre el lote como vista principal, más planta de conjunto y un corte que muestra los
// sótanos de estacionamiento con sus cajones (pedido de JC, 6-nov: el boceto anterior era una
// fachada chica y los cajones no se entendían). Todo sale de los mismos datos del programa
// (niveles, huella, m² y cajones de estacionamiento, área libre); la forma del lote usa la misma
// proporción fija ancho:fondo que ya usaba VistaAereaTerreno porque no hay geometría real del
// predio. Supuesto: el estacionamiento va en sótano bajo casi todo el lote (90%), y el número
// de sótanos es el que hace caber los m² de estacionamiento del desglose de zonas.

const RATIO = 0.72 // ancho:fondo ilustrativo de un lote urbano típico
const H_COMERCIAL = 4.5
const H_NIVEL = 3.2
const H_SOTANO = 3.0
const CALLE = 9 // banqueta + arroyo, en metros

type Pt = [number, number]
const pts = (arr: Pt[]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function envolvente(p: Pt[]): Pt[] {
  const s = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const inf: Pt[] = [], sup: Pt[] = []
  for (const q of s) { while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], q) <= 0) inf.pop(); inf.push(q) }
  for (const q of [...s].reverse()) { while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], q) <= 0) sup.pop(); sup.push(q) }
  return [...inf.slice(0, -1), ...sup.slice(0, -1)]
}

interface Modelo {
  LW: number; LD: number              // lote (m)
  bx0: number; by0: number; bw: number; bd: number  // huella (m)
  pisos: { z: number; h: number; tipo: 'comercial' | 'habitacional' }[]
  H: number
  amenidades: boolean
  sotanos: number
  cajones: number
  m2Estacionamiento: number
}

function construirModelo(tip: TipologiaPropuesta, superficieTerreno: number, superficieConstruida: number, zonas?: ZonaArquitectura[]): Modelo | null {
  const nCom = tip.comercial?.niveles ?? 0
  const nTot = tip.niveles ?? (nCom + (tip.habitacional ? 1 : 0))
  const nHab = Math.max(nTot - nCom, tip.habitacional ? 1 : 0)
  if (superficieTerreno <= 0 || nCom + nHab === 0) return null

  const LW = Math.sqrt(superficieTerreno * RATIO)
  const LD = Math.sqrt(superficieTerreno / RATIO)
  const huella = superficieConstruida > 0 ? superficieConstruida / Math.max(nCom + nHab, 1) : superficieTerreno * 0.5
  const k = Math.sqrt(Math.max(0.12, Math.min(0.8, huella / superficieTerreno)))
  const bw = LW * k, bd = LD * k
  const bx0 = (LW - bw) / 2
  const by0 = (LD - bd) * 0.38 // un poco hacia atrás: deja plaza de acceso al frente

  const pisos: Modelo['pisos'] = []
  let z = 0
  for (let i = 0; i < nCom; i++) { pisos.push({ z, h: H_COMERCIAL, tipo: 'comercial' }); z += H_COMERCIAL }
  for (let i = 0; i < nHab; i++) { pisos.push({ z, h: H_NIVEL, tipo: 'habitacional' }); z += H_NIVEL }

  const zonaEst = zonas?.find(zz => /estacionamiento/i.test(zz.zona))
  const m2Estacionamiento = zonaEst?.m2 ?? 0
  const cajones = zonaEst?.cajonesEstimados ?? (m2Estacionamiento > 0 ? Math.round(m2Estacionamiento / 25) : 0)
  const sotanos = m2Estacionamiento > 0 ? Math.max(1, Math.ceil(m2Estacionamiento / (superficieTerreno * 0.9))) : 0

  return { LW, LD, bx0, by0, bw, bd, pisos, H: z, amenidades: !!tip.tamanoAmenidades, sotanos, cajones, m2Estacionamiento }
}

// ── Perspectiva isométrica ────────────────────────────────────────────────────────────────
function Perspectiva({ m }: { m: Modelo }) {
  const { LW, LD, bx0, by0, bw, bd, H, pisos } = m
  const bx1 = bx0 + bw, by1 = by0 + bd
  const C = Math.cos(Math.PI / 6), S = 0.5
  const raw = (x: number, y: number, z: number): Pt => [(x - y) * C, (x + y) * S - z]

  const extremos = [raw(0, 0, 0), raw(LW, 0, 0), raw(0, LD + CALLE, 0), raw(LW, LD + CALLE, 0), raw(bx0, by0, H + 6), raw(bx1, by0, H + 6)]
  const minX = Math.min(...extremos.map(p => p[0])), maxX = Math.max(...extremos.map(p => p[0]))
  const minY = Math.min(...extremos.map(p => p[1])), maxY = Math.max(...extremos.map(p => p[1]))
  const K = 640 / (maxX - minX)
  const PAD = 18
  const W = 640 + PAD * 2, Hs = (maxY - minY) * K + PAD * 2
  const P = (x: number, y: number, z = 0): Pt => { const [a, b] = raw(x, y, z); return [(a - minX) * K + PAD, (b - minY) * K + PAD] }
  const caja = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) => ({
    izq: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)] as Pt[],
    der: [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)] as Pt[],
    techo: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)] as Pt[],
  })
  const ed = caja(bx0, by0, bx1, by1, 0, H)

  // sombra hacia atrás-izquierda (luz desde el frente-derecha)
  const sx = -0.42 * H, sy = -0.12 * H
  const sombra = envolvente([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]].flatMap(([x, y]) => [P(x, y), P(x + sx, y + sy)]))

  const modulos = (largo: number) => Math.max(3, Math.round(largo / 4.2))
  const nIzq = modulos(bw), nDer = modulos(bd)

  // árboles: plaza frontal y costados (los de atrás se dibujan antes que el edificio)
  const arboles: Pt[] = [
    [bx0 - 2.6, by0 + 4], [bx0 - 2.6, by0 + bd * 0.5], [bx0 - 2.6, by1 - 3],
    [bx1 + 2.6, by0 + 4], [bx1 + 2.6, by0 + bd * 0.5],
    [bx0 + bw * 0.15, LD - 2.2], [bx0 + bw * 0.45, LD - 2.2], [2.5, LD - 2.2],
  ].filter(([x, y]) => x > 1 && x < LW - 1 && y > 1 && y < LD - 1) as Pt[]
  const detras = (p: Pt) => p[0] < bx1 && p[1] < by1
  const arbol = ([x, y]: Pt, i: number) => {
    const base = P(x, y, 0), copa = P(x, y, 4.2)
    const r = 2.1 * K * 0.9
    return (
      <g key={i}>
        <ellipse cx={base[0] + r * 0.5} cy={base[1]} rx={r * 0.9} ry={r * 0.4} fill="#000" opacity="0.18" />
        <line x1={base[0]} y1={base[1]} x2={copa[0]} y2={copa[1]} stroke="#4a3a2a" strokeWidth={K * 0.28} />
        <circle cx={copa[0]} cy={copa[1]} r={r} fill="#2f7a5c" />
        <circle cx={copa[0] - r * 0.3} cy={copa[1] - r * 0.3} r={r * 0.55} fill="#4a9c7a" opacity="0.8" />
      </g>
    )
  }

  // rampa al sótano en la esquina frontal derecha
  const rx0 = LW - 7.5, rx1 = LW - 1.5
  const rampa = m.sotanos > 0 ? [P(rx0, by1 + 2), P(rx1, by1 + 2), P(rx1, LD), P(rx0, LD)] : null

  const ama = m.amenidades ? caja(bx0 + bw * 0.22, by0 + bd * 0.2, bx0 + bw * 0.72, by0 + bd * 0.62, H, H + 3.4) : null
  const nucleo = caja(bx1 - 7, by0 + 2, bx1 - 2, by0 + 8, H, H + 2.6)

  return (
    <svg viewBox={`0 0 ${W.toFixed(0)} ${Hs.toFixed(0)}`} className="w-full h-auto">
      <defs>
        <linearGradient id="va-izq" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9d6ec" /><stop offset="0.55" stopColor="#6f9dc4" /><stop offset="1" stopColor="#3d6a94" />
        </linearGradient>
        <linearGradient id="va-der" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f7ba5" /><stop offset="1" stopColor="#24476e" />
        </linearGradient>
        <linearGradient id="va-com-izq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1cc" /><stop offset="1" stopColor="#f0b860" />
        </linearGradient>
        <linearGradient id="va-com-der" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0b25c" /><stop offset="1" stopColor="#b9853a" />
        </linearGradient>
        <linearGradient id="va-lote" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b5a49" /><stop offset="1" stopColor="#1f4638" />
        </linearGradient>
      </defs>

      {/* calle y banqueta frente al lote */}
      <polygon points={pts([P(-4, LD + 2.5), P(LW + 4, LD + 2.5), P(LW + 4, LD + CALLE), P(-4, LD + CALLE)])} fill="#1b2638" />
      <polygon points={pts([P(-4, LD), P(LW + 4, LD), P(LW + 4, LD + 2.5), P(-4, LD + 2.5)])} fill="#56657a" />
      <line x1={P(-2, LD + 6)[0]} y1={P(-2, LD + 6)[1]} x2={P(LW + 2, LD + 6)[0]} y2={P(LW + 2, LD + 6)[1]} stroke="#d9dfe8" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="8 7" />

      {/* lote, plaza de acceso y rampa */}
      <polygon points={pts([P(0, 0), P(LW, 0), P(LW, LD), P(0, LD)])} fill="url(#va-lote)" stroke="#6fbf9c" strokeOpacity="0.5" strokeWidth="1" />
      <polygon points={pts([P(bx0 - 1.2, by1), P(bx1 + 1.2, by1), P(bx1 + 1.2, LD), P(bx0 - 1.2, LD)])} fill="#c9cfd8" opacity="0.28" />
      {rampa && <polygon points={pts(rampa)} fill="#2a3446" stroke="#8b96ab" strokeOpacity="0.6" strokeWidth="0.8" />}
      <polygon points={pts(sombra)} fill="#000" opacity="0.28" />

      {arboles.filter(detras).map(arbol)}

      {/* edificio: caras izquierda (frente) y derecha, por nivel */}
      {pisos.map((p, i) => {
        const c = caja(bx0, by0, bx1, by1, p.z, p.z + p.h)
        const com = p.tipo === 'comercial'
        return (
          <g key={i}>
            <polygon points={pts(c.izq)} fill={com ? 'url(#va-com-izq)' : 'url(#va-izq)'} />
            <polygon points={pts(c.der)} fill={com ? 'url(#va-com-der)' : 'url(#va-der)'} />
            {com && <polygon points={pts([P(bx0, by1, p.z + p.h - 0.9), P(bx1, by1, p.z + p.h - 0.9), P(bx1, by1, p.z + p.h), P(bx0, by1, p.z + p.h)])} fill="#24364f" />}
            {/* barandales de balcón en módulos alternos de la cara frontal */}
            {!com && Array.from({ length: nIzq }, (_, j) => j).filter(j => (j + i) % 2 === 0).map(j => {
              const xa = bx0 + (bw / nIzq) * j + 0.4, xb = bx0 + (bw / nIzq) * (j + 1) - 0.4
              return <polygon key={j} points={pts([P(xa, by1 + 0.01, p.z), P(xb, by1 + 0.01, p.z), P(xb, by1 + 0.01, p.z + 1.05), P(xa, by1 + 0.01, p.z + 1.05)])} fill="#ffffff" fillOpacity="0.16" stroke="#eef3f8" strokeOpacity="0.6" strokeWidth="0.6" />
            })}
            {/* losa */}
            <polygon points={pts([P(bx0, by1, p.z + p.h - 0.35), P(bx1, by1, p.z + p.h - 0.35), P(bx1, by1, p.z + p.h), P(bx0, by1, p.z + p.h)])} fill="#eef3f8" />
            <polygon points={pts([P(bx1, by1, p.z + p.h - 0.35), P(bx1, by0, p.z + p.h - 0.35), P(bx1, by0, p.z + p.h), P(bx1, by1, p.z + p.h)])} fill="#b8c4d2" />
          </g>
        )
      })}
      {/* parteluces */}
      {Array.from({ length: nIzq - 1 }, (_, j) => {
        const x = bx0 + (bw / nIzq) * (j + 1); const a = P(x, by1, 0), b = P(x, by1, H)
        return <line key={`mi${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#eef3f8" strokeOpacity="0.45" strokeWidth="0.8" />
      })}
      {Array.from({ length: nDer - 1 }, (_, j) => {
        const y = by1 - (bd / nDer) * (j + 1); const a = P(bx1, y, 0), b = P(bx1, y, H)
        return <line key={`md${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#c9d6e4" strokeOpacity="0.3" strokeWidth="0.8" />
      })}
      {/* azotea, pretil, núcleo y amenidades */}
      <polygon points={pts(ed.techo)} fill="#c3ccd8" stroke="#eef3f8" strokeWidth="1.2" />
      <polygon points={pts(nucleo.izq)} fill="#d7dee7" /><polygon points={pts(nucleo.der)} fill="#9eacbd" /><polygon points={pts(nucleo.techo)} fill="#e9eef4" />
      {ama && (<>
        <polygon points={pts(ama.izq)} fill="url(#va-izq)" opacity="0.9" />
        <polygon points={pts(ama.der)} fill="url(#va-der)" opacity="0.9" />
        <polygon points={pts(ama.techo)} fill="#e9eef4" />
      </>)}
      <line x1={ed.izq[0][0]} y1={ed.izq[0][1]} x2={ed.izq[3][0]} y2={ed.izq[3][1]} stroke="#eef3f8" strokeOpacity="0.7" strokeWidth="1" />
      <line x1={ed.der[0][0]} y1={ed.der[0][1]} x2={ed.der[3][0]} y2={ed.der[3][1]} stroke="#eef3f8" strokeOpacity="0.8" strokeWidth="1.2" />

      {arboles.filter(p => !detras(p)).map(arbol)}
    </svg>
  )
}

// ── Planta de conjunto ────────────────────────────────────────────────────────────────────
function Planta({ m }: { m: Modelo }) {
  const { LW, LD, bx0, by0, bw, bd } = m
  const K = 230 / LD
  const PAD = 14
  const W = LW * K + PAD * 2 + 44, Hs = (LD + CALLE) * K + PAD * 2
  const X = (x: number) => PAD + x * K, Y = (y: number) => PAD + y * K
  const arboles: Pt[] = [[bx0 - 2.6, by0 + 4], [bx0 - 2.6, by0 + bd * 0.5], [bx0 - 2.6, by0 + bd - 3], [bx0 + bw + 2.6, by0 + 4], [bx0 + bw + 2.6, by0 + bd * 0.5], [bx0 + bw * 0.15, LD - 2.2], [bx0 + bw * 0.45, LD - 2.2], [2.5, LD - 2.2]]
    .filter(([x, y]) => x > 1 && x < LW - 1 && y > 1 && y < LD - 1) as Pt[]
  const nx = LW * K + PAD + 28
  return (
    <svg viewBox={`0 0 ${W.toFixed(0)} ${Hs.toFixed(0)}`} className="w-full h-auto">
      <defs>
        <pattern id="va-pasto" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#244f40" /><line x1="0" y1="0" x2="0" y2="6" stroke="#2f6650" strokeWidth="1.6" />
        </pattern>
      </defs>
      <rect x={X(-1)} y={Y(LD)} width={LW * K + 2 * K} height={2.5 * K} fill="#56657a" />
      <rect x={X(-1)} y={Y(LD + 2.5)} width={LW * K + 2 * K} height={(CALLE - 2.5) * K} fill="#1b2638" />
      <line x1={X(0)} y1={Y(LD + 6)} x2={X(LW)} y2={Y(LD + 6)} stroke="#d9dfe8" strokeOpacity="0.5" strokeDasharray="6 5" />
      <text x={X(LW / 2)} y={Y(LD + CALLE) - 3} textAnchor="middle" fontSize="8" fill="#8b96ab">CALLE</text>

      <rect x={X(0)} y={Y(0)} width={LW * K} height={LD * K} fill="url(#va-pasto)" stroke="#6fbf9c" strokeOpacity="0.6" />
      <rect x={X(bx0 - 1.2)} y={Y(by0 + bd)} width={(bw + 2.4) * K} height={(LD - by0 - bd) * K} fill="#8f9aab" opacity="0.35" />
      {m.sotanos > 0 && (
        <g>
          <rect x={X(LW - 7.5)} y={Y(by0 + bd + 2)} width={6 * K} height={(LD - by0 - bd - 2) * K} fill="#2a3446" stroke="#8b96ab" strokeOpacity="0.6" />
          <path d={`M${X(LW - 4.5)},${Y(LD) - 4} L${X(LW - 4.5)},${Y(by0 + bd + 2) + 8} M${X(LW - 4.5) - 3.5},${Y(by0 + bd + 2) + 12} L${X(LW - 4.5)},${Y(by0 + bd + 2) + 7} L${X(LW - 4.5) + 3.5},${Y(by0 + bd + 2) + 12}`} stroke="#ddc06a" strokeWidth="1.3" fill="none" />
        </g>
      )}
      <rect x={X(bx0) + 3} y={Y(by0) + 4} width={bw * K} height={bd * K} fill="#000" opacity="0.3" rx="1" />
      <rect x={X(bx0)} y={Y(by0)} width={bw * K} height={bd * K} fill="#c3ccd8" stroke="#eef3f8" strokeWidth="1.2" rx="1" />
      {m.amenidades && <rect x={X(bx0 + bw * 0.22)} y={Y(by0 + bd * 0.2)} width={bw * 0.5 * K} height={bd * 0.42 * K} fill="#7ea6cb" stroke="#eef3f8" strokeOpacity="0.8" strokeDasharray="3 2" />}
      <rect x={X(bx0 + bw - 7)} y={Y(by0 + 2)} width={5 * K} height={6 * K} fill="#e9eef4" stroke="#9eacbd" />
      {arboles.map(([x, y], i) => <circle key={i} cx={X(x)} cy={Y(y)} r={2.1 * K} fill="#3f8a6f" stroke="#6fbf9c" strokeOpacity="0.5" />)}

      {/* cotas */}
      <text x={X(LW / 2)} y={Y(0) - 4} textAnchor="middle" fontSize="8" fill="#8b96ab">{LW.toFixed(1)} m</text>
      <text x={X(0) - 4} y={Y(LD / 2)} textAnchor="middle" fontSize="8" fill="#8b96ab" transform={`rotate(-90 ${X(0) - 4} ${Y(LD / 2)})`}>{LD.toFixed(1)} m</text>
      {/* norte */}
      <g transform={`translate(${nx},${PAD + 14})`}>
        <circle r="9" fill="none" stroke="#5f6a80" />
        <path d="M0,-7 L4,5 L0,2 L-4,5 Z" fill="#ddc06a" />
        <text y="20" textAnchor="middle" fontSize="8" fontWeight="700" fill="#8b96ab">N</text>
      </g>
    </svg>
  )
}

// ── Corte con sótanos de estacionamiento ──────────────────────────────────────────────────
function Corte({ m }: { m: Modelo }) {
  const { LW, bx0, bw, H, pisos, sotanos, cajones } = m
  const prof = sotanos * H_SOTANO
  const K = 300 / (LW + 8)
  const PADX = 14, top = 14
  const alto = (H + (m.amenidades ? 3.4 : 0) + prof + 3) * K + top + 12
  const W = (LW + 8) * K + PADX * 2
  const X = (x: number) => PADX + (x + 4) * K
  const Z = (z: number) => top + (H + (m.amenidades ? 3.4 : 0) - z) * K
  const porSotano = sotanos > 0 ? Math.ceil(cajones / sotanos) : 0
  const xRampa = LW - 9
  const xAutos = 1.2 + 74 / K // los autos empiezan después de la pastilla "S1 · n cajones"
  const nAutos = Math.max(0, Math.floor((xRampa - xAutos) / 2.6))
  const auto = (cx: number, zb: number, key: string) => {
    const w = 2.0 * K, h = 1.35 * K
    return (
      <g key={key}>
        <rect x={cx - w / 2} y={Z(zb) - h} width={w} height={h * 0.62} rx={h * 0.18} fill="#c9a227" />
        <rect x={cx - w * 0.32} y={Z(zb) - h * 1.25} width={w * 0.64} height={h * 0.45} rx={h * 0.16} fill="#ddc06a" />
        <circle cx={cx - w * 0.28} cy={Z(zb) - h * 0.32} r={h * 0.2} fill="#0b1d3a" />
        <circle cx={cx + w * 0.28} cy={Z(zb) - h * 0.32} r={h * 0.2} fill="#0b1d3a" />
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 ${W.toFixed(0)} ${alto.toFixed(0)}`} className="w-full h-auto">
      <defs>
        <pattern id="va-tierra" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#2a2620" /><line x1="0" y1="0" x2="0" y2="7" stroke="#3a3428" strokeWidth="1.4" />
        </pattern>
      </defs>
      {/* terreno natural */}
      <rect x={X(-4)} y={Z(0)} width={(LW + 8) * K} height={(prof + 2.2) * K} fill="url(#va-tierra)" />
      <line x1={X(-4)} y1={Z(0)} x2={X(LW + 4)} y2={Z(0)} stroke="#8b96ab" strokeWidth="1.2" />

      {/* sótanos */}
      {Array.from({ length: sotanos }, (_, s) => {
        const zTop = -s * H_SOTANO, zBot = zTop - H_SOTANO
        const n = s === sotanos - 1 ? cajones - porSotano * (sotanos - 1) : porSotano
        return (
          <g key={s}>
            <rect x={X(0.6)} y={Z(zTop)} width={(LW - 1.2) * K} height={H_SOTANO * K} fill="#16263f" stroke="#5f6a80" strokeWidth="1" />
            {Array.from({ length: nAutos }, (_, j) => auto(X(xAutos + 1.2 + j * 2.6), zBot + 0.15, `${s}-${j}`))}
            <rect x={X(1.2)} y={Z(zTop) + (H_SOTANO * K - 13) / 2} width={66} height={13} rx="6.5" fill="#0b1d3a" stroke="#c9a227" strokeOpacity="0.6" />
            <text x={X(1.2) + 33} y={Z(zTop) + (H_SOTANO * K - 13) / 2 + 9.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="#ddc06a">S{s + 1} · {n} cajones</text>
          </g>
        )
      })}
      {sotanos > 0 && (
        <polygon points={pts([[X(LW + 0.6), Z(0)], [X(LW + 4), Z(0)], [X(xRampa + 1.5), Z(-H_SOTANO)], [X(xRampa), Z(-H_SOTANO)]])} fill="#56657a" opacity="0.9" />
      )}

      {/* edificio en corte */}
      {pisos.map((p, i) => (
        <g key={i}>
          <rect x={X(bx0)} y={Z(p.z + p.h)} width={bw * K} height={p.h * K} fill={p.tipo === 'comercial' ? '#e8b65e' : '#5f8db6'} stroke="#0b1d3a" strokeWidth="0.6" />
          <rect x={X(bx0)} y={Z(p.z + p.h)} width={bw * K} height={0.35 * K} fill="#eef3f8" />
        </g>
      ))}
      {m.amenidades && <rect x={X(bx0 + bw * 0.22)} y={Z(H + 3.4)} width={bw * 0.5 * K} height={3.4 * K} fill="#7ea6cb" stroke="#eef3f8" strokeOpacity="0.7" strokeDasharray="3 2" />}
      <text x={X(bx0 + bw) + 6} y={Z(H / 2)} fontSize="8" fontWeight="600" fill="#c3ccda">{pisos.length} niveles</text>
      {sotanos > 0 && <text x={X(bx0 + bw) + 6} y={Z(H / 2) + 11} fontSize="8" fill="#8b96ab">+ {sotanos} {sotanos === 1 ? 'sótano' : 'sótanos'}</text>}
    </svg>
  )
}

const PANEL = 'bg-gradient-to-b from-[#0e2444] to-[#0b1d3a] border border-[#2a3f5c] rounded-xl p-3'
const TITULO = 'text-[9px] font-bold text-[#5f6a80] uppercase tracking-wider mb-1.5'

export function VistasArquitectura({ tipologia, superficieTerreno, superficieConstruida, desgloseZonas, areaLibreYVerde }: {
  tipologia: TipologiaPropuesta
  superficieTerreno: number
  superficieConstruida: number
  desgloseZonas?: ZonaArquitectura[]
  areaLibreYVerde?: { m2: number; porcentajeLote: string }
}) {
  const m = construirModelo(tipologia, superficieTerreno, superficieConstruida, desgloseZonas)
  if (!m) return <p className="text-[12px] text-[#5f6a80] italic px-1">Sin datos de terreno o niveles para graficar.</p>
  const deptos = tipologia.habitacional?.totalDepartamentos
  const etiqueta = (color: string, texto: string) => (
    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /><span className="text-[10px] text-[#8b96ab]">{texto}</span></span>
  )
  return (
    <div className="@container">
      {/* Compacto (JC, 6-nov): las tres vistas en una sola fila de altura contenida, para que el
          dibujo no domine la tarjeta y se vean también cifras, tipología y mix. */}
      <div className="grid grid-cols-1 @3xl:grid-cols-[1.7fr_1fr_1.2fr] gap-3">
        <div className={`${PANEL} flex flex-col`}>
          <p className={TITULO}>Perspectiva</p>
          <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-[460px]"><Perspectiva m={m} /></div></div>
          <p className="text-[10px] text-[#8b96ab] mt-1">
            {m.pisos.length} niveles{deptos ? ` · ${deptos} departamentos` : ''}{m.amenidades ? ' · amenidades en azotea' : ''}
          </p>
        </div>
        <div className={`${PANEL} flex flex-col`}>
          <p className={TITULO}>Planta de conjunto</p>
          <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-[250px]"><Planta m={m} /></div></div>
        </div>
        <div className={`${PANEL} flex flex-col`}>
          <p className={TITULO}>Corte · estacionamiento</p>
          <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-[360px]"><Corte m={m} /></div></div>
        </div>
      </div>
      <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap px-1">
        {etiqueta('#e8b65e', 'PB / Comercial')}
        {etiqueta('#5f8db6', 'Habitacional')}
        {m.amenidades && etiqueta('#7ea6cb', 'Amenidades (azotea)')}
        {etiqueta('#c3ccd8', `Huella · ${Math.round(m.bw * m.bd).toLocaleString('es-MX')} m²`)}
        {m.sotanos > 0 && etiqueta('#c9a227', `Estacionamiento · ${m.cajones} cajones · ${Math.round(m.m2Estacionamiento).toLocaleString('es-MX')} m²`)}
        {areaLibreYVerde && etiqueta('#2f6650', `Área libre y verde · ${Math.round(areaLibreYVerde.m2).toLocaleString('es-MX')} m² (${areaLibreYVerde.porcentajeLote} del lote)`)}
      </div>
    </div>
  )
}
