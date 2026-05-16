import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = 'sb_secret_uM-DwsaxjWioOoXJH0Ei_g_tn4sDbZY'

export async function GET() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/proyectos?select=id,nombre,status,created_at&order=created_at.desc`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  })
  const data = await res.json()
  return NextResponse.json(data)
}
