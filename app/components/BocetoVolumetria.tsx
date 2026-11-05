import type { TipologiaPropuesta, ZonaArquitectura } from '@/lib/analisis/tipos'

// Elevación arquitectónica ilustrativa (no un plano real): silueta del edificio apilando
// niveles comerciales/habitacionales de abajo hacia arriba, con fachada de vidrio, losas,
// barandales, núcleo de concreto, sombra y cota de altura — trazo limpio tipo render (antes
// llevaba un filtro feTurbulence "dibujado a mano" que se veía poco profesional). Compartido
// entre app/analisis/page.tsx (modal del análisis guardado) y app/analisis/analizando/page.tsx
// (tarjeta del Agente de Arquitectura en el pipeline en vivo).
export function EdificioSketch({ nivelesComercial, nivelesHabitacional, tieneAmenidades }: { nivelesComercial: number; nivelesHabitacional: number; tieneAmenidades: boolean }) {
  const M_IZQ = 44
  const M_DER = 92
  const M_SUP = 20
  const BUILD_W = 220
  const LEVEL_H = 26
  const COMERCIAL_H = 34
  const AMEN_H = 22
  const CAP_H = 5
  const GROUND_H = 18
  const AMEN_W = BUILD_W * 0.55
  const CORE_W = 26
  const BAYS = 6

  const bodyH = nivelesComercial * COMERCIAL_H + nivelesHabitacional * LEVEL_H
  const svgW = M_IZQ + BUILD_W + M_DER
  const svgH = M_SUP + (tieneAmenidades ? AMEN_H : 0) + CAP_H + bodyH + GROUND_H + 8
  const x0 = M_IZQ
  const groundY = svgH - 8 - GROUND_H
  const glassW = BUILD_W - CORE_W
  const bayW = glassW / BAYS

  type Floor = { y: number; h: number; tipo: 'comercial' | 'habitacional' }
  const floors: Floor[] = []
  let cursorY = groundY
  for (let i = 0; i < nivelesComercial; i++) { cursorY -= COMERCIAL_H; floors.push({ y: cursorY, h: COMERCIAL_H, tipo: 'comercial' }) }
  for (let i = 0; i < nivelesHabitacional; i++) { cursorY -= LEVEL_H; floors.push({ y: cursorY, h: LEVEL_H, tipo: 'habitacional' }) }
  const roofY = cursorY - CAP_H
  const amenY = roofY - AMEN_H
  const amenX = x0 + (glassW - AMEN_W) / 2
  const totalNiveles = floors.length
  const topeComercial = groundY - nivelesComercial * COMERCIAL_H
  const cotaX = x0 + BUILD_W + 16

  const arbol = (cx: number, alto: number) => (
    <g>
      <rect x={cx - 1.5} y={groundY - alto * 0.35} width="3" height={alto * 0.35} fill="#3b4a5c" />
      <ellipse cx={cx} cy={groundY - alto * 0.62} rx={alto * 0.3} ry={alto * 0.38} fill="#2c6a55" />
      <ellipse cx={cx - alto * 0.08} cy={groundY - alto * 0.7} rx={alto * 0.17} ry={alto * 0.22} fill="#3f8a6f" opacity="0.8" />
    </g>
  )

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <defs>
        <linearGradient id="ed-vidrio" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9cbe3" />
          <stop offset="0.45" stopColor="#5b8db5" />
          <stop offset="1" stopColor="#2a5279" />
        </linearGradient>
        <linearGradient id="ed-local" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1cc" />
          <stop offset="1" stopColor="#f0b860" />
        </linearGradient>
        <linearGradient id="ed-concreto" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#dfe5ec" />
          <stop offset="1" stopColor="#aab6c4" />
        </linearGradient>
        <linearGradient id="ed-reflejo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ed-sombra">
          <stop offset="0" stopColor="#000000" stopOpacity="0.45" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* banqueta y sombra */}
      <ellipse cx={x0 + BUILD_W / 2} cy={groundY + 3} rx={BUILD_W * 0.68} ry="7" fill="url(#ed-sombra)" />
      <rect x={6} y={groundY} width={svgW - 12} height="4" fill="#5f7186" />
      <rect x={6} y={groundY + 4} width={svgW - 12} height={GROUND_H - 4} fill="#1a2d48" />

      {/* amenidades en azotea, remetidas, con pérgola */}
      {tieneAmenidades && (
        <g>
          <rect x={amenX} y={amenY} width={AMEN_W} height={AMEN_H} fill="url(#ed-vidrio)" opacity="0.85" />
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={i} x1={amenX + (AMEN_W / 5) * (i + 1)} y1={amenY} x2={amenX + (AMEN_W / 5) * (i + 1)} y2={amenY + AMEN_H} stroke="#e6edf4" strokeOpacity="0.5" strokeWidth="0.8" />
          ))}
          <rect x={amenX - 6} y={amenY - 3} width={AMEN_W + 12} height="3" fill="#e6edf4" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={amenX - 4 + i * ((AMEN_W + 8) / 8)} y1={amenY - 3} x2={amenX - 4 + i * ((AMEN_W + 8) / 8)} y2={amenY - 7} stroke="#c9a46a" strokeWidth="1.2" />
          ))}
        </g>
      )}

      {/* pretil */}
      <rect x={x0 - 3} y={roofY} width={BUILD_W + 6} height={CAP_H} fill="#e6edf4" />

      {/* niveles */}
      {floors.map((f, i) => {
        if (f.tipo === 'comercial') {
          const nLocales = 3
          const lw = glassW / nLocales
          return (
            <g key={i}>
              <rect x={x0} y={f.y} width={glassW} height={f.h} fill="url(#ed-local)" />
              {Array.from({ length: nLocales }).map((_, j) => (
                <g key={j}>
                  <line x1={x0 + lw * j} y1={f.y} x2={x0 + lw * j} y2={f.y + f.h} stroke="#3b4a5c" strokeWidth="2" />
                  <line x1={x0 + lw * j + lw / 2} y1={f.y + 9} x2={x0 + lw * j + lw / 2} y2={f.y + f.h} stroke="#8a6a3a" strokeWidth="0.7" />
                </g>
              ))}
              <rect x={x0} y={f.y} width={glassW} height="7" fill="#24364f" />
              <rect x={x0 - 4} y={f.y + 7} width={glassW + 4} height="2" fill="#e6edf4" />
              <rect x={x0 - 2} y={f.y - 2} width={BUILD_W + 2} height="2.5" fill="#e6edf4" />
            </g>
          )
        }
        return (
          <g key={i}>
            <rect x={x0} y={f.y} width={glassW} height={f.h} fill="url(#ed-vidrio)" />
            {Array.from({ length: BAYS - 1 }).map((_, j) => (
              <line key={j} x1={x0 + bayW * (j + 1)} y1={f.y} x2={x0 + bayW * (j + 1)} y2={f.y + f.h} stroke="#e6edf4" strokeOpacity="0.55" strokeWidth="0.8" />
            ))}
            {/* barandales de balcón en bahías alternas, desfasadas por nivel */}
            {Array.from({ length: BAYS }, (_, j) => j).filter(j => j % 2 === i % 2).map(j => (
              <rect key={j} x={x0 + bayW * j + 2} y={f.y + f.h - 8} width={bayW - 4} height="8" fill="#ffffff" fillOpacity="0.14" stroke="#e6edf4" strokeOpacity="0.7" strokeWidth="0.7" />
            ))}
            <rect x={x0 - 2} y={f.y - 2} width={BUILD_W + 2} height="2.5" fill="#e6edf4" />
          </g>
        )
      })}

      {/* reflejo diagonal sobre el vidrio */}
      {nivelesHabitacional > 0 && (
        <polygon
          points={`${x0 + glassW * 0.3},${roofY + CAP_H} ${x0 + glassW * 0.62},${roofY + CAP_H} ${x0 + glassW * 0.3},${topeComercial} ${x0},${topeComercial} ${x0},${Math.min(topeComercial, roofY + CAP_H + glassW * 0.3)}`}
          fill="url(#ed-reflejo)"
        />
      )}

      {/* núcleo de concreto (escaleras/elevador) */}
      <rect x={x0 + glassW} y={roofY + CAP_H} width={CORE_W} height={groundY - roofY - CAP_H} fill="url(#ed-concreto)" />
      {floors.map((f, i) => (
        <rect key={i} x={x0 + glassW + 9} y={f.y + f.h * 0.3} width="8" height={f.h * 0.45} fill="#7d8ca0" opacity="0.55" />
      ))}

      {arbol(x0 - 22, 40)}
      {arbol(x0 + BUILD_W + 13, 30)}

      {/* cota de altura */}
      <g stroke="#8b96ab" strokeWidth="0.8">
        <line x1={cotaX + 14} y1={roofY} x2={cotaX + 14} y2={groundY} />
        <line x1={cotaX + 10} y1={roofY} x2={cotaX + 18} y2={roofY} />
        <line x1={cotaX + 10} y1={groundY} x2={cotaX + 18} y2={groundY} />
      </g>
      <text x={cotaX + 21} y={(roofY + groundY) / 2} fill="#c3ccda" fontSize="10" fontWeight="600" dominantBaseline="middle">
        {totalNiveles} {totalNiveles === 1 ? 'nivel' : 'niveles'}
      </text>
    </svg>
  )
}

