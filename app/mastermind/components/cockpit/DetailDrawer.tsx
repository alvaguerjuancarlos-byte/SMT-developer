'use client'

import { useMastermind } from '../../state'
import type { BenchmarkConstruccion, TipoProyecto } from '@/lib/mastermind/tipos'
import Slider from '../Slider'
import Select from '../Select'
import type { LeverId } from './types'

function fmt(n: number) { return `$${Math.round(n).toLocaleString('es-MX')}` }

const TITULOS: Record<LeverId, string> = {
  terreno: 'Terreno',
  construccion: 'Construcción',
  administrativo: 'Administrativo',
  financiero: 'Financiero',
  volumen: 'Volumen esperado de ventas',
  precio: 'Precio',
  velocidad: 'Velocidad de venta',
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-1">
      <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-[15px] font-bold text-white">{value}</div>
    </div>
  )
}

export default function DetailDrawer({ leverId, origenAnalisis }: {
  leverId: LeverId
  origenAnalisis?: { proyecto: boolean; mercado: boolean; financiamiento: boolean; costos: boolean; tiempo: boolean }
}) {
  const { inputs, outputs, setProyecto, setMercado, setTiempo, setFinanciamiento } = useMastermind()

  const delAnalisis =
    leverId === 'construccion' ? origenAnalisis?.proyecto :
    leverId === 'volumen' ? origenAnalisis?.proyecto :
    leverId === 'precio' ? origenAnalisis?.mercado :
    leverId === 'financiero' ? origenAnalisis?.financiamiento :
    leverId === 'administrativo' ? origenAnalisis?.costos :
    leverId === 'velocidad' ? origenAnalisis?.tiempo :
    undefined

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
        <h4 className="text-[12px] font-bold uppercase tracking-wider text-white">{TITULOS[leverId]}</h4>
        {delAnalisis !== undefined && (
          delAnalisis ? (
            <span className="text-[9px] font-bold text-[#1D9E75] bg-[#1D9E75]/10 px-2 py-0.5 rounded-full uppercase tracking-wide">● Del análisis</span>
          ) : (
            <span className="text-[9px] font-medium text-white/30 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wide">○ Valor por default</span>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {leverId === 'terreno' && (
          <>
            <ReadOnlyRow label="Superficie" value={`${inputs.terreno.superficieM2.toLocaleString('es-MX')} m²`} />
            <ReadOnlyRow label="Costo terreno" value={fmt(inputs.terreno.costoTerreno)} />
            {inputs.terreno.municipio && <ReadOnlyRow label="Municipio" value={inputs.terreno.municipio} />}
            <p className="col-span-2 text-[10px] text-white/25 mt-1">Viene del análisis original — no editable aquí.</p>
          </>
        )}

        {leverId === 'construccion' && (
          <>
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
            <Slider
              label="Superficie construida real"
              value={inputs.proyecto.superficieConstruccionM2 ?? 0}
              min={0} max={100_000} step={50} unit=" m²"
              onChange={v => setProyecto({ superficieConstruccionM2: v })}
            />
            <p className="col-span-2 text-[10px] text-white/25 -mt-2">
              En 0, el motor estima m² construidos como superficie de terreno × niveles (asume 100% de cobertura de lote).
              Con un valor {'>'} 0, usa ese número real en su lugar — {outputs.costos.m2Construidos.toLocaleString('es-MX')} m² construidos actualmente.
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
              Los 3 % se calibran del análisis (cada rubro / costo de construcción) cuando está disponible, si no usan los defaults del catálogo.
              Honorarios varía más por complejidad/segmento: banda popular ~7-9%, media ~9-13%, media alta ~13-20%, premium/lujo hasta 30%.
              Comercialización se queda fija en 3% del ingreso neto para todo proyecto — el análisis no la modela por separado.
            </p>
          </>
        )}

        {leverId === 'financiero' && (
          <>
            <Slider label="% financiado" value={inputs.financiamiento.porcentajeFinanciado} min={0} max={90} step={5} unit="%" onChange={v => setFinanciamiento({ porcentajeFinanciado: v })} />
            <Slider label="Tasa anual crédito" value={inputs.financiamiento.tasaAnualCredito} min={5} max={25} step={0.5} unit="%" onChange={v => setFinanciamiento({ tasaAnualCredito: v })} />
            <Slider label="Plazo obra" value={inputs.tiempo.plazoObraMeses} min={6} max={60} unit=" meses" onChange={v => setTiempo({ plazoObraMeses: v })} />
            <ReadOnlyRow label="Aportación socios (equity)" value={fmt(outputs.retorno.inversionSocios)} />
            <ReadOnlyRow label="Monto financiado (banco)" value={fmt(outputs.retorno.inversionProyecto - outputs.retorno.inversionSocios)} />
            <ReadOnlyRow label="Costo financiero (interés)" value={fmt(outputs.costos.financieros)} />
            <p className="col-span-2 text-[10px] text-white/25 -mt-1">
              El banco cobra su parte (principal) con el producto de las ventas, además del interés — la TIR Socio ya lo descuenta.
            </p>
          </>
        )}

        {leverId === 'volumen' && (
          <>
            <Slider label="Unidades habitacionales" value={inputs.proyecto.unidadesHabitacionales} min={1} max={500} onChange={v => setProyecto({ unidadesHabitacionales: v })} />
            <Slider label="m² comerciales PB" value={inputs.proyecto.m2ComercialesPlantaBaja} min={0} max={2000} step={10} unit=" m²" onChange={v => setProyecto({ m2ComercialesPlantaBaja: v })} />
            <ReadOnlyRow label="m² vendibles habitacional" value={`${outputs.ingresos.m2VendiblesHabitacional.toLocaleString('es-MX')} m²`} />
            <ReadOnlyRow label="m² vendibles comercial" value={`${outputs.ingresos.m2VendiblesComercial.toLocaleString('es-MX')} m²`} />
          </>
        )}

        {leverId === 'precio' && (
          <>
            <Slider label="Precio venta depas" value={inputs.mercado.precioVentaDepasM2} min={5_000} max={100_000} step={500} unit=" MXN/m²" onChange={v => setMercado({ precioVentaDepasM2: v })} />
            <Slider label="Precio locales" value={inputs.mercado.precioLocalesM2} min={0} max={50_000} step={100} unit=" MXN/m²" onChange={v => setMercado({ precioLocalesM2: v })} />
          </>
        )}

        {leverId === 'velocidad' && (
          <>
            <Slider label="Plazo venta" value={inputs.tiempo.plazoVentaMeses} min={6} max={60} unit=" meses" onChange={v => setTiempo({ plazoVentaMeses: v })} />
            <Slider label="Inicio ventas" value={inputs.tiempo.inicioVentasMes} min={0} max={60} unit=" mes" onChange={v => setTiempo({ inicioVentasMes: v })} />
          </>
        )}
      </div>
    </div>
  )
}
