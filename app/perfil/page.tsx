'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Fraunces, IBM_Plex_Mono } from 'next/font/google'

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' })

export default function PerfilPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [esRecuperacion, setEsRecuperacion] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email || '')
    })
    // Supabase manda el token de recuperación en el hash de la URL (no en query)
    // y dispara este evento al establecer la sesión temporal desde ese link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setEsRecuperacion(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setOk(false)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setOk(true)
    setPassword('')
    setConfirm('')
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

        <div className="bg-[#132a4d] rounded-2xl border border-[#2a3f5c] shadow-sm p-8">
          <h2 className="text-[18px] font-semibold text-[#f4f0e6] mb-1" style={{ fontFamily: 'var(--font-fraunces)' }}>
            {esRecuperacion ? 'Establece tu nueva contraseña' : 'Mi cuenta'}
          </h2>
          <p className="text-[13px] text-[#8b96ab] mb-6">{email}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#8b96ab] uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#2a3f5c] bg-[#0b1d3a] text-[14px] text-[#f4f0e6] placeholder-[#5f6a80] focus:outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/10 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#8b96ab] uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#2a3f5c] bg-[#0b1d3a] text-[14px] text-[#f4f0e6] placeholder-[#5f6a80] focus:outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/10 transition-all"
              />
            </div>

            {error && (
              <div className="bg-[#2e1414] border border-[#5c2a2a] rounded-xl px-4 py-3">
                <p className="text-[12px] text-[#FCA5A5] leading-snug">{error}</p>
              </div>
            )}

            {ok && (
              <div className="bg-[#c9a227]/10 border border-[#c9a227]/40 rounded-xl px-4 py-3">
                <p className="text-[12px] text-[#ddc06a] leading-snug">Contraseña actualizada.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#c9a227] text-[#070f22] text-[14px] font-semibold hover:bg-[#ddc06a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ fontFamily: 'var(--font-plex-mono)' }}
            >
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full py-2 text-[13px] text-[#5f6a80] hover:text-[#8b96ab] transition-colors"
            >
              Volver
            </button>

          </form>
        </div>

      </div>
    </div>
  )
}
