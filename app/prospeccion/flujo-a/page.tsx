'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── Constants ───────────────────────────────────────────────────────────────

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila de Zaragoza','Colima','Durango','Guanajuato','Guerrero','Hidalgo',
  'Jalisco','México','Michoacán de Ocampo','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
  'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas',
  'Tlaxcala','Veracruz de Ignacio de la Llave','Yucatán','Zacatecas',
]

const CIUDADES_POR_ESTADO: Record<string, string[]> = {
  'Aguascalientes':              ['Aguascalientes','Calvillo','Jesús María','Pabellón de Arteaga','Rincón de Romos','San Francisco de los Romo','Tepezalá'],
  'Baja California':             ['Ensenada','Mexicali','Playas de Rosarito','Tecate','Tijuana'],
  'Baja California Sur':         ['Comondú','La Paz','Loreto','Los Cabos','Mulegé'],
  'Campeche':                    ['Calkiní','Campeche','Candelaria','Carmen','Champotón','Escárcega','Hecelchakán','Hopelchén','Palizada','Tenabo'],
  'Chiapas':                     ['Berriozábal','Chiapa de Corzo','Comitán de Domínguez','Huixtla','Ocosingo','Ocozocuautla','San Cristóbal de las Casas','Tapachula','Tonalá','Tuxtla Gutiérrez','Villaflores'],
  'Chihuahua':                   ['Aldama','Camargo','Ciudad Juárez','Chihuahua','Cuauhtémoc','Delicias','Guachochi','Hidalgo del Parral','Jiménez','Meoqui','Nuevo Casas Grandes'],
  'Ciudad de México':            ['Álvaro Obregón','Azcapotzalco','Benito Juárez','Coyoacán','Cuajimalpa','Cuauhtémoc','Gustavo A. Madero','Iztacalco','Iztapalapa','Magdalena Contreras','Miguel Hidalgo','Milpa Alta','Tláhuac','Tlalpan','Venustiano Carranza','Xochimilco'],
  'Coahuila de Zaragoza':        ['Acuña','Monclova','Nava','Piedras Negras','Ramos Arizpe','Saltillo','San Pedro','Torreón'],
  'Colima':                      ['Armería','Colima','Comala','Coquimatlán','Cuauhtémoc','Ixtlahuacán','Manzanillo','Minatitlán','Tecomán','Villa de Álvarez'],
  'Durango':                     ['Canatlán','Durango','El Salto','Gómez Palacio','Lerdo','Pueblo Nuevo','Santiago Papasquiaro','Vicente Guerrero'],
  'Guanajuato':                  ['Celaya','Cortazar','Dolores Hidalgo','Guanajuato','Irapuato','Lagos de Moreno','León','Pénjamo','Salamanca','San Francisco del Rincón','San Miguel de Allende','Silao','Uriangato','Valle de Santiago'],
  'Guerrero':                    ['Acapulco','Chilpancingo','Iguala','Taxco de Alarcón','Zihuatanejo','Tlapa de Comonfort','Chilapa de Álvarez'],
  'Hidalgo':                     ['Actopan','Huejutla de Reyes','Ixmiquilpan','Mineral de la Reforma','Pachuca','Tizayuca','Tula de Allende','Tulancingo'],
  'Jalisco':                     ['Autlán de Navarro','El Salto','Guadalajara','Lagos de Moreno','Ocotlán','Puerto Vallarta','San Pedro Tlaquepaque','Tepatitlán de Morelos','Tlajomulco de Zúñiga','Tlaquepaque','Tonalá','Zapopan','Zapotlanejo'],
  'México':                      ['Atizapán de Zaragoza','Chalco','Chimalhuacán','Cuautitlán','Cuautitlán Izcalli','Ecatepec','Huixquilucan','Ixtapaluca','Metepec','Naucalpan','Nezahualcóyotl','Nicolás Romero','Tecámac','Texcoco','Tlalnepantla','Toluca','Tultitlán','Valle de Bravo','Zinacantepec'],
  'Michoacán de Ocampo':         ['Apatzingán','Hidalgo','La Piedad','Lázaro Cárdenas','Los Reyes','Morelia','Pátzcuaro','Sahuayo','Uruapan','Zamora','Zitácuaro'],
  'Morelos':                     ['Cuernavaca','Cuautla','Jiutepec','Jojutla','Temixco','Yautepec','Zacatepec'],
  'Nayarit':                     ['Bahía de Banderas','Compostela','Ixtlán del Río','Santiago Ixcuintla','Tecuala','Tepic','Tuxpan'],
  'Nuevo León':                  ['Apodaca','Cadereyta Jiménez','Escobedo','García','Guadalupe','Juárez','Linares','Montemorelos','Monterrey','Pesquería','San Nicolás de los Garza','San Pedro Garza García','Santa Catarina'],
  'Oaxaca':                      ['Huajuapan de León','Juchitán de Zaragoza','Miahuatlán de Porfirio Díaz','Oaxaca de Juárez','Puerto Escondido','Salina Cruz','San Juan Bautista Tuxtepec','Tehuantepec'],
  'Puebla':                      ['Atlixco','Cholula','Ciudad Serdán','Izúcar de Matamoros','Puebla','San Martín Texmelucan','San Pedro Cholula','Tehuacán','Teziutlán'],
  'Querétaro':                   ['Corregidora','El Marqués','Jalpan de Serra','Pedro Escobedo','Querétaro','San Juan del Río','Tequisquiapan'],
  'Quintana Roo':                ['Bacalar','Benito Juárez','Cancún','Cozumel','Felipe Carrillo Puerto','Isla Mujeres','José María Morelos','Lázaro Cárdenas','Othón P. Blanco','Playa del Carmen','Solidaridad','Tulum'],
  'San Luis Potosí':             ['Cárdenas','Ciudad Valles','Matehuala','Mexquitic de Carmona','Rioverde','San Luis Potosí','Soledad de Graciano Sánchez','Tamazunchale'],
  'Sinaloa':                     ['Ahome','Culiacán','El Fuerte','Guasave','Los Mochis','Mazatlán','Navolato','Salvador Alvarado'],
  'Sonora':                      ['Agua Prieta','Cajeme','Ciudad Obregón','Empalme','Guaymas','Hermosillo','Huatabampo','Navojoa','Nogales','Puerto Peñasco','San Luis Río Colorado'],
  'Tabasco':                     ['Cárdenas','Comalcalco','Cunduacán','Huimanguillo','Macuspana','Paraíso','Villahermosa'],
  'Tamaulipas':                  ['Altamira','Ciudad Madero','Ciudad Victoria','Matamoros','Nuevo Laredo','Reynosa','Tampico','Tula'],
  'Tlaxcala':                    ['Apizaco','Chiautempan','Huamantla','Tlaxcala','Xaltocan','Zacatelco'],
  'Veracruz de Ignacio de la Llave': ['Boca del Río','Coatzacoalcos','Córdoba','Cosoleacaque','Minatitlán','Orizaba','Papantla','Poza Rica','San Andrés Tuxtla','Tuxpan','Veracruz','Xalapa'],
  'Yucatán':                     ['Kanasín','Mérida','Progreso','Tizimín','Umán','Valladolid'],
  'Zacatecas':                   ['Calera','Fresnillo','Guadalupe','Jerez','Loreto','Río Grande','Zacatecas'],
}

