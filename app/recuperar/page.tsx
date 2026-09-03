'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

export default function RecuperarPage() {
  const [email, setEmail]     = useState('')
  const [error, setError]     = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/perfil`,
    })

    setLoading(false)

    // Supabase no revela si el correo existe o no (mismo comportamiento con o sin
    // cuenta) — un error real aquí es de red/servicio, no "correo no encontrado".
    if (authError) {
      setError('No se pudo enviar el correo. Intenta de nuevo en unos minutos.')
      return
    }
    setEnviado(true)
  }

  return (
    <div
      className={`${fraunces.variable} ${plexMono.variable} min-h-screen bg-[#0b1d3a] flex items-center justify-center px-4`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(244,240,230,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,0.11) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    >
      <div className="w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#c9a227] flex items-center justify-center mb-4 shadow-lg shadow-[#c9a227]/20">
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#070f22" strokeWidth="1.5" fill="none"/>
              <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="#070f22" strokeWidth="1" strokeOpacity="0.6"/>
            </svg>
          </div>
          <h1 className="text-[22px] tracking-tight" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 500, color: '#f4f0e6' }}>
            SMT <em style={{ fontStyle: 'normal', color: '#ddc06a' }}>Developer</em>
          </h1>
          <p className="text-[11px] text-[#8b96ab] tracking-[0.14em] uppercase mt-0.5" style={{ fontFamily: 'var(--font-plex-mono)' }}>Inteligencia inmobiliaria</p>
        </div>

        {/* Card */}
        <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm p-8">
          <h2 className="text-[18px] font-semibold text-[#f4f0e6] mb-1" style={{ fontFamily: 'var(--font-fraunces)' }}>Recuperar contraseña</h2>
          <p className="text-[13px] text-[#8b96ab] mb-6">
            Escribe tu correo y te mandamos un enlace para poner una contraseña nueva.
          </p>

          {enviado ? (
            <div className="bg-[#c9a227]/10 border border-[#c9a227]/40 rounded-xl px-4 py-3.5">
              <p className="text-[13px] text-[#ddc06a] leading-relaxed">
                Si <strong>{email}</strong> tiene cuenta, te llegará un correo con el enlace en unos minutos.
                Revisa también spam.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

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
                  autoFocus
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
                {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>

            </form>
          )}
        </div>

        <p className="text-center text-[13px] text-[#8b96ab] mt-5">
          <a href="/login" className="text-[#c9a227] font-semibold hover:text-[#ddc06a] transition-colors">
            ← Volver a iniciar sesión
          </a>
        </p>

      </div>
    </div>
  )
}
