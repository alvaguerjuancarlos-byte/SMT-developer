'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RegistroPage() {
  const router = useRouter()
  const [nombre,   setNombre]   = useState('')
  const [empresa,  setEmpresa]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message === 'User already registered'
        ? 'Este correo ya está registrado. Inicia sesión.'
        : signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('usuarios').insert({
        id:     data.user.id,
        nombre,
        empresa,
        email,
      })
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#1D9E75] flex items-center justify-center mb-4 shadow-lg shadow-[#1D9E75]/20">
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
              <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
            </svg>
          </div>
          <h1 className="text-[22px] font-black text-[#111d17] tracking-tight">SMT Developer</h1>
          <p className="text-[11px] text-[#9aab9f] tracking-[0.14em] uppercase mt-0.5">Inteligencia inmobiliaria</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-8">
          <h2 className="text-[18px] font-bold text-[#111d17] mb-1">Crear cuenta</h2>
          <p className="text-[13px] text-[#9aab9f] mb-6">Completa tus datos para comenzar.</p>

          <form onSubmit={handleRegistro} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#5a7065] uppercase tracking-[0.1em]">
                Nombre completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Juan Carlos Álvarez"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E2E8E4] bg-[#F7F8F6] text-[14px] text-[#111d17] placeholder-[#c4cfc8] focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#5a7065] uppercase tracking-[0.1em]">
                Empresa
              </label>
              <input
                type="text"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                placeholder="Desarrolladora XYZ"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E2E8E4] bg-[#F7F8F6] text-[14px] text-[#111d17] placeholder-[#c4cfc8] focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#5a7065] uppercase tracking-[0.1em]">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E2E8E4] bg-[#F7F8F6] text-[14px] text-[#111d17] placeholder-[#c4cfc8] focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#5a7065] uppercase tracking-[0.1em]">
                Contraseña
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
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E2E8E4] bg-[#F7F8F6] text-[14px] text-[#111d17] placeholder-[#c4cfc8] focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/10 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-[#FEE2E2] border border-[#FECACA] rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="8" cy="8" r="7" stroke="#DC2626" strokeWidth="1.4"/>
                  <path d="M8 5v3.5M8 10.5v.5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <p className="text-[12px] text-[#991B1B] leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#1D9E75] text-white text-[14px] font-semibold hover:bg-[#0F6E56] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>

          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-[13px] text-[#9aab9f] mt-5">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-[#1D9E75] font-semibold hover:text-[#0F6E56] transition-colors">
            Inicia sesión
          </a>
        </p>

      </div>
    </div>
  )
}
