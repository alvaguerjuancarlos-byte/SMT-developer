'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const CIUDADES = [...new Set([
  'Acapulco', 'Acuña', 'Agua Prieta', 'Aguascalientes', 'Ahome', 'Allende',
  'Altamira', 'Apatzingán', 'Apodaca', 'Atlacomulco',
  'Bacalar', 'Bahía de Banderas',
  'Cadereyta Jiménez', 'Campeche', 'Cancún', 'Cárdenas', 'Celaya', 'Chetumal',
  'Chihuahua', 'Chilpancingo', 'Chimalhuacán', 'Cholula', 'Ciudad del Carmen',
  'Ciudad Juárez', 'Ciudad Obregón', 'Ciudad Valles', 'Ciudad Victoria',
  'Coatzacoalcos', 'Coacalco', 'Colima', 'Córdoba', 'Corregidora', 'Cozumel',
  'Cuauhtémoc', 'Cuautitlán Izcalli', 'Cuautla', 'Cuernavaca', 'Culiacán',
  'Delicias', 'Durango',
  'Ecatepec', 'El Marqués', 'Ensenada', 'Escobedo',
  'Fresnillo',
  'García', 'Gómez Palacio', 'Guadalajara', 'Guadalupe', 'Guanajuato',
  'Guasave', 'Guaymas',
  'Hermosillo', 'Hidalgo del Parral', 'Huatulco',
  'Irapuato',
  'Jiutepec', 'Juárez',
  'La Paz', 'Lázaro Cárdenas', 'León', 'Linares', 'Loreto', 'Los Cabos', 'Los Mochis',
  'Manzanillo', 'Matamoros', 'Mazatlán', 'Mérida', 'Metepec', 'Mexicali',
  'Monclova', 'Montemorelos', 'Monterrey', 'Morelia',
  'Naucalpan', 'Navojoa', 'Nezahualcóyotl', 'Nogales', 'Nuevo Laredo',
  'Oaxaca de Juárez', 'Orizaba',
  'Pachuca', 'Piedras Negras', 'Playa del Carmen', 'Poza Rica', 'Progreso',
  'Puebla', 'Puerto Escondido', 'Puerto Peñasco', 'Puerto Vallarta',
  'Querétaro',
  'Reynosa', 'Rioverde', 'Rosarito',
  'Salamanca', 'Saltillo', 'San Cristóbal de las Casas', 'San Juan del Río',
  'San Luis Potosí', 'San Luis Río Colorado', 'San Miguel de Allende',
  'San Nicolás de los Garza', 'San Pedro Garza García', 'Santa Catarina',
  'Silao',
  'Tampico', 'Tapachula', 'Tehuacán', 'Temixco', 'Tepic', 'Texcoco', 'Tijuana',
  'Tizayuca', 'Tlajomulco de Zúñiga', 'Tlalnepantla', 'Tlaquepaque', 'Tlaxcala',
  'Toluca', 'Tonalá', 'Torreón', 'Tultitlán', 'Tulancingo', 'Tulum',
  'Tuxtla Gutiérrez',
  'Uruapan',
  'Valladolid', 'Veracruz', 'Villahermosa',
  'Xalapa',
  'Zacatecas', 'Zamora', 'Zapopan', 'Zihuatanejo', 'Zinacantepec',
  'Ciudad de México', 'Atizapán de Zaragoza', 'Chalco', 'Cuautitlán',
  'Ixtapaluca', 'Nicolás Romero', 'Tecámac',
])].sort((a, b) => a.localeCompare(b, 'es'))

const USOS_SUELO = [
  { id: 'habitacional', label: 'Habitacional' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'mixto', label: 'Mixto' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'agricola', label: 'Agrícola' },
  { id: 'sin-uso', label: 'Sin uso definido' },
]

const ESTADOS_TERRENO = [
  { id: 'baldio-limpio', label: 'Baldío limpio' },
  { id: 'baldio-escombro', label: 'Baldío con escombro' },
  { id: 'construccion', label: 'Construcción existente' },
  { id: 'vegetacion', label: 'Vegetación densa' },
]

const RANGOS_PRESUPUESTO = [
  { id: 'menos-5m', label: 'Menos de $5 MDP' },
  { id: '5-15m', label: '$5 – $15 MDP' },
  { id: '15-50m', label: '$15 – $50 MDP' },
  { id: '50-150m', label: '$50 – $150 MDP' },
  { id: 'mas-150m', label: 'Más de $150 MDP' },
  { id: 'por-definir', label: 'Por definir con socios' },
]

const BANDAS_CONSTRUCCION = [
  {
    id: '1',
    label: 'Económica',
    sub: 'Interés social · Acabados básicos',
    desc: 'Estructura de block/tabique, acabados estándar, sin amenidades. INFONAVIT / VIS.',
    rango: '$7,000–$10,500/m²',
    icon: '🧱',
  },
  {
    id: '2',
    label: 'Media Estándar',
    sub: 'Clase media · Acabados funcionales',
    desc: 'Concreto armado, porcelanato básico, elevador en torre, estacionamiento techado.',
    rango: '$10,500–$16,000/m²',
    icon: '🏗️',
  },
  {
    id: '3',
    label: 'Media Alta',
    sub: 'Residencial · Acabados premium',
    desc: 'Fachada diferenciada, cocinas equipadas, A/C, amenidades (gym, roof garden, alberca).',
    rango: '$16,000–$24,000/m²',
    icon: '🏢',
  },
  {
    id: '4',
    label: 'Premium / Lujo',
    sub: 'Alto standing · Acabados de lujo',
    desc: 'Materiales importados, domótica, concierge, spa, arquitectura de firma.',
    rango: '$24,000–$45,000+/m²',
    icon: '✨',
  },
]

