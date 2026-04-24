'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../providers'

function Badge({ color, children }: { color: 'green' | 'amber' | 'red' | 'blue'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  }[color]
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{children}</span>
}

type Scenario = {
  label: string
  tag: string
  tagColor: 'green' | 'amber' | 'red' | 'blue'
  precioVenta: number
  absorcion: number
  plazo: number
  tir: number
  margen: number
  utilidad: number
  ingresos: number
  inversion: number
  van: number
}

export default function PropuestaPage() {
  const router = useRouter()
  const { terrain, setCurrentStep } = useApp()

  useEffect(() => {
    setCurrentStep(3)
  }, [setCurrentStep])

  const sup = parseFloat(terrain.superficieTotal) || 2500
  const cus = parseFloat(terrain.cus) || 2.5
  const precioTerreno = parseFloat(terrain.precioTotal) || 25_000_000
  const areaVendible = sup * cus * 0.85
  const costoConst = 16_000

  function calcScenario(precioVenta: number, absorcion: number, plazo: number, costoExtra = 0): Omit<Scenario, 'label' | 'tag' | 'tagColor'> {
    const ingresos = precioVenta * areaVendible * (absorcion / 100)
    const costoObra = costoConst * sup * cus
    const inversion = precioTerreno + costoObra * (1 + costoExtra) + ingresos * 0.08
    const utilidad = ingresos - inversion
    const margen = inversion > 0 ? (utilidad / inversion) * 100 : 0
    const plazoAnios = plazo / 12
    const tir = plazoAnios > 0 ? (Math.pow(1 + utilidad / inversion, 1 / plazoAnios) - 1) * 100 : 0
    const van = utilidad / Math.pow(1.12, plazoAnios) - inversion * 0.1
    return { precioVenta, absorcion, plazo, tir, margen, utilidad, ingresos, inversion, van }
  }

  const scenarios: Scenario[] = [
    {
      label: 'Escenario A — Base',
      tag: 'Caso Base',
      tagColor: 'blue',
      ...calcScenario(40_000, 75, 36),
    },
    {
      label: 'Escenario B — Optimista',
      tag: 'Recomendado',
      tagColor: 'green',
      ...calcScenario(46_000, 90, 30),
    },
    {
      label: 'Escenario C — Conservador',
      tag: 'Riesgo Bajo',
      tagColor: 'amber',
      ...calcScenario(34_000, 60, 48, 0.1),
    },
  ]

  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  const risks = [
    {
      categoria: 'Mercado',
      nivel: 'Moderado' as const,
      descripcion: 'Desaceleración en absorción de unidades por ciclo inmobiliario o factores macroeconómicos',
      mitigante: 'Estrategia de preventas desde etapa de proyecto con incentivos del 5% sobre precio lista; meta: 30% vendido antes de inicio de obra',
    },
    {
      categoria: 'Construcción',
      nivel: 'Moderado' as const,
      descripcion: 'Incremento en costo de materiales (acero, concreto) o mano de obra superior al 15% estimado',
      mitigante: 'Contrato a precio alzado con constructora con cláusula de garantía; reserva contingencia del 8% sobre costo de obra',
    },
    {
      categoria: 'Jurídico',
      nivel: terrain.escrituras ? 'Bajo' as const : 'Alto' as const,
      descripcion: terrain.escrituras ? 'Riesgo residual por trámites de licencias y permisos municipales' : 'Indefinición en titularidad — escrituras no disponibles al momento del análisis',
      mitigante: terrain.escrituras
        ? 'Gestoría especializada con experiencia en permisos de la zona; cronograma de trámites con buffers de 45 días'
        : 'Condicionante de compra: formalización de escrituras ante notario como requisito previo al cierre',
    },
    {
      categoria: 'Regulatorio',
      nivel: terrain.docUsoSuelo ? 'Bajo' as const : 'Moderado' as const,
      descripcion: 'Cambio en normativa urbana o restricciones adicionales detectadas en dictamen definitivo',
      mitigante: terrain.docUsoSuelo
        ? 'Constancia de uso de suelo vigente — riesgo acotado a cambios en reglamento de construcción'
        : 'Obtener constancia de uso de suelo como parte de la debida diligencia previa a firma de contrato',
    },
    {
      categoria: 'Financiamiento',
      nivel: 'Bajo' as const,
      descripcion: 'Alza en tasas de interés que afecte costo de crédito puente o capacidad de compra de usuarios finales',
      mitigante: 'Estructura de capital con 40% equity + 60% crédito puente; sensibilidad de TIR ante alza de 200 bps es de –2.1 pp — proyecto sigue viable',
    },
  ]

  const riskColor = (nivel: string) => ({
    'Alto': 'bg-red-100 text-red-700',
    'Moderado': 'bg-amber-100 text-amber-700',
    'Bajo': 'bg-green-100 text-green-700',
  })[nivel] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#085041]/10 text-[#085041]">
              Paso 3 de 3
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Propuesta Ejecutiva</h1>
          <p className="text-gray-500 mt-1 text-sm">Documento para presentación a inversionistas — generado automáticamente.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-[#085041] text-[#085041] rounded-lg text-sm font-medium hover:bg-[#085041]/5 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar PDF
        </button>
      </div>

      <div className="flex flex-col gap-6">

        {/* Portada */}
        <div className="bg-[#085041] rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Documento Confidencial — SMT Developer</p>
              <h2 className="text-3xl font-black mb-1">{terrain.nombre || 'Proyecto Sin Nombre'}</h2>
              {terrain.municipio && (
                <p className="text-white/70 text-base">{terrain.colonia ? `${terrain.colonia}, ` : ''}{terrain.municipio}, {terrain.estado}</p>
              )}

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs mb-1">Superficie</p>
                  <p className="text-xl font-bold">{sup.toLocaleString('es-MX')} m²</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs mb-1">Precio Terreno</p>
                  <p className="text-xl font-bold">${(precioTerreno / 1_000_000).toFixed(1)}M</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs mb-1">Área Vendible</p>
                  <p className="text-xl font-bold">{areaVendible.toLocaleString('es-MX', { maximumFractionDigits: 0 })} m²</p>
                </div>
              </div>
            </div>
            <div className="ml-6 flex-shrink-0 text-right">
              <p className="text-white/40 text-xs">{today}</p>
              <p className="text-white/40 text-xs mt-1">Análisis Mastermind v1.0</p>
              <div className={`mt-4 text-4xl font-black ${scenarios[0].tir >= 20 ? 'text-green-400' : scenarios[0].tir >= 12 ? 'text-amber-400' : 'text-red-400'}`}>
                {scenarios[0].tir.toFixed(1)}%
              </div>
              <p className="text-white/50 text-xs">TIR caso base</p>
            </div>
          </div>
        </div>

        {/* Escenarios A/B/C */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Escenarios de Inversión
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map((s, i) => (
              <div key={i} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${i === 1 ? 'border-[#085041] shadow-[#085041]/10 shadow-lg' : 'border-gray-100'}`}>
                {i === 1 && (
                  <div className="bg-[#085041] py-1.5 text-center">
                    <p className="text-white text-xs font-bold tracking-wide">★ RECOMENDADO</p>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{s.label.split(' — ')[0]}</p>
                      <p className="font-bold text-gray-800 text-sm">{s.label.split(' — ')[1]}</p>
                    </div>
                    <Badge color={s.tagColor}>{s.tag}</Badge>
                  </div>

                  <div className={`text-3xl font-black mb-1 ${s.tir >= 20 ? 'text-green-600' : s.tir >= 12 ? 'text-amber-600' : 'text-red-600'}`}>
                    {s.tir.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-400 mb-4">TIR Anual</p>

                  <div className="space-y-2">
                    {[
                      { label: 'Precio venta', value: `$${(s.precioVenta / 1000).toFixed(0)}k/m²` },
                      { label: 'Absorción', value: `${s.absorcion}%` },
                      { label: 'Plazo', value: `${s.plazo} meses` },
                      { label: 'Margen neto', value: `${s.margen.toFixed(1)}%` },
                      { label: 'Utilidad', value: `$${(s.utilidad / 1_000_000).toFixed(1)}M` },
                      { label: 'VAN', value: `$${(s.van / 1_000_000).toFixed(1)}M` },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-500">{r.label}</span>
                        <span className="text-xs font-semibold text-gray-800">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla financiera comparativa */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10m0 0a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <h3 className="font-semibold text-gray-800 text-sm">Tabla Financiera Comparativa</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Concepto</th>
                  {scenarios.map(s => (
                    <th key={s.label} className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {s.label.split(' — ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { label: 'Precio de venta promedio', format: (s: Scenario) => `$${(s.precioVenta / 1000).toFixed(0)}k/m²` },
                  { label: 'Tasa de absorción', format: (s: Scenario) => `${s.absorcion}%` },
                  { label: 'Plazo del proyecto', format: (s: Scenario) => `${s.plazo} meses` },
                  { label: 'Ingresos totales', format: (s: Scenario) => `$${(s.ingresos / 1_000_000).toFixed(1)}M` },
                  { label: 'Inversión total', format: (s: Scenario) => `$${(s.inversion / 1_000_000).toFixed(1)}M` },
                  { label: 'Utilidad bruta', format: (s: Scenario) => `$${(s.utilidad / 1_000_000).toFixed(1)}M`, bold: true },
                  { label: 'Margen sobre inversión', format: (s: Scenario) => `${s.margen.toFixed(1)}%`, bold: true },
                  { label: 'TIR anual', format: (s: Scenario) => `${s.tir.toFixed(1)}%`, bold: true },
                  { label: 'VAN (tasa 12%)', format: (s: Scenario) => `$${(s.van / 1_000_000).toFixed(1)}M` },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className={`px-6 py-3 text-gray-600 ${row.bold ? 'font-semibold text-gray-800' : ''}`}>{row.label}</td>
                    {scenarios.map((s, j) => (
                      <td key={j} className={`px-6 py-3 text-right ${row.bold ? 'font-bold text-[#085041]' : 'text-gray-700'}`}>
                        {row.format(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Riesgos y mitigantes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="font-semibold text-gray-800 text-sm">Matriz de Riesgos y Mitigantes</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {risks.map((r, i) => (
              <div key={i} className="px-6 py-4 grid grid-cols-12 gap-4">
                <div className="col-span-2 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-700">{r.categoria}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full text-center ${riskColor(r.nivel)}`}>{r.nivel}</span>
                </div>
                <div className="col-span-5">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Riesgo</p>
                  <p className="text-sm text-gray-700">{r.descripcion}</p>
                </div>
                <div className="col-span-5">
                  <p className="text-xs text-[#085041] font-medium uppercase tracking-wide mb-1">Mitigante</p>
                  <p className="text-sm text-gray-700">{r.mitigante}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debida diligencia */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#085041]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Lista de Debida Diligencia
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                cat: 'Jurídico',
                items: [
                  { label: 'Escrituras notariales', done: terrain.escrituras },
                  { label: 'Libertad de gravamen', done: false },
                  { label: 'Alineamiento y número oficial', done: false },
                  { label: 'No adeudo predial', done: false },
                ],
              },
              {
                cat: 'Técnico',
                items: [
                  { label: 'Plano catastral', done: terrain.planoCatastral },
                  { label: 'Constancia uso de suelo', done: terrain.docUsoSuelo },
                  { label: 'Estudio de suelo', done: false },
                  { label: 'Factibilidad de servicios', done: terrain.agua && terrain.electricidad },
                ],
              },
              {
                cat: 'Financiero',
                items: [
                  { label: 'Avalúo comercial', done: false },
                  { label: 'Análisis de mercado', done: true },
                  { label: 'Proyección financiera', done: true },
                  { label: 'Estructura de capital', done: false },
                ],
              },
            ].map(col => (
              <div key={col.cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{col.cat}</p>
                <div className="space-y-2">
                  {col.items.map((item, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#085041]' : 'border-2 border-gray-200'}`}>
                        {item.done && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs ${item.done ? 'text-gray-600' : 'text-gray-400'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-xs text-amber-700 font-medium">
              {[terrain.escrituras, terrain.planoCatastral, terrain.docUsoSuelo, terrain.agua && terrain.electricidad, true, true].filter(Boolean).length} de 12 documentos / verificaciones completados —
              complete la debida diligencia antes de formalizar la operación.
            </p>
          </div>
        </div>

        {/* Footer navigation */}
        <div className="flex justify-between items-center pb-8">
          <button
            onClick={() => router.push('/analisis')}
            className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            ← Regresar al Análisis
          </button>
          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 border border-[#085041] text-[#085041] rounded-lg text-sm font-medium hover:bg-[#085041]/5 transition-colors">
              Compartir enlace
            </button>
            <button className="px-5 py-2.5 bg-[#085041] text-white rounded-lg text-sm font-medium hover:bg-[#063d31] transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
