'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CIUDADES = [
  'Monterrey', 'San Pedro Garza García', 'Guadalupe', 'San Nicolás de los Garza',
  'Escobedo', 'Apodaca', 'Santa Catarina', 'García',
  'Ciudad de México', 'Guadalajara', 'Querétaro', 'León', 'Tijuana', 'Mérida',
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

interface FormData {
  ciudad: string
  zona: string
  tipoDev: string
  superficie: string
  presupuesto: string
  prioridades: string[]
  notas: string
}

const INITIAL: FormData = {
  ciudad: '',
  zona: '',
  tipoDev: '',
  superficie: '',
  presupuesto: '',
  prioridades: [],
  notas: '',
}

const TOTAL_STEPS = 5

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
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">¿En qué ciudad quieres buscar?</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">El Scout enfocará su búsqueda en el mercado que elijas.</p>

      <div className="mb-4">
        <label className="block text-[12px] text-[#5a7065] mb-2">Ciudad</label>
        <select
          value={data.ciudad}
          onChange={e => setData({ ...data, ciudad: e.target.value })}
          className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 appearance-none cursor-pointer"
        >
          <option value="">Selecciona una ciudad…</option>
          {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[12px] text-[#5a7065] mb-2">
          Zona o colonia preferida <span className="text-[#9aab9f]">(opcional)</span>
        </label>
        <input
          type="text"
          placeholder="Ej. Valle Oriente, Cumbres, San Jerónimo…"
          value={data.zona}
          onChange={e => setData({ ...data, zona: e.target.value })}
          className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb]"
        />
        <p className="text-[11px] text-[#9aab9f] mt-2">Si dejas esto vacío, el Scout buscará en toda la ciudad.</p>
      </div>
    </div>
  )
}

function Step2({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">¿Qué tipo de desarrollo tienes en mente?</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">El Scout filtrará terrenos con el uso de suelo adecuado.</p>

      <div className="grid grid-cols-2 gap-3">
        {TIPOS_DESARROLLO.map(t => (
          <ChipOption key={t.id} selected={data.tipoDev === t.id} onClick={() => setData({ ...data, tipoDev: t.id })}>
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">{t.icon}</span>
              <div>
                <p className="text-[13px] font-semibold text-[#111d17] leading-snug">{t.label}</p>
                <p className="text-[11px] text-[#7a9089] mt-0.5">{t.desc}</p>
              </div>
            </div>
          </ChipOption>
        ))}
      </div>
    </div>
  )
}