const CLASIFICACION_VIAL = [
  { id: 'arterial',   label: 'Arterial / Primaria',    sub: 'Avenida principal, boulevard o acceso a ciudad', factor: '+20% a +28%' },
  { id: 'colectora',  label: 'Colectora',               sub: 'Conecta arteriales con calles locales',          factor: '+10% a +15%' },
  { id: 'secundaria', label: 'Secundaria',              sub: 'Calle secundaria con servicios consolidados',     factor: '+5% a +8%'   },
  { id: 'local',      label: 'Local / Habitacional',   sub: 'Calle interior de colonia (valor base)',          factor: 'Base'         },
  { id: 'privada',    label: 'Privada / Andador',       sub: 'Acceso cerrado, sin salida o privada',           factor: '-5% a -10%'  },
]

const PENDIENTE_OPTIONS = [
  { id: 'plano', label: 'Plano (< 5%)' },
  { id: 'suave', label: 'Suave (5–10%)' },
  { id: 'moderada', label: 'Moderada (10–20%)' },
  { id: 'pronunciada', label: 'Pronunciada (> 20%)' },
]

const FORMA_TERRENO = [
  { id: 'regular', label: 'Regular' },
  { id: 'irregular', label: 'Irregular' },
]

const VISTA_DESTACADA = [
  { id: 'ninguna', label: 'Sin vista especial' },
  { id: 'sierra', label: 'Sierra / montaña' },
  { id: 'valle', label: 'Valle' },
  { id: 'lago', label: 'Lago / presa' },
  { id: 'canon', label: 'Cañón' },
]

const SERVICIOS_AGUA = [
  { id: 'red-municipal', label: 'Red municipal' },
  { id: 'pozo', label: 'Pozo' },
  { id: 'pipa', label: 'Pipa' },
  { id: 'sin-servicio', label: 'Sin servicio' },
]

const SERVICIOS_DRENAJE = [
  { id: 'red-municipal', label: 'Red municipal' },
  { id: 'fosa-septica', label: 'Fosa séptica' },
  { id: 'sin-servicio', label: 'Sin servicio' },
]

const SERVICIOS_ELECTRICIDAD = [
  { id: 'cfe-frente', label: 'CFE frente al predio' },
  { id: 'extension', label: 'Extensión requerida' },
  { id: 'sin-servicio', label: 'Sin servicio' },
]

const DISTANCIA_ABASTO = [
  { id: 'menos-20', label: 'Menos de 20 km' },
  { id: '20-40', label: '20–40 km' },
  { id: 'mas-40', label: 'Más de 40 km' },
]

const TIPOS_DESARROLLO = [
  { id: 'residencial-vertical', label: 'Residencial vertical', icon: '🏢' },
  { id: 'residencial-horizontal', label: 'Residencial horizontal', icon: '🏘️' },
  { id: 'unifamiliar', label: 'Unifamiliar', icon: '🏠' },
  { id: 'comercial', label: 'Comercial', icon: '🏪' },
  { id: 'mixto', label: 'Uso mixto', icon: '🏗️' },
  { id: 'industrial', label: 'Industrial / Nave', icon: '🏭' },
  { id: 'no-definido', label: 'Aún no lo sé', icon: '💡' },
]

const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila de Zaragoza', 'Colima',
  'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'México',
  'Michoacán de Ocampo', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz de Ignacio de la Llave',
  'Yucatán', 'Zacatecas',
]

interface ZonaGeo {
  lat: number
  lng: number
  nombre: string
  municipio: string
  estado?: string
}

interface FormData {
  nombreProyecto: string
  estado: string
  ciudad: string
  colonia: string
  direccion: string
  codigoPostal: string
  zonaGeo: ZonaGeo | null
  zonaConfirmada: boolean
  lat: number | null
  lng: number | null
  superficie: string
  usoSuelo: string
  estadoTerreno: string
  presupuesto: string
  tiposDesarrollo: string[]
  tipoOtroTexto: string
  bandaConstruccion: string
  mapsLink: string
  frente: string
  clasificacionVial: string
  pendiente: string
  formaTerreno: string
  vistaDestacada: string
  esEsquina: string
  agua: string
  drenaje: string
  electricidad: string
  pavimento: string
  distanciaAbasto: string
  precioSolicitado: string
}

const INITIAL: FormData = {
  nombreProyecto: '',
  estado: '',
  ciudad: '',
  colonia: '',
  direccion: '',
  codigoPostal: '',
  zonaGeo: null,
  zonaConfirmada: false,
  lat: null,
  lng: null,
  superficie: '',
  usoSuelo: '',
  estadoTerreno: '',
  presupuesto: '',
  tiposDesarrollo: [],
  tipoOtroTexto: '',
  bandaConstruccion: '',
  mapsLink: '',
  frente: '',
  clasificacionVial: '',
  pendiente: '',
  formaTerreno: '',
  vistaDestacada: '',
  esEsquina: '',
  agua: '',
  drenaje: '',
  electricidad: '',
  pavimento: '',
  distanciaAbasto: '',
  precioSolicitado: '',
}

const TOTAL_STEPS = 5


