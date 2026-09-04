// Croquis semitécnico del predio — no un plano legal, pero sí a escala y con medidas reales: usa
// los mismos vértices (x = este, y = norte, metros) que ya calculan lib/terreno/geometryEngine.ts
// (cuadro de construcción capturado a mano) o lib/terreno/parcelResolver.ts::verticesLocalesDesdeAnillo
// (predio real resuelto contra el catastro de San Pedro). Sin librería de gráficas, SVG a mano,
// mismo patrón que BocetoVolumetria/VistaAereaTerreno.
export interface VerticePlano { x: number; y: number }

export function PlanoTerreno({
  vertices, ladoLabels, areaM2, perimetroM, folioCatastral,
}: {
  vertices: VerticePlano[]
  ladoLabels?: string[]
  areaM2?: number | null
  perimetroM?: number | null
  folioCatastral?: string | null
}) {
  if (vertices.length < 3) return null

  const PAD = 42
  const W = 320
  const H = 260
  const plotW = W - PAD * 2
  const plotH = H - PAD * 2 - 28 // deja espacio abajo para área/perímetro

  const minX = Math.min(...vertices.map(v => v.x))
  const maxX = Math.max(...vertices.map(v => v.x))
  const minY = Math.min(...vertices.map(v => v.y))
  const maxY = Math.max(...vertices.map(v => v.y))
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const scale = Math.min(plotW / spanX, plotH / spanY)

  // svgY crece hacia abajo; nuestro y crece hacia el norte — se invierte para que "arriba" sea norte.
  const toSvg = (v: VerticePlano) => ({
    x: PAD + (v.x - minX) * scale + (plotW - spanX * scale) / 2,
    y: PAD + (maxY - v.y) * scale + (plotH - spanY * scale) / 2,
  })
  const pts = vertices.map(toSvg)
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'

  const centroid = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* Norte */}
      <g transform={`translate(${W - 24}, 20)`}>
        <line x1="0" y1="10" x2="0" y2="-10" stroke="#8b96ab" strokeWidth="1.2" />
        <path d="M -4 -4 L 0 -12 L 4 -4 Z" fill="#8b96ab" />
        <text x="0" y="22" textAnchor="middle" fontSize="8" fill="#5f6a80">N</text>
      </g>

      {/* Polígono */}
      <path d={pathD} fill="#c9a227" fillOpacity="0.08" stroke="#c9a227" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Vértices */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#132a4d" stroke="#c9a227" strokeWidth="1" />
      ))}

      {/* Medidas por lado — texto en el punto medio, desplazado hacia afuera del centroide */}
      {pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length]
        const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
        const dir = { x: mid.x - centroid.x, y: mid.y - centroid.y }
        const len = Math.hypot(dir.x, dir.y) || 1
        const offset = { x: mid.x + (dir.x / len) * 11, y: mid.y + (dir.y / len) * 11 }
        const label = ladoLabels?.[i]
        if (!label) return null
        return (
          <text key={i} x={offset.x} y={offset.y} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#8b96ab">
            {label}
          </text>
        )
      })}

      {/* Área / perímetro / folio */}
      <text x={PAD} y={H - 10} fontSize="9" fill="#5f6a80">
        {areaM2 != null && `Área ${areaM2.toFixed(1)} m²`}
        {areaM2 != null && perimetroM != null && '  ·  '}
        {perimetroM != null && `Perímetro ${perimetroM.toFixed(1)} m`}
        {folioCatastral && `  ·  Folio ${folioCatastral}`}
      </text>
    </svg>
  )
}
