'use client'

// Plusvalía premium (estimación heurística) — reemplaza el bloque de solo texto que existía
// antes. El punto de análisis es HOY: la pregunta que responde es "¿cuánto más valdría este
// predio en 3 y 5 años?", no la tasa anual sola (ver conversación con JC, 2026-09-09). El
// histórico completo del Índice SHF queda detrás de un botón ("Ver histórico") para no saturar
// la tarjeta compacta del pipeline — mismo criterio que PlanoTerreno.tsx: SVG/canvas a mano, sin
// librería de gráficas.
//
// lib/market/shfIndice.data.ts y lib/market/shfAppreciationEngine.ts son módulos puros (sin
// Supabase admin ni nada server-only) — se importan aquí directo, en el cliente, para dibujar el
// histórico con los mismos datos y la misma función de mapeo ciudad->serie que ya usa
// /api/market/resumen (serieSHFParaCiudad), sin duplicar la lógica ni pedirle a la API que mande
// las 86 filas de cada serie solo para dibujar un botón que la mayoría de las veces no se abre.
import { useState, useRef, useEffect } from 'react'
import {
  type EstimacionPlusvaliaPremium, serieSHFParaCiudad,
  SHF_NACIONAL_ECONOMICA_SOCIAL, SHF_NACIONAL_MEDIA_RESIDENCIAL, type PuntoIndiceSHF,
} from '@smt/shared-realestate'

function crecimientoCompuesto(tasaAnualPct: number, anios: number): number {
  return (Math.pow(1 + tasaAnualPct / 100, anios) - 1) * 100
}

function HorizonteCard({ label, pct, rangoMin, rangoMax }: { label: string; pct: number; rangoMin: number; rangoMax: number }) {
  return (
    <div className="bg-[#0e2340] rounded-lg px-3 py-2.5">
      <p className="text-[8.5px] font-bold uppercase tracking-wide text-[#5f6a80]">{label}</p>
      <p className="text-[19px] font-bold text-[#ddc06a] leading-tight mt-0.5" style={{ fontFamily: 'var(--font-fraunces)' }}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
      </p>
      <p className="text-[9px] text-[#5f6a80] mt-0.5">rango {rangoMin.toFixed(1)}% a {rangoMax.toFixed(1)}%</p>
    </div>
  )
}

