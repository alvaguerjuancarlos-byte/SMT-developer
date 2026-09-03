import type { TipologiaPropuesta, ZonaArquitectura } from '@/lib/analisis/tipos'

// Boceto tipo elevación arquitectónica (no un plano real): silueta del edificio apilando
// niveles comerciales/habitacionales de abajo hacia arriba, con textura de ventanas/vitrinas
// y un filtro de desplazamiento SVG (feTurbulence) para dar look "dibujado a mano". Compartido
// entre app/analisis/page.tsx (modal del análisis guardado) y app/analisis/analizando/page.tsx
// (tarjeta del Agente de Arquitectura en el pipeline en vivo) — antes solo vivía en el primero.
export function EdificioSketch({ nivelesComercial, nivelesHabitacional, tieneAmenidades }: { nivelesComercial: number; nivelesHabitacional: number; tieneAmenidades: boolean }) {
  const MARGIN = 24
  const BUILD_W = 220
  const LEVEL_H = 26
  const COMERCIAL_H = 34
  const AMEN_H = 24
  const CAP_H = 6
  const GROUND_H = 16
  const AMEN_W = BUILD_W * 0.55

  const bodyH = nivelesComercial * COMERCIAL_H + nivelesHabitacional * LEVEL_H
  const svgW = BUILD_W + MARGIN * 2
  const svgH = MARGIN + CAP_H + (tieneAmenidades ? AMEN_H : 0) + bodyH + GROUND_H + MARGIN
  const x0 = MARGIN
  const groundY = svgH - MARGIN - GROUND_H

  type Floor = { y: number; h: number; tipo: 'comercial' | 'habitacional' }
  const floors: Floor[] = []
  let cursorY = groundY
  for (let i = 0; i < nivelesComercial; i++) { cursorY -= COMERCIAL_H; floors.push({ y: cursorY, h: COMERCIAL_H, tipo: 'comercial' }) }
  for (let i = 0; i < nivelesHabitacional; i++) { cursorY -= LEVEL_H; floors.push({ y: cursorY, h: LEVEL_H, tipo: 'habitacional' }) }
  const roofY = cursorY - CAP_H
  const amenY = roofY - AMEN_H

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <defs>
        <filter id="sketchy-edificio" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" />
        </filter>
      </defs>
      <g filter="url(#sketchy-edificio)" strokeLinejoin="round" strokeLinecap="round">
        {/* terreno */}
        <line x1={x0 - 10} y1={groundY} x2={x0 + BUILD_W + 10} y2={groundY} stroke="#5a7065" strokeWidth="1.5" />
        {Array.from({ length: 14 }).map((_, i) => {
          const gx = x0 - 8 + i * ((BUILD_W + 16) / 13)
          return <line key={i} x1={gx} y1={groundY} x2={gx - 6} y2={groundY + GROUND_H} stroke="#c8d5cf" strokeWidth="1" />
        })}

        {/* remate / azotea */}
        <rect x={x0 - 2} y={roofY} width={BUILD_W + 4} height={CAP_H} fill="#111d17" rx="1" />

        {/* volumen de amenidades, retranqueado */}
        {tieneAmenidades && (
          <g>
            <rect x={x0 + (BUILD_W - AMEN_W) / 2} y={amenY} width={AMEN_W} height={AMEN_H} fill="#F5F3FF" stroke="#6D28D9" strokeWidth="1.4" strokeDasharray="4 3" rx="2" />
            {Array.from({ length: 4 }).map((_, i) => {
              const lx = x0 + (BUILD_W - AMEN_W) / 2 + 6 + i * ((AMEN_W - 12) / 3)
              return <line key={i} x1={lx} y1={amenY + 4} x2={lx} y2={amenY + AMEN_H - 4} stroke="#A78BFA" strokeWidth="1" />
            })}
            <circle cx={x0 + BUILD_W - 24} cy={amenY - 6} r="5" fill="none" stroke="#D97706" strokeWidth="1.2" />
          </g>
        )}

        {/* niveles */}
        {floors.map((f, i) => {
          if (f.tipo === 'comercial') {
            const doorW = 20, doorH = f.h * 0.7, nDoors = 3
            return (
              <g key={i}>
                <rect x={x0} y={f.y} width={BUILD_W} height={f.h} fill="#FEF3C7" stroke="#B45309" strokeWidth="1.4" />
                {Array.from({ length: 10 }).map((_, j) => (
                  <rect key={j} x={x0 + j * (BUILD_W / 10)} y={f.y - 4} width={BUILD_W / 10} height="4" fill={j % 2 === 0 ? '#B45309' : '#FEF3C7'} />
                ))}
                {Array.from({ length: nDoors }).map((_, j) => {
                  const dx = x0 + (BUILD_W / nDoors) * j + (BUILD_W / nDoors - doorW) / 2
                  return <rect key={j} x={dx} y={f.y + f.h - doorH} width={doorW} height={doorH} fill="#FFFDF5" stroke="#B45309" strokeWidth="1" />
                })}
              </g>
            )
          }
          const nWin = 5, winW = 14, winH = f.h * 0.4
          return (
            <g key={i}>
              <rect x={x0} y={f.y} width={BUILD_W} height={f.h} fill="#F0FBF6" stroke="#0F6E56" strokeWidth="1.2" />
              {Array.from({ length: nWin }).map((_, j) => {
                const wx = x0 + (BUILD_W / nWin) * j + (BUILD_W / nWin - winW) / 2
                const wy = f.y + (f.h - winH) / 2
                return <rect key={j} x={wx} y={wy} width={winW} height={winH} fill="#BAE6C9" stroke="#1D9E75" strokeWidth="0.8" rx="1" />
              })}
            </g>
          )
        })}
      </g>
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
          <filter id="sketchy-planta" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
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
        <g filter="url(#sketchy-planta)" strokeLinejoin="round" strokeLinecap="round">
          {/* lote */}
          <rect x={tx0} y={ty0} width={terW} height={terD} fill="url(#hatch-verde)" stroke="#0F6E56" strokeWidth="1.4" rx="2" />

          {/* huella construida, centrada */}
          <rect x={bx0} y={by0} width={buildW} height={buildD} fill="#F7F1E3" stroke="#8a6f3f" strokeWidth="1.6" rx="1.5" />

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
