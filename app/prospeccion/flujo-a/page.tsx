'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CIUDADES = [
  'Monterrey', 'San Pedro Garza García', 'Guadalupe', 'San Nicolás de los Garza',
  'Escobedo', 'Apodaca', 'Santa Catarina', 'García',
  'Ciudad de México', 'Guadalajara', 'Querétaro', 'León', 'Tijuana', 'Mérida',
]

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

const TIPOS_DESARROLLO = [
  { id: 'residencial-vertical', label: 'Residencial vertical', icon: '🏢' },
  { id: 'residencial-horizontal', label: 'Residencial horizontal', icon: '🏘️' },
  { id: 'comercial', label: 'Comercial', icon: '🏪' },
  { id: 'mixto', label: 'Uso mixto', icon: '🏗️' },
  { id: 'industrial', label: 'Industrial / Nave', icon: '🏭' },
  { id: 'no-definido', label: 'Aún no lo sé', icon: '💡' },
]

interface FormData {
  direccion: string
  ciudad: string
  colonia: string
  mapsLink: string
  superficie: string
  usoSuelo: string
  estadoTerreno: string
  presupuesto: string
  tiposDesarrollo: string[]
}

const INITIAL: FormData = {
  direccion: '',
  ciudad: '',
  colonia: '',
  mapsLink: '',
  superficie: '',
  usoSuelo: '',
  estadoTerreno: '',
  presupuesto: '',
  tiposDesarrollo: [],
}

const TOTAL_STEPS = 4

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
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Ubicación del terreno</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Ingresa la dirección del predio que quieres analizar.</p>

      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel>Calle y número</FieldLabel>
          <TextInput
            value={data.direccion}
            onChange={v => setData({ ...data, direccion: v })}
            placeholder="Ej. Av. Vasconcelos 300, Pte."
          />
        </div>
        <div>
          <FieldLabel>Ciudad</FieldLabel>
          <SelectInput
            value={data.ciudad}
            onChange={v => setData({ ...data, ciudad: v })}
            options={CIUDADES.map(c => ({ id: c, label: c }))}
            placeholder="Selecciona una ciudad…"
          />
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
          <FieldLabel optional>Link de Google Maps</FieldLabel>
          <TextInput
            value={data.mapsLink}
            onChange={v => setData({ ...data, mapsLink: v })}
            placeholder="https://maps.google.com/…"
          />
          <p className="text-[11px] text-[#9aab9f] mt-2">Pega el enlace para que los agentes localicen el predio con mayor precisión.</p>
        </div>
      </div>
    </div>
  )
}

function Step2({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
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
      </div>
    </div>
  )
}

function Step3({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
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

function Step4({ data }: { data: FormData }) {
  const usoSuelo = USOS_SUELO.find(u => u.id === data.usoSuelo)
  const estado = ESTADOS_TERRENO.find(e => e.id === data.estadoTerreno)
  const presupuesto = RANGOS_PRESUPUESTO.find(r => r.id === data.presupuesto)
  const tipos = TIPOS_DESARROLLO.filter(t => data.tiposDesarrollo.includes(t.id))

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Flujo A · Captura</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Resumen del terreno</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Confirma los datos antes de iniciar el análisis.</p>

      <div className="rounded-2xl border border-[#1D9E75]/30 bg-[#F0FBF6] p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1D9E75] flex items-center justify-center">
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

        <div className="bg-white rounded-xl border border-[#D4EFE3] px-4 divide-y divide-[#F0F4F2]">
          <SummaryRow label="Dirección" value={data.direccion} />
          <SummaryRow label="Ciudad" value={data.ciudad} />
          <SummaryRow label="Colonia" value={data.colonia} />
          {data.mapsLink && <SummaryRow label="Maps" value={
            <a href={data.mapsLink} target="_blank" rel="noopener noreferrer" className="text-[#1D9E75] underline underline-offset-2 text-[12px]">Ver enlace</a>
          } />}
          <SummaryRow label="Superficie" value={data.superficie ? `${Number(data.superficie).toLocaleString('es-MX')} m²` : ''} />
          <SummaryRow label="Uso de suelo" value={usoSuelo?.label} />
          <SummaryRow label="Estado" value={estado?.label} />
          <SummaryRow label="Presupuesto" value={presupuesto?.label} />
          <SummaryRow
            label="Desarrollo"
            value={tipos.length > 0
              ? tipos.map(t => `${t.icon} ${t.label}`).join(' · ')
              : undefined
            }
          />
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
    if (step === 1) return data.direccion.trim() !== '' && data.ciudad !== '' && data.colonia.trim() !== ''
    if (step === 2) return data.superficie !== '' && data.usoSuelo !== '' && data.estadoTerreno !== ''
    if (step === 3) return data.presupuesto !== '' && data.tiposDesarrollo.length > 0
    return true
  }

  const handleBack = () => {
    if (step === 1) router.push('/prospeccion')
    else setStep(s => s - 1)
  }

  const handleNext = () => {
    if (!canAdvance()) return
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else router.push('/analisis')
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
            {step === 4 && <Step4 data={data} />}
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
