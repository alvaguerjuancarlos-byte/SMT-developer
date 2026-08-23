import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY!

// Sube el plano/predial que el usuario aporta para su terreno (PREFORMA, Bloque 2 — 2.3).
// Mismo bucket "propuestas" y mecanismo que app/api/upload-pdf/route.ts (que sube el PDF de
// salida de la propuesta), con un sufijo de path distinto para no pisarlo. La URL resultante
// se guarda en form.planoUrl del lado del cliente y viaja con el autoguardado normal del
// proyecto — este endpoint solo sube el archivo, no toca la tabla proyectos.
//
// No extrae el polígono del PDF — eso es "objetivo final" en el documento de mejoras (§2.2),
// no algo que este endpoint deba resolver.
export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const { proyectoId, pdfBase64 } = await req.json()
  if (!proyectoId || !pdfBase64) {
    return NextResponse.json({ error: 'proyectoId y pdfBase64 requeridos' }, { status: 400 })
  }

  const buffer = Buffer.from(pdfBase64, 'base64')
  const path = `${proyectoId}-plano.pdf`

  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/propuestas/${path}`, {
    method: 'POST',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/pdf',
      'x-upsert':      'true',
    },
    body: buffer,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    return NextResponse.json({ error: `Storage error: ${text}` }, { status: uploadRes.status })
  }

  const planoUrl = `${SUPABASE_URL}/storage/v1/object/public/propuestas/${path}`
  return NextResponse.json({ ok: true, planoUrl })
}
