import { NextRequest, NextResponse } from 'next/server'
import { calcularPrecioCierre, type ZonaReferencia } from '@/lib/geo/landPrice'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

function sbHeaders() {
  return {
    apikey:          SUPABASE_KEY,
    Authorization:   `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
  }
}

export async function POST(req: NextRequest) {
  const { lat, lng } = await req.json() as { lat: number; lng: number }

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat y lng son requeridos' }, { status: 400 })
  }

  // Llama al RPC zona_por_punto (PostGIS point-in-polygon)
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/zona_por_punto`, {
    method:  'POST',
    headers: sbHeaders(),
    body:    JSON.stringify({ p_lat: lat, p_lng: lng }),
  })

  if (!rpcRes.ok) {
    const err = await rpcRes.text()
    return NextResponse.json(
      { error: `Error de base de datos: ${err.slice(0, 200)}` },
      { status: 502 },
    )
  }

  const rows = await rpcRes.json() as ZonaReferencia[]

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      encontrado: false,
      mensaje: 'No existe zona de referencia que contenga este punto. Agrega polígonos a zonas_referencia para esta área.',
    })
  }

  return NextResponse.json(calcularPrecioCierre(rows[0]))
}
