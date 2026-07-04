'use client'

import { useMastermind } from '../state'
import type { BenchmarkConstruccion, ModalidadLocales, TipoProyecto } from '@/lib/mastermind/tipos'
import CollapsibleSection from './CollapsibleSection'
import Slider from './Slider'

const selectCls = 'w-full text-[13px] border border-[#E2E8E4] rounded-xl px-3 py-2.5 bg-white text-[#111d17] focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]'

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="col-span-2">
      <label className="block text-[11px] font-semibold text-[#5a7065] uppercase tracking-wide mb-1.5">{label}</label>
      <select className={selectCls} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function OrigenBadge({ delAnalisis }: { delAnalisis: boolean }) {
  return delAnalisis ? (
    <span className="text-[9px] font-bold text-[#0F6E56] bg-[#E1F5EE] px-2 py-0.5 rounded-full uppercase tracking-wide">● Del análisis</span>
  ) : (
    <span className="text-[9px] font-medium text-[#9aab9f] bg-[#F0F4F2] px-2 py-0.5 rounded-full uppercase tracking-wide">○ Valor por default</span>
  )
}

export default function InputPanel({ origenAnalisis }: { origenAnalisis?: { proyecto: boolean; mercado: boolean; financiamiento: boolean } }) {
  const { inputs, errores, modoInverso, setModoInverso, setProyecto, setMercado, setTiempo, setFinanciamiento, setTirObjetivo } = useMastermind()

  return (
    <div className="space-y-4">
      {/* Terreno — solo lectura, viene del análisis */}
      <div className="bg-[#0A1F13] rounded-2xl p-5">
        <h3 className="text-[13px] font-bold text-white mb-3">Terreno (del análisis)</h3>
        <div className="grid grid-cols-2 gap-3 text-[13px] text-white/70">
          <div>Superficie: <span className="text-white font-medium">{inputs.terreno.superficieM2.toLocaleString('es-MX')} m²</span></div>
          <div>Costo terreno: <span className="text-white font-medium">${inputs.terreno.costoTerreno.toLocaleString('es-MX')}</span></div>
        </div>
      </div>

      <CollapsibleSection titulo="Proyecto" badge={<OrigenBadge delAnalisis={!!origenAnalisis?.proyecto} />}>
        <Select
          label="Tipo de proyecto"
          value={inputs.proyecto.tipoProyecto}
          onChange={v => setProyecto({ tipoProyecto: v as TipoProyecto })}
          options={[
            ['vertical_mixto', 'Vertical mixto'],
            ['horizontal', 'Horizontal'],
            ['comercial', 'Comercial'],
            ['habitacional', 'Habitacional'],
          ]}
        />
        <Select
          label="Benchmark construcción"
          value={inputs.proyecto.benchmarkConstruccion}
          onChange={v => setProyecto({ benchmarkConstruccion: v as BenchmarkConstruccion })}
          options={[
            ['habitacional_economico', 'Habitacional económico'],
            ['habitacional_medio', 'Habitacional medio'],
            ['habitacional_residencial', 'Habitacional residencial'],
            ['comercial_local', 'Comercial local'],
            ['estacionamiento_sotano', 'Estacionamiento sótano'],
            ['oficinas', 'Oficinas'],
          ]}
        />
        <Slider label="Niveles" value={inputs.proyecto.niveles} min={1} max={30} onChange={v => setProyecto({ niveles: v })} />
        <Slider label="Unidades habitacionales" value={inputs.proyecto.unidadesHabitacionales} min={1} max={500} onChange={v => setProyecto({ unidadesHabitacionales: v })} />
        <Slider label="m² promedio depa" value={inputs.proyecto.m2PromedioDepa} min={30} max={500} step={5} unit=" m²" onChange={v => setProyecto({ m2PromedioDepa: v })} />
        <Slider label="m² comerciales PB" value={inputs.proyecto.m2ComercialesPlantaBaja} min={0} max={2000} step={10} unit=" m²" onChange={v => setProyecto({ m2ComercialesPlantaBaja: v })} />
      </CollapsibleSection>

      <CollapsibleSection titulo="Mercado" badge={<OrigenBadge delAnalisis={!!origenAnalisis?.mercado} />}>
        <Slider label="Precio venta depas" value={inputs.mercado.precioVentaDepasM2} min={5_000} max={100_000} step={500} unit=" MXN/m²" onChange={v => setMercado({ precioVentaDepasM2: v })} />
        <Select
          label="Modalidad locales"
          value={inputs.mercado.modalidadLocales}
          onChange={v => setMercado({ modalidadLocales: v as ModalidadLocales })}
          options={[['venta', 'Venta'], ['renta', 'Renta']]}
        />
        <Slider label="Precio locales" value={inputs.mercado.precioLocalesM2} min={0} max={50_000} step={100} unit=" MXN/m²" onChange={v => setMercado({ precioLocalesM2: v })} />
        <Slider label="Cap rate" value={inputs.mercado.tasaCapRate} min={4} max={15} step={0.5} unit="%" onChange={v => setMercado({ tasaCapRate: v })} />
      </CollapsibleSection>

      <CollapsibleSection titulo="Tiempo">
        <Slider label="Plazo obra" value={inputs.tiempo.plazoObraMeses} min={6} max={60} unit=" meses" onChange={v => setTiempo({ plazoObraMeses: v })} />
        <Slider label="Plazo venta" value={inputs.tiempo.plazoVentaMeses} min={6} max={60} unit=" meses" onChange={v => setTiempo({ plazoVentaMeses: v })} />
        <Slider label="Inicio ventas" value={inputs.tiempo.inicioVentasMes} min={0} max={60} unit=" mes" onChange={v => setTiempo({ inicioVentasMes: v })} />
      </CollapsibleSection>

      <CollapsibleSection titulo="Financiamiento" badge={<OrigenBadge delAnalisis={!!origenAnalisis?.financiamiento} />}>
        <Slider label="% financiado" value={inputs.financiamiento.porcentajeFinanciado} min={0} max={90} step={5} unit="%" onChange={v => setFinanciamiento({ porcentajeFinanciado: v })} />
        <Slider label="Tasa anual crédito" value={inputs.financiamiento.tasaAnualCredito} min={5} max={25} step={0.5} unit="%" onChange={v => setFinanciamiento({ tasaAnualCredito: v })} />
      </CollapsibleSection>

      <CollapsibleSection titulo="TIR objetivo">
        <Slider label="TIR objetivo" value={inputs.tirObjetivo} min={5} max={60} unit="%" onChange={setTirObjetivo} />
        <label className="col-span-2 flex items-center gap-2.5 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={modoInverso}
            onChange={e => setModoInverso(e.target.checked)}
            className="w-4 h-4 accent-[#1D9E75] cursor-pointer"
          />
          <span className="text-[12px] font-medium text-[#111d17]">Modo ingeniería inversa</span>
        </label>
      </CollapsibleSection>

      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-[12px] font-semibold text-red-700 mb-1">Revisa estos campos:</p>
          <ul className="text-[12px] text-red-700 list-disc pl-4 space-y-0.5">
            {errores.map(err => <li key={err.campo}>{err.mensaje}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
