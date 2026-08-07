import { createClient } from '@supabase/supabase-js'

// Cliente con service role — SOLO usar dentro de Route Handlers (app/api/**/route.ts).
// Nunca importar este archivo desde un componente 'use client' ni desde código
// que pueda terminar en el bundle del navegador: la service key tiene acceso
// total, bypassa RLS.
const supabaseUrl = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
