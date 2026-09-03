'use client'

import { useEffect, useMemo, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveProyecto } from '@/lib/saveProyecto'
import { authedFetch } from '@/lib/apiClient'
import { calcular } from '@/lib/estimador/motor'
import { construirInputsNormativos, programaAUsos, type ProgramaUnidades } from '@/lib/construccion/programaAdapter'
import { BocetoVolumetria, VistaAereaTerreno } from '@/app/components/BocetoVolumetria'
import type { AnalisisData } from '@/lib/analisis/tipos'
import { extractMercadoContext, extractProyectoContext, extractTerrenoContext } from '@/lib/mastermind/contexto'
import { calcularMastermindCore, calcularIngresos } from '@/lib/mastermind/motor'
import { DEFAULTS } from '@/lib/mastermind/catalogo'
import type { MastermindCoreInputs } from '@/lib/mastermind/tipos'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'
import CockpitQuadrant, { QuadrantPlaceholder, type CockpitEstado } from './CockpitQuadrant'
import CockpitMastermindFab from './CockpitMastermindFab'
import MastermindOverlay from './MastermindOverlay'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentStatus = 'waiting' | 'running' | 'done' | 'error'

interface TerrenoResult {
  costoTerrenoM2: number
  costoTerreno: number
  bitacoraTerreno: any
}
interface ArquitecturaResult {
  superficieConstruida: number
  superficieVendible: number
  bitacoraArquitectura: any
}
interface ConstruccionResult {
  construccionM2: number
  costoTotalConstruccion: number
  superficieConstruida: number
  superficieVendible?: number
  bitacoraConstruccion: any
}
interface LegalResult { fichaLegal: any; fuentes?: any }
interface MercadoResult { mercado: any; fuentes?: any }
interface FinancieroResult {
  recomendacion: any; financiero: any; estructuraCapital: any
  flujoMensual: any[]; score: any; metodologiaScore: any
  stressTest: any[]; puntoQuiebre: any
}

interface UbicacionData {
  isocronas: { rango_min: number; poblacion_alcanzada: number | null }[]
  errorMsg?: string
}

interface CatastroData {
  estado: string
  municipio: string
  expediente: string
  ubicacion: string | null
  sinAdeudo: boolean | null
  adeudoTotal: number | null
  superficieTerreno: number | null
  costoCertificado: number | null
  valorSuelo: number | null
  valorConstruccion: number | null
  valorCatastral: number | null
  nota: string | null
  portalCaido: boolean
  source: string
}

interface ComparableItem {
  portal: string; colonia: string; superficieM2: number | null
  precioM2: number | null; precioTotal: number | null
  distanciaRef: string; fechaPublicacion: string; url: string; titulo: string
}

// Comparables de VENTA (departamentos/casas terminadas o en preventa) — distinto de
// ComparableItem, que es de terreno/suelo (ver app/api/agentes/comparables/route.ts vs.
// app/api/agentes/comparables-venta/route.ts). Alimenta al Agente Mercado, no a Terreno.
interface ComparableVentaItem {
  nombre: string; direccion: string; precioM2: number | null; precioTotal: number | null
  superficieM2: number | null; tipologia: string | null; avanceObra: string | null
  fechaReferencia: string; url: string; sospechosoPorBanda?: boolean
}

export interface PipelineState {
  comparables: { status: AgentStatus; data: ComparableItem[] }
  comparablesVenta: { status: AgentStatus; data: ComparableVentaItem[] }
  // terreno/construccion/mercado permiten "Ajustar parámetros" las veces que hagan falta:
  // cada corrida se agrega a `corridas` (nunca se reemplaza) y `seleccionada` indexa cuál
  // usan los pasos siguientes — el analista elige a su criterio, sin sugerencia automática.
  terreno:     { status: AgentStatus; corridas: TerrenoResult[];      seleccionada: number | null; overrideM2: string; usarPrecioSolicitado: boolean }
  arquitectura:{ status: AgentStatus; corridas: ArquitecturaResult[]; seleccionada: number | null }
  construccion:{ status: AgentStatus; corridas: ConstruccionResult[]; seleccionada: number | null; overrideM2: string; usarParametricoZona: boolean }
  legal:       { status: AgentStatus; data: LegalResult | null }
  mercado:     { status: AgentStatus; corridas: MercadoResult[];      seleccionada: number | null; overridePrecioVenta: string; overrideAbsorcion: string }
  // precioVentaObjetivo/unidadesObjetivo: vienen de Mastermind 1 ("Aplicar calibración y volver
  // al pipeline") — si están seteados, Financiero los ancla en vez de elegirlos libremente (ver
  // app/api/agentes/financiero/route.ts). A diferencia de "Ajustar parámetros" en Arquitectura,
  // esto NO reabre ni recalcula el diseño — solo cambia lo que Financiero apunta.
  financiero:  { status: AgentStatus; data: FinancieroResult | null; precioVentaObjetivo: string; unidadesObjetivo: string }
  ubicacion:   { status: AgentStatus; data: UbicacionData | null }
  catastro:    { status: AgentStatus; data: CatastroData | null }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)} M`
    : `$${n.toLocaleString('es-MX')}`

function Spinner({ color = '#c9a227', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg className="animate-spin shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Indicador "agente trabajando" — barrido de radar/sonar: una manecilla gira y deja una estela
// que se desvanece detrás de ella (conic-gradient rotando), como una pantalla de sonar real, en
// vez del ping de anillos genérico. Cada agente tiene su propio color (ver AGENTE_COLOR más
// abajo) para poder distinguir de un vistazo cuál está corriendo cuando varios corren en paralelo.
function Sonar({ color = '#c9a227', size = 36 }: { color?: string; size?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {/* Aro base de la pantalla de radar */}
      <span className="absolute inline-block rounded-full" style={{ width: size, height: size, border: `1.5px solid ${color}33` }} />
      {/* Manecilla giratoria — la estela es el propio degradado cónico desvaneciéndose */}
      <span
        className="absolute inline-block rounded-full animate-spin"
        style={{
          width: size, height: size,
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 260deg, ${color}4D 320deg, ${color} 360deg)`,
        }}
      />
      {/* Centro fijo */}
      <span className="relative inline-block rounded-full" style={{ width: size * 0.14, height: size * 0.14, backgroundColor: color }} />
    </span>
  )
}

// Un color por agente, consistente en toda la pantalla del pipeline.
const AGENTE_COLOR = {
  terreno: '#1D9E75',
  legal: '#378ADD',
  mercado: '#B8860B',
  arquitectura: '#8B5CF6',
  construccion: '#EA580C',
  financiero: '#DB2777',
} as const

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="rgba(201,162,39,0.15)" stroke="#c9a227" strokeWidth="1.2"/>
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SemaforoChip({ sem }: { sem?: string }) {
  if (!sem) return null
  const cfg = sem === 'VERDE'
    ? { bg: 'bg-[#14301f]', text: 'text-[#0F6E56]', dot: 'bg-[#1D9E75]' }
    : sem === 'AMARILLO'
    ? { bg: 'bg-[#2e2510]', text: 'text-[#FBBF24]', dot: 'bg-[#F59E0B]' }
    : { bg: 'bg-[#2e1414]', text: 'text-[#F87171]', dot: 'bg-[#DC2626]' }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      IC {sem}
    </span>
  )
}

