'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Proyecto {
  id: string
  nombre: string
  created_at: string
  status: string
  flujo: 'A' | 'B'
}

interface UserProfile {
  nombre: string
  empresa: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [userName,  setUserName]  = useState('')
  const [userId,    setUserId]    = useState('')
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('usuarios')
        .select('nombre, empresa')
        .eq('id', user.id)
        .single()

      setUserName((profile as UserProfile | null)?.nombre || user.email || 'Usuario')

      const { data: proyData } = await supabase
        .from('proyectos')
        .select('id, nombre, created_at, status, flujo')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      setProyectos((proyData as Proyecto[]) || [])
      setLoading(false)
    }
    init()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const statusCfg = (status: string) => {
    if (status === 'propuesta')  return { label: 'Propuesta lista',  badge: 'bg-[#E1F5EE] text-[#0F6E56]' }
    if (status === 'analisis')   return { label: 'En análisis',      badge: 'bg-[#FEF3C7] text-[#92600A]' }
    if (status === 'prospectando') return { label: 'Prospectando',   badge: 'bg-[#EEF2FF] text-[#3730A3]' }
    return { label: 'Borrador', badge: 'bg-[#F3F4F6] text-[#6B7280]' }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  const firstName = userName.split(' ')[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <p className="text-[#9aab9f] text-[14px]">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8E4] px-8 py-4 flex items-center gap-3 sticky top-0 z-20">
        <div className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 2V16M2 6L16 12M16 6L2 12" stroke="white" strokeWidth="1" strokeOpacity="0.5"/>
          </svg>
        </div>
        <div>
          <span className="text-[15px] font-medium text-[#1a1a1a] tracking-wide">SMT Developer</span>
          <span className="block text-[10px] text-[#6b7c74] tracking-[0.12em] uppercase">Inteligencia inmobiliaria</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E1F5EE] flex items-center justify-center">
              <span className="text-[12px] font-bold text-[#0F6E56]">{firstName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-[13px] font-medium text-[#111d17]">{userName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-[13px] text-[#9aab9f] hover:text-[#111d17] border border-[#E2E8E4] px-3 py-1.5 rounded-xl transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="w-full max-w-[860px] mx-auto flex flex-col gap-10">

          {/* Welcome */}
          <div>
            <h1 className="text-[28px] font-black text-[#111d17] leading-tight">
              Bienvenido, {firstName} 👋
            </h1>
            <p className="text-[14px] text-[#9aab9f] mt-1">¿Qué quieres analizar hoy?</p>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-2 gap-5">

            {/* Flujo A */}
            <button
              onClick={() => router.push('/prospeccion/flujo-a')}
              className="group bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-7 text-left hover:border-[#1D9E75] hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#E1F5EE] flex items-center justify-center mb-5 group-hover:bg-[#1D9E75] transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#1D9E75] group-hover:text-white transition-colors">
                  <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
                  <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#E1F5EE] text-[#0F6E56] px-2 py-0.5 rounded-full">Flujo A</span>
              </div>
              <h3 className="text-[17px] font-bold text-[#111d17] mb-1">Tengo un terreno</h3>
              <p className="text-[13px] text-[#9aab9f] leading-relaxed">
                Captura los datos de tu predio y genera un análisis de inversión con propuesta para inversionistas.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-[#1D9E75]">
                Iniciar análisis
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </button>

            {/* Flujo B */}
            <button
              onClick={() => router.push('/prospeccion/flujo-b')}
              className="group bg-white rounded-2xl border border-[#E2E8E4] shadow-sm p-7 text-left hover:border-[#1D9E75] hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mb-5 group-hover:bg-[#1D9E75] transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#4F46E5] group-hover:text-white transition-colors">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase bg-[#EEF2FF] text-[#3730A3] px-2 py-0.5 rounded-full">Flujo B · Scout IA</span>
              </div>
              <h3 className="text-[17px] font-bold text-[#111d17] mb-1">Quiero buscar un terreno</h3>
              <p className="text-[13px] text-[#9aab9f] leading-relaxed">
                Define tus criterios y deja que Scout IA encuentre y compare los mejores candidatos disponibles.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-[#1D9E75]">
                Iniciar búsqueda
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </button>

          </div>

          {/* Mis Proyectos */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-[#111d17]">Mis Proyectos</h2>
              <span className="text-[12px] text-[#9aab9f]">{proyectos.length} {proyectos.length === 1 ? 'proyecto' : 'proyectos'}</span>
            </div>

            {proyectos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm px-8 py-14 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#F7F8F6] border border-[#E2E8E4] flex items-center justify-center mb-1">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M9 13h6M9 17h4M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="#C4CFC8" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M9 7h6" stroke="#C4CFC8" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-[#111d17]">Sin proyectos aún</p>
                <p className="text-[13px] text-[#9aab9f] max-w-[280px]">
                  Inicia un análisis con Flujo A o Flujo B para ver tus proyectos aquí.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8E4] shadow-sm overflow-hidden">
                {proyectos.map((p, i) => {
                  const { label, badge } = statusCfg(p.status)
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-4 px-6 py-4 ${i !== proyectos.length - 1 ? 'border-b border-[#F0F4F2]' : ''} hover:bg-[#FAFBFA] transition-colors`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#F7F8F6] border border-[#E2E8E4] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-[#9aab9f]">{p.flujo || '—'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#111d17] truncate">{p.nombre}</p>
                        <p className="text-[11px] text-[#9aab9f] mt-0.5">{formatDate(p.created_at)}</p>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${badge}`}>{label}</span>
                      <button
                        onClick={() => router.push(`/analisis?proyecto=${encodeURIComponent(p.nombre)}`)}
                        className="shrink-0 text-[12px] font-semibold text-[#1D9E75] hover:text-[#0F6E56] border border-[#D4EFE3] hover:border-[#1D9E75] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ver
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
