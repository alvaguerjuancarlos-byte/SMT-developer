'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../providers'

type Agent = {
  id: string
  name: string
  status: 'complete' | 'running' | 'pending'
  summary: string
  details: string[]
  score: number
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  const color = score >= 70 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  )
}

function Slider({
  label, min, max, value, step = 1, format, onChange
}: {
  label: string; min: number; max: number; value: number; step?: number; format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-[#085041] bg-[#085041]/10 px-2 py-0.5 rounded-md">{format(value)}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-16 text-right">{format(min)}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none bg-gray-200 cursor-pointer"
        />
        <span className="text-xs text-gray-400 w-16">{format(max)}</span>
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false)

  const statusColor = {
    complete: 'bg-green-100 text-green-700',
    running: 'bg-blue-100 text-blue-700',
    pending: 'bg-gray-100 text-gray-500',
  }[agent.status]

  const statusLabel = { complete: 'Completado', running: 'Ejecutando...', pending: 'Pendiente' }[agent.status]

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${agent.status === 'complete' ? 'bg-green-400' : agent.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-gray-300'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-gray-800">{agent.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
          </div>
          <p className="text-xs text-gray-500 truncate">{agent.summary}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-400">Score</p>
            <p className={`text-sm font-bold ${agent.score >= 70 ? 'text-green-600' : agent.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {agent.score}/100
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50/30">
          <div className="pt-4 space-y-3">
            {agent.details.map((d, i) => (
              <div key={i} className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#085041] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <p className="text-sm text-gray-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function fmt$(v: number) { return '$' + v.toLocaleString('es-MX') }
function fmtPct(v: number) { return v.toFixed(1) + '%' }
function fmtMes(v: number) { return v + ' meses' }

export default function AnalisisPage() {
  const router = useRouter()
  const { terrain, currentStep, setCurrentStep } = useApp()

  useEffect(() => {
    setCurrentStep(2)
  }, [setCurrentStep])

  const sup = parseFloat(terrain.superficieTotal) || 2500
  const precioTerreno = parseFloat(terrain.precioTotal) || 25_000_000
  const cus = parseFloat(terrain.cus) || 2.5

  const [precioVenta, setPrecioVenta] = useState(40_000)
  const [absorcion, setAbsorcion] = useState(75)
  const [costoConst, setCostoConst] = useState(16_000)
  const [plazo, setPlazo] = useState(36)
  const [tasaDesc, setTasaDesc] = useState(12)

  const metricas = useMemo(() => {
    const areaVendible = sup * cus * 0.85
    const ingresos = precioVenta * areaVendible * (absorcion / 100)
    const costoObra = costoConst * sup * cus
    const costoTotal = precioTerreno + costoObra + ingresos * 0.08
    const utilidad = ingresos - costoTotal
    const margen = costoTotal > 0 ? (utilidad / costoTotal) * 100 : 0
    const plazoAnios = plazo / 12
    const tir = plazoAnios > 0 ? (Math.pow(1 + utilidad / costoTotal, 1 / plazoAnios) - 1) * 100 : 0
    const van = utilidad / Math.pow(1 + tasaDesc / 100, plazoAnios) - costoTotal * 0.1

    const rawScore = Math.min(100, Math.max(0, tir * 2.5 + absorcion * 0.3 + 20))
    const score = Math.round(rawScore)

    return { areaVendible, ingresos, costoObra, costoTotal, utilidad, margen, tir, van, score }
  }, [sup, precioTerreno, cus, precioVenta, absorcion, costoConst, plazo, tasaDesc])

  const agents: Agent[] = [
    {
      id: 'mercado',
      name: 'Agente de Mercado',
      status: 'complete',
      summary: `Análisis de comparables: ${terrain.municipio || 'zona'} — ${terrain.usoSuelo || 'Uso mixto'}`,
      score: Math.min(100, Math.round(metricas.score * 0.95 + 5)),
      details: [
        `Precio de oferta en zona: $${(precioVenta * 0.9).toLocaleString('es-MX')} – $${(precioVenta * 1.1).toLocaleString('es-MX')} /m²`,
        `Tasa de absorción histórica en la zona: ${(absorcion - 10).toFixed(0)}% – ${Math.min(100, absorcion + 10).toFixed(0)}% semestral`,
        `Inventario activo en radio 1km: 4 proyectos comparables detectados`,
        `Tendencia de precios: alza moderada del 6–8% anual en los últimos 24 meses`,
        `Perfil de demanda predominante: NSE B/B+ — unidades 70–120 m²`,
      ],
    },
    {
      id: 'regulacion',
      name: 'Agente de Regulación',
      status: 'complete',
      summary: `CUS ${terrain.cus || '2.5'} / COS ${terrain.cos || '0.6'} — ${terrain.usoSuelo || 'Por confirmar'}`,
      score: terrain.escrituras && terrain.planoCatastral ? 88 : 62,
      details: [
        `Uso de suelo: ${terrain.usoSuelo || 'Habitacional Mixto'} — compatible con desarrollo vertical`,
        `CUS aplicable: ${terrain.cus || '2.5'} | COS: ${terrain.cos || '0.6'} | Niveles: ${terrain.nivelesMax || '8'}`,
        `Área máxima de construcción: ${(sup * (parseFloat(terrain.cus) || 2.5)).toLocaleString('es-MX')} m² brutos`,
        terrain.escrituras ? '✓ Escrituras disponibles — situación jurídica clara' : '⚠ Sin escrituras — revisar situación jurídica',
        terrain.docUsoSuelo ? '✓ Constancia de uso de suelo disponible' : '⚠ Pendiente constancia de uso de suelo',
        `Restricciones identificadas: restricción vial frontal 3m, cajones: 1.2 por unidad`,
      ],
    },
    {
      id: 'financiero',
      name: 'Agente Financiero',
      status: 'complete',
      summary: `TIR proyectada: ${metricas.tir.toFixed(1)}% | Margen: ${metricas.margen.toFixed(1)}%`,
      score: Math.min(100, Math.round(metricas.tir * 2 + 20)),
      details: [
        `Inversión total estimada: $${metricas.costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,
        `Ingresos proyectados (${absorcion}% absorción): $${metricas.ingresos.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,
        `Utilidad bruta: $${metricas.utilidad.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,
        `TIR anual: ${metricas.tir.toFixed(2)}% — ${metricas.tir >= 20 ? 'ATRACTIVA' : metricas.tir >= 12 ? 'ACEPTABLE' : 'BAJA'}`,
        `Punto de equilibrio: ${(metricas.costoTotal / (precioVenta * metricas.areaVendible / 100)).toFixed(0)}% de absorción`,
        `VAN (tasa ${tasaDesc}%): $${metricas.van.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,
      ],
    },
    {
      id: 'riesgo',
      name: 'Agente de Riesgo',
      status: 'complete',
      summary: `Riesgo ${metricas.score >= 70 ? 'BAJO' : metricas.score >= 50 ? 'MODERADO' : 'ALTO'} — ${3 - [terrain.agua, terrain.drenaje, terrain.electricidad].filter(Boolean).length} servicios faltantes`,
      score: metricas.score >= 70 ? 80 : metricas.score >= 50 ? 58 : 38,
      details: [
        `Riesgo de mercado: ${metricas.tir >= 20 ? 'BAJO' : 'MODERADO'} — sensibilidad precio ±10% impacta TIR en ${(metricas.tir * 0.18).toFixed(1)} pp`,
        `Riesgo regulatorio: ${terrain.docUsoSuelo ? 'BAJO' : 'MODERADO'} — uso de suelo ${terrain.docUsoSuelo ? 'confirmado' : 'pendiente de verificación'}`,
        `Riesgo de construcción: MODERADO — estimado de costos con ±15% de variación`,
        `Riesgo de liquidez: ${plazo <= 30 ? 'BAJO' : 'MODERADO'} — plazo de ${plazo} meses con absorción ${absorcion}%`,
        `Riesgo jurídico: ${terrain.escrituras ? 'BAJO' : 'ALTO'} — ${terrain.escrituras ? 'documentación completa' : 'escrituras no disponibles'}`,
        `Score de riesgo compuesto: ${metricas.score >= 70 ? '🟢 Bajo' : metricas.score >= 50 ? '🟡 Moderado' : '🔴 Alto'}`,
      ],
    },
    {
      id: 'propuesta',
      name: 'Agente de Propuesta',
      status: currentStep >= 2 ? 'complete' : 'pending',
      summary: 'Generación de documento ejecutivo para inversionistas',
      score: metricas.score,
      details: [
        'Documento ejecutivo con escenarios A/B listos para exportar',
        `Escenario A (base): TIR ${metricas.tir.toFixed(1)}% — absorción ${absorcion}%`,
        `Escenario B (optimista): TIR ${(metricas.tir * 1.25).toFixed(1)}% — precio venta +15%`,
        `Escenario C (conservador): TIR ${(metricas.tir * 0.75).toFixed(1)}% — absorción ${(absorcion * 0.8).toFixed(0)}%`,
        'Riesgos con mitigantes documentados — lista de debida diligencia',
        'Tabla financiera comparativa de 3 escenarios lista para presentación',
      ],
    },
  ]

  const scoreColor = metricas.score >= 70 ? 'text-green-400' : metricas.score >= 50 ? 'text-amber-400' : 'text-red-400'
  const scoreLabel = metricas.score >= 70 ? 'PROYECTO VIABLE' : metricas.score >= 50 ? 'REVISAR SUPUESTOS' : 'RIESGO ELEVADO'

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#085041]/10 text-[#085041]">
              Paso 2 de 3
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Análisis</h1>
          <p className="text-gray-500 mt-1 text-sm">Ajuste los supuestos financieros y revise el diagnóstico de cada agente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left col: Score hero + KPIs + Sliders */}
        <div className="lg:col-span-1 flex flex-col gap-5">

          {/* Mastermind score hero */}
          <div className="bg-[#085041] rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/70">Score Mastermind</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className={`text-6xl font-black ${scoreColor} leading-none`}>{metricas.score}</div>
                <div className="text-white/40 text-sm mt-1">/ 100 puntos</div>
                <div className={`mt-3 text-sm font-bold ${scoreColor}`}>{scoreLabel}</div>
              </div>
              <div className="relative">
                <ScoreRing score={metricas.score} size={110} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xl font-black ${scoreColor}`}>{metricas.score}%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
              <div>
                <p className="text-white/50 text-xs">TIR Anual</p>
                <p className={`text-lg font-bold ${metricas.tir >= 20 ? 'text-green-400' : metricas.tir >= 12 ? 'text-amber-400' : 'text-red-400'}`}>
                  {metricas.tir.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Margen Neto</p>
                <p className={`text-lg font-bold ${metricas.margen >= 25 ? 'text-green-400' : metricas.margen >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                  {metricas.margen.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Utilidad Bruta</p>
                <p className="text-sm font-semibold text-white/80">
                  ${(metricas.utilidad / 1_000_000).toFixed(1)}M
                </p>
              </div>
              <div>
                <p className="text-white/50 text-xs">VAN</p>
                <p className={`text-sm font-semibold ${metricas.van >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  ${(metricas.van / 1_000_000).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>

          {/* KPIs financieros */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              KPIs del Proyecto
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Inversión Total', value: `$${(metricas.costoTotal / 1_000_000).toFixed(1)}M`, sub: 'terreno + obra + indirectos', color: 'text-blue-600' },
                { label: 'Ingresos Proyectados', value: `$${(metricas.ingresos / 1_000_000).toFixed(1)}M`, sub: `${absorcion}% absorción`, color: 'text-indigo-600' },
                { label: 'Área Vendible', value: `${metricas.areaVendible.toLocaleString('es-MX', { maximumFractionDigits: 0 })} m²`, sub: `CUS ${cus} × efic. 85%`, color: 'text-purple-600' },
                { label: 'Precio Terreno / m² const.', value: `$${(precioTerreno / metricas.areaVendible).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, sub: 'incidencia en área vendible', color: 'text-amber-600' },
              ].map(k => (
                <div key={k.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-gray-600">{k.label}</p>
                    <p className="text-xs text-gray-400">{k.sub}</p>
                  </div>
                  <span className={`text-sm font-bold ${k.color}`}>{k.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col: Sliders + Agents */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Sliders de supuestos */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-700">Supuestos Financieros</h3>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Recalcula automáticamente</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Slider label="Precio de venta" min={15000} max={80000} step={1000} value={precioVenta} format={v => `$${(v / 1000).toFixed(0)}k/m²`} onChange={setPrecioVenta} />
              <Slider label="Tasa de absorción" min={10} max={100} value={absorcion} format={fmtPct} onChange={setAbsorcion} />
              <Slider label="Costo de construcción" min={8000} max={30000} step={500} value={costoConst} format={v => `$${(v / 1000).toFixed(1)}k/m²`} onChange={setCostoConst} />
              <Slider label="Plazo del proyecto" min={12} max={72} step={6} value={plazo} format={fmtMes} onChange={setPlazo} />
              <Slider label="Tasa de descuento (WACC)" min={6} max={25} step={0.5} value={tasaDesc} format={fmtPct} onChange={setTasaDesc} />
            </div>

            {/* Sensitivity summary */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Peor caso (-20%)</p>
                <p className="text-sm font-bold text-red-500">{(metricas.tir * 0.7).toFixed(1)}% TIR</p>
              </div>
              <div className="bg-[#085041]/5 rounded-lg p-3 text-center border border-[#085041]/10">
                <p className="text-xs text-[#085041] mb-1 font-medium">Caso base</p>
                <p className="text-sm font-bold text-[#085041]">{metricas.tir.toFixed(1)}% TIR</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Mejor caso (+20%)</p>
                <p className="text-sm font-bold text-green-600">{(metricas.tir * 1.3).toFixed(1)}% TIR</p>
              </div>
            </div>
          </div>

          {/* 5 agentes colapsables */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-700">Diagnóstico de Agentes</h3>
              <span className="ml-auto text-xs text-gray-400">{agents.filter(a => a.status === 'complete').length}/{agents.length} completados</span>
            </div>
            <div className="space-y-3">
              {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
            </div>
          </div>

          {/* CTA */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.push('/prospeccion')}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ← Regresar
            </button>
            <button
              onClick={() => { setCurrentStep(3); router.push('/propuesta') }}
              className="px-5 py-2.5 bg-[#085041] text-white rounded-lg text-sm font-medium hover:bg-[#063d31] transition-colors flex items-center gap-2"
            >
              Generar Propuesta
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
