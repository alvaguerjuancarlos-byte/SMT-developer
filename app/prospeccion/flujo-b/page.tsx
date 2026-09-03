'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authedFetch } from '@/lib/apiClient'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

// Look & feel — espejo azul del navy/oro de Flujo A (ver app/prospeccion/flujo-a/page.tsx).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

const CIUDADES = [
  'Acapulco', 'Acuña', 'Agua Prieta', 'Aguascalientes', 'Ahome', 'Allende',
  'Altamira', 'Apatzingán', 'Apodaca', 'Atlacomulco', 'Atizapán de Zaragoza',
  'Bacalar', 'Bahía de Banderas',
  'Cadereyta Jiménez', 'Campeche', 'Cancún', 'Cárdenas', 'Celaya', 'Chalco',
  'Chetumal', 'Chihuahua', 'Chilpancingo', 'Chimalhuacán', 'Cholula',
  'Ciudad de México', 'Ciudad del Carmen', 'Ciudad Juárez', 'Ciudad Obregón',
  'Ciudad Valles', 'Ciudad Victoria', 'Coatzacoalcos', 'Coacalco', 'Colima',
  'Córdoba', 'Corregidora', 'Cozumel', 'Cuauhtémoc', 'Cuautitlán',
  'Cuautitlán Izcalli', 'Cuautla', 'Cuernavaca', 'Culiacán',
  'Delicias', 'Durango',
  'Ecatepec', 'El Marqués', 'Ensenada', 'Escobedo',
  'Fresnillo',
  'García', 'Gómez Palacio', 'Guadalajara', 'Guadalupe', 'Guanajuato',
  'Guasave', 'Guaymas',
  'Hermosillo', 'Hidalgo del Parral', 'Huatulco',
  'Irapuato', 'Ixtapaluca',
  'Jiutepec', 'Juárez',
  'La Paz', 'Lázaro Cárdenas', 'León', 'Linares', 'Loreto', 'Los Cabos', 'Los Mochis',
  'Manzanillo', 'Matamoros', 'Mazatlán', 'Mérida', 'Metepec', 'Mexicali',
  'Monclova', 'Montemorelos', 'Monterrey', 'Morelia',
  'Naucalpan', 'Navojoa', 'Nezahualcóyotl', 'Nicolás Romero', 'Nogales',
  'Nuevo Laredo',
  'Oaxaca de Juárez', 'Orizaba',
  'Pachuca', 'Piedras Negras', 'Playa del Carmen', 'Poza Rica', 'Progreso',
  'Puebla', 'Puerto Escondido', 'Puerto Peñasco', 'Puerto Vallarta',
  'Querétaro',
  'Reynosa', 'Rioverde', 'Rosarito',
  'Salamanca', 'Saltillo', 'San Cristóbal de las Casas', 'San Juan del Río',
  'San Luis Potosí', 'San Luis Río Colorado', 'San Miguel de Allende',
  'San Nicolás de los Garza', 'San Pedro Garza García', 'Santa Catarina', 'Silao',
  'Tampico', 'Tapachula', 'Tecámac', 'Tehuacán', 'Temixco', 'Tepic', 'Texcoco',
  'Tijuana', 'Tizayuca', 'Tlajomulco de Zúñiga', 'Tlalnepantla', 'Tlaquepaque',
  'Tlaxcala', 'Toluca', 'Tonalá', 'Torreón', 'Tultitlán', 'Tulancingo', 'Tulum',
  'Tuxtla Gutiérrez',
  'Uruapan',
  'Valladolid', 'Veracruz', 'Villahermosa',
  'Xalapa',
  'Zacatecas', 'Zamora', 'Zapopan', 'Zihuatanejo', 'Zinacantepec',
].sort((a, b) => a.localeCompare(b, 'es'))

const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila de Zaragoza', 'Colima',
  'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'México',
  'Michoacán de Ocampo', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz de Ignacio de la Llave',
  'Yucatán', 'Zacatecas',
]

