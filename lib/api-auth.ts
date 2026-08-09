import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Verifica el JWT de Supabase enviado en el header Authorization: Bearer <token>.
// Usar al inicio de cualquier Route Handler que toque datos o cueste dinero
// (LLM, geocoding, storage) — el acceso a la app ya no es publico.
export async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export function unauthorized() {
  return NextResponse.json({ error: 'No autorizado. Inicia sesión.' }, { status: 401 })
}