function LeafletPicker({
  lat, lng, onMove,
}: {
  lat: number; lng: number; onMove: (lat: number, lng: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
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
    if (!ready || !containerRef.current || mapRef.current) return
    const L = (window as any).L
    const map = L.map(containerRef.current).setView([lat, lng], 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map)
    const icon = L.divIcon({
      html: `<div style="width:22px;height:32px;display:flex;align-items:center;justify-content:center">
               <svg viewBox="0 0 24 36" width="22" height="32" xmlns="http://www.w3.org/2000/svg">
                 <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#1D9E75"/>
                 <circle cx="12" cy="12" r="5" fill="white"/>
               </svg>
             </div>`,
      className: '', iconAnchor: [11, 32], popupAnchor: [0, -34],
    })
    const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)
    marker.on('dragend', () => {
      const p = marker.getLatLng()
      onMove(p.lat, p.lng)
    })
    map.on('click', (e: any) => {
      marker.setLatLng(e.latlng)
      onMove(e.latlng.lat, e.latlng.lng)
    })
    mapRef.current = map
    markerRef.current = marker
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [ready])

  useEffect(() => {
    if (!markerRef.current) return
    markerRef.current.setLatLng([lat, lng])
    mapRef.current?.setView([lat, lng], 17)
  }, [lat, lng])

  if (!ready) {
    return (
      <div className="w-full rounded-xl border border-[#E2E8E4] bg-[#F7F8F6] flex items-center justify-center" style={{ height: 280 }}>
        <p className="text-[13px] text-[#9aab9f]">Cargando mapa…</p>
      </div>
    )
  }
  return <div ref={containerRef} className="w-full rounded-2xl overflow-hidden border border-[#E2E8E4]" style={{ height: 280 }} />
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full flex-1 transition-all duration-300 ${i < step ? 'bg-[#1D9E75]' : 'bg-[#E2E8E4]'}`}
          />
        ))}
      </div>
      <p className="text-[11px] text-[#9aab9f] tracking-wide">Paso {step} de {TOTAL_STEPS}</p>
    </div>
  )
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-[12px] text-[#5a7065] mb-2">
      {children}
      {optional && <span className="text-[#9aab9f] ml-1">(opcional)</span>}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb]"
    />
  )
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 appearance-none cursor-pointer"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

function ChipOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-4 py-3 transition-all duration-150 w-full ${
        selected
          ? 'bg-white border-[#1D9E75] shadow-[0_0_0_2px_#1D9E75]'
          : 'bg-white border-[#E2E8E4] hover:border-[#9FE1CB]'
      }`}
    >
      {children}
    </button>
  )
}

function Step1({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Nombre del proyecto</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">
        Este nombre identificará el proyecto a lo largo del análisis y aparecerá en el reporte final.
      </p>
      <div>
        <FieldLabel>Nombre del proyecto</FieldLabel>
        <TextInput
          value={data.nombreProyecto}
          onChange={v => setData({ ...data, nombreProyecto: v })}
          placeholder="Ej. Torre Cumbres 2026, Plaza San Pedro, Residencial Montaña"
        />
        <p className="text-[11px] text-[#9aab9f] mt-2">
          Puedes usar el nombre del terreno, la zona o el concepto de desarrollo que tienes en mente.
        </p>
      </div>
    </div>
  )
}