const TIPOS_DESARROLLO = [
  { id: 'residencial-vertical', label: 'Residencial vertical', icon: '🏢', desc: 'Torre o edificio de departamentos' },
  { id: 'residencial-horizontal', label: 'Residencial horizontal', icon: '🏘️', desc: 'Casas, fraccionamiento o cluster' },
  { id: 'comercial', label: 'Comercial', icon: '🏪', desc: 'Local, plaza o centro comercial' },
  { id: 'mixto', label: 'Uso mixto', icon: '🏗️', desc: 'Combinación residencial + comercial' },
  { id: 'industrial', label: 'Industrial / Nave', icon: '🏭', desc: 'Bodega, parque o nave industrial' },
  { id: 'no-definido', label: 'Aún no lo sé', icon: '💡', desc: 'El Scout sugiere el mejor uso' },
]

const RANGOS_SUPERFICIE = [
  { id: 'menos-500', label: 'Menos de 500 m²' },
  { id: '500-1000', label: '500 – 1,000 m²' },
  { id: '1000-3000', label: '1,000 – 3,000 m²' },
  { id: '3000-10000', label: '3,000 – 10,000 m²' },
  { id: 'mas-10000', label: 'Más de 10,000 m²' },
  { id: 'flexible', label: 'Flexible / Sin restricción' },
]

const RANGOS_PRESUPUESTO = [
  { id: 'menos-5m', label: 'Menos de $5 MDP' },
  { id: '5-15m', label: '$5 – $15 MDP' },
  { id: '15-50m', label: '$15 – $50 MDP' },
  { id: '50-150m', label: '$50 – $150 MDP' },
  { id: 'mas-150m', label: 'Más de $150 MDP' },
  { id: 'por-definir', label: 'Por definir con socios' },
]

const PRIORIDADES = [
  { id: 'rentabilidad', label: 'Máxima rentabilidad', icon: '📈' },
  { id: 'velocidad', label: 'Velocidad de venta', icon: '⚡' },
  { id: 'riesgo', label: 'Menor riesgo', icon: '🛡️' },
  { id: 'plusvalia', label: 'Zona con plusvalía', icon: '🔺' },
]

interface ZonaGeo {
  cp: string
  lat: number
  lng: number
  nombre: string
  municipio: string
  estado?: string
}

const MAX_CODIGOS_POSTALES = 3

interface FormData {
  nombreProyecto: string
  estado: string
  ciudad: string
  zona: string
  zonasGeo: ZonaGeo[]
  tipoDev: string
  tipoOtroTexto: string
  superficie: string
  presupuesto: string
  prioridades: string[]
  notas: string
}

const INITIAL: FormData = {
  nombreProyecto: '',
  estado: '',
  ciudad: '',
  zona: '',
  zonasGeo: [],
  tipoDev: '',
  tipoOtroTexto: '',
  superficie: '',
  presupuesto: '',
  prioridades: [],
  notas: '',
}

const TOTAL_STEPS = 6

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full flex-1 transition-all duration-300 ${i < step ? 'bg-[#5B8FD4]' : 'bg-[#2a3f5c]'}`}
          />
        ))}
      </div>
      <p className="text-[11px] text-[#5f6a80] tracking-wide">Paso {step} de {TOTAL_STEPS}</p>
    </div>
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
          ? 'bg-[#132a4d] border-[#5B8FD4] shadow-[0_0_0_2px_#5B8FD4]'
          : 'bg-[#132a4d] border-[#2a3f5c] hover:border-[#3f5a85]'
      }`}
    >
      {children}
    </button>
  )
}

