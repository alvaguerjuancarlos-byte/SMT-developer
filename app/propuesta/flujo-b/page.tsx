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

const CANDIDATES = [
  {
    id: 'A',
    name: 'Valle Oriente',
    location: 'San Pedro Garza García',
    tir: '23.1%',
    inversion: '$38.5 M',
    score: 88,
    recommended: true,
    pros: ['Plusvalía +18% · mayor de la zona', 'Normativa plurifamiliar vigente · 12 niveles', 'Absorción 8 u/mes · NSE A/B consolidado'],
    contras: ['Precio/m² más alto del comparativo', 'Requiere sótano para cajones'],
  },
  {
    id: 'B',
    name: 'Cumbres Elite',
    location: 'García, Nuevo León',
    tir: '16.8%',
    inversion: '$28.2 M',
    score: 74,
    recommended: false,
    pros: ['Mayor superficie al precio más bajo', 'Precio/m² más competitivo ($2,811)', 'Zona en expansión con baja competencia'],
    contras: ['Cambio de uso de suelo requerido', 'Absorción baja (5 u/mes) · horizonte extendido'],
  },
  {
    id: 'C',
    name: 'Distrito Tec',
    location: 'Monterrey, N.L.',
    tir: '19.1%',
    inversion: '$33.8 M',
    score: 79,
    recommended: false,
    pros: ['Ubicación premium junto al Tec de Monterrey', 'Demanda alta y mercado estudiantil consolidado', 'Normativa plurifamiliar sin trámite adicional'],
    contras: ['Superficie más pequeña · menos unidades', 'Alta competencia en radio 300 m'],
  },
]

