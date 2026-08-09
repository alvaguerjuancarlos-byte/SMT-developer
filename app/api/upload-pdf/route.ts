import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY!

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const { proyectoId, pdfBase64 } = await req.json()
  if (!proyectoId || !pdfBase64) {
    return NextResponse.json({ error: 'proyectoId y pdfBase64 requeridos' }, { status: 400 })
  }

  const buffer = Buffer.from(pdfBase64, 'base64')
  const path   = `${proyectoId}.pdf`

  // Upload (upsert) to Storage bucket "propuestas"
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/propuestas/${path}`, {
    method: 'POST',
    headers: {
      'apikey':         SERVICE_KEY,
      'Authorization':  `Bearer ${SERVICE_KEY}`,
      'Content-Type':   'application/pdf',
      'x-upsert':       'true',
    },
    body: buffer,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    return NextResponse.json({ error: `Storage error: ${text}` }, { status: uploadRes.status })
  }

  const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/propuestas/${path}`

  // Save URL in proyectos record
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/proyectos?id=eq.${proyectoId}`, {
    method: 'PATCH',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ pdf_url: pdfUrl }),
  })

  if (!updateRes.ok) {
    const text = await updateRes.text()
    return NextResponse.json({ error: `DB error: ${text}` }, { status: updateRes.status })
  }

  return NextResponse.json({ ok: true, pdfUrl })
}
