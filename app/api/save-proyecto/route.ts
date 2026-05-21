import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY!

export async function POST(req: NextRequest) {
  const { nombre, datos, flujo } = await req.json()
  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

  console.log('[save-proyecto] SUPABASE_URL:', SUPABASE_URL || 'UNDEFINED')
  console.log('[save-proyecto] SERVICE_KEY set:', !!SERVICE_KEY)
  console.log('[save-proyecto] Guardando:', nombre, 'flujo:', flujo)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/proyectos`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      nombre,
      datos: datos ?? {},
      flujo: flujo || 'A',
      status: 'en-revision',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[save-proyecto] Supabase error', res.status, text)
    return NextResponse.json({ error: text }, { status: res.status })
  }

  const data = await res.json()
  console.log('[save-proyecto] OK, id:', data[0]?.id)
  return NextResponse.json({ ok: true, id: data[0]?.id })
}
