'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Antes esto era un redirect() server-side incondicional a /prospeccion, así que un usuario
// ya logueado (sesión vive en localStorage vía Supabase, no en cookies) que abriera la raíz
// del sitio siempre caía en el selector de flujo en vez de su dashboard. Se revisa la sesión
// en el cliente, como en el resto de la app (ver providers.tsx), y se manda a cada quien a
// donde corresponde.
export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/dashboard' : '/login')
    })
  }, [router])

  return null
}
