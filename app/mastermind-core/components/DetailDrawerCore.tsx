'use client'

import { useMastermindCore } from '../state'
import type { BenchmarkConstruccion, TipoProyecto } from '@/lib/mastermind/tipos'
import type { MixUnidad } from '@/lib/analisis/tipos'
import Slider from '@/app/mastermind/components/Slider'
import Select from '@/app/mastermind/components/Select'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

export type LeverIdCore = 'terreno' | 'construccion' | 'administrativo' | 'volumen' | 'precio'

const TITULOS: Record<LeverIdCore, string> = {
  terreno: 'Terreno',
  construccion: 'Construcción',
  administrativo: 'Administrativo',
  volumen: 'Volumen esperado de ventas',
  precio: 'Precio',
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-1">
      <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-[15px] font-bold text-white">{value}</div>
    </div>
  )
}

// Subconjunto de app/mastermind/components/cockpit/DetailDrawer.tsx — solo las palancas que
// aplican al core (sin financiero/velocidad, esos son capa de plan financiero de Mastermind 2).
// Dos palancas se editan distinto a como lo hace Mastermind 2 porque en Mastermind 1 SÍ son el
// objetivo explícito de calibración (no solo referencia de un análisis ya corrido):
// - "terreno": en Mastermind 2 es de solo lectura (dato ya aprobado del análisis). Aquí tiene un
//   slider de costo/m² — costoTerreno se deriva multiplicando por la superficie real (fija, no
//   editable, viene del predio).
// - "construccion": slider de costoConstruccionRealM2 directo en vez de depender del benchmark.
export default function DetailDrawerCore({ leverId, mixHabitacional, totalLocales }: {
  leverId: LeverIdCore
  mixHabitacional: MixUnidad[]
  totalLocales: number
}) {
  const { inputs, outputs, setTerreno, setProyecto, setMercado } = useMastermindCore()

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
        <h4 className="text-[12px] font-bold uppercase tracking-wider text-white">{TITULOS[leverId]}</h4>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {leverId === 'terreno' && (
          <>
            <ReadOnlyRow label="Superficie" value={`${inputs.terreno.superficieM2.toLocaleString('es-MX')} m²`} />
            <Slider
              label="Costo terreno"
              value={inputs.terreno.costoTerrenoM2}
              min={500} max={50_000} step={100} unit=" MXN/m²"
              onChange={v => setTerreno({ ...inputs.terreno, costoTerrenoM2: v, costoTerreno: v * inputs.terreno.superficieM2 })}
            />
            {inputs.terreno.municipio && <ReadOnlyRow label="Municipio" value={inputs.terreno.municipio} />}
            <ReadOnlyRow label="Costo total" value={fmt(inputs.terreno.costoTerreno)} />
          </>
        )}

        {leverId === 'construccion' && (
          <>
            <Slider
              label="Costo construcción real"
              value={inputs.proyecto.costoConstruccionRealM2 ?? 0}
              min={5_000} max={60_000} step={250} unit=" MXN/m²"
              onChange={v => setProyecto({ costoConstruccionRealM2: v })}
            />
            <Slider
              label="Superficie construida real"
              value={inputs.proyecto.superficieConstruccionM2 ?? 0}
              min={0} max={100_000} step={50} unit=" m²"
              onChange={v => setProyecto({ superficieConstruccionM2: v })}
            />
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
              label="Benchmark construcción (referencia)"
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
            <p className="col-span-2 text-[10px] text-white/25 -mt-2">
              {outputs.costos.m2Construidos.toLocaleString('es-MX')} m² construidos actualmente.
              El benchmark solo se usa si &quot;Costo construcción real&quot; está en 0.
            </p>
          </>
        )}

        {leverId === 'administrativo' && (
          <>
            <Slider
              label="% Indirectos"
              value={inputs.proyecto.porcentajeIndirectos}
              min={5} max={30} step={0.5} unit="%"
              onChange={v => setProyecto({ porcentajeIndirectos: v })}
            />
            <ReadOnlyRow label="Monto indirectos" value={fmt(outputs.costos.indirectos)} />
            <Slider
              label="% Honorarios"
              value={inputs.proyecto.porcentajeHonorarios}
              min={5} max={30} step={0.5} unit="%"
              onChange={v => setProyecto({ porcentajeHonorarios: v })}
            />
            <ReadOnlyRow label="Monto honorarios" value={fmt(outputs.costos.honorarios)} />
            <Slider
              label="% Imprevistos"
              value={inputs.proyecto.porcentajeImprevistos}
              min={0} max={15} step={0.5} unit="%"
              onChange={v => setProyecto({ porcentajeImprevistos: v })}
            />
            <ReadOnlyRow label="Monto imprevistos" value={fmt(outputs.costos.imprevistos)} />
            <ReadOnlyRow label="Comercialización (3%, fijo)" value={fmt(outputs.costos.comercializacion)} />
            <p className="col-span-2 text-[10px] text-white/25 -mt-1">
              Honorarios varía por complejidad/segmento: banda popular ~7-9%, media ~9-13%, media alta ~13-20%, premium/lujo hasta 30%.
            </p>
          </>
        )}

        {leverId === 'volumen' && (
          <>
            <Slider label="Unidades habitacionales" value={inputs.proyecto.unidadesHabitacionales} min={1} max={500} onChange={v => setProyecto({ unidadesHabitacionales: v })} />
            <Slider label="m² promedio depa" value={inputs.proyecto.m2PromedioDepa} min={30} max={500} step={5} unit=" m²" onChange={v => setProyecto({ m2PromedioDepa: v })} />
            <Slider label="m² comerciales PB" value={inputs.proyecto.m2ComercialesPlantaBaja} min={0} max={2000} step={10} unit=" m²" onChange={v => setProyecto({ m2ComercialesPlantaBaja: v })} />
            <ReadOnlyRow label="m² vendibles habitacional" value={`${outputs.ingresos.m2VendiblesHabitacional.toLocaleString('es-MX')} m²`} />
          </>
        )}

        {leverId === 'precio' && (
          <>
            <Slider label="Precio venta depas" value={inputs.mercado.precioVentaDepasM2} min={5_000} max={100_000} step={500} unit=" MXN/m²" onChange={v => setMercado({ precioVentaDepasM2: v })} />
            <Slider label="Precio locales" value={inputs.mercado.precioLocalesM2} min={0} max={50_000} step={100} unit=" MXN/m²" onChange={v => setMercado({ precioLocalesM2: v })} />

            {(mixHabitacional.length > 0 || totalLocales > 0) && (
              <div className="col-span-2 mt-1">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Precio implícito por tipología — al precio/m² de arriba, no editable por separado
                </p>
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-4 bg-white/[0.04] px-3 py-1.5">
                    {['Tipo', 'Unidades', 'm² prom.', 'Precio/unidad'].map(h => (
                      <span key={h} className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{h}</span>
                    ))}
                  </div>
                  {mixHabitacional.map((m: MixUnidad, i: number) => (
                    <div key={i} className="grid grid-cols-4 px-3 py-2 border-t border-white/5">
                      <span className="text-[11px] font-semibold text-white">{m.tipo}</span>
                      <span className="text-[11px] text-white/50">{m.unidades}</span>
                      <span className="text-[11px] text-white/50">{m.m2Promedio} m²</span>
                      <span className="font-mono text-[11px] text-white/80">{fmt(m.m2Promedio * inputs.mercado.precioVentaDepasM2)}</span>
                    </div>
                  ))}
                  {totalLocales > 0 && (
                    <div className="grid grid-cols-4 px-3 py-2 border-t border-white/5 bg-white/[0.02]">
                      <span className="text-[11px] font-semibold text-white">Locales</span>
                      <span className="text-[11px] text-white/50">{totalLocales}</span>
                      <span className="text-[11px] text-white/50">—</span>
                      <span className="font-mono text-[11px] text-white/80">{fmt(inputs.mercado.precioLocalesM2)}/m²</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
