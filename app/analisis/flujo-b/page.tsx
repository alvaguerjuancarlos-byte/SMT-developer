'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const CANDIDATES = [
  {
    id: 'A',
    name: 'Terreno Valle Oriente',
    location: 'Av. Vasconcelos 300 Pte., San Pedro Garza García',
    score: 88,
    metrics: {
      precio: '$8,500,000',
      superficie: '1,200 m²',
      preciom2: '$7,083',
      usoSuelo: 'Hab. Plurifamiliar',
      cosCus: '0.6 / 2.4',
      altura: '12 niveles',
      demanda: 'Alta',
      absorcion: '8 u/mes',
      plusvalia: '+18%',
      tir: '22.4%',
    },
    pros: [
      'Mayor plusvalía de la zona (+18% en 3 años)',
      'Uso de suelo ya habilitado para vertical',
      'Acceso directo a Av. Vasconcelos — alta visibilidad',
    ],
    contras: [
      'Precio por m² más alto del comparativo',
      'Sin cajones en planta baja — requiere sótano',
    ],
    best: { precio: false, superficie: false, preciom2: false, usoSuelo: true, cosCus: true, altura: true, demanda: true, absorcion: true, plusvalia: true, tir: true },
  },
  {
    id: 'B',
    name: 'Terreno Cumbres Elite',
    location: 'Blvd. Cumbres 450, García, Nuevo León',
    score: 74,
    metrics: {
      precio: '$5,200,000',
      superficie: '1,850 m²',
      preciom2: '$2,811',
      usoSuelo: 'Mixto / Comercial',
      cosCus: '0.5 / 1.8',
      altura: '8 niveles',
      demanda: 'Media',
      absorcion: '5 u/mes',
      plusvalia: '+11%',
      tir: '16.8%',
    },
    pros: [
      'Mayor superficie al precio más bajo del comparativo',
      'Precio por m² más competitivo ($2,811)',
      'Zona en crecimiento con baja competencia activa',
    ],
    contras: [
      'Demanda y absorción más bajas — horizonte extendido',
      'Uso mixto requiere cambio de uso de suelo',
    ],
    best: { precio: true, superficie: true, preciom2: true, usoSuelo: false, cosCus: false, altura: false, demanda: false, absorcion: false, plusvalia: false, tir: false },
  },
  {
    id: 'C',
    name: 'Terreno Distrito Tec',
    location: 'Calle Eugenio Garza Sada 2501, Monterrey',
    score: 79,
    metrics: {
      precio: '$7,100,000',
      superficie: '980 m²',
      preciom2: '$7,245',
      usoSuelo: 'Hab. Plurifamiliar',
      cosCus: '0.6 / 2.2',
      altura: '10 niveles',
      demanda: 'Alta',
      absorcion: '7 u/mes',
      plusvalia: '+14%',
      tir: '19.1%',
    },
    pros: [
      'Ubicación premium cerca del Tec de Monterrey',
      'Demanda alta y mercado estudiantil/joven consolidado',
      'Normativa plurifamiliar vigente — sin trámite de cambio',
    ],
    contras: [
      'Superficie más pequeña limita número de unidades',
      'Competencia alta de desarrollos recientes en radio 300 m',
    ],
    best: { precio: false, superficie: false, preciom2: false, usoSuelo: true, cosCus: false, altura: false, demanda: true, absorcion: false, plusvalia: false, tir: false },
  },
]

