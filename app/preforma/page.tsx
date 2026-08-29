'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authedFetch } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'
import { extractMercadoContext, extractProyectoContext, extractTerrenoContext } from '@/lib/mastermind/contexto'
import { calcularMastermind, calcularMastermindCore } from '@/lib/mastermind/motor'
import {
  generarMatrizSensibilidadFlexible, VARIABLES_SENSIBILIDAD,
  type VariableSensibilidad, type EjeSensibilidad, type SensitivityCellFlex,
} from '@/lib/mastermind/sensibilidadFlexible'
import { DEFAULTS, RANGOS_BANDA_MXN_M2, RANGOS_HONORARIOS_POR_BANDA } from '@/lib/mastermind/catalogo'
import { FACTOR_APROVECHAMIENTO, FACTOR_EFICIENCIA_VENDIBLE } from '@/lib/analisis/envolventeYAreas'
import { validarIndirectos, RANGO_INDIRECTOS, RANGO_IMPREVISTOS } from '@/lib/analisis/validacionFinanciera'
import { parsearPlusvaliaAnual } from '@/lib/mercado/parsearPlusvalia'
import type { MastermindInputs, MastermindOutputs } from '@/lib/mastermind/tipos'
import { T } from './theme'
import { useProjectStore, type AgentStatus, type FieldKey } from './store/useProjectStore'
import { DataField } from './components/DataField'
import { AgentPanel } from './components/AgentPanel'
import { SitioYContexto, PENDIENTE_LABEL } from './components/SitioYContexto'
import { Card, CardHead, Lbl, Mini, Cb, Pill, SemaforoParametro, type EstadoSemaforo } from './components/ui'
import type { ChatMsg, IntakeQuestion } from './types'

// Bloque 4: sincroniza un FieldKey con su valor "de agente" — 18 campos nuevos de
// TERRENO/NORMATIVA hacían esto a mano cada uno (mismo patrón de los 7 useEffect del
// Bloque 0/3); con este hook es una sola línea por campo, sin duplicar el cuerpo del efecto.
// Número fijo de llamadas por render (una por campo, siempre las mismas) — no rompe las
// reglas de hooks.
function useSyncField(key: FieldKey, value: string | number | null | undefined) {
  const setFieldFromAgent = useProjectStore((s) => s.setFieldFromAgent)
  useEffect(() => {
    if (value != null && value !== '') setFieldFromAgent(key, value)
  }, [key, value, setFieldFromAgent])
}

// ─── Paso 1: shell visual + navegación + rail básico. Paso 2 (este): intake
// conversacional — el chat de la derecha va preguntando lo mínimo (mismos campos que
// Flujo A) y, al llegar a ubicación, la Stage cambia sola a Terreno donde se pega el
// link de Maps o coordenadas (mismo LeafletPicker/parseo que ya usa
// app/prospeccion/flujo-a/page.tsx, copiado aquí — Paso 3 conecta los agentes reales.
// Ver C:\Users\Administrator\.claude\plans\quirky-imagining-dolphin.md.

// ─── Captura de ubicación — copiado de app/prospeccion/flujo-a/page.tsx (mismo
// mecanismo: pegar link de Maps se resuelve directo o se expande en servidor; pegar
// coordenadas "lat, lng" tipo Google Earth también funciona vía extractCoordsSueltas). ──

function extractCoords(url: string) {
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

// Coordenadas sueltas tipo "25.6547, -100.4033" (Google Earth) — sin ningún wrapper de URL.
function extractCoordsSueltas(texto: string) {
  const m = texto.trim().match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

function isMapsUrl(url: string) {
  return /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google\.com/.test(url)
}

// Bloque 2 (2.1): capa "satelital" vía Esri World Imagery — gratis, sin key, sin depender de
// una segunda superficie de facturación de Google solo para esto (Google Maps JS API ya se usa
// aparte, únicamente para el Autocomplete de direcciones).
function tileLayerPara(L: any, capa: 'calles' | 'satelital') {
  return capa === 'satelital'
    ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri, Maxar, Earthstar Geographics' })
    : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' })
}

function LeafletPicker({ lat, lng, onMove, capa = 'calles' }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void; capa?: 'calles' | 'satelital' }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const tileRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if ((window as any).L) { setReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!ready || !ref.current || mapRef.current) return
    const L = (window as any).L
    const map = L.map(ref.current).setView([lat, lng], 17)
    tileRef.current = tileLayerPara(L, capa).addTo(map)
    const icon = L.divIcon({
      html: `<div><svg viewBox="0 0 24 36" width="22" height="32"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#7ED9AE"/><circle cx="12" cy="12" r="5" fill="white"/></svg></div>`,
      className: '', iconAnchor: [11, 32],
    })
    const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)
    marker.on('dragend', () => { const p = marker.getLatLng(); onMove(p.lat, p.lng) })
    map.on('click', (e: any) => { marker.setLatLng(e.latlng); onMove(e.latlng.lat, e.latlng.lng) })
    mapRef.current = map; markerRef.current = marker
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; tileRef.current = null }
  }, [ready])

  useEffect(() => {
    if (!markerRef.current) return
    markerRef.current.setLatLng([lat, lng])
    mapRef.current?.setView([lat, lng], 17)
  }, [lat, lng])

  // Alterna calles/satelital sin recrear el mapa ni perder el marcador ya colocado.
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return
    const L = (window as any).L
    mapRef.current.removeLayer(tileRef.current)
    tileRef.current = tileLayerPara(L, capa).addTo(mapRef.current)
  }, [capa])

  if (!ready) return <div className="w-full rounded-[9px] flex items-center justify-center" style={{ height: 220, background: T.panel2 }}><p style={{ fontSize: 12, color: T.ink3 }}>Cargando mapa…</p></div>
  return <div ref={ref} className="w-full rounded-[9px] overflow-hidden" style={{ height: 220, border: `1px solid ${T.line}` }} />
}

// Bloque 5 — color por avance de obra, mismo vocabulario que ya muestra la tabla de
// comparables ("Entregado"/"En obra"/"Preventa"). Un solo lugar para ese mapeo, tanto el mapa
// como la tabla lo reusan.
function colorAvance(avance: string | null | undefined): string {
  if (avance === 'Preventa') return T.accent
  if (avance === 'En obra') return T.s2
  if (avance === 'Entregado') return T.ink3
  return T.ink4
}

// Bloque 5 — mapa de comparables de MERCADO con coordenadas reales (ver
// comparables-venta/route.ts: geocodifica cada comparable y descarta los que exceden 5km).
// Mismo Leaflet + Esri/OSM ya usado por LeafletPicker (Bloque 2) — sin introducir Google Maps
// para esto, mismo criterio de evitar una segunda superficie de facturación solo para un mapa.
function MapaComparables({ predioLat, predioLng, comparables }: {
  predioLat: number; predioLng: number
  comparables: { nombre: string; colonia?: string | null; precioM2: number | null; distanciaKm?: number | null; avanceObra: string; lat?: number | null; lng?: number | null }[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const conCoords = comparables.filter((c) => c.lat != null && c.lng != null)

  useEffect(() => {
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if ((window as any).L) { setReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!ready || !ref.current) return
    const L = (window as any).L
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    const map = L.map(ref.current).setView([predioLat, predioLng], 14)
    tileLayerPara(L, 'calles').addTo(map)
    L.circleMarker([predioLat, predioLng], { radius: 7, color: T.ink, fillColor: T.ink, fillOpacity: 1, weight: 2 })
      .addTo(map).bindTooltip('Predio')
    conCoords.forEach((c) => {
      L.circleMarker([c.lat!, c.lng!], { radius: 6, color: colorAvance(c.avanceObra), fillColor: colorAvance(c.avanceObra), fillOpacity: 0.85, weight: 1 })
        .addTo(map)
        .bindTooltip(
          `${c.nombre}${c.colonia ? ` · ${c.colonia}` : ''}<br/>${c.precioM2 != null ? `$${c.precioM2.toLocaleString('es-MX')}/m²` : '—'}${c.distanciaKm != null ? ` · ${c.distanciaKm.toFixed(1)} km` : ''}`,
        )
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [ready, predioLat, predioLng, conCoords.length])

  if (!ready) return <div className="w-full rounded-[9px] flex items-center justify-center" style={{ height: 160, background: T.panel2 }}><p style={{ fontSize: 12, color: T.ink3 }}>Cargando mapa…</p></div>
  return <div ref={ref} className="w-full rounded-[9px] overflow-hidden" style={{ height: 160, border: `1px solid ${T.line}` }} />
}

// Bloque 5 (5.4) — contenedor de la gráfica de plusvalía por zona. El agente solo devuelve un
// string único (m.plusvalia, ej. "+18% en 3 años"), no una serie histórica real — convertirla
// en serie real exigiría cambiar el schema compartido de mercado/route.ts (ver plan, fuera de
// alcance). Esta gráfica es ilustrativa a propósito, marcada como tal en la UI que la envuelve.
const PLUSVALIA_PLACEHOLDER = [20, 35, 30, 55, 48, 70]

function GraficaPlusvaliaPlaceholder() {
  const w = 240, h = 56, pad = 4
  const max = Math.max(...PLUSVALIA_PLACEHOLDER)
  const min = Math.min(...PLUSVALIA_PLACEHOLDER)
  const puntos = PLUSVALIA_PLACEHOLDER.map((v, i) => {
    const x = pad + (i / (PLUSVALIA_PLACEHOLDER.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ marginTop: 8, height: h }}>
      <polyline points={puntos.join(' ')} fill="none" stroke={T.accent2} strokeWidth={1.5} opacity={0.7} />
      {puntos.map((p, i) => {
        const [x, y] = p.split(',')
        return <circle key={i} cx={x} cy={y} r={2} fill={T.accent} opacity={0.7} />
      })}
    </svg>
  )
}

// Bloque 2 (2.1) — mismo patrón de carga que ya usa app/prospeccion/flujo-b/buscando/page.tsx
// (único lugar del repo que ya carga la librería "places" de Google Maps JS API).
function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return
    if ((window as any).google?.maps?.places) { resolve(); return }
    const existing = document.getElementById('gmap-script')
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''
    const script = document.createElement('script')
    script.id = 'gmap-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true; script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Error cargando Google Maps'))
    document.head.appendChild(script)
  })
}

// Escribir la dirección y elegirla de una lista, en vez de solo pegar un link — si el script
// de Google no carga (red, key sin Places habilitado), el input simplemente no aparece; el
// input de link/coordenadas de siempre sigue funcionando sin depender de esto.
function DireccionAutocomplete({ onLugar }: { onLugar: (coords: { lat: number; lng: number }, direccion: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onLugarRef = useRef(onLugar)
  onLugarRef.current = onLugar
  const [disponible, setDisponible] = useState(true)

  useEffect(() => {
    let activo = true
    loadGoogleMaps().then(() => {
      if (!activo || !inputRef.current) return
      const autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'mx' },
        fields: ['formatted_address', 'geometry'],
        types: ['address'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const loc = place.geometry?.location
        if (loc) onLugarRef.current({ lat: loc.lat(), lng: loc.lng() }, place.formatted_address || inputRef.current!.value)
      })
    }).catch(() => setDisponible(false))
    return () => { activo = false }
  }, [])

  if (!disponible) return null
  return (
    <input
      ref={inputRef}
      placeholder="Escribe la dirección del predio…"
      className="w-full outline-none"
      style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: T.ink, marginBottom: 8 }}
    />
  )
}

// ─── Opciones de captura — mismas listas que Flujo A (app/prospeccion/flujo-a/page.tsx),
// copiadas y recortadas para verse bien como chips de chat. ──

const TIPOS_DESARROLLO = [
  { id: 'residencial-vertical', label: 'Residencial vertical' },
  { id: 'residencial-horizontal', label: 'Residencial horizontal' },
  { id: 'unifamiliar', label: 'Unifamiliar' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'mixto', label: 'Uso mixto' },
  { id: 'industrial', label: 'Industrial / Nave' },
]
const RANGOS_PRESUPUESTO = [
  { id: 'menos-5m', label: 'Menos de $5 MDP' },
  { id: '5-15m', label: '$5–$15 MDP' },
  { id: '15-50m', label: '$15–$50 MDP' },
  { id: '50-150m', label: '$50–$150 MDP' },
  { id: 'mas-150m', label: 'Más de $150 MDP' },
]
const BANDAS = [
  { id: '1', label: 'Económica' },
  { id: '2', label: 'Media Estándar' },
  { id: '3', label: 'Media Alta' },
  { id: '4', label: 'Premium / Lujo' },
]

const INTAKE: IntakeQuestion[] = [
  { key: 'nombre', kind: 'texto', pregunta: '¿Cómo se llama este proyecto?' },
  { key: 'ubicacion', kind: 'mapa', pregunta: 'Vamos a ubicar el predio — te llevo a la pestaña Terreno, pega ahí el link de Google Maps o unas coordenadas.' },
  { key: 'superficie', kind: 'numero', pregunta: '¿Cuántos m² tiene el terreno?' },
  { key: 'tipo', kind: 'chips-multi', pregunta: '¿Qué tipo de desarrollo tienes en mente? Puedes elegir más de uno.', opciones: TIPOS_DESARROLLO },
  { key: 'presupuesto', kind: 'chips-single', pregunta: '¿Cuánto presupuesto tienes para invertir?', opciones: RANGOS_PRESUPUESTO },
  { key: 'banda', kind: 'chips-single', pregunta: '¿Qué nivel de acabados buscas?', opciones: BANDAS },
]


interface FormPreforma {
  nombreProyecto: string
  lat: number | null; lng: number | null; mapsLink: string
  direccion: string; colonia: string; ciudad: string; estado: string; codigoPostal: string
  superficie: string
  tiposDesarrollo: string[]
  presupuesto: string; bandaConstruccion: string
  // Auto-inferidos al confirmar ubicación (igual que Flujo A) — no se le preguntan al
  // usuario en este intake corto, se pasan a los agentes tal cual si vienen del geocode.
  clasificacionVial: string; pendiente: string; pavimento: string; esEsquina: string
  usoSuelo: string; agua: string; electricidad: string
  // Bloque 2 (2.3): URL del plano/predial que el usuario subió — punto de entrada al
  // polígono real, sin extracción automática todavía.
  planoUrl: string | null
}
const FORM_INICIAL: FormPreforma = {
  nombreProyecto: '', lat: null, lng: null, mapsLink: '',
  direccion: '', colonia: '', ciudad: '', estado: '', codigoPostal: '',
  superficie: '', tiposDesarrollo: [], presupuesto: '', bandaConstruccion: '',
  clasificacionVial: '', pendiente: '', pavimento: '', esEsquina: '', usoSuelo: '', agua: '', electricidad: '',
  planoUrl: null,
}

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'terreno', label: 'Terreno' },
  { key: 'normativa', label: 'Normativa' },
  { key: 'mercado', label: 'Mercado' },
  { key: 'arquitectura', label: 'Arquitectura' },
  { key: 'costos', label: 'Costos' },
  { key: 'financiero', label: 'Financiero' },
] as const
type TabKey = typeof TABS[number]['key']

// Semáforo de agentes en las pestañas (Bloque 1, 1.2) — mapeo tab→etapa, porque los nombres
// no coinciden 1:1: la pestaña se llama "normativa" pero el agente/pipe es "legal", y
// "costos" es "construccion". 'resumen' no tiene agente propio, sin indicador.
const TAB_TO_ETAPA: Partial<Record<TabKey, 'terreno' | 'legal' | 'mercado' | 'arquitectura' | 'construccion' | 'financiero'>> = {
  terreno: 'terreno', normativa: 'legal', mercado: 'mercado',
  arquitectura: 'arquitectura', costos: 'construccion', financiero: 'financiero',
}

// ─── Piezas base — traducción directa de .card/.chead/.cb/.lbl/.kv del prototipo ──

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-[3px] border-b" style={{ borderColor: 'rgba(255,255,255,.035)' }}>
      <span className="truncate" style={{ color: T.ink3, fontSize: 10 }}>{label}</span>
      <b className="text-right shrink-0" style={{ color: T.ink, fontWeight: 400, fontSize: 10.5 }}>{value}</b>
    </div>
  )
}

function FactorBar({ label, pct, color = T.s1 }: { label: string; pct: number | null; color?: string }) {
  return (
    <div className="flex items-center gap-2 py-[2px]">
      <span className="flex-1 truncate" style={{ fontSize: 10, color: T.ink2 }}>{label}</span>
      <div className="rounded-[2px] overflow-hidden shrink-0" style={{ width: 40, height: 3, background: 'rgba(255,255,255,.07)' }}>
        {pct != null && <div style={{ width: `${pct}%`, height: '100%', background: color }} />}
      </div>
    </div>
  )
}

// Bloque 4 (4.2) — diagrama compacto de envolvente: 2 barras superpuestas (permitido en gris,
// proyectado coloreado por semáforo) en vez del volumétrico 3D interactivo, que es Bloque 6.
function BarraEnvolvente({ label, permitido, proyecto, estado }: { label: string; permitido: number; proyecto: number | null; estado: EstadoSemaforo }) {
  const maxVal = Math.max(permitido, proyecto ?? 0) || 1
  const colorProyecto = estado === 'cumple' ? T.s1 : estado === 'limite' ? T.s2 : estado === 'excede' ? T.bad : T.ink4
  return (
    <div style={{ marginBottom: 7 }}>
      <div className="flex justify-between" style={{ fontSize: 8.5, color: T.ink3, marginBottom: 2 }}>
        <span>{label}</span>
        <span>{proyecto != null ? `Proyecto ${proyecto} / Permitido ${permitido}` : `Permitido ${permitido}`}</span>
      </div>
      <div className="relative rounded-[3px] overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,.07)' }}>
        <div className="absolute" style={{ left: 0, top: 0, width: `${(permitido / maxVal) * 100}%`, height: '100%', background: T.ink4 }} />
        {proyecto != null && (
          <div className="absolute" style={{ left: 0, top: 0, width: `${(proyecto / maxVal) * 100}%`, height: '100%', background: colorProyecto, opacity: 0.9 }} />
        )}
      </div>
    </div>
  )
}

// Bloque 7 (7.1/criterio #2) — "se muestra rango y no valor único": a diferencia de
// BarraEnvolvente (un techo único, permitido vs. proyecto), esto es un rango [minimo,maximo]
// con un marcador del valor actual — para costo de construcción y, en general, cualquier campo
// donde el agente ya trae mínimo/promedio/máximo en vez de un solo número.
function BarraRango({ label, minimo, maximo, valor, fmt }: { label: string; minimo: number; maximo: number; valor: number | null; fmt: (n: number) => string }) {
  const span = maximo - minimo || 1
  const dentro = valor != null && valor >= minimo && valor <= maximo
  const colorValor = valor == null ? T.ink4 : dentro ? T.s1 : T.bad
  const pctValor = valor != null ? Math.min(100, Math.max(0, ((valor - minimo) / span) * 100)) : null
  return (
    <div style={{ marginBottom: 7 }}>
      <div className="flex justify-between" style={{ fontSize: 8.5, color: T.ink3, marginBottom: 2 }}>
        <span>{label}</span>
        <span>{fmt(minimo)} – {fmt(maximo)}{valor != null ? ` · actual ${fmt(valor)}` : ''}</span>
      </div>
      <div className="relative rounded-[3px] overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,.07)' }}>
        <div className="absolute inset-0" style={{ background: T.ink4, opacity: 0.5 }} />
        {pctValor != null && (
          <div className="absolute rounded-full" style={{ left: `calc(${pctValor}% - 2px)`, top: -2, width: 10, height: 10, background: colorValor, border: `1.5px solid ${T.panel}` }} />
        )}
      </div>
    </div>
  )
}

function ScenarioRow({ nombre, sub, tir, color, activo }: { nombre: string; sub: string; tir: string; color: string; activo?: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-[11px] py-[7px]"
      style={{ borderBottom: '1px solid rgba(255,255,255,.035)', background: activo ? 'rgba(126,217,174,.08)' : 'transparent', cursor: 'pointer' }}
    >
      <span className="rounded-full shrink-0" style={{ width: 5, height: 5, background: color }} />
      <span className="flex-1 min-w-0" style={{ fontSize: 10.5 }}>
        {nombre}
        <span className="block truncate" style={{ fontSize: 9, color: T.ink4, marginTop: 1 }}>{sub}</span>
      </span>
      <span style={{ fontSize: 13, fontWeight: 300, color: activo ? T.accent : T.ink }}>{tir}</span>
    </div>
  )
}

function Kpi({ label, value, sub, hero }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <div style={{ background: hero ? 'linear-gradient(135deg, rgba(79,192,141,.15), rgba(8,13,11,.2))' : T.panel2, padding: '10px 12px' }}>
      <Lbl>{label}</Lbl>
      <div style={{ fontSize: hero ? 44 : 23, fontWeight: hero ? 200 : 250, marginTop: hero ? 5 : 4, lineHeight: 1, color: hero ? T.accent : T.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: T.ink3, marginTop: hero ? 17 : 4 }}>{sub}</div>}
    </div>
  )
}