function ciudadesPorEstado(estado: string): string[] {
  const key = Object.keys(CIUDADES_POR_ESTADO).find(k => k.toLowerCase() === estado.toLowerCase()) ?? ''
  return (CIUDADES_POR_ESTADO[key] ?? []).sort((a, b) => a.localeCompare(b, 'es'))
}

const TIPOS_DESARROLLO = [
  { id: 'residencial-vertical',   label: 'Residencial vertical',   sub: 'Torre o edificio de departamentos' },
  { id: 'residencial-horizontal', label: 'Residencial horizontal', sub: 'Fraccionamiento o privada' },
  { id: 'unifamiliar',            label: 'Unifamiliar',            sub: 'Una sola casa habitación' },
  { id: 'comercial',              label: 'Comercial',              sub: 'Local, plaza o strip center' },
  { id: 'mixto',                  label: 'Uso mixto',              sub: 'Comercio + vivienda' },
  { id: 'industrial',             label: 'Industrial / Nave',      sub: 'Bodega, manufactura o logística' },
  { id: 'otro',                    label: 'Otra idea…',             sub: 'Descríbela y el análisis la evaluará' },
]

const RANGOS_PRESUPUESTO = [
  { id: 'menos-5m',    label: 'Menos de $5 MDP' },
  { id: '5-15m',       label: '$5 – $15 MDP' },
  { id: '15-50m',      label: '$15 – $50 MDP' },
  { id: '50-150m',     label: '$50 – $150 MDP' },
  { id: 'mas-150m',    label: 'Más de $150 MDP' },
  { id: 'por-definir', label: 'Por definir con socios' },
]

const BANDAS = [
  { id: '1', label: 'Económica',      sub: 'Interés social / VIS',            rango: '$7k–$10.5k/m²' },
  { id: '2', label: 'Media Estándar', sub: 'Concreto armado · Acabados medios', rango: '$10.5k–$16k/m²' },
  { id: '3', label: 'Media Alta',     sub: 'Residencial · Amenidades',          rango: '$16k–$24k/m²' },
  { id: '4', label: 'Premium / Lujo', sub: 'Materiales importados · Domótica',  rango: '$24k–$45k+/m²' },
]

const USOS_SUELO = [
  { id: 'habitacional', label: 'Habitacional' },
  { id: 'comercial',    label: 'Comercial' },
  { id: 'mixto',        label: 'Mixto' },
  { id: 'industrial',   label: 'Industrial' },
  { id: 'agricola',     label: 'Agrícola' },
  { id: 'sin-uso',      label: 'Sin uso definido' },
]