const METRIC_ROWS: { key: keyof typeof CANDIDATES[0]['metrics']; label: string }[] = [
  { key: 'precio',     label: 'Precio total' },
  { key: 'superficie', label: 'Superficie' },
  { key: 'preciom2',   label: 'Precio por m²' },
  { key: 'usoSuelo',   label: 'Uso de suelo' },
  { key: 'cosCus',     label: 'COS / CUS' },
  { key: 'altura',     label: 'Altura máxima' },
  { key: 'demanda',    label: 'Demanda zona' },
  { key: 'absorcion',  label: 'Velocidad absorción' },
  { key: 'plusvalia',  label: 'Plusvalía 3 años' },
  { key: 'tir',        label: 'TIR estimada' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#9aab9f] tracking-[0.14em] uppercase mb-4 flex items-center gap-3">
      <span className="flex-1 h-px bg-[#E2E8E4]" />
      {children}
      <span className="flex-1 h-px bg-[#E2E8E4]" />
    </h2>
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

function AnalisisflujoB() {
  const router = useRouter()
  const params = useSearchParams()
  const proyecto = params.get('proyecto') || 'Proyecto Scout'
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
        <div className="ml-auto">
          <button
            onClick={() => router.push('/prospeccion/flujo-b/buscando')}
            className="flex items-center gap-1.5 text-[13px] text-[#5a7065] hover:text-[#111d17] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver a Candidatos
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-[900px] mx-auto flex flex-col gap-10">

          {/* 1 · Hero banner */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1a12 0%, #111d17 55%, #0c1f15 100%)' }}>
            <div className="px-8 pt-8 pb-8">
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
                  Análisis Comparativo · 3 Candidatos
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#9FE1CB] tracking-[0.14em] uppercase mb-2">Reporte Scout IA · Flujo B</p>
              <h1 className="text-[32px] font-black text-white leading-tight mb-2">{proyecto}</h1>
              <p className="text-[14px] text-white/50">Monterrey, Nuevo León · {today}</p>
            </div>
          </div>

          {/* 2 · Comparative table */}
          <div>
            <SectionTitle>Tabla Comparativa de Terrenos</SectionTitle>
            <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8E4]" style={{ background: 'linear-gradient(135deg, #0a1a12, #111d17)' }}>
                    <th className="px-5 py-4 text-left text-[10px] font-bold text-white/50 uppercase tracking-wide w-[200px]">Indicador</th>
                    {CANDIDATES.map(c => (
                      <th key={c.id} className="px-5 py-4 text-center">
                        <p className="text-[13px] font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-white/40 mt-0.5 font-normal">{c.location.split(',')[1]?.trim()}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map((row, i) => (
                    <tr key={row.key} className={`border-b border-[#F0F4F2] last:border-0 ${i % 2 === 0 ? '' : 'bg-[#FAFBFA]'}`}>
                      <td className="px-5 py-3.5 text-[12px] font-semibold text-[#5a7065]">{row.label}</td>
                      {CANDIDATES.map(c => {
                        const isBest = c.best[row.key]
                        return (
                          <td key={c.id} className="px-5 py-3.5 text-center">
                            <span className={`inline-block text-[13px] font-semibold px-2.5 py-1 rounded-lg ${
                              isBest
                                ? 'bg-[#E1F5EE] text-[#0F6E56]'
                                : 'text-[#111d17]'
                            }`}>
                              {c.metrics[row.key]}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3 · Candidate cards */}
          <div>
            <SectionTitle>Evaluación por Candidato</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              {CANDIDATES.map(c => {
                const scoreColor = c.score >= 80 ? '#1D9E75' : c.score >= 70 ? '#D97706' : '#DC2626'
                const scoreBg = c.score >= 80 ? 'bg-[#E1F5EE] text-[#0F6E56]' : c.score >= 70 ? 'bg-[#FEF3C7] text-[#92600A]' : 'bg-[#FEE2E2] text-[#991B1B]'
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 pt-5 pb-4 border-b border-[#F0F4F2]">
                      <div className="flex items-start justify-between mb-1">
                        <div className="w-8 h-8 rounded-lg bg-[#111d17] flex items-center justify-center text-white font-black text-[13px] shrink-0">
                          {c.id}
                        </div>
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${scoreBg}`}>
                          {c.score}/100
                        </span>
                      </div>
                      <p className="text-[14px] font-bold text-[#111d17] mt-2 leading-tight">{c.name}</p>
                      <p className="text-[11px] text-[#9aab9f] mt-0.5 leading-snug">{c.location}</p>
                    </div>
                    <div className="px-5 py-4 flex flex-col gap-3 flex-1">
                      <div>
                        <p className="text-[9px] font-bold text-[#1D9E75] uppercase tracking-[0.12em] mb-2">Fortalezas</p>
                        <ul className="flex flex-col gap-1.5">
                          {c.pros.map((p, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-[#E1F5EE] flex items-center justify-center shrink-0 mt-0.5">
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                  <path d="M1.5 4L3.5 6L6.5 2" stroke="#1D9E75" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                              <span className="text-[11px] text-[#5a7065] leading-snug">{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-[#D97706] uppercase tracking-[0.12em] mb-2">Riesgos</p>
                        <ul className="flex flex-col gap-1.5">
                          {c.contras.map((con, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-[#FEF3C7] flex items-center justify-center shrink-0 mt-0.5">
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                  <path d="M4 2.5V4.5M4 5.5V5.6" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/>
                                </svg>
                              </span>
                              <span className="text-[11px] text-[#5a7065] leading-snug">{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4 · Recomendación Mastermind */}
          <div>
            <SectionTitle>Recomendación Mastermind</SectionTitle>
            <div className="rounded-2xl overflow-hidden border border-[#9FE1CB]" style={{ background: 'linear-gradient(135deg, #0a1a12 0%, #0f2a1c 100%)' }}>
              <div className="px-8 py-7">
                <div className="flex items-start gap-6">
                  <div className="shrink-0">
                    <ScoreArc score={81} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase bg-[#1D9E75]/20 border border-[#1D9E75]/40 text-[#9FE1CB] px-3 py-1 rounded-full">
                        Candidato Recomendado
                      </span>
                      <span className="text-[10px] font-bold text-[#4ade80]/60 uppercase tracking-wide">Score Resiliencia 81/100</span>
                    </div>
                    <h3 className="text-[22px] font-black text-white mb-1">Terreno Valle Oriente — Candidato A</h3>
                    <p className="text-[13px] text-white/50 mb-4">Av. Vasconcelos 300 Pte., San Pedro Garza García, N.L.</p>
                    <p className="text-[13px] text-white/70 leading-relaxed">
                      El <strong className="text-white">Terreno A (Valle Oriente)</strong> presenta el mayor score compuesto del comparativo (88/100) combinando la normativa más favorable (Plurifamiliar, 12 niveles, CUS 2.4), la mejor velocidad de absorción (8 u/mes) y la plusvalía más alta de los tres candidatos (+18% en 3 años). Aunque su precio por m² es el más alto, la capacidad constructiva y el perfil de demanda NSE A/B en San Pedro Garza García justifican el diferencial con una <strong className="text-[#4ade80]">TIR estimada de 22.4% anual</strong>.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-4 gap-4 pt-6 border-t border-white/10">
                  {[
                    { label: 'TIR Estimada', value: '22.4%', green: true },
                    { label: 'Score Global', value: '88/100', green: true },
                    { label: 'Absorción', value: '8 u/mes', green: false },
                    { label: 'Plusvalía 3 a.', value: '+18%', green: true },
                  ].map((m, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{m.label}</p>
                      <p className={`text-[22px] font-black leading-none ${m.green ? 'text-[#4ade80]' : 'text-white'}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5 · Stress Test */}
          <div>
            <SectionTitle>Stress Test · Terreno Recomendado</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  title: 'Shock de Costos +15%',
                  scenario: 'Costo total sube de $45.2 M a $49.8 M por incremento en materiales.',
                  impact: 'TIR: 22.4% → 17.8% · Margen: 28.3% → 20.1%',
                  status: 'amber' as const,
                  label: 'Tolerable',
                },
                {
                  title: 'Freno de Ventas −50%',
                  scenario: 'Absorción baja de 8 a 4 u/mes. Plazo se extiende 6 meses.',
                  impact: 'TIR: 22.4% → 14.1% · Plazo: 18 → 24 meses',
                  status: 'amber' as const,
                  label: 'Monitorear',
                },
                {
                  title: 'Ajuste de Precio −10%',
                  scenario: 'Precio de venta cae de $38,500 a $34,650/m². Ingresos −$6.7 M.',
                  impact: 'TIR: 22.4% → 9.8% · Margen: 28.3% → 12.6%',
                  status: 'red' as const,
                  label: 'Crítico',
                },
              ].map(s => {
                const cfg = {
                  amber: { dot: '#D97706', badge: 'bg-[#FEF3C7] text-[#92600A]', border: 'border-[#FDE68A]' },
                  red:   { dot: '#DC2626', badge: 'bg-[#FEE2E2] text-[#991B1B]', border: 'border-[#FECACA]' },
                  green: { dot: '#1D9E75', badge: 'bg-[#E1F5EE] text-[#0F6E56]', border: 'border-[#9FE1CB]' },
                }[s.status]
                return (
                  <div key={s.title} className={`bg-white rounded-2xl border ${cfg.border} p-5 shadow-sm`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{s.label}</span>
                    </div>
                    <p className="text-[13px] font-bold text-[#111d17] mb-2">{s.title}</p>
                    <p className="text-[12px] text-[#5a7065] leading-relaxed mb-3">{s.scenario}</p>
                    <p className="text-[12px] font-semibold text-[#111d17]">{s.impact}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 6 · CTA */}
          <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-6 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-[#0F6E56] mb-1">Análisis completo · Listo para presentar</p>
              <p className="text-[13px] text-[#5a7065]">Genera la propuesta comparativa con los tres candidatos para inversionistas.</p>
            </div>
            <button
              onClick={() => router.push(`/propuesta?proyecto=${encodeURIComponent(proyecto)}`)}
              className="flex items-center gap-2 bg-[#1D9E75] text-white px-6 py-3.5 rounded-xl text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors cursor-pointer shrink-0 ml-6"
            >
              Generar Propuesta Comparativa
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

export default function AnalisisflujoB_Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f]">Cargando análisis comparativo…</p>
      </div>
    }>
      <AnalisisflujoB />
    </Suspense>
  )
}