// Mini proyección hoy -> +3a -> +5a, con cono min/max — mismo concepto que el mockup validado.
// Las curvas se muestrean por trimestre (crecimiento compuesto real, no dos segmentos rectos),
// con cuadrícula en %, cono con degradado y valores en pastilla: trazo limpio tipo reporte.
function MiniProyeccion({ tasaCentro, tasaMin, tasaMax }: { tasaCentro: number; tasaMin: number; tasaMax: number }) {
  const W = 560, H = 170, padL = 40, padR = 22, padT = 26, padB = 26
  const pasos = Array.from({ length: 21 }, (_, i) => i / 4)
  const valor = (tasa: number, a: number) => (Math.pow(1 + tasa / 100, a) - 1) * 100
  const topePct = Math.max(valor(tasaMax, 5), 10)
  const pasoGrid = topePct > 80 ? 25 : topePct > 40 ? 20 : 10
  const maxPct = Math.ceil(topePct / pasoGrid) * pasoGrid
  const x = (a: number) => padL + (a / 5) * (W - padL - padR)
  const y = (pct: number) => padT + (1 - pct / maxPct) * (H - padT - padB)

  const curva = (tasa: number) => pasos.map((a) => `${x(a).toFixed(1)},${y(valor(tasa, a)).toFixed(1)}`)
  const sup = curva(tasaMax), inf = curva(tasaMin), cen = curva(tasaCentro)
  const cono = `M${sup.join(' L')} L${[...inf].reverse().join(' L')} Z`
  const lineaCentro = `M${cen.join(' L')}`
  const areaCentro = `${lineaCentro} L${x(5)},${y(0)} L${x(0)},${y(0)} Z`
  const grid = Array.from({ length: maxPct / pasoGrid + 1 }, (_, i) => i * pasoGrid)
  const hitos = [3, 5]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
      <defs>
        <linearGradient id="pv-cono" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a227" stopOpacity="0.26" />
          <stop offset="1" stopColor="#c9a227" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="pv-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ddc06a" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ddc06a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pv-linea" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a8862a" />
          <stop offset="1" stopColor="#f0d27a" />
        </linearGradient>
      </defs>

      {grid.map((g) => (
        <g key={g}>
          <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke={g === 0 ? '#3a5278' : '#1f3352'} strokeWidth="1" />
          <text x={padL - 8} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#5f6a80">{g === 0 ? '0%' : `+${g}%`}</text>
        </g>
      ))}
      {hitos.map((a) => (
        <line key={a} x1={x(a)} y1={padT - 6} x2={x(a)} y2={y(0)} stroke="#2a3f5c" strokeWidth="1" strokeDasharray="3 3" />
      ))}

      <path d={areaCentro} fill="url(#pv-area)" />
      <path d={cono} fill="url(#pv-cono)" />
      <path d={`M${sup.join(' L')}`} fill="none" stroke="#c9a227" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="4 3" />
      <path d={`M${inf.join(' L')}`} fill="none" stroke="#c9a227" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="4 3" />
      <path d={lineaCentro} fill="none" stroke="#c9a227" strokeOpacity="0.25" strokeWidth="6" strokeLinecap="round" />
      <path d={lineaCentro} fill="none" stroke="url(#pv-linea)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx={x(0)} cy={y(0)} r="4" fill="#8b96ab" stroke="#0b1d3a" strokeWidth="2" />
      {hitos.map((a) => {
        const v = valor(tasaCentro, a)
        const cx = x(a), cy = y(v)
        const etiqueta = `+${v.toFixed(0)}%`
        const bw = etiqueta.length * 7 + 14
        const bx = Math.min(cx - bw / 2, W - padR - bw + 10)
        return (
          <g key={a}>
            <circle cx={cx} cy={cy} r="9" fill="#c9a227" fillOpacity="0.18" />
            <circle cx={cx} cy={cy} r="4.5" fill="#ddc06a" stroke="#0b1d3a" strokeWidth="2" />
            <rect x={bx} y={cy - 30} width={bw} height="18" rx="9" fill="#0b1d3a" stroke="#c9a227" strokeOpacity="0.6" />
            <text x={bx + bw / 2} y={cy - 17.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ddc06a">{etiqueta}</text>
          </g>
        )
      })}

      {[0, 1, 2, 3, 4, 5].map((a) => (
        <text key={a} x={x(a)} y={H - 6} textAnchor="middle" fontSize="9" fontWeight={a === 0 || a === 3 || a === 5 ? 600 : 400} fill={a === 0 || a === 3 || a === 5 ? '#8b96ab' : '#4a5670'}>
          {a === 0 ? 'hoy' : `+${a} ${a === 1 ? 'año' : 'años'}`}
        </text>
      ))}
    </svg>
  )
}
// Histórico completo (Económica-Social + Media-Residencial nacional, más la serie regional real
// si la ciudad mapea a una — ver SHF_CIUDAD_A_SERIE) más la proyección banda alta hacia adelante.
function HistoricoCompleto({ ciudad, tasaCentro, tasaMin, tasaMax }: { ciudad: string | null | undefined; tasaCentro: number; tasaMin: number; tasaMax: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const regional = serieSHFParaCiudad(ciudad)

  const dibujar = () => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.parentElement.clientWidth
    const cssH = Math.round(cssW * 0.5)
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const econ = SHF_NACIONAL_ECONOMICA_SOCIAL
    const media = SHF_NACIONAL_MEDIA_RESIDENCIAL
    const zonaSerie = regional?.serie ?? null
    const proyYears = 5

    const PAD_L = 38, PAD_R = 12, PAD_T = 10, PAD_B = 22
    const plotW = cssW - PAD_L - PAD_R, plotH = cssH - PAD_T - PAD_B
    const totalQ = econ.length - 1 + proyYears * 4
    const todasIndices = [...econ, ...media, ...(zonaSerie ?? [])].map((p) => p.indice)
    const minV = Math.floor(Math.min(...todasIndices) / 10) * 10
    const baseProyeccion = zonaSerie ? zonaSerie[zonaSerie.length - 1].indice : econ[econ.length - 1].indice
    const maxProyectado = baseProyeccion * Math.pow(1 + tasaMax / 100, proyYears)
    const maxV = Math.ceil(Math.max(...todasIndices, maxProyectado) / 20) * 20

    const x = (q: number) => PAD_L + (q / totalQ) * plotW
    const y = (v: number) => PAD_T + plotH - ((v - minV) / (maxV - minV)) * plotH

    ctx.clearRect(0, 0, cssW, cssH)
    ctx.strokeStyle = 'rgba(244,240,230,0.08)'
    ctx.lineWidth = 1
    ctx.font = '9px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#5f6a80'
    const pasoY = (maxV - minV) / 4
    for (let v = minV; v <= maxV; v += pasoY) {
      const yy = y(v)
      ctx.beginPath(); ctx.moveTo(PAD_L, yy); ctx.lineTo(cssW - PAD_R, yy); ctx.stroke()
      ctx.fillText(Math.round(v).toString(), 2, yy + 3)
    }
    for (let yr = 2005; yr <= 2005 + Math.floor(totalQ / 4); yr += 5) {
      const q = (yr - 2005) * 4
      if (q > totalQ) continue
      ctx.fillStyle = '#5f6a80'
      ctx.fillText(String(yr), x(q) - 12, cssH - 4)
    }

    const hoyQ = econ.length - 1
    ctx.strokeStyle = 'rgba(244,240,230,0.18)'
    ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(x(hoyQ), PAD_T); ctx.lineTo(x(hoyQ), PAD_T + plotH); ctx.stroke()
    ctx.setLineDash([])

    const proyeccion = (tasa: number) => {
      const pts = [{ q: hoyQ, v: baseProyeccion }]
      for (let a = 1; a <= proyYears; a++) pts.push({ q: hoyQ + a * 4, v: baseProyeccion * Math.pow(1 + tasa / 100, a) })
      return pts
    }
    const pMin = proyeccion(tasaMin), pMax = proyeccion(tasaMax), pCentro = proyeccion(tasaCentro)
    ctx.beginPath()
    pMin.forEach((p, i) => (i === 0 ? ctx.moveTo(x(p.q), y(p.v)) : ctx.lineTo(x(p.q), y(p.v))))
    for (let i = pMax.length - 1; i >= 0; i--) ctx.lineTo(x(pMax[i].q), y(pMax[i].v))
    ctx.closePath()
    ctx.fillStyle = 'rgba(201,162,39,0.12)'
    ctx.fill()

    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4])
    ctx.beginPath()
    pCentro.forEach((p, i) => (i === 0 ? ctx.moveTo(x(p.q), y(p.v)) : ctx.lineTo(x(p.q), y(p.v))))
    ctx.stroke(); ctx.setLineDash([])

    // x-scale usa la posición secuencial del punto (0..n-1), no el valor calendario -- las 4
    // series embebidas en shfIndice.data.ts empiezan todas en 2005 Q1 sin huecos, así que la
    // posición en el arreglo YA es "trimestres desde el inicio".
    const dibujarSerie = (arr: PuntoIndiceSHF[], color: string, width: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath()
      arr.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.indice)) : ctx.lineTo(x(i), y(p.indice))))
      ctx.stroke()
    }
    if (zonaSerie) dibujarSerie(zonaSerie, '#8b96ab', 1.2)
    dibujarSerie(econ, '#5B8FD4', 1.5)
    dibujarSerie(media, '#4FBF9F', 1.5)
  }

  // Se dibuja al montar (el canvas ya tiene ancho real para entonces) y de nuevo si la ventana
  // cambia de tamaño -- mismo patrón que el resto de gráficos a mano de esta app.
  useEffect(() => {
    dibujar()
    window.addEventListener('resize', dibujar)
    return () => window.removeEventListener('resize', dibujar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciudad, tasaCentro, tasaMin, tasaMax])

  return (
    <div className="pt-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-[9px] text-[#8b96ab]">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-[2px] bg-[#5B8FD4]" />Económica-social</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-[2px] bg-[#4FBF9F]" />Media-residencial</span>
        {regional && <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-[2px] bg-[#8b96ab]" />{regional.nombre}</span>}
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-[2px]" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#c9a227 0 3px,transparent 3px 5px)' }} />Proyección</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-auto block" />
      <p className="text-[9px] text-[#5f6a80] leading-snug mt-1.5">
        El cono se abre con el tiempo porque el rango se compone año sobre año — más incertidumbre entre más lejos se proyecta, no un error del cálculo.
      </p>
    </div>
  )
}

export function PlusvaliaProyeccion({ estimacion, ciudad }: { estimacion: EstimacionPlusvaliaPremium; ciudad?: string | null }) {
  const [historicoAbierto, setHistoricoAbierto] = useState(false)
  const { tasaAnualizadaEstimada, rangoMin, rangoMax, betaUsado, coloniaReferencia, tasaAnualizadaReferencia, muestraReferencia } = estimacion

  const p3 = crecimientoCompuesto(tasaAnualizadaEstimada, 3)
  const p3min = crecimientoCompuesto(rangoMin, 3)
  const p3max = crecimientoCompuesto(rangoMax, 3)
  const p5 = crecimientoCompuesto(tasaAnualizadaEstimada, 5)
  const p5min = crecimientoCompuesto(rangoMin, 5)
  const p5max = crecimientoCompuesto(rangoMax, 5)

  return (
    <div className="mt-2 pt-2 border-t border-[#2a3f5c]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wide">Plusvalía premium — hacia adelante</p>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#2e2510] text-[#FBBF24]">Proyección</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <HorizonteCard label="En 3 años" pct={p3} rangoMin={p3min} rangoMax={p3max} />
        <HorizonteCard label="En 5 años" pct={p5} rangoMin={p5min} rangoMax={p5max} />
      </div>

      <div className="mt-2">
        <MiniProyeccion tasaCentro={tasaAnualizadaEstimada} tasaMin={rangoMin} tasaMax={rangoMax} />
        <p className="text-[9px] text-[#5f6a80] text-center mt-1">
          Equivale a <span className="text-[#8b96ab] font-semibold">≈{tasaAnualizadaEstimada.toFixed(1)}%/año</span> compuesto (rango {rangoMin.toFixed(1)}%–{rangoMax.toFixed(1)}%)
        </p>
      </div>

      <p className="text-[9.5px] text-[#5f6a80] leading-snug mt-2">
        Calculado a partir de <span className="text-[#8b96ab] font-semibold">{coloniaReferencia}</span> ({tasaAnualizadaReferencia.toFixed(1)}%/año, n={muestraReferencia}) × beta {betaUsado.toFixed(2)} — calibrado con las series reales del Índice SHF de México (2005-2026), no un proxy extranjero.
      </p>

      <button
        onClick={() => setHistoricoAbierto((v) => !v)}
        className="w-full mt-2.5 flex items-center gap-2 px-3 py-1.5 bg-[#0e2340] border border-[#2a3f5c] rounded-lg text-[10.5px] text-[#8b96ab] hover:bg-[#0b1d38] hover:border-[#3a5278] transition-colors"
      >
        <span>Ver histórico completo (2005-2026)</span>
        <svg width="10" height="7" viewBox="0 0 12 8" fill="none" className={`ml-auto text-[#5f6a80] transition-transform ${historicoAbierto ? 'rotate-180' : ''}`}>
          <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {historicoAbierto && (
        <HistoricoCompleto ciudad={ciudad} tasaCentro={tasaAnualizadaEstimada} tasaMin={rangoMin} tasaMax={rangoMax} />
      )}
    </div>
  )
}
