'use client'

import { useRef, useEffect } from 'react'

export type CockpitEstado = 'cola' | 'corriendo' | 'esperando_aprobacion' | 'listo' | 'error'

// Placeholder chico para el estado "en cola" — no monta ningún contenido del Step real
// (ese contenido ni siquiera se renderiza a este tamaño), solo ocupa su celda en el grid.
export function QuadrantPlaceholder({ nombre, color }: { nombre: string; color: string }) {
  return (
    <div
      className="col-span-2 md:col-span-1 rounded-2xl border border-[#2a3f5c] bg-[#132a4d] flex flex-col items-center justify-center gap-2 py-6 opacity-60 transition-all duration-300"
      style={{ minHeight: 120 }}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, opacity: 0.4 }} />
      <p className="text-[11px] font-semibold text-[#8b96ab] text-center px-2">{nombre}</p>
      <p className="text-[9px] text-[#5f6a80] uppercase tracking-wider">En cola</p>
    </div>
  )
}

// Envuelve el contenido YA EXISTENTE de cada Step (sin tocar su interior) en una celda del
// bento-grid cuyo tamaño y comportamiento de expandir/colapsar dependen del `estado` derivado
// del pipe. Colapsado, el contenido se recorta por altura (con degradado) en vez de
// desmontarse — evita tener que bifurcar cada Step en una vista "compacta" y otra "completa".
export default function CockpitQuadrant({
  agente, nombre, color, estado, expandido, algoExpandido, onToggle, onRetry, resumen, children,
}: {
  agente: string
  nombre: string
  color: string
  estado: CockpitEstado
  expandido: boolean
  algoExpandido: boolean
  onToggle: () => void
  onRetry?: () => void
  resumen?: React.ReactNode
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (expandido) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [expandido])

  const esGrande = estado === 'listo' || estado === 'esperando_aprobacion'
  const spanClass = expandido
    ? 'col-span-2 md:col-span-4'
    : esGrande
      ? 'col-span-2'
      : 'col-span-2 md:col-span-2'

  const borde =
    estado === 'error' ? 'border-[#DC2626]' :
    estado === 'esperando_aprobacion' ? 'border-dashed border-[#D97706]/60' :
    estado === 'corriendo' ? `border-[${color}]` :
    expandido ? 'border-[#c9a227]' :
    'border-[#2a3f5c]'

  const pillEstado =
    estado === 'listo' ? { label: 'Listo', bg: 'bg-[#c9a227]', text: 'text-[#070f22]' } :
    estado === 'esperando_aprobacion' ? { label: 'Esperando aprobación', bg: 'bg-[#2e2510]', text: 'text-[#FBBF24]' } :
    estado === 'corriendo' ? { label: 'Corriendo…', bg: 'bg-white/10', text: 'text-[#f4f0e6]' } :
    estado === 'error' ? { label: 'Error', bg: 'bg-[#2e1414]', text: 'text-[#F87171]' } :
    { label: '', bg: '', text: '' }

  return (
    <div
      ref={ref}
      className={`${spanClass} rounded-2xl border bg-[#132a4d] transition-all duration-300 overflow-hidden ${borde} ${algoExpandido && !expandido ? 'opacity-70' : ''}`}
      style={{ borderStyle: estado === 'esperando_aprobacion' ? 'dashed' : 'solid' }}
    >
      {/* Header de cuadrante — nombre + pill de estado + botón expandir/colapsar */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-[#2a3f5c] cursor-pointer select-none"
        onClick={onToggle}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[17px] font-semibold text-[#f4f0e6] truncate" style={{ fontFamily: 'var(--font-fraunces)' }}>{nombre}</span>
        {pillEstado.label && (
          <span className={`ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${pillEstado.bg} ${pillEstado.text}`}>
            {pillEstado.label}
          </span>
        )}
        {estado === 'error' && onRetry && (
          <button
            onClick={e => { e.stopPropagation(); onRetry() }}
            className="ml-auto text-[10px] font-semibold text-[#F87171] hover:text-[#FCA5A5] cursor-pointer"
          >
            Re-intentar
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          className={`${estado === 'error' ? '' : 'ml-auto'} w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer`}
          title={expandido ? 'Colapsar' : 'Expandir'}
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ transform: expandido ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
            <path d="M9 3L5 7l4 4" stroke="#8b96ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Cuerpo — el contenido original del Step, sin modificar. Colapsado muestra el
          `resumen` curado si existe, o si no el contenido original recortado por altura.
          Expandido crece a su alto natural y deja que la página (main, ya con
          overflow-y-auto) scrollee — así las tablas/listas internas que ya traen su propio
          "max-h + overflow-y-auto" (comparables, referencias de venta, etc.) vuelven a tener
          un contexto de altura normal en vez de quedar atrapadas dentro de un segundo scroll
          con maxHeight artificial (eso era lo que las recortaba a una fila).

          Cuando está recortado (sin `resumen` curado), el contenido real SÍ puede tener sus
          propios toggles internos (ej. "Ver comparables encontrados", VerDetalle) — si el
          usuario logra abrirlos estando colapsado, lo que revelan queda invisible por el
          recorte de 210px. Por eso el cuerpo colapsado es no-interactivo (pointer-events-none)
          y lleva un botón transparente encima que expande el cuadrante — cualquier click ahí
          expande primero; los toggles internos solo son clicables ya expandido, sin el límite
          de altura. */}
      <div
        className="relative"
        style={!expandido && esGrande && !resumen ? { maxHeight: 210, overflow: 'hidden' } : undefined}
      >
        <div className={`px-0 ${!expandido && esGrande && !resumen ? 'pointer-events-none' : ''}`}>
          {expandido ? children : (resumen ?? children)}
        </div>
        {!expandido && esGrande && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={`Expandir ${nombre}`}
            className="absolute inset-0 w-full h-full cursor-pointer"
          />
        )}
        {!expandido && esGrande && !resumen && (
          <div
            className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none"
            style={{ background: 'linear-gradient(to top, #132a4d, transparent)' }}
          />
        )}
      </div>
    </div>
  )
}
