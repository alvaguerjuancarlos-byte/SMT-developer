'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function inicialesDe(email: string | undefined) {
  if (!email) return '—'
  const nombre = email.split('@')[0]
  return nombre.slice(0, 2).toUpperCase()
}

export default function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState<string | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setEmail(session?.user?.email))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email))
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // PREFORMA es una pantalla completa aparte, sin el chrome verde de SMT Developer.
  if (pathname?.startsWith('/preforma')) return null

  return (
    <header className="bg-[#085041] shadow-lg">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <Link href="/" className="text-white font-bold text-lg tracking-tight hover:text-white/90 transition-colors">
            SMT Developer
          </Link>
          <span className="text-white/30 text-sm">|</span>
          <span className="text-white/60 text-sm">Plataforma de Análisis Inmobiliario</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/preforma"
            className="text-xs font-semibold text-white bg-white/15 hover:bg-white/25 rounded-full px-3 py-1.5 transition-colors"
          >
            PREFORMA
          </Link>
          <span className="text-white/70 text-xs">v3.0 · Jul 2026</span>
          {email && (
            <>
              <span className="text-white/60 text-xs hidden sm:inline">{email}</span>
              <Link
                href="/perfil"
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                title="Mi cuenta"
              >
                <span className="text-white text-xs font-semibold">{inicialesDe(email)}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-white/60 hover:text-white text-xs transition-colors"
              >
                Salir
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
