'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authedFetch } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'
import { extractMercadoContext, extractProyectoContext, extractTerrenoContext } from '@/lib/mastermind/contexto'
import { calcularMastermind, calcularMastermindCore } from '@/lib/mastermind/motor'
import { generarMatrizSensibilidad } from '@/lib/mastermind/sensibilidad'
import { DEFAULTS, BENCHMARKS_CONSTRUCCION_MXN_M2 } from '@/lib/mastermind/catalogo'
import type { MastermindInputs, SensitivityCell } from '@/lib/mastermind/tipos'

// ─── Paso 1: shell visual + navegación + rail básico. Paso 2 (este): intake
// conversacional — el chat de la derecha va preguntando lo mínimo (mismos campos que
// Flujo A) y, al llegar a ubicación, la Stage cambia sola a Terreno donde se pega el
// link de Maps o coordenadas (mismo LeafletPicker/parseo que ya usa
// app/prospeccion/flujo-a/page.tsx, copiado aquí — Paso 3 conecta los agentes reales.
// Ver C:\Users\Administrator\.claude\plans\quirky-imagining-dolphin.md.

const T = {
  bg: '#040705', panel: '#080D0B', panel2: '#0B1310',
  line: 'rgba(126,217,174,.11)', line2: 'rgba(126,217,174,.22)',
  ink: '#E8F3ED', ink2: '#9CB3A8', ink3: '#627A70', ink4: '#3E524A',
  accent: '#7ED9AE', accent2: '#4FC08D',
  s1: '#12A98D', s2: '#C4842A', s3: '#7A6FE0', bad: '#C05A3E',
}

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

function LeafletPicker({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map)
    const icon = L.divIcon({
      html: `<div><svg viewBox="0 0 24 36" width="22" height="32"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#7ED9AE"/><circle cx="12" cy="12" r="5" fill="white"/></svg></div>`,
      className: '', iconAnchor: [11, 32],
    })
    const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)
    marker.on('dragend', () => { const p = marker.getLatLng(); onMove(p.lat, p.lng) })
    map.on('click', (e: any) => { marker.setLatLng(e.latlng); onMove(e.latlng.lat, e.latlng.lng) })
    mapRef.current = map; markerRef.current = marker
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [ready])

  useEffect(() => {
    if (!markerRef.current) return
    markerRef.current.setLatLng([lat, lng])
    mapRef.current?.setView([lat, lng], 17)
  }, [lat, lng])

  if (!ready) return <div className="w-full rounded-[9px] flex items-center justify-center" style={{ height: 220, background: T.panel2 }}><p style={{ fontSize: 12, color: T.ink3 }}>Cargando mapa…</p></div>
  return <div ref={ref} className="w-full rounded-[9px] overflow-hidden" style={{ height: 220, border: `1px solid ${T.line}` }} />
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

type IntakeKind = 'texto' | 'numero' | 'mapa' | 'chips-single' | 'chips-multi'
interface IntakeQuestion { key: string; kind: IntakeKind; pregunta: string; opciones?: { id: string; label: string }[] }

const INTAKE: IntakeQuestion[] = [
  { key: 'nombre', kind: 'texto', pregunta: '¿Cómo se llama este proyecto?' },
  { key: 'ubicacion', kind: 'mapa', pregunta: 'Vamos a ubicar el predio — te llevo a la pestaña Terreno, pega ahí el link de Google Maps o unas coordenadas.' },
  { key: 'superficie', kind: 'numero', pregunta: '¿Cuántos m² tiene el terreno?' },
  { key: 'tipo', kind: 'chips-multi', pregunta: '¿Qué tipo de desarrollo tienes en mente? Puedes elegir más de uno.', opciones: TIPOS_DESARROLLO },
  { key: 'presupuesto', kind: 'chips-single', pregunta: '¿Cuánto presupuesto tienes para invertir?', opciones: RANGOS_PRESUPUESTO },
  { key: 'banda', kind: 'chips-single', pregunta: '¿Qué nivel de acabados buscas?', opciones: BANDAS },
]

interface ChatMsg { who: 'a' | 'u'; text: string }

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
}
const FORM_INICIAL: FormPreforma = {
  nombreProyecto: '', lat: null, lng: null, mapsLink: '',
  direccion: '', colonia: '', ciudad: '', estado: '', codigoPostal: '',
  superficie: '', tiposDesarrollo: [], presupuesto: '', bandaConstruccion: '',
  clasificacionVial: '', pendiente: '', pavimento: '', esEsquina: '', usoSuelo: '', agua: '', electricidad: '',
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

// Barra de pipeline al pie de la página — mismo color por agente que ya usan las tarjetas
// pendientes de cada pestaña, para que se reconozcan de un vistazo.
const ETAPAS = [
  { key: 'terreno', label: 'Terreno', color: T.accent },
  { key: 'legal', label: 'Legal', color: T.s3 },
  { key: 'mercado', label: 'Mercado', color: T.s2 },
  { key: 'arquitectura', label: 'Arquitectura', color: T.s1 },
  { key: 'construccion', label: 'Costos', color: T.bad },
  { key: 'financiero', label: 'Financiero', color: T.accent2 },
] as const

// ─── Piezas base — traducción directa de .card/.chead/.cb/.lbl/.kv del prototipo ──

function Card({ children, flex = '1', style }: { children: React.ReactNode; flex?: string; style?: React.CSSProperties }) {
  return (
    <section
      className="rounded-[9px] border overflow-hidden flex flex-col min-h-0"
      style={{ background: `linear-gradient(180deg, ${T.panel2}, ${T.panel})`, borderColor: T.line, flex, ...style }}
    >
      {children}
    </section>
  )
}

function CardHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-[10px] py-[6px] shrink-0 whitespace-nowrap"
      style={{ borderBottom: `1px solid ${T.line}` }}
    >
      <Lbl>{children}</Lbl>
      {right && <div className="flex items-center gap-1.5">{right}</div>}
    </div>
  )
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.ink3, fontWeight: 500 }}>{children}</span>
}

function Mini({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3 }}>{children}</span>
}