// Indicador "agente trabajando" — mismo barrido de radar/sonar que ya usaba
// app/analisis/analizando/page.tsx (conic-gradient girando, deja estela), portado a los
// colores T de PREFORMA y agrandado a ~3cm (110px) para ocupar el espacio vacío de la
// tarjeta pendiente en vez del punto pulsante diminuto que había antes.
function Sonar({ color = T.accent, size = 110 }: { color?: string; size?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inline-block rounded-full" style={{ width: size, height: size, border: `1.5px solid ${color}33` }} />
      <span
        className="absolute inline-block rounded-full animate-spin"
        style={{ width: size, height: size, background: `conic-gradient(from 0deg, transparent 0deg, transparent 260deg, ${color}4D 320deg, ${color} 360deg)` }}
      />
      <span className="relative inline-block rounded-full" style={{ width: size * 0.1, height: size * 0.1, backgroundColor: color }} />
    </span>
  )
}

// `estado` distingue "todavía no arranca" (waiting) de "está corriendo ahora mismo, espera"
// (running — los agentes de LLM tardan 20–120s cada uno, sin esto el usuario ve el mismo
// texto estático todo ese rato y no hay forma de saber si de verdad está trabajando) de
// "falló" (error, con reintentar) — antes las tres se veían exactamente igual.
function CardPendiente({ titulo, flex = '1', nota, estado, color, onReintentar }: { titulo: string; flex?: string; nota: string; estado?: 'waiting' | 'running' | 'done' | 'error'; color?: string; onReintentar?: () => void }) {
  return (
    <Card flex={flex}>
      <CardHead>{titulo}</CardHead>
      <Cb>
        <div className="h-full flex flex-col items-center justify-center gap-2 py-10">
          {estado === 'running' ? (
            <>
              {/* El sonar grande (~3cm) vive aquí — es la única zona con espacio real para eso
                  sin apretar el header. El semáforo bajo cada pestaña se queda compacto (un
                  punto pequeño) porque ahí sí hay que caber junto al texto de la pestaña. */}
              <Sonar color={color ?? T.accent} size={112} />
              <p className="text-center" style={{ fontSize: 11, color: T.accent2, marginTop: 4 }}>Corriendo el agente…</p>
              <p className="text-center" style={{ fontSize: 9.5, color: T.ink4 }}>puede tardar hasta 1–2 min</p>
            </>
          ) : estado === 'error' ? (
            <>
              <p className="text-center" style={{ fontSize: 11, color: T.bad }}>No se pudo completar</p>
              {onReintentar && (
                <button onClick={onReintentar} className="cursor-pointer rounded-full" style={{ marginTop: 2, padding: '4px 12px', fontSize: 10, color: T.bad, border: `1px solid ${T.bad}55` }}>
                  Reintentar
                </button>
              )}
            </>
          ) : (
            <p className="text-center" style={{ fontSize: 11, color: T.ink4 }}>{nota}</p>
          )}
        </div>
      </Cb>
    </Card>
  )
}

// ─── Formato + gráfica de flujo de caja — portado de app/propuesta/page.tsx ────

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

// Bloque 4: fields.value ahora es number | string | null (para soportar TERRENO/NORMATIVA,
// que son mayormente texto/categóricos) — los 7 FieldKey financieros siguen siendo
// numéricos en la práctica, esto solo estrecha el tipo en el punto de lectura.
function numeroDe(field: { value: number | string | null }): number | null {
  return typeof field.value === 'number' ? field.value : null
}
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

interface FlujoMesPre { mes: number; fase: string; egresos: number; ingresos: number; acumulado: number; nota: string }

function CashFlowChart({ data, onSeleccionar, seleccionado }: {
  data: FlujoMesPre[]
  // Bloque 8 (criterio #2) — opcionales, retrocompatibles: el uso en RESUMEN (sin estos props)
  // sigue igual, sin barras clicables.
  onSeleccionar?: (mes: FlujoMesPre, index: number) => void
  seleccionado?: number | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 200 })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth || 600, h: el.clientHeight || 200 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { w: W, h: H } = dims
  const pad = { top: 20, right: 12, bottom: 28, left: 46 }
  const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom
  const maxBar = Math.max(...data.map(d => d.egresos), ...data.map(d => d.ingresos), 1)
  const minAcum = Math.min(...data.map(d => d.acumulado), 0), maxAcum = Math.max(...data.map(d => d.acumulado), 0)
  const acumRange = maxAcum - minAcum || 1
  const barW = Math.max(2, iW / data.length - 2)
  const xPos = (i: number) => pad.left + (i + 0.5) * (iW / data.length)
  const yLine = (v: number) => pad.top + ((maxAcum - v) / acumRange) * iH
  const zeroY = yLine(0)
  const linePts = data.map((d, i) => `${xPos(i)},${yLine(d.acumulado)}`).join(' ')
  return (
    <div ref={box} className="w-full h-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        <line x1={pad.left} x2={W - pad.right} y1={zeroY} y2={zeroY} stroke={T.line} strokeWidth={1} />
        {data.map((d, i) => {
          const cx = xPos(i), half = barW / 2
          const hE = (d.egresos / maxBar) * (iH * 0.45), hI = (d.ingresos / maxBar) * (iH * 0.45)
          const midY = pad.top + iH * 0.5
          const activo = seleccionado === i
          return (
            <g
              key={i}
              onClick={onSeleccionar ? () => onSeleccionar(d, i) : undefined}
              style={onSeleccionar ? { cursor: 'pointer' } : undefined}
            >
              {onSeleccionar && (
                <rect x={cx - half - 1} y={pad.top} width={barW + 2} height={iH} fill={activo ? T.accent : 'transparent'} opacity={activo ? 0.08 : 0} />
              )}
              {d.egresos > 0 && <rect x={cx - half} y={midY} width={barW} height={hE} rx={1} fill={T.s2} opacity={activo ? 1 : 0.75} />}
              {d.ingresos > 0 && <rect x={cx - half} y={midY - hI} width={barW} height={hI} rx={1} fill={T.s1} opacity={activo ? 1 : 0.85} />}
              {d.nota && <circle cx={cx} cy={pad.top - 6} r={1.6} fill={T.accent2} />}
            </g>
          )
        })}
        <polyline points={linePts} fill="none" stroke={T.ink} strokeWidth={1.6} opacity={0.85} />
        {data.map((d, i) => (
          (i === 0 || (i + 1) % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
            <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize={8} fill={T.ink4}>M{d.mes}</text>
          )
        ))}
      </svg>
    </div>
  )
}

// MapaSimbolico y PENDIENTE_LABEL viven ahora en components/SitioYContexto.tsx (Bloque 2) —
// junto con los botones "+ Agregar terreno"/"Cargar PDF" de esa misma tarjeta.

const VIALIDAD_LABEL: Record<string, string> = {
  arterial: 'Arterial / Primaria', colectora: 'Colectora', secundaria: 'Secundaria', local: 'Local / Habitacional', privada: 'Privada / Andador',
}
// AGUA_LABEL/ELEC_LABEL (mapeo bruto de form.agua/form.electricidad a texto) ya no se usan
// directo — Bloque 4 unificó esos 2 campos con NORMATIVA en aguaDisponibilidad/
// electricidadDisponibilidad (vocabulario de fichaLegal.factibilidades), con `mapServicioBase`
// como puente para el valor base antes de que corra el Agente Normativa.

// ─── Bloque 4: opciones fijas para los <DataField type="select"/> de TERRENO/NORMATIVA ──
const PENDIENTE_OPCIONES = Object.entries(PENDIENTE_LABEL).map(([id, label]) => ({ id, label }))
const VIALIDAD_OPCIONES = Object.entries(VIALIDAD_LABEL).map(([id, label]) => ({ id, label }))
const USO_SUELO_OPCIONES = [
  { id: 'habitacional', label: 'Habitacional' }, { id: 'comercial', label: 'Comercial' },
  { id: 'mixto', label: 'Mixto' }, { id: 'industrial', label: 'Industrial' }, { id: 'agricola', label: 'Agrícola' },
]
const ESQUINA_OPCIONES = [{ id: 'si', label: 'Esquina' }, { id: 'no', label: 'No esquina' }]
const PAVIMENTO_OPCIONES = [{ id: 'si', label: 'Sí' }, { id: 'no', label: 'No' }]
const SERVICIO_OPCIONES = [
  { id: 'Disponible', label: 'Disponible' }, { id: 'Con condicionante', label: 'Con condicionante' }, { id: 'No disponible', label: 'No disponible' },
]
const COMPATIBLE_OPCIONES = [{ id: 'Compatible', label: 'Compatible' }, { id: 'Requiere cambio', label: 'Requiere cambio' }]
const NIVEL_RIESGO_OPCIONES = [{ id: 'Bajo', label: 'Bajo' }, { id: 'Medio', label: 'Medio' }, { id: 'Alto', label: 'Alto' }]

// Traduce el dato burdo de `form` (inferido por OSM antes de que corra el Agente Normativa)
// al vocabulario canónico de fichaLegal.factibilidades, para que aguaDisponibilidad/
// electricidadDisponibilidad tengan un valor base razonable incluso antes de que el agente
// legal corra.
function mapServicioBase(valorForm: string | undefined, tipo: 'agua' | 'electricidad'): string | null {
  if (!valorForm) return null
  if (tipo === 'agua') {
    if (valorForm === 'red-municipal') return 'Disponible'
    if (valorForm === 'pozo' || valorForm === 'pipa') return 'Con condicionante'
    if (valorForm === 'sin-servicio') return 'No disponible'
  } else {
    if (valorForm === 'cfe-frente') return 'Disponible'
    if (valorForm === 'extension') return 'Con condicionante'
    if (valorForm === 'sin-servicio') return 'No disponible'
  }
  return null
}

