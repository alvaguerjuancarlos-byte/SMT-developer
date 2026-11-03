// Comparables de RENTA de minibodegas (self storage) — la variante de comparables-venta para
// el producto minibodegas (ver lib/producto/minibodegas.ts). Misma mecánica que venta: Serper
// + Haiku que cita el texto exacto + verificarCampo; cambia qué se busca (renta mensual de una
// bodega de cierto tamaño) y el rango plausible (renta/m²/mes, no precio de venta/m²).

import type Anthropic from '@anthropic-ai/sdk'
import { callClaudeJson } from '@smt/shared-realestate'
import { buscarSerper, formatearResultados, numeroDeFuente, portalDeUrl, verificarCampo, type MotivoDescarte } from './serperComparables'
import { SUPUESTOS_MINIBODEGAS } from '@/lib/producto/minibodegas'
import type { ComparableVenta } from './validarComparableVenta'

const MAX_M2_MINIBODEGA = 50

export interface ComparableRentaMinibodega extends ComparableVenta {
  // precioM2 = renta mensual por m²; precioTotal = renta mensual de esa bodega.
  unidadPrecio: 'renta_m2_mes'
}

export async function buscarRentasMinibodegas(
  client: Anthropic,
  serperKey: string,
  { colonia, ciudad, estado }: { colonia?: string; ciudad?: string; estado?: string },
): Promise<{ comparables: ComparableRentaMinibodega[]; descartados: number; descartes: Partial<Record<MotivoDescarte, number>>; lugar: string }> {
  const lugar = [colonia, ciudad, estado].filter(Boolean).join(' ')
  const queries = [
    `minibodegas renta ${ciudad} precio`,
    `minibodegas ${colonia} ${ciudad}`,
    `self storage ${ciudad} ${estado} precios bodega m2`,
    `renta de bodegas pequeñas ${ciudad} precio mensual m2`,
    `mini bodegas ${ciudad} renta mensual site:facebook.com OR site:inmuebles24.com OR site:vivanuncios.com.mx`,
    `bodegas personales ${ciudad} renta 3x3 precio`,
    `storage ${ciudad} renta de bodega por mes`,
  ]

  const resultados = await buscarSerper(queries, serperKey)
  const vacio = { comparables: [], descartados: 0, descartes: {}, lugar }
  if (resultados.length === 0) return vacio

  const prompt = `Analiza estos resultados de búsqueda de Google sobre MINIBODEGAS (self storage, bodegas chicas en renta) en ${lugar}.
Cada resultado tiene un número entre corchetes y solo incluye el TEXTO que Google muestra.

RESULTADOS:
${formatearResultados(resultados)}

Para cada bodega en RENTA con precio que aparezca (un sitio puede listar varios tamaños: un objeto por tamaño) regresa:
- fuente: número del resultado entre corchetes
- tipoAnuncio: "individual" si el TEXTO da la renta de una bodega o tamaño concreto; "varios" si solo es un resumen ("bodegas desde $990"); "otro" si es venta, bodega comercial o nave de más de ${MAX_M2_MINIBODEGA} m², o no es un anuncio
- nombre: nombre del negocio de minibodegas o descripción corta
- direccion: dirección o colonia si aparece, si no ""
- colonia: colonia si aparece, null si no
- rentaMensual: renta mensual en MXN de esa bodega, o null
- citaRentaMensual: fragmento EXACTO, copiado letra por letra del TEXTO, que contiene esa renta, o null
- rentaM2Mes: renta mensual por m² SOLO si el texto la dice explícitamente, o null
- citaRentaM2Mes: fragmento exacto que la contiene, o null
- superficieM2: tamaño de la bodega en m², o null
- citaSuperficie: fragmento exacto que lo contiene (ej. "6 m²", "2x3 m"), o null
- fechaReferencia: fecha o periodo si aparece, si no ""

Reglas estrictas:
- NO calcules, estimes ni completes números: si un dato no aparece escrito en el TEXTO, va null
- Solo RENTA mensual (no venta, no precio por día; si el precio es semanal o anual, null)
- "desde", "a partir de" no son la renta de un tamaño concreto: null
- Máximo 15 objetos
- Retorna ÚNICAMENTE un array JSON válido, sin markdown`

  const extraidos: any[] = await callClaudeJson(client, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  }, /\[[\s\S]*\]/)

  const descartes: Partial<Record<MotivoDescarte, number>> = {}
  const descartar = (m: MotivoDescarte) => { descartes[m] = (descartes[m] ?? 0) + 1 }
  const vistos = new Set<string>()
  const comparables: ComparableRentaMinibodega[] = []
  const { rentaM2MesMin, rentaM2MesMax } = SUPUESTOS_MINIBODEGAS

  for (const x of extraidos) {
    const fuente = resultados.find(r => r.id === numeroDeFuente(x?.fuente))
    if (!fuente) { descartar('sin_evidencia'); continue }
    if (x.tipoAnuncio !== 'individual' && x.tipoAnuncio !== 'varios') { descartar('no_aplica'); continue }

    // Sin esPrecio: aquí "al mes"/"mensual" SÍ es el dato que buscamos.
    const rentaMensual = verificarCampo(x.rentaMensual, x.citaRentaMensual, fuente.texto)
    const superficieM2 = verificarCampo(x.superficieM2, x.citaSuperficie, fuente.texto)
    let rentaM2Mes = verificarCampo(x.rentaM2Mes, x.citaRentaM2Mes, fuente.texto)
    if (!rentaM2Mes && rentaMensual && superficieM2) rentaM2Mes = Math.round(rentaMensual / superficieM2)
    // Una bodega comercial de 100+ m² renta mucho más barato por m² que una minibodega de 3–15 m²
    // (visto en Culiacán: bodegas de 105 y 250 m² a $88–$124/m²/mes hundían la renta del modelo).
    if (superficieM2 && superficieM2 > MAX_M2_MINIBODEGA) { descartar('no_aplica'); continue }
    if (!rentaM2Mes) { descartar(x.tipoAnuncio === 'varios' ? 'varios_anuncios' : 'sin_precio'); continue }
    if (rentaM2Mes < rentaM2MesMin || rentaM2Mes > rentaM2MesMax) { descartar('fuera_de_rango'); continue }

    // El mismo anuncio se publica en varios grupos de Facebook: se repite tamaño y renta, no la URL.
    const clave = superficieM2 && rentaMensual ? `${superficieM2}|${rentaMensual}` : `${fuente.url}|${rentaM2Mes}`
    if (vistos.has(clave)) { descartar('repetido'); continue }
    vistos.add(clave)

    comparables.push({
      nombre: x.nombre || fuente.titulo,
      direccion: x.direccion || portalDeUrl(fuente.url),
      colonia: x.colonia ?? null,
      precioM2: rentaM2Mes,
      precioTotal: rentaMensual,
      superficieM2,
      tipologia: superficieM2 ? `Bodega ${superficieM2} m²${rentaMensual ? ` · $${rentaMensual.toLocaleString('es-MX')}/mes` : ''}` : null,
      avanceObra: null,
      fechaReferencia: x.fechaReferencia || '',
      url: fuente.url,
      origen: 'web_search',
      unidadPrecio: 'renta_m2_mes',
    })
  }

  const descartados = Object.values(descartes).reduce((a, b) => a + (b ?? 0), 0)
  return { comparables: comparables.slice(0, 10), descartados, descartes, lugar }
}