function Step2({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1)
  const [cpInput, setCpInput] = useState(data.codigoPostal)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [markerLat, setMarkerLat] = useState(data.lat ?? 0)
  const [markerLng, setMarkerLng] = useState(data.lng ?? 0)
  const [refineQuery, setRefineQuery] = useState('')
  const [refineSuggestions, setRefineSuggestions] = useState<{ lat: number; lng: number; label: string }[]>([])
  const [refineSearching, setRefineSearching] = useState(false)
  const [fromMapsLink, setFromMapsLink] = useState(false)

  function extractCoordsFromMapsLink(url: string): { lat: number; lng: number } | null {
    // @lat,lng,zoom — most Google Maps share URLs
    let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    // ?q=lat,lng
    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    // ll=lat,lng
    m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    return null
  }

  const geocodeCP = async (cp: string) => {
    setVerifying(true)
    setVerifyError('')
    try {
      // Si el usuario pegó un link de Google Maps, extraemos coords exactas directamente
      if (data.mapsLink) {
        const coords = extractCoordsFromMapsLink(data.mapsLink)
        if (coords) {
          setMarkerLat(coords.lat)
          setMarkerLng(coords.lng)
          setFromMapsLink(true)
          setData({
            ...data,
            codigoPostal: cp,
            zonaGeo: { lat: coords.lat, lng: coords.lng, nombre: data.colonia || data.ciudad, municipio: data.ciudad, estado: data.estado },
            zonaConfirmada: false,
            lat: coords.lat,
            lng: coords.lng,
          })
          setSubStep(3)
          return
        }
      }

      const params = new URLSearchParams({
        cp,
        ciudad: data.ciudad,
        estado: data.estado,
        ...(data.direccion && { direccion: data.direccion }),
        ...(data.colonia && { colonia: data.colonia }),
      })
      const res = await fetch(`/api/geocode?${params}`)
      const json = await res.json()
      if (!json.found) {
        setVerifyError('No se encontró ese código postal en México. Verifica e intenta de nuevo.')
        return
      }
      setFromMapsLink(false)
      const zonaGeo: ZonaGeo = {
        lat: json.lat,
        lng: json.lng,
        nombre: json.colonia || data.colonia || json.municipio,
        municipio: json.municipio || data.ciudad,
        estado: json.estado,
      }
      setMarkerLat(json.lat)
      setMarkerLng(json.lng)
      setData({
        ...data,
        codigoPostal: cp,
        zonaGeo,
        zonaConfirmada: false,
        lat: json.lat,
        lng: json.lng,
        ciudad: data.ciudad || json.municipio,
        estado: data.estado || json.estado,
      })
      setSubStep(3)
    } catch {
      setVerifyError('Error de conexión. Verifica tu red e intenta de nuevo.')
    } finally {
      setVerifying(false)
    }
  }

  const searchRefine = async (q: string) => {
    if (!q.trim()) return
    setRefineSearching(true)
    try {
      const query = [q, data.ciudad, data.estado, 'México'].filter(Boolean).join(', ')
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=es&limit=5`)
      const json = await res.json()
      const feats: any[] = json.features ?? []
      setRefineSuggestions(feats.map(f => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        label: [f.properties.name, f.properties.street, f.properties.housenumber, f.properties.city, f.properties.state]
          .filter(Boolean).join(', '),
      })))
    } catch { /* ignore */ } finally {
      setRefineSearching(false)
    }
  }

  const handleCPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5)
    setCpInput(val)
    setVerifyError('')
    if (val.length === 5) geocodeCP(val)
  }

  /* ── SUB-PASO 1: datos de ubicación ── */
  if (subStep === 1) {
    const canContinue = data.estado.trim() !== '' && data.ciudad.trim() !== '' && data.direccion.trim() !== ''
    return (
      <div>
        <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
        <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Ubicación del terreno</h2>
        <p className="text-[14px] text-[#5a7065] mb-6">Ingresa el estado, ciudad, colonia y dirección del predio.</p>

        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Estado</FieldLabel>
            <input
              type="text"
              list="estados-list-a"
              value={data.estado}
              onChange={e => setData({ ...data, estado: e.target.value })}
              placeholder="Selecciona un estado…"
              className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb]"
            />
            <datalist id="estados-list-a">
              {ESTADOS_MX.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>

          <div>
            <FieldLabel>Ciudad o municipio</FieldLabel>
            <input
              type="text"
              list="ciudades-list"
              value={data.ciudad}
              onChange={e => setData({ ...data, ciudad: e.target.value })}
              placeholder="Escribe o selecciona una ciudad…"
              className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb]"
            />
            <datalist id="ciudades-list">
              {CIUDADES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <FieldLabel>Colonia o zona</FieldLabel>
            <TextInput
              value={data.colonia}
              onChange={v => setData({ ...data, colonia: v })}
              placeholder="Ej. Valle Oriente, Del Valle, Polanco…"
            />
          </div>

          <div>
            <FieldLabel>Calle y número</FieldLabel>
            <TextInput
              value={data.direccion}
              onChange={v => setData({ ...data, direccion: v })}
              placeholder="Ej. Av. Insurgentes 250"
            />
          </div>

          <div>
            <FieldLabel optional>Link de Google Maps del predio</FieldLabel>
            <TextInput
              value={data.mapsLink}
              onChange={v => setData({ ...data, mapsLink: v })}
              placeholder="https://maps.app.goo.gl/… o pega el enlace de compartir"
            />
            <p className="text-[11px] mt-1.5 font-medium text-[#1D9E75]">
              Recomendado — pega aquí el link "Compartir" de Google Maps y el pin caerá exacto sobre el predio.
            </p>
          </div>
        </div>

        <button
          onClick={() => setSubStep(2)}
          disabled={!canContinue}
          className={`mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold transition-colors ${
            canContinue ? 'bg-[#1D9E75] text-white hover:bg-[#0F6E56]' : 'bg-[#E2E8E4] text-[#9aab9f] cursor-not-allowed'
          }`}
        >
          Confirmar con código postal
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    )
  }

  /* ── SUB-PASO 2: código postal ── */
  if (subStep === 2) {
    return (
      <div>
        <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
        <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Confirma con el código postal</h2>
        <p className="text-[14px] text-[#5a7065] mb-2">El código postal ancla las coordenadas GPS exactas del predio.</p>

        <div className="mb-6">
          <button onClick={() => setSubStep(1)} className="text-[11px] text-[#5a9078] hover:text-[#0F6E56] underline underline-offset-2">
            ← {data.estado && `${data.estado} · `}{data.ciudad}{data.colonia ? ` · ${data.colonia}` : ''}{data.direccion ? ` · ${data.direccion}` : ''}
          </button>
        </div>

        <div>
          <FieldLabel>Código postal</FieldLabel>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={cpInput}
              onChange={handleCPChange}
              placeholder="Ej. 64630"
              autoFocus
              className={`w-full border rounded-xl px-4 py-3 text-[18px] tracking-[0.2em] font-mono text-[#111d17] bg-white focus:outline-none focus:ring-2 placeholder:text-[#c5d0cb] placeholder:tracking-normal placeholder:font-sans placeholder:text-[14px] pr-12 ${
                verifyError
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                  : 'border-[#E2E8E4] focus:border-[#1D9E75] focus:ring-[#1D9E75]/20'
              }`}
            />
            {verifying && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <svg className="animate-spin w-5 h-5 text-[#1D9E75]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </div>
          {verifyError && <p className="text-[11px] text-red-500 mt-2">{verifyError}</p>}
          {verifying && <p className="text-[11px] text-[#1D9E75] mt-2">Buscando en Google Maps…</p>}
          {!verifyError && !verifying && (
            <p className="text-[11px] text-[#9aab9f] mt-2">Al completar 5 dígitos verificamos y mostramos el mapa para confirmar.</p>
          )}
        </div>
      </div>
    )
  }

  /* ── SUB-PASO 3: ajuste preciso en mapa interactivo ── */
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Ubica el predio en el mapa</h2>
      <p className="text-[14px] text-[#5a7065] mb-1">Arrastra el pin o toca el mapa para colocarlo exactamente sobre el terreno.</p>
      {fromMapsLink
        ? <p className="text-[11px] text-[#1D9E75] font-medium mb-4">Coordenadas obtenidas desde tu enlace de Google Maps — pin exacto sobre el predio.</p>
        : <p className="text-[11px] text-[#9aab9f] mb-4">El mapa inició en las coordenadas del código postal — ajústalo hasta el predio exacto.</p>
      }

      {/* Buscador de refinación */}
      <div className="relative mb-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={refineQuery}
            onChange={e => setRefineQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { searchRefine(refineQuery); setRefineSuggestions([]) } }}
            placeholder={`${data.direccion}${data.colonia ? ', ' + data.colonia : ''}`}
            className="flex-1 border border-[#E2E8E4] rounded-xl px-4 py-2.5 text-[13px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#9aab9f]"
          />
          <button
            onClick={() => { searchRefine(refineQuery || data.direccion); setRefineSuggestions([]) }}
            disabled={refineSearching}
            className="shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-[#1D9E75] text-white hover:bg-[#0F6E56] disabled:opacity-50 transition-colors"
          >
            {refineSearching ? '…' : 'Buscar'}
          </button>
        </div>
        {refineSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#E2E8E4] rounded-xl shadow-lg mt-1 overflow-hidden">
            {refineSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setMarkerLat(s.lat)
                  setMarkerLng(s.lng)
                  setRefineQuery(s.label)
                  setRefineSuggestions([])
                }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-[#111d17] hover:bg-[#F0FBF6] border-b border-[#F0F4F2] last:border-0"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <LeafletPicker
        lat={markerLat}
        lng={markerLng}
        onMove={(lat, lng) => {
          setMarkerLat(lat)
          setMarkerLng(lng)
        }}
      />

      <div className="flex items-center justify-between mt-3 mb-5 px-1">
        <p className="text-[10px] text-[#9aab9f] font-mono">{markerLat.toFixed(6)}, {markerLng.toFixed(6)}</p>
        <button
          onClick={() => { setCpInput(''); setSubStep(2); setData({ ...data, codigoPostal: '', zonaGeo: null, zonaConfirmada: false, lat: null, lng: null }) }}
          className="text-[11px] text-[#5a9078] hover:text-[#0F6E56] underline underline-offset-2"
        >
          Cambiar CP
        </button>
      </div>

      <button
        onClick={() => setData({ ...data, lat: markerLat, lng: markerLng, zonaConfirmada: true })}
        className="w-full bg-[#1D9E75] text-white rounded-xl py-3.5 text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors mb-3"
      >
        Confirmar esta ubicación
      </button>
      <button
        onClick={() => {
          setSubStep(1)
          setCpInput('')
          setData({ ...data, codigoPostal: '', zonaGeo: null, zonaConfirmada: false, lat: null, lng: null })
        }}
        className="w-full border border-[#E2E8E4] text-[#5a7065] rounded-xl py-3 text-[13px] hover:border-[#9FE1CB] hover:text-[#111d17] transition-colors"
      >
        Cambiar ubicación
      </button>
    </div>
  )
}

function Step3({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Datos del terreno</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Características físicas y condición actual del predio.</p>

      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel>Superficie total</FieldLabel>
          <div className="relative">
            <input
              type="number"
              value={data.superficie}
              onChange={e => setData({ ...data, superficie: e.target.value })}
              placeholder="0"
              className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 pr-14 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-[#9aab9f] font-medium">m²</span>
          </div>
        </div>

        <div>
          <FieldLabel>Uso de suelo actual</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {USOS_SUELO.map(u => (
              <ChipOption key={u.id} selected={data.usoSuelo === u.id} onClick={() => setData({ ...data, usoSuelo: u.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{u.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Estado actual del terreno</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {ESTADOS_TERRENO.map(e => (
              <ChipOption key={e.id} selected={data.estadoTerreno === e.id} onClick={() => setData({ ...data, estadoTerreno: e.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{e.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-1 h-px bg-[#E2E8E4]"/>
            <p className="text-[11px] font-semibold text-[#9aab9f] tracking-[0.1em] uppercase">Características adicionales</p>
            <div className="flex-1 h-px bg-[#E2E8E4]"/>
          </div>
          <p className="text-[11px] text-[#9aab9f] mb-3">Opcionales — cada campo mejora la precisión del análisis</p>
        </div>

        <div>
          <FieldLabel optional>Frente del terreno</FieldLabel>
          <div className="relative">
            <input
              type="number"
              value={data.frente}
              onChange={e => setData({ ...data, frente: e.target.value })}
              placeholder="0"
              className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 pr-14 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-[#9aab9f] font-medium">m</span>
          </div>
        </div>

        <div>
          <FieldLabel optional>Clasificación vial de la calle</FieldLabel>
          <p className="text-[11px] text-[#9aab9f] mb-2 -mt-1">Tipo de vía según el Plan de Desarrollo Urbano — impacta directamente el valor del terreno.</p>
          <div className="flex flex-col gap-2">
            {CLASIFICACION_VIAL.map(v => (
              <ChipOption key={v.id} selected={data.clasificacionVial === v.id} onClick={() => setData({ ...data, clasificacionVial: data.clasificacionVial === v.id ? '' : v.id })}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111d17]">{v.label}</p>
                    <p className="text-[11px] text-[#9aab9f] mt-0.5">{v.sub}</p>
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
                    v.id === 'local' ? 'bg-[#F0F4F2] text-[#9aab9f]' :
                    v.id === 'privada' ? 'bg-[#FEE2E2] text-[#DC2626]' :
                    'bg-[#E1F5EE] text-[#0F6E56]'
                  }`}>{v.factor}</span>
                </div>
              </ChipOption>
            ))}
          </div>
          {data.clasificacionVial && data.clasificacionVial !== 'local' && (
            <div className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2 ${
              data.clasificacionVial === 'privada'
                ? 'bg-[#FEE2E2] border border-[#FECACA]'
                : 'bg-[#E1F5EE] border border-[#9FE1CB]'
            }`}>
              <span className="text-sm mt-0.5">{data.clasificacionVial === 'privada' ? '⚠️' : '✅'}</span>
              <p className={`text-[11px] ${data.clasificacionVial === 'privada' ? 'text-[#991B1B]' : 'text-[#0F6E56]'}`}>
                {data.clasificacionVial === 'privada'
                  ? 'Calle privada — el agente aplicará una reducción sobre el valor base. Acceso limitado y menor plusvalía comercial.'
                  : `Vía ${CLASIFICACION_VIAL.find(v => v.id === data.clasificacionVial)?.label?.toLowerCase()} — el agente aplicará un incremento de ${CLASIFICACION_VIAL.find(v => v.id === data.clasificacionVial)?.factor} sobre el valor base del terreno.`
                }
              </p>
            </div>
          )}
        </div>

        <div>
          <FieldLabel optional>Pendiente del terreno</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {PENDIENTE_OPTIONS.map(p => (
              <ChipOption key={p.id} selected={data.pendiente === p.id} onClick={() => setData({ ...data, pendiente: data.pendiente === p.id ? '' : p.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{p.label}</p>
              </ChipOption>
            ))}
          </div>
          {(data.pendiente === 'moderada' || data.pendiente === 'pronunciada') && (
            <div className="mt-2 flex items-start gap-2 bg-[#FFF8E6] border border-[#F0D070] rounded-xl px-3 py-2">
              <span className="text-sm mt-0.5">⚠️</span>
              <p className="text-[11px] text-[#7a6020]">
                Pendiente {data.pendiente === 'pronunciada' ? 'pronunciada' : 'moderada'} — puede generar sobrecosto de cimentación de $800k–$1.2M. El análisis lo cuantificará.
              </p>
            </div>
          )}
        </div>

        <div>
          <FieldLabel optional>Forma del terreno</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {FORMA_TERRENO.map(f => (
              <ChipOption key={f.id} selected={data.formaTerreno === f.id} onClick={() => setData({ ...data, formaTerreno: data.formaTerreno === f.id ? '' : f.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{f.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel optional>Vista destacada</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {VISTA_DESTACADA.map(v => (
              <ChipOption key={v.id} selected={data.vistaDestacada === v.id} onClick={() => setData({ ...data, vistaDestacada: data.vistaDestacada === v.id ? '' : v.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{v.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel optional>¿El terreno es esquina?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'si', label: 'Sí, es esquina' }, { id: 'no', label: 'No es esquina' }].map(o => (
              <ChipOption key={o.id} selected={data.esEsquina === o.id} onClick={() => setData({ ...data, esEsquina: data.esEsquina === o.id ? '' : o.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{o.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-[#E2E8E4]"/>
            <p className="text-[11px] font-semibold text-[#9aab9f] tracking-[0.1em] uppercase">Servicios disponibles</p>
            <div className="flex-1 h-px bg-[#E2E8E4]"/>
          </div>
        </div>

        <div>
          <FieldLabel optional>Agua</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {SERVICIOS_AGUA.map(o => (
              <ChipOption key={o.id} selected={data.agua === o.id} onClick={() => setData({ ...data, agua: data.agua === o.id ? '' : o.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{o.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel optional>Drenaje</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {SERVICIOS_DRENAJE.map(o => (
              <ChipOption key={o.id} selected={data.drenaje === o.id} onClick={() => setData({ ...data, drenaje: data.drenaje === o.id ? '' : o.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{o.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel optional>Electricidad</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {SERVICIOS_ELECTRICIDAD.map(o => (
              <ChipOption key={o.id} selected={data.electricidad === o.id} onClick={() => setData({ ...data, electricidad: data.electricidad === o.id ? '' : o.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{o.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel optional>¿Pavimento frente al predio?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'si', label: 'Sí' }, { id: 'no', label: 'No' }].map(o => (
              <ChipOption key={o.id} selected={data.pavimento === o.id} onClick={() => setData({ ...data, pavimento: data.pavimento === o.id ? '' : o.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{o.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel optional>Distancia a ciudad de abasto</FieldLabel>
          <div className="flex flex-col gap-2">
            {DISTANCIA_ABASTO.map(o => (
              <ChipOption key={o.id} selected={data.distanciaAbasto === o.id} onClick={() => setData({ ...data, distanciaAbasto: data.distanciaAbasto === o.id ? '' : o.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{o.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Step4({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  const toggleTipo = (id: string) => {
    const curr = data.tiposDesarrollo
    setData({
      ...data,
      tiposDesarrollo: curr.includes(id) ? curr.filter(t => t !== id) : [...curr, id],
    })
  }

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Intención de desarrollo</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Define el presupuesto y el tipo de proyecto que tienes en mente.</p>

      <div className="flex flex-col gap-6">
        <div>
          <p className="text-[13px] font-semibold text-[#111d17] mb-3">Presupuesto aproximado</p>
          <div className="grid grid-cols-2 gap-2">
            {RANGOS_PRESUPUESTO.map(r => (
              <ChipOption key={r.id} selected={data.presupuesto === r.id} onClick={() => setData({ ...data, presupuesto: r.id })}>
                <p className="text-[13px] font-medium text-[#111d17]">{r.label}</p>
              </ChipOption>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel optional>Precio solicitado por el terreno</FieldLabel>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-[#9aab9f] font-medium">$</span>
            <input
              type="number"
              value={data.precioSolicitado}
              onChange={e => setData({ ...data, precioSolicitado: e.target.value })}
              placeholder="0"
              className="w-full border border-[#E2E8E4] rounded-xl pl-8 pr-16 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-[#9aab9f] font-medium">MXN</span>
          </div>
          <p className="text-[11px] text-[#9aab9f] mt-1.5">El análisis validará este precio contra el mercado y emitirá un semáforo de confiabilidad.</p>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-[#111d17] mb-1">Tipo de desarrollo deseado</p>
          <p className="text-[12px] text-[#9aab9f] mb-3">Puedes elegir más de uno.</p>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_DESARROLLO.map(t => (
              <ChipOption key={t.id} selected={data.tiposDesarrollo.includes(t.id)} onClick={() => toggleTipo(t.id)}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.icon}</span>
                  <p className="text-[13px] font-medium text-[#111d17]">{t.label}</p>
                </div>
              </ChipOption>
            ))}
            <ChipOption selected={data.tiposDesarrollo.includes('otro')} onClick={() => toggleTipo('otro')}>
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <p className="text-[13px] font-medium text-[#111d17]">Otro</p>
              </div>
            </ChipOption>
          </div>
          {data.tiposDesarrollo.includes('otro') && (
            <input
              autoFocus
              type="text"
              value={data.tipoOtroTexto}
              onChange={e => setData({ ...data, tipoOtroTexto: e.target.value })}
              placeholder="Describe la vocación del proyecto…"
              className="mt-3 w-full text-[13px] bg-white border border-[#1D9E75] rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c0cdc7]"
            />
          )}
        </div>

        <div>
          <p className="text-[13px] font-semibold text-[#111d17] mb-1">Nivel de construcción deseado</p>
          <p className="text-[12px] text-[#9aab9f] mb-3">Define la calidad y acabados del desarrollo. Esto calibra el costo de construcción por m².</p>
          <div className="flex flex-col gap-2">
            {BANDAS_CONSTRUCCION.map(b => (
              <ChipOption key={b.id} selected={data.bandaConstruccion === b.id} onClick={() => setData({ ...data, bandaConstruccion: b.id })}>
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{b.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[13px] font-semibold text-[#111d17]">Banda {b.id} — {b.label}</p>
                      <span className="text-[10px] font-bold text-[#1D9E75] shrink-0">{b.rango}</span>
                    </div>
                    <p className="text-[11px] text-[#9aab9f] mb-0.5">{b.sub}</p>
                    <p className="text-[11px] text-[#5a7065]">{b.desc}</p>
                  </div>
                </div>
              </ChipOption>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F0F4F2] last:border-0">
      <p className="text-[12px] text-[#7aaa90] uppercase tracking-wide w-36 shrink-0">{label}</p>
      <p className="text-[13px] font-medium text-[#111d17] text-right">{value || <span className="text-[#c5d0cb]">—</span>}</p>
    </div>
  )
}

function Step5({ data }: { data: FormData }) {
  const usoSuelo   = USOS_SUELO.find(u => u.id === data.usoSuelo)
  const estado     = ESTADOS_TERRENO.find(e => e.id === data.estadoTerreno)
  const presupuesto = RANGOS_PRESUPUESTO.find(r => r.id === data.presupuesto)
  const bandaConst = BANDAS_CONSTRUCCION.find(b => b.id === data.bandaConstruccion)
  const tiposLabels = [
    ...TIPOS_DESARROLLO.filter(t => data.tiposDesarrollo.includes(t.id)).map(t => t.label),
    ...(data.tiposDesarrollo.includes('otro') && data.tipoOtroTexto ? [data.tipoOtroTexto] : []),
  ]

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Resumen del terreno</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Confirma los datos antes de iniciar el análisis.</p>

      <div className="rounded-2xl border border-[#1D9E75]/30 bg-[#F0FBF6] p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1D9E75] flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#0F6E56]">Agentes de análisis listos</p>
            <p className="text-[11px] text-[#5a9078]">El análisis iniciará en cuanto confirmes</p>
          </div>
        </div>

        {data.nombreProyecto && (
          <div className="mb-3 px-4 py-3 bg-[#1D9E75] rounded-xl">
            <p className="text-[10px] font-semibold text-[#9FE1CB] tracking-[0.12em] uppercase mb-0.5">Proyecto</p>
            <p className="text-[16px] font-bold text-white">{data.nombreProyecto}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#D4EFE3] px-4 divide-y divide-[#F0F4F2]">
          {data.estado && <SummaryRow label="Estado" value={data.estado} />}
          <SummaryRow label="Ciudad" value={data.ciudad} />
          <SummaryRow label="Colonia" value={data.colonia} />
          {data.direccion && <SummaryRow label="Dirección" value={data.direccion} />}
          {data.codigoPostal && <SummaryRow label="Código postal" value={data.codigoPostal} />}
          {data.lat && data.lng && (
            <SummaryRow label="Coordenadas" value={
              <span className="font-mono text-[11px]">{data.lat.toFixed(5)}, {data.lng.toFixed(5)}</span>
            } />
          )}
          {data.mapsLink && <SummaryRow label="Maps" value={
            <a href={data.mapsLink} target="_blank" rel="noopener noreferrer" className="text-[#1D9E75] underline underline-offset-2 text-[12px]">Ver enlace</a>
          } />}
          <SummaryRow label="Superficie" value={data.superficie ? `${Number(data.superficie).toLocaleString('es-MX')} m²` : ''} />
          <SummaryRow label="Uso de suelo" value={usoSuelo?.label} />
          <SummaryRow label="Condición" value={estado?.label} />
          <SummaryRow label="Presupuesto" value={presupuesto?.label} />
          <SummaryRow
            label="Desarrollo"
            value={tiposLabels.length > 0 ? tiposLabels.join(' · ') : undefined}
          />
          {bandaConst && (
            <SummaryRow
              label="Construcción"
              value={`Banda ${bandaConst.id} — ${bandaConst.label} · ${bandaConst.rango}`}
            />
          )}
          {data.frente && <SummaryRow label="Frente" value={`${data.frente} m`} />}
          {data.clasificacionVial && <SummaryRow label="Vialidad" value={
            <span className="flex items-center gap-1.5">
              {CLASIFICACION_VIAL.find(v => v.id === data.clasificacionVial)?.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                data.clasificacionVial === 'local' ? 'bg-[#F0F4F2] text-[#9aab9f]' :
                data.clasificacionVial === 'privada' ? 'bg-[#FEE2E2] text-[#DC2626]' :
                'bg-[#E1F5EE] text-[#0F6E56]'
              }`}>{CLASIFICACION_VIAL.find(v => v.id === data.clasificacionVial)?.factor}</span>
            </span>
          } />}
          {data.pendiente && <SummaryRow label="Pendiente" value={PENDIENTE_OPTIONS.find(p => p.id === data.pendiente)?.label} />}
          {data.formaTerreno && <SummaryRow label="Forma" value={FORMA_TERRENO.find(f => f.id === data.formaTerreno)?.label} />}
          {data.vistaDestacada && data.vistaDestacada !== 'ninguna' && <SummaryRow label="Vista" value={VISTA_DESTACADA.find(v => v.id === data.vistaDestacada)?.label} />}
          {data.esEsquina && <SummaryRow label="Esquina" value={data.esEsquina === 'si' ? 'Sí' : 'No'} />}
          {data.agua && <SummaryRow label="Agua" value={SERVICIOS_AGUA.find(o => o.id === data.agua)?.label} />}
          {data.drenaje && <SummaryRow label="Drenaje" value={SERVICIOS_DRENAJE.find(o => o.id === data.drenaje)?.label} />}
          {data.electricidad && <SummaryRow label="Electricidad" value={SERVICIOS_ELECTRICIDAD.find(o => o.id === data.electricidad)?.label} />}
          {data.pavimento && <SummaryRow label="Pavimento" value={data.pavimento === 'si' ? 'Sí' : 'No'} />}
          {data.distanciaAbasto && <SummaryRow label="Abasto" value={DISTANCIA_ABASTO.find(o => o.id === data.distanciaAbasto)?.label} />}
          {data.precioSolicitado && <SummaryRow label="Precio solicitado" value={`$${Number(data.precioSolicitado).toLocaleString('es-MX')} MXN`} />}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-[#FFF8E6] border border-[#F0D070] rounded-xl px-4 py-3">
        <span className="text-base mt-0.5">⏱️</span>
        <p className="text-[12px] text-[#7a6020]">
          El análisis incluye normativa urbana, mercado comparables y potencial de desarrollo. Toma entre <strong>2 y 4 horas</strong>. Te notificaremos al completarse.
        </p>
      </div>
    </div>
  )
}