// Envuelve EdificioSketch con la leyenda de colores y deriva niveles comerciales/habitacionales
// de la misma TipologiaPropuesta que ya usan ambas páginas — un solo punto de cálculo para que
// el boceto y las tarjetas de resumen (niveles/deptos/locales) nunca se desincronicen.
export function BocetoVolumetria({ tipologia }: { tipologia: TipologiaPropuesta }) {
  const nivelesComercial = tipologia.comercial?.niveles ?? 0
  const totalNiveles = tipologia.niveles ?? (nivelesComercial + (tipologia.habitacional ? 1 : 0))
  const nivelesHabitacional = Math.max(totalNiveles - nivelesComercial, tipologia.habitacional ? 1 : 0)

  if (nivelesComercial === 0 && nivelesHabitacional === 0) {
    return <p className="text-[12px] text-[#5f6a80] italic px-1">Sin datos de niveles para graficar.</p>
  }

  return (
    <div>
      <div className="bg-[#0b1d3a] border border-[#2a3f5c] rounded-xl px-4 py-5 flex justify-center">
        <EdificioSketch nivelesComercial={nivelesComercial} nivelesHabitacional={nivelesHabitacional} tieneAmenidades={!!tipologia.tamanoAmenidades} />
      </div>
      <div className="flex items-center gap-4 mt-2 flex-wrap px-1">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FEF3C7] border border-[#B45309]" /><span className="text-[10px] text-[#8b96ab]">PB / Comercial</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F0FBF6] border border-[#0F6E56]" /><span className="text-[10px] text-[#8b96ab]">Habitacional</span></div>
        {!!tipologia.tamanoAmenidades && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#F5F3FF] border border-dashed border-[#6D28D9]" />
            <span className="text-[10px] text-[#8b96ab]">Amenidades (azotea) · no ocupa nivel exclusivo</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Vista en planta (aérea) ilustrativa: rectángulo del lote con textura verde, la huella
// construida centrada encima (superficieConstruida / niveles — aproxima que cada nivel repite
// la misma huella, no siempre cierto pero razonable para un boceto), y la franja de
// estacionamiento dentro de la huella (se asume cubierto en planta baja, igual supuesto que ya
// usan los prompts de Arquitectura/Construcción). El % de huella sobre el lote SÍ es un dato
// real (huella/superficieTerreno); la FORMA del lote (proporción ancho:fondo) es inventada
// (RATIO fijo) porque no hay geometría real del predio — es lo mismo que ya advierte
// EdificioSketch para la elevación: aproximación, no plano real.
export function VistaAereaTerreno({
  superficieTerreno, superficieConstruida, niveles, desgloseZonas, areaLibreYVerde,
}: {
  superficieTerreno: number
  superficieConstruida: number
  niveles?: number
  desgloseZonas?: ZonaArquitectura[]
  areaLibreYVerde?: { m2: number; porcentajeLote: string }
}) {
  if (superficieTerreno <= 0 || superficieConstruida <= 0) {
    return <p className="text-[12px] text-[#5f6a80] italic px-1">Sin datos de terreno para graficar la vista aérea.</p>
  }

  const huella = Math.min(superficieConstruida / Math.max(niveles || 1, 1), superficieTerreno * 0.95)
  const coverage = Math.max(0.08, Math.min(0.92, huella / superficieTerreno))
  const kFootprint = Math.sqrt(coverage)

  const RATIO = 0.72 // ancho:fondo ilustrativo de un lote urbano típico — no la forma real del predio
  const MAX_SIDE = 190
  const rawW = Math.sqrt(superficieTerreno * RATIO)
  const rawD = Math.sqrt(superficieTerreno / RATIO)
  const scale = MAX_SIDE / Math.max(rawW, rawD)
  const terW = rawW * scale
  const terD = rawD * scale

  const MARGIN = 24
  const svgW = terW + MARGIN * 2
  const svgH = terD + MARGIN * 2

  const tx0 = MARGIN
  const ty0 = MARGIN

  const buildW = terW * kFootprint
  const buildD = terD * kFootprint
  const bx0 = tx0 + (terW - buildW) / 2
  const by0 = ty0 + (terD - buildD) / 2

  const zonaEstacionamiento = desgloseZonas?.find(z => /estacionamiento/i.test(z.zona))
  const parkingFrac = zonaEstacionamiento && huella > 0 ? Math.max(0, Math.min(1, zonaEstacionamiento.m2 / huella)) : 0
  const parkingH = buildD * parkingFrac

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <defs>
          <filter id="planta-sombra" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="3" dy="4" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.35" />
          </filter>
          <pattern id="hatch-verde" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#E1F5EE" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#9FE1CB" strokeWidth="1.4" />
          </pattern>
          <pattern id="hatch-cajones" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#F0F4F2" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#5a7065" strokeWidth="1" />
          </pattern>
        </defs>
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* lote */}
          <rect x={tx0} y={ty0} width={terW} height={terD} fill="url(#hatch-verde)" stroke="#0F6E56" strokeWidth="1.4" rx="2" />

          {/* huella construida, centrada */}
          <rect x={bx0} y={by0} width={buildW} height={buildD} fill="#F7F1E3" stroke="#8a6f3f" strokeWidth="1.6" rx="1.5" filter="url(#planta-sombra)" />

          {/* franja de estacionamiento dentro de la huella (planta baja / cubierto) */}
          {parkingH > 2 && (
            <rect x={bx0} y={by0 + buildD - parkingH} width={buildW} height={parkingH} fill="url(#hatch-cajones)" stroke="#5a7065" strokeWidth="1" />
          )}
        </g>
      </svg>
      <div className="flex items-center gap-4 flex-wrap justify-center px-1">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#E1F5EE] border border-[#0F6E56]" /><span className="text-[10px] text-[#8b96ab]">Terreno · {Math.round(superficieTerreno).toLocaleString('es-MX')} m²</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F7F1E3] border border-[#8a6f3f]" /><span className="text-[10px] text-[#8b96ab]">Huella construida · {Math.round(huella).toLocaleString('es-MX')} m²</span></div>
        {zonaEstacionamiento && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#F0F4F2] border border-[#5a7065]" />
            <span className="text-[10px] text-[#8b96ab]">
              Estacionamiento{zonaEstacionamiento.cajonesEstimados ? ` · ${zonaEstacionamiento.cajonesEstimados} cajones` : ''} · {Math.round(zonaEstacionamiento.m2).toLocaleString('es-MX')} m²
            </span>
          </div>
        )}
        {areaLibreYVerde && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#9FE1CB] border border-[#0F6E56]" />
            <span className="text-[10px] text-[#8b96ab]">Área libre y verde · {Math.round(areaLibreYVerde.m2).toLocaleString('es-MX')} m² ({areaLibreYVerde.porcentajeLote} del lote)</span>
          </div>
        )}
      </div>
    </div>
  )
}
