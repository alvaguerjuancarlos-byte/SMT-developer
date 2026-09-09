// ParcelResolver real — encadena parcelResolver.ts (consulta al GeoServer municipal de San
// Pedro Garza García) con parcelMatchScore.ts (score de identificación, ya construido). Primer
// punto de entrada real a lib/terreno/parcelMatchScore.ts — hasta hoy no tenía ningún candidato
// real que evaluar.
//
// Alcance: solo San Pedro Garza García (el único GeoServer verificado). Para otros municipios,
// buscarPrediosCercanos() nunca se llama — el caller decide si el predio cae en SPGG antes de
// invocar esta ruta (ej. por form.ciudad/estado).

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import { buscarPrediosCercanos, buscarBanquetasCercanas, areaM2DesdeAnillo, perimetroMDesdeAnillo, verticesLocalesDesdeAnillo, simplificarVerticesColineales, longitudesLadosDesdeVertices, aLocalXY, recortarSegmentosCercanos, type VerticeLocal } from '@/lib/terreno/parcelResolver'
import { construirComponentesMatch, resolverSeleccionParcela, type CandidatoParcela } from '@/lib/terreno/parcelMatchScore'

interface CandidatoConPredio extends CandidatoParcela {
  predio: {
    claveLote: string | null
    region: string | null
    manzana: string | null
    lote: string | null
    ubicacion: string | null
    colonia: string | null
    areaM2: number | null
    perimetroM: number | null
    ladosM: number[] | null
    verticesM: VerticeLocal[] | null
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const { lat, lng, direccion, colonia, superficieDeclaradaM2 } = await req.json()
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'Se requieren lat/lng numéricos.' }, { status: 400 })
  }

  try {
    const predios = await buscarPrediosCercanos(lat, lng)

    const candidatos: CandidatoConPredio[] = predios.map((p, i) => {
      const areaM2 = areaM2DesdeAnillo(p.anillo, lat)
      const perimetroM = perimetroMDesdeAnillo(p.anillo, lat)
      // Vértices para el croquis (PlanoTerreno) y la lista de lados, simplificados -- los
      // casi-colineales son ruido de digitalización del catastro, no esquinas reales (ver
      // comentario en simplificarVerticesColineales). areaM2/perimetroM arriba SIGUEN calculados
      // sobre el anillo completo sin simplificar -- son la medida real, no un dibujo.
      // Ojo: si un lado es en realidad una curva real (frente a calle curva digitalizada como
      // decenas de micro-segmentos), esto la reduce a su cuerda recta -- correcto para un croquis
      // semitécnico, pero la suma de ladosM puede quedar unos metros por debajo de perimetroM en
      // ese caso (verificado con un predio real: 109.2 m de lados vs 117.4 m de perímetro real,
      // ~7%, un solo frente curvo). No es un error de cálculo -- perimetroM sigue siendo la
      // medida real y se muestra aparte, nunca se oculta la diferencia.
      const verticesCrudos = verticesLocalesDesdeAnillo(p.anillo, lat)
      const verticesM = verticesCrudos ? simplificarVerticesColineales(verticesCrudos) : null
      const ladosM = verticesM ? longitudesLadosDesdeVertices(verticesM) : null
      const componentes = construirComponentesMatch(
        { claveLote: p.claveLote, ubicacion: p.ubicacion, colonia: p.colonia, areaM2, anillo: p.anillo },
        { lat, lng, direccion, colonia, superficieDeclaradaM2 },
      )
      return {
        id: p.claveLote ?? `predio-${i}`,
        componentes,
        predio: { claveLote: p.claveLote, region: p.region, manzana: p.manzana, lote: p.lote, ubicacion: p.ubicacion, colonia: p.colonia, areaM2, perimetroM, ladosM, verticesM },
      }
    })

    const resultado = resolverSeleccionParcela(candidatos)

    // Trazo real de la vialidad (banquetas del catastro) junto al predio ganador -- una consulta
    // extra, solo para el candidato ya resuelto (no uno por cada candidato evaluado). Si el
    // GeoServer falla aquí, no se cae toda la respuesta -- el croquis simplemente se dibuja sin
    // el trazo de calle, como pasaba antes de este feature.
    let calleTrazo: VerticeLocal[][] | null = null
    if (resultado.status === 'AUTO_RESOLVED' && resultado.seleccionado) {
      // clasificarCandidatos hace un spread (no conserva el tipo CandidatoConPredio en el
      // checker), pero sí conserva el campo `predio` en el objeto real -- cast seguro.
      const seleccionado = resultado.seleccionado as unknown as CandidatoConPredio
      const idxGanador = candidatos.findIndex(c => c.id === seleccionado.id)
      const ganador = idxGanador >= 0 ? predios[idxGanador] : null
      const verticesGanador = seleccionado.predio.verticesM
      if (ganador && ganador.anillo.length > 0 && verticesGanador && verticesGanador.length > 0) {
        try {
          const [lng0, lat0] = ganador.anillo[0]
          const lineas = await buscarBanquetasCercanas(lat, lng)
          const lineasLocal = lineas.map(linea => linea.map(([lngV, latV]) => aLocalXY(lngV, latV, lng0, lat0, lat)))
          const centroide = {
            x: verticesGanador.reduce((s: number, v) => s + v.x, 0) / verticesGanador.length,
            y: verticesGanador.reduce((s: number, v) => s + v.y, 0) / verticesGanador.length,
          }
          const recortado = recortarSegmentosCercanos(lineasLocal, centroide, 35)
          if (recortado.length > 0) calleTrazo = recortado
        } catch (e) {
          console.error('Vialidad (GeoServer SPGG, vu:banqueta) error (no crítico, se omite el trazo):', e)
        }
      }
    }

    return NextResponse.json({ ...resultado, totalConsultados: predios.length, calleTrazo })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    console.error('Parcela (GeoServer SPGG) error:', mensaje)
    return NextResponse.json({ error: mensaje }, { status: 502 })
  }
}