// Transparenta de dónde sale el m² a construir que eligió el modelo: el rango piso/base/techo
// viene del envolvente determinístico (lib/analisis/envolventeYAreas.ts, calculado en código a
// partir de COS/CUS/niveles de la Ficha Legal), no del propio LLM — ver
// bitacoraArquitectura.envolventeCalculada / validacionSuperficieConstruida en
// app/api/agentes/arquitectura/route.ts. Ausente cuando no hubo ficha legal numérica.
function RangoConstruccionCard({
  envolventeCalculada, superficieConstruida, validacion,
}: {
  envolventeCalculada?: { areaMaxConstruible: number; areaConstruida: { piso: number; base: number; techo: number } }
  superficieConstruida: number
  validacion?: { fueraDeRangoPiso: boolean; fueraDeRangoTecho: boolean; excedeAreaMaxConstruible: boolean }
}) {
  if (!envolventeCalculada) {
    return (
      <div className="px-5 pt-4 pb-2">
        <div className="bg-[#132a4d] rounded-xl px-4 py-3">
          <p className="text-[11px] text-[#5f6a80] leading-snug">
            No se pudo calcular un rango normativo determinístico porque el Agente Legal no devolvió COS/CUS numéricos para este predio — la superficie construida fue estimada directamente por el modelo.
          </p>
        </div>
      </div>
    )
  }

  const { areaMaxConstruible, areaConstruida } = envolventeCalculada
  const { piso, techo } = areaConstruida
  const pct = techo > piso ? Math.min(100, Math.max(0, ((superficieConstruida - piso) / (techo - piso)) * 100)) : 50
  const fueraDeRango = !!(validacion?.fueraDeRangoPiso || validacion?.fueraDeRangoTecho)
  const excede = !!validacion?.excedeAreaMaxConstruible

  return (
    <div className="px-5 pt-4 pb-2">
      <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-widest mb-2">Cómo se calculó el m² a construir</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Piso</p>
          <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{Math.round(piso).toLocaleString('es-MX')} m²</p>
        </div>
        <div className={`rounded-xl px-3 py-2.5 text-center border-2 ${excede ? 'bg-[#2e1414] border-[#DC2626]' : fueraDeRango ? 'bg-[#2e2510] border-[#F59E0B]' : 'bg-[#14301f] border-[#1D9E75]'}`}>
          <p className={`text-[10px] uppercase tracking-wide font-semibold ${excede ? 'text-[#F87171]' : fueraDeRango ? 'text-[#FBBF24]' : 'text-[#0F6E56]'}`}>Elegido por el modelo</p>
          <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{Math.round(superficieConstruida).toLocaleString('es-MX')} m²</p>
        </div>
        <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Techo</p>
          <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{Math.round(techo).toLocaleString('es-MX')} m²</p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full bg-[#2a3f5c] relative">
        <div
          className={`absolute -top-1 w-3 h-3 rounded-full border-2 border-white ${excede ? 'bg-[#DC2626]' : fueraDeRango ? 'bg-[#F59E0B]' : 'bg-[#1D9E75]'}`}
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <p className="text-[9px] text-[#5f6a80] mt-2">Límite legal COS/CUS (techo normativo duro): {Math.round(areaMaxConstruible).toLocaleString('es-MX')} m²</p>
      {excede ? (
        <p className="text-[11px] text-[#F87171] mt-1.5 font-medium">→ El modelo excede el máximo legal permitido por COS/CUS ({Math.round(areaMaxConstruible).toLocaleString('es-MX')} m²).</p>
      ) : fueraDeRango ? (
        <p className="text-[11px] text-[#D97706] mt-1.5 font-medium">→ El modelo propuso {Math.round(superficieConstruida).toLocaleString('es-MX')} m², fuera del rango calculado ({Math.round(piso).toLocaleString('es-MX')}–{Math.round(techo).toLocaleString('es-MX')} m²).</p>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#14301f] text-[#0F6E56] mt-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
          Dentro del rango calculado
        </span>
      )}
    </div>
  )
}

// Pasos de ajuste rápido en % — no acumulativos: cada botón calcula desde `value` (lo que
// calculó el agente), nunca desde el override anterior. Volver a pulsar el mismo % activo
// lo apaga y regresa al valor del agente — evita el problema de "por unidad" (subir $8,000/m²
// de uno en uno) sin perder la opción de escribir un número exacto en el input de al lado.
const PASOS_AJUSTE_PCT = [-20, -15, -10, -5, 5, 10, 15, 20]

export function EditableM2({
  label, value, override, onOverride, unit = '/m²', prefix = '$',
}: {
  label: string; value: number; override: string; onOverride: (v: string) => void; unit?: string; prefix?: string
}) {
  const pctActivo = override !== '' && value !== 0 ? Math.round(((Number(override) - value) / value) * 100) : null
  const aplicarPct = (p: number) => {
    if (pctActivo === p) { onOverride(''); return }
    onOverride(String(Math.round(value * (1 + p / 100))))
  }
  return (
    <div className="bg-[#132a4d] rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {prefix && <span className="text-[11px] text-[#5f6a80]">{prefix}</span>}
            <input
              type="number"
              value={override !== '' ? override : value}
              onChange={e => onOverride(e.target.value)}
              className="w-24 text-[17px] font-bold text-[#f4f0e6] bg-transparent border-b border-dashed border-[#5f6a80] focus:outline-none focus:border-[#c9a227]"
            />
            <span className="text-[12px] text-[#5f6a80]">{unit}</span>
          </div>
        </div>
        {override !== '' && Number(override) !== value && (
          <div className="text-right shrink-0">
            <p className="text-[9px] text-[#5f6a80]">Agente calculó</p>
            <p className="text-[11px] text-[#5f6a80] line-through">{prefix}{value.toLocaleString('es-MX')}{unit}</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {PASOS_AJUSTE_PCT.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => aplicarPct(p)}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
              pctActivo === p ? 'bg-[#c9a227] text-[#070f22]' : 'bg-[#132a4d] border border-[#2a3f5c] text-[#8b96ab] hover:border-[#c9a227]'
            }`}
          >
            {p > 0 ? `+${p}%` : `${p}%`}
          </button>
        ))}
      </div>
    </div>
  )
}

// Toggle chico "Ver detalle" — a diferencia del patrón pastilla oscura de ancho completo que
// ya usan SelectorCorridas/AjustarBandaConstruccion/AjustarSupuestos*, este es un link inline
// para colgarlo junto a una etiqueta o cifra puntual, sin ocupar una fila entera.
function VerDetalle({ label = 'Ver detalle', ocultarLabel = 'Ocultar', children }: { label?: string; ocultarLabel?: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="text-[11px] font-semibold text-[#c9a227] hover:text-[#ddc06a] inline-flex items-center gap-1 cursor-pointer"
      >
        {abierto ? ocultarLabel : label}
        <svg width="9" height="9" viewBox="0 0 14 14" fill="none" style={{ transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>
      {abierto && <div className="mt-2">{children}</div>}
    </div>
  )
}

// Etiquetas cortas para los chips de ajuste manual del Terreno.
// Duplicadas a propósito (no importadas de flujo-a/page.tsx): son solo 5-4 entradas
// cortas y así este ajuste queda aislado sin acoplar analizando a flujo-a.
const BANDA_LABELS: Record<string, string> = {
  '1': 'Popular', '2': 'Media Popular', '3': 'Media Residencial', '4': 'Premium',
}

// Costo/m² paramétrico de referencia por banda de construcción — punto medio del mismo
// rango de mercado que ya usan los Agentes Construcción/Financiero para clasificar
// acabados (ver bandaLabels en app/api/agentes/construccion|financiero/route.ts). Sirve
// para comparar el costo bottom-up calculado por la IA contra un promedio de zona, y
// darle al usuario la opción de usar ese promedio en vez del cálculo detallado.
const BANDA_CONSTRUCCION_PARAMETRICO_MXN_M2: Record<string, number> = {
  '1': 8750,   // Banda 1 — Económica ($7,000–$10,500/m²)
  '2': 13250,  // Banda 2 — Media Estándar ($10,500–$16,000/m²)
  '3': 20000,  // Banda 3 — Media Alta ($16,000–$24,000/m²)
  '4': 34500,  // Banda 4 — Premium ($24,000–$45,000+/m²)
}
const VIALIDAD_LABELS: Record<string, string> = {
  arterial: 'Arterial / Primaria', colectora: 'Colectora', secundaria: 'Secundaria',
  local: 'Local / Habitacional', privada: 'Privada / Andador',
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
        selected
          ? 'bg-[#c9a227] border-[#c9a227] text-[#070f22]'
          : 'bg-[#132a4d] border-[#2a3f5c] text-[#8b96ab] hover:border-[#c9a227]/40'
      }`}
    >
      {children}
    </button>
  )
}

// Selector de corridas — solo aparece cuando "Ajustar parámetros" generó 2+ opciones para
// un mismo paso (Terreno/Construcción/Mercado). Colapsado por default (mismo lenguaje visual
// que el botón "Ajustar parámetros") para no saturar la pantalla — al abrirlo se ve la fila de
// cards clicables, estilo app/prospeccion/scout/page.tsx: borde+sombra verde y check en la
// seleccionada. La selección es 100% manual — no hay puntaje ni "mejor opción" sugerida.
function SelectorCorridas<T>({
  corridas, seleccionada, onSeleccionar, resumen,
}: {
  corridas: T[]; seleccionada: number | null
  onSeleccionar: (i: number) => void
  resumen: (item: T, i: number) => React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  if (corridas.length < 2) return null
  return (
    <div className="px-5 pt-4 pb-1">
      <button
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center justify-between gap-2 bg-[#c9a227] hover:bg-[#ddc06a] text-[#070f22] rounded-xl px-4 py-3 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Elegir opción final · {corridas.length} corridas generadas
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d={abierto ? 'M2 7L6 3L10 7' : 'M4 2L8 6L4 10'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {abierto && (
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {corridas.map((item, i) => (
            <button
              key={i}
              onClick={() => { onSeleccionar(i); setAbierto(false) }}
              className={`text-left shrink-0 min-w-[160px] rounded-xl border px-3 py-2.5 transition-all duration-150 cursor-pointer ${
                seleccionada === i
                  ? 'border-[#c9a227] shadow-[0_0_0_2px_#c9a227] bg-[#c9a227]/8'
                  : 'border-[#2a3f5c] bg-[#132a4d] hover:border-[#c9a227]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Opción {i + 1}</span>
                {seleccionada === i && (
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#c9a227] flex items-center justify-center">
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
              </div>
              {resumen(item, i)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AjustarSupuestosTerreno({
  bandaActual, vialActual, precioActual, onAplicar,
}: {
  bandaActual: number | undefined; vialActual: string | undefined; precioActual: string | undefined
  onAplicar: (banda: string, vial: string, precioSolicitado: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [bandaEdit, setBandaEdit] = useState('')
  const [vialEdit, setVialEdit] = useState('')
  const [precioEdit, setPrecioEdit] = useState('')

  const bandaEfectiva = bandaEdit || String(bandaActual ?? '')
  const vialEfectiva = vialEdit || (vialActual ?? '')
  const precioEfectivo = precioEdit !== '' ? precioEdit : (precioActual ?? '')

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full flex items-center justify-between gap-2 bg-[#c9a227] hover:bg-[#ddc06a] text-[#070f22] rounded-xl px-4 py-3 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h8M2 8h5M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          </svg>
          Ajustar parámetros
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="bg-[#132a4d] rounded-xl px-4 py-3 flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Banda</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(BANDA_LABELS).map(([id, label]) => (
            <Chip key={id} selected={bandaEfectiva === id} onClick={() => setBandaEdit(id)}>{id} · {label}</Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Clasificación vial</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(VIALIDAD_LABELS).map(([id, label]) => (
            <Chip key={id} selected={vialEfectiva === id} onClick={() => setVialEdit(id)}>{label}</Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Precio real que pide el vendedor (opcional)</p>
        <div className="relative w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5f6a80]">$</span>
          <input
            type="number"
            value={precioEfectivo}
            onChange={e => setPrecioEdit(e.target.value)}
            placeholder="0"
            className="w-full border border-[#2a3f5c] rounded-xl pl-6 pr-12 py-2 text-[13px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#c9a227]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#5f6a80] font-medium">MXN</span>
        </div>
        <p className="text-[10px] text-[#5f6a80] mt-1">La IA lo usa para validar su cálculo contra el precio real, no lo fuerza como resultado final.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { onAplicar(bandaEfectiva, vialEfectiva, precioEfectivo); setAbierto(false); setBandaEdit(''); setVialEdit(''); setPrecioEdit('') }}
          className="text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors bg-[#c9a227] text-[#070f22] hover:bg-[#ddc06a] cursor-pointer"
        >
          Generar nueva opción
        </button>
        <button onClick={() => setAbierto(false)} className="text-[11px] text-[#5f6a80] hover:text-[#f4f0e6] cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// Resume la mezcla de unidades que ya definió el Agente Arquitectura (IA o "usuario_define",
// ambos producen tipologiaPropuesta.habitacional.mix — ver ArquitecturaInteractiva/
// estimadorAArquitectura más abajo), para que el Agente Mercado reparta el precio objetivo
// (promedio ponderado) entre tipologías reales en vez de aplicarlo por igual a todo `segmentacion`.
// superficieVendible (raíz de la respuesta de Construcción) es un campo "resumen" que la IA
// reporta por separado de su propio tipologiaPropuesta.habitacional.mix — igual que pasaba con
// totalDepartamentos, nada garantiza que ambos coincidan (visto en producción: superficieVendible
// implicaba ~2.6x más área vendible de la que el propio mix sumaba, inflando ingresosProyectados
// en el Financiero). Cuando el proyecto es puramente habitacional (sin comercial, que no trae m²
// por local en tipologiaPropuesta y no se puede derivar), preferimos el área real del mix.
function superficieVendibleDelMix(tip: any): number | undefined {
  if (tip?.comercial) return undefined // no derivable sin m² por local — se confía en c.superficieVendible
  const mix = tip?.habitacional?.mix
  if (!Array.isArray(mix) || mix.length === 0) return undefined
  const area = mix.reduce((s: number, r: any) => s + (r.unidades || 0) * (r.m2Promedio || 0), 0)
  return area > 0 ? area : undefined
}

function resumenMixUnidades(tip: any): string {
  if (!tip) return ''
  const partes: string[] = []
  if (tip.habitacional?.mix?.length) {
    const mix = tip.habitacional.mix.map((r: any) => `${r.unidades} unid. ${r.tipo} (${r.m2Promedio} m² prom.)`).join(', ')
    partes.push(`Habitacional — ${tip.habitacional.totalDepartamentos} unidades: ${mix}`)
  }
  if (tip.comercial?.totalLocales) {
    partes.push(`Comercial — ${tip.comercial.totalLocales} locales en ${tip.comercial.niveles} nivel(es)`)
  }
  return partes.join(' · ')
}

const AMENIDADES_NIVEL_LABELS: Record<string, string> = {
  '1': 'Mínimas', '2': 'Intermedias', '3': 'Top',
}

// Ajusta parámetros de DISEÑO (niveles/unidades/amenidades) — vive en la tarjeta de
// Arquitectura, no en Construcción, desde que se separaron los dos agentes. La banda de
// acabados es un parámetro de COSTEO y se ajusta aparte en Construcción (ver AjustarBandaConstruccion).
function AjustarSupuestosArquitectura({
  nivelesActual, totalDeptosActual, totalLocalesActual, amenidadesNivelActual, mostrarLocales, onAplicar,
}: {
  nivelesActual: number | undefined
  totalDeptosActual: number | undefined; totalLocalesActual: number | undefined
  amenidadesNivelActual: number | undefined; mostrarLocales: boolean
  onAplicar: (niveles: string, totalDeptos: string, totalLocales: string, amenidadesNivel: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [nivelesEdit, setNivelesEdit] = useState('')
  const [deptosEdit, setDeptosEdit] = useState('')
  const [localesEdit, setLocalesEdit] = useState('')
  const [amenidadesEdit, setAmenidadesEdit] = useState('')

  const amenidadesEfectiva = amenidadesEdit || String(amenidadesNivelActual ?? '')

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full flex items-center justify-between gap-2 bg-[#c9a227] hover:bg-[#ddc06a] text-[#070f22] rounded-xl px-4 py-3 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h8M2 8h5M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          </svg>
          Ajustar parámetros
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="bg-[#132a4d] rounded-xl px-4 py-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Niveles (pisos)</p>
          <input type="number" value={nivelesEdit} onChange={e => setNivelesEdit(e.target.value)}
            placeholder={String(nivelesActual ?? '')}
            className="w-full border border-[#2a3f5c] rounded-xl px-3 py-2 text-[13px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#c9a227]" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Total departamentos</p>
          <input type="number" value={deptosEdit} onChange={e => setDeptosEdit(e.target.value)}
            placeholder={String(totalDeptosActual ?? '')}
            className="w-full border border-[#2a3f5c] rounded-xl px-3 py-2 text-[13px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#c9a227]" />
        </div>
      </div>
      {mostrarLocales && (
        <div>
          <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Total locales comerciales</p>
          <input type="number" value={localesEdit} onChange={e => setLocalesEdit(e.target.value)}
            placeholder={String(totalLocalesActual ?? '')}
            className="w-48 border border-[#2a3f5c] rounded-xl px-3 py-2 text-[13px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#c9a227]" />
        </div>
      )}
      <div>
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Tamaño de amenidades</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(AMENIDADES_NIVEL_LABELS).map(([id, label]) => (
            <Chip key={id} selected={amenidadesEfectiva === id} onClick={() => setAmenidadesEdit(id)}>{id} · {label}</Chip>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            onAplicar(nivelesEdit, deptosEdit, localesEdit, amenidadesEfectiva)
            setAbierto(false); setNivelesEdit(''); setDeptosEdit(''); setLocalesEdit(''); setAmenidadesEdit('')
          }}
          className="text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors bg-[#c9a227] text-[#070f22] hover:bg-[#ddc06a] cursor-pointer"
        >
          Generar nueva opción
        </button>
        <button onClick={() => setAbierto(false)} className="text-[11px] text-[#5f6a80] hover:text-[#f4f0e6] cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// Ajusta la banda de acabados (parámetro de COSTEO, no de diseño) — genera una nueva
// corrida de Construcción sobre el mismo diseño ya fijado por Arquitectura.
function AjustarBandaConstruccion({ bandaActual, onAplicar }: { bandaActual: number | string | undefined; onAplicar: (banda: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [bandaEdit, setBandaEdit] = useState('')
  const bandaEfectiva = bandaEdit || String(bandaActual ?? '')

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full flex items-center justify-between gap-2 bg-[#c9a227] hover:bg-[#ddc06a] text-[#070f22] rounded-xl px-4 py-3 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h8M2 8h5M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          </svg>
          Ajustar banda de acabados
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="bg-[#132a4d] rounded-xl px-4 py-3 flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Banda de acabados</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(BANDA_LABELS).map(([id, label]) => (
            <Chip key={id} selected={bandaEfectiva === id} onClick={() => setBandaEdit(id)}>{id} · {label}</Chip>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { onAplicar(bandaEfectiva); setAbierto(false); setBandaEdit('') }}
          className="text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors bg-[#c9a227] text-[#070f22] hover:bg-[#ddc06a] cursor-pointer"
        >
          Generar nueva opción
        </button>
        <button onClick={() => setAbierto(false)} className="text-[11px] text-[#5f6a80] hover:text-[#f4f0e6] cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function AjustarSupuestosMercado({
  precioVentaActual, absorcionActual, onAplicar,
}: {
  precioVentaActual: string | undefined; absorcionActual: string | undefined
  onAplicar: (precioVentaObjetivo: string, absorcionObjetivoManual: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [precioEdit, setPrecioEdit] = useState('')
  const [absorcionEdit, setAbsorcionEdit] = useState('')

  const precioEfectivo = precioEdit !== '' ? precioEdit : (precioVentaActual ?? '')
  const absorcionEfectiva = absorcionEdit !== '' ? absorcionEdit : (absorcionActual ?? '')

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full flex items-center justify-between gap-2 bg-[#c9a227] hover:bg-[#ddc06a] text-[#070f22] rounded-xl px-4 py-3 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h8M2 8h5M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          </svg>
          Ajustar parámetros
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="bg-[#132a4d] rounded-xl px-4 py-3 flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Precio de venta objetivo — promedio ponderado de la mezcla (opcional)</p>
        <div className="relative w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5f6a80]">$</span>
          <input
            type="number"
            value={precioEfectivo}
            onChange={e => setPrecioEdit(e.target.value)}
            placeholder="0"
            className="w-full border border-[#2a3f5c] rounded-xl pl-6 pr-16 py-2 text-[13px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#c9a227]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#5f6a80] font-medium">MXN/m²</span>
        </div>
        <p className="text-[10px] text-[#5f6a80] mt-1">No es el precio de una sola tipología: es el promedio ponderado por m² vendible de toda la mezcla (deptos + locales). El agente lo reparte por tipología usando el mix real que ya definió Construcción.</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Absorción real observada (opcional)</p>
        <input
          type="text"
          value={absorcionEfectiva}
          onChange={e => setAbsorcionEdit(e.target.value)}
          placeholder="Ej. 6 unidades/mes"
          className="w-48 border border-[#2a3f5c] rounded-xl px-3 py-2 text-[13px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#c9a227]"
        />
        <p className="text-[10px] text-[#5f6a80] mt-1">Úsalo si tienes un dato de campo (broker/comparables) más preciso que el estimado.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { onAplicar(precioEfectivo, absorcionEfectiva); setAbierto(false); setPrecioEdit(''); setAbsorcionEdit('') }}
          className="text-[12px] font-semibold px-4 py-2 rounded-xl transition-colors bg-[#c9a227] text-[#070f22] hover:bg-[#ddc06a] cursor-pointer"
        >
          Generar nueva opción
        </button>
        <button onClick={() => setAbierto(false)} className="text-[11px] text-[#5f6a80] hover:text-[#f4f0e6] cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Arquitectura interactiva — "usuario_define" ──────────────────────────────
// Modo alterno al Agente de Arquitectura (LLM): el usuario arma su propio programa
// de unidades y lib/estimador (puro, sin IA ni red) lo valida y calcula áreas al
// instante, reactivo en cada cambio — mismo patrón useMemo que ya usa Mastermind.
// El costeo NO vive aquí — el diseño resultante sigue pasando por el Agente de
// Construcción (IA) como cualquier otro, igual que un diseño propuesto por IA.

const GENERO_VIVIENDA_LABELS: Record<string, string> = {
  vivienda_interes_social: 'Interés social',
  vivienda_residencial_media: 'Residencial media',
  vivienda_residencial_lujo: 'Residencial / lujo',
}

interface MixRow { label: string; pct: number; m2Promedio: number }

function MixEditor({ rows, onChange }: { rows: MixRow[]; onChange: (rows: MixRow[]) => void }) {
  const totalPct = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0)
  const update = (i: number, patch: Partial<MixRow>) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r)
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 px-1">
        <span className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wide">Tipo</span>
        <span className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wide">%</span>
        <span className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wide">m² prom.</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[2fr_1fr_1fr] gap-2">
          <input type="text" value={row.label} onChange={e => update(i, { label: e.target.value })}
            className="border border-[#2a3f5c] rounded-lg px-2 py-1.5 text-[12px] text-[#f4f0e6] focus:outline-none focus:border-[#c9a227]" />
          <input type="number" value={row.pct} onChange={e => update(i, { pct: e.target.valueAsNumber || 0 })}
            className="border border-[#2a3f5c] rounded-lg px-2 py-1.5 text-[12px] text-[#f4f0e6] focus:outline-none focus:border-[#c9a227]" />
          <input type="number" value={row.m2Promedio} onChange={e => update(i, { m2Promedio: e.target.valueAsNumber || 0 })}
            className="border border-[#2a3f5c] rounded-lg px-2 py-1.5 text-[12px] text-[#f4f0e6] focus:outline-none focus:border-[#c9a227]" />
        </div>
      ))}
      <p className={`text-[10px] mt-0.5 ${Math.round(totalPct) === 100 ? 'text-[#5f6a80]' : 'text-[#DC2626] font-semibold'}`}>
        Suma: {totalPct.toFixed(0)}% {Math.round(totalPct) !== 100 && '(debería sumar 100%)'}
      </p>
    </div>
  )
}

// Traduce el resultado de lib/estimador (que agrupa por género: habitacional/comercial/
// amenidades/estacionamiento) a la taxonomía de 5 zonas que espera el Agente de
// Construcción (Zona 1 vendible / 2 estacionamiento / 3 circulaciones / 4 áreas comunes /
// 5 cuartos de servicio, ver app/api/agentes/construccion/route.ts). "Circulaciones" es la
// brecha real entre m² bruto y m² vendible de habitacional+comercial (lo que ya calcula
// FACTORES_EFICIENCIA en lib/estimador/catalogo.ts — no es un número inventado). "Cuartos
// de servicio" SÍ es una estimación (lib/estimador no lo modela): se toma como ~5% de esa
// misma brecha, la misma guía que ya usa el prompt del Agente de Arquitectura IA cuando no
// tiene mejor dato, para no dejar esa zona completamente sin fijar.
function estimadorAArquitectura(
  resultado: NonNullable<ReturnType<typeof calcular>>,
  programa: { generoVivienda: string; totalUnidades: number; mixHab: MixRow[]; incluirComercial: boolean; niveles: number; localesPorNivel: number; mixCom: MixRow[]; amenidadesM2: number },
  sTerreno: number, cosStr: string | undefined, cusStr: string | undefined,
): ArquitecturaResult {
  const { areas, cajones, envolvente } = resultado
  const noVendibleBruto = Math.max(0, areas.sobreRasante - programa.amenidadesM2 - areas.vendible)
  const cuartosServicio = Math.round(noVendibleBruto * 0.05)
  const circulaciones = Math.round(noVendibleBruto - cuartosServicio)
  const vendible = Math.round(areas.vendible)

  const pct = (m2: number) => areas.total > 0 ? `${Math.round((m2 / areas.total) * 100)}%` : '0%'

  const zonas = [
    { zona: 'Área vendible', concepto: 'Departamentos / unidades habitacionales' + (programa.incluirComercial ? ' y locales' : ''), m2: vendible, participacion: pct(vendible) },
    { zona: 'Estacionamiento', concepto: 'Cajones cubiertos', m2: Math.round(cajones.areaM2), participacion: pct(cajones.areaM2), cajonesEstimados: cajones.cajonesTotales, m2PorCajon: cajones.areaPorCajon },
    { zona: 'Circulaciones', concepto: 'Pasillos, escaleras, núcleo de elevadores (brecha bruto-vendible)', m2: circulaciones, participacion: pct(circulaciones) },
    ...(programa.amenidadesM2 > 0 ? [{ zona: 'Áreas comunes', concepto: 'Lobby, amenidades', m2: Math.round(programa.amenidadesM2), participacion: pct(programa.amenidadesM2) }] : []),
    { zona: 'Cuartos de servicio', concepto: 'Estimado — lib/estimador no lo modela por separado', m2: cuartosServicio, participacion: pct(cuartosServicio) },
  ]

  // TipologiaPropuesta.comercial no tiene mix por tipo de local (solo totalLocales/niveles),
  // así que el mix comercial del usuario (mixCom) solo alimenta el cálculo de m² vía
  // programaAUsos — no hay dónde desglosarlo en la bitácora, igual que en el modo IA.
  const mixHabUnidades = programa.mixHab.map(r => ({ tipo: r.label, unidades: Math.round(programa.totalUnidades * (r.pct / 100)), m2Promedio: r.m2Promedio }))

  return {
    superficieConstruida: Math.round(areas.total),
    superficieVendible: vendible,
    bitacoraArquitectura: {
      modo: 'usuario_define',
      cosEstimado: cosStr || undefined,
      cusEstimado: cusStr || undefined,
      tipologiaPropuesta: {
        habitacional: { totalDepartamentos: programa.totalUnidades, mix: mixHabUnidades },
        comercial: programa.incluirComercial ? { totalLocales: programa.niveles * programa.localesPorNivel, niveles: programa.niveles } : null,
      },
      superficieConstruida: Math.round(areas.total),
      superficieVendible: vendible,
      desgloseZonas: zonas,
      areaLibreYVerde: {
        m2: Math.round(envolvente.permeableMin),
        porcentajeLote: sTerreno > 0 ? `${Math.round((envolvente.permeableMin / sTerreno) * 100)}%` : '—',
        descripcion: 'Área permeable mínima normativa (CAS) — jardines, accesos, área libre.',
      },
      envolvente,
      cajones,
      supuestos: resultado.supuestos,
    },
  }
}

function ArquitecturaInteractiva({
  sTerreno, cosStr, cusStr, onContinuar,
}: {
  sTerreno: number; cosStr: string | undefined; cusStr: string | undefined
  onContinuar: (resultado: ArquitecturaResult) => void
}) {
  const [incluirComercial, setIncluirComercial] = useState(false)
  const [generoVivienda, setGeneroVivienda] = useState<'vivienda_interes_social' | 'vivienda_residencial_media' | 'vivienda_residencial_lujo'>('vivienda_residencial_media')
  const [totalUnidades, setTotalUnidades] = useState(60)
  const [mixHab, setMixHab] = useState<MixRow[]>([
    { label: '1 recámara', pct: 50, m2Promedio: 55 },
    { label: '2 recámaras', pct: 30, m2Promedio: 75 },
    { label: '3 recámaras', pct: 20, m2Promedio: 100 },
  ])
  const [niveles, setNiveles] = useState(2)
  const [localesPorNivel, setLocalesPorNivel] = useState(6)
  const [mixCom, setMixCom] = useState<MixRow[]>([
    { label: 'Local chico', pct: 30, m2Promedio: 70 },
    { label: 'Local mediano', pct: 40, m2Promedio: 90 },
    { label: 'Local grande', pct: 30, m2Promedio: 120 },
  ])
  const [amenidadesM2, setAmenidadesM2] = useState(0)

  const resultado = useMemo(() => {
    const programa: ProgramaUnidades = {
      habitacional: { genero: generoVivienda, totalUnidades, mix: mixHab },
      ...(incluirComercial ? { comercial: { niveles, localesPorNivel, mix: mixCom } } : {}),
      amenidadesM2,
    }
    const usos = programaAUsos(programa)
    if (usos.every(u => u.m2Bruto <= 0) || sTerreno <= 0) return null
    const normativos = construirInputsNormativos(sTerreno, cosStr, cusStr)
    try {
      return calcular(normativos, { usos })
    } catch {
      return null
    }
  }, [generoVivienda, totalUnidades, mixHab, incluirComercial, niveles, localesPorNivel, mixCom, amenidadesM2, sTerreno, cosStr, cusStr])

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#132a4d] rounded-xl px-4 py-3">
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Habitacional</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <p className="text-[9px] text-[#5f6a80] font-semibold mb-1">Segmento de vivienda</p>
            <select value={generoVivienda} onChange={e => setGeneroVivienda(e.target.value as typeof generoVivienda)}
              className="w-full border border-[#2a3f5c] rounded-lg px-2 py-1.5 text-[12px] bg-[#132a4d] text-[#f4f0e6]">
              {Object.entries(GENERO_VIVIENDA_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[9px] text-[#5f6a80] font-semibold mb-1">Total unidades</p>
            <input type="number" value={totalUnidades} onChange={e => setTotalUnidades(e.target.valueAsNumber || 0)}
              placeholder="Total unidades"
              className="w-full border border-[#2a3f5c] rounded-lg px-2 py-1.5 text-[12px] text-[#f4f0e6]" />
          </div>
        </div>
        <MixEditor rows={mixHab} onChange={setMixHab} />
      </div>

      <div className="bg-[#132a4d] rounded-xl px-4 py-3">
        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Áreas comunes y amenidades</p>
        <div className="relative w-48">
          <input type="number" value={amenidadesM2 || ''} onChange={e => setAmenidadesM2(e.target.valueAsNumber || 0)}
            placeholder="0"
            className="w-full border border-[#2a3f5c] rounded-lg pr-10 pl-2 py-1.5 text-[12px] text-[#f4f0e6]" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#5f6a80] font-medium">m²</span>
        </div>
        <p className="text-[9px] text-[#5f6a80] mt-1.5">Lobby, gimnasio, roof garden, salón de eventos, alberca — no vendible, se costea aparte.</p>
      </div>

      <label className="flex items-center gap-2 text-[12px] font-medium text-[#f4f0e6] cursor-pointer">
        <input type="checkbox" checked={incluirComercial} onChange={e => setIncluirComercial(e.target.checked)} className="w-4 h-4 accent-[#c9a227]" />
        Incluir locales comerciales (mixto)
      </label>

      {incluirComercial && (
        <div className="bg-[#132a4d] rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Comercial</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="number" value={niveles} onChange={e => setNiveles(e.target.valueAsNumber || 0)}
              placeholder="Niveles" className="border border-[#2a3f5c] rounded-lg px-2 py-1.5 text-[12px] text-[#f4f0e6]" />
            <input type="number" value={localesPorNivel} onChange={e => setLocalesPorNivel(e.target.valueAsNumber || 0)}
              placeholder="Locales/nivel" className="border border-[#2a3f5c] rounded-lg px-2 py-1.5 text-[12px] text-[#f4f0e6]" />
          </div>
          <MixEditor rows={mixCom} onChange={setMixCom} />
        </div>
      )}

      {resultado && (
        <>
          <div
            className="rounded-xl px-4 py-3 text-[13px] font-semibold"
            style={{
              backgroundColor: resultado.envolvente.cumple ? '#14301f' : '#2e1414',
              color: resultado.envolvente.cumple ? '#0F6E56' : '#F87171',
            }}
          >
            {resultado.envolvente.cumple
              ? '✓ Cumple con el envolvente normativo'
              : `✕ Excede el m² construible permitido por ${resultado.envolvente.excesoPct?.toFixed(0)}%`}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Construible máx</p>
              <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{Math.round(resultado.envolvente.construibleMax).toLocaleString('es-MX')} m²</p>
            </div>
            <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Programa (sobre rasante)</p>
              <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{Math.round(resultado.areas.sobreRasante).toLocaleString('es-MX')} m²</p>
            </div>
            <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Cajones requeridos</p>
              <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{resultado.cajones.cajonesTotales}</p>
            </div>
          </div>

          <button
            onClick={() => onContinuar(estimadorAArquitectura(
              resultado,
              { generoVivienda, totalUnidades, mixHab, incluirComercial, niveles, localesPorNivel, mixCom, amenidadesM2 },
              sTerreno, cosStr, cusStr,
            ))}
            disabled={!resultado.envolvente.cumple}
            className={`w-full rounded-xl py-3 text-[13px] font-semibold transition-colors flex items-center justify-center gap-2 ${
              resultado.envolvente.cumple ? 'bg-[#1D9E75] text-white hover:bg-[#0F6E56] cursor-pointer' : 'bg-[#2a3f5c] text-[#5f6a80] cursor-not-allowed'
            }`}
          >
            Usar este programa como diseño de Arquitectura
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

function SectionHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-6 h-6 rounded-full bg-[#c9a227] text-[#070f22] text-[10px] font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <span className="text-[11px] font-bold text-[#f4f0e6] uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-[#2a3f5c]" />
    </div>
  )
}

// ─── Step Cards ──────────────────────────────────────────────────────────────

function RunningCard({ label, hint, color = '#c9a227' }: { label: string; hint: string; color?: string }) {
  return (
    <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm p-6 flex items-center gap-5">
      <Sonar color={color} size={36} />
      <div>
        <p className="text-[14px] font-semibold text-[#f4f0e6]">{label}</p>
        <p className="text-[12px] text-[#5f6a80] mt-0.5">{hint}</p>
      </div>
    </div>
  )
}

function DoneCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#132a4d] rounded-2xl border border-[#c9a227]/40 shadow-sm overflow-hidden">
      {children}
    </div>
  )
}

function ErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="bg-[#132a4d] rounded-2xl border border-[#FECACA] p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#2e1414] flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 13H2L8 2Z" stroke="#DC2626" strokeWidth="1.5" strokeLinejoin="round"/>
            <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="11.5" r=".75" fill="#DC2626"/>
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#F87171]">{label} — Error al conectar</p>
          <p className="text-[11px] text-[#5f6a80]">Verifica tu API key o conexión</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="text-[12px] font-semibold text-[#c9a227] border border-[#c9a227]/40 px-3 py-1.5 rounded-lg hover:bg-[#c9a227]/8 transition-colors cursor-pointer shrink-0"
      >
        Re-intentar
      </button>
    </div>
  )
}

// ─── Agent Chat ──────────────────────────────────────────────────────────────

const QUICK_QUESTIONS: Record<string, string[]> = {
  arquitectura: [
    '¿Por qué ese mix de departamentos y no otro?',
    '¿Cómo se calculó el área máxima construible?',
    '¿Qué tan cerca está el diseño del techo legal (COS/CUS)?',
    '¿Cómo cambia el diseño si ajusto los niveles?',
  ],
  terreno: [
    '¿Por qué asignaste esa banda y no la adyacente?',
    '¿Cómo afecta la clasificación vial al valor?',
    '¿Los comparables son del mismo nivel de la colonia?',
    '¿Qué dato mejoraría más el índice de confiabilidad?',
  ],
  construccion: [
    '¿Por qué ese costo/m² para esta ciudad?',
    '¿Cómo calculaste la superficie construible?',
    '¿Qué partida representa mayor riesgo de sobrecosto?',
    '¿Cómo cambia si ajusto la banda de construcción?',
  ],
  legal: [
    '¿Cuánto tiempo toman los permisos en este municipio?',
    '¿La alerta más crítica puede resolverse?',
    '¿Se necesita cambio de uso de suelo?',
    '¿Qué implica el CUS para el número de unidades?',
  ],
  mercado: [
    '¿Por qué esa velocidad de absorción?',
    '¿Hay riesgo de saturación en el corredor?',
    '¿Cuál es el mejor producto para este mercado?',
    '¿Los comparables son del mismo nivel de calidad?',
  ],
}

function AgentChat({ agentKey, agentData }: { agentKey: string; agentData: any }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text?: string) => {
    const pregunta = text ?? input.trim()
    if (!pregunta || loading) return
    setInput('')
    const next = [...messages, { role: 'user' as const, content: pregunta }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await authedFetch('/api/chat-analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analisis: agentData, messages, pregunta }),
      })
      const json = await res.json()
      setMessages([...next, { role: 'assistant', content: json.respuesta || 'Sin respuesta.' }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Error al conectar. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  const questions = QUICK_QUESTIONS[agentKey] ?? []

  return (
    <div className="border-t border-[#2a3f5c] px-5 py-4">
      <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-widest mb-3">Preguntar al agente</p>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {questions.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-[11px] text-[#c9a227] border border-[#c9a227]/40 bg-[#c9a227]/8 px-3 py-1.5 rounded-full hover:bg-[#c9a227]/12 transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto mb-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-[#c9a227] flex items-center justify-center shrink-0 mb-0.5">
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                  </svg>
                </div>
              )}
              <div className={`max-w-[82%] px-3 py-2 text-[12px] leading-relaxed rounded-2xl ${
                m.role === 'user'
                  ? 'bg-[#c9a227] text-[#070f22] rounded-br-sm'
                  : 'bg-[#132a4d] border border-[#2a3f5c] text-[#f4f0e6] rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-[#c9a227] flex items-center justify-center shrink-0 mb-0.5">
                <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                </svg>
              </div>
              <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-2xl rounded-bl-sm px-3 py-2.5">
                <span className="inline-flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#5f6a80] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pregunta algo sobre este cálculo…"
          disabled={loading}
          className="flex-1 text-[12px] bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-4 py-2.5 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/10 placeholder:text-[#5f6a80] disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl bg-[#c9a227] flex items-center justify-center disabled:opacity-40 hover:bg-[#ddc06a] transition-colors cursor-pointer shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// Panel de alertas consolidado del checkpoint post-Construcción (Step 6) — junta señales
// amarillo/rojo que ya calculan los agentes pero que hoy viven dispersas (o, en el caso de
// validacionEnvolvente, nunca se muestran en ningún lado). Solo lista lo que hay que revisar,
// no un reporte de estado completo — si todo está en verde, un solo banner de éxito.
interface AlertaItem { severidad: 'amber' | 'red'; titulo: string; detalle: string }

function AlertasResumen({ terreno, legal, arquitectura, construccion, spreadBajo, margenBruto }: {
  terreno?: any; legal?: any; arquitectura?: any; construccion?: any
  spreadBajo: boolean; margenBruto: number
}) {
  const items: AlertaItem[] = []

  const icTerreno = terreno?.indiceConfiabilidad
  if (icTerreno?.semaforo && icTerreno.semaforo !== 'VERDE') {
    items.push({
      severidad: icTerreno.semaforo === 'ROJO' ? 'red' : 'amber',
      titulo: 'Terreno — confiabilidad',
      detalle: icTerreno.accionRecomendada || icTerreno.interpretacion || 'Revisar la valuación del terreno.',
    })
  }
  const vpTerreno = terreno?.validacionPrecioSolicitado
  if (vpTerreno?.aplica && vpTerreno.semaforo && vpTerreno.semaforo !== 'VERDE') {
    items.push({
      severidad: vpTerreno.semaforo === 'ROJO' ? 'red' : 'amber',
      titulo: 'Terreno — precio solicitado',
      detalle: vpTerreno.interpretacion || 'El precio solicitado se aleja del valor calculado.',
    })
  }

  const nivelRiesgo = legal?.fichaLegal?.nivelRiesgo
  if (nivelRiesgo === 'Medio' || nivelRiesgo === 'Alto') {
    items.push({
      severidad: nivelRiesgo === 'Alto' ? 'red' : 'amber',
      titulo: 'Riesgo legal',
      detalle: `Nivel de riesgo ${nivelRiesgo} según la Ficha Legal.`,
    })
  }
  const alertasLegales = legal?.fichaLegal?.alertasLegales as Array<{ tipo: string; descripcion: string; impacto: string; status: string }> | undefined
  alertasLegales?.forEach(a => {
    if (a.status === 'amber' || a.status === 'red') {
      items.push({ severidad: a.status as 'amber' | 'red', titulo: `Legal — ${a.tipo}`, detalle: a.impacto || a.descripcion })
    }
  })

  const validSup = arquitectura?.validacionSuperficieConstruida
  if (validSup?.excedeAreaMaxConstruible) {
    items.push({ severidad: 'red', titulo: 'Superficie excede el máximo legal', detalle: 'El diseño propuesto rebasa el área máxima construible por COS/CUS.' })
  } else if (validSup?.fueraDeRangoPiso || validSup?.fueraDeRangoTecho) {
    items.push({ severidad: 'amber', titulo: 'Superficie fuera de rango esperado', detalle: 'La superficie construida propuesta cae fuera del rango piso–techo calculado.' })
  }

  const validMix = arquitectura?.validacionEnvolvente
  if (validMix?.sobredensifica) {
    items.push({ severidad: 'amber', titulo: 'Mix sobredensifica el predio', detalle: `${validMix.nUnidades} unidades exceden la densidad máxima autorizada.` })
  } else if (validMix?.subdensifica) {
    items.push({ severidad: 'amber', titulo: 'Mix subdensifica el predio', detalle: `${validMix.nUnidades} unidades aprovechan menos del 70% de la densidad autorizada.` })
  }

  const icConstruccion = construccion?.indiceConfiabilidad
  if (icConstruccion?.semaforo && icConstruccion.semaforo !== 'VERDE') {
    items.push({
      severidad: icConstruccion.semaforo === 'ROJO' ? 'red' : 'amber',
      titulo: 'Construcción — confiabilidad',
      detalle: icConstruccion.accionRecomendada || icConstruccion.interpretacion || 'Revisar el costeo de construcción.',
    })
  }

  if (spreadBajo) {
    items.push({ severidad: 'red', titulo: 'Spread venta/construcción bajo', detalle: 'Por debajo de 1.6x — señal temprana de que el proyecto puede no ser viable.' })
  }
  if (margenBruto < 12) {
    items.push({ severidad: margenBruto < 0 ? 'red' : 'amber', titulo: 'Margen bruto bajo', detalle: `${margenBruto.toFixed(1)}% — por debajo del 12% de referencia.` })
  }

  items.sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === 'red' ? -1 : 1))

  if (items.length === 0) {
    return (
      <div className="mx-5 mb-4 flex items-center gap-2 bg-[#122a1c] border border-[#2f6b4f] rounded-xl px-4 py-3">
        <span className="w-2 h-2 rounded-full bg-[#1D9E75] shrink-0" />
        <p className="text-[12px] font-semibold text-[#0F6E56]">Sin alertas — todo dentro de rango.</p>
      </div>
    )
  }

  return (
    <div className="mx-5 mb-4">
      <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Alertas a revisar ({items.length})</p>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 border ${it.severidad === 'red' ? 'bg-[#2e1414] border-[#FECACA]' : 'bg-[#2e2510] border-[#F5D97A]'}`}>
            <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: it.severidad === 'red' ? '#DC2626' : '#D97706' }} />
            <div className="min-w-0">
              <p className={`text-[12px] font-bold ${it.severidad === 'red' ? 'text-[#F87171]' : 'text-[#FBBF24]'}`}>{it.titulo}</p>
              <p className="text-[11px] text-[#5C7186] mt-0.5 leading-snug">{it.detalle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Consolida en un solo bloque compacto de pestañas los chats "Preguntar al agente" (antes uno
// por sección, mismo AgentChat de siempre, solo reubicado) y el único ajuste que sigue teniendo
// sentido en este punto del pipeline: la banda de construcción (Terreno/Arquitectura/Mercado
// necesitan re-correrse ANTES de Construcción para no dejar el pipeline inconsistente — esos
// tres "Ajustar parámetros" se quedan en su propia sección, ver analizando/page.tsx).
function AgentesQA({
  terreno, legal, mercado, arquitectura, construccion, bandaActual, onAjustarBanda,
}: {
  terreno: any; legal: any; mercado: any; arquitectura: any; construccion: any
  bandaActual: number | string | undefined; onAjustarBanda: (banda: string) => void
}) {
  const tabs = [
    { key: 'terreno', label: 'Terreno', data: terreno },
    { key: 'legal', label: 'Legal', data: legal },
    { key: 'mercado', label: 'Mercado', data: mercado },
    { key: 'arquitectura', label: 'Arquitectura', data: arquitectura },
    { key: 'construccion', label: 'Construcción', data: construccion },
  ]
  const [activo, setActivo] = useState(tabs[0].key)
  return (
    <div className="px-5 pb-2">
      <VerDetalle label="Preguntar a los agentes / ajustar banda de construcción">
        <div className="rounded-xl border border-[#2a3f5c] overflow-hidden bg-[#132a4d]">
          <div className="flex overflow-x-auto bg-[#132a4d] border-b border-[#2a3f5c]">
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActivo(t.key)}
                className={`shrink-0 px-3.5 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                  activo === t.key ? 'text-[#ddc06a] border-b-2 border-[#c9a227] bg-[#132a4d]' : 'text-[#5f6a80] hover:text-[#8b96ab]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {activo === 'construccion' && (
            <div className="px-5 pt-4 border-b border-[#2a3f5c]">
              {/* El diseño (niveles/mix/amenidades) ya lo fijó Arquitectura — aquí solo se
                  puede volver a costear el mismo diseño con otra banda de acabados. */}
              <AjustarBandaConstruccion bandaActual={bandaActual} onAplicar={onAjustarBanda} />
            </div>
          )}
          {tabs.map(t => activo === t.key && <AgentChat key={t.key} agentKey={t.key} agentData={t.data} />)}
        </div>
      </VerDetalle>
    </div>
  )
}

// Portado de app/propuesta/page.tsx (CashFlowChart, ahí portado a su vez de app/analisis/
// page.tsx) — SVG a mano, sin librería de gráficas. Usado en el checkpoint de Financiero
// (Step 7) para no obligar a salir de esta pantalla a ver el flujo de caja proyectado.
interface FlujoMesPipeline { mes: number; fase: string; egresos: number; ingresos: number; acumulado: number; nota: string }

function CashFlowChart({ data }: { data: FlujoMesPipeline[] }) {
  const W = 680, H = 220
  const pad = { top: 24, right: 16, bottom: 36, left: 72 }
  const iW = W - pad.left - pad.right
  const iH = H - pad.top - pad.bottom

  const maxEgreso  = Math.max(...data.map(d => d.egresos),  1)
  const maxIngreso = Math.max(...data.map(d => d.ingresos), 1)
  const maxBar     = Math.max(maxEgreso, maxIngreso)
  const minAcum    = Math.min(...data.map(d => d.acumulado))
  const maxAcum    = Math.max(...data.map(d => d.acumulado))
  const acumRange  = maxAcum - minAcum || 1

  const barW  = Math.max(4, iW / data.length - 3)
  const xPos  = (i: number) => pad.left + (i + 0.5) * (iW / data.length)
  const yLine = (v: number) => pad.top + ((maxAcum - v) / acumRange) * iH

  const zeroY = yLine(0)
  const linePts = data.map((d, i) => `${xPos(i)},${yLine(d.acumulado)}`).join(' ')

  const fmtCompacto = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}k`

  const ticks = [minAcum, minAcum + acumRange * 0.25, minAcum + acumRange * 0.5, minAcum + acumRange * 0.75, maxAcum]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.left} y1={yLine(t)} x2={W - pad.right} y2={yLine(t)} stroke="#2a3f5c" strokeWidth="1" />
          <text x={pad.left - 6} y={yLine(t) + 4} textAnchor="end" fontSize="9" fill="#5f6a80">{fmtCompacto(t)}</text>
        </g>
      ))}

      {minAcum < 0 && maxAcum > 0 && (
        <line x1={pad.left} y1={zeroY} x2={W - pad.right} y2={zeroY} stroke="#2a3f5c" strokeWidth="1.5" strokeDasharray="4 3" />
      )}

      {data.map((d, i) => {
        const cx   = xPos(i)
        const half = barW / 2
        const hE   = (d.egresos  / maxBar) * (iH * 0.45)
        const hI   = (d.ingresos / maxBar) * (iH * 0.45)
        const midY = pad.top + iH * 0.5
        return (
          <g key={i}>
            {d.egresos  > 0 && <rect x={cx - half} y={midY}          width={barW} height={hE} rx="2" fill="#FCA5A5" />}
            {d.ingresos > 0 && <rect x={cx - half} y={midY - hI}     width={barW} height={hI} rx="2" fill="#6EE7B7" />}
          </g>
        )
      })}

      <polyline points={linePts} fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <circle key={i} cx={xPos(i)} cy={yLine(d.acumulado)} r="3"
          fill={d.acumulado >= 0 ? '#1D9E75' : '#DC2626'} stroke="white" strokeWidth="1.5" />
      ))}

      {data.map((d, i) => (
        (i === 0 || (i + 1) % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
          <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#5f6a80">M{d.mes}</text>
        )
      ))}

      <g transform={`translate(${pad.left}, ${H - 8})`}>
        <rect x="0" y="-7" width="8" height="8" rx="1" fill="#6EE7B7" />
        <text x="11" y="0" fontSize="9" fill="#8b96ab">Ingresos</text>
        <rect x="64" y="-7" width="8" height="8" rx="1" fill="#FCA5A5" />
        <text x="75" y="0" fontSize="9" fill="#8b96ab">Egresos</text>
        <line x1="128" y1="-3" x2="140" y2="-3" stroke="#1D9E75" strokeWidth="2.5" />
        <text x="143" y="0" fontSize="9" fill="#8b96ab">Acumulado</text>
      </g>
    </svg>
  )
}

// Resumen compacto de resiliencia para el checkpoint de Financiero — score por dimensión +
// stress test + punto de quiebre, mismo dato que ya usa /propuesta pero en versión chica.
function ResilienciaResumen({ score, stressTest, puntoQuiebre }: { score: any; stressTest: any[]; puntoQuiebre: any }) {
  const STATUS_CFG: Record<string, { dot: string; label: string; badge: string }> = {
    green: { dot: '#1D9E75', label: 'Tolerable', badge: 'bg-[#14301f] text-[#0F6E56]' },
    amber: { dot: '#D97706', label: 'Monitorear', badge: 'bg-[#2e2510] text-[#FBBF24]' },
    red:   { dot: '#DC2626', label: 'Crítico', badge: 'bg-[#2e1414] text-[#F87171]' },
  }
  return (
    <div className="flex flex-col gap-4">
      {score && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Solidez financiera', v: score.solidezFinanciera },
            { label: 'Riesgo regulatorio', v: score.riesgoRegulatorio },
            { label: 'Exposición mercado', v: score.exposicionMercado },
          ].map(item => {
            const color = item.v >= 70 ? '#1D9E75' : item.v >= 50 ? '#D97706' : '#DC2626'
            return (
              <div key={item.label} className="bg-[#132a4d] rounded-xl p-3 border border-[#2a3f5c]">
                <p className="text-[10px] text-[#5f6a80] mb-1.5">{item.label}</p>
                <div className="h-1.5 bg-[#2a3f5c] rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full" style={{ width: `${item.v}%`, backgroundColor: color }} />
                </div>
                <p className="text-[11px] font-bold" style={{ color }}>{item.v}/100</p>
              </div>
            )
          })}
        </div>
      )}

      {stressTest?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Stress test — escenarios adversos</p>
          <div className="flex flex-col gap-1.5">
            {stressTest.map((s: any, i: number) => {
              const cfg = STATUS_CFG[s.status] ?? STATUS_CFG.amber
              return (
                <div key={i} className="flex items-start gap-2.5 bg-[#132a4d] border border-[#2a3f5c] rounded-xl px-3.5 py-2.5">
                  <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: cfg.dot }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-bold text-[#f4f0e6]">{s.titulo}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-[11px] text-[#8b96ab] mt-0.5">{s.impacto}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {puntoQuiebre && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Desviación máx. costos', value: puntoQuiebre.desviacionMaxCostos },
            { label: 'Absorción mínima viable', value: puntoQuiebre.absorcionMinViable },
            { label: 'Precio venta mínimo', value: puntoQuiebre.precioVentaMinimo },
          ].map(b => (
            <div key={b.label} className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl p-3 text-center">
              <p className="text-[9px] text-[#5f6a80] uppercase tracking-wide mb-1">{b.label}</p>
              <p className="text-[14px] font-black text-[#f4f0e6]">{b.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main pipeline ───────────────────────────────────────────────────────────

function PipelineContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || ''

  const [formData, setFormData] = useState<any>(null)
  const [modoRapido, setModoRapido] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [mastermindAbierto, setMastermindAbierto] = useState(false)
  const [pipe, setPipe] = useState<PipelineState>({
    comparables: { status: 'waiting', data: [] },
    comparablesVenta: { status: 'waiting', data: [] },
    terreno:     { status: 'waiting', corridas: [], seleccionada: null, overrideM2: '', usarPrecioSolicitado: false },
    arquitectura:{ status: 'waiting', corridas: [], seleccionada: null },
    construccion:{ status: 'waiting', corridas: [], seleccionada: null, overrideM2: '', usarParametricoZona: false },
    legal:       { status: 'waiting', data: null },
    mercado:     { status: 'waiting', corridas: [], seleccionada: null, overridePrecioVenta: '', overrideAbsorcion: '' },
    financiero:  { status: 'waiting', data: null, precioVentaObjetivo: '', unidadesObjetivo: '' },
    ubicacion:   { status: 'waiting', data: null },
    catastro:    { status: 'waiting', data: null },
  })

  // Candidato actualmente elegido por el analista en cada paso con "Ajustar parámetros"
  // (o `null` si aún no hay ninguna corrida) — todo el resto del pipeline lee de aquí,
  // nunca de `corridas` directamente.
  const terrenoActual = pipe.terreno.seleccionada !== null ? pipe.terreno.corridas[pipe.terreno.seleccionada] : null
  const arquitecturaActual = pipe.arquitectura.seleccionada !== null ? pipe.arquitectura.corridas[pipe.arquitectura.seleccionada] : null
  const construccionActual = pipe.construccion.seleccionada !== null ? pipe.construccion.corridas[pipe.construccion.seleccionada] : null
  const mercadoActual = pipe.mercado.seleccionada !== null ? pipe.mercado.corridas[pipe.mercado.seleccionada] : null

  // Toggle del formulario "Definir mi programa de unidades" dentro de Arquitectura — vive
  // fuera del IIFE que renderiza la tarjeta "done" (más abajo) porque ese bloque se invoca
  // directamente durante el render y no puede usar hooks (reglas de hooks de React).
  const [mostrarArquitecturaManual, setMostrarArquitecturaManual] = useState(false)

  // React Strict Mode (dev) invoca los efectos de montaje DOS veces — sin este guard, la
  // primera invocación restauraba el snapshot y lo borraba de localStorage, y la segunda ya no
  // lo encontraba (removeItem ya corrió) y caía al arranque normal, disparando Terreno/Legal/
  // Mercado/Arquitectura/Construcción desde cero encima de lo ya restaurado. useRef persiste
  // entre ambas invocaciones (mismo fiber), a diferencia de leer/borrar localStorage.
  const bootstrapRef = useRef(false)
  useEffect(() => {
    if (bootstrapRef.current) return
    bootstrapRef.current = true

    const raw = localStorage.getItem('smt_flujo_a_data')
    if (!raw) { router.push('/prospeccion/flujo-a'); return }
    const fd = JSON.parse(raw)
    setFormData(fd)
    setModoRapido(!!fd._modoRapido)

    // Red de seguridad para quien llega por deep-link a /mastermind-core (fuera del overlay
    // normal, que ya no navega): si hay un snapshot guardado, restaura el pipeline completo en
    // vez de arrancar desde cero — evita re-correr Terreno/Legal/Mercado/Arquitectura/
    // Construcción (cada uno con su propia llamada LLM) solo por haber ido a calibrar.
    const snapshotRaw = localStorage.getItem('smt_pipeline_snapshot')
    if (snapshotRaw) {
      localStorage.removeItem('smt_pipeline_snapshot')
      try {
        setPipe(JSON.parse(snapshotRaw))
        return
      } catch { /* snapshot corrupto — sigue el arranque normal abajo */ }
    }

    console.log('[ubicacion] lat:', fd.lat, 'lng:', fd.lng, 'zonaGeo:', fd.zonaGeo)
    runUbicacion(fd)
    if (fd.cuentaPredial?.trim()) runCatastro(fd)
    // Legal y Mercado no dependen de Terreno (solo de formData) — se disparan aquí mismo,
    // en paralelo con la cadena Ubicación→Comparables→Terreno, en vez de esperar a que
    // Terreno termine. Arquitectura sigue esperando a Legal (sí lo necesita, ver runArquitectura).
    runLegal(fd)
    runMercado(undefined, fd)
  }, [])

  // Aplica la calibración de Mastermind 1 (si venimos de ahí) una vez que el pipeline
  // restaurado ya tiene Construcción lista — antes de eso pipe.construccion todavía no existe
  // como para aplicarle un overrideM2. Ningún override aquí reabre Arquitectura/Construcción ni
  // llama de nuevo al LLM — todos anclan valores que el resto del pipeline ya sabe leer
  // (overrideM2 de Terreno/Construcción, precioVentaObjetivo/unidadesObjetivo de Financiero).
  const overridesAplicadosRef = useRef(false)
  useEffect(() => {
    if (overridesAplicadosRef.current) return
    if (pipe.construccion.status !== 'done') return
    overridesAplicadosRef.current = true

    const raw = localStorage.getItem('smt_mastermind1_overrides')
    if (!raw) return
    localStorage.removeItem('smt_mastermind1_overrides')
    try {
      const ov = JSON.parse(raw)
      if (ov.costoTerrenoM2) {
        setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: ov.costoTerrenoM2 } }))
      }
      if (ov.costoConstruccionM2) {
        setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: ov.costoConstruccionM2 } }))
      }
      if (ov.precioVentaObjetivo) {
        setPipe(p => ({ ...p, financiero: { ...p.financiero, precioVentaObjetivo: ov.precioVentaObjetivo } }))
      }
      if (ov.unidadesObjetivo) {
        // Igual patrón que precioVentaObjetivo: ancla directo el payload de Financiero, sin
        // reabrir Arquitectura ni Construcción. Antes disparaba runArquitectura(nuevaCorrida),
        // que volvía a llamar al LLM y "recalculaba" el diseño en vez de solo llevar el número
        // ya calibrado en Mastermind 1 hacia adelante — justo lo que se pidió evitar.
        setPipe(p => ({ ...p, financiero: { ...p.financiero, unidadesObjetivo: ov.unidadesObjetivo } }))
      }
    } catch { /* overrides corruptos — se ignoran */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipe.construccion.status])

  const runCatastro = async (fd: any) => {
    setPipe(p => ({ ...p, catastro: { status: 'running', data: null } }))
    try {
      const res = await authedFetch('/api/catastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuentaPredial: fd.cuentaPredial,
          ciudad: fd.ciudad,
          estado: fd.estado,
        }),
      })
      const json = await res.json()
      if (!json.found) {
        setPipe(p => ({ ...p, catastro: { status: 'error', data: null } }))
        return
      }
      setPipe(p => ({
        ...p,
        catastro: {
          status: 'done',
          data: {
            estado: json.estado ?? '',
            municipio: json.municipio ?? '',
            expediente: json.expediente ?? json.claveCatastral ?? '',
            ubicacion: json.ubicacion ?? null,
            sinAdeudo: json.sinAdeudo ?? null,
            adeudoTotal: json.adeudoTotal ?? null,
            superficieTerreno: json.superficieTerreno ?? null,
            costoCertificado: json.costoCertificado ?? null,
            valorSuelo: json.valorSuelo ?? null,
            valorConstruccion: json.valorConstruccion ?? null,
            valorCatastral: json.valorCatastral ?? null,
            nota: json.nota ?? null,
            portalCaido: !json.valorCatastral && !json.valorSuelo,
            source: json.source ?? '',
          },
        },
      }))
    } catch {
      setPipe(p => ({ ...p, catastro: { status: 'error', data: null } }))
    }
  }

  // ── Preparación: Ubicación (corre primero, al terminar dispara Terreno) ──
  const runUbicacion = async (fd: any) => {
    let lat: number | null = fd.lat ?? fd.zonaGeo?.lat ?? null
    let lng: number | null = fd.lng ?? fd.zonaGeo?.lng ?? null

    // Sin coordenadas → geocodificar via API server-side (maneja Google + Nominatim + Photon)
    if (!lat || !lng) {
      try {
        const params = new URLSearchParams()
        const cp = fd.codigoPostal || fd.cp || ''
        if (cp) params.set('cp', cp)
        if (fd.direccion) params.set('direccion', fd.direccion)
        if (fd.colonia)   params.set('colonia',   fd.colonia)
        if (fd.ciudad)    params.set('ciudad',    fd.ciudad)
        if (fd.estado)    params.set('estado',    fd.estado)
        const geoRes = await authedFetch(`/api/geocode?${params}`).then(r => r.json())
        if (geoRes.found) { lat = geoRes.lat; lng = geoRes.lng }
      } catch { /* continúa sin coords */ }
    }

    // Intentar usar comparables del Scout (evita segunda llamada a Serper)
    let scoutComps: ComparableItem[] = []
    try {
      const raw = localStorage.getItem('smt_scout_comparables')
      if (raw) {
        const saved = JSON.parse(raw)
        const age = Date.now() - (saved.timestamp ?? 0)
        if (age < 60 * 60 * 1000) { // válido por 1 hora
          scoutComps = saved.comparables ?? []
          localStorage.removeItem('smt_scout_comparables')
        }
      }
    } catch { /* ignora */ }

    const getComps = scoutComps.length > 0
      ? async () => { setPipe(p => ({ ...p, comparables: { status: 'done', data: scoutComps } })); return scoutComps }
      : (fd2: any) => runComparables(fd2)

    if (!lat || !lng) {
      setPipe(p => ({ ...p, ubicacion: { status: 'done', data: { isocronas: [] } } }))
      const comps = await getComps(fd)
      runTerreno(fd, null, comps)
      return
    }

    // Comparables e isócronas en paralelo
    setPipe(p => ({ ...p, ubicacion: { status: 'running', data: null } }))
    const [comps, isoRes] = await Promise.all([
      getComps(fd),
      authedFetch('/api/geo/isochrone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, perfil: 'driving' }),
      }).then(r => r.json()).catch(() => ({ isocronas: [] })),
    ])
    const ubicacionData: UbicacionData = { isocronas: isoRes.isocronas ?? [], errorMsg: isoRes.error }
    setPipe(p => ({ ...p, ubicacion: { status: 'done', data: ubicacionData } }))
    runTerreno(fd, ubicacionData, comps)
  }

  // ── Step 0b: Comparables reales (Serper) ──
  const runComparables = async (fd?: any): Promise<ComparableItem[]> => {
    const input = fd || formData
    setPipe(p => ({ ...p, comparables: { status: 'running', data: [] } }))
    try {
      const res = await authedFetch('/api/agentes/comparables', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonia: input.colonia, ciudad: input.ciudad, estado: input.estado, codigoPostal: input.codigoPostal }),
      })
      const json = await res.json()
      const items: ComparableItem[] = json.comparables ?? []
      setPipe(p => ({ ...p, comparables: { status: 'done', data: items } }))
      return items
    } catch {
      setPipe(p => ({ ...p, comparables: { status: 'done', data: [] } }))
      return []
    }
  }

  // ── Comparables reales de VENTA (Serper) — para el Agente Mercado, no Terreno ──
  // Se dispara dentro de runMercado(), que ahora corre desde el bootstrap en paralelo con
  // Terreno — recibe `fd` explícito porque en ese punto el estado `formData` todavía no se
  // actualizó (setFormData es asíncrono), igual que ya hacían runTerreno/runCatastro.
  const runComparablesVenta = async (fd?: any): Promise<ComparableVentaItem[]> => {
    const input = fd || formData
    setPipe(p => ({ ...p, comparablesVenta: { status: 'running', data: [] } }))
    try {
      const res = await authedFetch('/api/agentes/comparables-venta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colonia: input.colonia, ciudad: input.ciudad, estado: input.estado,
          codigoPostal: input.codigoPostal, tiposDesarrollo: input.tiposDesarrollo,
          bandaConstruccion: input.bandaConstruccion,
        }),
      })
      const json = await res.json()
      const items: ComparableVentaItem[] = json.comparables ?? []
      setPipe(p => ({ ...p, comparablesVenta: { status: 'done', data: items } }))
      return items
    } catch {
      setPipe(p => ({ ...p, comparablesVenta: { status: 'done', data: [] } }))
      return []
    }
  }

  // ── Step 1: Terreno ──
  const runTerreno = async (fd?: any, ubicacion?: UbicacionData | null, comparablesPrecargados?: ComparableItem[]) => {
    const input = fd || formData
    const ub = ubicacion !== undefined ? ubicacion : pipe.ubicacion.data
    const comps = comparablesPrecargados ?? pipe.comparables.data
    // overrideM2 pertenece a la corrida anterior — si se genera una nueva opción de Terreno
    // (banda/vialidad ajustadas o "Ajustar parámetros" sin cambios), el número manual queda obsoleto.
    setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'running', overrideM2: '', usarPrecioSolicitado: false } }))
    try {
      const res = await authedFetch('/api/agentes/terreno', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, ubicacion: ub, comparablesPrecargados: comps }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'done', corridas: [...p.terreno.corridas, json], seleccionada: p.terreno.corridas.length } }))
    } catch {
      setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'error' } }))
    }
  }

  // ── Step 1b: Arquitectura — diseña a la máxima capacidad legal apenas Legal termina ──
  const runArquitectura = async (overrides?: {
    bandaConstruccion?: string; nivelesOverride?: string; totalDeptosOverride?: string
    totalLocalesOverride?: string; amenidadesNivelOverride?: string
  }) => {
    const payload = { ...formData, ...overrides, fichaLegal: pipe.legal.data?.fichaLegal }
    setPipe(p => ({ ...p, arquitectura: { ...p.arquitectura, status: 'running' } }))
    try {
      const res = await authedFetch('/api/agentes/arquitectura', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, arquitectura: { ...p.arquitectura, status: 'done', corridas: [...p.arquitectura.corridas, json], seleccionada: p.arquitectura.corridas.length } }))
    } catch {
      setPipe(p => ({ ...p, arquitectura: { ...p.arquitectura, status: 'error' } }))
    }
  }

  // ── Step 2: Construcción — costea el diseño que ya aprobó Arquitectura ──
  const runConstruccion = async (overrides?: { bandaConstruccion?: string }) => {
    const t = terrenoActual!
    const arq = arquitecturaActual!
    const ba = arq.bitacoraArquitectura
    const m2 = pipe.terreno.usarPrecioSolicitado
      ? Number(formData.precioSolicitado) / Number(formData.superficie)
      : (pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2)
    const payload = {
      ...formData, ...overrides, costoTerrenoM2: m2, costoTerreno: m2 * Number(formData.superficie),
      mercado: mercadoActual?.mercado,
      arquitectura: {
        tipologiaPropuesta: ba?.tipologiaPropuesta,
        desgloseZonas: ba?.desgloseZonas,
        areaLibreYVerde: ba?.areaLibreYVerde,
        superficieConstruida: arq.superficieConstruida,
        superficieVendible: arq.superficieVendible,
      },
    }
    setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'running' } }))
    try {
      const res = await authedFetch('/api/agentes/construccion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Construcción ya no calcula ni devuelve superficieConstruida/superficieVendible (son
      // dato fijo de Arquitectura) — se completan aquí en vez de dejarlas undefined, porque
      // el resto del pipeline (tarjeta de Construcción, runFinanciero) sigue leyendo
      // c.superficieConstruida/c.superficieVendible directo de la corrida.
      const corrida: ConstruccionResult = { ...json, superficieConstruida: arq.superficieConstruida, superficieVendible: arq.superficieVendible }
      setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'done', corridas: [...p.construccion.corridas, corrida], seleccionada: p.construccion.corridas.length } }))
    } catch {
      setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'error' } }))
    }
  }

  // ── Step 2: Legal (guardarraíl) — solo necesita formData, corre desde el bootstrap en
  // paralelo con Terreno (antes esperaba a que Terreno terminara sin usar su resultado en
  // nada — verificado leyendo legal/route.ts, no lee ubicación/comparables/terreno).
  // `fd` explícito porque se llama desde el bootstrap antes de que `formData` (estado) se
  // actualice — mismo patrón que runTerreno/runCatastro.
  const runLegal = async (fd?: any) => {
    const input = fd || formData
    setPipe(p => ({ ...p, legal: { status: 'running', data: null } }))
    try {
      const res = await authedFetch('/api/agentes/legal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, legal: { status: 'done', data: json } }))
    } catch {
      setPipe(p => ({ ...p, legal: { status: 'error', data: null } }))
    }
  }

  // Arquitectura necesita fichaLegal (COS/CUS) para diseñar al máximo normativo, así que
  // espera a Legal — corre en paralelo con Mercado, sin depender de él.
  useEffect(() => {
    if (pipe.legal.status === 'done' && pipe.arquitectura.status === 'waiting') {
      runArquitectura()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipe.legal.status])

  // Mercado tampoco depende de Terreno (verificado en mercado/route.ts — solo lee formData;
  // costoTerrenoM2/construccionM2 se mencionan en el prompt pero runMercado nunca los envía).
  // Corre desde el bootstrap, en paralelo con Terreno y Legal.
  const runMercado = async (overrides?: { precioVentaObjetivo?: string; absorcionObjetivoManual?: string }, fd?: any) => {
    const input = fd || formData
    const precioVentaObjetivo = overrides?.precioVentaObjetivo ?? pipe.mercado.overridePrecioVenta
    const absorcionObjetivoManual = overrides?.absorcionObjetivoManual ?? pipe.mercado.overrideAbsorcion
    const mixUnidadesResumen = resumenMixUnidades(arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta)
    setPipe(p => ({ ...p, mercado: { ...p.mercado, status: 'running', overridePrecioVenta: precioVentaObjetivo, overrideAbsorcion: absorcionObjetivoManual } }))
    // Los comparables reales no cambian entre corridas de "Ajustar parámetros" — se buscan
    // solo la primera vez y se reutilizan en corridas siguientes del mismo predio.
    const comparablesVenta = pipe.comparablesVenta.status === 'waiting'
      ? await runComparablesVenta(input)
      : pipe.comparablesVenta.data
    try {
      const res = await authedFetch('/api/agentes/mercado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          precioVentaObjetivo: precioVentaObjetivo || undefined,
          absorcionObjetivoManual: absorcionObjetivoManual || undefined,
          mixUnidadesResumen: mixUnidadesResumen || undefined,
          comparablesPrecargados: comparablesVenta,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, mercado: { ...p.mercado, status: 'done', corridas: [...p.mercado.corridas, json], seleccionada: p.mercado.corridas.length } }))
    } catch {
      setPipe(p => ({ ...p, mercado: { ...p.mercado, status: 'error' } }))
    }
  }

  // Abre Mastermind 1 (calibración de costos e ingresos) con un snapshot del pipeline en vivo —
  // en este punto todavía no existe `financiero`/`estructuraCapital` (eso lo genera el Agente
  // Financiero, que corre después), así que el snapshot es un AnalisisData parcial. Los mismos
  // extractores de lib/mastermind/contexto.ts que usa Mastermind 2 (cargados desde un análisis
  // completo) funcionan igual aquí porque ya leen todo vía optional chaining.
  // Snapshot parcial de AnalisisData desde el pipeline en vivo — reusado tanto para alimentar
  // el overlay de Mastermind (MastermindOverlay, nivel Core) como para el resumen inline de
  // costos e ingresos (mastermindCoreInputsActuales abajo), así ambos parten de exactamente
  // los mismos datos.
  const construirSnapshotAnalisis = (): Partial<AnalisisData> => ({
    bitacoraTerreno: terrenoActual?.bitacoraTerreno,
    bitacoraArquitectura: arquitecturaActual?.bitacoraArquitectura,
    bitacoraConstruccion: construccionActual?.bitacoraConstruccion,
    mercado: mercadoActual?.mercado,
  })

  // Inputs para calcularMastermindCore leyendo el estado ACTUAL del pipeline (no un snapshot
  // congelado) — si el usuario ya calibró en Mastermind 1, los overrides que trajo de vuelta
  // (overrideM2 de terreno/construcción, precioVentaObjetivo/unidadesObjetivo de financiero) se
  // aplican encima del extract crudo. Así el resumen SIEMPRE muestra lo que Financiero va a usar
  // de verdad, sea el dato crudo de los agentes o la calibración manual.
  const mastermindCoreInputsActuales = (): MastermindCoreInputs => {
    const snapshot = construirSnapshotAnalisis()
    const terreno = extractTerrenoContext(snapshot)
    if (pipe.terreno.overrideM2 !== '') {
      terreno.costoTerrenoM2 = Number(pipe.terreno.overrideM2)
      terreno.costoTerreno = terreno.costoTerrenoM2 * terreno.superficieM2
    }
    const proyecto = { ...DEFAULTS.proyecto, ...extractProyectoContext(snapshot) }
    if (pipe.construccion.overrideM2 !== '') proyecto.costoConstruccionRealM2 = Number(pipe.construccion.overrideM2)
    if (pipe.financiero.unidadesObjetivo) proyecto.unidadesHabitacionales = Number(pipe.financiero.unidadesObjetivo)
    const mercado = { ...DEFAULTS.mercado, ...extractMercadoContext(snapshot) }
    if (pipe.financiero.precioVentaObjetivo) mercado.precioVentaDepasM2 = Number(pipe.financiero.precioVentaObjetivo)
    return { terreno, proyecto, mercado }
  }

  // ── Step 4: Financiero ──
  const runFinanciero = async () => {
    const t = terrenoActual!
    const c = construccionActual!
    const m2t = pipe.terreno.usarPrecioSolicitado
      ? Number(formData.precioSolicitado) / Number(formData.superficie)
      : (pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2)
    const parametricoM2Fin = BANDA_CONSTRUCCION_PARAMETRICO_MXN_M2[String(c.bitacoraConstruccion?.bandaElegida)]
    const usaOverrideConstruccion = pipe.construccion.overrideM2 !== '' || (pipe.construccion.usarParametricoZona && !!parametricoM2Fin)
    const m2c = pipe.construccion.usarParametricoZona && parametricoM2Fin
      ? parametricoM2Fin
      : (pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2)
    const costoTerreno = m2t * Number(formData.superficie)
    // Use actual total from agent (sum of zones). Recompute only if user overrode cost/m²
    // (a mano o con el paramétrico de zona).
    const costoTotalConstruccion = usaOverrideConstruccion
      ? m2c * (c.superficieConstruida || Number(formData.superficie) * 1.2)
      : (c.costoTotalConstruccion || m2c * (c.superficieConstruida || Number(formData.superficie) * 1.2))
    // Preferimos el área vendible derivada del mix real de Arquitectura sobre el campo
    // "resumen" superficieVendible que la IA reporta por separado — ver superficieVendibleDelMix.
    const superficieVendibleReal = superficieVendibleDelMix(arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta) ?? c.superficieVendible
    // Bug real encontrado en producción: Financiero nunca recibía el número de unidades que YA
    // resolvió Arquitectura (limitado por densidad legal) — su prompt le pedía "calcula unidades
    // dividiendo superficie vendible entre m² promedio", así que las inventaba por su cuenta y
    // podía recomendar más unidades de las que la ficha legal permite (visto: 98 recomendadas
    // vs 76 unidades máx por densidad). Si Mastermind 1 no calibró unidadesObjetivo, se manda el
    // total real del mix (misma suma que ya usa extractProyectoContext en lib/mastermind/
    // contexto.ts) para que Financiero deje de adivinar.
    const mixHabReal = arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta?.habitacional?.mix ?? []
    const unidadesRealesArquitectura = mixHabReal.reduce((s: number, r: any) => s + (r.unidades || 0), 0)
    const unidadesObjetivo = pipe.financiero.unidadesObjetivo || (unidadesRealesArquitectura > 0 ? String(unidadesRealesArquitectura) : undefined)
    // Misma derivación "sobrante" que ya usa extractProyectoContext (lib/mastermind/contexto.ts)
    // para m2ComercialesPlantaBaja: el área comercial real = superficieVendibleReal menos lo que
    // el mix habitacional realmente suma — nunca se inventa si no hay componente comercial
    // (tip.comercial) o si el sobrante es negativo. Sin esto, Financiero cobraba TODA el área
    // (habitacional + comercial) al precio de departamentos, sobreestimando el ingreso cuando
    // los locales comerciales valen menos por m² que la vivienda (bug real: ingreso $299.6M vs
    // $260.6M que reconstruía Mastermind con precios diferenciados).
    const tipReal = arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta
    const areaHabReal = mixHabReal.reduce((s: number, r: any) => s + (r.unidades || 0) * (r.m2Promedio || 0), 0)
    const superficieVendibleTotal = superficieVendibleReal || 0
    const superficieVendibleComercial = tipReal?.comercial && superficieVendibleTotal > areaHabReal
      ? Math.round(superficieVendibleTotal - areaHabReal)
      : 0
    const payload = {
      ...formData,
      costoTerrenoM2: m2t, costoTerreno,
      construccionM2: m2c, costoTotalConstruccion,
      superficieConstruida: c.superficieConstruida,
      superficieVendible: superficieVendibleReal,
      superficieVendibleComercial,
      // Zona 1 real que Construcción costeó (antes de sustituirla arriba por la del mix) —
      // Financiero la necesita para saber qué % de esa área realmente aprovecha el mix de
      // unidades y escalar el costo hacia abajo si aprovecha menos (ver escalarCostoPorMix).
      superficieVendibleConstruccion: c.superficieVendible,
      fichaLegal: pipe.legal.data?.fichaLegal,
      mercado: mercadoActual?.mercado,
      // Calibrado en Mastermind 1 ("Aplicar calibración y volver al pipeline") — si vienen,
      // Financiero debe anclar precioVentaM2/unidades a estos valores en vez de elegirlos
      // libremente, sin recalcular el diseño de Arquitectura/Construcción.
      precioVentaObjetivo: pipe.financiero.precioVentaObjetivo || undefined,
      unidadesObjetivo,
    }
    setPipe(p => ({ ...p, financiero: { ...p.financiero, status: 'running', data: null } }))
    try {
      const res = await authedFetch('/api/agentes/financiero', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, financiero: { ...p.financiero, status: 'done', data: json } }))

      // Assemble final result and save
      const fullResult = {
        proyecto,
        ...json,
        // Se sobrescriben precioM2Final/costoTotalTerreno con m2t/costoTerreno (los valores que
        // Financiero SÍ usó — ya incluyen el override manual y/o el precio calibrado en
        // Mastermind 1) — antes se guardaba t.bitacoraTerreno tal cual, el original SIN calibrar.
        // Bug real encontrado en producción: Mastermind 1 mostraba terreno calibrado a
        // $X/m², pero al reabrir Mastermind 2 (o esta misma pantalla) sobre el análisis ya
        // guardado, volvía a mostrar el precio crudo original — porque extractTerrenoContext lee
        // esta bitácora, no el override transitorio que solo vivía en pipe.terreno.overrideM2.
        bitacoraTerreno: { ...t.bitacoraTerreno, precioM2Final: m2t, costoTotalTerreno: costoTerreno },
        // Diseño resuelto por Arquitectura (envolvente, zonas, tipología) — sin esto,
        // app/analisis/page.tsx y Mastermind se quedan sin datos de diseño para análisis
        // nuevos (ver lib/analisis/bitacoraArquitectura.ts).
        bitacoraArquitectura: arquitecturaActual?.bitacoraArquitectura,
        // Mismo bug y mismo fix que bitacoraTerreno arriba, para costoPorM2Final/
        // costoTotalConstruccion — sin esto, reabrir Mastermind sobre el análisis guardado
        // revierte al costo de construcción crudo (Construcción original), no al calibrado en
        // Mastermind 1 (extractProyectoContext prioriza bc.costoPorM2Final sobre
        // financiero.costoTotalConstruccion). Se persiste también superficieVendibleReal (el
        // área vendible total que Financiero SÍ usó para ingresos) — antes solo existía en este
        // momento de la corrida en vivo y se perdía al guardar.
        bitacoraConstruccion: {
          ...c.bitacoraConstruccion,
          superficieVendible: superficieVendibleReal,
          costoPorM2Final: m2c,
          costoTotalConstruccion: costoTotalConstruccion,
        },
        fichaLegal: pipe.legal.data?.fichaLegal,
        mercado: mercadoActual?.mercado,
        fuentes: {
          legal: pipe.legal.data?.fuentes?.legal || [],
          mercado: mercadoActual?.fuentes?.mercado || [],
        },
      }
      localStorage.setItem('smt_analisis_data', JSON.stringify(fullResult))
      saveProyecto({ nombre: proyecto, datos: { ...fullResult, _inputData: formData }, flujo: 'A' })
        .then(r => { if (r.ok && r.id) localStorage.setItem('smt_proyecto_id', r.id) })
      // Ya NO redirige solo — el Análisis Financiero se queda visible en pantalla (Step 7) para
      // darle su peso antes de pasar al informe, en vez de saltar de un golpe. El usuario avanza
      // a mano con el botón "Ver reporte final" (ver irAlReporte más abajo).
    } catch {
      setPipe(p => ({ ...p, financiero: { ...p.financiero, status: 'error', data: null } }))
    }
  }

  // Camino corto salta directo a la propuesta ejecutiva (ya autosuficiente vía smt_analisis_data)
  // en vez de pasar por el dashboard completo de /analisis. Se dispara con el botón "Ver reporte
  // final" del Step 7, no automáticamente.
  const irAlReporte = () => {
    const destino = modoRapido ? '/propuesta' : '/analisis'
    router.push(`${destino}?proyecto=${encodeURIComponent(proyecto)}`)
  }

  // ── Camino corto: auto-disparar Construcción apenas está listo (misma condición que el botón
  // "Aprobar y continuar con Construcción", ya no exige Mercado — ver Parte 1 del pipeline).
  // Financiero YA NO se auto-dispara — el panel "Resumen: Costos e Ingresos" (Step 6, más abajo)
  // es una pausa funcional real: ahí se revisan/ajustan costo terreno, costo construcción, precio
  // de venta y unidades objetivo, más el panel de alertas, antes de aprobar Financiero a mano —
  // igual en Camino corto que en Flujo A normal.
  const autoConstruccionRef = useRef(false)
  useEffect(() => {
    if (!modoRapido || autoConstruccionRef.current) return
    if (pipe.legal.status === 'done' && pipe.arquitectura.status === 'done'
      && pipe.terreno.seleccionada !== null && pipe.arquitectura.seleccionada !== null
      && pipe.construccion.status === 'waiting') {
      autoConstruccionRef.current = true
      runConstruccion()
    }
  }, [modoRapido, pipe.legal.status, pipe.arquitectura.status, pipe.construccion.status, pipe.terreno.seleccionada, pipe.arquitectura.seleccionada])

  const efectivoTerrenoM2 = () => {
    const t = terrenoActual
    if (!t) return 0
    return pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2
  }
  const efectivoConstruccionM2 = () => {
    const c = construccionActual
    if (!c) return 0
    return pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2
  }

  // ── Progress ──
  // Orden: Terreno → (Legal + Mercado en paralelo, ambos corren apenas termina Terreno,
  // ninguno depende del otro) → Construcción (usa COS/CUS de Legal y demanda/absorción
  // de Mercado para no proponer más unidades de las que el mercado puede absorber) →
  // Financiero.
  const stepsDone = [
    pipe.terreno.status === 'done',
    pipe.legal.status === 'done',
    pipe.mercado.status === 'done',
    pipe.construccion.status === 'done',
    pipe.financiero.status === 'done',
  ].filter(Boolean).length
  const pct = (stepsDone / 5) * 100

  // Resumen en vivo — mismo motor que el checkpoint del Step 6 (calcularMastermindCore),
  // llamado aquí también para que el FAB de Mastermind se vaya llenando desde el arranque
  // del pipeline, no solo después de Construcción. Los extractores ya usan optional
  // chaining, así que devuelven ceros/defaults con gracia mientras no hay dato todavía.
  const coreInputsSidebar = mastermindCoreInputsActuales()
  const resumenSidebar = calcularMastermindCore(coreInputsSidebar)
  // calcularMastermindCore() usa un benchmark genérico de la industria como costo de
  // construcción cuando Construcción no ha corrido (ver motor.ts) — su margenBruto no es real
  // todavía en ese punto. calcularIngresos() en cambio no depende del costo de construcción, así
  // que es lo único honesto que el FAB puede mostrar antes de Costos (ver MastermindOverlay.tsx).
  const ingresoPreliminarSidebar = calcularIngresos({ proyecto: coreInputsSidebar.proyecto, mercado: coreInputsSidebar.mercado })
  // Fracción de los 6 agentes ya listos — alimenta el "crecimiento" de la barra de Mastermind
  // en el header (ver CockpitMastermindFab), no el % de la barra de progreso del pipeline (esa
  // sigue contando 5 pasos, ver stepsDone abajo).
  const agentesMastermindListos = [
    pipe.terreno.status, pipe.legal.status, pipe.mercado.status,
    pipe.arquitectura.status, pipe.construccion.status, pipe.financiero.status,
  ].filter(s => s === 'done').length

  // ─── Cockpit: estado por cuadrante (Fase 1 — bento-grid) ──────────────────
  // Deriva un estado visual de 5 valores a partir del pipe ya existente, sin tocar ninguna
  // lógica de orquestación — mismas condiciones que ya usaban los `&&` que gateaban cada
  // <section> (ver STEP 1-7 más abajo), solo pre-computadas aquí para controlar el tamaño
  // de la celda del grid en vez de mostrar/ocultar toda la sección.
  const estadoTerreno: CockpitEstado =
    pipe.terreno.status === 'done' ? 'listo' :
    pipe.terreno.status === 'error' ? 'error' :
    (pipe.ubicacion.status === 'running' || pipe.comparables.status === 'running' || pipe.terreno.status === 'running') ? 'corriendo' :
    'cola'

  const estadoLegal: CockpitEstado =
    pipe.legal.status === 'done' ? 'listo' :
    pipe.legal.status === 'error' ? 'error' :
    pipe.legal.status === 'running' ? 'corriendo' : 'cola'

  const estadoMercado: CockpitEstado =
    pipe.mercado.status === 'done' ? 'listo' :
    pipe.mercado.status === 'error' ? 'error' :
    (pipe.comparablesVenta.status === 'running' || pipe.mercado.status === 'running') ? 'corriendo' :
    'cola'

  const estadoArquitectura: CockpitEstado =
    pipe.arquitectura.status === 'done' ? 'listo' :
    pipe.arquitectura.status === 'error' ? 'error' :
    pipe.arquitectura.status === 'running' ? 'corriendo' : 'cola'

  // Mismo gate que hoy usa el STEP 5 para mostrar el botón "Aprobar y continuar" (línea del
  // <section> original) — replicado aquí para decidir el tamaño del cuadrante, no para
  // gatear el contenido interno (eso lo sigue haciendo el JSX original, sin cambios).
  const gateCostosListo = pipe.legal.status === 'done' && pipe.arquitectura.status === 'done'
    && pipe.terreno.seleccionada !== null && pipe.arquitectura.seleccionada !== null
  const estadoCostos: CockpitEstado =
    pipe.construccion.status === 'done' ? 'listo' :
    pipe.construccion.status === 'error' ? 'error' :
    pipe.construccion.status === 'running' ? 'corriendo' :
    gateCostosListo ? 'esperando_aprobacion' : 'cola'

  // Mismo gate que hoy usa el STEP 6 (antesala a Financiero).
  const gateFinancieroListo = pipe.construccion.status === 'done' && pipe.construccion.seleccionada !== null
    && pipe.mercado.status === 'done' && pipe.mercado.seleccionada !== null
  const estadoFinanciero: CockpitEstado =
    pipe.financiero.status === 'done' ? 'listo' :
    pipe.financiero.status === 'error' ? 'error' :
    pipe.financiero.status === 'running' ? 'corriendo' :
    gateFinancieroListo ? 'esperando_aprobacion' : 'cola'

  return (
    <div
      className={`${fraunces.variable} ${plexMono.variable} h-screen bg-[#0b1d3a] flex flex-col overflow-hidden`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    >
      {/* Header */}
      <header className="px-8 py-5 flex items-center gap-3 border-b border-white/10 bg-[#070f22]">
        <div className="w-8 h-8 rounded-lg bg-[#c9a227] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div className="shrink-0">
          <span className="text-[15px] font-medium text-white tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-white/40 tracking-[0.12em] uppercase">Pipeline de análisis</span>
        </div>
        <div className="flex-1 flex justify-center">
          <CockpitMastermindFab
            agentesListos={agentesMastermindListos}
            construccionLista={pipe.construccion.status === 'done'}
            ingresoPotencial={ingresoPreliminarSidebar.ingresoBrutoTotal > 0 ? ingresoPreliminarSidebar.ingresoBrutoTotal : null}
            margenBruto={resumenSidebar.utilidad.margenBruto}
            scoreFinanciero={pipe.financiero.data?.score?.total ?? null}
            onOpen={() => setMastermindAbierto(true)}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {modoRapido && (
            <div className="px-3 py-1.5 bg-[#B8860B] rounded-lg">
              <p className="text-[13px] font-bold text-white leading-tight whitespace-nowrap">⚡ Camino corto</p>
            </div>
          )}
          {proyecto && (
            <div className="px-3 py-1.5 bg-[#c9a227] rounded-lg">
              <p className="text-[10px] font-bold text-[#c9a227]/40 tracking-wide uppercase leading-none">Proyecto</p>
              <p className="text-[13px] font-bold text-white leading-tight">{proyecto}</p>
            </div>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-[#070f22] border-b border-white/10 px-8 py-2 flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#c9a227] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-semibold text-white/30 shrink-0 tabular-nums">
          {stepsDone} de 5 agentes
        </span>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-min" style={{ gridAutoFlow: 'dense' }}>

            {/* ══ TERRENO ══ */}
            {estadoTerreno === 'cola' ? (
              <QuadrantPlaceholder nombre="Agente de Valuación de Terreno" color={AGENTE_COLOR.terreno} />
            ) : (
            <CockpitQuadrant
              agente="terreno" nombre="Agente de Valuación de Terreno" color={AGENTE_COLOR.terreno}
              estado={estadoTerreno} expandido={expandido === 'terreno'} algoExpandido={expandido !== null}
              onToggle={() => setExpandido(e => e === 'terreno' ? null : 'terreno')}
              onRetry={() => runTerreno()}
            >
            <section>

              {pipe.ubicacion.status === 'running' && (
                <RunningCard
                  label="Preparando contexto de ubicación…"
                  hint="Obteniendo precio de zona y accesibilidad — el agente Terreno arranca al terminar"
                  color={AGENTE_COLOR.terreno}
                />
              )}

              {/* Comparables reales */}
              {pipe.comparables.status === 'running' && (
                <RunningCard label="Buscando referencias de mercado…" hint="Consultando Lamudi, Inmuebles24 y más portales en tiempo real" color={AGENTE_COLOR.terreno} />
              )}
              {pipe.comparables.status === 'done' && pipe.comparables.data.length > 0 && (
                <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] px-5 py-3">
                  <VerDetalle label={`Ver comparables encontrados (${pipe.comparables.data.length})`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-[#c9a227]" />
                      <p className="text-[12px] font-bold text-[#f4f0e6]">Referencias reales encontradas ({pipe.comparables.data.length})</p>
                      <span className="text-[10px] text-[#5f6a80] ml-auto">Serper · Google Search</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {pipe.comparables.data.map((c, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#F0FAF5] border border-[#5DCAA5]/30 rounded-xl px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#f4f0e6] truncate">{c.colonia || c.titulo}</p>
                            <p className="text-[10px] text-[#5f6a80]">{c.portal} · {c.superficieM2 ? `${c.superficieM2} m²` : '—'} · {c.distanciaRef}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            {c.precioM2 && <p className="text-[12px] font-bold text-[#f4f0e6]">${c.precioM2.toLocaleString()}/m²</p>}
                            {c.precioTotal && !c.precioM2 && <p className="text-[12px] font-bold text-[#f4f0e6]">${c.precioTotal.toLocaleString()}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#5f6a80] mt-2 italic">Estas referencias se pasan al Agente Terreno para calibrar la valuación.</p>
                  </VerDetalle>
                </div>
              )}

              {pipe.terreno.status === 'running' && (
                <RunningCard label="Agente Terreno analizando…" hint="Clasificando banda, aplicando factores de ajuste sobre referencias reales" color={AGENTE_COLOR.terreno} />
              )}

              {pipe.terreno.status === 'error' && (
                <ErrorCard label="Agente Terreno" onRetry={() => runTerreno()} />
              )}

              {pipe.terreno.status === 'done' && terrenoActual && (() => {
                const t = terrenoActual
                const ic = t.bitacoraTerreno?.indiceConfiabilidad
                const vp = t.bitacoraTerreno?.validacionPrecioSolicitado
                const tienePrecioSolicitado = Number(formData?.precioSolicitado || 0) > 0 && Number(formData?.superficie || 0) > 0
                const m2PrecioSolicitado = tienePrecioSolicitado ? Number(formData.precioSolicitado) / Number(formData.superficie) : 0
                const m2efectivo = pipe.terreno.usarPrecioSolicitado
                  ? m2PrecioSolicitado
                  : (pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2)
                return (
                  <DoneCard>
                    <SelectorCorridas
                      corridas={pipe.terreno.corridas}
                      seleccionada={pipe.terreno.seleccionada}
                      onSeleccionar={i => setPipe(p => ({ ...p, terreno: { ...p.terreno, seleccionada: i, overrideM2: '', usarPrecioSolicitado: false } }))}
                      resumen={(item) => (
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold text-[#f4f0e6]">Banda {item.bitacoraTerreno?.bandaTerreno} · {item.bitacoraTerreno?.nombreBanda}</p>
                          <p className="text-[10px] text-[#8b96ab]">${item.costoTerrenoM2?.toLocaleString('es-MX')}/m² · {fmt(item.costoTerreno)}</p>
                        </div>
                      )}
                    />
                    <div className="px-5 py-4 border-b border-[#2a3f5c] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-[11px] text-[#5f6a80]">Banda {t.bitacoraTerreno?.bandaTerreno} · {t.bitacoraTerreno?.nombreBanda}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SemaforoChip sem={ic?.semaforo} />
                      </div>
                    </div>

                    <div className="px-5 py-4 grid grid-cols-2 gap-3">
                      <EditableM2
                        label="Precio / m² terreno"
                        value={t.costoTerrenoM2}
                        override={pipe.terreno.usarPrecioSolicitado ? String(Math.round(m2PrecioSolicitado)) : pipe.terreno.overrideM2}
                        onOverride={v => setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: v, usarPrecioSolicitado: false } }))}
                        unit=" MXN/m²"
                      />
                      <div className="bg-[#132a4d] rounded-xl px-4 py-3">
                        <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Costo total terreno (MXN)</p>
                        <p className="text-[17px] font-bold text-[#f4f0e6] mt-0.5">
                          {fmt(m2efectivo * Number(formData?.superficie || 0))}
                        </p>
                        <p className="text-[10px] text-[#5f6a80]">{Number(formData?.superficie || 0).toLocaleString()} m²</p>
                      </div>
                    </div>

                    {tienePrecioSolicitado && (
                      <div className="px-5 pb-4 -mt-1">
                        <label className="flex items-start gap-2 bg-[#c9a227]/8 border border-[#c9a227]/50 rounded-xl px-3 py-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pipe.terreno.usarPrecioSolicitado}
                            onChange={e => setPipe(p => ({ ...p, terreno: { ...p.terreno, usarPrecioSolicitado: e.target.checked, overrideM2: '' } }))}
                            className="mt-0.5 accent-[#c9a227]"
                          />
                          <span className="text-[11px] text-[#ddc06a] leading-snug">
                            Usar el precio solicitado por el vendedor (<strong>{fmt(Number(formData.precioSolicitado))}</strong>) en vez del valor calculado por la IA (<strong>{fmt(t.costoTerreno)}</strong>).
                          </span>
                        </label>
                      </div>
                    )}

                    {/* ── Bitácora del cálculo ── */}
                    {t.bitacoraTerreno && (
                      <div className="border-t border-[#2a3f5c] px-5 py-4 flex flex-col gap-4">
                        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-widest">Bitácora del cálculo</p>

                        {/* Banda + justificación */}
                        <div className="bg-[#132a4d] rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-[#070f22] bg-[#c9a227] px-2 py-0.5 rounded-full">
                              Banda {t.bitacoraTerreno.bandaTerreno}
                            </span>
                            <span className="text-[11px] font-semibold text-[#f4f0e6]">{t.bitacoraTerreno.nombreBanda}</span>
                          </div>
                          <p className="text-[11px] text-[#8b96ab] leading-snug">{t.bitacoraTerreno.justificacionBanda}</p>
                          <p className="text-[10px] text-[#5f6a80] mt-1.5 font-medium">
                            Precio base referencia: <span className="text-[#f4f0e6]">${t.bitacoraTerreno.precioM2Referencia?.toLocaleString('es-MX')} MXN/m²</span>
                            {t.bitacoraTerreno.fuenteReferencia ? ` · ${t.bitacoraTerreno.fuenteReferencia}` : ''}
                          </p>
                        </div>

                        {/* Ajustes aplicados */}
                        {t.bitacoraTerreno.ajustes?.length > 0 && (
                          <div className="rounded-xl border border-[#2a3f5c] overflow-hidden">
                            <div className="px-4 py-2 bg-[#132a4d] border-b border-[#2a3f5c] flex items-center justify-between gap-2">
                              <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide">Factores aplicados ({t.bitacoraTerreno.ajustes.length})</p>
                            </div>
                            <div className="px-4 py-2.5 bg-[#132a4d]">
                              <VerDetalle label="Ver factores">
                                <div className="flex flex-col gap-0 -mx-4 -mt-2.5">
                                  {t.bitacoraTerreno.ajustes.map((a: any, i: number) => (
                                    <div key={i} className="px-4 py-2.5 border-t border-[#2a3f5c] flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-semibold text-[#f4f0e6] leading-tight">{a.concepto}</p>
                                        <p className="text-[10px] text-[#5f6a80] mt-0.5 leading-snug">{a.descripcion}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className={`text-[12px] font-bold ${String(a.factorAjuste).startsWith('+') ? 'text-[#0F6E56]' : 'text-[#DC2626]'}`}>
                                          {a.factorAjuste}
                                        </p>
                                        <p className="text-[10px] text-[#5f6a80]">
                                          {a.impactoM2 > 0 ? '+' : ''}{Number(a.impactoM2).toLocaleString('es-MX')}/m²
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </VerDetalle>
                            </div>
                            <div className="px-4 py-3 bg-[#c9a227]/8 flex items-center justify-between">
                              <p className="text-[11px] font-bold text-[#ddc06a]">Precio final ajustado</p>
                              <p className="text-[15px] font-black text-[#ddc06a]">
                                ${t.bitacoraTerreno.precioM2Final?.toLocaleString('es-MX')} MXN/m²
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Cálculo final — precio/m² × superficie = costo total del terreno */}
                        {t.bitacoraTerreno.costoTotalTerreno != null && (
                          <div className="bg-[#132a4d] rounded-xl px-4 py-3">
                            <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Cálculo final</p>
                            {t.bitacoraTerreno.formula && (
                              <p className="text-[11px] text-[#8b96ab] mb-2">{t.bitacoraTerreno.formula}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5f6a80]">Costo total terreno</span>
                              <p className="text-[16px] font-black text-[#ddc06a]">
                                ${t.bitacoraTerreno.costoTotalTerreno.toLocaleString('es-MX')} MXN
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Rango de valoración */}
                        {t.bitacoraTerreno.rangoValoracion && (
                          <div>
                            <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Rango de negociación (MXN/m²)</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[#132a4d] rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] text-[#5f6a80] uppercase tracking-wide">Mínimo</p>
                                <p className="text-[13px] font-bold text-[#f4f0e6]">${t.bitacoraTerreno.rangoValoracion.minimo?.toLocaleString()}/m²</p>
                              </div>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 8h8M9 5l3 3-3 3" stroke="#5f6a80" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              <div className="flex-1 bg-[#c9a227] rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] text-[#070f22]/70 uppercase tracking-wide">Calculado</p>
                                <p className="text-[13px] font-bold text-[#070f22]">${t.bitacoraTerreno.precioM2Final?.toLocaleString()}/m²</p>
                              </div>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 8h8M9 5l3 3-3 3" stroke="#5f6a80" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              <div className="flex-1 bg-[#132a4d] rounded-lg px-3 py-2 text-center">
                                <p className="text-[9px] text-[#5f6a80] uppercase tracking-wide">Máximo</p>
                                <p className="text-[13px] font-bold text-[#f4f0e6]">${t.bitacoraTerreno.rangoValoracion.maximo?.toLocaleString()}/m²</p>
                              </div>
                            </div>
                            {t.bitacoraTerreno.rangoValoracion.interpretacion && (
                              <p className="text-[10px] text-[#5f6a80] mt-1.5 leading-snug">{t.bitacoraTerreno.rangoValoracion.interpretacion}</p>
                            )}
                          </div>
                        )}

                        {/* Comparables */}
                        {t.bitacoraTerreno.fuentesComparables?.length > 0 ? (
                          <div>
                            <VerDetalle label={`Ver comparables encontrados (${t.bitacoraTerreno.fuentesComparables.length})`}>
                            <div className="flex flex-col gap-1.5">
                              {t.bitacoraTerreno.fuentesComparables.map((c: any, i: number) => {
                                const esWeb = c.origen === 'web_search'
                                return (
                                  <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${esWeb ? 'bg-[#F0FAF5] border border-[#5DCAA5]/30' : 'bg-[#132a4d] border border-dashed border-[#5f6a80]'}`}>
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${esWeb ? 'bg-[#c9a227]' : 'bg-[#5f6a80]'}`} />
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-semibold text-[#f4f0e6]">{c.colonia}</p>
                                        <p className="text-[10px] text-[#5f6a80]">
                                          {c.portal} · {c.superficie > 0 ? `${c.superficie?.toLocaleString()} m²` : '—'} · {c.distanciaKm > 0 ? `${c.distanciaKm} km` : '—'} · {c.fechaPublicacion}
                                        </p>
                                        <span className={`text-[9px] font-semibold tracking-wide uppercase ${esWeb ? 'text-[#c9a227]' : 'text-[#5f6a80]'}`}>
                                          {esWeb ? '● Encontrado en web' : '○ Estimado por modelo'}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-[13px] font-bold text-[#f4f0e6] shrink-0 ml-3">
                                      ${c.precioM2?.toLocaleString()}/m²
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                            </VerDetalle>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#5f6a80] italic">
                            Sin comparables directos encontrados — precio estimado por método paramétrico de banda.
                          </p>
                        )}
                      </div>
                    )}

                    {ic && (
                      <div className="border-t border-[#2a3f5c] px-5 py-3">
                        <p className="text-[11px] text-[#5f6a80] leading-snug">{ic.interpretacion}</p>
                        {ic.accionRecomendada && (
                          <p className="text-[11px] text-[#D97706] mt-1 font-medium">→ {ic.accionRecomendada}</p>
                        )}
                      </div>
                    )}

                    {vp?.aplica && (
                      <div className={`mx-5 mb-4 px-4 py-2.5 rounded-xl border text-[11px] font-medium ${
                        vp.semaforo === 'VERDE' ? 'bg-[#14301f] border-[#2f6b4f] text-[#0F6E56]' :
                        vp.semaforo === 'ROJO'  ? 'bg-[#2e1414] border-[#FECACA] text-[#F87171]' :
                        'bg-[#2e2510] border-[#FDE68A] text-[#FBBF24]'
                      }`}>
                        {vp.interpretacion}
                      </div>
                    )}

                    {/* ¿No estás de acuerdo con la banda, la vialidad, o conocés el precio real? Ajustar y re-correr solo Terreno — franja de ajuste entre el resultado y las preguntas */}
                    {t.bitacoraTerreno && (
                      <div className="border-t border-[#2a3f5c] px-5 py-4">
                        <AjustarSupuestosTerreno
                          bandaActual={t.bitacoraTerreno.bandaTerreno}
                          vialActual={formData?.clasificacionVial}
                          precioActual={formData?.precioSolicitado}
                          onAplicar={(banda, vial, precioSolicitado) => {
                            const bandaOriginal = String(t.bitacoraTerreno.bandaTerreno ?? '')
                            runTerreno({
                              ...formData,
                              clasificacionVial: vial,
                              precioSolicitado,
                              bandaOverride: banda !== bandaOriginal ? banda : undefined,
                            })
                          }}
                        />
                      </div>
                    )}

                    {/* Accesibilidad ORS — contexto usado por el agente */}
                    {pipe.ubicacion.status !== 'waiting' && (
                      <div className="border-t border-[#2a3f5c] px-5 py-4">
                        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-widest mb-3">
                          Accesibilidad · contexto enviado al agente
                        </p>
                        {!pipe.ubicacion.data || pipe.ubicacion.data.isocronas.length === 0 && !pipe.ubicacion.data.errorMsg ? (
                          <p className="text-[11px] text-[#5f6a80]">Sin coordenadas — no se enviaron datos de demanda al agente.</p>
                        ) : pipe.ubicacion.data.errorMsg ? (
                          <p className="text-[10px] text-[#FBBF24] font-mono bg-[#2e2510] px-3 py-2 rounded-lg">{pipe.ubicacion.data.errorMsg}</p>
                        ) : (
                          <div className="flex gap-2">
                            {pipe.ubicacion.data.isocronas.map(iso => (
                              <div key={iso.rango_min} className="flex-1 bg-[#132a4d] rounded-xl px-3 py-3 text-center">
                                <p className="text-[10px] text-[#5f6a80] font-semibold">{iso.rango_min} min</p>
                                <p className="text-[15px] font-black text-[#f4f0e6] mt-0.5">
                                  {iso.poblacion_alcanzada != null
                                    ? iso.poblacion_alcanzada >= 1_000_000
                                      ? `${(iso.poblacion_alcanzada / 1_000_000).toFixed(1)}M`
                                      : iso.poblacion_alcanzada >= 1_000
                                        ? `${(iso.poblacion_alcanzada / 1_000).toFixed(0)}k`
                                        : iso.poblacion_alcanzada.toLocaleString()
                                    : '—'}
                                </p>
                                <p className="text-[9px] text-[#5f6a80]">hab.</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Catastro — solo si el usuario proporcionó cuenta predial */}
                    {pipe.catastro.status !== 'waiting' && (
                      <div className="border-t border-[#2a3f5c] px-5 py-4">
                        <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-widest mb-3">
                          Catastro · verificación predial
                        </p>
                        {pipe.catastro.status === 'running' && (
                          <p className="text-[11px] text-[#5f6a80]">Consultando portal catastral…</p>
                        )}
                        {pipe.catastro.status === 'error' && (
                          <p className="text-[11px] text-[#DC2626]">No se pudo consultar el catastro — verifica el número de cuenta predial.</p>
                        )}
                        {pipe.catastro.status === 'done' && pipe.catastro.data && (() => {
                          const c = pipe.catastro.data
                          const isNL = c.estado === 'Nuevo León'
                          const isSinaloa = c.estado === 'Sinaloa'
                          return (
                            <div className="space-y-2">
                              <div className="flex gap-3">
                                <div className="flex-1 bg-[#132a4d] rounded-xl px-3 py-2.5">
                                  <p className="text-[9px] text-[#5f6a80] font-semibold uppercase tracking-wide">
                                    {isSinaloa ? 'Clave catastral' : 'Expediente'}
                                  </p>
                                  <p className="text-[12px] font-bold text-[#f4f0e6] font-mono mt-0.5">{c.expediente}</p>
                                </div>
                                {isNL && c.sinAdeudo !== null && (
                                  <div className="flex-1 bg-[#132a4d] rounded-xl px-3 py-2.5">
                                    <p className="text-[9px] text-[#5f6a80] font-semibold uppercase tracking-wide">Predial</p>
                                    <p className={`text-[12px] font-bold mt-0.5 ${c.sinAdeudo ? 'text-[#0F6E56]' : 'text-[#DC2626]'}`}>
                                      {c.sinAdeudo ? 'Al corriente' : `$${(c.adeudoTotal ?? 0).toLocaleString('es-MX')} adeudo`}
                                    </p>
                                  </div>
                                )}
                                {isSinaloa && (
                                  <div className="flex-1 bg-[#122a1c] border border-[#1D9E75]/30 rounded-xl px-3 py-2.5">
                                    <p className="text-[9px] text-[#5f6a80] font-semibold uppercase tracking-wide">Estado</p>
                                    <p className="text-[12px] font-bold text-[#0F6E56] mt-0.5">Registrada</p>
                                  </div>
                                )}
                              </div>
                              {c.ubicacion && (
                                <p className="text-[10px] text-[#8b96ab] font-mono">{c.ubicacion}</p>
                              )}
                              {c.valorCatastral ? (
                                <div className="flex gap-3">
                                  {c.valorSuelo && (
                                    <div className="flex-1 bg-[#132a4d] rounded-xl px-3 py-2.5">
                                      <p className="text-[9px] text-[#5f6a80] font-semibold uppercase tracking-wide">Valor suelo</p>
                                      <p className="text-[12px] font-bold text-[#f4f0e6] mt-0.5">${(c.valorSuelo ?? 0).toLocaleString('es-MX')}</p>
                                    </div>
                                  )}
                                  <div className="flex-1 bg-[#132a4d] rounded-xl px-3 py-2.5">
                                    <p className="text-[9px] text-[#5f6a80] font-semibold uppercase tracking-wide">Valor catastral</p>
                                    <p className="text-[13px] font-black text-[#ddc06a] mt-0.5">${c.valorCatastral.toLocaleString('es-MX')}</p>
                                  </div>
                                </div>
                              ) : isSinaloa ? (
                                <div className="flex items-start gap-2 bg-[rgba(59,91,219,0.12)] border border-[#3B5BDB]/40] rounded-xl px-3 py-2">
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-[#3B5BDB]">
                                    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5"/>
                                    <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    <circle cx="8" cy="5" r=".75" fill="currentColor"/>
                                  </svg>
                                  <p className="text-[10px] text-[#3B5BDB]">
                                    {c.nota ?? `Clave verificada. El certificado catastral con valor oficial está disponible en pagoscatastro.sinaloa.gob.mx${c.costoCertificado ? ` por $${c.costoCertificado.toLocaleString('es-MX')}` : ''}.`}
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2 bg-[#2e2510] border border-[#F0D070] rounded-xl px-3 py-2">
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-[#FBBF24]">
                                    <path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                    <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    <circle cx="8" cy="11.5" r=".75" fill="currentColor"/>
                                  </svg>
                                  <p className="text-[10px] text-[#FBBF24]">
                                    Portal IRCNL no disponible — valor catastral no consultado. El análisis continúa sin este dato.
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}

                  </DoneCard>
                )
              })()}
            </section>
            </CockpitQuadrant>
            )}

            {/* ══ STEP 2 — LEGAL (guardarraíl) ══ */}
            {/* Corre automático apenas Terreno termina — no espera "aprobar y continuar" */}
            {estadoLegal === 'cola' ? (
              <QuadrantPlaceholder nombre="Agente Legal" color={AGENTE_COLOR.legal} />
            ) : (
            <CockpitQuadrant
              agente="legal" nombre="Agente Legal" color={AGENTE_COLOR.legal}
              estado={estadoLegal} expandido={expandido === 'legal'} algoExpandido={expandido !== null}
              onToggle={() => setExpandido(e => e === 'legal' ? null : 'legal')}
              onRetry={runLegal}
            >
              <section>

                {pipe.legal.status === 'running' && (
                  <RunningCard label="Agente Legal…" hint="Verificando PDU, uso de suelo, factibilidades" color={AGENTE_COLOR.legal} />
                )}
                {pipe.legal.status === 'error' && (
                  <ErrorCard label="Agente Legal" onRetry={runLegal} />
                )}
                {pipe.legal.status === 'done' && pipe.legal.data && (() => {
                  const fl = pipe.legal.data.fichaLegal
                  return (
                    <DoneCard>
                      <div className="px-4 py-3 border-b border-[#2a3f5c] flex items-center gap-2">
                        <CheckIcon />
                        <button onClick={runLegal} className="ml-auto text-[10px] text-[#5f6a80] hover:text-[#c9a227] cursor-pointer">Re-correr</button>
                      </div>
                      <div className="px-4 py-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">Uso de suelo</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fl?.compatible ? 'bg-[#14301f] text-[#0F6E56]' : 'bg-[#2e1414] text-[#F87171]'}`}>
                            {fl?.compatible ? 'Compatible' : 'Requiere cambio'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">Nivel de riesgo</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fl?.nivelRiesgo === 'Bajo' ? 'bg-[#14301f] text-[#0F6E56]' :
                            fl?.nivelRiesgo === 'Medio' ? 'bg-[#2e2510] text-[#FBBF24]' :
                            'bg-[#2e1414] text-[#F87171]'
                          }`}>{fl?.nivelRiesgo || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">COS / CUS</span>
                          <span className="text-[11px] font-semibold text-[#f4f0e6]">{fl?.cos} / {fl?.cus}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">Alertas</span>
                          <span className="text-[11px] font-semibold text-[#f4f0e6]">{fl?.alertasLegales?.length || 0} alerta(s)</span>
                        </div>
                      </div>
                      <p className="px-4 pb-3 text-[10px] text-[#5f6a80] leading-snug">
                        Estos valores de COS/CUS alimentan los guardarraíles del paso de Construcción.
                      </p>
                    </DoneCard>
                  )
                })()}
              </section>
            </CockpitQuadrant>
            )}

            {/* ══ STEP 3 — MERCADO (antes de Construcción, para que Construcción sepa cuánto puede absorber el mercado) ══ */}
            {estadoMercado === 'cola' ? (
              <QuadrantPlaceholder nombre="Agente de Valuación de Mercado" color={AGENTE_COLOR.mercado} />
            ) : (
            <CockpitQuadrant
              agente="mercado" nombre="Agente de Valuación de Mercado" color={AGENTE_COLOR.mercado}
              estado={estadoMercado} expandido={expandido === 'mercado'} algoExpandido={expandido !== null}
              onToggle={() => setExpandido(e => e === 'mercado' ? null : 'mercado')}
              onRetry={() => runMercado()}
            >
              <section>

                {pipe.comparablesVenta.status === 'running' && (
                  <RunningCard label="Buscando referencias de venta…" hint="Consultando Lamudi, Inmuebles24 y más portales en tiempo real" color={AGENTE_COLOR.mercado} />
                )}
                {pipe.comparablesVenta.status === 'done' && pipe.comparablesVenta.data.length > 0 && (
                  <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] px-5 py-3">
                    <VerDetalle label={`Ver referencias de venta (${pipe.comparablesVenta.data.length})`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-[#c9a227]" />
                        <p className="text-[12px] font-bold text-[#f4f0e6]">Referencias reales de venta ({pipe.comparablesVenta.data.length})</p>
                        <span className="text-[10px] text-[#5f6a80] ml-auto">Serper · Google Search</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {pipe.comparablesVenta.data.map((c, i) => (
                          <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 ${c.sospechosoPorBanda ? 'bg-[#2e2510] border border-[#F59E0B]/40' : 'bg-[#F0FAF5] border border-[#5DCAA5]/30'}`}>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-[#f4f0e6] truncate">{c.nombre}</p>
                              <p className="text-[10px] text-[#5f6a80]">{c.tipologia || '—'} · {c.avanceObra || '—'}</p>
                              {c.sospechosoPorBanda && (
                                <p className="text-[9px] text-[#FBBF24] font-medium mt-0.5">Posible desface con tu banda de construcción — revisa si es representativo</p>
                              )}
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              {c.precioM2 && <p className={`text-[12px] font-bold ${c.sospechosoPorBanda ? 'text-[#FBBF24]' : 'text-[#f4f0e6]'}`}>${c.precioM2.toLocaleString()}/m²</p>}
                              {c.precioTotal && !c.precioM2 && <p className={`text-[12px] font-bold ${c.sospechosoPorBanda ? 'text-[#FBBF24]' : 'text-[#f4f0e6]'}`}>${c.precioTotal.toLocaleString()}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-[#5f6a80] mt-2 italic">Estas referencias se pasan al Agente Mercado para calibrar precio de venta y absorción.</p>
                    </VerDetalle>
                  </div>
                )}

                {pipe.mercado.status === 'running' && (
                  <RunningCard label="Agente Mercado…" hint="Buscando comparables, analizando absorción y pricing" color={AGENTE_COLOR.mercado} />
                )}
                {pipe.mercado.status === 'error' && (
                  <ErrorCard label="Agente Mercado" onRetry={runMercado} />
                )}
                {pipe.mercado.status === 'done' && mercadoActual && (() => {
                  const m = mercadoActual.mercado
                  return (
                    <DoneCard>
                      <SelectorCorridas
                        corridas={pipe.mercado.corridas}
                        seleccionada={pipe.mercado.seleccionada}
                        onSeleccionar={i => setPipe(p => ({ ...p, mercado: { ...p.mercado, seleccionada: i } }))}
                        resumen={(item) => (
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-semibold text-[#f4f0e6]">{item.mercado?.precioPromedioZona || '—'}/m²</p>
                            <p className="text-[10px] text-[#8b96ab]">{item.mercado?.absorcion || '—'} · {item.mercado?.demanda || '—'}</p>
                          </div>
                        )}
                      />
                      <div className="px-4 py-3 border-b border-[#2a3f5c] flex items-center gap-2">
                        <CheckIcon />
                      </div>
                      <div className="px-4 py-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">Precio/m² zona</span>
                          <span className="text-[11px] font-bold text-[#f4f0e6]">{m?.precioPromedioZona || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">Absorción</span>
                          <span className="text-[11px] font-semibold text-[#f4f0e6]">{m?.absorcion || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">Demanda</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m?.demanda === 'Alta' ? 'bg-[#14301f] text-[#0F6E56]' :
                            m?.demanda === 'Media' ? 'bg-[#2e2510] text-[#FBBF24]' :
                            'bg-[#2e1414] text-[#F87171]'
                          }`}>{m?.demanda || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8b96ab]">Plusvalía</span>
                          <span className="text-[11px] font-semibold text-[#ddc06a]">{m?.plusvalia || '—'}</span>
                        </div>
                      </div>

                      <div className="border-t border-[#2a3f5c] px-4 py-3">
                        <AjustarSupuestosMercado
                          precioVentaActual={pipe.mercado.overridePrecioVenta}
                          absorcionActual={pipe.mercado.overrideAbsorcion}
                          onAplicar={(precio, absorcion) => runMercado({ precioVentaObjetivo: precio, absorcionObjetivoManual: absorcion })}
                        />
                      </div>
                    </DoneCard>
                  )
                })()}
              </section>
            </CockpitQuadrant>
            )}

            {/* ══ STEP 4 — ARQUITECTURA (corre automático apenas Legal termina, en paralelo con
                Mercado — diseña a la máxima capacidad legal, sin achicar por absorción) ══ */}
            {estadoArquitectura === 'cola' ? (
              <QuadrantPlaceholder nombre="Agente de Arquitectura" color={AGENTE_COLOR.arquitectura} />
            ) : (
            <CockpitQuadrant
              agente="arquitectura" nombre="Agente de Arquitectura" color={AGENTE_COLOR.arquitectura}
              estado={estadoArquitectura} expandido={expandido === 'arquitectura'} algoExpandido={expandido !== null}
              onToggle={() => setExpandido(e => e === 'arquitectura' ? null : 'arquitectura')}
              onRetry={() => runArquitectura()}
            >
              <section>

                {pipe.arquitectura.status === 'running' && (
                  <RunningCard label="Agente Arquitectura…" hint="Calculando envolvente legal, zonas y tipología de unidades" color={AGENTE_COLOR.arquitectura} />
                )}
                {pipe.arquitectura.status === 'error' && (
                  <ErrorCard label="Agente Arquitectura" onRetry={() => runArquitectura()} />
                )}
                {pipe.arquitectura.status === 'done' && arquitecturaActual && (() => {
                  const arq = arquitecturaActual
                  const ba = arq.bitacoraArquitectura
                  const tip = ba?.tipologiaPropuesta
                  const zonas = ba?.desgloseZonas
                  const eficiencia = arq.superficieConstruida > 0
                    ? `${Math.round((arq.superficieVendible / arq.superficieConstruida) * 100)}%`
                    : '—'
                  const mostrarLocales = (formData?.tiposDesarrollo ?? []).some((t: string) => t === 'comercial' || t === 'mixto')
                  return (
                    <DoneCard>
                      <SelectorCorridas
                        corridas={pipe.arquitectura.corridas}
                        seleccionada={pipe.arquitectura.seleccionada}
                        onSeleccionar={i => setPipe(p => ({ ...p, arquitectura: { ...p.arquitectura, seleccionada: i } }))}
                        resumen={(item) => (
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-semibold text-[#f4f0e6]">{item.superficieConstruida?.toLocaleString()} m² · {item.bitacoraArquitectura?.tipologiaPropuesta?.niveles ?? '—'} niv.</p>
                            <p className="text-[10px] text-[#8b96ab]">{item.bitacoraArquitectura?.tipologiaPropuesta?.habitacional?.totalDepartamentos ?? '—'} unidades</p>
                          </div>
                        )}
                      />
                      <div className="px-5 py-4 border-b border-[#2a3f5c] flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-[11px] text-[#5f6a80]">{arq.superficieConstruida?.toLocaleString()} m² construidos</span>
                      </div>

                      {ba && (
                        <div className="px-5 pt-4 pb-2 grid grid-cols-4 gap-2">
                          {[
                            { label: 'COS', val: ba.cosEstimado, hint: 'Huella máxima' },
                            { label: 'CUS', val: ba.cusEstimado, hint: 'Superficie total' },
                            { label: 'Eficiencia', val: eficiencia, hint: 'Área vendible / total' },
                            { label: 'Área libre', val: `${ba.areaLibreYVerde?.m2?.toLocaleString() ?? '—'} m²`, hint: (ba.areaLibreYVerde?.porcentajeLote ?? '') + ' del lote' },
                          ].map(item => (
                            <div key={item.label} className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                              <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">{item.label}</p>
                              <p className="text-[15px] font-bold text-[#f4f0e6] mt-0.5">{item.val}</p>
                              <p className="text-[9px] text-[#5f6a80] mt-0.5 leading-tight">{item.hint}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <RangoConstruccionCard
                        envolventeCalculada={ba?.envolventeCalculada}
                        superficieConstruida={arq.superficieConstruida}
                        validacion={ba?.validacionSuperficieConstruida}
                      />

                      {zonas && zonas.length > 0 && (
                        <div className="px-5 pb-3">
                          <VerDetalle label={`Ver desglose de áreas por zona (${zonas.length})`}>
                            <div className="rounded-xl border border-[#2a3f5c] overflow-hidden">
                              <div className="grid grid-cols-[2fr_1fr_1fr] bg-[#2a3f5c] px-3 py-1.5">
                                {['Zona', 'm²', 'Participación'].map(h => (
                                  <span key={h} className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wider">{h}</span>
                                ))}
                              </div>
                              {zonas.map((z: any, i: number) => (
                                <div key={i} className={`grid grid-cols-[2fr_1fr_1fr] px-3 py-2 ${i % 2 === 0 ? 'bg-[#132a4d]' : 'bg-[#0f1f3a]'} border-t border-[#2a3f5c]`}>
                                  <div>
                                    <p className="text-[11px] font-semibold text-[#f4f0e6]">{z.zona}</p>
                                    <p className="text-[9px] text-[#5f6a80] leading-tight">{z.concepto}</p>
                                  </div>
                                  <span className="text-[11px] text-[#8b96ab] self-center">{z.m2?.toLocaleString()} m²</span>
                                  <span className="text-[11px] text-[#8b96ab] self-center">{z.participacion}</span>
                                </div>
                              ))}
                            </div>
                          </VerDetalle>
                        </div>
                      )}

                      {/* Tipología propuesta */}
                      {tip && (
                        <div className="px-5 pb-4 flex flex-col gap-3 border-t border-[#2a3f5c] pt-4">
                          <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-widest">Tipología propuesta</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                              <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Niveles</p>
                              <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{tip.niveles ?? '—'}</p>
                            </div>
                            {tip.habitacional && (
                              <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                                <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Departamentos</p>
                                <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{tip.habitacional.totalDepartamentos}</p>
                              </div>
                            )}
                            {tip.comercial && (
                              <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                                <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Locales</p>
                                <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{tip.comercial.totalLocales} · {tip.comercial.niveles} niv.</p>
                              </div>
                            )}
                            <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                              <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Amenidades</p>
                              <p className="text-[14px] font-bold text-[#f4f0e6] mt-0.5">{AMENIDADES_NIVEL_LABELS[String(tip.tamanoAmenidades)] ?? '—'}</p>
                            </div>
                          </div>
                          {/* Bocetos — aquí es donde de verdad se ve si la tipología que
                              resolvió Arquitectura tiene sentido, antes de esperar hasta el
                              análisis final guardado. Elevación (apilamiento de niveles) +
                              planta (huella sobre el lote, estacionamiento, área libre). */}
                          <div>
                            <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wider mb-1.5">Elevación</p>
                            <BocetoVolumetria tipologia={tip} />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wider mb-1.5">Vista en planta (aérea)</p>
                            <VistaAereaTerreno
                              superficieTerreno={Number(formData?.superficie || 0)}
                              superficieConstruida={arq.superficieConstruida}
                              niveles={tip.niveles}
                              desgloseZonas={zonas}
                              areaLibreYVerde={ba?.areaLibreYVerde}
                            />
                          </div>
                          <p className="text-[9px] text-[#5f6a80] italic">Bocetos ilustrativos a partir del programa propuesto — no sustituyen un plano arquitectónico ni asumen distribución real por nivel.</p>
                          {tip.habitacional?.mix && tip.habitacional.mix.length > 0 && (
                            <div className="rounded-xl border border-[#2a3f5c] overflow-hidden">
                              <div className="grid grid-cols-3 bg-[#2a3f5c] px-3 py-1.5">
                                {['Tipo', 'Unidades', 'm² prom.'].map(h => (
                                  <span key={h} className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wider">{h}</span>
                                ))}
                              </div>
                              {tip.habitacional.mix.map((row: any, i: number) => (
                                <div key={i} className={`grid grid-cols-3 px-3 py-2 ${i % 2 === 0 ? 'bg-[#132a4d]' : 'bg-[#0f1f3a]'} border-t border-[#2a3f5c]`}>
                                  <span className="text-[11px] font-semibold text-[#f4f0e6]">{row.tipo}</span>
                                  <span className="text-[11px] text-[#8b96ab]">{row.unidades}</span>
                                  <span className="text-[11px] text-[#8b96ab]">{row.m2Promedio} m²</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {tip.fijadoManualmente?.length > 0 && (
                            <p className="text-[9px] text-[#5f6a80]">Fijado manualmente: {tip.fijadoManualmente.join(', ')}</p>
                          )}
                          <AjustarSupuestosArquitectura
                            nivelesActual={tip.niveles}
                            totalDeptosActual={tip.habitacional?.totalDepartamentos}
                            totalLocalesActual={tip.comercial?.totalLocales}
                            amenidadesNivelActual={tip.tamanoAmenidades}
                            mostrarLocales={mostrarLocales}
                            onAplicar={(niveles, totalDeptos, totalLocales, amenidadesNivel) => runArquitectura({
                              nivelesOverride: niveles || undefined,
                              totalDeptosOverride: totalDeptos || undefined,
                              totalLocalesOverride: totalLocales || undefined,
                              amenidadesNivelOverride: amenidadesNivel !== String(tip.tamanoAmenidades ?? '') ? amenidadesNivel : undefined,
                            })}
                          />
                        </div>
                      )}

                      {/* Alternativa a "Ajustar parámetros": en vez de pedirle a la IA que
                          rediseñe, el usuario arma su propio programa de unidades (sin IA,
                          lib/estimador) y lo agrega como una corrida más al selector de arriba. */}
                      <div className="px-5 pb-4 border-t border-[#2a3f5c] pt-4">
                        {!mostrarArquitecturaManual ? (
                          <button
                            onClick={() => setMostrarArquitecturaManual(true)}
                            className="w-full flex items-center justify-between gap-2 bg-[#c9a227] hover:bg-[#ddc06a] text-[#070f22] rounded-xl px-4 py-3 transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-2 text-[12px] font-semibold">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              Definir mi programa de unidades manualmente
                            </span>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        ) : (
                          <div className="bg-[#132a4d] rounded-xl px-4 py-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold text-[#f4f0e6]">Definir mi programa de unidades</p>
                              <button onClick={() => setMostrarArquitecturaManual(false)} className="text-[11px] text-[#5f6a80] hover:text-[#f4f0e6] cursor-pointer">
                                Cancelar
                              </button>
                            </div>
                            <ArquitecturaInteractiva
                              sTerreno={Number(formData?.superficie || 0)}
                              cosStr={pipe.legal.data?.fichaLegal?.cos}
                              cusStr={pipe.legal.data?.fichaLegal?.cus}
                              onContinuar={(resultado) => {
                                setPipe(p => ({ ...p, arquitectura: { ...p.arquitectura, corridas: [...p.arquitectura.corridas, resultado], seleccionada: p.arquitectura.corridas.length } }))
                                setMostrarArquitecturaManual(false)
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </DoneCard>
                  )
                })()}
              </section>
            </CockpitQuadrant>
            )}

            {/* ══ STEP 5 — CONSTRUCCIÓN (costea el diseño que ya aprobó Arquitectura) ══ */}
            {/* Exige selección (no solo "done") en Terreno y Arquitectura — con "Ajustar
                parámetros" puede haber varias corridas y Construcción necesita saber cuál usar.
                Ya NO exige Mercado: construccion/route.ts nunca lee ese dato (verificado), el
                requisito era artificial y frenaba Construcción sin necesidad — Mercado sigue
                siendo obligatorio más adelante, para Financiero (ver Step 6 abajo). El gate
                original (legal+arquitectura done, ambos seleccionados) ahora vive en
                gateCostosListo, arriba, para decidir el tamaño del cuadrante — el contenido
                interno de abajo no cambió. */}
            {estadoCostos === 'cola' ? (
              <QuadrantPlaceholder nombre="Agente de Costos de Construcción" color={AGENTE_COLOR.construccion} />
            ) : (
            <CockpitQuadrant
              agente="construccion" nombre="Agente de Costos de Construcción" color={AGENTE_COLOR.construccion}
              estado={estadoCostos} expandido={expandido === 'construccion'} algoExpandido={expandido !== null}
              onToggle={() => setExpandido(e => e === 'construccion' ? null : 'construccion')}
              onRetry={runConstruccion}
            >
              <section>

                {/* El diseño (niveles/mix/zonas) ya lo resolvió Arquitectura — sea vía IA o
                    manual, Construcción siempre lo costea vía IA. Ya no hay un modo
                    "definir mi programa" aquí (se movió a Arquitectura). */}
                {pipe.construccion.status === 'waiting' && (
                  <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] p-4 mb-3">
                    <button
                      onClick={() => runConstruccion()}
                      className="w-full bg-[#c9a227] text-[#070f22] rounded-xl py-3 text-[13px] font-semibold hover:bg-[#ddc06a] transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      Aprobar y continuar con Construcción
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                )}

                {pipe.construccion.status === 'running' && (
                  <RunningCard label="Agente de Costos de Construcción analizando…" hint="Consultando índices CMIC, calculando partidas y materiales principales" color={AGENTE_COLOR.construccion} />
                )}

                {pipe.construccion.status === 'error' && (
                  <ErrorCard label="Agente de Costos de Construcción" onRetry={runConstruccion} />
                )}

                {pipe.construccion.status === 'done' && construccionActual && (() => {
                  const c = construccionActual
                  const ic = c.bitacoraConstruccion?.indiceConfiabilidad
                  const desglose = c.bitacoraConstruccion?.desgloseConstruccion
                  const parametricoM2 = BANDA_CONSTRUCCION_PARAMETRICO_MXN_M2[String(c.bitacoraConstruccion?.bandaElegida)]
                  const usaOverrideConstruccion = pipe.construccion.overrideM2 !== '' || (pipe.construccion.usarParametricoZona && !!parametricoM2)
                  const m2efectivo = pipe.construccion.usarParametricoZona && parametricoM2
                    ? parametricoM2
                    : (pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2)
                  const totalCons = usaOverrideConstruccion ? m2efectivo * (c.superficieConstruida || 0) : c.costoTotalConstruccion
                  return (
                    <DoneCard>
                      <SelectorCorridas
                        corridas={pipe.construccion.corridas}
                        seleccionada={pipe.construccion.seleccionada}
                        onSeleccionar={i => setPipe(p => ({ ...p, construccion: { ...p.construccion, seleccionada: i, overrideM2: '', usarParametricoZona: false } }))}
                        resumen={(item) => (
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-semibold text-[#f4f0e6]">Banda {item.bitacoraConstruccion?.bandaElegida} · {item.superficieConstruida?.toLocaleString()} m²</p>
                            <p className="text-[10px] text-[#8b96ab]">{fmt(item.costoTotalConstruccion)}</p>
                          </div>
                        )}
                      />
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-[#2a3f5c] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckIcon />
                          <span className="text-[11px] text-[#5f6a80]">Banda {c.bitacoraConstruccion?.bandaElegida} · {c.superficieConstruida?.toLocaleString()} m² brutos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SemaforoChip sem={ic?.semaforo} />
                        </div>
                      </div>

                      {/* Zona breakdown table */}
                      {desglose?.zonas && desglose.zonas.length > 0 && (
                        <div className="px-5 pb-3">
                          <VerDetalle label={`Ver desglose por zona (${desglose.zonas.length})`}>
                            <div className="rounded-xl border border-[#2a3f5c] overflow-hidden">
                              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] bg-[#2a3f5c] px-3 py-1.5">
                                {['Zona', 'm²', 'Costo/m²', 'Total'].map(h => (
                                  <span key={h} className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wider">{h}</span>
                                ))}
                              </div>
                              {desglose.zonas.map((z: any, i: number) => (
                                <div key={i} className={`grid grid-cols-[2fr_1fr_1fr_1fr] px-3 py-2 ${i % 2 === 0 ? 'bg-[#132a4d]' : 'bg-[#0f1f3a]'} border-t border-[#2a3f5c]`}>
                                  <div>
                                    <p className="text-[11px] font-semibold text-[#f4f0e6]">{z.zona}</p>
                                    <p className="text-[9px] text-[#5f6a80] leading-tight">{z.concepto}</p>
                                  </div>
                                  <span className="text-[11px] text-[#8b96ab] self-center">{z.m2?.toLocaleString()} m²</span>
                                  <div className="self-center">
                                    <span className="text-[11px] text-[#8b96ab]">${z.costoM2?.toLocaleString()}</span>
                                    <span className="text-[9px] text-[#5f6a80] block">{z.factorRespectoBanda}</span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-[#f4f0e6] self-center">{fmt(z.costoTotal)}</span>
                                </div>
                              ))}
                              {desglose.areaVerdeYLibre?.costoUrbanizacion > 0 && (
                                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] px-3 py-2 bg-[#c9a227]/8 border-t border-[#2a3f5c]">
                                  <div>
                                    <p className="text-[11px] font-semibold text-[#ddc06a]">Área verde / urbanización</p>
                                    <p className="text-[9px] text-[#5f6a80] leading-tight">{desglose.areaVerdeYLibre.descripcion?.split(':')[0]}</p>
                                  </div>
                                  <span className="text-[11px] text-[#8b96ab] self-center">{desglose.areaVerdeYLibre.m2?.toLocaleString()} m²</span>
                                  <span className="text-[11px] text-[#8b96ab] self-center">${desglose.areaVerdeYLibre.costoUrbanizacionM2?.toLocaleString()}</span>
                                  <span className="text-[11px] font-semibold text-[#ddc06a] self-center">{fmt(desglose.areaVerdeYLibre.costoUrbanizacion)}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-[9px] text-[#5f6a80] mt-1.5">Área vendible: {c.superficieVendible?.toLocaleString() || desglose.zonas[0]?.m2?.toLocaleString()} m² — diseño fijado por Arquitectura</p>
                          </VerDetalle>
                        </div>
                      )}

                      {/* Desglose por partidas + materiales principales — mismo contenido que ya
                          muestra el modal de bitácora en /analisis/page.tsx (líneas 676-732),
                          portado aquí para que el cockpit sea el lugar único de detalle sin tener
                          que saltar a /analisis. Mismo dato (c.bitacoraConstruccion), sin recálculo. */}
                      {(c.bitacoraConstruccion?.desglosePorPartidas?.length > 0 || c.bitacoraConstruccion?.materialesPrincipales?.length > 0) && (
                        <div className="px-5 pb-3">
                          <VerDetalle label="Ver desglose por partidas y materiales">
                            {c.bitacoraConstruccion?.desglosePorPartidas?.length > 0 && (() => {
                              const partidas = c.bitacoraConstruccion.desglosePorPartidas
                              const maxPct = Math.max(...partidas.map((p: any) => p.porcentaje))
                              return (
                                <div className="mb-3">
                                  <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Desglose por partidas</p>
                                  <div className="bg-[#132a4d] border border-[#2a3f5c] rounded-xl overflow-hidden">
                                    {partidas.map((p: any, i: number) => (
                                      <div key={i} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-[#2a3f5c]' : ''}`}>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <p className="text-[11px] font-semibold text-[#f4f0e6] shrink-0">{p.partida}</p>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[9px] font-bold text-[#5f6a80]">{p.porcentaje}%</span>
                                            <span className="text-[11px] font-bold text-[#c9a227]">${p.costoPorM2?.toLocaleString('es-MX')}/m²</span>
                                          </div>
                                        </div>
                                        <div className="relative h-1.5 bg-[#2a3f5c] rounded-full mb-1">
                                          <div className="h-full bg-[#c9a227] rounded-full" style={{ width: `${(p.porcentaje / maxPct) * 100}%` }} />
                                        </div>
                                        <p className="text-[9px] text-[#5f6a80] leading-snug">{p.descripcion}</p>
                                      </div>
                                    ))}
                                    <div className="bg-[#c9a227]/8 px-3 py-2.5 flex items-center justify-between border-t border-[#2a3f5c]">
                                      <span className="text-[10px] font-bold text-[#8b96ab]">Total (100%)</span>
                                      <span className="text-[12px] font-black text-[#ddc06a]">${c.bitacoraConstruccion.costoPorM2Final?.toLocaleString('es-MX')}/m²</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}

                            {c.bitacoraConstruccion?.materialesPrincipales?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-2">Materiales principales</p>
                                <div className="border border-[#2a3f5c] rounded-xl overflow-hidden">
                                  <div className="bg-[#132a4d] px-3 py-1.5 grid grid-cols-4 gap-2 border-b border-[#2a3f5c]">
                                    <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wide col-span-2">Material</p>
                                    <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wide text-right">Cant./m²</p>
                                    <p className="text-[9px] font-bold text-[#5f6a80] uppercase tracking-wide text-right">$/m²</p>
                                  </div>
                                  {c.bitacoraConstruccion.materialesPrincipales.map((m: any, i: number) => (
                                    <div key={i} className={`px-3 py-2 grid grid-cols-4 gap-2 items-center ${i % 2 === 0 ? 'bg-[#132a4d]' : 'bg-[#0f1f3a]'} ${i < c.bitacoraConstruccion.materialesPrincipales.length - 1 ? 'border-b border-[#2a3f5c]' : ''}`}>
                                      <div className="col-span-2">
                                        <p className="text-[11px] font-semibold text-[#f4f0e6]">{m.material}</p>
                                        {m.nota && <p className="text-[9px] text-[#5f6a80]">{m.nota}</p>}
                                      </div>
                                      <p className="text-[11px] text-[#8b96ab] text-right">{m.cantidadPorM2} {m.unidad}</p>
                                      <p className="text-[11px] font-bold text-[#c9a227] text-right">${m.costoPorM2?.toLocaleString('es-MX')}</p>
                                    </div>
                                  ))}
                                  <div className="px-3 py-1.5 bg-[#132a4d] border-t border-[#2a3f5c]">
                                    <p className="text-[9px] text-[#5f6a80] italic">Costos referenciales. Validar con proveedores locales antes de presupuestar.</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </VerDetalle>
                        </div>
                      )}

                      {/* Costo ponderado + total */}
                      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                        <EditableM2
                          label="Costo ponderado / m²"
                          value={c.construccionM2}
                          override={pipe.construccion.usarParametricoZona && parametricoM2 ? String(parametricoM2) : pipe.construccion.overrideM2}
                          onOverride={v => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: v, usarParametricoZona: false } }))}
                        />
                        <div className="bg-[#132a4d] rounded-xl px-4 py-3">
                          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Costo total directo</p>
                          <p className="text-[17px] font-bold text-[#f4f0e6] mt-0.5">{fmt(totalCons)}</p>
                          <p className="text-[10px] text-[#5f6a80]">Suma ponderada por zona</p>
                        </div>
                      </div>

                      {parametricoM2 && (
                        <div className="px-5 pb-4 -mt-1">
                          <label className="flex items-start gap-2 bg-[#c9a227]/8 border border-[#c9a227]/50 rounded-xl px-3 py-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pipe.construccion.usarParametricoZona}
                              onChange={e => setPipe(p => ({ ...p, construccion: { ...p.construccion, usarParametricoZona: e.target.checked, overrideM2: '' } }))}
                              className="mt-0.5 accent-[#c9a227]"
                            />
                            <span className="text-[11px] text-[#ddc06a] leading-snug">
                              Usar el costo paramétrico promedio de Banda {c.bitacoraConstruccion?.bandaElegida} (<strong>${parametricoM2.toLocaleString('es-MX')}/m²</strong>) en vez del calculado por la IA (<strong>${c.construccionM2.toLocaleString('es-MX')}/m²</strong>).
                            </span>
                          </label>
                        </div>
                      )}

                      {ic && (
                        <div className="px-5 pb-3">
                          <p className="text-[11px] text-[#5f6a80] leading-snug">{ic.interpretacion}</p>
                          {ic.accionRecomendada && (
                            <p className="text-[11px] text-[#D97706] mt-1 font-medium">→ {ic.accionRecomendada}</p>
                          )}
                        </div>
                      )}

                    </DoneCard>
                  )
                })()}

              </section>
            </CockpitQuadrant>
            )}

            {/* ══ FINANCIERO — fusiona STEP 6 (antesala/checkpoint) y STEP 7 (agente) en un
                solo cuadrante, porque ambos son estados sucesivos del mismo agente Financiero. ══ */}
            {estadoFinanciero === 'cola' ? (
              <QuadrantPlaceholder nombre="Agente del Plan Financiero" color={AGENTE_COLOR.financiero} />
            ) : (
            <CockpitQuadrant
              agente="financiero" nombre="Agente del Plan Financiero" color={AGENTE_COLOR.financiero}
              estado={estadoFinanciero} expandido={expandido === 'financiero'} algoExpandido={expandido !== null}
              onToggle={() => setExpandido(e => e === 'financiero' ? null : 'financiero')}
              onRetry={runFinanciero}
            >
            {/* ══ STEP 6 — RESUMEN: COSTOS E INGRESOS (antesala a Financiero) ══ */}
            {/* Mismo motor que Mastermind 1 (calcularMastermindCore) leyendo el pipeline en vivo
                — siempre refleja lo que Financiero va a usar, sea el dato crudo de los agentes
                o lo calibrado a mano en Mastermind 1 (ver mastermindCoreInputsActuales arriba).
                Exige Mercado explícito (antes lo garantizaba de rebote el viejo gate de
                Construcción, que ya no espera a Mercado) — Financiero lee pipe.mercado directo. */}
            {pipe.construccion.status === 'done' && pipe.construccion.seleccionada !== null && pipe.financiero.status === 'waiting'
              && pipe.mercado.status === 'done' && pipe.mercado.seleccionada !== null && (() => {
              const coreInputs = mastermindCoreInputsActuales()
              const resumen = calcularMastermindCore(coreInputs)
              const spreadBajo = resumen.spreadVentaConstruccion !== null && resumen.spreadVentaConstruccion < 1.6
              const hayCalibracion = pipe.terreno.overrideM2 !== '' || pipe.construccion.overrideM2 !== ''
                || !!pipe.financiero.precioVentaObjetivo || !!pipe.financiero.unidadesObjetivo
              // Valores "crudos" (sin override) para el comparativo tachado de EditableM2 — el
              // mismo snapshot que usa mastermindCoreInputsActuales, pero sin aplicarle overrides.
              const snapshotRaw = construirSnapshotAnalisis()
              const mercadoRaw = { ...DEFAULTS.mercado, ...extractMercadoContext(snapshotRaw) }
              const proyectoRaw = { ...DEFAULTS.proyecto, ...extractProyectoContext(snapshotRaw) }
              const restablecerTodo = () => setPipe(p => ({
                ...p,
                terreno: { ...p.terreno, overrideM2: '' },
                construccion: { ...p.construccion, overrideM2: '' },
                financiero: { ...p.financiero, precioVentaObjetivo: '', unidadesObjetivo: '' },
              }))
              return (
                <>
                  <DoneCard>
                    <div className="px-5 py-4 border-b border-[#2a3f5c] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-[11px] text-[#5f6a80]">Revisa y ajusta antes de correr el plan financiero completo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hayCalibracion && (
                          <>
                            <span className="text-[10px] font-bold text-[#c9a227] bg-[#c9a227]/8 border border-[#c9a227]/40 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              ● Ajustado
                            </span>
                            <button onClick={restablecerTodo} className="text-[11px] font-semibold text-[#5f6a80] hover:text-[#8b96ab] underline underline-offset-2">
                              Restablecer
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <EditableM2
                        label="Costo terreno"
                        value={Math.round(terrenoActual?.costoTerrenoM2 ?? coreInputs.terreno.costoTerrenoM2)}
                        override={pipe.terreno.overrideM2}
                        onOverride={v => setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: v } }))}
                      />
                      <EditableM2
                        label="Costo construcción"
                        value={Math.round(construccionActual?.construccionM2 ?? 0)}
                        override={pipe.construccion.overrideM2}
                        onOverride={v => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: v } }))}
                      />
                      <EditableM2
                        label="Precio de venta"
                        value={Math.round(mercadoRaw.precioVentaDepasM2)}
                        override={pipe.financiero.precioVentaObjetivo}
                        onOverride={v => setPipe(p => ({ ...p, financiero: { ...p.financiero, precioVentaObjetivo: v } }))}
                      />
                      <div className="rounded-xl px-3 py-2.5 text-center" style={{ backgroundColor: resumen.utilidad.margenBruto >= 12 ? '#14301f' : '#2e1414' }}>
                        <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: resumen.utilidad.margenBruto >= 12 ? '#0F6E56' : '#F87171' }}>Margen bruto</p>
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: resumen.utilidad.margenBruto >= 12 ? '#0F6E56' : '#F87171' }}>{resumen.utilidad.margenBruto.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <EditableM2
                        label="Unidades objetivo"
                        value={Math.round(proyectoRaw.unidadesHabitacionales)}
                        override={pipe.financiero.unidadesObjetivo}
                        onOverride={v => setPipe(p => ({ ...p, financiero: { ...p.financiero, unidadesObjetivo: v } }))}
                        unit="uds"
                        prefix=""
                      />
                      <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Costo / m² vendible</p>
                        <p className="text-[13px] font-bold text-[#f4f0e6] mt-0.5">{fmt(resumen.costoPorM2Vendible)}</p>
                      </div>
                      <div className="rounded-xl px-3 py-2.5 text-center" style={{ backgroundColor: spreadBajo ? '#2e1414' : '#132a4d' }}>
                        <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: spreadBajo ? '#F87171' : '#5f6a80' }}>Spread venta/construcción</p>
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: spreadBajo ? '#F87171' : '#f4f0e6' }}>{resumen.spreadVentaConstruccion !== null ? `${resumen.spreadVentaConstruccion.toFixed(2)}x` : '—'}</p>
                      </div>
                      <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Punto de equilibrio</p>
                        <p className="text-[13px] font-bold text-[#f4f0e6] mt-0.5">{resumen.puntoEquilibrioUnidades} uds</p>
                      </div>
                    </div>

                    <div className="px-5 pb-2">
                      <div className="bg-[#132a4d] rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide font-semibold">Utilidad bruta</p>
                        <p className="text-[13px] font-bold text-[#f4f0e6] mt-0.5">{fmt(resumen.utilidad.utilidadAntesImpuestos)}</p>
                      </div>
                    </div>

                    <AlertasResumen
                      terreno={terrenoActual?.bitacoraTerreno}
                      legal={pipe.legal.data}
                      arquitectura={arquitecturaActual?.bitacoraArquitectura}
                      construccion={construccionActual?.bitacoraConstruccion}
                      spreadBajo={spreadBajo}
                      margenBruto={resumen.utilidad.margenBruto}
                    />

                    <AgentesQA
                      terreno={terrenoActual}
                      legal={pipe.legal.data}
                      mercado={mercadoActual}
                      arquitectura={arquitecturaActual}
                      construccion={construccionActual}
                      bandaActual={construccionActual?.bitacoraConstruccion?.bandaElegida}
                      onAjustarBanda={banda => runConstruccion({
                        bandaConstruccion: banda !== String(construccionActual?.bitacoraConstruccion?.bandaElegida ?? '') ? banda : undefined,
                      })}
                    />

                    <div className="px-5 pb-5">
                      <button
                        onClick={() => setMastermindAbierto(true)}
                        className="w-full bg-[#132a4d] border border-[#2a3f5c] text-[#f4f0e6] rounded-xl py-3 text-[13px] font-semibold hover:border-[#c9a227] hover:text-[#ddc06a] transition-colors cursor-pointer flex items-center justify-center gap-2 mb-2.5"
                      >
                        Ajustes finos con Mastermind (indirectos, honorarios, mix…)
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={runFinanciero}
                        className="w-full bg-[#c9a227] text-[#070f22] rounded-xl py-3 text-[13px] font-semibold hover:bg-[#ddc06a] transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        Aprobar y generar Análisis Financiero
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                      {pipe.construccion.usarParametricoZona && (
                        <p className="text-[10px] text-[#5f6a80] text-center mt-2">
                          Se usará el costo paramétrico de zona en vez del calculado por la IA
                        </p>
                      )}
                    </div>
                  </DoneCard>
                </>
              )
            })()}

            {/* ══ STEP 7 — FINANCIERO ══ */}
            {pipe.financiero.status !== 'waiting' && (
              <>

                {pipe.financiero.status === 'running' && (
                  <RunningCard label="Agente Financiero modelando…" hint="Calculando TIR, flujo de caja, stress test y score de resiliencia" color={AGENTE_COLOR.financiero} />
                )}

                {pipe.financiero.status === 'error' && (
                  <ErrorCard label="Agente Financiero" onRetry={runFinanciero} />
                )}

                {pipe.financiero.status === 'done' && pipe.financiero.data && (() => {
                  const f = pipe.financiero.data.financiero
                  const ec = pipe.financiero.data.estructuraCapital
                  const score = pipe.financiero.data.score
                  return (
                    <DoneCard>
                      <div className="px-5 py-4 border-b border-[#2a3f5c] flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-[11px] text-[#5f6a80]">Análisis financiero completo</span>
                      </div>

                      <div className="px-5 py-4 grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">TIR Socio</p>
                          <p className={`text-[22px] font-black ${f?.tir == null ? 'text-[#5f6a80]' : f.tir >= 0 ? 'text-[#1D9E75]' : 'text-[#DC2626]'}`}>
                            {f?.tir == null ? 'N/D' : `${f.tir.toFixed(1)}%`}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Margen</p>
                          <p className="text-[22px] font-black text-[#f4f0e6]">{f?.margenBruto}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Inversión</p>
                          <p className="text-[22px] font-black text-[#f4f0e6]">{fmt(f?.inversionTotal || 0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Utilidad bruta</p>
                          <p className="text-[16px] font-bold text-[#f4f0e6]">{fmt(f?.utilidadBruta || 0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Ingresos</p>
                          <p className="text-[16px] font-bold text-[#f4f0e6]">{fmt(f?.ingresosProyectados || 0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[#5f6a80] uppercase tracking-wide">Score resiliencia</p>
                          <p className={`text-[16px] font-bold ${score?.total >= 70 ? 'text-[#0F6E56]' : score?.total >= 50 ? 'text-[#FBBF24]' : 'text-[#F87171]'}`}>
                            {score?.total ?? '—'}/100
                          </p>
                        </div>
                      </div>

                      {ec && (
                        <div className="px-5 pb-4">
                          <p className="text-[10px] font-bold text-[#5f6a80] uppercase tracking-wide mb-1.5">Cómo se financia</p>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-[#0F6E56]">Equity {ec.equity}%</span>
                            <span className="text-[11px] font-bold text-[#4F46E5]">Deuda {ec.deuda}%</span>
                          </div>
                          <div className="flex h-2.5 rounded-full overflow-hidden">
                            <div className="bg-[#1D9E75]" style={{ width: `${ec.equity}%` }} />
                            <div className="bg-[#4F46E5]" style={{ width: `${ec.deuda}%` }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-[#5f6a80]">{fmt(ec.montoEquity)}</span>
                            <span className="text-[10px] text-[#5f6a80]">{fmt(ec.montoDeuda)} · {ec.tasaDeuda}</span>
                          </div>
                        </div>
                      )}

                      <div className="px-5 pb-4 flex flex-col gap-3">
                        {pipe.financiero.data.flujoMensual?.length > 0 && (
                          <VerDetalle label="Ver flujo de caja proyectado">
                            <CashFlowChart data={pipe.financiero.data.flujoMensual} />
                          </VerDetalle>
                        )}
                        {(score || pipe.financiero.data.stressTest?.length > 0) && (
                          <VerDetalle label="Ver indicadores de resiliencia">
                            <ResilienciaResumen
                              score={score}
                              stressTest={pipe.financiero.data.stressTest}
                              puntoQuiebre={pipe.financiero.data.puntoQuiebre}
                            />
                          </VerDetalle>
                        )}
                      </div>

                      <div className="px-5 pb-5">
                        <button
                          onClick={irAlReporte}
                          className="w-full bg-[#c9a227] text-[#070f22] rounded-xl py-3 text-[13px] font-semibold hover:bg-[#ddc06a] transition-colors cursor-pointer flex items-center justify-center gap-2"
                        >
                          Ver reporte final
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M5 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </DoneCard>
                  )
                })()}
              </>
            )}
            </CockpitQuadrant>
            )}

          </div>
        </div>
        <MastermindOverlay
          open={mastermindAbierto}
          onClose={() => setMastermindAbierto(false)}
          pipe={pipe}
          setPipe={setPipe}
          proyecto={proyecto}
          construirSnapshotAnalisis={construirSnapshotAnalisis}
          mastermindCoreInputsActuales={mastermindCoreInputsActuales}
        />
      </main>
    </div>
  )
}

export default function AnalizandoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#132a4d] flex items-center justify-center">
        <p className="text-[#5f6a80]">Iniciando pipeline…</p>
      </div>
    }>
      <PipelineContent />
    </Suspense>
  )
}
