'use client'

import { useState } from 'react'

interface FuenteCategoria {
  color: string
  titulo: string
  sub: string
  items: [string, string, string][]
}

const FUENTES_DATA: FuenteCategoria[] = [
  { color: '#3B82F6', titulo: 'Normativa Urbana', sub: 'Planes y zonificación',
    items: [['Plan de Desarrollo Urbano Municipal', 'Usos de suelo, densidades y alturas permitidas', 'Varía por municipio'],
            ['Plan Parcial de Desarrollo Urbano', 'Detalle normativo de zona específica', 'Varía por municipio'],
            ['Tabla de Compatibilidades de Uso', 'CUS / COS / CAS aplicables al predio', 'Varía por municipio'],
            ['Programa de Ordenamiento Territorial', 'Macro-zonificación y vocación regional', 'Varía por estado']] },
  { color: '#D97706', titulo: 'Marco Legal Federal', sub: 'Legislación nacional',
    items: [['LGAHOTDU', 'Ley de Asentamientos Humanos y Ordenamiento Territorial', 'DOF: 28 nov 2016'],
            ['Ley de Vivienda', 'Criterios de habitabilidad y acceso a financiamiento', 'DOF: 27 jun 2006'],
            ['LGEEPA', 'Equilibrio Ecológico y Protección al Ambiente', 'DOF: 28 ene 1988'],
            ['Código Civil Federal', 'Régimen de propiedad, contratos y garantías', 'DOF: 26 may 1928']] },
  { color: '#F97316', titulo: 'Reglamentación Local', sub: 'Estatal y municipal',
    items: [['Reglamento de Construcciones', 'Normas técnicas y especificaciones de edificación', 'Varía por municipio'],
            ['Ley de Desarrollo Urbano Estatal', 'Marco regulatorio del estado donde se ubica', 'Varía por estado'],
            ['Reglamento de Zonificación', 'Restricciones específicas por zona y uso', 'Varía por municipio'],
            ['Ley de Catastro Municipal', 'Valuación catastral y registro predial', 'Varía por municipio']] },
  { color: '#1D9E75', titulo: 'Mercado Inmobiliario', sub: 'Comparables y absorción',
    items: [['Inmuebles24 / Vivanuncios', 'Base de oferta activa y precios por zona', 'Datos en tiempo real'],
            ['CBRE / JLL / Colliers', 'Reportes de mercado comercial e industrial', 'Reportes trimestrales'],
            ['AMPI', 'Índices de precios y velocidad de absorción', 'Fund. 1956'],
            ['SHF — Índice de Precios de Vivienda', 'Evolución histórica del valor habitacional', 'DOF: 11 oct 2001']] },
  { color: '#059669', titulo: 'Financiero y Fiscal', sub: 'Costos, tasas e impuestos',
    items: [['BANXICO', 'Tasa de referencia, inflación y tipo de cambio', 'DOF: 23 dic 1993'],
            ['INFONAVIT / FOVISSSTE', 'Mezcla de crédito y elegibilidad de compradores', 'DOF: 24 abr 1972'],
            ['CMIC', 'Índice Nacional de Costos de Construcción por m²', 'Fund. 1958'],
            ['SAT', 'Marco fiscal: ISR, IVA, ISAI y CFDI de operaciones', 'Creado: 1 jul 1997']] },
  { color: '#7C3AED', titulo: 'Catastro y Registro', sub: 'Propiedad y linderos',
    items: [['Registro Público de la Propiedad', 'Titularidad, gravámenes e historial jurídico', 'Varía por estado'],
            ['Catastro Municipal', 'Valor catastral, superficie y colindancias', 'Varía por municipio'],
            ['RAN — Registro Agrario Nacional', 'Régimen ejidal y regularización de suelo', 'DOF: 26 feb 1992'],
            ['INEGI — Marco Geoestadístico', 'Cartografía, coordenadas y delimitación', 'Decreto: ene 1983']] },
  { color: '#0D9488', titulo: 'Ambiental y Riesgos', sub: 'Impacto y vulnerabilidad',
    items: [['SEMARNAT — MIA', 'Manifestación de Impacto Ambiental requerida', 'DOF: 30 nov 2000'],
            ['CENAPRED — Atlas de Riesgos', 'Vulnerabilidad: inundaciones, sismos, deslaves', 'Creado: sep 1988'],
            ['CONAGUA', 'Zonas de riesgo hídrico y aguas nacionales', 'DOF: 1 dic 1992'],
            ['INEGI — Carta Geológica', 'Tipo de suelo, topografía y estratigrafía', 'Act. continua']] },
  { color: '#6366F1', titulo: 'Estadístico / Demográfico', sub: 'Población y economía local',
    items: [['INEGI — Censo de Población y Vivienda', 'Crecimiento, densidad y composición de hogares', 'Último: 2020'],
            ['DENUE', 'Actividad económica por zona y sector productivo', 'Act. continua'],
            ['CONAPO', 'Proyecciones de población y flujos migratorios', 'Creado: 1974'],
            ['ENOE', 'Empleo, ingresos y demanda habitacional efectiva', 'Inicio: 2005']] },
]

export default function FuentesConsultadas() {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-[#E2E8E4] rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F7F8F6] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F0FBF6] border border-[#9FE1CB] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M2 7h7M2 11h5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold text-[#111d17]">Fuentes consultadas en este análisis</p>
            <p className="text-[11px] text-[#9aab9f]">32 fuentes · 8 categorías · Normativa, mercado, fiscal, registral</p>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" stroke="#9aab9f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-[#E2E8E4] px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {FUENTES_DATA.map(cat => (
              <div key={cat.titulo} className="bg-[#F7F8F6] rounded-xl border border-[#E2E8E4] overflow-hidden flex flex-col">
                <div className="px-4 pt-4 pb-3 border-b border-[#EAECEB]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                    <span className="text-[12px] font-bold text-[#111d17]">{cat.titulo}</span>
                  </div>
                  <p className="text-[10px] text-[#9aab9f] uppercase tracking-widest font-semibold pl-4">{cat.sub}</p>
                </div>
                <ul className="px-4 py-3 space-y-2.5 flex-1">
                  {cat.items.map(([nombre, uso, fecha]) => (
                    <li key={nombre}>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-[11px] font-semibold text-[#111d17] leading-tight">{nombre}</div>
                        <span className="text-[9px] text-[#b0bdb6] font-medium shrink-0 whitespace-nowrap">{fecha}</span>
                      </div>
                      <div className="text-[10px] text-[#9aab9f] mt-0.5 leading-snug">{uso}</div>
                    </li>
                  ))}
                </ul>
                <div className="px-4 pb-3">
                  <div className="h-0.5 w-5 rounded-full" style={{ background: cat.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
