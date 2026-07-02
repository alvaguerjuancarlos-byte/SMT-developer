'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MLListing } from '@/app/api/scout/ml/route'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México',
  'Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
]

function fmtPrecio(precio: number, moneda: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(precio)
}

export default function ScoutPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [estado, setEstado]     = useState('')
  const [municipio, setMunicipio] = useState('')
  const [colonia, setColonia]   = useState('')
  const [cp, setCp]             = useState('')

  const [results, setResults]   = useState<MLListing[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState<MLListing | null>(null)

  async function buscar() {
    if (!estado) return
    setLoading(true)
    setError('')
    setResults(null)
    setSelected(null)
    try {
      const params = new URLSearchParams({ estado })
      if (municipio) params.set('municipio', municipio)
      if (colonia) params.set('colonia', colonia)
      if (cp) params.set('cp', cp)
      const res = await fetch(`/api/scout/ml?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al buscar'); return }
      setResults(json.results)
      setTotal(json.total)
      setQuery(json.query)
      // Guardar para uso en Flujo A como comparables
      if (json.results?.length > 0) {
        localStorage.setItem('smt_scout_comparables', JSON.stringify({
          comparables: json.results.map((r: any) => ({
            portal: r.portal ?? '',
            colonia: r.ubicacion?.colonia ?? '',
            superficieM2: r.superficie ?? null,
            precioM2: r.superficie && r.precio ? Math.round(r.precio / r.superficie) : null,
            precioTotal: r.precio ?? null,
            distanciaRef: 'Scout',
            fechaPublicacion: new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
            url: r.urlAnuncio ?? '',
            titulo: r.titulo ?? '',
          })),
          zona: json.query,
          timestamp: Date.now(),
        }))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function analizarTerreno() {
    if (!selected) return
    // Guardar datos del terreno seleccionado para pre-cargar en Flujo A
    const prefill = {
      nombreProyecto: selected.titulo.slice(0, 60),
      lat: selected.ubicacion.lat,
      lng: selected.ubicacion.lng,
      direccion: selected.ubicacion.direccion,
      colonia: selected.ubicacion.colonia,
      ciudad: selected.ubicacion.municipio,
      estado: selected.ubicacion.estado,
      codigoPostal: selected.ubicacion.cp,
      superficie: selected.superficie ? String(selected.superficie) : '',
      frente: selected.frente ? String(selected.frente) : '',
      precioSolicitado: selected.precio ? String(selected.precio) : '',
      fuenteUrl: selected.urlAnuncio,
      fuenteNombre: 'MercadoLibre',
    }
    localStorage.setItem('smt_scout_prefill', JSON.stringify(prefill))
    startTransition(() => router.push('/prospeccion/flujo-a?origen=scout'))
  }

  return (
    <div className="min-h-screen bg-[#0C0F0E]">

      {/* Breadcrumb */}
      <div className="px-6 pt-6 pb-0 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-[12px] text-white/30">
          <button onClick={() => router.push('/prospeccion')} className="text-[#1D9E75] font-medium hover:underline">
            Nueva oportunidad
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <span className="text-white font-medium">Scout · Portales inmobiliarios</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <span>Análisis</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-white mb-1">Buscar terreno en plataformas inmobiliarias</h1>
          <p className="text-[14px] text-white/50">
            Encuentra un terreno en venta en Lamudi, Inmuebles24 y más — selecciona uno y lánzalo al análisis.
          </p>
        </div>

        {/* Formulario de búsqueda */}
        <div className="bg-white rounded-2xl border border-[#E2E8E4] p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">

            {/* Estado — requerido */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[11px] font-semibold text-[#5a7065] uppercase tracking-wide mb-1.5">
                Estado <span className="text-[#1D9E75]">*</span>
              </label>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value)}
                className="w-full text-[13px] border border-[#E2E8E4] rounded-xl px-3 py-2.5 bg-white text-[#111d17] focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
              >
                <option value="">Selecciona estado</option>
                {ESTADOS_MX.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Municipio — opcional */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5a7065] uppercase tracking-wide mb-1.5">
                Municipio <span className="text-[#9aab9f] font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={municipio}
                onChange={e => setMunicipio(e.target.value)}
                placeholder="Ej. Monterrey"
                className="w-full text-[13px] border border-[#E2E8E4] rounded-xl px-3 py-2.5 placeholder-[#C4CEC8] focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
              />
            </div>

            {/* Colonia — opcional */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5a7065] uppercase tracking-wide mb-1.5">
                Colonia <span className="text-[#9aab9f] font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={colonia}
                onChange={e => setColonia(e.target.value)}
                placeholder="Ej. Del Valle"
                className="w-full text-[13px] border border-[#E2E8E4] rounded-xl px-3 py-2.5 placeholder-[#C4CEC8] focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
              />
            </div>

            {/* CP — opcional */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5a7065] uppercase tracking-wide mb-1.5">
                Código postal <span className="text-[#9aab9f] font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={cp}
                onChange={e => setCp(e.target.value)}
                placeholder="Ej. 64000"
                maxLength={5}
                className="w-full text-[13px] border border-[#E2E8E4] rounded-xl px-3 py-2.5 placeholder-[#C4CEC8] focus:outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
              />
            </div>
          </div>

          <button
            onClick={buscar}
            disabled={!estado || loading}
            className={`w-full py-3 rounded-xl text-[14px] font-medium transition-all ${
              !estado || loading
                ? 'bg-[#E2E8E4] text-[#9aab9f] cursor-not-allowed'
                : 'bg-[#1D9E75] text-white hover:bg-[#0F6E56] cursor-pointer'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Buscando en portales…
              </span>
            ) : 'Buscar terrenos'}
          </button>
        </div>

        {/* Banner "Ya tengo mi terreno" — aparece cuando hay resultados */}
        {results !== null && results.length > 0 && (
          <div className="bg-[#0A1F13] rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold text-[14px] mb-0.5">¿Ya tienes un terreno en mente?</p>
              <p className="text-white/50 text-[12px]">
                Estas {results.length} referencias quedan guardadas para calibrar la valuación en Flujo A.
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('smt_scout_prefill', JSON.stringify({
                  estado, ciudad: municipio, colonia, codigoPostal: cp,
                }))
                router.push('/prospeccion/flujo-a?origen=scout')
              }}
              className="flex-shrink-0 bg-[#1D9E75] text-white text-[13px] font-medium px-5 py-2.5 rounded-xl hover:bg-[#0F6E56] transition-colors whitespace-nowrap"
            >
              Analizar mi terreno →
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-[13px] mb-6">
            {error}
          </div>
        )}

        {/* Resultados */}
        {results !== null && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-[#5a7065]">
                <span className="font-semibold text-[#111d17]">{total.toLocaleString()}</span> terrenos encontrados
                {query && <> para <span className="text-[#1D9E75] font-medium">"{query}"</span></>}
              </p>
              {selected && (
                <button
                  onClick={analizarTerreno}
                  disabled={isPending}
                  className="flex items-center gap-2 bg-[#1D9E75] text-white text-[13px] font-medium px-4 py-2 rounded-xl hover:bg-[#0F6E56] transition-colors"
                >
                  {isPending ? 'Cargando…' : 'Analizar este terreno →'}
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2E8E4] p-12 text-center">
                <p className="text-[#9aab9f] text-[14px]">No se encontraron terrenos con esos criterios.</p>
                <p className="text-[12px] text-[#C4CEC8] mt-1">Prueba con un municipio diferente o deja los campos opcionales vacíos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(s => s?.id === item.id ? null : item)}
                    className={`text-left bg-white rounded-2xl border transition-all duration-150 overflow-hidden group ${
                      selected?.id === item.id
                        ? 'border-[#1D9E75] shadow-[0_0_0_2px_#1D9E75]'
                        : 'border-[#E2E8E4] hover:border-[#9FE1CB] hover:shadow-sm'
                    }`}
                  >
                    {/* Foto */}
                    {item.foto && (
                      <div className="h-36 overflow-hidden bg-[#F0F4F2]">
                        <img src={item.foto} alt={item.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}

                    <div className="p-4">
                      {/* Precio */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[18px] font-bold text-[#111d17] leading-tight">
                          {fmtPrecio(item.precio, item.moneda)}
                        </p>
                        {selected?.id === item.id && (
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1D9E75] flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                        )}
                      </div>

                      {/* Portal + Título */}
                      {item.portal && (
                        <p className="text-[10px] font-semibold text-[#9aab9f] uppercase tracking-wide mb-1">{item.portal}</p>
                      )}
                      <p className="text-[13px] text-[#5a7065] leading-snug mb-3 line-clamp-2">{item.titulo}</p>

                      {/* Chips de datos */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.superficie && (
                          <span className="text-[11px] px-2 py-1 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#5DCAA5]/40">
                            {item.superficie.toLocaleString()} m²
                          </span>
                        )}
                        {item.frente && (
                          <span className="text-[11px] px-2 py-1 rounded-full bg-[#E1F5EE] text-[#0F6E56] border border-[#5DCAA5]/40">
                            {item.frente} m frente
                          </span>
                        )}
                        {item.superficie && item.precio > 0 && (
                          <span className="text-[11px] px-2 py-1 rounded-full bg-[#F0F4F2] text-[#5a7065]">
                            {fmtPrecio(Math.round(item.precio / item.superficie), item.moneda)}/m²
                          </span>
                        )}
                      </div>

                      {/* Ubicación */}
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3.5 h-3.5 text-[#9aab9f] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <p className="text-[12px] text-[#9aab9f] leading-snug">
                          {[item.ubicacion.colonia, item.ubicacion.municipio, item.ubicacion.estado].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Botón analizar fijo abajo cuando hay selección */}
            {selected && (
              <div className="sticky bottom-6 mt-6 flex justify-center">
                <div className="bg-white rounded-2xl border border-[#1D9E75] shadow-lg px-6 py-4 flex items-center gap-4 max-w-lg w-full">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#5a7065]">Terreno seleccionado · {selected.portal}</p>
                    <p className="text-[13px] font-semibold text-[#111d17] truncate">{selected.titulo}</p>
                    {selected.urlAnuncio && (
                      <a href={selected.urlAnuncio} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#1D9E75] hover:underline truncate block">
                        Ver anuncio original →
                      </a>
                    )}
                  </div>
                  <button
                    onClick={analizarTerreno}
                    disabled={isPending}
                    className="flex-shrink-0 bg-[#1D9E75] text-white text-[13px] font-medium px-5 py-2.5 rounded-xl hover:bg-[#0F6E56] transition-colors"
                  >
                    {isPending ? 'Cargando…' : 'Analizar →'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
