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
import { buscarPrediosCercanos, areaM2DesdeAnillo } from '@/lib/terreno/parcelResolver'
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
      const componentes = construirComponentesMatch(
        { claveLote: p.claveLote, ubicacion: p.ubicacion, colonia: p.colonia, areaM2, anillo: p.anillo },
        { lat, lng, direccion, colonia, superficieDeclaradaM2 },
      )
      return {
        id: p.claveLote ?? `predio-${i}`,
        componentes,
        predio: { claveLote: p.claveLote, region: p.region, manzana: p.manzana, lote: p.lote, ubicacion: p.ubicacion, colonia: p.colonia, areaM2 },
      }
    })

    const resultado = resolverSeleccionParcela(candidatos)
    return NextResponse.json({ ...resultado, totalConsultados: predios.length })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    console.error('Parcela (GeoServer SPGG) error:', mensaje)
    return NextResponse.json({ error: mensaje }, { status: 502 })
  }
}
