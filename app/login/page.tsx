'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : authError.message)
      setLoading(false)
      return
    }

    const pendingRaw = localStorage.getItem('smt_pending_save')
    if (pendingRaw && data.user) {
      try {
        const pending = JSON.parse(pendingRaw)
        const dataKey = pending.flujo === 'B' ? 'smt_scout_data' : 'smt_analisis_data'
        const datosRaw = localStorage.getItem(dataKey)
        if (datosRaw) {
          const datos = JSON.parse(datosRaw)
          await supabase.from('proyectos').insert({
            usuario_id: data.user.id,
            nombre: pending.nombre,
            datos,
            flujo: pending.flujo,
            status: 'analisis',
          })
        }
        localStorage.removeItem('smt_pending_save')
        const path = pending.flujo === 'B' ? '/analisis/flujo-b' : '/analisis'
        router.push(`${path}?proyecto=${encodeURIComponent(pending.nombre)}`)
        return
      } catch { /* si falla, ir al dashboard igual */ }
    }

    router.push('/prospeccion')
  }

  return (
    <div className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex items-center justify-center px-4 relative overflow-hidden`}>
      {/* Video de fondo — mismo tratamiento que la portada (/prospeccion): dron sobre
          Monterrey/San Pedro, overlay ligero (sin grid, el video ya da textura). */}
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      >
        <source src="/videos/monterrey-skyline.mp4" type="video/mp4" />
      </video>
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: 'linear-gradient(180deg, rgba(7,15,34,0.55) 0%, rgba(11,29,58,0.4) 35%, rgba(11,29,58,0.6) 75%, rgba(11,29,58,0.8) 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#c9a227] flex items-center justify-center mb-4 shadow-lg shadow-[#c9a227]/20">
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#070f22" strokeWidth="1.5" fill="none"/>
              <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#070f22" strokeWidth="1" strokeOpacity="0.6"/>
            </svg>
          </div>
          <h1 className="text-[22px] tracking-tight" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 500, color: '#f4f0e6', textShadow: '0 2px 16px rgba(7,15,34,0.6)' }}>
            SMT <em style={{ fontStyle: 'normal', color: '#ddc06a' }}>Developer</em>
          </h1>
          <p className="text-[11px] text-[#c7ccd6] tracking-[0.14em] uppercase mt-0.5" style={{ fontFamily: 'var(--font-plex-mono)', textShadow: '0 1px 10px rgba(7,15,34,0.6)' }}>Inteligencia inmobiliaria</p>
        </div>

        {/* Card */}
        <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm p-8">
          <h2 className="text-[18px] font-semibold text-[#f4f0e6] mb-1" style={{ fontFamily: 'var(--font-fraunces)' }}>Iniciar sesión</h2>
          <p className="text-[13px] text-[#8b96ab] mb-6">Accede a tu cuenta para continuar.</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#8b96ab] uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#2a3f5c] bg-[#0b1d3a] text-[14px] text-[#f4f0e6] placeholder-[#5f6a80] focus:outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/10 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#8b96ab] uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                  Contraseña
                </label>
                <a href="/recuperar" className="text-[11px] font-semibold text-[#c9a227] hover:text-[#ddc06a] transition-colors">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#2a3f5c] bg-[#0b1d3a] text-[14px] text-[#f4f0e6] placeholder-[#5f6a80] focus:outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/10 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-[#2e1414] border border-[#5c2a2a] rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="8" cy="8" r="7" stroke="#EF4444" strokeWidth="1.4"/>
                  <path d="M8 5v3.5M8 10.5v.5" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <p className="text-[12px] text-[#FCA5A5] leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#c9a227] text-[#070f22] text-[14px] font-semibold hover:bg-[#ddc06a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ fontFamily: 'var(--font-plex-mono)' }}
            >
              {loading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>

          </form>
        </div>

        {/* Register link */}
        <p className="text-center text-[13px] text-[#c7ccd6] mt-5" style={{ textShadow: '0 1px 10px rgba(7,15,34,0.6)' }}>
          ¿No tienes cuenta?{' '}
          <a href="/registro" className="text-[#c9a227] font-semibold hover:text-[#ddc06a] transition-colors">
            Regístrate aquí
          </a>
        </p>

      </div>
    </div>
  )
}