function Step1({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-2" style={{ fontFamily: 'var(--font-plex-mono)' }}>Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-medium text-[#f4f0e6] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>Nombre del proyecto</h2>
      <p className="text-[14px] text-[#8b96ab] mb-6">
        Este nombre identificará el proyecto y los 3 candidatos de terreno a lo largo del análisis Scout y el reporte comparativo final.
      </p>
      <div>
        <label className="block text-[12px] text-[#8b96ab] mb-2">Nombre del proyecto</label>
        <input
          type="text"
          value={data.nombreProyecto}
          onChange={e => setData({ ...data, nombreProyecto: e.target.value })}
          placeholder="Ej. Residencial Valle 2026, Torre Midtown, Plaza Industrial Norte"
          className="w-full border border-[#2a3f5c] rounded-xl px-4 py-3 text-[14px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#5B8FD4] focus:ring-2 focus:ring-[#5B8FD4]/20 placeholder:text-[#5f6a80]"
        />
        <p className="text-[11px] text-[#5f6a80] mt-2">
          Puedes usar el concepto de desarrollo, la zona objetivo o el nombre comercial que tengas en mente.
        </p>
      </div>
    </div>
  )
}

function Step2({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  const [subStep, setSubStep] = useState<1 | 2>(1)
  const [cpInput, setCpInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [preview, setPreview] = useState<ZonaGeo | null>(null)

  const geocodeCP = async (cp: string) => {
    if (data.zonasGeo.some(z => z.cp === cp)) {
      setVerifyError('Ese código postal ya lo agregaste.')
      return
    }
    setVerifying(true)
    setVerifyError('')
    try {
      const params = new URLSearchParams({ cp, ciudad: data.ciudad, estado: data.estado })
      const res = await authedFetch(`/api/geocode?${params}`)
      const json = await res.json()
      if (!json.found) {
        setVerifyError('No se encontró ese código postal en México. Verifica e intenta de nuevo.')
        return
      }
      setPreview({
        cp,
        lat: json.lat,
        lng: json.lng,
        nombre: json.colonia || data.zona || json.municipio,
        municipio: json.municipio || data.ciudad,
        estado: json.estado,
      })
    } catch {
      setVerifyError('Error de conexión. Verifica tu red e intenta de nuevo.')
    } finally {
      setVerifying(false)
    }
  }

  const handleCPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5)
    setCpInput(val)
    setVerifyError('')
    if (val.length === 5) geocodeCP(val)
  }

  const confirmAdd = () => {
    if (!preview) return
    setData({
      ...data,
      zonasGeo: [...data.zonasGeo, preview],
      ciudad: data.ciudad || preview.municipio,
      estado: data.estado || preview.estado || data.estado,
    })
    setPreview(null)
    setCpInput('')
  }

  const cancelPreview = () => {
    setPreview(null)
    setCpInput('')
    setVerifyError('')
  }

  const removeZona = (cp: string) => {
    setData({ ...data, zonasGeo: data.zonasGeo.filter(z => z.cp !== cp) })
  }

  /* ── SUB-PASO 1: zona y ciudad ── */
  if (subStep === 1) {
    const canContinue = data.estado.trim() !== '' && data.ciudad.trim() !== ''
    return (
      <div>
        <p className="text-[12px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-2" style={{ fontFamily: 'var(--font-plex-mono)' }}>Scout IA · Flujo B</p>
        <h2 className="text-[24px] font-medium text-[#f4f0e6] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>¿En qué zona quieres buscar?</h2>
        <p className="text-[14px] text-[#8b96ab] mb-6">Indica el estado, la ciudad y la colonia o zona objetivo.</p>

        <div className="mb-4">
          <label className="block text-[12px] text-[#8b96ab] mb-2">Estado</label>
          <input
            type="text"
            list="estados-list-b"
            value={data.estado}
            onChange={e => setData({ ...data, estado: e.target.value })}
            placeholder="Selecciona un estado…"
            className="w-full border border-[#2a3f5c] rounded-xl px-4 py-3 text-[14px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#5B8FD4] focus:ring-2 focus:ring-[#5B8FD4]/20 placeholder:text-[#5f6a80]"
          />
          <datalist id="estados-list-b">
            {ESTADOS_MX.map(e => <option key={e} value={e} />)}
          </datalist>
        </div>

        <div className="mb-4">
          <label className="block text-[12px] text-[#8b96ab] mb-2">Ciudad o municipio</label>
          <input
            type="text"
            list="ciudades-list-b"
            value={data.ciudad}
            onChange={e => setData({ ...data, ciudad: e.target.value })}
            placeholder="Escribe o selecciona una ciudad…"
            className="w-full border border-[#2a3f5c] rounded-xl px-4 py-3 text-[14px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#5B8FD4] focus:ring-2 focus:ring-[#5B8FD4]/20 placeholder:text-[#5f6a80]"
          />
          <datalist id="ciudades-list-b">
            {CIUDADES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="mb-6">
          <label className="block text-[12px] text-[#8b96ab] mb-2">
            Colonia o zona <span className="text-[#5f6a80]">(opcional)</span>
          </label>
          <input
            type="text"
            value={data.zona}
            onChange={e => setData({ ...data, zona: e.target.value })}
            placeholder="Ej. Valle Oriente, Cumbres, San Jerónimo…"
            className="w-full border border-[#2a3f5c] rounded-xl px-4 py-3 text-[14px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#5B8FD4] focus:ring-2 focus:ring-[#5B8FD4]/20 placeholder:text-[#5f6a80]"
          />
          <p className="text-[11px] text-[#5f6a80] mt-2">Si la dejas vacía, el Scout buscará en toda la ciudad.</p>
        </div>

        <button
          onClick={() => setSubStep(2)}
          disabled={!canContinue}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold transition-colors ${
            canContinue ? 'bg-[#5B8FD4] text-[#f4f0e6] hover:bg-[#8FB6E8]' : 'bg-[#2a3f5c] text-[#5f6a80] cursor-not-allowed'
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

  /* ── SUB-PASO 2: agregar hasta 3 códigos postales ── */
  const puedeAgregarMas = data.zonasGeo.length < MAX_CODIGOS_POSTALES
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-2" style={{ fontFamily: 'var(--font-plex-mono)' }}>Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-medium text-[#f4f0e6] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>Códigos postales a buscar</h2>
      <p className="text-[14px] text-[#8b96ab] mb-2">
        El código postal permite al Scout usar coordenadas GPS exactas para la búsqueda. Puedes agregar hasta {MAX_CODIGOS_POSTALES} para ampliar el área.
      </p>

      {/* Resumen de lo elegido */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setSubStep(1)} className="text-[11px] text-[#8b96ab] hover:text-[#8FB6E8] underline underline-offset-2">
          ← {data.estado && `${data.estado} · `}{data.ciudad}{data.zona ? ` · ${data.zona}` : ''}
        </button>
      </div>

      {/* Chips de zonas ya confirmadas */}
      {data.zonasGeo.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {data.zonasGeo.map(z => (
            <div key={z.cp} className="flex items-center gap-2 bg-[#5B8FD4]/10 border border-[#5B8FD4]/40 rounded-full pl-3 pr-2 py-1.5">
              <span className="text-[12px] font-semibold text-[#8FB6E8]">CP {z.cp}</span>
              <span className="text-[11px] text-[#8b96ab]">· {z.nombre}</span>
              <button
                onClick={() => removeZona(z.cp)}
                className="text-[#8b96ab] hover:text-red-500 ml-1"
                aria-label={`Quitar CP ${z.cp}`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preview del CP recién geocodificado, pendiente de confirmar */}
      {preview && (
        <div className="rounded-xl border border-[#2a3f5c] bg-[#132a4d] px-4 py-3 mb-5">
          <div className="rounded-2xl overflow-hidden border border-[#2a3f5c] mb-3" style={{ height: 160 }}>
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${preview.lng - 0.012},${preview.lat - 0.008},${preview.lng + 0.012},${preview.lat + 0.008}&layer=mapnik&marker=${preview.lat},${preview.lng}`}
              className="w-full h-full border-0"
              loading="lazy"
              title="Mapa de la zona"
            />
          </div>
          <p className="text-[13px] font-semibold text-[#f4f0e6]">CP {preview.cp} · {preview.nombre}</p>
          <p className="text-[10px] text-[#5f6a80] font-mono mb-3">{preview.lat.toFixed(5)}, {preview.lng.toFixed(5)}</p>
          <div className="flex gap-2">
            <button
              onClick={confirmAdd}
              className="flex-1 bg-[#5B8FD4] text-[#f4f0e6] rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#8FB6E8] transition-colors"
            >
              Agregar esta zona
            </button>
            <button
              onClick={cancelPreview}
              className="px-4 border border-[#2a3f5c] text-[#8b96ab] rounded-xl py-2.5 text-[13px] hover:border-[#5B8FD4]/40 transition-colors"
            >
              Cambiar
            </button>
          </div>
        </div>
      )}

      {/* Input para agregar un nuevo CP */}
      {!preview && puedeAgregarMas && (
        <div className="mb-2">
          <label className="block text-[12px] text-[#8b96ab] mb-2">
            {data.zonasGeo.length === 0 ? 'Código postal' : `Agregar otro código postal (${data.zonasGeo.length}/${MAX_CODIGOS_POSTALES})`}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={cpInput}
              onChange={handleCPChange}
              placeholder="Ej. 64630"
              autoFocus
              className={`w-full border rounded-xl px-4 py-3 text-[18px] tracking-[0.2em] font-mono text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:ring-2 placeholder:text-[#5f6a80] placeholder:tracking-normal placeholder:font-sans placeholder:text-[14px] pr-12 ${
                verifyError
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                  : 'border-[#2a3f5c] focus:border-[#5B8FD4] focus:ring-[#5B8FD4]/20'
              }`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {verifying && (
                <svg className="animate-spin w-5 h-5 text-[#5B8FD4]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              )}
            </div>
          </div>
          {verifyError && <p className="text-[11px] text-red-500 mt-2">{verifyError}</p>}
          {verifying && <p className="text-[11px] text-[#5B8FD4] mt-2">Buscando en Google Maps…</p>}
          {!verifyError && !verifying && (
            <p className="text-[11px] text-[#5f6a80] mt-2">
              {data.zonasGeo.length === 0
                ? 'Al completar 5 dígitos verificamos automáticamente y mostramos el mapa.'
                : `Opcional — puedes agregar hasta ${MAX_CODIGOS_POSTALES} códigos postales para ampliar la búsqueda.`}
            </p>
          )}
        </div>
      )}

      {!puedeAgregarMas && (
        <p className="text-[11px] text-[#5f6a80] mt-2">Máximo de {MAX_CODIGOS_POSTALES} códigos postales alcanzado.</p>
      )}
    </div>
  )
}

function Step3({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-2" style={{ fontFamily: 'var(--font-plex-mono)' }}>Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-medium text-[#f4f0e6] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>¿Qué tipo de desarrollo tienes en mente?</h2>
      <p className="text-[14px] text-[#8b96ab] mb-6">El Scout filtrará terrenos con el uso de suelo adecuado.</p>

      <div className="grid grid-cols-2 gap-3">
        {TIPOS_DESARROLLO.map(t => (
          <ChipOption key={t.id} selected={data.tipoDev === t.id} onClick={() => setData({ ...data, tipoDev: t.id, tipoOtroTexto: '' })}>
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">{t.icon}</span>
              <div>
                <p className="text-[13px] font-semibold text-[#f4f0e6] leading-snug">{t.label}</p>
                <p className="text-[11px] text-[#5f6a80] mt-0.5">{t.desc}</p>
              </div>
            </div>
          </ChipOption>
        ))}
        <ChipOption selected={data.tipoDev === 'otro'} onClick={() => setData({ ...data, tipoDev: 'otro' })}>
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">✏️</span>
            <div>
              <p className="text-[13px] font-semibold text-[#f4f0e6] leading-snug">Otro</p>
              <p className="text-[11px] text-[#5f6a80] mt-0.5">Describe la vocación del proyecto</p>
            </div>
          </div>
        </ChipOption>
      </div>
      {data.tipoDev === 'otro' && (
        <input
          autoFocus
          type="text"
          value={data.tipoOtroTexto}
          onChange={e => setData({ ...data, tipoOtroTexto: e.target.value })}
          placeholder="Describe la vocación del proyecto…"
          className="mt-3 w-full text-[13px] bg-[#132a4d] border border-[#5B8FD4] rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#5B8FD4]/20 placeholder:text-[#5f6a80]"
        />
      )}
    </div>
  )
}

function Step4({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-2" style={{ fontFamily: 'var(--font-plex-mono)' }}>Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-medium text-[#f4f0e6] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>Superficie y presupuesto</h2>
      <p className="text-[14px] text-[#8b96ab] mb-6">Define los rangos para que el Scout descarte terrenos fuera de tu parámetro.</p>

      <div className="mb-6">
        <p className="text-[13px] font-semibold text-[#f4f0e6] mb-3">Superficie del terreno</p>
        <div className="grid grid-cols-2 gap-2">
          {RANGOS_SUPERFICIE.map(r => (
            <ChipOption key={r.id} selected={data.superficie === r.id} onClick={() => setData({ ...data, superficie: r.id })}>
              <p className="text-[13px] text-[#f4f0e6] font-medium">{r.label}</p>
            </ChipOption>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-semibold text-[#f4f0e6] mb-3">Presupuesto de adquisición</p>
        <div className="grid grid-cols-2 gap-2">
          {RANGOS_PRESUPUESTO.map(r => (
            <ChipOption key={r.id} selected={data.presupuesto === r.id} onClick={() => setData({ ...data, presupuesto: r.id })}>
              <p className="text-[13px] text-[#f4f0e6] font-medium">{r.label}</p>
            </ChipOption>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step5({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  const toggle = (id: string) => {
    const curr = data.prioridades
    if (curr.includes(id)) {
      setData({ ...data, prioridades: curr.filter(p => p !== id) })
    } else if (curr.length < 2) {
      setData({ ...data, prioridades: [...curr, id] })
    }
  }

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-2" style={{ fontFamily: 'var(--font-plex-mono)' }}>Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-medium text-[#f4f0e6] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>¿Cuáles son tus prioridades?</h2>
      <p className="text-[14px] text-[#8b96ab] mb-6">Elige hasta 2. El Scout ponderará los resultados según lo que más te importa.</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {PRIORIDADES.map(p => {
          const selected = data.prioridades.includes(p.id)
          const disabled = !selected && data.prioridades.length >= 2
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              disabled={disabled}
              className={`text-left rounded-xl border px-4 py-4 transition-all duration-150 ${
                selected
                  ? 'bg-[#132a4d] border-[#5B8FD4] shadow-[0_0_0_2px_#5B8FD4]'
                  : disabled
                  ? 'bg-[#132a4d] border-[#2a3f5c] opacity-40 cursor-not-allowed'
                  : 'bg-[#132a4d] border-[#2a3f5c] hover:border-[#5B8FD4]/40'
              }`}
            >
              <span className="text-2xl block mb-2">{p.icon}</span>
              <p className="text-[13px] font-semibold text-[#f4f0e6]">{p.label}</p>
            </button>
          )
        })}
      </div>

      <div>
        <label className="block text-[12px] text-[#8b96ab] mb-2">
          Contexto adicional <span className="text-[#5f6a80]">(opcional)</span>
        </label>
        <textarea
          rows={3}
          placeholder="Ej. Buscamos algo para clase media-alta, con acceso a vía rápida, preferentemente esquina…"
          value={data.notas}
          onChange={e => setData({ ...data, notas: e.target.value })}
          className="w-full border border-[#2a3f5c] rounded-xl px-4 py-3 text-[14px] text-[#f4f0e6] bg-[#132a4d] focus:outline-none focus:border-[#5B8FD4] focus:ring-2 focus:ring-[#5B8FD4]/20 placeholder:text-[#5f6a80] resize-none"
        />
      </div>
    </div>
  )
}

function Step6({ data }: { data: FormData }) {
  const tipo = data.tipoDev === 'otro' ? null : TIPOS_DESARROLLO.find(t => t.id === data.tipoDev)
  const tipoLabel = data.tipoDev === 'otro' ? `✏️ ${data.tipoOtroTexto || 'Otro'}` : (tipo ? `${tipo.icon} ${tipo.label}` : '—')
  const superficie = RANGOS_SUPERFICIE.find(r => r.id === data.superficie)
  const presupuesto = RANGOS_PRESUPUESTO.find(r => r.id === data.presupuesto)
  const prioridades = PRIORIDADES.filter(p => data.prioridades.includes(p.id))

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#8FB6E8] tracking-[0.12em] uppercase mb-2" style={{ fontFamily: 'var(--font-plex-mono)' }}>Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-medium text-[#f4f0e6] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>Resumen de tu búsqueda</h2>
      <p className="text-[14px] text-[#8b96ab] mb-6">Confirma los parámetros antes de activar el Scout.</p>

      <div className="rounded-2xl border border-[#5B8FD4]/30 bg-[#1c304b] p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#5B8FD4] flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#f4f0e6" strokeWidth="1.8"/>
              <path d="M16.5 16.5L21 21" stroke="#f4f0e6" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M8 11H14M11 8V14" stroke="#f4f0e6" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#8FB6E8]">Scout listo para activarse</p>
            <p className="text-[11px] text-[#8b96ab]">El análisis iniciará en cuanto confirmes</p>
          </div>
        </div>

        {data.nombreProyecto && (
          <div className="mb-3 px-4 py-3 bg-[#5B8FD4] rounded-xl">
            <p className="text-[10px] font-semibold text-[#9FE1CB] tracking-[0.12em] uppercase mb-0.5">Proyecto</p>
            <p className="text-[16px] font-bold text-[#f4f0e6]">{data.nombreProyecto}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#132a4d] rounded-xl p-3 border border-[#5B8FD4]/25">
            <p className="text-[10px] text-[#8b96ab] uppercase tracking-wide mb-1">Ubicación</p>
            {data.estado && <p className="text-[10px] font-semibold text-[#5B8FD4] mb-0.5">{data.estado}</p>}
            <p className="text-[13px] font-semibold text-[#f4f0e6]">{data.ciudad || '—'}</p>
            {data.zona && <p className="text-[11px] text-[#8b96ab] mt-0.5">{data.zona}</p>}
            {data.zonasGeo.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {data.zonasGeo.map(z => (
                  <span key={z.cp} className="text-[10px] font-medium text-[#5B8FD4] bg-[#5B8FD4]/10 px-1.5 py-0.5 rounded">
                    CP {z.cp}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bg-[#132a4d] rounded-xl p-3 border border-[#5B8FD4]/25">
            <p className="text-[10px] text-[#8b96ab] uppercase tracking-wide mb-1">Tipo de desarrollo</p>
            <p className="text-[13px] font-semibold text-[#f4f0e6]">{tipoLabel}</p>
          </div>
          <div className="bg-[#132a4d] rounded-xl p-3 border border-[#5B8FD4]/25">
            <p className="text-[10px] text-[#8b96ab] uppercase tracking-wide mb-1">Superficie</p>
            <p className="text-[13px] font-semibold text-[#f4f0e6]">{superficie?.label || '—'}</p>
          </div>
          <div className="bg-[#132a4d] rounded-xl p-3 border border-[#5B8FD4]/25">
            <p className="text-[10px] text-[#8b96ab] uppercase tracking-wide mb-1">Presupuesto</p>
            <p className="text-[13px] font-semibold text-[#f4f0e6]">{presupuesto?.label || '—'}</p>
          </div>
          {prioridades.length > 0 && (
            <div className="col-span-2 bg-[#132a4d] rounded-xl p-3 border border-[#5B8FD4]/25">
              <p className="text-[10px] text-[#8b96ab] uppercase tracking-wide mb-1">Prioridades</p>
              <div className="flex gap-2 flex-wrap">
                {prioridades.map(p => (
                  <span key={p.id} className="text-[12px] font-medium text-[#8FB6E8] bg-[#5B8FD4]/10 px-2.5 py-1 rounded-full">
                    {p.icon} {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.notas && (
            <div className="col-span-2 bg-[#132a4d] rounded-xl p-3 border border-[#5B8FD4]/25">
              <p className="text-[10px] text-[#8b96ab] uppercase tracking-wide mb-1">Notas</p>
              <p className="text-[12px] text-[#8b96ab]">{data.notas}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-[#132a4d] border border-[#c9a227]/40 rounded-xl px-4 py-3">
        <span className="text-base mt-0.5">⏱️</span>
        <p className="text-[12px] text-[#ddc06a]">
          El Scout analiza disponibilidad, uso de suelo y precios de mercado. El proceso toma entre <strong>2 y 4 horas</strong>. Te notificaremos al completarse.
        </p>
      </div>
    </div>
  )
}

export default function FlujoB() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL)

  const canAdvance = () => {
    if (step === 1) return data.nombreProyecto.trim() !== ''
    if (step === 2) return data.zonasGeo.length > 0 && data.ciudad !== ''
    if (step === 3) {
      const otroOk = data.tipoDev !== 'otro' || data.tipoOtroTexto.trim() !== ''
      return data.tipoDev !== '' && otroOk
    }
    if (step === 4) return data.superficie !== '' && data.presupuesto !== ''
    if (step === 5) return data.prioridades.length > 0
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
      localStorage.setItem('smt_flujo_b_data', JSON.stringify(data))
      router.push(`/prospeccion/flujo-b/buscando?proyecto=${encodeURIComponent(data.nombreProyecto)}`)
    }
  }

  return (
    <div
      className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex flex-col`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    >
      <header className="sticky top-0 z-20 px-8 py-5 flex items-center gap-3 border-b border-white/10 bg-[#070f22]">
        <div className="w-8 h-8 rounded-lg bg-[#5B8FD4] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#f4f0e6" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#f4f0e6" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] tracking-wide" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 500, color: '#f4f0e6' }}>
            SMT <em style={{ fontStyle: 'normal', color: '#8FB6E8' }}>Developer</em>
          </span>
          <span className="block text-[10px] text-[#8b96ab] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-[#5f6a80]">
          <span className="text-[#5B8FD4] font-medium">Prospección</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="text-[#5B8FD4] font-medium">Flujo B</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Scout IA</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[560px]">
          <ProgressBar step={step} />

          <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] p-8 mb-6 shadow-sm">
            {step === 1 && <Step1 data={data} setData={setData} />}
            {step === 2 && <Step2 data={data} setData={setData} />}
            {step === 3 && <Step3 data={data} setData={setData} />}
            {step === 4 && <Step4 data={data} setData={setData} />}
            {step === 5 && <Step5 data={data} setData={setData} />}
            {step === 6 && <Step6 data={data} />}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-[13px] text-[#8b96ab] hover:text-[#f4f0e6] transition-colors"
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
                  ? 'bg-[#5B8FD4] text-[#f4f0e6] hover:bg-[#8FB6E8] cursor-pointer'
                  : 'bg-[#2a3f5c] text-[#5f6a80] cursor-not-allowed'
              }`}
            >
              {step === TOTAL_STEPS ? 'Activar Scout' : 'Siguiente'}
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
