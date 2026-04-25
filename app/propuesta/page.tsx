'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#9aab9f] tracking-[0.14em] uppercase mb-4 flex items-center gap-3">
      <span className="flex-1 h-px bg-[#E2E8E4]" />
      {children}
      <span className="flex-1 h-px bg-[#E2E8E4]" />
    </h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E2E8E4] shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, dark = false }: {
  label: string; value: string; sub?: string; dark?: boolean
}) {
  return (
    <div className={`rounded-2xl p-5 border ${dark ? 'bg-[#111d17] border-[#1D9E75]/30' : 'bg-white border-[#E2E8E4]'}`}>
      <p className={`text-[10px] font-semibold tracking-[0.14em] uppercase mb-2 ${dark ? 'text-[#9FE1CB]' : 'text-[#9aab9f]'}`}>{label}</p>
      <p className={`text-[28px] font-black leading-none ${dark ? 'text-[#4ade80]' : 'text-[#111d17]'}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-1 ${dark ? 'text-white/40' : 'text-[#9aab9f]'}`}>{sub}</p>}
    </div>
  )
}

function TableRow({ label, value, highlight = false, sub }: {
  label: string; value: string; highlight?: boolean; sub?: string
}) {
  return (
    <tr className={`${highlight ? 'bg-[#F0FBF6]' : ''} border-b border-[#F0F4F2] last:border-0`}>
      <td className="px-6 py-3">
        <p className={`text-[13px] ${highlight ? 'font-bold text-[#0F6E56]' : 'text-[#5a7065]'}`}>{label}</p>
        {sub && <p className="text-[11px] text-[#9aab9f]">{sub}</p>}
      </td>
      <td className="px-6 py-3 text-right">
        <p className={`text-[13px] ${highlight ? 'font-bold text-[#0F6E56]' : 'font-semibold text-[#111d17]'}`}>{value}</p>
      </td>
    </tr>
  )
}

function ScoreArc({ score }: { score: number }) {
  const r = 46
  const circ = Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#1D9E75' : score >= 50 ? '#D97706' : '#DC2626'
  const label = score >= 70 ? 'Proyecto Viable' : score >= 50 ? 'Revisar Supuestos' : 'Riesgo Elevado'
  const labelColor = score >= 70 ? '#0F6E56' : score >= 50 ? '#92600A' : '#991B1B'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 120, height: 72 }}>
        <svg width="120" height="72" viewBox="0 0 120 72" fill="none" style={{ overflow: 'visible' }}>
          <path d="M 12 60 A 48 48 0 0 1 108 60" stroke="#E2E8E4" strokeWidth="10" strokeLinecap="round" fill="none"/>
          <path d="M 12 60 A 48 48 0 0 1 108 60" stroke={color} strokeWidth="10" strokeLinecap="round" fill="none"
            strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <span className="text-[28px] font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[10px] text-[#9aab9f]">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-bold" style={{ color: labelColor }}>{label}</span>
    </div>
  )
}

function StressRow({ title, scenario, impact, status }: {
  title: string; scenario: string; impact: string; status: 'green' | 'amber' | 'red'
}) {
  const cfg = {
    green: { badge: 'bg-[#E1F5EE] text-[#0F6E56]', dot: '#1D9E75', label: 'Tolerable' },
    amber: { badge: 'bg-[#FEF3C7] text-[#92600A]', dot: '#D97706', label: 'Monitorear' },
    red:   { badge: 'bg-[#FEE2E2] text-[#991B1B]', dot: '#DC2626', label: 'Crítico' },
  }[status]
  return (
    <div className="flex items-start gap-4 py-4 border-b border-[#F0F4F2] last:border-0">
      <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: cfg.dot }} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[13px] font-bold text-[#111d17]">{title}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
        </div>
        <p className="text-[12px] text-[#5a7065] mb-1">{scenario}</p>
        <p className="text-[12px] font-semibold text-[#111d17]">{impact}</p>
      </div>
    </div>
  )
}

function PropuestaContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || 'Proyecto de Inversión'
  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">

      {/* Sticky header */}
      <header className="px-8 py-4 flex items-center gap-3 border-b border-[#E2E8E4] bg-white sticky top-0 z-20">
        <div className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] font-medium text-[#1a1a1a] tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-[#6b7c74] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => router.push(`/analisis${proyecto !== 'Proyecto de Inversión' ? `?proyecto=${encodeURIComponent(proyecto)}` : ''}`)}
            className="flex items-center gap-1.5 text-[13px] text-[#5a7065] hover:text-[#111d17] transition-colors mr-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver al Análisis
          </button>
          <div className="relative group">
            <button disabled className="flex items-center gap-1.5 text-[13px] font-medium text-[#9aab9f] border border-[#E2E8E4] bg-[#F7F8F6] px-4 py-2 rounded-xl cursor-not-allowed">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Descargar PDF
            </button>
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#111d17] text-white text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Próximamente
            </span>
          </div>
          <div className="relative group">
            <button disabled className="flex items-center gap-1.5 text-[13px] font-medium text-[#9aab9f] border border-[#E2E8E4] bg-[#F7F8F6] px-4 py-2 rounded-xl cursor-not-allowed">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="3" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4.3 6.3l5.4-2.6M4.3 7.7l5.4 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Compartir
            </button>
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#111d17] text-white text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Próximamente
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-[800px] mx-auto flex flex-col gap-10">

          {/* 1 · Cover */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1a12 0%, #111d17 55%, #0c1f15 100%)' }}>
            <div className="px-8 pt-8 pb-6 border-b border-white/10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1D9E75] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                      <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-white">SMT Developer</p>
                    <p className="text-[10px] text-white/40 tracking-[0.12em] uppercase">Inteligencia inmobiliaria</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75]/20 border border-[#1D9E75]/40 text-[#9FE1CB] px-3 py-1 rounded-full">
                  Confidencial
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#9FE1CB] tracking-[0.14em] uppercase mb-2">Propuesta de Inversión Estructurada</p>
              <h1 className="text-[34px] font-black text-white leading-tight mb-2">{proyecto}</h1>
              <p className="text-[14px] text-white/50">Monterrey, Nuevo León · {today}</p>
            </div>
            <div className="grid grid-cols-4 divide-x divide-white/10">
              {[
                { label: 'TIR Proyectada', value: '22.4%', sub: 'anual', green: true },
                { label: 'Inversión Total', value: '$45.2 M', sub: 'MXN', green: false },
                { label: 'Utilidad Bruta', value: '$12.8 M', sub: 'MXN', green: false },
                { label: 'Score Resiliencia', value: '78/100', sub: 'Proyecto viable', green: true },
              ].map((m, i) => (
                <div key={i} className="px-6 py-5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className={`text-[24px] font-black leading-none ${m.green ? 'text-[#4ade80]' : 'text-white'}`}>{m.value}</p>
                  <p className="text-[11px] text-white/30 mt-1">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2 · Resumen Ejecutivo */}
          <div>
            <SectionTitle>Resumen Ejecutivo</SectionTitle>
            <Card className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard label="TIR Anual" value="22.4%" sub="caso base" dark />
                <MetricCard label="Inversión Total" value="$45.2 M" sub="MXN" />
                <MetricCard label="Utilidad Proyectada" value="$12.8 M" sub="MXN bruto" />
                <MetricCard label="Score Resiliencia" value="78" sub="/ 100 · Viable" />
              </div>
              <div className="bg-[#F7F8F6] rounded-xl px-5 py-4 border border-[#E2E8E4]">
                <p className="text-[14px] text-[#5a7065] leading-relaxed">
                  El proyecto <strong className="text-[#111d17]">{proyecto}</strong> consiste en el desarrollo de un edificio residencial vertical de 48 departamentos en Valle Oriente, San Pedro Garza García, sobre un terreno de 1,200 m² con normativa Habitacional Plurifamiliar (CUS 2.4, 12 niveles). Con una inversión total de <strong className="text-[#111d17]">$45.2 MDP</strong> y precio de venta estimado de $38,500/m², el proyecto genera una <strong className="text-[#0F6E56]">TIR del 22.4% anual</strong> y una utilidad bruta de $12.8 MDP en un horizonte de 18 meses. El Score de Resiliencia de <strong className="text-[#0F6E56]">78/100</strong> confirma viabilidad ante desviaciones moderadas en costos, absorción y precio de mercado.
                </p>
              </div>
            </Card>
          </div>

          {/* 3 · El Terreno */}
          <div>
            <SectionTitle>El Terreno</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <tbody>
                  <TableRow label="Dirección" value="Av. Vasconcelos 300 Pte., Valle Oriente" sub="San Pedro Garza García, N.L." />
                  <TableRow label="Superficie total" value="1,200 m²" />
                  <TableRow label="Uso de suelo actual" value="Habitacional Plurifamiliar" />
                  <TableRow label="Municipio" value="San Pedro Garza García" />
                  <TableRow label="Precio de adquisición" value="$8,500,000 MXN" />
                  <TableRow label="Precio por m²" value="$7,083 / m²" />
                  <TableRow label="Estado del predio" value="Baldío limpio · Sin construcción existente" />
                </tbody>
              </table>
            </Card>
          </div>

          {/* 4 · Recomendación Estratégica */}
          <div>
            <SectionTitle>Recomendación Estratégica</SectionTitle>
            <Card className="p-6">
              <div className="flex items-start gap-5 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-[#E1F5EE] flex items-center justify-center shrink-0">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#1D9E75" strokeWidth="1.8"/>
                    <path d="M3 9h18M9 21V9" stroke="#1D9E75" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#1D9E75] tracking-[0.12em] uppercase mb-1">Tipología recomendada</p>
                  <h3 className="text-[22px] font-bold text-[#111d17] mb-1">Residencial Vertical · 48 departamentos</h3>
                  <p className="text-[13px] text-[#5a7065]">Torre de 12 niveles · Valle Oriente · NSE A/B</p>
                </div>
              </div>
              <p className="text-[14px] text-[#5a7065] leading-relaxed mb-5">
                La normativa del predio (CUS 2.4, 12 niveles) y la demanda activa en Valle Oriente respaldan el desarrollo de un edificio residencial vertical orientado al segmento A/B de 28–45 años. La configuración de 48 unidades de 2 y 3 recámaras en rangos de 85–120 m² optimiza el área vendible al 85% del CUS y se alinea con la velocidad de absorción histórica de la zona (8 unidades/mes).
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Número de unidades', value: '48 departamentos' },
                  { label: 'Área construida total', value: '2,880 m²' },
                  { label: 'Área vendible neta', value: '1,734 m²' },
                  { label: 'Mix de productos', value: '60% 2 rec. · 40% 3 rec.' },
                  { label: 'Perfil comprador', value: 'NSE A/B · 28–45 años' },
                  { label: 'Amenidades', value: 'Rooftop, gimnasio, lobby' },
                ].map(d => (
                  <div key={d.label} className="bg-[#F7F8F6] rounded-xl p-3 border border-[#E2E8E4]">
                    <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-1">{d.label}</p>
                    <p className="text-[13px] font-semibold text-[#111d17]">{d.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 5 · Estructura Financiera */}
          <div>
            <SectionTitle>Estructura Financiera</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <tbody>
                  <TableRow label="Costo del terreno" value="$8,500,000" sub="$7,083 / m² · 1,200 m²" />
                  <TableRow label="Costo de construcción / m²" value="$16,500 / m²" sub="Acabados premium · clase A/B" />
                  <TableRow label="Costo total de construcción" value="$23,760,000" sub="1,440 m² construidos" />
                  <TableRow label="Indirectos y administración" value="$3,240,000" sub="8% sobre costo de obra" />
                  <TableRow label="Honorarios y diseño" value="$1,800,000" sub="4.5% sobre costo de obra" />
                  <TableRow label="Permisos y licencias" value="$712,000" sub="Municipio San Pedro Garza García" />
                  <TableRow label="Imprevistos (5%)" value="$1,188,000" sub="Reserva de contingencia" />
                  <TableRow label="Inversión Total" value="$45,200,000" highlight />
                  <TableRow label="Precio de venta estimado / m²" value="$38,500 / m²" sub="Mercado Valle Oriente · NSE A/B" />
                  <TableRow label="Ingresos proyectados (100%)" value="$66,759,000" sub="1,734 m² vendibles" />
                  <TableRow label="Utilidad bruta" value="$12,800,000" />
                  <TableRow label="Margen bruto sobre inversión" value="28.3%" highlight />
                </tbody>
              </table>
            </Card>
          </div>

          {/* 6 · Análisis de Mercado */}
          <div>
            <SectionTitle>Análisis de Mercado</SectionTitle>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#9FE1CB]">
                  <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                  Demanda Alta
                </span>
                <span className="text-[12px] text-[#5a7065]">Valle Oriente · San Pedro Garza García</span>
              </div>
              <div className="grid grid-cols-2 gap-x-10 mb-5">
                {[
                  { label: 'Velocidad de absorción', value: '8 unidades / mes', green: true },
                  { label: 'Proyectos activos radio 500 m', value: '4 proyectos' },
                  { label: 'Precio promedio zona', value: '$9,200 / m²' },
                  { label: 'Perfil comprador NSE', value: 'A / B · 28–45 años' },
                  { label: 'Plusvalía últimos 3 años', value: '+18%', green: true },
                  { label: 'Inventario promedio activo', value: '14 meses' },
                ].map(d => (
                  <div key={d.label} className="flex items-center justify-between py-2.5 border-b border-[#F0F4F2] last:border-0">
                    <p className="text-[13px] text-[#5a7065]">{d.label}</p>
                    <p className={`text-[13px] font-semibold ${d.green ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{d.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#F0FBF6] border border-[#D4EFE3] rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wide mb-1">Precio recomendado de venta</p>
                <p className="text-[15px] font-bold text-[#111d17]">$36,000 – $42,000 / m² <span className="text-[13px] font-normal text-[#5a7065]">según nivel y orientación</span></p>
              </div>
            </Card>
          </div>

          {/* 7 · Mitigación y Resiliencia */}
          <div>
            <SectionTitle>Mitigación y Resiliencia</SectionTitle>
            <Card className="p-6">
              <div className="flex items-start gap-8 mb-6 pb-6 border-b border-[#F0F4F2]">
                <div className="shrink-0">
                  <ScoreArc score={78} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-[#111d17] mb-2">Score de Resiliencia: 78/100</p>
                  <p className="text-[13px] text-[#5a7065] leading-relaxed mb-4">
                    El proyecto soporta desviaciones adversas simultáneas en costos (+28%) y absorción (−38%) antes de comprometer la TIR mínima requerida del 12%. La principal vulnerabilidad es una caída sostenida en precio de venta superior al 22%.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Solidez financiera', v: 82, color: '#1D9E75' },
                      { label: 'Riesgo regulatorio', v: 75, color: '#1D9E75' },
                      { label: 'Exposición mercado', v: 71, color: '#D97706' },
                    ].map(d => (
                      <div key={d.label} className="bg-[#F7F8F6] rounded-xl p-3 border border-[#E2E8E4]">
                        <p className="text-[10px] text-[#9aab9f] mb-2">{d.label}</p>
                        <div className="h-1.5 bg-[#E2E8E4] rounded-full overflow-hidden mb-1">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.v}%`, backgroundColor: d.color }} />
                        </div>
                        <p className="text-[12px] font-bold" style={{ color: d.color }}>{d.v}/100</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[10px] font-bold text-[#9aab9f] tracking-[0.12em] uppercase mb-2">Stress Test — Escenarios Adversos</p>
              <div>
                <StressRow
                  title="Shock de Costos +15%"
                  scenario="Costo total sube de $45.2 M a $49.8 M por incremento en materiales y mano de obra."
                  impact="TIR: 22.4% → 17.8% · Margen: 28.3% → 20.1% · Proyecto sigue viable"
                  status="amber"
                />
                <StressRow
                  title="Freno de Ventas −50%"
                  scenario="Absorción cae de 8 a 4 unidades/mes. Plazo se extiende 6 meses adicionales."
                  impact="TIR: 22.4% → 14.1% · Margen: 28.3% → 22.4% · Viable con ajuste de plazo"
                  status="amber"
                />
                <StressRow
                  title="Ajuste de Mercado −10% en Precio"
                  scenario="Precio de venta cae de $38,500 a $34,650/m². Ingresos bajan $6.7 M."
                  impact="TIR: 22.4% → 9.8% · Margen: 28.3% → 12.6% · Al límite — revisar supuestos"
                  status="red"
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Desviación máx. costos', value: '+28.4%', color: '#1D9E75' },
                  { label: 'Absorción mínima viable', value: '38%', color: '#D97706' },
                  { label: 'Precio venta mínimo', value: '$29,800/m²', color: '#D97706' },
                ].map(b => (
                  <div key={b.label} className="bg-[#F7F8F6] border border-[#E2E8E4] rounded-xl p-4 text-center">
                    <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-2">{b.label}</p>
                    <p className="text-[20px] font-black" style={{ color: b.color }}>{b.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 8 · Supuestos y Trazabilidad */}
          <div>
            <SectionTitle>Supuestos y Trazabilidad</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F7F8F6] border-b border-[#E2E8E4]">
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide">Supuesto</th>
                    <th className="px-6 py-3 text-right text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide">Valor</th>
                    <th className="px-6 py-3 text-right text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide">Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Costo de construcción / m²', '$16,500 MXN', 'CMIC Q1 2026'],
                    ['Precio de venta / m²', '$38,500 MXN', 'Comparables Lamudi / Inmuebles24'],
                    ['Eficiencia área vendible', '85% del CUS', 'Estándar industria vertical NSE A/B'],
                    ['Velocidad de absorción', '8 unidades / mes', 'Reporte Softec 2025 · AMM'],
                    ['Tasa de descuento (WACC)', '12% anual', 'Benchmark BMV + spread proyecto'],
                    ['Indirectos y permisos', '8% sobre obra', 'Histórico San Pedro 2023–2025'],
                    ['Imprevistos', '5% sobre obra', 'Reserva contingencia estándar SHCP'],
                    ['Plusvalía zona 3 años', '+18%', 'BBVA Research Inmobiliario 2025'],
                    ['Cajones por departamento', '1.2', 'Reglamento Construcción San Pedro 2024'],
                    ['Horizonte del proyecto', '18 meses', 'Benchmarking proyectos similares'],
                  ].map(([label, value, source], i) => (
                    <tr key={i} className="border-b border-[#F0F4F2] last:border-0 hover:bg-[#FAFBFA]">
                      <td className="px-6 py-3 text-[13px] text-[#5a7065]">{label}</td>
                      <td className="px-6 py-3 text-[13px] font-semibold text-[#111d17] text-right">{value}</td>
                      <td className="px-6 py-3 text-[11px] text-[#9aab9f] text-right">{source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* 9 · Próximos Pasos */}
          <div>
            <SectionTitle>Próximos Pasos</SectionTitle>
            <Card className="p-6">
              <div className="flex flex-col gap-4">
                {[
                  {
                    n: '01',
                    title: 'Completar debida diligencia',
                    desc: 'Obtener escrituras notariales, constancia de uso de suelo, estudio de suelo y factibilidad de servicios. Plazo estimado: 3–4 semanas.',
                    color: '#1D9E75',
                  },
                  {
                    n: '02',
                    title: 'Estructurar esquema de capital',
                    desc: 'Definir la mezcla equity / crédito puente (propuesta: 40% / 60%). Contactar instituciones financieras para carta de intención de crédito.',
                    color: '#1D9E75',
                  },
                  {
                    n: '03',
                    title: 'Formalizar adquisición del terreno',
                    desc: 'Firma de promesa de compraventa con condicionantes de debida diligencia. Depósito en garantía: 5% del precio de adquisición.',
                    color: '#D97706',
                  },
                  {
                    n: '04',
                    title: 'Iniciar diseño arquitectónico y permisos',
                    desc: 'Contratar despacho de arquitectura para proyecto ejecutivo. Gestionar licencia de construcción ante municipio. Plazo estimado: 2–3 meses.',
                    color: '#D97706',
                  },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[13px] text-white" style={{ backgroundColor: s.color }}>
                      {s.n}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-[14px] font-bold text-[#111d17] mb-1">{s.title}</p>
                      <p className="text-[13px] text-[#5a7065] leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 10 · Footer */}
          <div className="rounded-2xl overflow-hidden border border-[#E2E8E4]">
            <div className="bg-[#111d17] px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1D9E75] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                    <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">SMT Developer</p>
                  <p className="text-[11px] text-white/40">Inteligencia inmobiliaria · Monterrey, N.L.</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/40">Generado el {today}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Análisis Mastermind v1.0</p>
              </div>
            </div>
            <div className="bg-white px-8 py-4">
              <p className="text-[11px] text-[#9aab9f] leading-relaxed">
                <strong className="text-[#5a7065]">Aviso de confidencialidad:</strong> Este documento ha sido generado por SMT Developer con base en información de mercado disponible al {today} y constituye una proyección con fines informativos para inversionistas calificados. Las cifras presentadas son estimaciones y no garantizan rendimientos futuros. Se recomienda complementar este análisis con una debida diligencia completa antes de tomar decisiones de inversión. Distribución restringida — uso exclusivo del destinatario.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

export default function PropuestaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f]">Generando propuesta…</p>
      </div>
    }>
      <PropuestaContent />
    </Suspense>
  )
}
