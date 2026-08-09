import { supabase } from '@/lib/supabase'

// Wrapper de fetch que adjunta el token de sesion actual — usar para TODAS las
// llamadas del cliente a /api/*, salvo /api/auth/registro (no hay sesion todavia
// en ese punto). Las rutas del servidor validan este token con requireUser().
export async function authedFetch(input: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  return fetch(input, { ...init, headers })
}
