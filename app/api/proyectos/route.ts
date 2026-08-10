import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY!

export async function GET(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const fetchProyectos = async (withPdfUrl: boolean) =>
    fetch(
      `${SUPABASE_URL}/rest/v1/proyectos?usuario_id=eq.${user.id}&select=id,nombre,status,flujo,datos${withPdfUrl ? ',pdf_url' : ''},created_at&order=created_at.desc`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        cache: 'no-store',
      }
    )

  let res = await fetchProyectos(true)

  // If pdf_url column doesn't exist yet, retry without it
  if (!res.ok) {
    const text = await res.text()
    if (text.includes('pdf_url')) {
      res = await fetchProyectos(false)
    }
    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: errText }, { status: res.status })
    }
  }

  const data = await res.json()
  return NextResponse.json(Array.isArray(data) ? data : [])
}