function Cb({ children, style, fill }: { children: React.ReactNode; style?: React.CSSProperties; fill?: boolean }) {
  return (
    <div
      className="overflow-auto"
      style={{ padding: '10px 11px', minHeight: 0, flex: 1, display: fill ? 'flex' : undefined, flexDirection: fill ? 'column' : undefined, justifyContent: fill ? 'space-evenly' : undefined, ...style }}
    >
      {children}
    </div>
  )
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-[3px] border-b" style={{ borderColor: 'rgba(255,255,255,.035)' }}>
      <span className="truncate" style={{ color: T.ink3, fontSize: 10 }}>{label}</span>
      <b className="text-right shrink-0" style={{ color: T.ink, fontWeight: 400, fontSize: 10.5 }}>{value}</b>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-[10px]"
      style={{ padding: '2px 8px', fontSize: 8.5, letterSpacing: '.13em', textTransform: 'uppercase', color: T.accent, border: '1px solid rgba(126,217,174,.35)', background: 'rgba(126,217,174,.08)' }}
    >
      {children}
    </span>
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

// Sección aún sin dato real — mismo slot de tarjeta que tendrá cuando esté conectada.
// Fila de supuesto editable — traducción de .as/.stepper del prototipo.
function StepperRow({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2" style={{ padding: '7px 10px', background: T.panel2 }}>
      <span style={{ fontSize: 10, color: T.ink2 }}>{label}</span>
      <div className="flex items-center gap-0.5 rounded-full shrink-0" style={{ border: `1px solid ${T.line}`, padding: 1 }}>
        <button onClick={onDec} className="rounded-full flex items-center justify-center cursor-pointer" style={{ width: 19, height: 19, color: T.ink3, fontSize: 12, lineHeight: 1 }}>−</button>
        <span className="text-center" style={{ minWidth: 70, fontSize: 11 }}>{value}</span>
        <button onClick={onInc} className="rounded-full flex items-center justify-center cursor-pointer" style={{ width: 19, height: 19, color: T.ink3, fontSize: 12, lineHeight: 1 }}>+</button>
      </div>
    </div>
  )
}
function StepperRowPendiente({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-2" style={{ padding: '7px 10px', background: T.panel2 }}>
      <span style={{ fontSize: 10, color: T.ink4 }}>{label}</span>
      <span style={{ fontSize: 11, color: T.ink4 }}>—</span>
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
              {/* El sonar grande vive una sola vez, en la barra de pipeline al pie de la
                  página — aquí solo un indicador ligero para no duplicarlo. */}
              <span className="rounded-full animate-pulse" style={{ width: 7, height: 7, background: color ?? T.accent }} />
              <p className="text-center" style={{ fontSize: 11, color: T.accent2 }}>Corriendo el agente…</p>
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
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

interface FlujoMesPre { mes: number; fase: string; egresos: number; ingresos: number; acumulado: number; nota: string }

function CashFlowChart({ data }: { data: FlujoMesPre[] }) {
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
          return (
            <g key={i}>
              {d.egresos > 0 && <rect x={cx - half} y={midY} width={barW} height={hE} rx={1} fill={T.s2} opacity={0.75} />}
              {d.ingresos > 0 && <rect x={cx - half} y={midY - hI} width={barW} height={hI} rx={1} fill={T.s1} opacity={0.85} />}
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

// ─── Burbujas de chat — .msg.a / .msg.u del prototipo ──────────────────────────

function MsgA({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, lineHeight: 1.55, color: T.ink2, paddingLeft: 10, borderLeft: '1px solid rgba(126,217,174,.4)' }}>
      {children}
    </div>
  )
}
function MsgU({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="self-end"
      style={{ background: 'rgba(255,255,255,.05)', borderRadius: '8px 8px 2px 8px', padding: '6px 10px', maxWidth: '88%', color: T.ink, fontSize: 11 }}
    >
      {children}
    </div>
  )
}

// ─── Diagrama simbólico del terreno — traducción directa del SVG decorativo del
// prototipo (curvas de nivel, vialidades, trayectoria solar). Es un placeholder visual
// a propósito, no un mapa real, mientras se decide/programa algo más elaborado — el
// único dato real que muestra es la pendiente ya inferida, el resto es decorativo tal
// como en preforma_dashboard.html (nunca se inventan cifras nuevas, solo se mantiene
// el mismo dibujo simbólico que ya traía el prototipo). ──

const PENDIENTE_LABEL: Record<string, string> = {
  plano: 'Plano (< 5%)', suave: 'Suave (5–10%)', moderada: 'Moderada (10–20%)', pronunciada: 'Pronunciada (> 20%)',
}
const VIALIDAD_LABEL: Record<string, string> = {
  arterial: 'Arterial / Primaria', colectora: 'Colectora', secundaria: 'Secundaria', local: 'Local / Habitacional', privada: 'Privada / Andador',
}
const AGUA_LABEL: Record<string, string> = { 'red-municipal': 'Red municipal', pozo: 'Pozo', pipa: 'Pipa', 'sin-servicio': 'Sin servicio' }
const ELEC_LABEL: Record<string, string> = { 'cfe-frente': 'CFE frente', extension: 'Extensión requerida', 'sin-servicio': 'Sin servicio' }

function MapaSimbolico({ pendiente }: { pendiente?: string }) {
  const contornos = Array.from({ length: 26 }, (_, i) =>
    `M${-50 + i * 4},${300 - i * 9 * 1.1} Q${250 + i * 6},${210 - i * 9} 520,${190 - i * 8.1} T1050,${150 - i * 10.8}`
  )
  const vialidades = [
    ...Array.from({ length: 7 }, (_, i) => `M${-20 + i * 160},300 L${120 + i * 150},${40 + i * 18}`),
    'M0,208 Q300,190 520,214 T1000,178',
    'M0,120 Q380,150 700,96 T1000,120',
  ]
  return (
    <div className="relative" style={{ flex: 1, minHeight: 0, background: '#040706' }}>
      <svg viewBox="0 0 1000 430" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="preformaGlow" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="#4FC08D" stopOpacity=".2" /><stop offset="100%" stopColor="#4FC08D" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="preformaLot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ED9AE" stopOpacity=".26" /><stop offset="100%" stopColor="#7ED9AE" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <rect width={1000} height={430} fill="#040706" />
        <rect width={1000} height={430} fill="url(#preformaGlow)" />
        <g transform="translate(500,215) scale(1.55) translate(-520,-168)">
          <g stroke="#2E8F72" fill="none" strokeWidth={0.7} opacity={0.45}>
            {contornos.map((d, i) => <path key={i} d={d} />)}
          </g>
          <g stroke="#9CB3A8" fill="none" strokeWidth={0.8} opacity={0.2}>
            {vialidades.map((d, i) => <path key={i} d={d} />)}
          </g>
          <polygon points="430,155 545,122 616,178 505,214" fill="url(#preformaLot)" stroke="#7ED9AE" strokeWidth={1.6} />
          <polygon points="430,155 545,122 616,178 505,214" fill="none" stroke="#7ED9AE" strokeWidth={6} opacity={0.08} />
          <path d="M250 250 Q520 40 800 250" stroke="#C4842A" strokeWidth={0.9} fill="none" opacity={0.6} strokeDasharray="2 5" />
          <circle cx={520} cy={103} r={7} fill="#C4842A" opacity={0.9} /><circle cx={520} cy={103} r={15} fill="#C4842A" opacity={0.12} />
          <circle cx={520} cy={168} r={3} fill="#7ED9AE" />
          <text x={252} y={240} fill="#627A70" fontSize={9}>06:00</text>
          <text x={508} y={88} fill="#C4842A" fontSize={9}>12:00</text>
          <text x={778} y={240} fill="#627A70" fontSize={9}>18:00</text>
        </g>
      </svg>
      <div className="absolute flex flex-col overflow-hidden rounded-md" style={{ top: 9, right: 9, border: `1px solid ${T.line}`, background: 'rgba(4,7,6,.75)' }}>
        {['◈', '△', '☀', '♧', '◇', '⚠'].map((ic, i) => (
          <button
            key={i}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 27, height: 25, fontSize: 10, color: i === 0 ? T.accent : T.ink3, background: i === 0 ? 'rgba(126,217,174,.15)' : 'transparent' }}
          >
            {ic}
          </button>
        ))}
      </div>
      <div className="absolute" style={{ left: 11, bottom: 9 }}>
        <Lbl>Pendiente</Lbl>
        <b className="block" style={{ fontSize: 12.5, marginTop: 1, color: T.ink }}>{pendiente ? (PENDIENTE_LABEL[pendiente] ?? pendiente) : '—'}</b>
      </div>
      <div className="absolute flex gap-3" style={{ right: 11, bottom: 9, fontSize: 9, color: T.ink3 }}>
        <span><i style={{ display: 'inline-block', width: 11, height: 2, background: '#7ED9AE', marginRight: 4, verticalAlign: 'middle' }} />Terreno</span>
        <span><i style={{ display: 'inline-block', width: 11, height: 2, background: '#2E8F72', marginRight: 4, verticalAlign: 'middle' }} />Curvas</span>
        <span><i style={{ display: 'inline-block', width: 11, height: 2, background: '#C4842A', marginRight: 4, verticalAlign: 'middle' }} />Trayectoria solar</span>
      </div>
    </div>
  )
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
  zonas, niveles, tipoActivo, onElegirTipo, cargando,
}: {
  zonas: Array<{ zona: string; m2?: number; participacion?: string; cajonesEstimados?: number }>
  niveles?: number
  tipoActivo: 'subterraneo' | 'nivel' | null
  onElegirTipo: (tipo: 'subterraneo' | 'nivel') => void
  cargando: boolean
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

        <line x1={40} y1={GROUND_Y} x2={360} y2={GROUND_Y} stroke={T.ink3} strokeWidth={1} strokeDasharray="1 3" />
        <text x={44} y={GROUND_Y - 4} fill={T.ink3} fontSize={7.5} letterSpacing="0.05em">NIVEL DE BANQUETA</text>

        {tipoActivo === 'subterraneo' && (
          <g>
            <rect x={X0} y={GROUND_Y} width={ANCHO} height={46} fill="url(#arqHatch)" stroke={T.s2} strokeWidth={1} strokeDasharray="3 2" />
            <text x={X0 + ANCHO / 2} y={GROUND_Y + 27} fill={T.s2} fontSize={8.5} textAnchor="middle">
              Estacionamiento subterráneo{estac?.cajonesEstimados ? ` · ${estac.cajonesEstimados} cajones` : ''}
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

// ─── Matriz de sensibilidad TIR — versión compacta de app/mastermind/components/
// SensitivityMatrix.tsx, mismos datos (lib/mastermind/sensibilidad.ts) pero recortada al
// espacio/tema de PREFORMA (letra diminuta, tokens T, sin scroll). ──

const COLOR_SEMAFORO: Record<SensitivityCell['semaforo'], string> = {
  verde_oscuro: '#0A5C47', verde: T.s1, amarillo: T.s2, rojo: T.bad, gris: 'rgba(255,255,255,.06)',
}

function MatrizSensibilidad({ matriz }: { matriz: SensitivityCell[][] }) {
  const columnas = matriz[0].map(c => c.precioVentaM2)
  const filas = matriz.map(fila => fila[0].benchmarkMxnM2)
  const fmtK = (n: number) => `${Math.round(n / 1000)}k`
  return (
    <div className="flex flex-col h-full" style={{ padding: '8px 10px' }}>
      <p style={{ fontSize: 8.5, color: T.ink3, marginBottom: 5 }}>Precio $/m² (col.) vs. costo constr. $/m² (fila) → TIR Socio</p>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <td />
            {columnas.map((c, i) => <th key={i} style={{ fontSize: 7.5, color: T.ink3, fontWeight: 400, padding: '0 2px 2px' }}>{fmtK(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {matriz.map((fila, fi) => (
            <tr key={fi}>
              <td style={{ fontSize: 7.5, color: T.ink3, textAlign: 'right', paddingRight: 3, whiteSpace: 'nowrap' }}>{fmtK(filas[fi])}</td>
              {fila.map((celda, ci) => (
                <td key={ci} style={{ padding: 1 }}>
                  <div
                    title={`Precio ${fmt(celda.precioVentaM2)}/m² · Costo ${fmt(celda.benchmarkMxnM2)}/m²`}
                    className="flex items-center justify-center rounded-[3px]"
                    style={{ width: 30, height: 17, fontSize: 8, fontWeight: 600, background: COLOR_SEMAFORO[celda.semaforo], color: celda.semaforo === 'gris' ? T.ink4 : '#fff' }}
                  >
                    {celda.tirSocio !== null ? `${celda.tirSocio.toFixed(0)}%` : '—'}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Shell principal ────────────────────────────────────────────────────────────

export default function PreformaPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('resumen')

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

  // Captura de ubicación — mismo mecanismo que Flujo A
  const [ubicInput, setUbicInput] = useState('')
  const [ubicExpandiendo, setUbicExpandiendo] = useState(false)
  const [ubicError, setUbicError] = useState('')

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
  type AgentStatus = 'waiting' | 'running' | 'done' | 'error'
  const [pipe, setPipe] = useState({
    comparables: { status: 'waiting' as AgentStatus, data: [] as any[] },
    comparablesVenta: { status: 'waiting' as AgentStatus, data: [] as any[] },
    ubicacion: { status: 'waiting' as AgentStatus, data: null as any },
    terreno: { status: 'waiting' as AgentStatus, corridas: [] as any[], seleccionada: null as number | null, overrideM2: '' },
    legal: { status: 'waiting' as AgentStatus, data: null as any },
    mercado: { status: 'waiting' as AgentStatus, corridas: [] as any[], seleccionada: null as number | null },
    arquitectura: { status: 'waiting' as AgentStatus, corridas: [] as any[], seleccionada: null as number | null },
    construccion: { status: 'waiting' as AgentStatus, corridas: [] as any[], seleccionada: null as number | null, overrideM2: '' },
    financiero: { status: 'waiting' as AgentStatus, data: null as any, precioVentaObjetivo: '', unidadesObjetivo: '' },
  })

  const terrenoActual = pipe.terreno.seleccionada !== null ? pipe.terreno.corridas[pipe.terreno.seleccionada] : null
  const mercadoActual = pipe.mercado.seleccionada !== null ? pipe.mercado.corridas[pipe.mercado.seleccionada] : null
  const arquitecturaActual = pipe.arquitectura.seleccionada !== null ? pipe.arquitectura.corridas[pipe.arquitectura.seleccionada] : null
  const construccionActual = pipe.construccion.seleccionada !== null ? pipe.construccion.corridas[pipe.construccion.seleccionada] : null

  // ── Tiempos por agente — para la barra de pipeline al pie de la página (sonar + cronómetro
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
  // de la barra de pipeline avance en vivo (si no, solo se actualizaría al terminar).
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
        body: JSON.stringify({ colonia: form.colonia, ciudad: form.ciudad, estado: form.estado, codigoPostal: form.codigoPostal, tiposDesarrollo: form.tiposDesarrollo, bandaConstruccion: form.bandaConstruccion }),
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

  async function runMercado(overrides?: { precioVentaObjetivo?: string; unidadesObjetivo?: string }) {
    setPipe(p => ({ ...p, mercado: { ...p.mercado, status: 'running' } }))
    marcarInicio('mercado')
    const comparablesVenta = await runComparablesVenta()
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
    const m2 = pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2
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
    const m2t = pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : t.costoTerrenoM2
    const m2c = pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : c.construccionM2
    const costoTerreno = m2t * Number(form.superficie)
    const costoTotalConstruccion = c.costoTotalConstruccion || m2c * (c.superficieConstruida || Number(form.superficie) * 1.2)
    const mixHabReal = arquitecturaActual?.bitacoraArquitectura?.tipologiaPropuesta?.habitacional?.mix ?? []
    const unidadesRealesArquitectura = mixHabReal.reduce((s: number, r: any) => s + (r.unidades || 0), 0)
    const unidadesObjetivo = pipe.financiero.unidadesObjetivo || (unidadesRealesArquitectura > 0 ? String(unidadesRealesArquitectura) : undefined)
    const payload = {
      ...form, costoTerrenoM2: m2t, costoTerreno, construccionM2: m2c, costoTotalConstruccion,
      superficieConstruida: c.superficieConstruida, superficieVendible: c.superficieVendible,
      fichaLegal: pipe.legal.data?.fichaLegal, mercado: mercadoActual?.mercado,
      precioVentaObjetivo: pipe.financiero.precioVentaObjetivo || undefined, unidadesObjetivo,
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
      setPipe(p.datos.pipe)
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
    setPipe({
      comparables: { status: 'waiting', data: [] },
      comparablesVenta: { status: 'waiting', data: [] },
      ubicacion: { status: 'waiting', data: null },
      terreno: { status: 'waiting', corridas: [], seleccionada: null, overrideM2: '' },
      legal: { status: 'waiting', data: null },
      mercado: { status: 'waiting', corridas: [], seleccionada: null },
      arquitectura: { status: 'waiting', corridas: [], seleccionada: null },
      construccion: { status: 'waiting', corridas: [], seleccionada: null, overrideM2: '' },
      financiero: { status: 'waiting', data: null, precioVentaObjetivo: '', unidadesObjetivo: '' },
    })
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
  const coreInputs = (() => {
    const terreno = extractTerrenoContext(snapshot)
    if (pipe.terreno.overrideM2 !== '') { terreno.costoTerrenoM2 = Number(pipe.terreno.overrideM2); terreno.costoTerreno = terreno.costoTerrenoM2 * terreno.superficieM2 }
    const proyecto = { ...DEFAULTS.proyecto, ...extractProyectoContext(snapshot) }
    if (pipe.construccion.overrideM2 !== '') proyecto.costoConstruccionRealM2 = Number(pipe.construccion.overrideM2)
    if (pipe.financiero.unidadesObjetivo) proyecto.unidadesHabitacionales = Number(pipe.financiero.unidadesObjetivo)
    const mercado = { ...DEFAULTS.mercado, ...extractMercadoContext(snapshot) }
    if (pipe.financiero.precioVentaObjetivo) mercado.precioVentaDepasM2 = Number(pipe.financiero.precioVentaObjetivo)
    return { terreno, proyecto, mercado }
  })()
  const resumen = calcularMastermindCore(coreInputs)
  const financieroReal = pipe.financiero.data?.financiero
  const estructuraCapital = pipe.financiero.data?.estructuraCapital
  const flujoMensual = pipe.financiero.data?.flujoMensual as any[] | undefined
  const scoreReal = pipe.financiero.data?.score

  // ── Fase 2: matriz de sensibilidad TIR + comparación de escenarios A/B/C — reusa el mismo
  // motor puro que ya usa Mastermind (lib/mastermind/sensibilidad.ts), no se reimplementa.
  // Solo se puede calcular una vez que el Agente Financiero ya corrió: hace falta tiempo/
  // financiamiento calibrados con datos reales (plazo de obra/venta, mezcla deuda/equity) para
  // centrar la matriz en el escenario real, no en un default genérico.
  const mastermindInputsCompletos: MastermindInputs | null = financieroReal ? {
    ...coreInputs,
    tiempo: {
      plazoObraMeses: financieroReal.plazoObraMeses || DEFAULTS.tiempo.plazoObraMeses,
      plazoVentaMeses: financieroReal.plazoVentaMeses || DEFAULTS.tiempo.plazoVentaMeses,
      inicioVentasMes: financieroReal.inicioVentasMes || DEFAULTS.tiempo.inicioVentasMes,
    },
    financiamiento: {
      porcentajeFinanciado: estructuraCapital?.deuda ?? DEFAULTS.financiamiento.porcentajeFinanciado,
      tasaAnualCredito: estructuraCapital?.tasaDeudaAnual ?? DEFAULTS.financiamiento.tasaAnualCredito,
    },
    tirObjetivo: DEFAULTS.tirObjetivo,
  } : null
  const matrizSensibilidad: SensitivityCell[][] | null = mastermindInputsCompletos ? generarMatrizSensibilidad(mastermindInputsCompletos) : null

  // Escenario A ("Base") sigue mostrando financieroReal.tir tal cual (dato real del Agente
  // Financiero, sin tocar) — B y C son simulaciones del mismo motor determinístico variando
  // precio de venta y costo de construcción alrededor de ese mismo caso base.
  function escenarioSimulado(deltaPrecioPct: number, deltaCostoPct: number): number | null {
    if (!mastermindInputsCompletos) return null
    const precioBase = mastermindInputsCompletos.mercado.precioVentaDepasM2
    const costoBase = mastermindInputsCompletos.proyecto.costoConstruccionRealM2 ?? BENCHMARKS_CONSTRUCCION_MXN_M2[mastermindInputsCompletos.proyecto.benchmarkConstruccion]
    const out = calcularMastermind({
      ...mastermindInputsCompletos,
      mercado: { ...mastermindInputsCompletos.mercado, precioVentaDepasM2: precioBase * (1 + deltaPrecioPct / 100) },
      proyecto: { ...mastermindInputsCompletos.proyecto, costoConstruccionRealM2: costoBase * (1 + deltaCostoPct / 100) },
    })
    return out.retorno.tirSocioConverge ? out.retorno.tirSocioAnual : null
  }
  const tirConservador = escenarioSimulado(-10, 10)
  const tirOptimista = escenarioSimulado(10, -8)

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
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-[7px] rounded-md transition-colors cursor-pointer"
              style={{
                fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                color: tab === t.key ? T.accent : T.ink3,
                background: tab === t.key ? 'rgba(126,217,174,.08)' : 'transparent',
                boxShadow: tab === t.key ? `inset 0 -1px 0 ${T.accent}` : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
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

      {/* ── Shell de 3 columnas ── */}
      <div className="flex-1 min-h-0 grid overflow-hidden" style={{ gridTemplateColumns: '212px 1fr 286px' }}>

        {/* ── Rail izquierdo: ficha del proyecto ── */}
        <aside className="flex flex-col gap-1.5 p-2 overflow-y-auto" style={{ borderRight: `1px solid ${T.line}` }}>
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
            <CardHead right={<button style={{ fontSize: 9.5, letterSpacing: '.11em', textTransform: 'uppercase', color: T.ink3 }}>+ Nuevo</button>}>Escenarios</CardHead>
            <Cb style={{ padding: 0 }}>
              <ScenarioRow
                nombre={`A · ${form.tiposDesarrollo.map(id => TIPOS_DESARROLLO.find(t => t.id === id)?.label).filter(Boolean).join(', ') || 'Sin definir'}`}
                sub={arquitecturaActual ? `${arquitecturaActual.bitacoraArquitectura?.tipologiaPropuesta?.niveles ?? '—'} niveles · ${Math.round(arquitecturaActual.superficieVendible || 0).toLocaleString('es-MX')} m²` : 'Esperando captura'}
                tir={financieroReal?.tir != null ? `${financieroReal.tir.toFixed(1)}%` : '—'}
                color={T.accent}
                activo
              />
              {mastermindInputsCompletos && (
                <>
                  <ScenarioRow nombre="B · Conservador" sub="Precio −10% · Costo constr. +10%" tir={tirConservador != null ? `${tirConservador.toFixed(1)}%` : '—'} color={T.s2} />
                  <ScenarioRow nombre="C · Optimista" sub="Precio +10% · Costo constr. −8%" tir={tirOptimista != null ? `${tirOptimista.toFixed(1)}%` : '—'} color={T.s1} />
                </>
              )}
            </Cb>
          </Card>
        </aside>

        {/* ── Stage central ── */}
        <main className="p-2.5 overflow-y-auto flex flex-col gap-2 min-w-0">
          {tab === 'resumen' && (
            <>
              <div className="grid gap-px rounded-[9px] border overflow-hidden shrink-0" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', background: T.line, borderColor: T.line }}>
                {/* "TIR Socio" — así se le llama a este mismo dato en el resto de la app
                    (propuesta/analisis); el prototipo lo etiquetaba "TIR del proyecto" pero no
                    tenemos un segundo TIR sin apalancar por separado, así que evito inventarlo. */}
                <Kpi label="TIR Socio" value={financieroReal?.tir != null ? `${financieroReal.tir.toFixed(1)}%` : '—'} sub={financieroReal ? 'caso base' : 'Esperando Agente Financiero'} hero />
                <Kpi label="Margen bruto" value={terrenoActual ? `${(financieroReal?.margenBruto ?? resumen.utilidad.margenBruto).toFixed(1)}%` : '—'} />
                <Kpi label="Utilidad neta" value={terrenoActual ? fmtM(estructuraCapital?.utilidadNeta ?? resumen.utilidad.utilidadAntesImpuestos) : '—'} />
                <Kpi label="Inversión total" value={terrenoActual ? fmtM(financieroReal?.inversionTotal ?? resumen.costos.costoTotal) : '—'} />
                <Kpi label="Plazo" value={financieroReal?.plazoVentaMeses ? `${financieroReal.plazoVentaMeses} m` : '—'} />
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1.34fr 1fr', flex: 1, minHeight: 0 }}>
                <div className="flex flex-col gap-2 min-h-0">
                  <Card flex="1.05">
                    <CardHead>Sitio y contexto</CardHead>
                    {form.lat != null && form.lng != null ? (
                      <MapaSimbolico pendiente={form.pendiente} />
                    ) : (
                      <Cb><div className="h-full flex items-center justify-center py-10"><p style={{ fontSize: 11, color: T.ink4 }}>Aparece en cuanto captures la ubicación</p></div></Cb>
                    )}
                  </Card>
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
                      <MatrizSensibilidad matriz={matrizSensibilidad} />
                    </Card>
                  ) : (
                    <CardPendiente titulo="Sensibilidad · TIR" nota="Se calcula en cuanto corre el Agente Financiero" estado={pipe.financiero.status} />
                  )}
                  <Card>
                    <CardHead right={pipe.terreno.overrideM2 || pipe.construccion.overrideM2 || pipe.financiero.precioVentaObjetivo || pipe.financiero.unidadesObjetivo
                      ? <button onClick={() => setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: '' }, construccion: { ...p.construccion, overrideM2: '' }, financiero: { ...p.financiero, precioVentaObjetivo: '', unidadesObjetivo: '' } }))} style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, cursor: 'pointer' }}>Restaurar</button>
                      : undefined}>
                      Supuestos editables
                    </CardHead>
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                      {terrenoActual ? (
                        <StepperRow
                          label="Costo terreno $/m²"
                          value={fmt(pipe.terreno.overrideM2 !== '' ? Number(pipe.terreno.overrideM2) : terrenoActual.costoTerrenoM2)}
                          onDec={() => setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: String(Math.max(0, (p.terreno.overrideM2 !== '' ? Number(p.terreno.overrideM2) : terrenoActual.costoTerrenoM2) - 500)) } }))}
                          onInc={() => setPipe(p => ({ ...p, terreno: { ...p.terreno, overrideM2: String((p.terreno.overrideM2 !== '' ? Number(p.terreno.overrideM2) : terrenoActual.costoTerrenoM2) + 500) } }))}
                        />
                      ) : <StepperRowPendiente label="Costo terreno $/m²" />}
                      {construccionActual ? (
                        <StepperRow
                          label="Costo construcción $/m²"
                          value={fmt(pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : construccionActual.construccionM2)}
                          onDec={() => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: String(Math.max(0, (p.construccion.overrideM2 !== '' ? Number(p.construccion.overrideM2) : construccionActual.construccionM2) - 500)) } }))}
                          onInc={() => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: String((p.construccion.overrideM2 !== '' ? Number(p.construccion.overrideM2) : construccionActual.construccionM2) + 500) } }))}
                        />
                      ) : <StepperRowPendiente label="Costo construcción $/m²" />}
                      {mercadoActual ? (
                        <StepperRow
                          label="Precio de venta $/m²"
                          value={fmt(pipe.financiero.precioVentaObjetivo !== '' ? Number(pipe.financiero.precioVentaObjetivo) : coreInputs.mercado.precioVentaDepasM2)}
                          onDec={() => setPipe(p => ({ ...p, financiero: { ...p.financiero, precioVentaObjetivo: String(Math.max(0, (p.financiero.precioVentaObjetivo !== '' ? Number(p.financiero.precioVentaObjetivo) : coreInputs.mercado.precioVentaDepasM2) - 500)) } }))}
                          onInc={() => setPipe(p => ({ ...p, financiero: { ...p.financiero, precioVentaObjetivo: String((p.financiero.precioVentaObjetivo !== '' ? Number(p.financiero.precioVentaObjetivo) : coreInputs.mercado.precioVentaDepasM2) + 500) } }))}
                        />
                      ) : <StepperRowPendiente label="Precio de venta $/m²" />}
                      {arquitecturaActual ? (
                        <StepperRow
                          label="Unidades objetivo"
                          value={String(pipe.financiero.unidadesObjetivo !== '' ? Number(pipe.financiero.unidadesObjetivo) : coreInputs.proyecto.unidadesHabitacionales)}
                          onDec={() => setPipe(p => ({ ...p, financiero: { ...p.financiero, unidadesObjetivo: String(Math.max(0, (p.financiero.unidadesObjetivo !== '' ? Number(p.financiero.unidadesObjetivo) : coreInputs.proyecto.unidadesHabitacionales) - 1)) } }))}
                          onInc={() => setPipe(p => ({ ...p, financiero: { ...p.financiero, unidadesObjetivo: String((p.financiero.unidadesObjetivo !== '' ? Number(p.financiero.unidadesObjetivo) : coreInputs.proyecto.unidadesHabitacionales) + 1) } }))}
                        />
                      ) : <StepperRowPendiente label="Unidades objetivo" />}
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
                  <p style={{ fontSize: 11, color: T.ink2, marginBottom: 10 }}>
                    Pega un link de Google Maps o unas coordenadas tipo Google Earth ("25.6547, -100.4033").
                  </p>
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
                      <LeafletPicker lat={form.lat} lng={form.lng} onMove={(lat, lng) => setForm(f => ({ ...f, lat, lng }))} />
                      <p style={{ fontSize: 10, color: T.ink4, marginTop: 6, fontFamily: 'monospace' }}>{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>
                      <button
                        onClick={confirmarUbicacion}
                        className="cursor-pointer"
                        style={{ marginTop: 10, height: 32, padding: '0 16px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: 'rgba(126,217,174,.15)', border: '1px solid rgba(126,217,174,.45)', color: T.accent }}
                      >
                        Confirmar ubicación →
                      </button>
                    </>
                  )}
                </Cb>
              </Card>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                <Card>
                  <CardHead>Sitio y contexto</CardHead>
                  {form.lat != null ? <MapaSimbolico pendiente={form.pendiente} /> : <Cb><div className="h-full flex items-center justify-center py-10"><p style={{ fontSize: 11, color: T.ink4 }}>—</p></div></Cb>}
                </Card>
                <div className="flex flex-col gap-2 min-h-0">
                  <Card>
                    <CardHead right={terrenoActual?.bitacoraTerreno?.indiceConfiabilidad?.semaforo
                      ? <Mini>{terrenoActual.bitacoraTerreno.indiceConfiabilidad.semaforo}</Mini> : undefined}>
                      Características físicas
                    </CardHead>
                    <Cb fill>
                      <Kv label="Superficie" value={form.superficie ? `${Number(form.superficie).toLocaleString('es-MX')} m²` : '—'} />
                      <Kv label="Pendiente" value={form.pendiente ? (PENDIENTE_LABEL[form.pendiente] ?? form.pendiente) : '—'} />
                      <Kv label="Uso de suelo" value={pipe.legal.data?.fichaLegal?.usoSuelo || form.usoSuelo || '—'} />
                      <Kv label="Estado del predio" value={form.esEsquina === 'si' ? 'Esquina' : form.esEsquina === 'no' ? 'No esquina' : '—'} />
                      <Kv label="Precio calculado" value={terrenoActual ? `${fmt(terrenoActual.costoTerrenoM2)}/m²` : '—'} />
                    </Cb>
                  </Card>
                  <Card>
                    <CardHead>Accesibilidad y servicios</CardHead>
                    <Cb fill>
                      <Kv label="Clasificación vial" value={form.clasificacionVial ? VIALIDAD_LABEL[form.clasificacionVial] ?? form.clasificacionVial : '—'} />
                      <Kv label="Pavimento frente" value={form.pavimento === 'si' ? 'Sí' : form.pavimento === 'no' ? 'No' : '—'} />
                      <Kv label="Agua potable" value={pipe.legal.data?.fichaLegal?.factibilidades?.agua?.status || (form.agua ? AGUA_LABEL[form.agua] ?? form.agua : '—')} />
                      <Kv label="Drenaje" value={pipe.legal.data?.fichaLegal?.factibilidades?.drenaje?.status ?? '—'} />
                      <Kv label="Energía eléctrica" value={pipe.legal.data?.fichaLegal?.factibilidades?.cfe?.status || (form.electricidad ? ELEC_LABEL[form.electricidad] ?? form.electricidad : '—')} />
                    </Cb>
                  </Card>
                  {terrenoActual?.bitacoraTerreno?.indiceConfiabilidad?.interpretacion ? (
                    <Card flex="none">
                      <CardHead>Lectura del Agente Terreno</CardHead>
                      <Cb>
                        <p style={{ fontSize: 11, color: T.ink2, lineHeight: 1.6 }}>{terrenoActual.bitacoraTerreno.indiceConfiabilidad.interpretacion}</p>
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
              const filas: [string, string | undefined][] = [
                ['COS', fl.cos], ['CUS', fl.cus], ['Altura máxima', fl.altura], ['Cajones', fl.cajones],
                ['Retiros', fl.retiros], ['Densidad autorizada', fl.densidadAutorizada], ['Régimen de condominio', fl.regimenCondominio],
              ]
              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card>
                      <CardHead right={<Mini>{fl.municipio}</Mini>}>Parámetros normativos</CardHead>
                      <Cb style={{ padding: 0 }} fill>
                        {filas.filter(([, v]) => v).map(([k, v]) => <Kv key={k} label={k} value={v!} />)}
                      </Cb>
                    </Card>
                    <Card flex="none">
                      <CardHead>Restricción principal</CardHead>
                      <Cb><p style={{ fontSize: 11, color: T.ink2, lineHeight: 1.6 }}>{fl.restriccion || '—'}</p></Cb>
                    </Card>
                  </div>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead>Compatibilidad</CardHead>
                      <Cb style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 10.5, color: T.ink3 }}>Uso de suelo</span>
                          <span
                            className="rounded-full"
                            style={{ fontSize: 9, padding: '2px 8px', letterSpacing: '.08em', textTransform: 'uppercase', color: fl.compatible === false ? T.bad : T.accent, border: `1px solid ${fl.compatible === false ? T.bad : T.accent}55` }}
                          >
                            {fl.compatible === false ? 'Requiere cambio' : fl.compatible === true ? 'Compatible' : '—'}
                          </span>
                        </div>
                        {fl.nivelRiesgo && (
                          <div className="flex items-center justify-between">
                            <span style={{ fontSize: 10.5, color: T.ink3 }}>Nivel de riesgo</span>
                            <span
                              className="rounded-full"
                              style={{ fontSize: 9, padding: '2px 8px', letterSpacing: '.08em', textTransform: 'uppercase', color: fl.nivelRiesgo === 'Alto' ? T.bad : fl.nivelRiesgo === 'Medio' ? T.s2 : T.accent, border: `1px solid currentColor` }}
                            >
                              {fl.nivelRiesgo}
                            </span>
                          </div>
                        )}
                      </Cb>
                    </Card>
                    {fl.factibilidades && (
                      <Card flex="none">
                        <CardHead>Factibilidades</CardHead>
                        <Cb style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Kv label="Agua" value={fl.factibilidades.agua?.status ?? '—'} />
                          <Kv label="Drenaje" value={fl.factibilidades.drenaje?.status ?? '—'} />
                          <Kv label="CFE" value={fl.factibilidades.cfe?.status ?? '—'} />
                        </Cb>
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
                  </div>
                </div>
              )
            })() : <CardPendiente titulo="Normativa" nota="Se llena con el Agente Legal" estado={pipe.legal.status} color={T.s3} onReintentar={pipe.legal.status === 'error' ? () => runLegal() : undefined} />
          )}
          {tab === 'mercado' && (
            mercadoActual?.mercado ? (() => {
              const m = mercadoActual.mercado
              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <Card>
                    <CardHead right={m.zona ? <Mini>{m.zona}</Mini> : undefined}>Comparables de la zona</CardHead>
                    {m.comparables && m.comparables.length > 0 ? (
                      <Cb style={{ padding: 0 }}>
                        <table className="w-full" style={{ fontSize: 10.5 }}>
                          <thead>
                            <tr>
                              {['Desarrollo', 'Tipología', '$/m²', 'Unidades', 'Avance'].map(h => (
                                <th key={h} className={h === 'Desarrollo' || h === 'Tipología' ? 'text-left' : 'text-right'} style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, padding: '5px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {m.comparables.map((c: any, i: number) => (
                              <tr key={i}>
                                <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{c.nombre}</td>
                                <td style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{c.tipologia || '—'}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}><b>{c.precioM2 != null ? c.precioM2.toLocaleString('es-MX') : '—'}</b></td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{c.unidades ?? '—'}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{c.avanceObra || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Cb>
                    ) : (
                      <Cb><div className="h-full flex items-center justify-center py-10"><p style={{ fontSize: 11, color: T.ink4 }}>Sin comparables encontrados</p></div></Cb>
                    )}
                  </Card>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card flex="none">
                      <CardHead>Indicadores de zona</CardHead>
                      <Cb fill>
                        <Kv label="Demanda" value={m.demanda || '—'} />
                        <Kv label="Precio promedio zona" value={m.precioPromedioZona || '—'} />
                        <Kv label="Absorción" value={m.absorcion || '—'} />
                        <Kv label="Proyectos activos" value={m.proyectosActivos || '—'} />
                        <Kv label="Inventario" value={m.inventario || '—'} />
                        <Kv label="Plusvalía" value={m.plusvalia || '—'} />
                        <Kv label="Perfil NSE" value={m.perfilNSE || '—'} />
                      </Cb>
                    </Card>
                    {m.segmentacion && m.segmentacion.length > 0 ? (
                      <Card>
                        <CardHead>Demanda por tipología</CardHead>
                        <Cb style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {m.segmentacion.map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="truncate" style={{ width: 100, fontSize: 10, color: T.ink2 }}>{s.tipo}</span>
                              <div className="rounded overflow-hidden flex-1" style={{ height: 6, background: 'rgba(255,255,255,.05)' }}>
                                <div style={{ width: s.participacion, height: '100%', background: T.s1, borderRadius: 3 }} />
                              </div>
                              <span className="text-right shrink-0" style={{ width: 60, fontSize: 9.5, color: T.ink3 }}>{s.participacion}</span>
                            </div>
                          ))}
                        </Cb>
                      </Card>
                    ) : (
                      <CardPendiente titulo="Demanda por tipología" nota="Sin segmentación devuelta" />
                    )}
                    {m.productoRecomendado && (
                      <Card flex="none">
                        <CardHead>Producto recomendado</CardHead>
                        <Cb><p style={{ fontSize: 11.5, fontWeight: 600, color: T.ink }}>{m.productoRecomendado}</p></Cb>
                      </Card>
                    )}
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
              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card>
                      <CardHead right={tip?.niveles ? <Mini>{tip.niveles} niveles</Mini> : undefined}>Programa arquitectónico</CardHead>
                      <Cb style={{ padding: 0 }}>
                        <table className="w-full" style={{ fontSize: 10.5 }}>
                          <thead>
                            <tr>
                              {['Componente', 'Unidades', 'm²/u', 'Total m²'].map(h => (
                                <th key={h} className={h === 'Componente' ? 'text-left' : 'text-right'} style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, padding: '5px 8px', borderBottom: `1px solid ${T.line}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {mixHab.map((r: any, i: number) => (
                              <tr key={i}>
                                <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{r.tipo}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{r.unidades}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{r.m2Promedio}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}><b>{Math.round((r.unidades || 0) * (r.m2Promedio || 0)).toLocaleString('es-MX')}</b></td>
                              </tr>
                            ))}
                            {tip?.comercial && (
                              <tr>
                                <td style={{ padding: '5px 8px', color: T.ink, borderBottom: '1px solid rgba(255,255,255,.03)' }}>Comercial planta baja</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>{tip.comercial.totalLocales}</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>—</td>
                                <td className="text-right" style={{ padding: '5px 8px', color: T.ink2, borderBottom: '1px solid rgba(255,255,255,.03)' }}>—</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </Cb>
                    </Card>
                    {zonas.length > 0 && (
                      <Card>
                        <CardHead right={<Mini>{zonas.length} zonas</Mini>}>Diagrama de tipología y estacionamiento</CardHead>
                        <DiagramaArquitectura
                          zonas={zonas}
                          niveles={tip?.niveles}
                          tipoActivo={ba.tipoEstacionamientoFijado ?? null}
                          cargando={pipe.arquitectura.status === 'running'}
                          onElegirTipo={(t) => runArquitectura({ estacionamientoOverride: t })}
                        />
                      </Card>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card>
                      <CardHead>Eficiencia del proyecto</CardHead>
                      <Cb fill>
                        <Kv label="Superficie construida" value={arquitecturaActual.superficieConstruida ? `${Math.round(arquitecturaActual.superficieConstruida).toLocaleString('es-MX')} m²` : '—'} />
                        <Kv label="Superficie vendible" value={arquitecturaActual.superficieVendible ? `${Math.round(arquitecturaActual.superficieVendible).toLocaleString('es-MX')} m²` : '—'} />
                        <Kv label="Eficiencia" value={arquitecturaActual.superficieConstruida ? `${Math.round((arquitecturaActual.superficieVendible / arquitecturaActual.superficieConstruida) * 100)}%` : '—'} />
                        <Kv label="Área libre" value={ba.areaLibreYVerde ? `${Math.round(ba.areaLibreYVerde.m2).toLocaleString('es-MX')} m² (${ba.areaLibreYVerde.porcentajeLote})` : '—'} />
                        <Kv label="Amenidades" value={tip?.tamanoAmenidades ? `${Math.round(tip.tamanoAmenidades).toLocaleString('es-MX')} m²` : '—'} />
                        <Kv label="Niveles" value={tip?.niveles ?? '—'} />
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
              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr', flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col gap-2 min-h-0">
                    <Card>
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
                    <Card>
                      <CardHead>Resumen de costeo</CardHead>
                      <Cb fill>
                        <Kv label="Costo/m² final" value={bc.costoPorM2Final ? `${fmt(bc.costoPorM2Final)}/m²` : '—'} />
                        <Kv label="Costo/m² vendible" value={bc.costoPorM2VendibleFinal ? `${fmt(bc.costoPorM2VendibleFinal)}/m²` : '—'} />
                        <Kv label="Costo total" value={bc.costoTotalConstruccion ? fmtM(bc.costoTotalConstruccion) : '—'} />
                        <Kv label="Rango de referencia" value={bc.rangoReferencia ? `${fmt(bc.rangoReferencia.minimo)} – ${fmt(bc.rangoReferencia.maximo)}` : '—'} />
                        <Kv label="Confiabilidad" value={bc.indiceConfiabilidad?.semaforo ?? '—'} />
                        <Kv label="Fuente" value={bc.fuenteReferencia ?? '—'} />
                      </Cb>
                    </Card>
                    <Card flex="none">
                      <CardHead right={pipe.construccion.overrideM2
                        ? <button onClick={() => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: '' } }))} style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3, cursor: 'pointer' }}>Restaurar</button>
                        : undefined}>
                        Supuesto editable
                      </CardHead>
                      <StepperRow
                        label="Costo construcción $/m²"
                        value={fmt(pipe.construccion.overrideM2 !== '' ? Number(pipe.construccion.overrideM2) : construccionActual.construccionM2)}
                        onDec={() => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: String(Math.max(0, (p.construccion.overrideM2 !== '' ? Number(p.construccion.overrideM2) : construccionActual.construccionM2) - 500)) } }))}
                        onInc={() => setPipe(p => ({ ...p, construccion: { ...p.construccion, overrideM2: String((p.construccion.overrideM2 !== '' ? Number(p.construccion.overrideM2) : construccionActual.construccionM2) + 500) } }))}
                      />
                    </Card>
                    {bc.razonamiento && (
                      <Card>
                        <CardHead>Lectura del Agente de Costos de Construcción</CardHead>
                        <Cb><p style={{ fontSize: 11, color: T.ink2, lineHeight: 1.6 }}>{bc.razonamiento}</p></Cb>
                      </Card>
                    )}
                  </div>
                </div>
              )
            })() : <CardPendiente titulo="Costos" nota="Se llena con el Agente de Costos de Construcción" estado={pipe.construccion.status} color={T.bad} onReintentar={pipe.construccion.status === 'error' ? () => runConstruccion() : undefined} />
          )}
          {tab === 'financiero' && (
            financieroReal ? (
              <div className="grid gap-2" style={{ gridTemplateColumns: '1.34fr 1fr', flex: 1, minHeight: 0 }}>
                <div className="flex flex-col gap-2 min-h-0">
                  {flujoMensual && flujoMensual.length > 0 ? (
                    <Card flex="1.1">
                      <CardHead>Flujo de caja proyectado</CardHead>
                      <div style={{ flex: 1, minHeight: 0, padding: '8px 4px' }}><CashFlowChart data={flujoMensual as FlujoMesPre[]} /></div>
                      <div className="flex gap-4" style={{ padding: '4px 11px 8px', fontSize: 9.5, color: T.ink3 }}>
                        <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: T.s1 }} />Ingresos</span>
                        <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: T.s2 }} />Egresos</span>
                      </div>
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
                    <CardHead>Estructura de capital</CardHead>
                    <Cb>
                      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 10.5, color: T.accent, fontWeight: 600 }}>Equity {estructuraCapital?.equity ?? '—'}%</span>
                        <span style={{ fontSize: 10.5, color: T.s3, fontWeight: 600 }}>Deuda {estructuraCapital?.deuda ?? '—'}%</span>
                      </div>
                      <div className="flex rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,.06)' }}>
                        <div style={{ width: `${estructuraCapital?.equity ?? 0}%`, background: T.accent }} />
                        <div style={{ width: `${estructuraCapital?.deuda ?? 0}%`, background: T.s3 }} />
                      </div>
                      <div className="flex justify-between" style={{ marginTop: 3, marginBottom: 6 }}>
                        <span style={{ fontSize: 9.5, color: T.ink3 }}>{estructuraCapital?.montoEquity ? fmtM(estructuraCapital.montoEquity) : '—'}</span>
                        <span style={{ fontSize: 9.5, color: T.ink3 }}>{estructuraCapital?.montoDeuda ? fmtM(estructuraCapital.montoDeuda) : '—'}</span>
                      </div>
                      <Kv label="Tipo de deuda" value={estructuraCapital?.tipoDeuda ?? '—'} />
                      <Kv label="Tasa" value={estructuraCapital?.tasaDeuda ?? '—'} />
                      <Kv label="Costo financiero" value={estructuraCapital?.costoFinanciero ? fmtM(estructuraCapital.costoFinanciero) : '—'} />
                      <Kv label="Utilidad neta" value={estructuraCapital?.utilidadNeta ? fmtM(estructuraCapital.utilidadNeta) : '—'} />
                    </Cb>
                  </Card>
                  <Card flex="none">
                    <CardHead>Preventa mínima</CardHead>
                    <Cb>
                      <Kv label="Unidades" value={estructuraCapital?.preventa?.unidadesMinimas ?? '—'} />
                      <Kv label="% mínimo" value={estructuraCapital?.preventa?.porcentajeMinimo ?? '—'} />
                      <Kv label="Monto mínimo" value={estructuraCapital?.preventa?.montoMinimo ? fmtM(estructuraCapital.preventa.montoMinimo) : '—'} />
                      <Kv label="Plazo obra" value={financieroReal.plazoObraMeses ? `${financieroReal.plazoObraMeses} m` : '—'} />
                      <Kv label="Plazo venta" value={financieroReal.plazoVentaMeses ? `${financieroReal.plazoVentaMeses} m` : '—'} />
                    </Cb>
                  </Card>
                </div>
              </div>
            ) : <CardPendiente titulo="Financiero" nota="Se llena con el Agente Financiero" estado={pipe.financiero.status} color={T.accent} onReintentar={pipe.financiero.status === 'error' ? () => runFinanciero() : undefined} />
          )}
        </main>

        {/* ── Side derecho: riesgos + agente ── */}
        <aside className="flex flex-col gap-2 p-2.5 overflow-hidden" style={{ borderLeft: `1px solid ${T.line}` }}>
          <Card flex="none">
            <CardHead right={<Mini>0 activos</Mini>}>Riesgos críticos</CardHead>
            <Cb style={{ padding: '9px 11px' }}>
              <p style={{ fontSize: 10.5, color: T.ink3 }}>Aparecen conforme los agentes detectan alertas</p>
            </Cb>
          </Card>

          <Card>
            <CardHead right={<span style={{ color: T.accent }}>● en línea</span>}>Agente PREFORMA</CardHead>

            <div className="overflow-y-auto flex flex-col gap-2.5" style={{ padding: '10px 11px', flex: 1, minHeight: 0 }}>
              {chat.map((m, i) => m.who === 'a' ? <MsgA key={i}>{m.text}</MsgA> : <MsgU key={i}>{m.text}</MsgU>)}
              <div ref={chatEndRef} />
            </div>

            {!intakeDone && preguntaActual && (
              <div style={{ borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
                {preguntaActual.kind === 'chips-single' && (
                  <div className="flex flex-wrap gap-1.5" style={{ padding: '10px 11px' }}>
                    {preguntaActual.opciones!.map(o => (
                      <button
                        key={o.id}
                        onClick={() => elegirChipUnico(o.id, o.label)}
                        className="cursor-pointer"
                        style={{ fontSize: 10.5, padding: '5px 10px', border: `1px solid ${T.line2}`, borderRadius: 12, color: T.ink2 }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}

                {preguntaActual.kind === 'chips-multi' && (
                  <div style={{ padding: '10px 11px' }}>
                    <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 8 }}>
                      {preguntaActual.opciones!.map(o => (
                        <button
                          key={o.id}
                          onClick={() => toggleChipMulti(o.id)}
                          className="cursor-pointer"
                          style={{
                            fontSize: 10.5, padding: '5px 10px', borderRadius: 12,
                            border: tipoSel.includes(o.id) ? `1px solid ${T.accent}` : `1px solid ${T.line2}`,
                            background: tipoSel.includes(o.id) ? 'rgba(126,217,174,.12)' : 'transparent',
                            color: tipoSel.includes(o.id) ? T.accent : T.ink2,
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={confirmarTipos}
                      disabled={tipoSel.length === 0}
                      className="cursor-pointer"
                      style={{
                        height: 26, padding: '0 12px', borderRadius: 13, fontSize: 10, fontWeight: 600,
                        background: tipoSel.length ? 'rgba(126,217,174,.15)' : 'transparent',
                        border: `1px solid ${tipoSel.length ? 'rgba(126,217,174,.45)' : T.line2}`,
                        color: tipoSel.length ? T.accent : T.ink4,
                      }}
                    >
                      Continuar →
                    </button>
                  </div>
                )}

                {(preguntaActual.kind === 'texto' || preguntaActual.kind === 'numero') && (
                  <div className="flex items-center gap-1.5" style={{ padding: '8px 11px' }}>
                    <input
                      autoFocus
                      type={preguntaActual.kind === 'numero' ? 'number' : 'text'}
                      value={texto}
                      onChange={e => setTexto(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') enviarTexto() }}
                      placeholder={preguntaActual.kind === 'numero' ? '0' : 'Escribe aquí…'}
                      className="flex-1 bg-transparent outline-none"
                      style={{ color: T.ink, fontSize: 11, fontFamily: 'inherit' }}
                    />
                    <button
                      onClick={enviarTexto}
                      className="cursor-pointer"
                      style={{ height: 24, padding: '0 11px', borderRadius: 12, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', background: 'rgba(126,217,174,.15)', border: '1px solid rgba(126,217,174,.45)', color: T.accent }}
                    >
                      Enviar
                    </button>
                  </div>
                )}

                {preguntaActual.kind === 'mapa' && (
                  <div style={{ padding: '9px 11px' }}>
                    <p style={{ fontSize: 10.5, color: T.ink3 }}>Captúralo en la pestaña <b style={{ color: T.accent, fontWeight: 600 }}>Terreno</b> →</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </aside>
      </div>

      {/* ── Barra de pipeline — Terreno/Legal/Mercado corren en paralelo, así que se ven los 6
          agentes a la vez aquí (único lugar con el sonar grande — las tarjetas por pestaña ya
          no lo repiten) con el mismo tamaño de ~3cm (110px) que el primero, y el tiempo que
          tardó cada uno se queda visible una vez que termina, no solo mientras corre. ── */}
      <footer
        className="shrink-0 flex items-center justify-center gap-8 px-4 overflow-x-auto"
        style={{ height: 150, borderTop: `1px solid ${T.line}`, background: 'rgba(6,10,8,.9)' }}
      >
        {ETAPAS.map(e => {
          const st = pipe[e.key].status
          const t = tiempos[e.key]
          const segundos = st === 'running' && t.inicio ? Math.floor((Date.now() - t.inicio) / 1000)
            : (t.inicio != null && t.fin != null) ? Math.floor((t.fin - t.inicio) / 1000)
            : null
          return (
            <div key={e.key} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 110 }}>
              <div className="flex items-center justify-center shrink-0" style={{ width: 110, height: 110 }}>
                {st === 'running' ? (
                  <Sonar color={e.color} size={110} />
                ) : (
                  <span
                    className="inline-flex items-center justify-center rounded-full"
                    style={{ width: 40, height: 40, fontSize: 16, color: '#fff', background: st === 'done' ? e.color : st === 'error' ? T.bad : 'transparent', border: st === 'waiting' ? `1.5px solid ${T.line2}` : 'none' }}
                  >
                    {st === 'done' ? '✓' : st === 'error' ? '✕' : ''}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10.5, color: st === 'waiting' ? T.ink4 : T.ink2 }}>{e.label}</span>
              {segundos != null && (
                <span style={{ fontSize: 9.5, color: T.ink4, fontFamily: 'monospace' }}>{segundos}s</span>
              )}
            </div>
          )
        })}
      </footer>

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