function PropuestaFlujoBContent() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || 'Proyecto Scout'
  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  const backUrl = `/analisis/flujo-b${proyecto !== 'Proyecto Scout' ? `?proyecto=${encodeURIComponent(proyecto)}` : ''}`

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
            onClick={() => router.push(backUrl)}
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
              <p className="text-[11px] font-bold text-[#9FE1CB] tracking-[0.14em] uppercase mb-2">Propuesta Comparativa de Inversión · 3 Candidatos</p>
              <h1 className="text-[34px] font-black text-white leading-tight mb-2">{proyecto}</h1>
              <p className="text-[14px] text-white/50">Monterrey, Nuevo León · {today}</p>
            </div>
            <div className="grid grid-cols-4 divide-x divide-white/10">
              {[
                { label: 'Candidatos evaluados', value: '3',       sub: 'Flujo B · Scout IA',  green: false },
                { label: 'TIR recomendado',       value: '23.1%',  sub: 'anual · caso base',   green: true  },
                { label: 'Inversión estimada',     value: '$38.5 M',sub: 'MXN · Valle Oriente', green: false },
                { label: 'Score Resiliencia',      value: '81/100', sub: 'Proyecto viable',     green: true  },
              ].map((m, i) => (
                <div key={i} className="px-6 py-5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className={`text-[24px] font-black leading-none ${m.green ? 'text-[#4ade80]' : 'text-white'}`}>{m.value}</p>
                  <p className="text-[11px] text-white/30 mt-1">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2 · Executive summary — 3 candidate cards */}
          <div>
            <SectionTitle>Resumen Ejecutivo · Comparativa de Candidatos</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              {CANDIDATES.map(c => {
                const scoreBg = c.score >= 80 ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-[#FEF3C7] text-[#92600A]'
                return (
                  <div key={c.id} className={`rounded-2xl border overflow-hidden shadow-sm ${c.recommended ? 'border-[#1D9E75]' : 'border-[#E2E8E4]'}`}>
                    <div className={`px-5 py-4 border-b ${c.recommended ? 'bg-[#E1F5EE] border-[#9FE1CB]' : 'bg-white border-[#F0F4F2]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-[#111d17] flex items-center justify-center text-white font-black text-[12px]">{c.id}</div>
                        {c.recommended && (
                          <span className="text-[9px] font-bold tracking-[0.12em] uppercase bg-[#1D9E75] text-white px-2 py-0.5 rounded-full">Recomendado</span>
                        )}
                      </div>
                      <p className={`text-[13px] font-bold leading-tight ${c.recommended ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{c.name}</p>
                      <p className="text-[10px] text-[#9aab9f] mt-0.5">{c.location}</p>
                    </div>
                    <div className="px-5 py-4 bg-white flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#9aab9f]">TIR estimada</span>
                        <span className={`text-[13px] font-bold ${c.recommended ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{c.tir}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#9aab9f]">Inversión total</span>
                        <span className="text-[13px] font-semibold text-[#111d17]">{c.inversion} MXN</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#9aab9f]">Score global</span>
                        <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${scoreBg}`}>{c.score}/100</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3 · Recommended terreno */}
          <div>
            <SectionTitle>Terreno Recomendado · Valle Oriente</SectionTitle>
            <div className="rounded-2xl overflow-hidden border border-[#9FE1CB]" style={{ background: 'linear-gradient(135deg, #0a1a12 0%, #0f2a1c 100%)' }}>
              <div className="px-8 py-7">
                <div className="flex items-start gap-6 mb-6">
                  <div className="shrink-0">
                    <ScoreArc score={81} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75]/20 border border-[#1D9E75]/40 text-[#9FE1CB] px-3 py-1 rounded-full">
                        Candidato A · Seleccionado
                      </span>
                    </div>
                    <h3 className="text-[22px] font-black text-white mb-1">Terreno Valle Oriente</h3>
                    <p className="text-[13px] text-white/50 mb-4">Av. Vasconcelos 300 Pte. · San Pedro Garza García, N.L.</p>
                    <p className="text-[13px] text-white/70 leading-relaxed">
                      El <strong className="text-white">Terreno A (Valle Oriente)</strong> lidera el comparativo con el score más alto (88/100), la normativa más favorable para desarrollo vertical (Plurifamiliar, 12 niveles, CUS 2.4) y la mayor plusvalía de zona (+18% en 3 años). La velocidad de absorción de <strong className="text-[#4ade80]">8 unidades/mes</strong> en el segmento NSE A/B respalda un horizonte de 18 meses con una <strong className="text-[#4ade80]">TIR de 23.1% anual</strong> y Score de Resiliencia de 81/100 frente a escenarios adversos simultáneos.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 pt-6 border-t border-white/10">
                  {[
                    { label: 'TIR Anual',          value: '23.1%',   green: true  },
                    { label: 'Inversión Total',     value: '$38.5 M', green: false },
                    { label: 'Score Resiliencia',   value: '81/100',  green: true  },
                    { label: 'Horizonte',           value: '18 meses',green: false },
                  ].map((m, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{m.label}</p>
                      <p className={`text-[20px] font-black leading-none ${m.green ? 'text-[#4ade80]' : 'text-white'}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4 · Comparative pros/cons */}
          <div>
            <SectionTitle>Comparativa de Fortalezas y Riesgos</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8E4] bg-[#F7F8F6]">
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9aab9f] uppercase tracking-wide w-[120px]">Candidato</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-[#1D9E75] uppercase tracking-wide">Fortalezas</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-[#D97706] uppercase tracking-wide">Riesgos</th>
                  </tr>
                </thead>
                <tbody>
                  {CANDIDATES.map((c, i) => (
                    <tr key={c.id} className={`border-b border-[#F0F4F2] last:border-0 ${c.recommended ? 'bg-[#F0FBF6]' : i % 2 !== 0 ? 'bg-[#FAFBFA]' : ''}`}>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-[#111d17] flex items-center justify-center text-white font-black text-[11px] shrink-0">{c.id}</div>
                          <div>
                            <p className={`text-[12px] font-bold ${c.recommended ? 'text-[#0F6E56]' : 'text-[#111d17]'}`}>{c.name}</p>
                            {c.recommended && <p className="text-[9px] text-[#1D9E75] font-semibold">Recomendado</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <ul className="flex flex-col gap-1">
                          {c.pros.map((p, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="text-[#1D9E75] font-bold text-[11px] mt-0.5">✓</span>
                              <span className="text-[12px] text-[#5a7065]">{p}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <ul className="flex flex-col gap-1">
                          {c.contras.map((con, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="text-[#D97706] font-bold text-[11px] mt-0.5">▲</span>
                              <span className="text-[12px] text-[#5a7065]">{con}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* 5 · Financial structure */}
          <div>
            <SectionTitle>Estructura Financiera · Terreno Recomendado</SectionTitle>
            <Card className="p-0 overflow-hidden">
              <table className="w-full">
                <tbody>
                  <TableRow label="Costo del terreno" value="$8,500,000" sub="$7,083 / m² · 1,200 m²" />
                  <TableRow label="Costo de construcción / m²" value="$15,800 / m²" sub="Acabados premium · clase A/B" />
                  <TableRow label="Costo total de construcción" value="$22,752,000" sub="1,440 m² construidos" />
                  <TableRow label="Indirectos y administración" value="$2,940,000" sub="8% sobre costo de obra" />
                  <TableRow label="Honorarios y diseño" value="$1,620,000" sub="4.5% sobre costo de obra" />
                  <TableRow label="Permisos y licencias" value="$680,000" sub="Municipio San Pedro Garza García" />
                  <TableRow label="Imprevistos (5%)" value="$1,008,000" sub="Reserva de contingencia" />
                  <TableRow label="Inversión Total" value="$38,500,000" highlight />
                  <TableRow label="Precio de venta estimado / m²" value="$38,500 / m²" sub="Mercado Valle Oriente · NSE A/B" />
                  <TableRow label="Ingresos proyectados (100%)" value="$66,759,000" sub="1,734 m² vendibles" />
                  <TableRow label="Utilidad bruta" value="$14,259,000" />
                  <TableRow label="Margen bruto sobre inversión" value="37.0%" highlight />
                </tbody>
              </table>
            </Card>
          </div>

          {/* 6 · Stress test */}
          <div>
            <SectionTitle>Stress Test · Terreno Valle Oriente</SectionTitle>
            <Card className="p-6">
              <StressRow
                title="Shock de Costos +15%"
                scenario="Costo total sube de $38.5 M a $43.1 M por incremento en materiales y mano de obra."
                impact="TIR: 23.1% → 18.2% · Margen: 37.0% → 26.8% · Proyecto sigue viable"
                status="amber"
              />
              <StressRow
                title="Freno de Ventas −50%"
                scenario="Absorción cae de 8 a 4 unidades/mes. Plazo se extiende 6 meses adicionales."
                impact="TIR: 23.1% → 15.0% · Margen: 37.0% → 28.4% · Viable con ajuste de plazo"
                status="amber"
              />
              <StressRow
                title="Ajuste de Mercado −10% en Precio"
                scenario="Precio de venta cae de $38,500 a $34,650/m². Ingresos bajan $6.7 M."
                impact="TIR: 23.1% → 10.4% · Margen: 37.0% → 15.1% · Al límite — revisar supuestos"
                status="red"
              />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Desviación máx. costos', value: '+31.2%', color: '#1D9E75' },
                  { label: 'Absorción mínima viable', value: '35%',   color: '#D97706' },
                  { label: 'Precio venta mínimo',     value: '$27,900/m²', color: '#D97706' },
                ].map(b => (
                  <div key={b.label} className="bg-[#F7F8F6] border border-[#E2E8E4] rounded-xl p-4 text-center">
                    <p className="text-[10px] text-[#9aab9f] uppercase tracking-wide mb-2">{b.label}</p>
                    <p className="text-[20px] font-black" style={{ color: b.color }}>{b.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 7 · Supuestos y Trazabilidad */}
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
                    ['Costo de construcción / m²', '$15,800 MXN',    'CMIC Q1 2026'],
                    ['Precio de venta / m²',        '$38,500 MXN',    'Comparables Lamudi / Inmuebles24'],
                    ['Eficiencia área vendible',    '85% del CUS',    'Estándar industria vertical NSE A/B'],
                    ['Velocidad de absorción',      '8 unidades / mes','Reporte Softec 2025 · AMM'],
                    ['Tasa de descuento (WACC)',    '12% anual',       'Benchmark BMV + spread proyecto'],
                    ['Indirectos y permisos',       '8% sobre obra',   'Histórico San Pedro 2023–2025'],
                    ['Imprevistos',                 '5% sobre obra',   'Reserva contingencia estándar SHCP'],
                    ['Plusvalía zona 3 años',       '+18%',            'BBVA Research Inmobiliario 2025'],
                    ['Cajones por departamento',    '1.2',             'Reglamento Construcción San Pedro 2024'],
                    ['Horizonte del proyecto',      '18 meses',        'Benchmarking proyectos similares'],
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

          {/* 8 · Próximos Pasos */}
          <div>
            <SectionTitle>Próximos Pasos</SectionTitle>
            <Card className="p-6">
              <div className="flex flex-col gap-4">
                {[
                  {
                    n: '01',
                    title: 'Negociar y reservar el Terreno Valle Oriente',
                    desc: 'Iniciar contacto formal con el propietario. Firma de carta intención y depósito en garantía equivalente al 3–5% del precio acordado. Plazo estimado: 1–2 semanas.',
                    color: '#1D9E75',
                  },
                  {
                    n: '02',
                    title: 'Completar debida diligencia',
                    desc: 'Obtener escrituras, constancia de uso de suelo, estudio de suelo y factibilidad de servicios. Verificar libertad de gravámenes ante Registro Público. Plazo: 3–4 semanas.',
                    color: '#1D9E75',
                  },
                  {
                    n: '03',
                    title: 'Estructurar esquema de capital',
                    desc: 'Definir la mezcla equity / crédito puente (propuesta: 40% / 60%). Gestionar carta de intención de crédito con institución financiera seleccionada.',
                    color: '#D97706',
                  },
                  {
                    n: '04',
                    title: 'Iniciar diseño arquitectónico y permisos',
                    desc: 'Contratar despacho de arquitectura para proyecto ejecutivo. Gestionar licencia de construcción ante Municipio de San Pedro. Plazo estimado: 2–3 meses.',
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

          {/* 9 · Footer */}
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
                <p className="text-[11px] text-white/40 mt-0.5">Análisis Mastermind v1.0 · Flujo B</p>
              </div>
            </div>
            <div className="bg-white px-8 py-4">
              <p className="text-[11px] text-[#9aab9f] leading-relaxed">
                <strong className="text-[#5a7065]">Aviso de confidencialidad:</strong> Este documento ha sido generado por SMT Developer con base en información de mercado disponible al {today} y constituye una proyección con fines informativos para inversionistas calificados. Las cifras son estimaciones y no garantizan rendimientos futuros. Se recomienda complementar con debida diligencia completa. Distribución restringida — uso exclusivo del destinatario.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

export default function PropuestaFlujoBPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f]">Generando propuesta comparativa…</p>
      </div>
    }>
      <PropuestaFlujoBContent />
    </Suspense>
  )
}