export default function FlujoA() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL)

  const canAdvance = () => {
    if (step === 1) return data.nombreProyecto.trim() !== ''
    if (step === 2) return data.zonaConfirmada && data.ciudad !== ''
    if (step === 3) return data.superficie !== '' && data.usoSuelo !== '' && data.estadoTerreno !== ''
    if (step === 4) {
      const otroOk = !data.tiposDesarrollo.includes('otro') || data.tipoOtroTexto.trim() !== ''
      return data.presupuesto !== '' && data.tiposDesarrollo.length > 0 && otroOk && data.bandaConstruccion !== ''
    }
    return true
  }

  const handleBack = () => {
    if (step === 1) router.push('/prospeccion')
    else setStep(s => s - 1)
  }

  const handleNext = () => {
    if (!canAdvance()) return
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
    } else {
      localStorage.setItem('smt_flujo_a_data', JSON.stringify(data))
      router.push(`/analisis/analizando?proyecto=${encodeURIComponent(data.nombreProyecto)}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">
      <header className="px-8 py-5 flex items-center gap-3 border-b border-[#E2E8E4] bg-white">
        <div className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] font-medium text-[#1a1a1a] tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-[#6b7c74] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-[#9aab9f]">
          <span className="text-[#1D9E75] font-medium">Prospección</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="text-[#1D9E75] font-medium">Flujo A</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Captura del terreno</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[560px]">
          <ProgressBar step={step} />

          <div className="bg-white rounded-2xl border border-[#E2E8E4] p-8 mb-6 shadow-sm">
            {step === 1 && <Step1 data={data} setData={setData} />}
            {step === 2 && <Step2 data={data} setData={setData} />}
            {step === 3 && <Step3 data={data} setData={setData} />}
            {step === 4 && <Step4 data={data} setData={setData} />}
            {step === 5 && <Step5 data={data} />}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-[13px] text-[#5a7065] hover:text-[#111d17] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {step === 1 ? 'Volver a selección' : 'Paso anterior'}
            </button>

            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                canAdvance()
                  ? 'bg-[#1D9E75] text-white hover:bg-[#0F6E56] cursor-pointer'
                  : 'bg-[#E2E8E4] text-[#9aab9f] cursor-not-allowed'
              }`}
            >
              {step === TOTAL_STEPS ? 'Iniciar Análisis' : 'Siguiente'}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