function Step3({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Superficie y presupuesto</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Define los rangos para que el Scout descarte terrenos fuera de tu parámetro.</p>

      <div className="mb-6">
        <p className="text-[13px] font-semibold text-[#111d17] mb-3">Superficie del terreno</p>
        <div className="grid grid-cols-2 gap-2">
          {RANGOS_SUPERFICIE.map(r => (
            <ChipOption key={r.id} selected={data.superficie === r.id} onClick={() => setData({ ...data, superficie: r.id })}>
              <p className="text-[13px] text-[#111d17] font-medium">{r.label}</p>
            </ChipOption>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-semibold text-[#111d17] mb-3">Presupuesto de adquisición</p>
        <div className="grid grid-cols-2 gap-2">
          {RANGOS_PRESUPUESTO.map(r => (
            <ChipOption key={r.id} selected={data.presupuesto === r.id} onClick={() => setData({ ...data, presupuesto: r.id })}>
              <p className="text-[13px] text-[#111d17] font-medium">{r.label}</p>
            </ChipOption>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step4({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
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
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">¿Cuáles son tus prioridades?</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Elige hasta 2. El Scout ponderará los resultados según lo que más te importa.</p>

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
                  ? 'bg-white border-[#1D9E75] shadow-[0_0_0_2px_#1D9E75]'
                  : disabled
                  ? 'bg-[#F7F8F6] border-[#E2E8E4] opacity-40 cursor-not-allowed'
                  : 'bg-white border-[#E2E8E4] hover:border-[#9FE1CB]'
              }`}
            >
              <span className="text-2xl block mb-2">{p.icon}</span>
              <p className="text-[13px] font-semibold text-[#111d17]">{p.label}</p>
            </button>
          )
        })}
      </div>

      <div>
        <label className="block text-[12px] text-[#5a7065] mb-2">
          Contexto adicional <span className="text-[#9aab9f]">(opcional)</span>
        </label>
        <textarea
          rows={3}
          placeholder="Ej. Buscamos algo para clase media-alta, con acceso a vía rápida, preferentemente esquina…"
          value={data.notas}
          onChange={e => setData({ ...data, notas: e.target.value })}
          className="w-full border border-[#E2E8E4] rounded-xl px-4 py-3 text-[14px] text-[#111d17] bg-white focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 placeholder:text-[#c5d0cb] resize-none"
        />
      </div>
    </div>
  )
}

function Step5({ data }: { data: FormData }) {
  const tipo = TIPOS_DESARROLLO.find(t => t.id === data.tipoDev)
  const superficie = RANGOS_SUPERFICIE.find(r => r.id === data.superficie)
  const presupuesto = RANGOS_PRESUPUESTO.find(r => r.id === data.presupuesto)
  const prioridades = PRIORIDADES.filter(p => data.prioridades.includes(p.id))

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1D9E75] tracking-[0.12em] uppercase mb-2">Scout IA · Flujo B</p>
      <h2 className="text-[24px] font-semibold text-[#111d17] mb-2">Resumen de tu búsqueda</h2>
      <p className="text-[14px] text-[#5a7065] mb-6">Confirma los parámetros antes de activar el Scout.</p>

      <div className="rounded-2xl border border-[#1D9E75]/30 bg-[#F0FBF6] p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1D9E75] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="1.8"/>
              <path d="M16.5 16.5L21 21" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M8 11H14M11 8V14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#0F6E56]">Scout listo para activarse</p>
            <p className="text-[11px] text-[#5a9078]">El análisis iniciará en cuanto confirmes</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 border border-[#D4EFE3]">
            <p className="text-[10px] text-[#7aaa90] uppercase tracking-wide mb-1">Ciudad</p>
            <p className="text-[13px] font-semibold text-[#111d17]">{data.ciudad || '—'}</p>
            {data.zona && <p className="text-[11px] text-[#5a7065] mt-0.5">{data.zona}</p>}
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#D4EFE3]">
            <p className="text-[10px] text-[#7aaa90] uppercase tracking-wide mb-1">Tipo de desarrollo</p>
            <p className="text-[13px] font-semibold text-[#111d17]">{tipo ? `${tipo.icon} ${tipo.label}` : '—'}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#D4EFE3]">
            <p className="text-[10px] text-[#7aaa90] uppercase tracking-wide mb-1">Superficie</p>
            <p className="text-[13px] font-semibold text-[#111d17]">{superficie?.label || '—'}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#D4EFE3]">
            <p className="text-[10px] text-[#7aaa90] uppercase tracking-wide mb-1">Presupuesto</p>
            <p className="text-[13px] font-semibold text-[#111d17]">{presupuesto?.label || '—'}</p>
          </div>
          {prioridades.length > 0 && (
            <div className="col-span-2 bg-white rounded-xl p-3 border border-[#D4EFE3]">
              <p className="text-[10px] text-[#7aaa90] uppercase tracking-wide mb-1">Prioridades</p>
              <div className="flex gap-2 flex-wrap">
                {prioridades.map(p => (
                  <span key={p.id} className="text-[12px] font-medium text-[#0F6E56] bg-[#E1F5EE] px-2.5 py-1 rounded-full">
                    {p.icon} {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.notas && (
            <div className="col-span-2 bg-white rounded-xl p-3 border border-[#D4EFE3]">
              <p className="text-[10px] text-[#7aaa90] uppercase tracking-wide mb-1">Notas</p>
              <p className="text-[12px] text-[#5a7065]">{data.notas}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-[#FFF8E6] border border-[#F0D070] rounded-xl px-4 py-3">
        <span className="text-base mt-0.5">⏱️</span>
        <p className="text-[12px] text-[#7a6020]">
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
    if (step === 1) return data.ciudad !== ''
    if (step === 2) return data.tipoDev !== ''
    if (step === 3) return data.superficie !== '' && data.presupuesto !== ''
    if (step === 4) return data.prioridades.length > 0
    return true
  }

  const handleBack = () => {
    if (step === 1) router.push('/prospeccion')
    else setStep(s => s - 1)
  }

  const handleNext = () => {
    if (!canAdvance()) return
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else router.push('/prospeccion/flujo-b/buscando')
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
          <span className="text-[#1D9E75] font-medium">Flujo B</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Scout IA</span>
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