const VIALIDAD_LABELS: Record<string, string> = {
  arterial: 'Arterial / Primaria', colectora: 'Colectora', secundaria: 'Secundaria',
  local: 'Local / Habitacional', privada: 'Privada / Andador',
}
const PENDIENTE_LABELS: Record<string, string> = {
  plano: 'Plano (< 5%)', suave: 'Suave (5–10%)', moderada: 'Moderada (10–20%)', pronunciada: 'Pronunciada (> 20%)',
}
const AGUA_OPTS =         [{ id: 'red-municipal', label: 'Red municipal' }, { id: 'pozo', label: 'Pozo' }, { id: 'pipa', label: 'Pipa' }, { id: 'sin-servicio', label: 'Sin servicio' }]
const DRENAJE_OPTS =      [{ id: 'red-municipal', label: 'Red municipal' }, { id: 'fosa-septica', label: 'Fosa séptica' }, { id: 'sin-servicio', label: 'Sin servicio' }]
const ELEC_OPTS =         [{ id: 'cfe-frente', label: 'CFE frente' }, { id: 'extension', label: 'Extensión requerida' }, { id: 'sin-servicio', label: 'Sin servicio' }]
const VIALIDAD_OPTS =     Object.entries(VIALIDAD_LABELS).map(([id, label]) => ({ id, label }))
const PENDIENTE_OPTS =    Object.entries(PENDIENTE_LABELS).map(([id, label]) => ({ id, label }))
const ESTADOS_TERRENO =   [
  { id: 'baldio-limpio',   label: 'Baldío limpio' },
  { id: 'baldio-escombro', label: 'Con escombro' },
  { id: 'construccion',    label: 'Construcción existente' },
  { id: 'vegetacion',      label: 'Vegetación densa' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Inferred {
  clasificacionVial?: string; pavimento?: string; esEsquina?: string
  usoSuelo?: string; agua?: string; electricidad?: string
  pendiente?: string; elevacionDelta?: number
  direccion?: string; colonia?: string; ciudad?: string; estado?: string; codigoPostal?: string
}

interface FormData {
  nombreProyecto: string
  lat: number | null; lng: number | null; mapsLink: string
  direccion: string; colonia: string; ciudad: string; estado: string; codigoPostal: string
  superficie: string; frente: string
  tiposDesarrollo: string[]
  tipoOtroTexto: string
  presupuesto: string; bandaConstruccion: string
  // Ajuste fino (inferred or overridden)
  clasificacionVial: string; pendiente: string; formaTerreno: string
  esEsquina: string; vistaDestacada: string; estadoTerreno: string
  agua: string; drenaje: string; electricidad: string; pavimento: string
  usoSuelo: string; precioSolicitado: string; cuentaPredial: string
}

const INITIAL: FormData = {
  nombreProyecto: '', lat: null, lng: null, mapsLink: '',
  direccion: '', colonia: '', ciudad: '', estado: '', codigoPostal: '',
  superficie: '', frente: '',
  tiposDesarrollo: [],
  tipoOtroTexto: '',
  presupuesto: '', bandaConstruccion: '',
  clasificacionVial: '', pendiente: '', formaTerreno: '', esEsquina: '', vistaDestacada: '',
  estadoTerreno: '', agua: '', drenaje: '', electricidad: '', pavimento: '', usoSuelo: '',
  precioSolicitado: '', cuentaPredial: '',
}

// ─── LeafletPicker ────────────────────────────────────────────────────────────

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
      html: `<div><svg viewBox="0 0 24 36" width="22" height="32"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#1D9E75"/><circle cx="12" cy="12" r="5" fill="white"/></svg></div>`,
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

  if (!ready) return <div className="w-full h-[220px] rounded-2xl bg-[#F0F4F2] flex items-center justify-center"><p className="text-[13px] text-[#9aab9f]">Cargando mapa…</p></div>
  return <div ref={ref} className="w-full h-[220px] rounded-2xl overflow-hidden border border-[#E2E8E4]" />
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Q({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-[28px] md:text-[32px] font-black text-white leading-tight tracking-tight mb-2">{title}</h2>
      {sub && <p className="text-[15px] text-white/55 leading-relaxed">{sub}</p>}
    </div>
  )
}

function Chip({ label, sub, selected, onClick }: { label: string; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all duration-150 ${
      selected ? 'border-[#1D9E75] bg-[#F0FBF6] shadow-[0_0_0_1px_#1D9E75]' : 'border-[#E2E8E4] bg-white hover:border-[#9FE1CB]'
    }`}>
      <div className="min-w-0">
        <p className={`text-[14px] font-semibold leading-tight ${selected ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{label}</p>
        {sub && <p className="text-[12px] text-[#9aab9f] mt-0.5">{sub}</p>}
      </div>
      {selected && (
        <svg className="shrink-0" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill="#1D9E75"/>
          <path d="M5 9l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

function SmallChips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(value === o.id ? '' : o.id)}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all ${
            value === o.id ? 'border-[#1D9E75] bg-[#F0FBF6] text-[#0F6E56]' : 'border-[#E2E8E4] bg-white text-[#5a7065] hover:border-[#9FE1CB]'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function InferredRow({ label, children, ai }: { label: string; children: React.ReactNode; ai?: boolean }) {
  return (
    <div className="border border-[#E2E8E4] rounded-2xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[11px] font-bold text-[#9aab9f] tracking-widest uppercase">{label}</p>
        {ai && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] tracking-wider">AUTO</span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Address history (localStorage) ──────────────────────────────────────────

const HISTORY_KEY = 'smt_addr_history'
const MAX_PER_FIELD = 8

function loadHistory(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}') } catch { return {} }
}

function saveToHistory(field: string, value: string) {
  if (!value.trim()) return
  const h = loadHistory()
  const prev = h[field] ?? []
  h[field] = [value, ...prev.filter(v => v.toLowerCase() !== value.toLowerCase())].slice(0, MAX_PER_FIELD)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
}

function useFieldHistory(field: string) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  useEffect(() => { setSuggestions(loadHistory()[field] ?? []) }, [field])
  const save = (value: string) => { saveToHistory(field, value); setSuggestions(loadHistory()[field] ?? []) }
  return { suggestions, save }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TOTAL = 6

function canAdvance(step: number, form: FormData): boolean {
  switch (step) {
    case 0: return form.nombreProyecto.trim().length >= 2
    case 1: return !!(form.lat && form.lng)
    case 2: return Number(form.superficie) > 0
    case 3: return form.tiposDesarrollo.length > 0
    case 4: return form.presupuesto !== '' && form.bandaConstruccion !== ''
    case 5: return true
    default: return true
  }
}

function FluidoAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const [dir, setDir] = useState<'fwd' | 'bck'>('fwd')
  const [form, setForm] = useState<FormData>(INITIAL)
  const set = (patch: Partial<FormData>) => setForm(f => ({ ...f, ...patch }))
  const [scoutOrigen, setScoutOrigen] = useState(false)

  // Pre-cargar datos si venimos del Scout
  useEffect(() => {
    if (searchParams.get('origen') !== 'scout') return
    const raw = localStorage.getItem('smt_scout_prefill')
    if (!raw) return
    try {
      const p = JSON.parse(raw)
      setForm(f => ({
        ...f,
        nombreProyecto: p.nombreProyecto ?? f.nombreProyecto,
        lat: p.lat ?? f.lat,
        lng: p.lng ?? f.lng,
        direccion: p.direccion ?? f.direccion,
        colonia: p.colonia ?? f.colonia,
        ciudad: p.ciudad ?? f.ciudad,
        estado: p.estado ?? f.estado,
        codigoPostal: p.codigoPostal ?? f.codigoPostal,
        superficie: p.superficie ?? f.superficie,
        frente: p.frente ?? f.frente,
        precioSolicitado: p.precioSolicitado ?? f.precioSolicitado,
      }))
      setScoutOrigen(true)
      setMEstado(p.estado ?? '')
      setMCiudad(p.ciudad ?? '')
      setMColonia(p.colonia ?? '')
      setMCP(p.codigoPostal ?? '')
      setShowManual(true)
      localStorage.removeItem('smt_scout_prefill')
    } catch { /* ignore */ }
  }, [])

  // Screen 1 — inference state
  const [mapsInput, setMapsInput]       = useState('')
  const [inferring, setInferring]       = useState(false)
  const [expanding, setExpanding]       = useState(false)
  const [inferError, setInferError]     = useState('')
  const [inferred, setInferred]         = useState<Inferred | null>(null)
  const [mapConfirmed, setMapConfirmed] = useState(false)
  const expandAbortRef = useRef<AbortController | null>(null)

  // Manual address fallback (screen 1) — progressive fields
  const [showManual, setShowManual]           = useState(false)
  const [manualGeocoding, setManualGeocoding] = useState(false)
  const [manualError, setManualError]         = useState('')
  const [mEstado,   setMEstado]   = useState('')
  const [mCiudad,   setMCiudad]   = useState('')
  const [mCP,       setMCP]       = useState('')
  const [mCpOmitido, setMCpOmitido] = useState(false)
  const [mCalle,    setMCalle]    = useState('')
  const [mColonia,  setMColonia]  = useState('')
  const canShowMap = !!(form.lat && form.lng && !mapsInput)

  const coloniaHistory = useFieldHistory('colonia')
  const calleHistory   = useFieldHistory('calle')
  const cpHistory      = useFieldHistory('cp')

  function extractCoords(url: string) {
    // @lat,lng — URLs estándar y de lugar con zoom
    let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    // q=lat,lng — búsquedas por coordenada
    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    // !3dlat!4dlng — URLs de lugar con data layer
    m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    // ll=lat,lng — formato legacy
    m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    // query=lat,lng — links de búsqueda api=1
    m = url.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    // /maps/search/lat,lng — links de "compartir ubicación" (pin soltado) de la app móvil
    m = url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    return null
  }

  function isMapsUrl(url: string) {
    return /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google\.com/.test(url)
  }

  async function handleMapsLink(url: string) {
    setMapsInput(url)
    setInferError('')

    // Cancelar cualquier expansión de link anterior en curso (evita que una
    // respuesta tardía de una URL a medio escribir pise un resultado ya exitoso)
    if (expandAbortRef.current) {
      expandAbortRef.current.abort()
      expandAbortRef.current = null
      setExpanding(false)
    }

    // Intentar extraer coords directamente (URLs largas)
    const directCoords = extractCoords(url)
    if (directCoords) {
      await resolveWithCoords(directCoords, url)
      return
    }

    // Si es una URL de Maps pero sin coords visibles, expandir en servidor
    if (isMapsUrl(url) && url.length > 20) {
      const controller = new AbortController()
      expandAbortRef.current = controller
      setExpanding(true)
      setInferred(null)
      try {
        const res = await fetch(`/api/geo/expand-maps-url?url=${encodeURIComponent(url)}`, { signal: controller.signal })
        const json = await res.json()
        if (json.lat && json.lng) {
          setExpanding(false)
          await resolveWithCoords({ lat: json.lat, lng: json.lng }, json.expandedUrl || url)
        } else {
          setInferError(json.error || 'No se pudieron extraer coordenadas. Intenta con un enlace largo de Google Maps.')
          setExpanding(false)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setInferError('No se pudo acceder al enlace. Verifica tu conexión e intenta de nuevo.')
        setExpanding(false)
      }
    }
    // Si no parece URL de Maps aún, no hacer nada (el usuario puede seguir escribiendo)
  }

  async function resolveWithCoords(coords: { lat: number; lng: number }, sourceUrl: string) {
    // Setear coordenadas de inmediato — el mapa aparece sin esperar la API
    set({ lat: coords.lat, lng: coords.lng, mapsLink: sourceUrl })
    setMapConfirmed(false)

    setInferring(true)
    setInferred(null)
    try {
      const res = await fetch(`/api/inferir-predio?lat=${coords.lat}&lng=${coords.lng}`)
      const json = await res.json()
      if (json.ok) {
        const inf: Inferred = json.inferred
        setInferred(inf)
        set({
          lat: coords.lat, lng: coords.lng, mapsLink: sourceUrl,
          direccion:    inf.direccion    || form.direccion,
          colonia:      inf.colonia      || form.colonia,
          ciudad:       inf.ciudad       || form.ciudad,
          estado:       inf.estado       || form.estado,
          codigoPostal: inf.codigoPostal || form.codigoPostal,
          clasificacionVial: inf.clasificacionVial || '',
          pendiente:    inf.pendiente    || '',
          pavimento:    inf.pavimento    || '',
          esEsquina:    inf.esEsquina    || '',
          usoSuelo:     inf.usoSuelo     || '',
          agua:         inf.agua         || '',
          electricidad: inf.electricidad || '',
        })
      }
      // Si la API falla, igual tenemos lat/lng — no bloqueamos al usuario
    } catch { /* no-op — coordenadas ya están seteadas */ }
    finally { setInferring(false) }
  }

  async function geocodeManual(refine = false) {
    if (!mCiudad && !mEstado) { setManualError('Ingresa al menos el estado y la ciudad.'); return }
    // Guardar en historial antes de geocodificar
    if (mColonia) coloniaHistory.save(mColonia)
    if (mCalle)   calleHistory.save(mCalle)
    if (mCP)      cpHistory.save(mCP)
    setManualGeocoding(true); setManualError('')
    try {
      // Use CP if available, otherwise free-text query
      let res: Response
      if (mCP.length === 5) {
        const params = new URLSearchParams({ cp: mCP, ciudad: mCiudad, estado: mEstado, ...(mCalle && { direccion: mCalle }), ...(mColonia && { colonia: mColonia }) })
        res = await fetch(`/api/geocode?${params}`)
      } else {
        const q = [mCalle, mColonia, mCiudad, mEstado, 'México'].filter(Boolean).join(', ')
        res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      }
      const json = await res.json()
      if (json.found) {
        setInferred({ ciudad: json.municipio, estado: json.estado, colonia: json.colonia })
        set({
          lat: json.lat, lng: json.lng,
          direccion: mCalle || form.direccion,
          colonia: mColonia || json.colonia,   // usuario primero, geocode como fallback
          ciudad: json.municipio || mCiudad,
          estado: json.estado || mEstado,
          codigoPostal: mCP || form.codigoPostal,
        })
        setMapConfirmed(false)
      } else {
        setManualError('No encontré esa ubicación. Intenta agregar la calle o el código postal.')
      }
    } catch {
      setManualError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setManualGeocoding(false)
    }
  }

  // Navigation
  const goTo = (target: number) => {
    setDir(target > step ? 'fwd' : 'bck')
    setVisible(false)
    setTimeout(() => { setStep(target); setVisible(true) }, 200)
  }
  const next = () => { if (step < TOTAL - 1) goTo(step + 1) }
  const back = () => { if (step > 0) goTo(step - 1) }

  const submit = () => {
    localStorage.setItem('smt_flujo_a_data', JSON.stringify(form))
    router.push(`/analisis/analizando?proyecto=${encodeURIComponent(form.nombreProyecto || 'Proyecto')}`)
  }

  // ── Screen renderers ──────────────────────────────────────────────────────

  const renderScreen = () => {
    switch (step) {

      // 0 — Nombre
      case 0: return (
        <div>
          <Q title="¿Cómo se llama este proyecto?" sub="Este nombre aparecerá en el análisis y en el reporte." />
          <input autoFocus type="text" value={form.nombreProyecto}
            onChange={e => set({ nombreProyecto: e.target.value })}
            placeholder="Ej. Torre Cumbres, Casa Pedregal, Plaza Oriente…"
            className="w-full border-2 border-[#E2E8E4] rounded-2xl px-4 py-4 text-[16px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb] transition-colors"
          />
          <p className="text-[12px] text-[#9aab9f] mt-3">Usa el nombre del terreno, zona o el concepto que tienes en mente.</p>
        </div>
      )

      // 1 — Ubicación inteligente
      case 1: return (
        <div>
          <Q title="¿Dónde está el terreno?" sub="Pega el link de Google Maps y detectamos la ubicación y características automáticamente." />

          {/* Maps link input */}
          <div className="relative mb-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C4.24 1 2 3.24 2 6c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 7 4.5a1.5 1.5 0 0 1 0 3z" fill="#1D9E75"/></svg>
              <p className="text-[12px] font-bold text-[#1D9E75] uppercase tracking-wider">Google Maps link</p>
            </div>
            <input autoFocus type="text" value={mapsInput}
              onChange={e => handleMapsLink(e.target.value)}
              placeholder="https://maps.app.goo.gl/… o https://www.google.com/maps/…"
              className={`w-full border-2 rounded-2xl px-4 py-4 text-[14px] text-[#111d17] bg-white focus:outline-none placeholder:text-[#c5d0cb] transition-colors ${inferError ? 'border-red-400' : 'border-[#E2E8E4] focus:border-[#1D9E75]'}`}
            />
            {(inferring || expanding) && (
              <div className="absolute right-4 top-[calc(50%+6px)] -translate-y-1/2">
                <svg className="animate-spin w-5 h-5 text-[#1D9E75]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </div>

          {expanding && <p className="text-[12px] text-[#1D9E75] mb-4">Leyendo enlace corto de Maps…</p>}
          {inferring && !expanding && <p className="text-[12px] text-[#1D9E75] mb-4">Detectando ubicación y características del predio…</p>}
          {!inferring && !expanding && !form.lat && !showManual && (
            <p className="text-[12px] text-[#9aab9f] mb-4">Pega el link de Maps o captura la dirección manualmente.</p>
          )}
          {inferError && <p className="text-[12px] text-red-500 mb-4">{inferError}</p>}

          {/* Confirmation card — aparece en cuanto hay coordenadas, con o sin inferencia */}
          {form.lat && form.lng && mapsInput && (
            <div className="rounded-2xl border border-[#9FE1CB] bg-[#F0FBF6] p-4 mb-4">
              {/* Datos detectados — editables inline */}
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0"><path d="M7 1C4.24 1 2 3.24 2 6c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5z" fill="#1D9E75"/></svg>
                  <p className="text-[12px] font-bold text-[#0F6E56]">
                    {[form.ciudad, form.estado].filter(Boolean).join(', ') || 'Ubicación detectada'}
                    {form.codigoPostal ? ` · CP ${form.codigoPostal}` : ''}
                  </p>
                </div>

                {/* Dirección editable */}
                <div>
                  <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-wider mb-1">Calle y número</p>
                  <input type="text" value={form.direccion}
                    onChange={e => set({ direccion: e.target.value })}
                    placeholder="Calle y número (opcional)"
                    className="w-full border border-[#9FE1CB] bg-white rounded-xl px-3 py-2 text-[13px] text-[#111d17] focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb]"
                  />
                </div>

                {/* Colonia editable — campo más propenso a errores de Nominatim */}
                <div>
                  <p className="text-[10px] font-bold text-[#9aab9f] uppercase tracking-wider mb-1">
                    Colonia <span className="font-normal normal-case tracking-normal text-[#1D9E75]">— corrige si es incorrecto</span>
                  </p>
                  <input type="text" value={form.colonia}
                    onChange={e => set({ colonia: e.target.value })}
                    placeholder="Nombre de la colonia"
                    className="w-full border border-[#9FE1CB] bg-white rounded-xl px-3 py-2 text-[13px] text-[#111d17] focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb]"
                  />
                </div>
              </div>

              {/* Mini inference tags */}
              {(form.clasificacionVial || form.pendiente || form.esEsquina === 'si' || form.usoSuelo) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {form.clasificacionVial && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white border border-[#9FE1CB] text-[#0F6E56]">
                      {VIALIDAD_LABELS[form.clasificacionVial] ?? form.clasificacionVial}
                    </span>
                  )}
                  {form.pendiente && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white border border-[#9FE1CB] text-[#0F6E56]">
                      {PENDIENTE_LABELS[form.pendiente] ?? form.pendiente}
                    </span>
                  )}
                  {form.esEsquina === 'si' && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white border border-[#9FE1CB] text-[#0F6E56]">Esquina</span>
                  )}
                  {form.usoSuelo && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white border border-[#9FE1CB] text-[#0F6E56]">
                      {form.usoSuelo.charAt(0).toUpperCase() + form.usoSuelo.slice(1)}
                    </span>
                  )}
                </div>
              )}

              {/* Map */}
              <LeafletPicker lat={form.lat!} lng={form.lng!}
                onMove={(lat, lng) => set({ lat, lng })} />
              <p className="text-[10px] text-[#9aab9f] font-mono mt-2">{form.lat!.toFixed(5)}, {form.lng!.toFixed(5)}</p>
            </div>
          )}

          {/* Manual fallback toggle */}
          <button onClick={() => setShowManual(v => !v)}
            className="text-[12px] text-[#9aab9f] hover:text-[#5a7065] underline underline-offset-2 transition-colors">
            {showManual ? 'Ocultar captura manual' : '¿No tienes link? Ingresa la dirección'}
          </button>

          {showManual && (
            <div className="mt-5 flex flex-col gap-4">

              {scoutOrigen && (
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#F0FBF6] border border-[#9FE1CB]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5"><path d="M7 1C4.24 1 2 3.24 2 6c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5z" fill="#1D9E75"/></svg>
                  <div>
                    <p className="text-[12px] font-semibold text-[#0F6E56]">Ubicación cargada desde Scout</p>
                    <p className="text-[11px] text-[#5a7065] mt-0.5">Los campos en verde están pre-llenados. Confirma en el mapa para continuar.</p>
                  </div>
                </div>
              )}

              {/* 1 — Estado */}
              <div>
                <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wider mb-1.5">
                  Estado{scoutOrigen && mEstado && <span className="ml-1.5 text-[#1D9E75] normal-case font-normal tracking-normal text-[10px]">● Scout</span>}
                </p>
                <input type="text" list="estados-list" value={mEstado}
                  onChange={e => { setMEstado(e.target.value); setMCiudad('') }} autoFocus={!scoutOrigen}
                  placeholder="Selecciona o escribe un estado…"
                  className={`w-full border-2 rounded-xl px-4 py-3 text-[14px] text-[#111d17] focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb] transition-colors ${scoutOrigen && mEstado ? 'border-[#1D9E75] bg-[#F0FBF6]' : 'border-[#E2E8E4] bg-white'}`}
                />
                <datalist id="estados-list">{ESTADOS_MX.map(e => <option key={e} value={e} />)}</datalist>
              </div>

              {/* 2 — Ciudad filtrada por estado */}
              {mEstado.length > 2 && (
                <div>
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wider mb-1.5">
                    Ciudad o municipio{scoutOrigen && mCiudad && <span className="ml-1.5 text-[#1D9E75] normal-case font-normal tracking-normal text-[10px]">● Scout</span>}
                  </p>
                  <input type="text" list="ciudades-estado-list" value={mCiudad}
                    onChange={e => setMCiudad(e.target.value)}
                    placeholder="Escribe o selecciona…"
                    className={`w-full border-2 rounded-xl px-4 py-3 text-[14px] text-[#111d17] focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb] transition-colors ${scoutOrigen && mCiudad ? 'border-[#1D9E75] bg-[#F0FBF6]' : 'border-[#E2E8E4] bg-white'}`}
                  />
                  <datalist id="ciudades-estado-list">
                    {ciudadesPorEstado(mEstado).map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              )}

              {/* 3 — Colonia */}
              {mCiudad.length > 2 && (
                <div>
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wider mb-1.5">
                    Colonia{scoutOrigen && mColonia && <span className="ml-1.5 text-[#1D9E75] normal-case font-normal tracking-normal text-[10px]">● Scout</span>}
                  </p>
                  <input type="text" list="colonia-hist" value={mColonia}
                    onChange={e => setMColonia(e.target.value)}
                    placeholder="Nombre de la colonia"
                    className={`w-full border-2 rounded-xl px-4 py-3 text-[14px] text-[#111d17] focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb] transition-colors ${scoutOrigen && mColonia ? 'border-[#1D9E75] bg-[#F0FBF6]' : 'border-[#E2E8E4] bg-white'}`}
                  />
                  <datalist id="colonia-hist">{coloniaHistory.suggestions.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              )}

              {/* 4 — Calle y número */}
              {mCiudad.length > 2 && (
                <div>
                  <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wider mb-1.5">Calle y número <span className="font-normal normal-case tracking-normal">(opcional)</span></p>
                  <input type="text" list="calle-hist" value={mCalle}
                    onChange={e => setMCalle(e.target.value)}
                    placeholder="Av. Insurgentes 250"
                    className="w-full border-2 border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb] transition-colors"
                  />
                  <datalist id="calle-hist">{calleHistory.suggestions.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              )}

              {/* 5 — CP */}
              {mCiudad.length > 2 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-[#9aab9f] uppercase tracking-wider">Código postal <span className="font-normal normal-case tracking-normal">(opcional)</span>{scoutOrigen && mCP && <span className="ml-1.5 text-[#1D9E75] normal-case font-normal tracking-normal text-[10px]">● Scout</span>}</p>
                    {!mCpOmitido && mCP === '' && (
                      <button onClick={() => setMCpOmitido(true)}
                        className="text-[11px] text-[#9aab9f] hover:text-[#5a7065] underline underline-offset-2">
                        No lo sé
                      </button>
                    )}
                  </div>
                  {!mCpOmitido && (
                    <input type="text" inputMode="numeric" maxLength={5} list="cp-hist" value={mCP}
                      onChange={e => { setMCP(e.target.value.replace(/\D/g, '').slice(0, 5)); setMCpOmitido(false) }}
                      onKeyDown={e => { if (e.key === 'Enter') geocodeManual() }}
                      placeholder="5 dígitos"
                      className={`w-full border-2 rounded-xl px-4 py-3 text-[16px] tracking-[0.3em] font-mono text-[#111d17] focus:outline-none focus:border-[#1D9E75] placeholder:tracking-normal placeholder:font-sans placeholder:text-[14px] placeholder:text-[#c5d0cb] transition-colors ${scoutOrigen && mCP ? 'border-[#1D9E75] bg-[#F0FBF6]' : 'border-[#E2E8E4] bg-white'}`}
                    />
                  )}
                  <datalist id="cp-hist">{cpHistory.suggestions.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              )}

              {/* 6 — Botón Ver en mapa */}
              {mCiudad.length > 2 && !canShowMap && (
                <div>
                  {manualError && <p className="text-[12px] text-red-500 mb-2">{manualError}</p>}
                  <button onClick={() => geocodeManual()} disabled={manualGeocoding}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold bg-[#1D9E75] text-white hover:bg-[#0F6E56] disabled:opacity-60 transition-colors">
                    {manualGeocoding
                      ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Buscando…</>
                      : <>Ver en mapa <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C4.24 1 2 3.24 2 6c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5z" fill="white"/></svg></>
                    }
                  </button>
                </div>
              )}

              {/* 7 — Mapa */}
              {canShowMap && (
                <div className="rounded-2xl border border-[#9FE1CB] bg-[#F0FBF6] p-4">
                  <p className="text-[13px] font-bold text-[#0F6E56] mb-0.5">
                    {[mColonia || form.colonia, mCiudad, mEstado].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-[12px] text-[#5a7065] mb-3">Arrastra el pin al terreno exacto</p>
                  <LeafletPicker lat={form.lat!} lng={form.lng!}
                    onMove={(lat, lng) => set({ lat, lng })} />
                  <p className="text-[10px] text-[#9aab9f] font-mono mt-2">{form.lat!.toFixed(5)}, {form.lng!.toFixed(5)}</p>
                  <button onClick={() => geocodeManual(true)} disabled={manualGeocoding}
                    className="mt-2 text-[12px] font-semibold text-[#1D9E75] hover:text-[#0F6E56] underline underline-offset-2 disabled:opacity-50 transition-colors">
                    {manualGeocoding ? 'Afinando…' : 'Afinar con dirección →'}
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      )

      // 2 — Superficie
      case 2: return (
        <div>
          <Q title="¿Cuántos m² tiene el terreno?" sub="Superficie total del predio (sin contar construcción existente)." />
          <div className="relative">
            <input autoFocus type="number" value={form.superficie}
              onChange={e => set({ superficie: e.target.value })}
              placeholder="0"
              className="w-full border-2 border-[#E2E8E4] rounded-2xl px-4 py-4 text-[20px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb] transition-colors pr-14"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#9aab9f] font-medium pointer-events-none">m²</span>
          </div>

          {Number(form.superficie) > 0 && (
            <div className="mt-5">
              <p className="text-[12px] font-bold text-[#9aab9f] uppercase tracking-wider mb-2">Frente del predio (opcional)</p>
              <div className="relative">
                <input type="number" value={form.frente} onChange={e => set({ frente: e.target.value })}
                  placeholder="0"
                  className="w-full border-2 border-[#E2E8E4] rounded-2xl px-4 py-3.5 text-[16px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb] transition-colors pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[#9aab9f] font-medium pointer-events-none">m</span>
              </div>
            </div>
          )}
        </div>
      )

      // 3 — Tipo de desarrollo
      case 3: return (
        <div>
          <Q title="¿Qué tipo de desarrollo tienes en mente?" sub="Puedes elegir más de uno. El análisis evaluará cada opción." />
          <div className="flex flex-col gap-3">
            {TIPOS_DESARROLLO.map(t => (
              <Chip key={t.id} label={t.label} sub={t.sub}
                selected={form.tiposDesarrollo.includes(t.id)}
                onClick={() => set({
                  tiposDesarrollo: form.tiposDesarrollo.includes(t.id)
                    ? form.tiposDesarrollo.filter(x => x !== t.id)
                    : [...form.tiposDesarrollo, t.id],
                })}
              />
            ))}
            {form.tiposDesarrollo.includes('otro') && (
              <textarea
                autoFocus
                value={form.tipoOtroTexto}
                onChange={e => set({ tipoOtroTexto: e.target.value })}
                placeholder="Describe tu idea: tipo de inmueble, concepto, perfil de usuario, lo que tengas en mente…"
                rows={3}
                className="w-full border-2 border-[#1D9E75] bg-[#F0FBF6] rounded-2xl px-4 py-3.5 text-[14px] text-[#111d17] focus:outline-none placeholder:text-[#9aab9f] resize-none transition-colors"
              />
            )}
          </div>
        </div>
      )

      // 4 — Presupuesto + Banda
      case 4: return (
        <div>
          <Q title="Presupuesto y nivel de acabados" sub="Dos preguntas rápidas para calibrar el modelo financiero." />

          <p className="text-[13px] font-bold text-[#111d17] mb-3">¿Cuánto presupuesto tienes para invertir?</p>
          <div className="grid grid-cols-2 gap-2.5 mb-7">
            {RANGOS_PRESUPUESTO.map(r => (
              <Chip key={r.id} label={r.label} selected={form.presupuesto === r.id} onClick={() => set({ presupuesto: r.id })} />
            ))}
          </div>

          <p className="text-[13px] font-bold text-[#111d17] mb-3">¿Qué nivel de acabados buscas?</p>
          <div className="flex flex-col gap-2.5">
            {BANDAS.map(b => (
              <button key={b.id} onClick={() => set({ bandaConstruccion: b.id })}
                className={`w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${
                  form.bandaConstruccion === b.id ? 'border-[#1D9E75] bg-[#F0FBF6]' : 'border-[#E2E8E4] bg-white hover:border-[#9FE1CB]'
                }`}>
                <div>
                  <p className={`text-[14px] font-bold ${form.bandaConstruccion === b.id ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{b.label}</p>
                  <p className="text-[11px] text-[#9aab9f] mt-0.5">{b.sub}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${
                  form.bandaConstruccion === b.id ? 'bg-[#1D9E75] text-white' : 'bg-[#F0F4F2] text-[#5a7065]'
                }`}>{b.rango}</span>
              </button>
            ))}
          </div>
        </div>
      )

      // 5 — Ajuste fino
      case 5: return (
        <div>
          <Q title="Revisa y ajusta los detalles" sub="Detectamos estos datos automáticamente. Puedes corregirlos si algo no es exacto." />

          <div className="flex flex-col gap-3">

            <InferredRow label="Vialidad" ai>
              <SmallChips options={VIALIDAD_OPTS} value={form.clasificacionVial} onChange={v => set({ clasificacionVial: v })} />
            </InferredRow>

            <InferredRow label="Pendiente del terreno" ai>
              <SmallChips options={PENDIENTE_OPTS} value={form.pendiente} onChange={v => set({ pendiente: v })} />
            </InferredRow>

            <InferredRow label="Uso de suelo" ai>
              <SmallChips options={USOS_SUELO} value={form.usoSuelo} onChange={v => set({ usoSuelo: v })} />
            </InferredRow>

            <InferredRow label="Estado del predio">
              <SmallChips options={ESTADOS_TERRENO} value={form.estadoTerreno} onChange={v => set({ estadoTerreno: v })} />
            </InferredRow>

            <InferredRow label="Esquina" ai>
              <SmallChips options={[{ id: 'si', label: 'Sí es esquina (+8%)' }, { id: 'no', label: 'No es esquina' }]} value={form.esEsquina} onChange={v => set({ esEsquina: v })} />
            </InferredRow>

            <InferredRow label="Servicios">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[10px] text-[#9aab9f] font-semibold mb-1.5">Agua</p>
                  <SmallChips options={AGUA_OPTS} value={form.agua} onChange={v => set({ agua: v })} />
                </div>
                <div>
                  <p className="text-[10px] text-[#9aab9f] font-semibold mb-1.5">Drenaje</p>
                  <SmallChips options={DRENAJE_OPTS} value={form.drenaje} onChange={v => set({ drenaje: v })} />
                </div>
                <div>
                  <p className="text-[10px] text-[#9aab9f] font-semibold mb-1.5">Electricidad</p>
                  <SmallChips options={ELEC_OPTS} value={form.electricidad} onChange={v => set({ electricidad: v })} />
                </div>
                <div>
                  <p className="text-[10px] text-[#9aab9f] font-semibold mb-1.5">Pavimento frente al predio</p>
                  <SmallChips options={[{ id: 'si', label: 'Sí' }, { id: 'no', label: 'No' }]} value={form.pavimento} onChange={v => set({ pavimento: v })} />
                </div>
              </div>
            </InferredRow>

            <div className="bg-[#F0FBF6] border-2 border-[#1D9E75]/40 rounded-2xl p-4">
              <p className="text-[13px] font-bold text-[#0F6E56] mb-1">¿Tienes un valor estimado o real del terreno?</p>
              <p className="text-[11px] text-[#5a7065] mb-3 leading-snug">
                Si conoces el precio que pide el vendedor (o una estimación tuya), la IA lo usa para validar su cálculo — no lo fuerza como resultado final.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5a7065]">$</span>
                <input type="number" value={form.precioSolicitado} onChange={e => set({ precioSolicitado: e.target.value })}
                  placeholder="0"
                  className="w-full border-2 border-[#1D9E75]/30 rounded-xl pl-6 pr-14 py-2.5 text-[14px] font-semibold text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#5a7065] font-medium">MXN</span>
              </div>
            </div>

            <InferredRow label="Datos opcionales">
              <div>
                <p className="text-[10px] text-[#9aab9f] font-semibold mb-1.5">Cuenta predial</p>
                <input type="text" value={form.cuentaPredial} onChange={e => set({ cuentaPredial: e.target.value })}
                  placeholder="019-012-045-001-000"
                  className="w-full border border-[#E2E8E4] rounded-xl px-3 py-2.5 text-[13px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] placeholder:text-[#c5d0cb]"
                />
              </div>
            </InferredRow>

          </div>
        </div>
      )

      default: return null
    }
  }

  const pct = ((step + 1) / TOTAL) * 100
  const isLast = step === TOTAL - 1

  return (
    <div className="min-h-screen bg-[#0C0F0E] flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0D2137] px-5 py-4">
        <div className="max-w-[680px] mx-auto flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={step > 0 ? back : () => router.push('/prospeccion')}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#1D9E75] flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                  <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-white hidden sm:block">SMT Developer</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div className="h-full bg-[#1D9E75] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[11px] text-white/40 leading-none mb-0.5">Flujo A</p>
            <p className="text-[13px] font-bold text-white leading-none tabular-nums">
              {step + 1}<span className="text-white/40 font-normal"> / {TOTAL}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-[600px]"
          style={{
            transition: 'opacity 200ms ease, transform 200ms ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : dir === 'fwd' ? 'translateX(-28px)' : 'translateX(28px)',
          }}>
          {renderScreen()}
        </div>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 bg-[#0A0C0B] border-t border-white/10 px-5 py-4">
        <div className="max-w-[600px] mx-auto flex items-center justify-between gap-3">
          {/* Skip on last step */}
          {isLast ? (
            <button onClick={next} className="text-[13px] text-[#9aab9f] hover:text-[#5a7065] transition-colors px-2 py-2">
              Omitir ajuste →
            </button>
          ) : <div />}

          {isLast ? (
            <button onClick={submit}
              className="flex items-center gap-2 bg-[#1D9E75] hover:bg-[#0F6E56] text-white px-7 py-3 rounded-xl text-[14px] font-bold transition-colors">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
              </svg>
              Iniciar análisis
            </button>
          ) : (
            <button onClick={next} disabled={!canAdvance(step, form)}
              className={`flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-bold transition-all ${
                canAdvance(step, form)
                  ? 'bg-[#1D9E75] hover:bg-[#0F6E56] text-white'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}>
              Continuar
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

export default function FluidoAPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0C0F0E]" />}>
      <FluidoAContent />
    </Suspense>
  )
}