// Extrae el primer número de strings ya formateadas por el agente (ej. "60%", "3.0", "12
// niveles") — para poder comparar Permitido vs. Proyecto en la tabla de NORMATIVA.
function parsearNumero(texto: string | number | undefined | null): number | null {
  if (texto == null) return null
  const m = String(texto).match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

function estatusComparacion(permitido: number | null, proyecto: number | null): EstadoSemaforo {
  if (permitido == null || proyecto == null) return 'sin-dato'
  if (proyecto <= permitido) return 'cumple'
  if (proyecto <= permitido * 1.05) return 'limite'
  return 'excede'
}

// Bloque 6 — comparador hermano de estatusComparacion pero para parámetros que son un MÍNIMO
// exigido (cajones de estacionamiento), no un techo — la dirección de "cumple" se invierte.
function estatusMinimo(permitido: number | null, proyecto: number | null): EstadoSemaforo {
  if (permitido == null || proyecto == null) return 'sin-dato'
  if (proyecto >= permitido) return 'cumple'
  if (proyecto >= permitido * 0.9) return 'limite'
  return 'excede'
}

// Bloque 6 — mapeo pragmático de tiposDesarrollo a la tipología de FACTOR_EFICIENCIA_VENDIBLE,
// mismo espíritu que palabraClaveVenta() en app/api/agentes/comparables-venta/route.ts.
function tipologiaEnvolvente(tipos: string[] | undefined): 'vertical' | 'horizontal' | 'mixto' {
  const t = tipos || []
  if (t.includes('unifamiliar') || t.includes('residencial-horizontal')) return 'horizontal'
  if (t.includes('mixto') || (t.includes('comercial') && t.some((x) => x.startsWith('residencial')))) return 'mixto'
  return 'vertical'
}

// ─── Diagrama de tipología/arquitectura — corte esquemático minimalista, mismo
// lenguaje visual que MapaSimbolico (fondo oscuro, líneas finas, un solo acento por
// elemento). A diferencia de MapaSimbolico, esto NO es decorativo: los botones de tipo
// de estacionamiento son un control real — al elegir uno se vuelve a correr el Agente de
// Arquitectura con ese override (app/api/agentes/arquitectura/route.ts) y el resultado
// (bitacoraArquitectura.tipoEstacionamientoFijado) es lo único que decide qué botón se
// muestra activo, nunca un valor local adivinado. ──

function nombreEsEstacionamiento(zona?: string) {
  return (zona || '').toLowerCase().includes('estacionamiento')
}

const ESTACIONAMIENTO_TIPO_LABEL: Record<string, string> = { subterraneo: 'Subterráneo', nivel: 'A nivel' }

const COLOR_ZONA: Record<string, string> = {
  'área vendible': T.accent, estacionamiento: T.s2, circulaciones: T.s3,
  'áreas comunes': T.s1, 'cuartos de servicio': T.ink4,
}

function DiagramaArquitectura({
  zonas, niveles, tipoActivo, onElegirTipo, cargando, alturaExcedentePct = 0, sotanosNiveles, cajonesSotano,
}: {
  zonas: Array<{ zona: string; m2?: number; participacion?: string; cajonesEstimados?: number }>
  niveles?: number
  tipoActivo: 'subterraneo' | 'nivel' | null
  onElegirTipo: (tipo: 'subterraneo' | 'nivel') => void
  cargando: boolean
  // Bloque 6 (6.2) — 0-1, % de la altura del stack a resaltar como excedente de CUS.
  alturaExcedentePct?: number
  // Bloque 6 (6.1) — conteo real de niveles/cajones de sótano editado por el usuario, en vez
  // del binario "activo/inactivo" que traía el diagrama antes de este bloque.
  sotanosNiveles?: number
  cajonesSotano?: number | null
}) {
  const colorDe = (zona: string) => COLOR_ZONA[zona.toLowerCase()] ?? T.ink3
  const pct = (z: { participacion?: string }) => Number(String(z.participacion || '').replace('%', '').trim()) || 0

  const estac = zonas.find(z => nombreEsEstacionamiento(z.zona))
  const otras = zonas.filter(z => z !== estac)
  const stack = tipoActivo === 'nivel' && estac ? [estac, ...otras] : otras
  const totalPct = stack.reduce((s, z) => s + pct(z), 0) || 1

  const X0 = 130, X1 = 270, ANCHO = X1 - X0
  const GROUND_Y = 150, ALTO_STACK = 110, TOPE_Y = GROUND_Y - ALTO_STACK

  let acumulado = 0
  const bandas = stack.map(z => {
    const alto = (pct(z) / totalPct) * ALTO_STACK
    const y = GROUND_Y - acumulado - alto
    acumulado += alto
    return { z, y, alto }
  })

  return (
    <div className="relative" style={{ flex: 1, minHeight: 0, background: '#040706' }}>
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="arqGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#4FC08D" stopOpacity=".16" /><stop offset="100%" stopColor="#4FC08D" stopOpacity="0" />
          </radialGradient>
          <pattern id="arqHatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke={T.s2} strokeWidth={1} opacity={0.4} />
          </pattern>
        </defs>
        <rect width={400} height={220} fill="#040706" />
        <rect width={400} height={220} fill="url(#arqGlow)" />

        {niveles && niveles > 0 && Array.from({ length: Math.min(niveles, 10) }, (_, i) => {
          const y = TOPE_Y + (i * ALTO_STACK) / Math.min(niveles, 10)
          return <line key={i} x1={X0 - 7} y1={y} x2={X0} y2={y} stroke={T.ink4} strokeWidth={0.6} />
        })}

        {bandas.map(({ z, y, alto }, i) => (
          <rect key={i} x={X0} y={y} width={ANCHO} height={Math.max(alto, 1)} fill={colorDe(z.zona)} opacity={z === estac ? 0.85 : 0.5} stroke="#040706" strokeWidth={0.6} />
        ))}
        <rect x={X0} y={TOPE_Y} width={ANCHO} height={GROUND_Y - TOPE_Y} fill="none" stroke={T.line2} strokeWidth={1} />

        {alturaExcedentePct > 0 && (() => {
          const altoExcedente = Math.min(1, alturaExcedentePct) * ALTO_STACK
          return (
            <g>
              <rect x={X0} y={TOPE_Y} width={ANCHO} height={altoExcedente} fill={T.bad} opacity={0.3} stroke={T.bad} strokeWidth={1} strokeDasharray="3 2" />
              <text x={X0 + ANCHO / 2} y={TOPE_Y + Math.min(altoExcedente, 10)} fill={T.bad} fontSize={7.5} textAnchor="middle">Excede CUS</text>
            </g>
          )
        })()}

        <line x1={40} y1={GROUND_Y} x2={360} y2={GROUND_Y} stroke={T.ink3} strokeWidth={1} strokeDasharray="1 3" />
        <text x={44} y={GROUND_Y - 4} fill={T.ink3} fontSize={7.5} letterSpacing="0.05em">NIVEL DE BANQUETA</text>

        {tipoActivo === 'subterraneo' && (
          <g>
            <rect x={X0} y={GROUND_Y} width={ANCHO} height={46} fill="url(#arqHatch)" stroke={T.s2} strokeWidth={1} strokeDasharray="3 2" />
            <text x={X0 + ANCHO / 2} y={GROUND_Y + 20} fill={T.s2} fontSize={8.5} textAnchor="middle">
              {sotanosNiveles ? `${sotanosNiveles} nivel${sotanosNiveles === 1 ? '' : 'es'} de sótano` : 'Estacionamiento subterráneo'}
            </text>
            <text x={X0 + ANCHO / 2} y={GROUND_Y + 34} fill={T.s2} fontSize={8} textAnchor="middle" opacity={0.8}>
              {(cajonesSotano ?? estac?.cajonesEstimados) ? `${cajonesSotano ?? estac?.cajonesEstimados} cajones` : ''}
            </text>
          </g>
        )}
        {tipoActivo === null && (
          <g>
            <rect x={X0} y={GROUND_Y} width={ANCHO} height={46} fill="none" stroke={T.ink4} strokeWidth={1} strokeDasharray="2 3" />
            <text x={X0 + ANCHO / 2} y={GROUND_Y + 27} fill={T.ink4} fontSize={8} textAnchor="middle">Estacionamiento: sin definir</text>
          </g>
        )}

        {bandas.map(({ z, y, alto }, i) => alto > 8 ? (
          <text key={i} x={X1 + 10} y={y + alto / 2 + 3} fill={T.ink2} fontSize={7.5}>{z.zona} · {z.participacion}</text>
        ) : null)}
      </svg>

      <div className="absolute flex overflow-hidden rounded-md" style={{ top: 9, right: 9, border: `1px solid ${T.line}`, background: 'rgba(4,7,6,.85)' }}>
        {(['subterraneo', 'nivel'] as const).map(t => (
          <button
            key={t}
            disabled={cargando}
            onClick={() => onElegirTipo(t)}
            className="cursor-pointer"
            style={{
              padding: '5px 9px', fontSize: 9, letterSpacing: '.05em',
              color: tipoActivo === t ? '#040706' : T.ink2,
              background: tipoActivo === t ? T.s2 : 'transparent',
              fontWeight: tipoActivo === t ? 600 : 400,
              opacity: cargando ? 0.5 : 1,
            }}
          >
            {ESTACIONAMIENTO_TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="absolute" style={{ left: 11, bottom: 9 }}>
        <Lbl>{cargando ? 'Recalculando diseño…' : 'Tipo de estacionamiento'}</Lbl>
        <b className="block" style={{ fontSize: 12.5, marginTop: 1, color: T.ink }}>
          {tipoActivo ? ESTACIONAMIENTO_TIPO_LABEL[tipoActivo] : '— (elige arriba)'}
        </b>
      </div>
    </div>
  )
}

// ─── Matriz de sensibilidad TIR — Bloque 3 (3.1/3.2): ejes elegibles entre 6 variables reales
// del modelo (incluida tiempo), rango ajustable, click en una celda aplica esa combinación al
// modelo completo (setFieldManual de las 2 variables vía el store), y un botón guarda la
// celda actual como escenario nuevo. Reemplaza la versión de solo lectura del Bloque 0. ──

const COLOR_SEMAFORO: Record<SensitivityCellFlex['semaforo'], string> = {
  verde_oscuro: '#0A5C47', verde: T.s1, amarillo: T.s2, rojo: T.bad, gris: 'rgba(255,255,255,.06)',
}

const VARIABLE_A_FIELDKEY: Record<VariableSensibilidad, FieldKey> = {
  precioVenta: 'precioVentaM2',
  costoConstruccion: 'costoConstruccionM2',
  costoTerreno: 'costoTerrenoM2',
  tasaInteres: 'tasaAnualCredito',
  plazoObra: 'plazoObraMeses',
  plazoVenta: 'plazoVentaMeses',
}

function fmtEje(variable: VariableSensibilidad, valor: number): string {
  if (variable === 'tasaInteres') return `${valor.toFixed(1)}%`
  if (variable === 'plazoObra' || variable === 'plazoVenta') return `${Math.round(valor)}m`
  return `${Math.round(valor / 1000)}k`
}

function MatrizSensibilidad({
  matriz, ejeFila, ejeColumna, rango, onEjeFila, onEjeColumna, onRango, onAplicar, onGuardar,
}: {
  matriz: SensitivityCellFlex[][]
  ejeFila: VariableSensibilidad
  ejeColumna: VariableSensibilidad
  rango: 0.1 | 0.2 | 0.3
  onEjeFila: (v: VariableSensibilidad) => void
  onEjeColumna: (v: VariableSensibilidad) => void
  onRango: (r: 0.1 | 0.2 | 0.3) => void
  onAplicar: (celda: SensitivityCellFlex) => void
  onGuardar: () => void
}) {
  const selectStyle: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 5, color: T.ink2,
    fontSize: 8.5, padding: '2px 3px', maxWidth: 82,
  }
  return (
    <div className="flex flex-col h-full" style={{ padding: '7px 10px' }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 5, flexWrap: 'wrap' }}>
        <select value={ejeFila} onChange={e => onEjeFila(e.target.value as VariableSensibilidad)} style={selectStyle}>
          {VARIABLES_SENSIBILIDAD.map(v => <option key={v.id} value={v.id} disabled={v.id === ejeColumna}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: 8, color: T.ink4 }}>×</span>
        <select value={ejeColumna} onChange={e => onEjeColumna(e.target.value as VariableSensibilidad)} style={selectStyle}>
          {VARIABLES_SENSIBILIDAD.map(v => <option key={v.id} value={v.id} disabled={v.id === ejeFila}>{v.label}</option>)}
        </select>
        <div className="flex items-center gap-0.5" style={{ marginLeft: 'auto' }}>
          {([0.1, 0.2, 0.3] as const).map(r => (
            <button
              key={r}
              onClick={() => onRango(r)}
              className="cursor-pointer"
              style={{
                fontSize: 8, padding: '2px 5px', borderRadius: 6,
                border: `1px solid ${rango === r ? 'rgba(126,217,174,.45)' : T.line2}`,
                background: rango === r ? 'rgba(126,217,174,.12)' : 'transparent',
                color: rango === r ? T.accent : T.ink3,
              }}
            >
              ±{Math.round(r * 100)}%
            </button>
          ))}
        </div>
      </div>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <td />
            {matriz[0].map((c, i) => <th key={i} style={{ fontSize: 7.5, color: T.ink3, fontWeight: 400, padding: '0 2px 2px' }}>{fmtEje(ejeColumna, c.columna.valor)}</th>)}
          </tr>
        </thead>
        <tbody>
          {matriz.map((fila, fi) => (
            <tr key={fi}>
              <td style={{ fontSize: 7.5, color: T.ink3, textAlign: 'right', paddingRight: 3, whiteSpace: 'nowrap' }}>{fmtEje(ejeFila, fila[0].fila.valor)}</td>
              {fila.map((celda, ci) => {
                const activa = fi === 2 && ci === 2
                return (
                  <td key={ci} style={{ padding: 1 }}>
                    <button
                      onClick={() => onAplicar(celda)}
                      title={`${VARIABLES_SENSIBILIDAD.find(v => v.id === ejeFila)?.label} ${fmtEje(ejeFila, celda.fila.valor)} · ${VARIABLES_SENSIBILIDAD.find(v => v.id === ejeColumna)?.label} ${fmtEje(ejeColumna, celda.columna.valor)}`}
                      className="flex items-center justify-center rounded-[3px] cursor-pointer"
                      style={{
                        width: 30, height: 17, fontSize: 8, fontWeight: 600, border: activa ? `1.5px solid ${T.ink}` : 'none',
                        background: COLOR_SEMAFORO[celda.semaforo], color: celda.semaforo === 'gris' ? T.ink4 : '#fff',
                      }}
                    >
                      {celda.tirSocio !== null ? `${celda.tirSocio.toFixed(0)}%` : '—'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={onGuardar}
        className="cursor-pointer self-start"
        style={{ marginTop: 6, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: T.accent }}
      >
        + Guardar celda activa como escenario
      </button>
    </div>
  )
}

// ─── Shell principal ────────────────────────────────────────────────────────────

export default function PreformaPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('resumen')

  // ── Bloque 1 (1.1): panel del Agente PREFORMA en 3 modos. Arranca 'centered' porque al
  // montar la página el intake siempre está sin terminar; se auto-oculta al terminarlo
  // (efecto más abajo, una vez que `intakeDone` existe).
  const [agentPanelMode, setAgentPanelMode] = useState<'centered' | 'docked' | 'hidden'>('centered')

  // ── Bloque 3 (3.1): ejes elegibles de la matriz de sensibilidad — mismos defaults que el
  // comportamiento anterior (costo de construcción × precio de venta, ±20%).
  const [ejeFilaVar, setEjeFilaVar] = useState<VariableSensibilidad>('costoConstruccion')
  const [ejeColumnaVar, setEjeColumnaVar] = useState<VariableSensibilidad>('precioVenta')
  const [rangoSensibilidad, setRangoSensibilidad] = useState<0.1 | 0.2 | 0.3>(0.2)

  // ── Usuario (botón "JCA") — antes llevaba a /prospeccion (el flujo viejo), lo cual no tiene
  // sentido: es el botón de cuenta, no un acceso al otro flujo. Configuración de usuarios queda
  // para después; por ahora solo muestra el correo y permite cerrar sesión, igual que Topbar.tsx.
  const [email, setEmail] = useState<string | undefined>(undefined)
  const [usuarioMenuAbierto, setUsuarioMenuAbierto] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setEmail(session?.user?.email))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email))
    return () => sub.subscription.unsubscribe()
  }, [])
  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Intake conversacional ──
  const [form, setForm] = useState<FormPreforma>(FORM_INICIAL)
  const [intakeStep, setIntakeStep] = useState(0)
  const [chat, setChat] = useState<ChatMsg[]>([{ who: 'a', text: INTAKE[0].pregunta }])
  const [texto, setTexto] = useState('')
  const [tipoSel, setTipoSel] = useState<string[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const intakeDone = intakeStep >= INTAKE.length
  const preguntaActual = intakeDone ? null : INTAKE[intakeStep]

  // Al terminar la captura, el panel se guarda solo y libera su columna (Bloque 1, 1.1).
  useEffect(() => { if (intakeDone) setAgentPanelMode('hidden') }, [intakeDone])

  // La pregunta de ubicación ('mapa') no se responde en el chat — hay que ver y usar la
  // pestaña Terreno, que un overlay centrado taparía. Por eso esa pregunta puntual se queda
  // 'docked' (visible pero sin bloquear el dashboard); el resto de preguntas sí van centradas.
  useEffect(() => {
    if (intakeDone || !preguntaActual) return
    setAgentPanelMode(preguntaActual.kind === 'mapa' ? 'docked' : 'centered')
  }, [preguntaActual?.key, intakeDone])

  // Escape cierra el overlay centrado — pero no mientras bloquea una pregunta del intake
  // (ahí se tiene que responder para avanzar, no se puede simplemente descartar).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && agentPanelMode === 'centered' && intakeDone) setAgentPanelMode('hidden')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [agentPanelMode, intakeDone])

  // Captura de ubicación — mismo mecanismo que Flujo A
  const [ubicInput, setUbicInput] = useState('')
  const [ubicExpandiendo, setUbicExpandiendo] = useState(false)
  const [ubicError, setUbicError] = useState('')
  // Bloque 2 (2.1): capa del mapa de confirmación — calles (default) o satelital.
  const [capaMapa, setCapaMapa] = useState<'calles' | 'satelital'>('calles')
  // Bloque 5 (5.1): selector visible Oferta/Demanda en la pestaña MERCADO.
  const [vistaMercado, setVistaMercado] = useState<'oferta' | 'demanda'>('oferta')
  // Bloque 8 (criterio #2): índice del periodo del flujo de caja seleccionado en FINANCIERO.
  const [mesSeleccionado, setMesSeleccionado] = useState<number | null>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  // Al llegar a la pregunta de ubicación, la Stage salta sola a la pestaña Terreno.
  useEffect(() => {
    if (preguntaActual?.key === 'ubicacion') setTab('terreno')
  }, [preguntaActual?.key])

  function avanzar(respuestaUsuario: string, patch: Partial<FormPreforma>) {
    setForm(f => ({ ...f, ...patch }))
    const siguiente = intakeStep + 1
    setChat(c => [
      ...c,
      { who: 'u', text: respuestaUsuario },
      ...(siguiente < INTAKE.length
        ? [{ who: 'a' as const, text: INTAKE[siguiente].pregunta }]
        : [{ who: 'a' as const, text: 'Con esto ya tengo lo mínimo. Voy a correr a los agentes reales — cada uno tarda entre 20 segundos y 2 minutos, así que el dashboard se va a ir llenando pestaña por pestaña, no de golpe. Puedes ir revisando cada una; mientras un agente sigue trabajando vas a ver "Corriendo el agente…".' }]),
    ])
    setIntakeStep(siguiente)
    setTexto('')
  }

  function enviarTexto() {
    if (!preguntaActual || !texto.trim()) return
    if (preguntaActual.kind === 'texto') avanzar(texto.trim(), { nombreProyecto: texto.trim() })
    else if (preguntaActual.kind === 'numero') {
      const n = Number(texto.trim())
      if (n > 0) avanzar(`${n.toLocaleString('es-MX')} m²`, { superficie: texto.trim() })
    }
  }

  function elegirChipUnico(id: string, label: string) {
    if (!preguntaActual) return
    if (preguntaActual.key === 'presupuesto') avanzar(label, { presupuesto: id })
    else if (preguntaActual.key === 'banda') avanzar(label, { bandaConstruccion: id })
  }

  function toggleChipMulti(id: string) {
    setTipoSel(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  }

  function confirmarTipos() {
    if (tipoSel.length === 0) return
    const labels = TIPOS_DESARROLLO.filter(t => tipoSel.includes(t.id)).map(t => t.label).join(', ')
    avanzar(labels, { tiposDesarrollo: tipoSel })
  }

  // ── Captura de ubicación (Terreno tab) ──
  async function resolverCoords(coords: { lat: number; lng: number }, sourceUrl: string) {
    setForm(f => ({ ...f, lat: coords.lat, lng: coords.lng, mapsLink: sourceUrl }))
    // Mismo paso que Flujo A tras fijar coordenadas — trae colonia/ciudad/estado/CP y
    // características auto-inferidas que sí necesitan los agentes (Terreno/Legal).
    try {
      const res = await authedFetch(`/api/inferir-predio?lat=${coords.lat}&lng=${coords.lng}`)
      const json = await res.json()
      if (json.ok) {
        const inf = json.inferred
        setForm(f => ({
          ...f,
          direccion: inf.direccion || f.direccion,
          colonia: inf.colonia || f.colonia,
          ciudad: inf.ciudad || f.ciudad,
          estado: inf.estado || f.estado,
          codigoPostal: inf.codigoPostal || f.codigoPostal,
          clasificacionVial: inf.clasificacionVial || '',
          pendiente: inf.pendiente || '',
          pavimento: inf.pavimento || '',
          esEsquina: inf.esEsquina || '',
          usoSuelo: inf.usoSuelo || '',
          agua: inf.agua || '',
          electricidad: inf.electricidad || '',
        }))
      }
    } catch { /* si falla, seguimos solo con lat/lng — no bloquea al usuario */ }
  }

  async function manejarUbicInput(valor: string) {
    setUbicInput(valor)
    setUbicError('')
    const directas = extractCoords(valor) || extractCoordsSueltas(valor)
    if (directas) { await resolverCoords(directas, valor); return }
    if (isMapsUrl(valor) && valor.length > 20) {
      setUbicExpandiendo(true)
      try {
        const res = await authedFetch(`/api/geo/expand-maps-url?url=${encodeURIComponent(valor)}`)
        const json = await res.json()
        if (json.lat && json.lng) await resolverCoords({ lat: json.lat, lng: json.lng }, json.expandedUrl || valor)
        else setUbicError(json.error || 'No se pudieron extraer coordenadas. Prueba con un link largo o coordenadas "lat, lng".')
      } catch {
        setUbicError('No se pudo acceder al enlace. Verifica tu conexión.')
      } finally {
        setUbicExpandiendo(false)
      }
    }
  }

  function confirmarUbicacion() {
    if (form.lat == null || form.lng == null) return
    avanzar(`${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`, {})
  }

  // ── Paso 3: pipeline real — mismas llamadas a /api/agentes/* y mismo orden ya
  // optimizado que app/analisis/analizando/page.tsx (Terreno/Legal/Mercado en paralelo
  // desde el arranque, Arquitectura tras Legal, Construcción tras Arquitectura+Terreno,
  // Financiero tras Construcción+Mercado). Duplicado a propósito en vez de compartido —
  // mismo patrón que ya sigue este repo (CashFlowChart/MetricRow/Panel duplicados 2-3
  // veces) para no arriesgar el flujo viejo.
  // Bloque 0: pipe (datos de los 8 agentes) y fields (los 4 "Supuestos editables" con
  // captura dual manual/automático) viven en el store central en vez de useState local —
  // ver app/preforma/store/useProjectStore.ts. La orquestación (fetch, useEffect
  // encadenados, reintentos) sigue exactamente igual, solo cambia dónde se guarda.
  const pipe = useProjectStore((s) => s.pipe)
  const setPipe = useProjectStore((s) => s.setPipe)
  const fields = useProjectStore((s) => s.fields)
  const setFieldManual = useProjectStore((s) => s.setFieldManual)
  const setFieldFromAgent = useProjectStore((s) => s.setFieldFromAgent)
  const resetAllFields = useProjectStore((s) => s.resetAllFields)
  const escenariosGuardados = useProjectStore((s) => s.escenarios)
  const agregarEscenario = useProjectStore((s) => s.agregarEscenario)

  const terrenoActual = pipe.terreno.seleccionada !== null ? pipe.terreno.corridas[pipe.terreno.seleccionada] : null
  const mercadoActual = pipe.mercado.seleccionada !== null ? pipe.mercado.corridas[pipe.mercado.seleccionada] : null
  const arquitecturaActual = pipe.arquitectura.seleccionada !== null ? pipe.arquitectura.corridas[pipe.arquitectura.seleccionada] : null
  const construccionActual = pipe.construccion.seleccionada !== null ? pipe.construccion.corridas[pipe.construccion.seleccionada] : null

  // ── Tiempos por agente — para el semáforo bajo cada pestaña del header (sonar + cronómetro
  // por etapa, visibles los 6 a la vez porque Terreno/Legal/Mercado corren en paralelo). Se
  // marca inicio/fin en cada transición de status a 'running'/'done'|'error' de los run*.
  type Etapa = 'terreno' | 'legal' | 'mercado' | 'arquitectura' | 'construccion' | 'financiero'
  const [tiempos, setTiempos] = useState<Record<Etapa, { inicio: number | null; fin: number | null }>>({
    terreno: { inicio: null, fin: null }, legal: { inicio: null, fin: null }, mercado: { inicio: null, fin: null },
    arquitectura: { inicio: null, fin: null }, construccion: { inicio: null, fin: null }, financiero: { inicio: null, fin: null },
  })
  const marcarInicio = (etapa: Etapa) => setTiempos(t => ({ ...t, [etapa]: { inicio: Date.now(), fin: null } }))
  const marcarFin = (etapa: Etapa) => setTiempos(t => ({ ...t, [etapa]: { ...t[etapa], fin: Date.now() } }))

  // Re-renderiza cada segundo mientras algún agente sigue corriendo, para que el cronómetro
  // del semáforo del header avance en vivo (si no, solo se actualizaría al terminar).
  const [, forzarTick] = useState(0)
  useEffect(() => {
    const algunoCorriendo = ([pipe.terreno, pipe.legal, pipe.mercado, pipe.arquitectura, pipe.construccion, pipe.financiero] as { status: AgentStatus }[])
      .some(p => p.status === 'running')
    if (!algunoCorriendo) return
    const id = setInterval(() => forzarTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [pipe.terreno.status, pipe.legal.status, pipe.mercado.status, pipe.arquitectura.status, pipe.construccion.status, pipe.financiero.status])

  async function runComparables(): Promise<any[]> {
    setPipe(p => ({ ...p, comparables: { status: 'running', data: [] } }))
    try {
      const res = await authedFetch('/api/agentes/comparables', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonia: form.colonia, ciudad: form.ciudad, estado: form.estado, codigoPostal: form.codigoPostal }),
      })
      const json = await res.json()
      const items = json.comparables ?? []
      setPipe(p => ({ ...p, comparables: { status: 'done', data: items } }))
      return items
    } catch {
      setPipe(p => ({ ...p, comparables: { status: 'done', data: [] } }))
      return []
    }
  }

  async function runTerreno(ubicacion: any, comps: any[]) {
    setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'running' } }))
    marcarInicio('terreno')
    try {
      const res = await authedFetch('/api/agentes/terreno', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ubicacion, comparablesPrecargados: comps }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'done', corridas: [...p.terreno.corridas, json], seleccionada: p.terreno.corridas.length } }))
      marcarFin('terreno')
    } catch {
      setPipe(p => ({ ...p, terreno: { ...p.terreno, status: 'error' } }))
      marcarFin('terreno')
    }
  }

  async function runUbicacionYTerreno() {
    if (form.lat == null || form.lng == null) return
    setPipe(p => ({ ...p, ubicacion: { status: 'running', data: null } }))
    const [comps, isoRes] = await Promise.all([
      runComparables(),
      authedFetch('/api/geo/isochrone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: form.lat, lng: form.lng, perfil: 'driving' }),
      }).then(r => r.json()).catch(() => ({ isocronas: [] })),
    ])
    const ubicacionData = { isocronas: isoRes.isocronas ?? [] }
    setPipe(p => ({ ...p, ubicacion: { status: 'done', data: ubicacionData } }))
    runTerreno(ubicacionData, comps)
  }

  async function runLegal() {
    setPipe(p => ({ ...p, legal: { status: 'running', data: null } }))
    marcarInicio('legal')
    try {
      const res = await authedFetch('/api/agentes/legal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, legal: { status: 'done', data: json } }))
      marcarFin('legal')
    } catch {
      setPipe(p => ({ ...p, legal: { status: 'error', data: null } }))
      marcarFin('legal')
    }
  }

  async function runComparablesVenta(): Promise<any[]> {
    setPipe(p => ({ ...p, comparablesVenta: { status: 'running', data: [] } }))
    try {
      const res = await authedFetch('/api/agentes/comparables-venta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colonia: form.colonia, ciudad: form.ciudad, estado: form.estado, codigoPostal: form.codigoPostal, tiposDesarrollo: form.tiposDesarrollo, bandaConstruccion: form.bandaConstruccion, lat: form.lat, lng: form.lng }),
      })
      const json = await res.json()
      const items = json.comparables ?? []
      setPipe(p => ({ ...p, comparablesVenta: { status: 'done', data: items } }))
      return items
    } catch {
      setPipe(p => ({ ...p, comparablesVenta: { status: 'done', data: [] } }))
      return []
    }
  }

  // Independiente del Agente Mercado (LLM) de abajo — si /api/market/resumen falla, no debe
  // tumbar la corrida principal. Solo corre si hay comparables reales que resumir.
  //
  // fichaLegal es opcional: Legal y Mercado arrancan en PARALELO (ver el useEffect de abajo),
  // así que en la primera corrida (dentro de runMercado) casi nunca está listo todavía. Una
  // segunda corrida se dispara sola cuando Legal termina (otro useEffect) y esta vez sí manda
  // productFit -- por eso el endpoint puede llamarse dos veces por análisis, la segunda más
  // completa que la primera.
  async function runMarketResumen(comparablesVenta: any[], fichaLegal?: any) {
    if (comparablesVenta.length === 0) {
      setPipe(p => ({ ...p, marketResumen: { status: 'done', data: null } }))
      return
    }
    setPipe(p => ({ ...p, marketResumen: { status: 'running', data: null } }))
    // Product Fit exige un envolvente normativo real. Solo se arma si Legal ya corrió Y quedó
    // `grounded` (búsqueda real por Serper, no memoria del LLM — ver commit eb8409b): pasar un
    // envolvente basado en una cifra inventada sería justo el problema que se venía corrigiendo
    // toda la sesión. unidadesObjetivo se toma como "si se construyera al máximo de densidad que
    // permite la norma" — es una pregunta real de mercado (¿el mercado soporta el tope legal?),
    // no un valor inventado; sin densidadMaxUnidades no hay con qué evaluarlo y se omite.
    const productFit = (fichaLegal?.grounded === true && typeof fichaLegal.densidadMaxUnidades === 'number')
      ? {
          unidadesObjetivo: fichaLegal.densidadMaxUnidades,
          envolvente: { cumple: fichaLegal.compatible === true, unidadesMax: fichaLegal.densidadMaxUnidades },
        }
      : undefined
    try {
      const res = await authedFetch('/api/market/resumen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparables: comparablesVenta, ciudad: form.ciudad, colonia: form.colonia,
          estado: form.estado, lat: form.lat, lng: form.lng, productFit,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, marketResumen: { status: 'done', data: json } }))
    } catch {
      setPipe(p => ({ ...p, marketResumen: { status: 'error', data: null } }))
    }
  }

  async function runMercado(overrides?: { precioVentaObjetivo?: string; unidadesObjetivo?: string }) {
    setPipe(p => ({ ...p, mercado: { ...p.mercado, status: 'running' } }))
    marcarInicio('mercado')
    const comparablesVenta = await runComparablesVenta()
    runMarketResumen(comparablesVenta) // en paralelo, sin bloquear el Agente Mercado
    try {
      const res = await authedFetch('/api/agentes/mercado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, comparablesPrecargados: comparablesVenta }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, mercado: { ...p.mercado, status: 'done', corridas: [...p.mercado.corridas, json], seleccionada: p.mercado.corridas.length } }))
      marcarFin('mercado')
    } catch {
      setPipe(p => ({ ...p, mercado: { ...p.mercado, status: 'error' } }))
      marcarFin('mercado')
    }
  }

  async function runArquitectura(overrides?: { estacionamientoOverride?: 'subterraneo' | 'nivel' }) {
    setPipe(p => ({ ...p, arquitectura: { ...p.arquitectura, status: 'running' } }))
    marcarInicio('arquitectura')
    try {
      const res = await authedFetch('/api/agentes/arquitectura', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fichaLegal: pipe.legal.data?.fichaLegal, ...overrides }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => {
        const arquitectura = { ...p.arquitectura, status: 'done' as AgentStatus, corridas: [...p.arquitectura.corridas, json], seleccionada: p.arquitectura.corridas.length }
        // Si el usuario cambia el tipo de estacionamiento después de que Construcción/Financiero
        // ya habían corrido, ese diseño anterior queda obsoleto — se reinician a 'waiting' para
        // que los effects de más abajo los vuelvan a correr con el desglose de zonas nuevo.
        const yaHabianCorrido = p.construccion.status !== 'waiting' || p.financiero.status !== 'waiting'
        if (!yaHabianCorrido) return { ...p, arquitectura }
        return {
          ...p, arquitectura,
          construccion: { ...p.construccion, status: 'waiting' as AgentStatus, corridas: [], seleccionada: null },
          financiero: { ...p.financiero, status: 'waiting' as AgentStatus, data: null },
        }
      })
      marcarFin('arquitectura')
    } catch {
      setPipe(p => ({ ...p, arquitectura: { ...p.arquitectura, status: 'error' } }))
      marcarFin('arquitectura')
    }
  }

  async function runConstruccion(overrides?: { bandaConstruccion?: string }) {
    const t = terrenoActual, arq = arquitecturaActual
    if (!t || !arq) return
    const ba = arq.bitacoraArquitectura
    const m2 = fields.costoTerrenoM2.source === 'user' && fields.costoTerrenoM2.value != null ? fields.costoTerrenoM2.value : t.costoTerrenoM2
    const payload = {
      ...form, ...overrides, costoTerrenoM2: m2, costoTerreno: m2 * Number(form.superficie),
      arquitectura: {
        tipologiaPropuesta: ba?.tipologiaPropuesta, desgloseZonas: ba?.desgloseZonas, areaLibreYVerde: ba?.areaLibreYVerde,
        superficieConstruida: arq.superficieConstruida, superficieVendible: arq.superficieVendible,
      },
    }
    setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'running' } }))
    marcarInicio('construccion')
    try {
      const res = await authedFetch('/api/agentes/construccion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const corrida = { ...json, superficieConstruida: arq.superficieConstruida, superficieVendible: arq.superficieVendible }
      setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'done', corridas: [...p.construccion.corridas, corrida], seleccionada: p.construccion.corridas.length } }))
      marcarFin('construccion')
    } catch {
      setPipe(p => ({ ...p, construccion: { ...p.construccion, status: 'error' } }))
      marcarFin('construccion')
    }
  }

  async function runFinanciero() {
    const t = terrenoActual, c = construccionActual
    if (!t || !c) return
    const m2t = fields.costoTerrenoM2.source === 'user' && fields.costoTerrenoM2.value != null ? fields.costoTerrenoM2.value : t.costoTerrenoM2
    const m2c = fields.costoConstruccionM2.source === 'user' && fields.costoConstruccionM2.value != null ? fields.costoConstruccionM2.value : c.construccionM2
    const costoTerreno = m2t * Number(form.superficie)
    const costoTotalConstruccion = c.costoTotalConstruccion || m2c * (c.superficieConstruida || Number(form.superficie) * 1.2)
    const mixHabReal = arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta?.habitacional?.mix ?? []
    const unidadesRealesArquitectura = mixHabReal.reduce((s: number, r: any) => s + (r.unidades || 0), 0)
    const unidadesObjetivoOverride = fields.unidadesObjetivo.source === 'user' ? fields.unidadesObjetivo.value : null
    const unidadesObjetivo = unidadesObjetivoOverride != null ? String(unidadesObjetivoOverride) : (unidadesRealesArquitectura > 0 ? String(unidadesRealesArquitectura) : undefined)
    const precioVentaOverride = fields.precioVentaM2.source === 'user' ? fields.precioVentaM2.value : null
    const payload = {
      ...form, costoTerrenoM2: m2t, costoTerreno, construccionM2: m2c, costoTotalConstruccion,
      superficieConstruida: c.superficieConstruida, superficieVendible: c.superficieVendible,
      fichaLegal: pipe.legal.data?.fichaLegal, mercado: mercadoActual?.mercado,
      precioVentaObjetivo: precioVentaOverride != null ? String(precioVentaOverride) : undefined, unidadesObjetivo,
    }
    setPipe(p => ({ ...p, financiero: { ...p.financiero, status: 'running', data: null } }))
    marcarInicio('financiero')
    try {
      const res = await authedFetch('/api/agentes/financiero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPipe(p => ({ ...p, financiero: { ...p.financiero, status: 'done', data: json } }))
      marcarFin('financiero')
    } catch {
      setPipe(p => ({ ...p, financiero: { ...p.financiero, status: 'error', data: null } }))
      marcarFin('financiero')
    }
  }

  // Arranca el pipeline apenas termina el intake — Terreno/Legal/Mercado juntos.
  const arranqueRef = useRef(false)
  useEffect(() => {
    if (!intakeDone || arranqueRef.current) return
    arranqueRef.current = true
    runUbicacionYTerreno()
    runLegal()
    runMercado()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeDone])

  useEffect(() => {
    if (pipe.legal.status === 'done' && pipe.arquitectura.status === 'waiting') runArquitectura()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipe.legal.status])

  // Segunda corrida de /api/market/resumen, esta vez con productFit -- ver comentario en
  // runMarketResumen sobre por qué la primera (dentro de runMercado) casi nunca lo trae.
  useEffect(() => {
    if (pipe.legal.status === 'done' && pipe.comparablesVenta.status === 'done' && pipe.comparablesVenta.data.length > 0) {
      runMarketResumen(pipe.comparablesVenta.data, pipe.legal.data?.fichaLegal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipe.legal.status])

  useEffect(() => {
    if (pipe.legal.status === 'done' && pipe.arquitectura.status === 'done'
      && pipe.terreno.seleccionada !== null && pipe.arquitectura.seleccionada !== null
      && pipe.construccion.status === 'waiting') runConstruccion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipe.legal.status, pipe.arquitectura.status, pipe.construccion.status, pipe.terreno.seleccionada, pipe.arquitectura.seleccionada])

  useEffect(() => {
    if (pipe.construccion.status === 'done' && pipe.mercado.status === 'done' && pipe.mercado.seleccionada !== null
      && pipe.financiero.status === 'waiting') runFinanciero()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipe.construccion.status, pipe.mercado.status, pipe.mercado.seleccionada])

  // ── Persistencia — reusa la tabla "proyectos" y los endpoints que ya usa el flujo viejo
  // (app/api/save-proyecto, /api/proyectos, /api/delete-proyecto). La columna "flujo" tiene un
  // CHECK constraint que hoy solo acepta 'A'/'B' (y JC ya avisó que PREFORMA también tendrá su
  // propio Flujo A/B más adelante) — así que se manda flujo:'A' y se distingue "esto es un
  // proyecto de PREFORMA" con datos.origen:'preforma' en vez de agregar un valor nuevo a esa
  // columna. app/dashboard/page.tsx (el tablero del flujo viejo) filtra ese mismo marcador para
  // no listar/mezclar estos proyectos ahí — su forma de "datos" no es compatible con esa pantalla.
  // Autoguarda (debounced 2.5s) desde que hay nombre de proyecto, para que una sesión que se
  // cierra a medio intake o a medio pipeline no se pierda — la primera vez crea la fila (sin
  // id), las siguientes la actualizan in-place (con id) en vez de duplicarla.
  const [proyectoId, setProyectoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    if (!form.nombreProyecto) return
    const t = setTimeout(async () => {
      setGuardando(true)
      try {
        const res = await authedFetch('/api/save-proyecto', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: proyectoId, nombre: form.nombreProyecto, datos: { origen: 'preforma', form, pipe }, flujo: 'A' }),
        })
        const json = await res.json()
        if (json.ok && json.id && json.id !== proyectoId) setProyectoId(json.id)
      } catch { /* si falla el autoguardado no interrumpe el flujo — se reintenta en el próximo cambio */ }
      setGuardando(false)
    }, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pipe])

  interface ProyectoGuardado { id: string; nombre: string; status: string; flujo: string; created_at: string; datos?: { origen?: string; form?: FormPreforma; pipe?: any } }
  const [misProyectosAbierto, setMisProyectosAbierto] = useState(false)
  const [misProyectos, setMisProyectos] = useState<ProyectoGuardado[]>([])
  const [cargandoProyectos, setCargandoProyectos] = useState(false)

  async function abrirMisProyectos() {
    setMisProyectosAbierto(true)
    setCargandoProyectos(true)
    try {
      const res = await authedFetch('/api/proyectos')
      const data = await res.json()
      setMisProyectos(Array.isArray(data) ? data.filter((p: ProyectoGuardado) => p.datos?.origen === 'preforma') : [])
    } catch {
      setMisProyectos([])
    } finally {
      setCargandoProyectos(false)
    }
  }

  async function cargarProyecto(id: string) {
    try {
      const p = misProyectos.find(x => x.id === id)
      if (!p?.datos) return
      setForm(p.datos.form ?? FORM_INICIAL)
      const pipeGuardado = p.datos.pipe
      setPipe(() => pipeGuardado)
      // Compat con proyectos guardados antes del Bloque 0 — los overrides vivían dentro de
      // pipe.*.overrideM2/precioVentaObjetivo/unidadesObjetivo; ahora viven en fields.
      if (pipeGuardado?.terreno?.overrideM2) setFieldManual('costoTerrenoM2', Number(pipeGuardado.terreno.overrideM2))
      if (pipeGuardado?.construccion?.overrideM2) setFieldManual('costoConstruccionM2', Number(pipeGuardado.construccion.overrideM2))
      if (pipeGuardado?.financiero?.precioVentaObjetivo) setFieldManual('precioVentaM2', Number(pipeGuardado.financiero.precioVentaObjetivo))
      if (pipeGuardado?.financiero?.unidadesObjetivo) setFieldManual('unidadesObjetivo', Number(pipeGuardado.financiero.unidadesObjetivo))
      setProyectoId(p.id)
      setIntakeStep(INTAKE.length)
      arranqueRef.current = true
      setMisProyectosAbierto(false)
    } catch { /* si falla, se queda en la lista para reintentar */ }
  }

  async function eliminarProyecto(id: string) {
    setMisProyectos(ps => ps.filter(p => p.id !== id))
    try {
      await authedFetch('/api/delete-proyecto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    } catch { /* la lista ya se actualizó optimistamente */ }
  }

  function nuevoAnalisis() {
    setForm(FORM_INICIAL)
    useProjectStore.getState().resetProyecto()
    setIntakeStep(0)
    setChat([{ who: 'a', text: INTAKE[0].pregunta }])
    setTipoSel([])
    setProyectoId(null)
    arranqueRef.current = false
    setTab('resumen')
  }

  // ── Resumen en vivo — mismo motor que Mastermind/el sidebar de analizando/page.tsx ──
  function construirSnapshot() {
    return {
      bitacoraTerreno: terrenoActual?.bitacoraTerreno,
      bitacoraArquitectura: arquitecturaActual?.bitacoraArquitectura,
      bitacoraConstruccion: construccionActual?.bitacoraConstruccion,
      mercado: mercadoActual?.mercado,
    }
  }
  const snapshot = construirSnapshot()
  const baseline = (() => {
    const terreno = extractTerrenoContext(snapshot)
    const proyecto = { ...DEFAULTS.proyecto, ...extractProyectoContext(snapshot) }
    const mercado = { ...DEFAULTS.mercado, ...extractMercadoContext(snapshot) }
    return { terreno, proyecto, mercado }
  })()

  // Sincroniza fields.* con el último valor "de agente" (línea base, sin overrides) — así
  // <DataField/> siempre puede mostrar la sugerencia aunque el usuario esté en Manual, y
  // detectar conflicto si el agente trae algo distinto a lo que ya se capturó a mano.
  useEffect(() => {
    if (terrenoActual?.costoTerrenoM2 != null) setFieldFromAgent('costoTerrenoM2', terrenoActual.costoTerrenoM2)
  }, [terrenoActual?.costoTerrenoM2, setFieldFromAgent])
  useEffect(() => {
    if (construccionActual?.construccionM2 != null) setFieldFromAgent('costoConstruccionM2', construccionActual.construccionM2)
  }, [construccionActual?.construccionM2, setFieldFromAgent])
  useEffect(() => {
    if (mercadoActual && baseline.mercado.precioVentaDepasM2 != null) setFieldFromAgent('precioVentaM2', baseline.mercado.precioVentaDepasM2)
  }, [mercadoActual, baseline.mercado.precioVentaDepasM2, setFieldFromAgent])
  useEffect(() => {
    if (arquitecturaActual && baseline.proyecto.unidadesHabitacionales != null) setFieldFromAgent('unidadesObjetivo', baseline.proyecto.unidadesHabitacionales)
  }, [arquitecturaActual, baseline.proyecto.unidadesHabitacionales, setFieldFromAgent])

  // Bloque 4 — TERRENO/NORMATIVA: mismo mecanismo de captura dual que los campos financieros
  // del Bloque 0/3, vía el hook `useSyncField` (arriba) en vez de 18 useEffect calcados a mano.
  const fichaLegal = pipe.legal.data?.fichaLegal
  useSyncField('superficieTerreno', form.superficie ? Number(form.superficie) : null)
  useSyncField('pendienteTerreno', form.pendiente || null)
  useSyncField('usoSueloTerreno', fichaLegal?.usoSuelo || form.usoSuelo || null)
  useSyncField('esquinaTerreno', form.esEsquina || null)
  useSyncField('clasificacionVialTerreno', form.clasificacionVial || null)
  useSyncField('pavimentoTerreno', form.pavimento || null)
  useSyncField('aguaDisponibilidad', fichaLegal?.factibilidades?.agua?.status || mapServicioBase(form.agua, 'agua'))
  useSyncField('drenajeDisponibilidad', fichaLegal?.factibilidades?.drenaje?.status || null)
  useSyncField('electricidadDisponibilidad', fichaLegal?.factibilidades?.cfe?.status || mapServicioBase(form.electricidad, 'electricidad'))
  useSyncField('cosNormativa', fichaLegal?.cos || null)
  useSyncField('cusNormativa', fichaLegal?.cus || null)
  useSyncField('alturaNormativa', fichaLegal?.altura || null)
  useSyncField('cajonesNormativa', fichaLegal?.cajones || null)
  useSyncField('retirosNormativa', fichaLegal?.retiros || null)
  useSyncField('densidadNormativa', fichaLegal?.densidadAutorizada || null)
  useSyncField('regimenCondominioNormativa', fichaLegal?.regimenCondominio || null)
  useSyncField('compatibleNormativa', fichaLegal?.compatible === true ? 'Compatible' : fichaLegal?.compatible === false ? 'Requiere cambio' : null)
  useSyncField('nivelRiesgoNormativa', fichaLegal?.nivelRiesgo || null)
  useSyncField('nivelesArquitectura', arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta?.niveles ?? null)

  // Bloque 6 — recálculo en vivo de superficie/vendible/unidades a partir de los niveles que el
  // usuario elija, SIN pasar por calcularEnvolvente(): esa función topa el resultado al máximo
  // legal (min(cus×terreno, cos×terreno×niveles)), así que si se usara aquí la propuesta del
  // usuario saldría siempre capada al límite y la alerta de excedente (abajo) nunca dispararía.
  // Se usan las mismas constantes (FACTOR_APROVECHAMIENTO/FACTOR_EFICIENCIA_VENDIBLE) pero sin
  // ese tope — el CUS permitido solo se usa para comparar, no para recortar la propuesta.
  const arquitecturaViva = (() => {
    const ba = arquitecturaActual?.bitacoraArquitectura
    const cosPermitidoPct = parsearNumero(fields.cosNormativa.value ?? fields.cosNormativa.agentValue)
    const cusPermitido = parsearNumero(fields.cusNormativa.value ?? fields.cusNormativa.agentValue)
    const superficieTerrenoNum = numeroDe(fields.superficieTerreno)
    const nivelesOverride = numeroDe(fields.nivelesArquitectura)
    const nivelesAgente = ba?.tipologiaPropuesta?.niveles ?? null
    const niveles = fields.nivelesArquitectura.source === 'user' && nivelesOverride != null ? nivelesOverride : nivelesAgente
    if (cosPermitidoPct == null || superficieTerrenoNum == null || niveles == null || niveles <= 0) return null

    const cosFraccion = cosPermitidoPct / 100
    const tipologia = tipologiaEnvolvente(form.tiposDesarrollo)
    const areaConstruidaPropuesta = cosFraccion * superficieTerrenoNum * niveles * FACTOR_APROVECHAMIENTO.base
    const areaVendiblePropuesta = areaConstruidaPropuesta * FACTOR_EFICIENCIA_VENDIBLE[tipologia].base
    const cusImplicito = cosFraccion * niveles
    const excede = cusPermitido != null && cusImplicito > cusPermitido
    const excedenteM2 = excede ? (cusImplicito - cusPermitido!) * superficieTerrenoNum : 0
    // +1e-9: cusPermitido/cosFraccion es una división de floats (ej. 3.0/0.6) que puede caer
    // justo debajo del entero exacto por error de redondeo binario — sin el epsilon, Math.floor
    // podría sugerir un nivel de menos del que en realidad sí cabe.
    const nivelesSugerido = cusPermitido != null && cosFraccion > 0 ? Math.max(1, Math.floor(cusPermitido / cosFraccion + 1e-9)) : null

    const unidadesBase = ba?.tipologiaPropuesta?.habitacional?.totalDepartamentos
      ?? (ba?.tipologiaPropuesta?.habitacional?.mix ?? []).reduce((s: number, r: any) => s + (r.unidades || 0), 0)
    const areaVendibleBase = arquitecturaActual?.superficieVendible ?? null
    const unidadesEfectivas = areaVendibleBase && unidadesBase
      ? Math.max(0, Math.round(unidadesBase * (areaVendiblePropuesta / areaVendibleBase)))
      : unidadesBase

    // Sótanos — solo cajones estimados (informativo), no se conecta a costo/TIR (ver plan:
    // exigiría modelar un costo de sótano distinto en lib/mastermind/motor.ts, que ningún
    // criterio de aceptación de este bloque pide).
    const sotanosOverride = numeroDe(fields.sotanosArquitectura)
    const sotanos = fields.sotanosArquitectura.source === 'user' && sotanosOverride != null
      ? sotanosOverride
      : (ba?.tipoEstacionamientoFijado === 'subterraneo' ? 1 : 0)
    const M2_POR_CAJON = 28
    const footprint = cosFraccion * superficieTerrenoNum
    const cajonesSotano = sotanos > 0 ? Math.floor((footprint * sotanos) / M2_POR_CAJON) : null

    return {
      niveles, cosPermitidoPct, cusPermitido, cosFraccion, tipologia,
      areaConstruidaPropuesta, areaVendiblePropuesta, cusImplicito, excede, excedenteM2, nivelesSugerido,
      unidadesEfectivas, sotanos, cajonesSotano,
    }
  })()

  const coreInputs = (() => {
    const terreno = { ...baseline.terreno }
    const costoTerrenoM2 = numeroDe(fields.costoTerrenoM2)
    if (fields.costoTerrenoM2.source === 'user' && costoTerrenoM2 != null) {
      terreno.costoTerrenoM2 = costoTerrenoM2
      terreno.costoTerreno = terreno.costoTerrenoM2 * terreno.superficieM2
    }
    const proyecto = { ...baseline.proyecto }
    const costoConstruccionM2 = numeroDe(fields.costoConstruccionM2)
    if (fields.costoConstruccionM2.source === 'user' && costoConstruccionM2 != null) proyecto.costoConstruccionRealM2 = costoConstruccionM2
    // Bloque 6 — niveles editados en ARQUITECTURA mueven superficie/unidades; se aplica ANTES
    // del override de unidadesObjetivo para que este último (más explícito) siga ganando si el
    // usuario también fijó unidades a mano.
    if (fields.nivelesArquitectura.source === 'user' && arquitecturaViva) {
      proyecto.niveles = arquitecturaViva.niveles
      proyecto.superficieConstruccionM2 = arquitecturaViva.areaConstruidaPropuesta
      proyecto.unidadesHabitacionales = arquitecturaViva.unidadesEfectivas
    }
    const unidadesObjetivo = numeroDe(fields.unidadesObjetivo)
    if (fields.unidadesObjetivo.source === 'user' && unidadesObjetivo != null) proyecto.unidadesHabitacionales = unidadesObjetivo
    // Bloque 7 — indirectos/honorarios/imprevistos editables, mismo patrón que costoConstruccionM2.
    const porcentajeIndirectos = numeroDe(fields.porcentajeIndirectos)
    if (fields.porcentajeIndirectos.source === 'user' && porcentajeIndirectos != null) proyecto.porcentajeIndirectos = porcentajeIndirectos
    const porcentajeHonorarios = numeroDe(fields.porcentajeHonorarios)
    if (fields.porcentajeHonorarios.source === 'user' && porcentajeHonorarios != null) proyecto.porcentajeHonorarios = porcentajeHonorarios
    const porcentajeImprevistos = numeroDe(fields.porcentajeImprevistos)
    if (fields.porcentajeImprevistos.source === 'user' && porcentajeImprevistos != null) proyecto.porcentajeImprevistos = porcentajeImprevistos
    const mercado = { ...baseline.mercado }
    const precioVentaM2 = numeroDe(fields.precioVentaM2)
    if (fields.precioVentaM2.source === 'user' && precioVentaM2 != null) mercado.precioVentaDepasM2 = precioVentaM2
    return { terreno, proyecto, mercado }
  })()
  const resumen = calcularMastermindCore(coreInputs)
  const financieroReal = pipe.financiero.data?.financiero
  const estructuraCapital = pipe.financiero.data?.estructuraCapital
  const flujoMensual = pipe.financiero.data?.flujoMensual as any[] | undefined
  const scoreReal = pipe.financiero.data?.score

  // Bloque 3: sincroniza los 3 campos de tasa/plazos con el dato real del Agente Financiero —
  // mismo patrón que los otros 4 (líneas arriba), solo que estos dependen de financieroReal/
  // estructuraCapital, que no existen todavía cuando se declaran los sync effects de arriba.
  useEffect(() => {
    if (financieroReal?.plazoObraMeses) setFieldFromAgent('plazoObraMeses', financieroReal.plazoObraMeses)
  }, [financieroReal?.plazoObraMeses, setFieldFromAgent])
  useEffect(() => {
    if (financieroReal?.plazoVentaMeses) setFieldFromAgent('plazoVentaMeses', financieroReal.plazoVentaMeses)
  }, [financieroReal?.plazoVentaMeses, setFieldFromAgent])
  useEffect(() => {
    if (estructuraCapital?.tasaDeudaAnual) setFieldFromAgent('tasaAnualCredito', estructuraCapital.tasaDeudaAnual)
  }, [estructuraCapital?.tasaDeudaAnual, setFieldFromAgent])

  // Bloque 7: sincroniza los 3 % de overhead (indirectos/honorarios/imprevistos) con lo que ya
  // calculó el Agente Financiero — mismos montos MXN de "Desglose de inversión" (FINANCIERO),
  // pasados por validarIndirectos (ya corre server-side en financiero/route.ts) solo para
  // derivar el % que se muestra/edita aquí.
  const overheadDelAgente = financieroReal
    ? validarIndirectos(financieroReal.indirectos, financieroReal.honorarios, financieroReal.imprevistos, financieroReal.costoTotalConstruccion)
    : null
  useSyncField('porcentajeIndirectos', overheadDelAgente?.indirectosPct ?? null)
  useSyncField('porcentajeHonorarios', overheadDelAgente?.honorariosPct ?? null)
  useSyncField('porcentajeImprevistos', overheadDelAgente?.imprevistosPct ?? null)

  // Bloque 8: mezcla equity/deuda, tipo de deuda y condiciones de preventa — sincronizados
  // desde estructuraCapital (Agente Financiero), editables desde FINANCIERO.
  useSyncField('porcentajeFinanciado', estructuraCapital?.deuda ?? null)
  useSyncField('tipoDeuda', estructuraCapital?.tipoDeuda || null)
  useSyncField('preventaUnidadesMinimas', estructuraCapital?.preventa?.unidadesMinimas ?? null)
  useSyncField('preventaPorcentajeMinimo', estructuraCapital?.preventa?.porcentajeMinimo || null)
  useSyncField('preventaMontoMinimo', estructuraCapital?.preventa?.montoMinimo ?? null)

  // ── Fase 2: matriz de sensibilidad TIR + comparación de escenarios A/B/C — reusa el mismo
  // motor puro que ya usa Mastermind (lib/mastermind/sensibilidad.ts), no se reimplementa.
  // Solo se puede calcular una vez que el Agente Financiero ya corrió: hace falta tiempo/
  // financiamiento calibrados con datos reales (plazo de obra/venta, mezcla deuda/equity) para
  // centrar la matriz en el escenario real, no en un default genérico.
  // Bloque 8 (criterio #3) — plusvalía de zona del Agente Mercado, anualizada (ver
  // lib/mercado/parsearPlusvalia.ts — NO es parsearNumero(): "en N años" ≠ "anual").
  const plusvaliaAnualPct = parsearPlusvaliaAnual(mercadoActual?.mercado?.plusvalia)

  const mastermindInputsCompletos: MastermindInputs | null = financieroReal ? (() => {
    const tiempo = {
      plazoObraMeses: (fields.plazoObraMeses.source === 'user' && numeroDe(fields.plazoObraMeses) != null)
        ? numeroDe(fields.plazoObraMeses)!
        : (financieroReal.plazoObraMeses || DEFAULTS.tiempo.plazoObraMeses),
      plazoVentaMeses: (fields.plazoVentaMeses.source === 'user' && numeroDe(fields.plazoVentaMeses) != null)
        ? numeroDe(fields.plazoVentaMeses)!
        : (financieroReal.plazoVentaMeses || DEFAULTS.tiempo.plazoVentaMeses),
      inicioVentasMes: financieroReal.inicioVentasMes || DEFAULTS.tiempo.inicioVentasMes,
    }
    // Bloque 8 (criterio #3) — se escala precioVentaDepasM2 por la tasa anualizada de plusvalía,
    // al punto medio de la ventana de venta (única curva de precio que soporta el modelo hoy es
    // un escalar plano — ver plan, "fuera de alcance": no se cambia la firma de
    // calcularFlujoFinanciero para aceptar una curva mes a mes).
    const aniosAlPuntoMedio = (tiempo.inicioVentasMes + tiempo.plazoVentaMeses / 2) / 12
    const mercado = plusvaliaAnualPct != null
      ? { ...coreInputs.mercado, precioVentaDepasM2: coreInputs.mercado.precioVentaDepasM2 * Math.pow(1 + plusvaliaAnualPct / 100, aniosAlPuntoMedio) }
      : coreInputs.mercado
    return {
      ...coreInputs,
      mercado,
      tiempo,
      // Bloque 8 (criterio #1) — antes fijo a estructuraCapital?.deuda sin revisar override
      // manual, a diferencia de tasaAnualCredito/plazoObraMeses/plazoVentaMeses (mismo patrón
      // de abajo) — por eso mover la mezcla equity/deuda no movía nada.
      financiamiento: {
        porcentajeFinanciado: (fields.porcentajeFinanciado.source === 'user' && numeroDe(fields.porcentajeFinanciado) != null)
          ? numeroDe(fields.porcentajeFinanciado)!
          : (estructuraCapital?.deuda ?? DEFAULTS.financiamiento.porcentajeFinanciado),
        tasaAnualCredito: (fields.tasaAnualCredito.source === 'user' && numeroDe(fields.tasaAnualCredito) != null)
          ? numeroDe(fields.tasaAnualCredito)!
          : (estructuraCapital?.tasaDeudaAnual ?? DEFAULTS.financiamiento.tasaAnualCredito),
      },
      tirObjetivo: DEFAULTS.tirObjetivo,
    }
  })() : null

  // Escenario "A"/base recalculado SIEMPRE con calcularMastermind (mismo motor que ya usaban
  // B/C) en vez de congelarse en el último financieroReal — antes mover un supuesto en
  // "Supuestos editables" no movía la TIR una vez que el Agente Financiero ya había corrido,
  // porque los KPIs leían financieroReal.x directo (snapshot) sin recalcular con los overrides.
  const escenarioActual: MastermindOutputs | null = mastermindInputsCompletos ? calcularMastermind(mastermindInputsCompletos) : null

  // Delta vs. base para el KPI "TIR Socio" (Bloque 3, 3.3) — compara contra el dato original,
  // sin tocar, del Agente Financiero (no contra el propio escenarioActual, que ya se movió).
  const deltaTirVsBase = (escenarioActual?.retorno.tirSocioAnual != null && financieroReal?.tir != null)
    ? escenarioActual.retorno.tirSocioAnual - financieroReal.tir
    : null

  // Bloque 3 (3.1): matriz con ejes elegibles — generarMatrizSensibilidadFlexible vive en un
  // archivo aparte del original (lib/mastermind/sensibilidad.ts) porque ese lo comparten
  // app/mastermind y exportExcel.ts; no se les cambia la forma por PREFORMA.
  const matrizSensibilidad: SensitivityCellFlex[][] | null = mastermindInputsCompletos
    ? generarMatrizSensibilidadFlexible(
        mastermindInputsCompletos,
        { variable: ejeFilaVar, rango: rangoSensibilidad },
        { variable: ejeColumnaVar, rango: rangoSensibilidad },
      )
    : null

  // Click en una celda → aplica ambas variables al modelo vía el store (mismo mecanismo
  // manual/auto del Bloque 0) — el resto del dashboard reacciona solo porque ya lee
  // escenarioActual/coreInputs del store. Bloque 3, criterio de aceptación #2.
  function aplicarCeldaSensibilidad(celda: SensitivityCellFlex) {
    setFieldManual(VARIABLE_A_FIELDKEY[celda.fila.variable], celda.fila.valor)
    setFieldManual(VARIABLE_A_FIELDKEY[celda.columna.variable], celda.columna.valor)
  }

  // Guarda el estado actualmente aplicado (no una celda en particular) como escenario nuevo
  // — la celda [2][2] de la matriz siempre representa el caso actual (paso relativo 0).
  function guardarEscenarioActual() {
    if (!mastermindInputsCompletos) return
    const letra = String.fromCharCode(66 + escenariosGuardados.length) // B, C, D...
    agregarEscenario(`${letra} · Guardado`, mastermindInputsCompletos as unknown as Record<string, unknown>, escenarioActual?.retorno.tirSocioConverge ? escenarioActual.retorno.tirSocioAnual : null)
  }

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{
        background: `radial-gradient(1100px 500px at 25% -12%, rgba(79,192,141,.09), transparent 62%), ${T.bg}`,
        color: T.ink, fontSize: 12.5, lineHeight: 1.4,
      }}
    >
      {/* ── Header ── */}
      <header className="flex items-center gap-5 px-[18px] shrink-0" style={{ height: 52, borderBottom: `1px solid ${T.line}`, background: 'rgba(6,10,8,.9)' }}>
        <div className="flex items-center gap-2.5" style={{ minWidth: 190 }}>
          <svg width="24" height="28" viewBox="0 0 100 116" fill="none">
            <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BEEFD7"/><stop offset="100%" stopColor="#3FB07E"/></linearGradient></defs>
            <path d="M20 32 L62 8 L88 32 L88 84 L62 108 L62 56" stroke="url(#g1)" strokeWidth="7" strokeLinejoin="round" fill="none"/>
            <path d="M34 84 L34 52 L46 45 L46 77 Z" fill="url(#g1)"/>
            <path d="M52 84 L52 38 L64 31 L64 77 Z" fill="url(#g1)" opacity=".75"/>
          </svg>
          <div>
            <div style={{ fontSize: 15, fontWeight: 200, letterSpacing: '.34em', lineHeight: 1 }}>
              <span style={{ color: '#fff' }}>PRE</span><span style={{ color: T.accent }}>FORMA</span>
            </div>
            <div style={{ fontSize: 6.8, letterSpacing: '.3em', color: T.ink3, marginTop: 4 }}>INTELIGENCIA INMOBILIARIA</div>
          </div>
        </div>

        <nav className="flex gap-0.5 flex-1">
          {TABS.map(t => {
            const etapa = TAB_TO_ETAPA[t.key]
            const st = etapa ? pipe[etapa].status : undefined
            const tt = etapa ? tiempos[etapa] : undefined
            const segundos = tt
              ? st === 'running' && tt.inicio ? Math.floor((Date.now() - tt.inicio) / 1000)
                : (tt.inicio != null && tt.fin != null) ? Math.floor((tt.fin - tt.inicio) / 1000)
                : null
              : null
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex flex-col items-center rounded-md transition-colors cursor-pointer"
                style={{
                  padding: '6px 12px 5px',
                  fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                  color: tab === t.key ? T.accent : T.ink3,
                  background: tab === t.key ? 'rgba(126,217,174,.08)' : 'transparent',
                  boxShadow: tab === t.key ? `inset 0 -1px 0 ${T.accent}` : 'none',
                }}
                title={segundos != null ? `${segundos}s` : undefined}
              >
                {t.label}
                {/* Alto reservado siempre igual (running/done/error/waiting) para que el
                    cambio de estado no mueva el layout del header — Bloque 1, 1.2. */}
                {etapa && (
                  // Compacto a propósito — el sonar grande (~3cm) vive en CardPendiente, en el
                  // área de contenido de la pestaña, donde sí hay espacio sin apretar el header.
                  // Este punto es el semáforo permanente (Bloque 1, checklist #6), no el sonar.
                  <span className="flex items-center justify-center" style={{ height: 10, marginTop: 3 }}>
                    {st === 'running' ? (
                      <Sonar color={T.warn} size={14} />
                    ) : (
                      <span
                        className="inline-block rounded-full"
                        style={{
                          width: 6, height: 6,
                          background: st === 'done' ? T.accent : st === 'error' ? T.bad : 'transparent',
                          border: st === 'waiting' || !st ? `1px solid ${T.line2}` : 'none',
                        }}
                      />
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div
          className="flex items-center gap-[7px] shrink-0"
          style={{ width: 210, height: 29, padding: '0 11px', border: `1px solid ${T.line}`, borderRadius: 15, color: T.ink3, fontSize: 10.5 }}
        >
          <span>⌕</span>
          <input
            placeholder="Buscar proyecto o coordenadas…"
            className="bg-transparent border-none outline-none w-full"
            style={{ color: T.ink, fontSize: 10.5, fontFamily: 'inherit' }}
          />
        </div>
        {form.nombreProyecto && (
          <span className="shrink-0" style={{ fontSize: 9, letterSpacing: '.08em', color: T.ink4 }}>
            {guardando ? 'Guardando…' : proyectoId ? 'Guardado' : ''}
          </span>
        )}
        <button
          onClick={abrirMisProyectos}
          className="cursor-pointer shrink-0"
          style={{ height: 29, padding: '0 13px', borderRadius: 15, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', border: `1px solid ${T.line2}`, color: T.ink2 }}
        >
          Mis proyectos
        </button>
        <button
          onClick={nuevoAnalisis}
          className="inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          style={{
            height: 29, padding: '0 13px', borderRadius: 15, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
            background: 'rgba(126,217,174,.12)', border: '1px solid rgba(126,217,174,.45)', color: T.accent,
          }}
        >
          Nuevo análisis +
        </button>
        <button
          className="cursor-pointer shrink-0"
          style={{ height: 29, padding: '0 13px', borderRadius: 15, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', border: `1px solid ${T.line2}`, color: T.ink2 }}
        >
          Exportar
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setUsuarioMenuAbierto(v => !v)}
            title={email || 'Cuenta'}
            className="rounded-full flex items-center justify-center cursor-pointer"
            style={{ width: 28, height: 28, border: `1px solid ${T.line2}`, fontSize: 9.5, color: T.ink2 }}
          >
            JCA
          </button>
          {usuarioMenuAbierto && (
            <div
              className="absolute rounded-md overflow-hidden"
              style={{ top: 34, right: 0, minWidth: 170, zIndex: 30, border: `1px solid ${T.line}`, background: T.panel, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}
            >
              <div style={{ padding: '9px 12px', borderBottom: `1px solid ${T.line}` }}>
                <p className="truncate" style={{ fontSize: 10.5, color: T.ink }}>{email || 'Cuenta'}</p>
              </div>
              <button
                onClick={cerrarSesion}
                className="w-full text-left cursor-pointer"
                style={{ padding: '8px 12px', fontSize: 10.5, color: T.ink2 }}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Shell de 2/3 columnas — la 3ª (agente) solo existe en modo 'docked' (Bloque 1, 1.1) ── */}
      <div
        data-testid="stage-grid"
        className="flex-1 min-h-0 grid overflow-hidden"
        style={{ gridTemplateColumns: agentPanelMode === 'docked' ? '212px 1fr 286px' : '212px 1fr', transition: 'grid-template-columns 200ms ease' }}
      >

        {/* ── Rail izquierdo: ficha del proyecto (Bloque 1, 1.3: sin scroll) ── */}
        <aside className="flex flex-col gap-1.5 p-2 overflow-hidden" style={{ borderRight: `1px solid ${T.line}` }}>
          <Card flex="none">
            <Cb style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 14, fontWeight: 300, letterSpacing: '.1em', padding: '1px 2px 4px' }}>{form.nombreProyecto || '—'}</div>
              <Pill>Escenario A</Pill>
              <div style={{ marginTop: 5 }}>
                <Kv label="Ubicación" value={form.ciudad ? `${form.ciudad}, ${form.estado}` : '—'} />
                <Kv label="Superficie" value={form.superficie ? `${Number(form.superficie).toLocaleString('es-MX')} m²` : '—'} />
                <Kv label="Uso de suelo" value={pipe.legal.data?.fichaLegal?.usoSuelo || (form.tiposDesarrollo[0] ? TIPOS_DESARROLLO.find(t => t.id === form.tiposDesarrollo[0])?.label : '—') || '—'} />
                <div className="grid grid-cols-2 gap-x-3" style={{ marginTop: 0 }}>
                  <Kv label="COS" value={pipe.legal.data?.fichaLegal?.cos ?? '—'} />
                  <Kv label="CUS" value={pipe.legal.data?.fichaLegal?.cus ?? '—'} />
                  <Kv label="Altura" value={pipe.legal.data?.fichaLegal?.altura ?? '—'} />
                  <Kv label="Densidad" value={pipe.legal.data?.fichaLegal?.densidadAutorizada ?? '—'} />
                </div>
                <Kv label="Vendible" value={arquitecturaActual?.superficieVendible ? `${Math.round(arquitecturaActual.superficieVendible).toLocaleString('es-MX')} m²` : '—'} />
                <Kv label="Coordenadas" value={form.lat != null ? `${form.lat.toFixed(4)}, ${form.lng!.toFixed(4)}` : '—'} />
                <Kv label="Actualizado" value={intakeDone ? new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              </div>
            </Cb>
          </Card>

          <Card flex="none">
            <CardHead>Potencial del terreno</CardHead>
            <Cb style={{ padding: '7px 10px' }}>
              <div className="flex items-baseline gap-2" style={{ padding: '1px 0 4px' }}>
                <span style={{ fontSize: 26, fontWeight: 200, color: terrenoActual?.bitacoraTerreno?.indiceConfiabilidad?.score != null ? T.accent : T.ink4 }}>
                  {terrenoActual?.bitacoraTerreno?.indiceConfiabilidad?.score ?? '—'}
                </span>
                <Mini>/100</Mini>
              </div>
              {/* Cada barra sale de un dato real ya capturado/calculado (nunca inventado) —
                  se queda en "pendiente" hasta que ese dato exista. */}
              <FactorBar
                label="Viabilidad normativa"
                pct={pipe.legal.data?.fichaLegal?.compatible === true ? 88 : pipe.legal.data?.fichaLegal?.compatible === false ? 25 : null}
              />
              <FactorBar
                label="Demanda de mercado"
                pct={mercadoActual?.mercado?.demanda === 'Alta' ? 85 : mercadoActual?.mercado?.demanda === 'Media' ? 55 : mercadoActual?.mercado?.demanda === 'Baja' ? 22 : null}
                color={T.s1}
              />
              <FactorBar label="Accesibilidad" pct={null} />
              <FactorBar
                label="Topografía"
                pct={form.pendiente === 'plano' ? 90 : form.pendiente === 'suave' ? 70 : form.pendiente === 'moderada' ? 45 : form.pendiente === 'pronunciada' ? 20 : null}
                color={T.s2}
              />
              <FactorBar
                label="Factibilidades"
                pct={(() => {
                  const f = pipe.legal.data?.fichaLegal?.factibilidades
                  if (!f) return null
                  const vals = [f.agua, f.drenaje, f.cfe].filter(Boolean).map((x: any) => x.status === 'Disponible' ? 100 : x.status === 'Con condicionante' ? 50 : 10)
                  return vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null
                })()}
                color={T.bad}
              />
            </Cb>
          </Card>

          <Card>
            <CardHead right={
              mastermindInputsCompletos
                ? <button onClick={guardarEscenarioActual} className="cursor-pointer" style={{ fontSize: 9.5, letterSpacing: '.11em', textTransform: 'uppercase', color: T.ink3 }}>+ Nuevo</button>
                : undefined
            }>
              Escenarios
            </CardHead>
            <Cb style={{ padding: 0 }}>
              <ScenarioRow
                nombre={`A · ${form.tiposDesarrollo.map(id => TIPOS_DESARROLLO.find(t => t.id === id)?.label).filter(Boolean).join(', ') || 'Sin definir'}`}
                sub={arquitecturaActual ? `${arquitecturaActual.bitacoraArquitectura?.tipologiaPropuesta?.niveles ?? '—'} niveles · ${Math.round(arquitecturaActual.superficieVendible || 0).toLocaleString('es-MX')} m²` : 'Esperando captura'}
                tir={escenarioActual?.retorno.tirSocioConverge ? `${escenarioActual.retorno.tirSocioAnual!.toFixed(1)}%` : '—'}
                color={T.accent}
                activo
              />
              {/* Bloque 3 (3.1): escenarios guardados de verdad desde la matriz de sensibilidad
                  — antes eran 2 simulaciones fijas (B Conservador/C Optimista) que nunca se
                  guardaban; ahora es lo que el usuario decida comparar. */}
              {escenariosGuardados.map((e, i) => (
                <ScenarioRow
                  key={e.id}
                  nombre={e.nombre}
                  sub="Escenario guardado"
                  tir={e.tir != null ? `${e.tir.toFixed(1)}%` : '—'}
                  color={[T.s2, T.s1, T.s3, T.bad, T.accent2][i % 5]}
                />
              ))}
            </Cb>
          </Card>
        </aside>

        {/* ── Stage central ── */}
        {/* Bloque 0 (0.3): sin scroll — el rail izquierdo (<aside> de arriba) todavía tiene
            overflow-y-auto a propósito, su rediseño de contenido es el Bloque 1 (§1.3). */}
        <main className="p-2.5 overflow-hidden flex flex-col gap-2 min-w-0">
          {tab === 'resumen' && (
            <>
              <div className="grid gap-px rounded-[9px] border overflow-hidden shrink-0" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', background: T.line, borderColor: T.line }}>
                {/* "TIR Socio" — así se le llama a este mismo dato en el resto de la app
                    (propuesta/analisis); el prototipo lo etiquetaba "TIR del proyecto" pero no
                    tenemos un segundo TIR sin apalancar por separado, así que evito inventarlo. */}
                <Kpi
                  label="TIR Socio"
                  value={escenarioActual?.retorno.tirSocioConverge ? `${escenarioActual.retorno.tirSocioAnual!.toFixed(1)}%` : '—'}
                  sub={
                    !escenarioActual ? 'Esperando Agente Financiero'
                      : (deltaTirVsBase != null && Math.abs(deltaTirVsBase) >= 0.05)
                        ? `${deltaTirVsBase > 0 ? '+' : ''}${deltaTirVsBase.toFixed(1)} pts vs. base`
                        : 'caso base'
                  }
                  hero
                />
                <Kpi label="Margen bruto" value={terrenoActual ? `${(escenarioActual?.utilidad.margenBruto ?? resumen.utilidad.margenBruto).toFixed(1)}%` : '—'} />
                <Kpi label="Utilidad neta" value={terrenoActual ? fmtM(escenarioActual?.utilidad.utilidadAntesImpuestos ?? resumen.utilidad.utilidadAntesImpuestos) : '—'} />
                <Kpi label="Inversión total" value={terrenoActual ? fmtM(escenarioActual?.costos.costoTotal ?? resumen.costos.costoTotal) : '—'} />
                <Kpi label="Plazo" value={mastermindInputsCompletos ? `${mastermindInputsCompletos.tiempo.plazoVentaMeses} m` : '—'} />
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1.34fr 1fr', flex: 1, minHeight: 0 }}>
                <div className="flex flex-col gap-2 min-h-0">
                  <SitioYContexto
                    flex="1.05"
                    lat={form.lat} lng={form.lng} pendiente={form.pendiente}
                    emptyText="Aparece en cuanto captures la ubicación"
                    planoUrl={form.planoUrl} proyectoId={proyectoId}
                    onPlanoSubido={url => setForm(f => ({ ...f, planoUrl: url }))}
                  />
                  {flujoMensual && flujoMensual.length > 0 ? (
                    <Card flex="1.25">
                      <CardHead>Ingresos y egresos</CardHead>
                      <div style={{ flex: 1, minHeight: 0, padding: '8px 4px' }}><CashFlowChart data={flujoMensual as FlujoMesPre[]} /></div>
                      <div className="flex gap-4" style={{ padding: '4px 11px 8px', fontSize: 9.5, color: T.ink3 }}>
                        <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: T.s1 }} />Ingresos</span>
                        <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: T.s2 }} />Egresos</span>
                      </div>
                    </Card>
                  ) : (
                    <CardPendiente titulo="Ingresos y egresos" flex="1.25" nota="Flujo de caja del Agente Financiero" estado={pipe.financiero.status} color={T.accent} onReintentar={pipe.financiero.status === 'error' ? () => runFinanciero() : undefined} />
                  )}
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                  {matrizSensibilidad ? (
                    <Card>
                      <CardHead>Sensibilidad · TIR</CardHead>
                      <MatrizSensibilidad
                        matriz={matrizSensibilidad}
                        ejeFila={ejeFilaVar} ejeColumna={ejeColumnaVar} rango={rangoSensibilidad}
                        onEjeFila={setEjeFilaVar} onEjeColumna={setEjeColumnaVar} onRango={setRangoSensibilidad}
                        onAplicar={aplicarCeldaSensibilidad} onGuardar={guardarEscenarioActual}
                      />
                    </Card>
                  ) : (
                    <CardPendiente titulo="Sensibilidad · TIR" nota="Se calcula en cuanto corre el Agente Financiero" estado={pipe.financiero.status} />
                  )}
                  <Card>
                    <CardHead right={
                      fields.costoTerrenoM2.source === 'user' || fields.costoConstruccionM2.source === 'user' || fields.precioVentaM2.source === 'user' || fields.unidadesObjetivo.source === 'user'
                        ? <button onClick={resetAllFields} style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, cursor: 'pointer' }}>Restaurar</button>
                        : undefined}>
                      Supuestos editables
                    </CardHead>
                    <div className="flex flex-col gap-1" style={{ flex: 1, minHeight: 0, padding: '6px 0' }}>
                      <DataField
                        fieldKey="costoTerrenoM2" label="Costo terreno $/m²" unit="/m²" step={500}
                        rangoSugerido={terrenoActual?.bitacoraTerreno?.rangoValoracion ? [terrenoActual.bitacoraTerreno.rangoValoracion.minimo, terrenoActual.bitacoraTerreno.rangoValoracion.maximo] : undefined}
                      />
                      <DataField
                        fieldKey="costoConstruccionM2" label="Costo construcción $/m²" unit="/m²" step={500}
                        rangoSugerido={construccionActual?.bitacoraConstruccion?.rangoReferencia ? [construccionActual.bitacoraConstruccion.rangoReferencia.minimo, construccionActual.bitacoraConstruccion.rangoReferencia.maximo] : undefined}
                      />
                      <DataField fieldKey="precioVentaM2" label="Precio de venta $/m²" unit="/m²" step={500} />
                      <DataField fieldKey="unidadesObjetivo" label="Unidades objetivo" step={1} />
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
          {tab === 'terreno' && (
            preguntaActual?.key === 'ubicacion' ? (
              <Card>
                <CardHead>Ubicar el predio</CardHead>
                <Cb>
                  <p style={{ fontSize: 11, color: T.ink2, marginBottom: 6 }}>
                    Escribe la dirección y elígela de la lista, o pega un link de Google Maps / coordenadas tipo Google Earth.
                  </p>
                  <DireccionAutocomplete onLugar={(coords, direccion) => resolverCoords(coords, direccion)} />
                  <input
                    autoFocus
                    value={ubicInput}
                    onChange={e => manejarUbicInput(e.target.value)}
                    placeholder="https://maps.app.goo.gl/… o 25.6547, -100.4033"
                    className="w-full outline-none"
                    style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: T.ink, marginBottom: 10 }}
                  />
                  {ubicExpandiendo && <p style={{ fontSize: 11, color: T.accent, marginBottom: 8 }}>Leyendo enlace…</p>}
                  {ubicError && <p style={{ fontSize: 11, color: T.bad, marginBottom: 8 }}>{ubicError}</p>}
                  {form.lat != null && form.lng != null && (
                    <>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <p style={{ fontSize: 11, color: T.ink2, fontWeight: 600 }}>¿Este es el predio?</p>
                        <div className="flex gap-1">
                          {(['calles', 'satelital'] as const).map(c => (
                            <button
                              key={c}
                              onClick={() => setCapaMapa(c)}
                              className="cursor-pointer"
                              style={{
                                fontSize: 9.5, padding: '3px 9px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.08em',
                                border: `1px solid ${capaMapa === c ? 'rgba(126,217,174,.45)' : T.line2}`,
                                background: capaMapa === c ? 'rgba(126,217,174,.12)' : 'transparent',
                                color: capaMapa === c ? T.accent : T.ink3,
                              }}
                            >
                              {c === 'calles' ? 'Calles' : 'Satelital'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <LeafletPicker lat={form.lat} lng={form.lng} onMove={(lat, lng) => setForm(f => ({ ...f, lat, lng }))} capa={capaMapa} />
                      <p style={{ fontSize: 10, color: T.ink4, marginTop: 6, fontFamily: 'monospace' }}>{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>
                      <button
                        onClick={confirmarUbicacion}
                        className="cursor-pointer"
                        style={{ marginTop: 10, height: 32, padding: '0 16px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: 'rgba(126,217,174,.15)', border: '1px solid rgba(126,217,174,.45)', color: T.accent }}
                      >
                        Sí, confirmar ubicación →
                      </button>
                    </>
                  )}
                </Cb>
              </Card>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                <SitioYContexto
                  lat={form.lat} lng={form.lng} pendiente={form.pendiente}
                  emptyText="—"
                  planoUrl={form.planoUrl} proyectoId={proyectoId}
                  onPlanoSubido={url => setForm(f => ({ ...f, planoUrl: url }))}
                />
                <div className="flex flex-col gap-2 min-h-0">
                  <Card>
                    <CardHead right={terrenoActual?.bitacoraTerreno?.indiceConfiabilidad?.semaforo
                      ? <Mini>{terrenoActual.bitacoraTerreno.indiceConfiabilidad.semaforo}</Mini> : undefined}>
                      Características físicas
                    </CardHead>
                    <div className="flex flex-col gap-1" style={{ flex: 1, minHeight: 0, padding: '6px 0' }}>
                      <DataField fieldKey="superficieTerreno" label="Superficie" type="number" unit=" m²" step={10} />
                      <DataField fieldKey="pendienteTerreno" label="Pendiente" type="select" opciones={PENDIENTE_OPCIONES} />
                      <DataField fieldKey="usoSueloTerreno" label="Uso de suelo" type="select" opciones={USO_SUELO_OPCIONES} />
                      <DataField fieldKey="esquinaTerreno" label="Estado del predio" type="select" opciones={ESQUINA_OPCIONES} />
                      <div style={{ padding: '7px 10px' }}><Kv label="Precio calculado" value={terrenoActual ? `${fmt(terrenoActual.costoTerrenoM2)}/m²` : '—'} /></div>
                    </div>
                  </Card>
                  <Card>
                    <CardHead>Accesibilidad y servicios</CardHead>
                    <div className="flex flex-col gap-1" style={{ flex: 1, minHeight: 0, padding: '6px 0' }}>
                      <DataField fieldKey="clasificacionVialTerreno" label="Clasificación vial" type="select" opciones={VIALIDAD_OPCIONES} />
                      <DataField fieldKey="pavimentoTerreno" label="Pavimento frente" type="select" opciones={PAVIMENTO_OPCIONES} />
                      <DataField fieldKey="aguaDisponibilidad" label="Agua potable" type="select" opciones={SERVICIO_OPCIONES} />
                      <DataField fieldKey="drenajeDisponibilidad" label="Drenaje" type="select" opciones={SERVICIO_OPCIONES} />
                      <DataField fieldKey="electricidadDisponibilidad" label="Energía eléctrica" type="select" opciones={SERVICIO_OPCIONES} />
                    </div>
                  </Card>
                  {terrenoActual?.bitacoraTerreno?.indiceConfiabilidad?.interpretacion ? (
                    <Card flex="none">
                      <CardHead>Lectura del Agente Terreno</CardHead>
                      <Cb>
                        <p style={{ fontSize: 11, color: T.ink2, lineHeight: 1.6, marginBottom: terrenoActual.bitacoraTerreno.fuentesComparables?.length ? 8 : 0 }}>
                          {terrenoActual.bitacoraTerreno.indiceConfiabilidad.interpretacion}
                        </p>
                        {terrenoActual.bitacoraTerreno.fuentesComparables?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {terrenoActual.bitacoraTerreno.fuentesComparables.map((c: any, i: number) => (
                              <Pill key={i} tone={c.origen === 'web_search' ? 'accent' : 'muted'}>
                                <span title={`${c.portal ?? 'Fuente'} · ${c.colonia ?? ''} · ${c.precioM2 ? fmt(c.precioM2) + '/m²' : ''} · ${c.fechaPublicacion ?? ''}`}>
                                  {c.portal ?? 'Fuente'}{c.precioM2 ? ` · ${fmt(c.precioM2)}/m²` : ''}
                                </span>
                              </Pill>
                            ))}
                          </div>
                        )}
                      </Cb>
                    </Card>
                  ) : form.lat != null ? (
                    <CardPendiente
                      titulo="Lectura del Agente Terreno"
                      nota="Se llena con el Agente Terreno"
                      estado={pipe.terreno.status}
                      color={T.accent}
                      onReintentar={pipe.terreno.status === 'error' ? () => runUbicacionYTerreno() : undefined}
                    />
                  ) : null}
                </div>
              </div>
            )
          )}
          {tab === 'normativa' && (
            pipe.legal.data?.fichaLegal ? (() => {
              const fl = pipe.legal.data.fichaLegal
              // Bloque 4 (4.2): tabla Permitido/Proyecto/Estatus + barras comparativas para
              // COS/CUS — "Proyecto" usa el dato que ya devuelve el Agente Arquitectura
              // (bitacoraArquitectura.cosEstimado/cusEstimado/niveles), sin esperar al
              // Bloque 6. "Permitido" lee el mismo DataField editable de más abajo, no un
              // valor aparte — un solo dato, dos vistas.
              const cosPermitidoTexto = fields.cosNormativa.value ?? fields.cosNormativa.agentValue
              const cusPermitidoTexto = fields.cusNormativa.value ?? fields.cusNormativa.agentValue
              const alturaPermitidoTexto = fields.alturaNormativa.value ?? fields.alturaNormativa.agentValue
              const cosProyectoTexto = arquitecturaActual?.bitacoraArquitectura?.cosEstimado ?? null
              const cusProyectoTexto = arquitecturaActual?.bitacoraArquitectura?.cusEstimado ?? null
              const nivelesProyecto = arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta?.niveles ?? null
              const alturaProyectoTexto = nivelesProyecto != null ? `${nivelesProyecto} niveles` : null
              const cosPermitido = parsearNumero(cosPermitidoTexto)
              const cusPermitido = parsearNumero(cusPermitidoTexto)
              const filasEnvolvente = [
                { param: 'COS', permitidoTexto: cosPermitidoTexto, proyectoTexto: cosProyectoTexto, permitido: cosPermitido, proyecto: parsearNumero(cosProyectoTexto) },
                { param: 'CUS', permitidoTexto: cusPermitidoTexto, proyectoTexto: cusProyectoTexto, permitido: cusPermitido, proyecto: parsearNumero(cusProyectoTexto) },
                { param: 'Altura', permitidoTexto: alturaPermitidoTexto, proyectoTexto: alturaProyectoTexto, permitido: parsearNumero(alturaPermitidoTexto), proyecto: nivelesProyecto },
              ]
              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead right={
                        <div className="flex items-center gap-2">
                          <Mini>{fl.municipio}</Mini>
                          <Pill tone={fl.grounded ? 'accent' : 'muted'}>{fl.grounded ? 'Con fuente real' : 'Sin verificar'}</Pill>
                        </div>
                      }>Envolvente normativa</CardHead>
                      <Cb>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Parámetro</th>
                              <th style={{ textAlign: 'right', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Permitido</th>
                              <th style={{ textAlign: 'right', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Proyecto</th>
                              <th style={{ textAlign: 'right', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Estatus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filasEnvolvente.map((f) => {
                              const estado = estatusComparacion(f.permitido, f.proyecto)
                              return (
                                <tr key={f.param}>
                                  <td style={{ fontSize: 10, color: T.ink2, padding: '2px 0' }}>{f.param}</td>
                                  <td style={{ fontSize: 10, color: T.ink, textAlign: 'right' }}>{f.permitidoTexto ?? '—'}</td>
                                  <td style={{ fontSize: 10, color: T.ink, textAlign: 'right' }}>{f.proyectoTexto ?? '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <SemaforoParametro estado={estado} label={estado === 'cumple' ? 'Cumple' : estado === 'limite' ? 'Al límite' : estado === 'excede' ? 'Excede' : '—'} />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {cosPermitido != null && (
                          <BarraEnvolvente label="COS" permitido={cosPermitido} proyecto={parsearNumero(cosProyectoTexto)} estado={estatusComparacion(cosPermitido, parsearNumero(cosProyectoTexto))} />
                        )}
                        {cusPermitido != null && (
                          <BarraEnvolvente label="CUS" permitido={cusPermitido} proyecto={parsearNumero(cusProyectoTexto)} estado={estatusComparacion(cusPermitido, parsearNumero(cusProyectoTexto))} />
                        )}
                      </Cb>
                    </Card>
                    <Card>
                      <CardHead>Parámetros normativos</CardHead>
                      <div className="flex flex-col gap-1" style={{ flex: 1, minHeight: 0, padding: '6px 0' }}>
                        <DataField fieldKey="cosNormativa" label="COS" type="text" />
                        <DataField fieldKey="cusNormativa" label="CUS" type="text" />
                        <DataField fieldKey="alturaNormativa" label="Altura máxima" type="text" />
                        <DataField fieldKey="cajonesNormativa" label="Cajones" type="text" />
                        <DataField fieldKey="retirosNormativa" label="Retiros" type="text" />
                        <DataField fieldKey="densidadNormativa" label="Densidad autorizada" type="text" />
                        <DataField fieldKey="regimenCondominioNormativa" label="Régimen de condominio" type="text" />
                      </div>
                    </Card>
                    <Card flex="none">
                      <CardHead>Restricción principal</CardHead>
                      <Cb><p style={{ fontSize: 11, color: T.ink2, lineHeight: 1.6 }}>{fl.restriccion || '—'}</p></Cb>
                    </Card>
                  </div>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead>Compatibilidad</CardHead>
                      <div className="flex flex-col gap-1" style={{ padding: '6px 0' }}>
                        <DataField fieldKey="compatibleNormativa" label="Uso de suelo" type="select" opciones={COMPATIBLE_OPCIONES} />
                        <DataField fieldKey="nivelRiesgoNormativa" label="Nivel de riesgo" type="select" opciones={NIVEL_RIESGO_OPCIONES} />
                      </div>
                    </Card>
                    {fl.factibilidades && (
                      <Card flex="none">
                        <CardHead>Factibilidades</CardHead>
                        <div className="flex flex-col gap-1" style={{ padding: '6px 0' }}>
                          <DataField fieldKey="aguaDisponibilidad" label="Agua" type="select" opciones={SERVICIO_OPCIONES} />
                          <DataField fieldKey="drenajeDisponibilidad" label="Drenaje" type="select" opciones={SERVICIO_OPCIONES} />
                          <DataField fieldKey="electricidadDisponibilidad" label="CFE" type="select" opciones={SERVICIO_OPCIONES} />
                        </div>
                      </Card>
                    )}
                    {fl.alertasLegales && fl.alertasLegales.length > 0 && (
                      <Card>
                        <CardHead right={<Mini>{fl.alertasLegales.length}</Mini>}>Alertas legales</CardHead>
                        <Cb style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {fl.alertasLegales.map((a: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-lg"
                              style={{
                                padding: '8px 10px',
                                background: a.status === 'red' ? 'rgba(192,90,62,.1)' : a.status === 'amber' ? 'rgba(196,132,42,.1)' : 'rgba(18,169,141,.1)',
                                border: `1px solid ${a.status === 'red' ? T.bad : a.status === 'amber' ? T.s2 : T.s1}40`,
                              }}
                            >
                              <p style={{ fontSize: 11, fontWeight: 600, color: T.ink }}>{a.tipo}</p>
                              <p style={{ fontSize: 10.5, color: T.ink2, marginTop: 2 }}>{a.impacto || a.descripcion}</p>
                            </div>
                          ))}
                        </Cb>
                      </Card>
                    )}
                    {(() => {
                      const fuentesReales: { url: string; titulo: string }[] = pipe.legal.data?.fuentesConsultadas ?? []
                      const fuentesLegal: { nombre: string; tipo: string }[] = pipe.legal.data?.fuentes?.legal ?? []
                      if (fuentesReales.length === 0 && fuentesLegal.length === 0) return null
                      return (
                        <Card flex="none">
                          <CardHead>Fuentes</CardHead>
                          <Cb style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {!fl.grounded && (
                              <p style={{ fontSize: 9.5, color: T.ink3, lineHeight: 1.5 }}>
                                Sin búsqueda real confirmada para este municipio/colonia — lo de abajo es lo que el
                                modelo reporta, no fuentes verificadas.
                              </p>
                            )}
                            {fuentesReales.length > 0 && (
                              <div className="flex flex-col gap-1">
                                {fuentesReales.map((f, i) => (
                                  <a key={i} href={f.url} target="_blank" rel="noreferrer"
                                    style={{ fontSize: 10, color: T.accent, textDecoration: 'none', lineHeight: 1.4 }}>
                                    {f.titulo || f.url}
                                  </a>
                                ))}
                              </div>
                            )}
                            {fuentesLegal.length > 0 && (
                              <div className="flex flex-col gap-0.5" style={{ marginTop: fuentesReales.length > 0 ? 4 : 0 }}>
                                {fuentesLegal.map((f, i) => (
                                  <p key={i} style={{ fontSize: 9.5, color: T.ink3 }}>· {f.nombre} <span style={{ color: T.ink4 }}>({f.tipo})</span></p>
                                ))}
                              </div>
                            )}
                          </Cb>
                        </Card>
                      )
                    })()}
                  </div>
                </div>
              )
            })() : <CardPendiente titulo="Normativa" nota="Se llena con el Agente Normativa" estado={pipe.legal.status} color={T.s3} onReintentar={pipe.legal.status === 'error' ? () => runLegal() : undefined} />
          )}
          {tab === 'mercado' && (
            mercadoActual?.mercado ? (() => {
              const m = mercadoActual.mercado
              const comparables: any[] = m.comparables ?? []
              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card>
                      <CardHead right={
                        <div className="flex items-center gap-2">
                          {m.zona && <Mini>{m.zona}</Mini>}
                          <div className="flex items-center gap-0.5 rounded-full" style={{ border: `1px solid ${T.line}`, padding: 1 }}>
                            {(['oferta', 'demanda'] as const).map((v) => (
                              <button
                                key={v}
                                onClick={() => setVistaMercado(v)}
                                className="cursor-pointer"
                                style={{
                                  fontSize: 8.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 10,
                                  color: vistaMercado === v ? T.accent : T.ink3,
                                  background: vistaMercado === v ? 'rgba(126,217,174,.12)' : 'transparent',
                                }}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      }>Comparables de la zona · radio 5 km</CardHead>
                      {comparables.length > 0 ? (
                        <Cb style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                          {form.lat != null && form.lng != null && (
                            <div style={{ padding: '7px 8px 0' }}>
                              <MapaComparables predioLat={form.lat} predioLng={form.lng} comparables={comparables} />
                            </div>
                          )}
                          <table className="w-full" style={{ fontSize: 10.5 }}>
                            <thead>
                              <tr>
                                {['Desarrollo', '$/m²', 'Km', 'Avance'].map(h => (
                                  <th key={h} className={h === 'Desarrollo' ? 'text-left' : 'text-right'} style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, padding: '5px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {comparables.map((c: any, i: number) => (
                                <tr key={i}>
                                  <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                                    {c.nombre}
                                    {c.colonia && <span style={{ display: 'block', fontSize: 8.5, color: T.ink4 }}>{c.colonia}</span>}
                                  </td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}><b>{c.precioM2 != null ? c.precioM2.toLocaleString('es-MX') : '—'}</b></td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{c.distanciaKm != null ? c.distanciaKm.toFixed(1) : '—'}</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: colorAvance(c.avanceObra), borderBottom: '1px solid rgba(255,255,255,.03)' }}>{c.avanceObra || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </Cb>
                      ) : (
                        <Cb><div className="h-full flex items-center justify-center py-10"><p style={{ fontSize: 11, color: T.ink4 }}>Sin comparables encontrados</p></div></Cb>
                      )}
                    </Card>
                    {vistaMercado === 'oferta' ? (
                      <Card flex="none">
                        <CardHead>Oferta activa</CardHead>
                        <Cb fill>
                          {m.ofertaActiva ? (
                            <>
                              <Kv label="En preventa" value={m.ofertaActiva.proyectosEnPreventa} />
                              <Kv label="En obra" value={m.ofertaActiva.proyectosEnObra} />
                              <Kv label="Entregados 24m" value={m.ofertaActiva.proyectosEntregados24m} />
                              <Kv label="Unidades disponibles" value={m.ofertaActiva.unidadesDisponibles} />
                              <Kv label="Rango de precios" value={m.ofertaActiva.rangoPrecios} />
                              <Kv label="Saturación" value={m.ofertaActiva.saturacion} />
                            </>
                          ) : <p style={{ fontSize: 10.5, color: T.ink4 }}>Sin datos de oferta activa</p>}
                          {m.pricingFases && m.pricingFases.length > 0 && (
                            <div className="flex gap-1.5" style={{ marginTop: 8 }}>
                              {m.pricingFases.map((f: any, i: number) => (
                                <div key={i} className="flex-1 rounded-[7px]" style={{ padding: '6px 7px', background: T.panel, border: `1px solid ${T.line}` }}>
                                  <Mini>{f.fase}</Mini>
                                  <p style={{ fontSize: 11, color: T.ink, marginTop: 2 }}>${f.precioM2 != null ? f.precioM2.toLocaleString('es-MX') : '—'}</p>
                                  <p style={{ fontSize: 8.5, color: T.ink3 }}>{f.descuento} desc.</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </Cb>
                      </Card>
                    ) : (
                      <Card>
                        <CardHead>Demanda</CardHead>
                        <Cb style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div>
                            <Kv label="Nivel de demanda" value={m.demanda || '—'} />
                            <Kv label="Absorción" value={m.absorcion || '—'} />
                            <Kv label="Perfil NSE" value={m.perfilNSE || '—'} />
                          </div>
                          {m.segmentacion && m.segmentacion.length > 0 ? m.segmentacion.map((s: any, i: number) => (
                            <div key={i} className="rounded-[7px]" style={{ padding: '6px 8px', background: T.panel, border: `1px solid ${T.line}` }}>
                              <div className="flex items-center justify-between gap-2">
                                <span style={{ fontSize: 10.5, color: T.ink }}>{s.tipo}</span>
                                <span style={{ fontSize: 10, color: T.ink2 }}>${s.precioM2 != null ? s.precioM2.toLocaleString('es-MX') : '—'}/m²</span>
                              </div>
                              <div className="rounded overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,.05)', marginTop: 4 }}>
                                <div style={{ width: s.participacion, height: '100%', background: T.s1, borderRadius: 3 }} />
                              </div>
                              <div className="flex items-center justify-between gap-2" style={{ marginTop: 3 }}>
                                <span className="truncate" style={{ fontSize: 8.5, color: T.ink3 }}>{s.perfilComprador}</span>
                                <span className="shrink-0" style={{ fontSize: 8.5, color: T.ink3 }}>{s.absorcionMensual} · {s.participacion}</span>
                              </div>
                            </div>
                          )) : <p style={{ fontSize: 10.5, color: T.ink4 }}>Sin segmentación devuelta</p>}
                        </Cb>
                      </Card>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead>Indicadores de zona</CardHead>
                      <Cb fill>
                        <Kv label="Precio promedio zona" value={m.precioPromedioZona || '—'} />
                        <Kv label="Proyectos activos" value={m.proyectosActivos || '—'} />
                        <Kv label="Inventario" value={m.inventario || '—'} />
                      </Cb>
                    </Card>
                    {m.productoRecomendado && (
                      <Card flex="none">
                        <CardHead>Producto recomendado</CardHead>
                        <Cb><p style={{ fontSize: 11.5, fontWeight: 600, color: T.ink }}>{m.productoRecomendado}</p></Cb>
                      </Card>
                    )}
                    <Card>
                      <CardHead right={<Pill tone="muted">Ilustrativo</Pill>}>Plusvalía de zona</CardHead>
                      <Cb>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{m.plusvalia || '—'}</p>
                        <GraficaPlusvaliaPlaceholder />
                        <p style={{ fontSize: 8.5, color: T.ink4, marginTop: 6 }}>Serie ilustrativa — se conecta a datos reales en un bloque futuro.</p>
                      </Cb>
                    </Card>
                    {(() => {
                      const mr = pipe.marketResumen.data
                      const stats = mr?.prices?.askingPricePerM2
                      return (
                        <Card flex="none">
                          <CardHead right={<Pill tone="accent">Datos reales</Pill>}>Resumen de mercado (lib/market/)</CardHead>
                          <Cb>
                            {pipe.marketResumen.status === 'running' ? (
                              <p style={{ fontSize: 10.5, color: T.ink3 }}>Calculando…</p>
                            ) : pipe.marketResumen.status === 'error' ? (
                              <p style={{ fontSize: 10.5, color: T.ink3 }}>No se pudo calcular el resumen.</p>
                            ) : !mr ? (
                              <p style={{ fontSize: 10.5, color: T.ink3 }}>Sin comparables para resumir todavía.</p>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {stats ? (
                                  <div className="flex items-center justify-between gap-2">
                                    <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                                      ${stats.median.toLocaleString('es-MX')}/m² <span style={{ fontSize: 9.5, color: T.ink3, fontWeight: 400 }}>mediana</span>
                                    </span>
                                    <Mini>n={stats.n} · {stats.confidenceNivel}</Mini>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: 10.5, color: T.ink3 }}>Sin suficientes precios para estadística robusta.</p>
                                )}
                                <Kv label="Confianza de datos" value={mr.dataConfidence != null ? `${mr.dataConfidence}%` : '—'} />
                                <Kv label="Competidores detectados" value={mr.competitors?.length ?? 0} />
                                {mr.productFit && (
                                  <Kv label="Fit de producto (máx. densidad)" value={mr.productFit.finalScore != null ? `${mr.productFit.finalScore}/100` : '—'} />
                                )}
                                {mr.opportunityScore?.finalScore != null && (
                                  <Kv label="Oportunidad" value={`${mr.opportunityScore.finalScore}/100`} />
                                )}
                                {mr.warnings?.length > 0 && (
                                  <div style={{ marginTop: 2 }}>
                                    {mr.warnings.map((w: string, i: number) => (
                                      <p key={i} style={{ fontSize: 8.5, color: T.ink4, lineHeight: 1.5 }}>· {w}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </Cb>
                        </Card>
                      )
                    })()}
                  </div>
                </div>
              )
            })() : <CardPendiente titulo="Mercado" nota="Se llena con el Agente Mercado" estado={pipe.mercado.status} color={T.s2} onReintentar={pipe.mercado.status === 'error' ? () => runMercado() : undefined} />
          )}

          {tab === 'arquitectura' && (
            arquitecturaActual?.bitacoraArquitectura ? (() => {
              const ba = arquitecturaActual.bitacoraArquitectura
              const tip = ba.tipologiaPropuesta
              const mixHab = tip?.habitacional?.mix ?? []
              const zonas = ba.desgloseZonas ?? []
              const estac = zonas.find((z: any) => nombreEsEstacionamiento(z.zona))

              // Bloque 6 — vista en vivo solo reemplaza los números mostrados cuando el usuario
              // activamente tocó el stepper de niveles; en Auto se siguen mostrando los números
              // tal cual los reportó el Agente Arquitectura (sin cambio de comportamiento).
              const nivelesEnVivo = fields.nivelesArquitectura.source === 'user' && arquitecturaViva != null
              const unidadesBase = tip?.habitacional?.totalDepartamentos ?? mixHab.reduce((s: number, r: any) => s + (r.unidades || 0), 0)
              const superficieConstruidaMostrada = nivelesEnVivo ? arquitecturaViva!.areaConstruidaPropuesta : arquitecturaActual.superficieConstruida
              const superficieVendibleMostrada = nivelesEnVivo ? arquitecturaViva!.areaVendiblePropuesta : arquitecturaActual.superficieVendible
              const unidadesMostradas = nivelesEnVivo ? arquitecturaViva!.unidadesEfectivas : unidadesBase
              const nivelesMostrados = nivelesEnVivo ? arquitecturaViva!.niveles : tip?.niveles

              // Total de m² del programa (para % del total y aportación a ingresos, 6.3) —
              // incluye habitacional; comercial no trae m2Promedio hoy, se queda fuera del %.
              const precioVentaEfectivo = numeroDe(fields.precioVentaM2) ?? mercadoActual?.mercado?.precioVentaDepasM2 ?? null
              const totalM2Programa = mixHab.reduce((s: number, r: any) => s + (r.unidades || 0) * (r.m2Promedio || 0), 0) || 1

              const cosProyectoTexto = ba.cosEstimado ?? null
              const alturaPermitido = parsearNumero(fields.alturaNormativa.value ?? fields.alturaNormativa.agentValue)
              const cajonesPermitido = parsearNumero(fields.cajonesNormativa.value ?? fields.cajonesNormativa.agentValue)
              const cajonesProyecto = arquitecturaViva?.cajonesSotano ?? estac?.cajonesEstimados ?? null
              const filasCumplimiento = [
                { param: 'COS', permitido: arquitecturaViva?.cosPermitidoPct ?? null, proyecto: parsearNumero(cosProyectoTexto), fmt: (n: number) => `${n}%`, minimo: false },
                { param: 'CUS', permitido: arquitecturaViva?.cusPermitido ?? null, proyecto: arquitecturaViva ? Number(arquitecturaViva.cusImplicito.toFixed(2)) : parsearNumero(ba.cusEstimado), fmt: (n: number) => n.toFixed(2), minimo: false },
                { param: 'Altura', permitido: alturaPermitido, proyecto: nivelesMostrados ?? null, fmt: (n: number) => `${n} niveles`, minimo: false },
                { param: 'Cajones', permitido: cajonesPermitido, proyecto: cajonesProyecto, fmt: (n: number) => `${n}`, minimo: true },
              ]

              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead right={nivelesMostrados ? <Mini>{nivelesMostrados} niveles</Mini> : undefined}>Programa arquitectónico</CardHead>
                      <Cb style={{ padding: 0 }}>
                        <table className="w-full" style={{ fontSize: 10.5 }}>
                          <thead>
                            <tr>
                              {['Componente', 'Uds', 'm²/u', 'Total m²', '%', 'Ingresos'].map(h => (
                                <th key={h} className={h === 'Componente' ? 'text-left' : 'text-right'} style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, padding: '5px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {mixHab.map((r: any, i: number) => {
                              const totalRow = (r.unidades || 0) * (r.m2Promedio || 0)
                              const pctRow = (totalRow / totalM2Programa) * 100
                              const ingresoRow = precioVentaEfectivo != null ? totalRow * precioVentaEfectivo : null
                              return (
                                <tr key={i}>
                                  <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{r.tipo}</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{r.unidades}</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{r.m2Promedio}</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}><b>{Math.round(totalRow).toLocaleString('es-MX')}</b></td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{pctRow.toFixed(0)}%</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{ingresoRow != null ? `$${Math.round(ingresoRow / 1_000_000).toLocaleString('es-MX')}M` : '—'}</td>
                                </tr>
                              )
                            })}
                            {tip?.comercial && (
                              <tr>
                                <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>Comercial planta baja</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{tip.comercial.totalLocales}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>—</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>—</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>—</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>—</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </Cb>
                    </Card>
                    <Card>
                      <CardHead right={<Mini>{zonas.length} zonas</Mini>}>Volumetría y niveles</CardHead>
                      <Cb style={{ padding: '8px 8px 0', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
                        <div className="grid grid-cols-2 gap-2" style={{ flex: 'none' }}>
                          <DataField fieldKey="nivelesArquitectura" label="Niveles" type="number" step={1} min={1} unit="niveles" />
                          <DataField fieldKey="sotanosArquitectura" label="Sótanos" type="number" step={1} min={0} unit="niveles" />
                        </div>
                        {zonas.length > 0 && (
                          <DiagramaArquitectura
                            zonas={zonas}
                            niveles={nivelesMostrados}
                            tipoActivo={arquitecturaViva && arquitecturaViva.sotanos > 0 ? 'subterraneo' : (ba.tipoEstacionamientoFijado ?? null)}
                            cargando={pipe.arquitectura.status === 'running'}
                            onElegirTipo={(t) => runArquitectura({ estacionamientoOverride: t })}
                            alturaExcedentePct={arquitecturaViva?.excede ? arquitecturaViva.excedenteM2 / arquitecturaViva.areaConstruidaPropuesta : 0}
                            sotanosNiveles={arquitecturaViva?.sotanos}
                            cajonesSotano={arquitecturaViva?.cajonesSotano}
                          />
                        )}
                        {arquitecturaViva?.excede && (
                          <div className="flex items-center justify-between gap-2 rounded-[7px]" style={{ margin: '8px 0', padding: '7px 9px', background: 'rgba(192,90,62,.1)', border: `1px solid ${T.bad}` }}>
                            <p style={{ fontSize: 10.5, color: T.bad }}>
                              Te pasas {Math.round(arquitecturaViva.excedenteM2).toLocaleString('es-MX')} m² del CUS permitido ({arquitecturaViva.cusPermitido!.toFixed(1)} → {arquitecturaViva.cusImplicito.toFixed(1)})
                            </p>
                            {arquitecturaViva.nivelesSugerido != null && (
                              <button
                                onClick={() => setFieldManual('nivelesArquitectura', arquitecturaViva!.nivelesSugerido!)}
                                className="cursor-pointer shrink-0 rounded-full"
                                style={{ fontSize: 9, padding: '4px 10px', color: T.ink, background: T.bad, whiteSpace: 'nowrap' }}
                              >
                                Aplicar {arquitecturaViva.nivelesSugerido} niveles
                              </button>
                            )}
                          </div>
                        )}
                      </Cb>
                    </Card>
                  </div>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead>Cumplimiento normativo</CardHead>
                      <Cb>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Parámetro</th>
                              <th style={{ textAlign: 'right', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Permitido</th>
                              <th style={{ textAlign: 'right', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Proyecto</th>
                              <th style={{ textAlign: 'right', fontSize: 8, color: T.ink3, fontWeight: 400, paddingBottom: 3 }}>Estatus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filasCumplimiento.map((f) => {
                              const estado = f.minimo ? estatusMinimo(f.permitido, f.proyecto) : estatusComparacion(f.permitido, f.proyecto)
                              return (
                                <tr key={f.param}>
                                  <td style={{ fontSize: 10, color: T.ink2, padding: '2px 0' }}>{f.param}</td>
                                  <td style={{ fontSize: 10, color: T.ink, textAlign: 'right' }}>{f.permitido != null ? f.fmt(f.permitido) : '—'}</td>
                                  <td style={{ fontSize: 10, color: T.ink, textAlign: 'right' }}>{f.proyecto != null ? f.fmt(f.proyecto) : '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <SemaforoParametro estado={estado} label={estado === 'cumple' ? 'Cumple' : estado === 'limite' ? 'Al límite' : estado === 'excede' ? 'Excede' : '—'} />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </Cb>
                    </Card>
                    <Card>
                      <CardHead>Eficiencia del proyecto</CardHead>
                      <Cb fill>
                        <Kv label="Superficie construida" value={superficieConstruidaMostrada ? `${Math.round(superficieConstruidaMostrada).toLocaleString('es-MX')} m²` : '—'} />
                        <Kv label="Superficie vendible" value={superficieVendibleMostrada ? `${Math.round(superficieVendibleMostrada).toLocaleString('es-MX')} m²` : '—'} />
                        <Kv label="Eficiencia" value={superficieConstruidaMostrada ? `${Math.round((superficieVendibleMostrada / superficieConstruidaMostrada) * 100)}%` : '—'} />
                        <Kv label="Unidades" value={unidadesMostradas ?? '—'} />
                        <Kv label="Área libre" value={ba.areaLibreYVerde ? `${Math.round(ba.areaLibreYVerde.m2).toLocaleString('es-MX')} m² (${ba.areaLibreYVerde.porcentajeLote})` : '—'} />
                        <Kv label="Amenidades" value={tip?.tamanoAmenidades ? `${Math.round(tip.tamanoAmenidades).toLocaleString('es-MX')} m²` : '—'} />
                        <Kv label="Niveles" value={nivelesMostrados ?? '—'} />
                      </Cb>
                    </Card>
                  </div>
                </div>
              )
            })() : <CardPendiente titulo="Arquitectura" nota="Se llena con el Agente Arquitectura" estado={pipe.arquitectura.status} color={T.s1} onReintentar={pipe.arquitectura.status === 'error' ? () => runArquitectura() : undefined} />
          )}
          {tab === 'costos' && (
            construccionActual?.bitacoraConstruccion ? (() => {
              const bc = construccionActual.bitacoraConstruccion
              const partidas = bc.desglosePorPartidas ?? []
              const materiales = bc.materialesPrincipales ?? []
              const fuentes = bc.fuentesConstruccion ?? []

              const hoy = Date.now()
              const MS_6_MESES = 1000 * 60 * 60 * 24 * 30 * 6
              const fechaVieja = (fecha: string) => {
                const t = Date.parse(fecha)
                return !Number.isNaN(t) && hoy - t > MS_6_MESES
              }

              const banda = Number(form.bandaConstruccion) || null
              const rangoBanda = banda ? RANGOS_BANDA_MXN_M2[banda] : null
              const costoConstruccionEfectivo = numeroDe(fields.costoConstruccionM2) ?? bc.costoPorM2Final ?? null
              const midpointBanda = rangoBanda ? (rangoBanda.min + rangoBanda.max) / 2 : null
              const fueraDeBanda = costoConstruccionEfectivo != null && rangoBanda
                ? (costoConstruccionEfectivo < rangoBanda.min || costoConstruccionEfectivo > rangoBanda.max)
                : false
              const desviacionBandaPct = costoConstruccionEfectivo != null && midpointBanda
                ? ((costoConstruccionEfectivo - midpointBanda) / midpointBanda) * 100
                : null

              const rangoHonorariosBanda = banda ? RANGOS_HONORARIOS_POR_BANDA[banda] : undefined
              const validacionOverheadViva = validarIndirectos(
                resumen.costos.indirectos, resumen.costos.honorarios, resumen.costos.imprevistos,
                resumen.costos.costoDirectoConstruccion, rangoHonorariosBanda,
              )

              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead right={bc.nombreBanda ? <Mini>{bc.nombreBanda}</Mini> : undefined}>Presupuesto paramétrico por partida</CardHead>
                      <Cb style={{ padding: 0 }}>
                        <table className="w-full" style={{ fontSize: 10.5 }}>
                          <thead>
                            <tr>
                              {['Partida', '%', '$/m²'].map(h => (
                                <th key={h} className={h === 'Partida' ? 'text-left' : 'text-right'} style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, padding: '5px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {partidas.map((p: any, i: number) => (
                              <tr key={i}>
                                <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{p.partida}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{p.porcentaje}%</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}><b>{fmt(p.costoPorM2)}</b></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Cb>
                    </Card>
                    {fuentes.length > 0 && (
                      <Card flex="none">
                        <CardHead right={<Mini>{fuentes.length} fuentes</Mini>}>Fuentes citadas — construcción</CardHead>
                        <Cb style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {fuentes.map((f: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span style={{ fontSize: 10, color: T.ink }}>{f.fuente}</span>
                                <span style={{ fontSize: 9, color: T.ink3 }}> · {f.dato} · {f.fecha}</span>
                              </div>
                              {fechaVieja(f.fecha) && <Pill tone="muted">no confiable · {'>'}6 meses</Pill>}
                            </div>
                          ))}
                        </Cb>
                      </Card>
                    )}
                    {materiales.length > 0 && (
                      <Card>
                        <CardHead right={<Mini>{materiales.length} insumos</Mini>}>Materiales principales</CardHead>
                        <Cb style={{ padding: 0 }}>
                          <table className="w-full" style={{ fontSize: 10.5 }}>
                            <thead>
                              <tr>
                                {['Material', 'Unidad', 'Cant./m²', '$/m²'].map(h => (
                                  <th key={h} className={h === 'Material' ? 'text-left' : 'text-right'} style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, padding: '5px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {materiales.map((m: any, i: number) => (
                                <tr key={i}>
                                  <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{m.material}</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink3, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{m.unidad}</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{m.cantidadPorM2}</td>
                                  <td className="text-right" style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{fmt(m.costoPorM2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </Cb>
                      </Card>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead>Costo de construcción</CardHead>
                      <Cb>
                        <DataField
                          fieldKey="costoConstruccionM2" label="Costo construcción $/m²" unit="/m²" step={500}
                          rangoSugerido={bc.rangoReferencia ? [bc.rangoReferencia.minimo, bc.rangoReferencia.maximo] : undefined}
                        />
                        {bc.rangoReferencia && (
                          <div style={{ marginTop: 8 }}>
                            <BarraRango label="Rango de referencia del agente" minimo={bc.rangoReferencia.minimo} maximo={bc.rangoReferencia.maximo} valor={costoConstruccionEfectivo} fmt={fmt} />
                          </div>
                        )}
                        {rangoBanda && (
                          <div style={{ marginTop: 4 }}>
                            <Mini>Costo por nivel de acabado (banda {banda})</Mini>
                            <table className="w-full" style={{ marginTop: 3 }}>
                              <tbody>
                                {[1, 2, 3, 4].map((b) => {
                                  const r = RANGOS_BANDA_MXN_M2[b]
                                  const mid = (r.min + r.max) / 2
                                  return (
                                    <tr key={b}>
                                      <td style={{ fontSize: 9.5, color: b === banda ? T.accent : T.ink3, padding: '2px 0' }}>{r.nombre}</td>
                                      <td className="text-right" style={{ fontSize: 9.5, color: b === banda ? T.ink : T.ink3 }}>{fmt(mid)}/m²</td>
                                      <td className="text-right" style={{ fontSize: 9.5, color: T.ink3 }}>{fmtM(mid * resumen.costos.m2Construidos)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {fueraDeBanda && desviacionBandaPct != null && rangoBanda && (
                          <div className="flex items-center justify-between gap-2 rounded-[7px]" style={{ marginTop: 8, padding: '7px 9px', background: 'rgba(192,90,62,.1)', border: `1px solid ${T.bad}` }}>
                            <p style={{ fontSize: 10, color: T.bad }}>
                              {fmt(costoConstruccionEfectivo!)}/m² está {Math.abs(desviacionBandaPct).toFixed(0)}% {desviacionBandaPct < 0 ? 'debajo' : 'arriba'} del promedio de la zona (banda {banda}: {fmt(rangoBanda.min)}–{fmt(rangoBanda.max)}) — verificar
                            </p>
                            <button
                              onClick={() => setFieldManual('costoConstruccionM2', Math.round(midpointBanda!))}
                              className="cursor-pointer shrink-0 rounded-full"
                              style={{ fontSize: 9, padding: '4px 10px', color: T.ink, background: T.bad, whiteSpace: 'nowrap' }}
                            >
                              Usar {fmt(midpointBanda!)}/m²
                            </button>
                          </div>
                        )}
                      </Cb>
                    </Card>
                    <Card flex="none">
                      <CardHead>Indirectos, honorarios e imprevistos</CardHead>
                      <Cb style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className="flex items-center gap-2">
                          <div style={{ flex: 1 }}>
                            <DataField fieldKey="porcentajeIndirectos" label="Indirectos" type="number" unit="%" step={0.5} rangoSugerido={[RANGO_INDIRECTOS.min, RANGO_INDIRECTOS.max]} />
                          </div>
                          <SemaforoParametro estado={validacionOverheadViva.indirectosFueraDeRango ? 'excede' : 'cumple'} label={validacionOverheadViva.indirectosFueraDeRango ? 'Fuera de rango' : 'Cumple'} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ flex: 1 }}>
                            <DataField fieldKey="porcentajeHonorarios" label="Honorarios" type="number" unit="%" step={0.5} rangoSugerido={rangoHonorariosBanda ? [rangoHonorariosBanda.min, rangoHonorariosBanda.max] : undefined} />
                          </div>
                          <SemaforoParametro estado={validacionOverheadViva.honorariosFueraDeRango ? 'excede' : 'cumple'} label={validacionOverheadViva.honorariosFueraDeRango ? 'Fuera de rango' : 'Cumple'} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ flex: 1 }}>
                            <DataField fieldKey="porcentajeImprevistos" label="Imprevistos" type="number" unit="%" step={0.5} rangoSugerido={[RANGO_IMPREVISTOS.min, RANGO_IMPREVISTOS.max]} />
                          </div>
                          <SemaforoParametro estado={validacionOverheadViva.imprevistosFueraDeRango ? 'excede' : 'cumple'} label={validacionOverheadViva.imprevistosFueraDeRango ? 'Fuera de rango' : 'Cumple'} />
                        </div>
                      </Cb>
                    </Card>
                    <Card>
                      <CardHead right={<Mini>en vivo</Mini>}>Desglose de inversión</CardHead>
                      <Cb fill>
                        <Kv label="Costo de terreno" value={fmtM(resumen.costos.costoTerreno)} />
                        <Kv label="Construcción directa" value={fmtM(resumen.costos.costoDirectoConstruccion)} />
                        <Kv label="Indirectos" value={fmtM(resumen.costos.indirectos)} />
                        <Kv label="Honorarios" value={fmtM(resumen.costos.honorarios)} />
                        <Kv label="Imprevistos" value={fmtM(resumen.costos.imprevistos)} />
                        <Kv label="Costo total" value={fmtM(resumen.costos.costoTotal)} />
                        <Kv label="Margen bruto" value={`${resumen.utilidad.margenBruto.toFixed(1)}%`} />
                        <Kv label="TIR Socio" value={escenarioActual?.retorno.tirSocioConverge ? `${escenarioActual.retorno.tirSocioAnual!.toFixed(1)}%` : '—'} />
                      </Cb>
                    </Card>
                  </div>
                </div>
              )
            })() : <CardPendiente titulo="Costos" nota="Se llena con el Agente de Costos de Construcción" estado={pipe.construccion.status} color={T.bad} onReintentar={pipe.construccion.status === 'error' ? () => runConstruccion() : undefined} />
          )}
          {tab === 'financiero' && (
            financieroReal ? (() => {
              const flujo = (flujoMensual ?? []) as FlujoMesPre[]
              const mesData = mesSeleccionado != null ? flujo[mesSeleccionado] ?? null : null

              // Bloque 8 (criterio #1) — en vivo solo cuando el usuario tocó el slider de
              // deuda; si no, se sigue mostrando el snapshot de estructuraCapital tal cual
              // (mismo criterio "en vivo si se edita, agente si no" de ARQUITECTURA/COSTOS).
              const enVivo = fields.porcentajeFinanciado.source === 'user' && escenarioActual != null
              const deudaEfectiva = numeroDe(fields.porcentajeFinanciado) ?? estructuraCapital?.deuda ?? null
              const equityEfectivo = deudaEfectiva != null ? 100 - deudaEfectiva : (estructuraCapital?.equity ?? null)
              const costoFinancieroMostrado = enVivo ? escenarioActual!.costos.financieros : (estructuraCapital?.costoFinanciero ?? null)
              const tirMostrada = enVivo
                ? (escenarioActual!.retorno.tirSocioConverge ? escenarioActual!.retorno.tirSocioAnual : null)
                : (financieroReal.tir ?? null)
              const utilidadMostrada = enVivo ? escenarioActual!.utilidad.utilidadAntesImpuestos : (estructuraCapital?.utilidadNeta ?? null)

              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.34fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    {flujo.length > 0 ? (
                      <Card flex="1.1">
                        <CardHead right={<Mini>{mesData ? `Mes ${mesData.mes} · ${mesData.fase}` : 'Click en un periodo'}</Mini>}>Flujo de caja proyectado</CardHead>
                        <div style={{ flex: 1, minHeight: 0, padding: '8px 4px' }}>
                          <CashFlowChart data={flujo} onSeleccionar={(_, i) => setMesSeleccionado(i)} seleccionado={mesSeleccionado} />
                        </div>
                        <div className="flex items-center gap-4" style={{ padding: '4px 11px', fontSize: 9.5, color: T.ink3 }}>
                          <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: T.s1 }} />Ingresos</span>
                          <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: T.s2 }} />Egresos</span>
                          <span><i style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 6, marginRight: 5, verticalAlign: -1, background: T.accent2 }} />Hito</span>
                        </div>
                        {mesData ? (
                          <div className="flex items-center justify-between gap-3" style={{ padding: '0 11px 8px', fontSize: 10 }}>
                            <span style={{ color: T.ink2 }}><b style={{ color: T.s1 }}>{fmtM(mesData.ingresos)}</b> ingresos · <b style={{ color: T.s2 }}>{fmtM(mesData.egresos)}</b> egresos · acumulado {fmtM(mesData.acumulado)}</span>
                            {mesData.nota && <span className="truncate" style={{ color: T.ink3, textAlign: 'right' }}>{mesData.nota}</span>}
                          </div>
                        ) : (
                          <p style={{ padding: '0 11px 8px', fontSize: 9.5, color: T.ink4 }}>Haz clic en un periodo del flujo para ver su detalle.</p>
                        )}
                      </Card>
                    ) : <CardPendiente titulo="Flujo de caja proyectado" flex="1.1" nota="Se llena con el Agente Financiero" estado={pipe.financiero.status} color={T.accent} onReintentar={pipe.financiero.status === 'error' ? () => runFinanciero() : undefined} />}
                    <Card>
                      <CardHead>Desglose de inversión</CardHead>
                      <Cb fill>
                        <Kv label="Costo de terreno" value={fmtM(financieroReal.costoTerreno)} />
                        <Kv label="Costo de construcción" value={fmtM(financieroReal.costoTotalConstruccion)} />
                        <Kv label="Indirectos" value={fmtM(financieroReal.indirectos)} />
                        <Kv label="Honorarios" value={fmtM(financieroReal.honorarios)} />
                        <Kv label="Imprevistos" value={fmtM(financieroReal.imprevistos)} />
                        <Kv label="Inversión total" value={fmtM(financieroReal.inversionTotal)} />
                      </Cb>
                    </Card>
                  </div>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead right={plusvaliaAnualPct != null ? <Pill tone="muted">Plusvalía {plusvaliaAnualPct.toFixed(1)}%/año · Agente Mercado</Pill> : undefined}>Estructura de capital</CardHead>
                      <Cb>
                        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 10.5, color: T.accent, fontWeight: 600 }}>Equity {equityEfectivo ?? '—'}%</span>
                          <span style={{ fontSize: 10.5, color: T.s3, fontWeight: 600 }}>Deuda {deudaEfectiva ?? '—'}%</span>
                        </div>
                        <div className="flex rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,.06)', marginBottom: 6 }}>
                          <div style={{ width: `${equityEfectivo ?? 0}%`, background: T.accent }} />
                          <div style={{ width: `${deudaEfectiva ?? 0}%`, background: T.s3 }} />
                        </div>
                        <DataField fieldKey="porcentajeFinanciado" label="Mezcla — % deuda" type="number" unit="%" step={5} min={0} rangoSugerido={[0, 100]} />
                        <DataField fieldKey="tipoDeuda" label="Tipo de deuda" type="text" />
                        <Kv label="Tasa" value={estructuraCapital?.tasaDeuda ?? '—'} />
                        <Kv label="Costo financiero" value={costoFinancieroMostrado ? fmtM(costoFinancieroMostrado) : '—'} />
                        <Kv label="Utilidad neta" value={utilidadMostrada ? fmtM(utilidadMostrada) : '—'} />
                        <Kv label="TIR Socio" value={tirMostrada != null ? `${tirMostrada.toFixed(1)}%` : '—'} />
                      </Cb>
                    </Card>
                    <Card flex="none">
                      <CardHead>Preventa mínima</CardHead>
                      <Cb>
                        <DataField fieldKey="preventaUnidadesMinimas" label="Unidades mínimas" type="number" step={1} min={0} />
                        <DataField fieldKey="preventaPorcentajeMinimo" label="% mínimo" type="text" />
                        <DataField fieldKey="preventaMontoMinimo" label="Monto mínimo" type="number" unit="$" step={100000} min={0} />
                        <Kv label="Plazo obra" value={financieroReal.plazoObraMeses ? `${financieroReal.plazoObraMeses} m` : '—'} />
                        <Kv label="Plazo venta" value={financieroReal.plazoVentaMeses ? `${financieroReal.plazoVentaMeses} m` : '—'} />
                      </Cb>
                    </Card>
                  </div>
                </div>
              )
            })() : <CardPendiente titulo="Financiero" nota="Se llena con el Agente Financiero" estado={pipe.financiero.status} color={T.accent} onReintentar={pipe.financiero.status === 'error' ? () => runFinanciero() : undefined} />
          )}
        </main>

        {/* ── Side derecho: riesgos + agente — solo existe en el grid cuando está 'docked'
            (Bloque 1, 1.1); 'centered' se renderiza aparte como overlay, 'hidden' libera
            la columna por completo. ── */}
        {agentPanelMode === 'docked' && (
          <aside className="flex flex-col gap-2 p-2.5 overflow-hidden" style={{ borderLeft: `1px solid ${T.line}` }}>
            <Card flex="none">
              <CardHead right={<Mini>0 activos</Mini>}>Riesgos críticos</CardHead>
              <Cb style={{ padding: '9px 11px' }}>
                <p style={{ fontSize: 10.5, color: T.ink3 }}>Aparecen conforme los agentes detectan alertas</p>
              </Cb>
            </Card>
            <AgentPanel
              variant="docked"
              chat={chat}
              chatEndRef={chatEndRef}
              intakeDone={intakeDone}
              preguntaActual={preguntaActual}
              tipoSel={tipoSel}
              texto={texto}
              setTexto={setTexto}
              enviarTexto={enviarTexto}
              elegirChipUnico={elegirChipUnico}
              toggleChipMulti={toggleChipMulti}
              confirmarTipos={confirmarTipos}
            />
          </aside>
        )}
      </div>

      {/* ── Overlay centrado (modo captura) — mismo patrón que el modal "Mis proyectos" más
          abajo: fondo atenuado + tarjeta centrada, pero sin cerrar al hacer click afuera
          mientras el intake sigue bloqueando (Escape sí cierra una vez terminado). ── */}
      {agentPanelMode === 'centered' && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(2,4,3,.7)', zIndex: 50 }}>
          <AgentPanel
            variant="centered"
            chat={chat}
            chatEndRef={chatEndRef}
            intakeDone={intakeDone}
            preguntaActual={preguntaActual}
            tipoSel={tipoSel}
            texto={texto}
            setTexto={setTexto}
            enviarTexto={enviarTexto}
            elegirChipUnico={elegirChipUnico}
            toggleChipMulti={toggleChipMulti}
            confirmarTipos={confirmarTipos}
          />
        </div>
      )}

      {/* ── Botón flotante de reapertura — con badge si hay una pregunta del intake pendiente. ── */}
      {agentPanelMode === 'hidden' && (
        <button
          onClick={() => setAgentPanelMode(!intakeDone && preguntaActual ? 'centered' : 'docked')}
          className="fixed cursor-pointer flex items-center justify-center rounded-full"
          style={{ right: 20, bottom: 20, width: 48, height: 48, background: T.panel, border: `1px solid ${T.line2}`, zIndex: 40, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}
          title="Agente PREFORMA"
        >
          <span style={{ color: T.accent, fontSize: 18 }}>◆</span>
          {!intakeDone && preguntaActual && (
            <span
              className="absolute"
              style={{ top: -2, right: -2, width: 10, height: 10, borderRadius: 999, background: T.warn, border: `2px solid ${T.bg}` }}
            />
          )}
        </button>
      )}

      {misProyectosAbierto && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(2,4,3,.7)', zIndex: 50 }}
          onClick={() => setMisProyectosAbierto(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-[10px] overflow-hidden flex flex-col"
            style={{ width: 460, maxHeight: '70vh', background: T.panel, border: `1px solid ${T.line}` }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Mis proyectos</span>
              <button onClick={() => setMisProyectosAbierto(false)} className="cursor-pointer" style={{ fontSize: 14, color: T.ink3 }}>✕</button>
            </div>
            <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
              {cargandoProyectos ? (
                <p style={{ padding: 16, fontSize: 11, color: T.ink4, textAlign: 'center' }}>Cargando…</p>
              ) : misProyectos.length === 0 ? (
                <p style={{ padding: 16, fontSize: 11, color: T.ink4, textAlign: 'center' }}>Todavía no guardas ningún proyecto en PREFORMA.</p>
              ) : (
                misProyectos.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.04)' }}
                    onClick={() => cargarProyecto(p.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 11.5, color: T.ink }}>{p.nombre}</p>
                      <p style={{ fontSize: 9.5, color: T.ink4, marginTop: 2 }}>
                        {new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · {p.status}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); eliminarProyecto(p.id) }}
                      className="shrink-0 cursor-pointer"
                      style={{ fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: T.bad }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
