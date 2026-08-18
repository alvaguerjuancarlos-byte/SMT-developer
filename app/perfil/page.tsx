'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    <div className="min-h-screen bg-[#0C0F0E] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">

        <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-8">
          <h2 className="text-[18px] font-bold text-[#111d17] mb-1">
            {esRecuperacion ? 'Establece tu nueva contraseña' : 'Mi cuenta'}
          </h2>
          <p className="text-[13px] text-[#9aab9f] mb-6">{email}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#5a7065] uppercase tracking-[0.1em]">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E2E8E4] bg-[#F7F8F6] text-[14px] text-[#111d17] placeholder-[#c4cfc8] focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#5a7065] uppercase tracking-[0.1em]">
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E2E8E4] bg-[#F7F8F6] text-[14px] text-[#111d17] placeholder-[#c4cfc8] focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 transition-all"
              />
            </div>

            {error && (
              <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl px-4 py-3">
                <p className="text-[12px] text-[#991B1B] leading-snug">{error}</p>
              </div>
            )}

            {ok && (
              <div className="bg-[#E1F5EE] border border-[#BEE8D8] rounded-xl px-4 py-3">
                <p className="text-[12px] text-[#0F6E56] leading-snug">Contraseña actualizada.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#1D9E75] text-white text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full py-2 text-[13px] text-[#9aab9f] hover:text-[#5a7065] transition-colors"
            >
              Volver
            </button>

          </form>
        </div>

      </div>
    </div>
  )
}
