'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function CheckIcon({ color = '#1D9E75' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7l3 3 6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold text-[#9aab9f] tracking-[0.12em] uppercase mb-4">{children}</h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-6 ${className}`}>
      {children}
    </div>
  )
}

function MetricRow({ label, value, valueClass = 'text-[#111d17]', border = true }: {
  label: string
  value: React.ReactNode
  valueClass?: string
  border?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${border ? 'border-b border-[#F0F4F2]' : ''} last:border-0`}>
      <p className="text-[13px] text-[#5a7065]">{label}</p>
      <p className={`text-[13px] font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

function ScoreGauge({ score }: { score: number }) {
  // Arc: M 16 74 A 54 54 0 0 1 124 74  →  cx=70 cy=74 r=54
  // Stroke top: cy - r - strokeWidth/2 = 74 - 54 - 6 = 14px from SVG top  ✓ no overflow
  const r = 54
  const circ = Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#1D9E75' : score >= 50 ? '#D97706' : '#DC2626'
  const label = score >= 70 ? 'Proyecto Viable' : score >= 50 ? 'Revisar Supuestos' : 'Riesgo Elevado'
  const labelColor = score >= 70 ? 'text-[#0F6E56]' : score >= 50 ? 'text-[#92600A]' : 'text-red-700'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 90 }}>
        <svg width="140" height="90" viewBox="0 0 140 90" fill="none">
          <path d="M 16 74 A 54 54 0 0 1 124 74"
            stroke="#F0F4F2" strokeWidth="12" strokeLinecap="round" fill="none"/>
          <path d="M 16 74 A 54 54 0 0 1 124 74"
            stroke={color} strokeWidth="12" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1">
          <span className="text-[32px] font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[11px] text-[#9aab9f]">/ 100</span>
        </div>
      </div>
      <span className={`text-[12px] font-bold mt-2 ${labelColor}`}>{label}</span>
    </div>
  )
}

function StressCard({ title, scenario, tirImpact, status }: {
  title: string
  scenario: string
  tirImpact: string
  status: 'green' | 'amber' | 'red'
}) {
  const colors = {
    green: { bg: 'bg-[#F0FBF6]', border: 'border-[#9FE1CB]', badge: 'bg-[#E1F5EE] text-[#0F6E56]', dot: '#1D9E75' },
    amber: { bg: 'bg-[#FFFBEB]', border: 'border-[#F5D97A]', badge: 'bg-[#FEF3C7] text-[#92600A]', dot: '#D97706' },
    red:   { bg: 'bg-[#FFF5F5]', border: 'border-[#FECACA]', badge: 'bg-[#FEE2E2] text-[#991B1B]', dot: '#DC2626' },
  }
  const c = colors[status]

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
          <p className="text-[13px] font-bold text-[#111d17]">{title}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
          {status === 'green' ? 'Tolerable' : status === 'amber' ? 'Monitorear' : 'Crítico'}
        </span>
      </div>
      <p className="text-[12px] text-[#5a7065] mb-3">{scenario}</p>
      <p className="text-[13px] font-semibold text-[#111d17]">{tirImpact}</p>
    </div>
  )
}

function AnalisisContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || 'Proyecto sin nombre'

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center gap-3 border-b border-[#E2E8E4] bg-white sticky top-0 z-10">
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
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[13px] text-[#5a7065] hover:text-[#111d17] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-[780px] mx-auto flex flex-col gap-8">

          {/* 1 · Hero banner */}
          <div className="bg-[#111d17] rounded-2xl p-7 text-white">
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75] text-white px-3 py-1 rounded-full mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Análisis Completado
                </span>
                <h1 className="text-[26px] font-bold text-white leading-tight">{proyecto}</h1>
                <p className="text-[13px] text-white/50 mt-1">Reporte de inversión · Flujo A · Monterrey, N.L.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/10">
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">TIR Proyectada</p>
                <p className="text-[28px] font-black text-[#4ade80]">22.4%</p>
                <p className="text-[11px] text-white/40">anual</p>
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">Inversión Total</p>
                <p className="text-[28px] font-black text-white">$45.2 M</p>
                <p className="text-[11px] text-white/40">MXN</p>
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">Score Resiliencia</p>
                <p className="text-[28px] font-black text-[#4ade80]">78</p>
                <p className="text-[11px] text-white/40">/ 100</p>
              </div>
            </div>
          </div>

          {/* 2 · Recomendación Principal */}
          <div>
            <SectionTitle>Recomendación Principal</SectionTitle>
            <div className="bg-[#F0FBF6] border border-[#1D9E75]/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1D9E75] flex items-center justify-center shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8"/>
                    <path d="M3 9h18M9 21V9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#1D9E75] tracking-[0.12em] uppercase mb-1">Tipología recomendada</p>
                  <h3 className="text-[20px] font-bold text-[#111d17] mb-2">Residencial Vertical · 48 departamentos</h3>
                  <p className="text-[14px] text-[#5a7065] leading-relaxed">
                    Con base en el análisis normativo (CUS 2.4, 12 niveles permitidos), la demanda activa en Valle Oriente y el perfil de comprador NSE A/B de 28–45 años, la tipología óptima es un edificio de departamentos de 2 y 3 recámaras en rangos de 85–120 m². Esta configuración maximiza el área vendible, logra la absorción proyectada de 8 unidades/mes y produce una TIR del <strong>22.4%</strong> con margen bruto del <strong>31.2%</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 · Ficha Legal */}
          <div>
            <SectionTitle>Ficha Legal y Normativa</SectionTitle>
            <Card>
              <div className="grid grid-cols-2 gap-x-8">
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Uso de suelo" value="Habitacional Plurifamiliar" />
                  <MetricRow label="COS permitido" value="60%" />
                  <MetricRow label="CUS" value="2.4" />
                </div>
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Altura máxima" value="12 niveles" />
                  <MetricRow label="Cajones por unidad" value="1.2" />
                  <MetricRow label="Municipio" value="San Pedro Garza García" />
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 bg-[#FFFBEB] border border-[#F5D97A] rounded-xl px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                  <path d="M7 2L12.5 11.5H1.5L7 2Z" stroke="#D97706" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M7 6v3" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="10" r="0.5" fill="#D97706"/>
                </svg>
                <p className="text-[12px] text-[#92600A]"><strong>Restricción:</strong> Retiro mínimo de 5 m frente a vialidad primaria. Impacta área de planta baja.</p>
              </div>
            </Card>
          </div>

          {/* 4 · Estimación de Costos */}
          <div>
            <SectionTitle>Estimación de Costos e Ingresos</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <tbody>
                  {[
                    { label: 'Costo del terreno', value: '$8,500,000', sub: '$7,083/m² · 1,200 m²', highlight: false },
                    { label: 'Construcción por m²', value: '$16,500/m²', sub: 'Clase media-alta, acabados premium', highlight: false },
                    { label: 'Costo total construcción', value: '$23,760,000', sub: '1,440 m² construidos', highlight: false },
                    { label: 'Indirectos y permisos', value: '$3,240,000', sub: '8% sobre costo de obra', highlight: false },
                    { label: 'Honorarios y diseño', value: '$1,800,000', sub: '4.5% sobre costo de obra', highlight: false },
                    { label: 'Imprevistos (5%)', value: '$1,188,000', sub: 'Reserva de contingencia', highlight: false },
                    { label: 'Inversión Total', value: '$45,200,000', sub: '', highlight: true },
                    { label: 'Precio venta estimado / m²', value: '$38,500/m²', sub: 'Mercado Valle Oriente · NSE A/B', highlight: false },
                    { label: 'Ingresos proyectados', value: '$66,780,000', sub: '1,734 m² vendibles · 100% absorción', highlight: false },
                    { label: 'Utilidad bruta', value: '$21,580,000', sub: '', highlight: false },
                    { label: 'Margen bruto', value: '47.7%', sub: 'sobre inversión total', highlight: true },
                  ].map((row, i) => (
                    <tr key={i} className={row.highlight ? 'bg-[#F0FBF6]' : i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFA]'}>
                      <td className="px-6 py-3 border-b border-[#F0F4F2]">
                        <p className={`text-[13px] ${row.highlight ? 'font-bold text-[#0F6E56]' : 'text-[#5a7065]'}`}>{row.label}</p>
                        {row.sub && <p className="text-[11px] text-[#9aab9f]">{row.sub}</p>}
                      </td>
                      <td className="px-6 py-3 border-b border-[#F0F4F2] text-right">
                        <p className={`text-[13px] ${row.highlight ? 'font-bold text-[#0F6E56]' : 'font-semibold text-[#111d17]'}`}>{row.value}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* 5 · Análisis de Mercado */}
          <div>
            <SectionTitle>Análisis de Mercado</SectionTitle>
            <Card>
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#9FE1CB]">
                  <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                  Demanda Alta
                </span>
                <span className="text-[12px] text-[#5a7065]">Valle Oriente · San Pedro Garza García</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 mb-5">
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Velocidad de absorción" value="8 unidades / mes" valueClass="text-[#0F6E56] font-semibold" />
                  <MetricRow label="Proyectos activos radio 500 m" value="4 proyectos" />
                  <MetricRow label="Precio promedio zona" value="$9,200 / m²" />
                </div>
                <div className="divide-y divide-[#F0F4F2]">
                  <MetricRow label="Perfil comprador NSE" value="A / B · 28–45 años" />
                  <MetricRow label="Plusvalía 3 años" value="+18%" valueClass="text-[#0F6E56] font-semibold" />
                  <MetricRow label="Inventario promedio" value="14 meses" />
                </div>
              </div>
              <div className="bg-[#F0FBF6] border border-[#D4EFE3] rounded-xl px-4 py-3">
                <p className="text-[11px] font-bold text-[#1D9E75] uppercase tracking-wide mb-1">Producto recomendado</p>
                <p className="text-[13px] font-semibold text-[#111d17]">Departamentos 2–3 rec. de 85–120 m² con terraza y 1–2 cajones</p>
              </div>
            </Card>
          </div>

          {/* 6 · Score de Resiliencia */}
          <div>
            <SectionTitle>Score de Resiliencia</SectionTitle>
            <Card>
              <div className="flex items-start gap-8">
                <ScoreGauge score={78} />
                <div className="flex-1">
                  <p className="text-[14px] text-[#5a7065] leading-relaxed mb-4">
                    El Score de Resiliencia mide la capacidad del proyecto para mantenerse viable ante escenarios adversos de mercado, costos y absorción. Un puntaje de <strong className="text-[#111d17]">78/100</strong> indica que el proyecto <strong className="text-[#0F6E56]">absorbe desviaciones moderadas</strong> sin comprometer la rentabilidad mínima requerida (TIR ≥ 12%).
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Solidez financiera', score: 82, color: '#1D9E75' },
                      { label: 'Riesgo regulatorio', score: 75, color: '#1D9E75' },
                      { label: 'Exposición de mercado', score: 71, color: '#D97706' },
                    ].map(d => (
                      <div key={d.label} className="bg-[#F7F8F6] rounded-xl p-3">
                        <p className="text-[10px] text-[#9aab9f] mb-2">{d.label}</p>
                        <div className="h-1.5 bg-[#E2E8E4] rounded-full overflow-hidden mb-1">
                          <div className="h-full rounded-full" style={{ width: `${d.score}%`, backgroundColor: d.color }} />
                        </div>
                        <p className="text-[12px] font-bold" style={{ color: d.color }}>{d.score}/100</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 7 · Stress Test */}
          <div>
            <SectionTitle>Stress Test — Escenarios Adversos</SectionTitle>
            <div className="grid grid-cols-1 gap-4">
              <StressCard
                title="Shock de Costos +15%"
                scenario="Incremento generalizado en materiales y mano de obra del 15% sobre el presupuesto base. Costo total sube de $45.2 M a $49.8 M."
                tirImpact="TIR baja de 22.4% → 17.8% · Margen: 47.7% → 38.4% · Proyecto sigue viable"
                status="amber"
              />
              <StressCard
                title="Freno de Ventas −50%"
                scenario="Absorción cae de 8 a 4 unidades/mes. Plazo se extiende de 6 a 12 meses. Costo financiero adicional estimado: $2.1 M."
                tirImpact="TIR baja de 22.4% → 14.1% · Margen: 47.7% → 39.2% · Proyecto sigue viable con ajuste de plazo"
                status="amber"
              />
              <StressCard
                title="Ajuste de Mercado −10% en Precio"
                scenario="Precio de venta cae de $38,500 a $34,650/m² por corrección de mercado. Ingresos bajan de $66.8 M a $60.1 M."
                tirImpact="TIR baja de 22.4% → 9.8% · Margen: 47.7% → 24.5% · Proyecto al límite — revisar supuestos"
                status="red"
              />
            </div>
          </div>

          {/* 8 · Punto de Quiebre */}
          <div>
            <SectionTitle>Punto de Quiebre</SectionTitle>
            <Card>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Desviación máx. de costos', value: '+28.4%', desc: 'antes de TIR < 12%', color: '#1D9E75' },
                  { label: 'Absorción mínima viable', value: '38%', desc: 'de las unidades proyectadas', color: '#D97706' },
                  { label: 'Precio venta mínimo', value: '$29,800/m²', desc: 'para recuperar inversión', color: '#D97706' },
                ].map(b => (
                  <div key={b.label} className="bg-[#F7F8F6] rounded-xl p-4 text-center border border-[#E2E8E4]">
                    <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-2">{b.label}</p>
                    <p className="text-[22px] font-black" style={{ color: b.color }}>{b.value}</p>
                    <p className="text-[11px] text-[#9aab9f] mt-1">{b.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 bg-[#F0FBF6] border border-[#9FE1CB] rounded-xl px-4 py-3">
                <CheckIcon />
                <p className="text-[12px] text-[#0F6E56]">
                  El proyecto mantiene viabilidad en el 87% de los escenarios simulados. La principal vulnerabilidad es una caída sostenida en precio de venta mayor al 22.4%.
                </p>
              </div>
            </Card>
          </div>

          {/* 9 · CTA */}
          <div className="bg-[#F0FBF6] border border-[#1D9E75]/30 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-[#0F6E56] mb-1">Análisis completo · Listo para presentar</p>
              <p className="text-[13px] text-[#5a9078]">Genera la propuesta ejecutiva con escenarios A/B/C para inversionistas.</p>
            </div>
            <button
              onClick={() => router.push(`/propuesta?proyecto=${encodeURIComponent(proyecto)}`)}
              className="flex items-center gap-2 bg-[#1D9E75] text-white px-6 py-3.5 rounded-xl text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors cursor-pointer shrink-0 ml-6"
            >
              Generar Propuesta de Inversión
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}

export default function AnalisisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center"><p className="text-[#9aab9f]">Cargando análisis…</p></div>}>
      <AnalisisContent />
    </Suspense>
  )
}
