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
  datos?: Record<string, unknown>
}

export default function DashboardPage() {
  const router = useRouter()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const { data } = await supabase
        .from('proyectos')
        .select('id, nombre, created_at, status, flujo, datos')
        .neq('status', 'eliminado')
        .order('created_at', { ascending: false })
        .limit(50)
      if (mounted) {
        const borrados: string[] = JSON.parse(localStorage.getItem('smt_borrados') || '[]')
        const lista = ((data as Proyecto[]) || []).filter(p => !borrados.includes(p.id))
        setProyectos(lista)
        setLoading(false)
      }
    }

    // Intenta con sesión existente de inmediato
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && mounted) load()
    })

    // También escucha el auto-login de providers (SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user && mounted) load()
      else if (!session && mounted) setLoading(false)
    })

    // Fallback máximo 6 segundos
    const timer = setTimeout(() => { if (mounted) setLoading(false) }, 6000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const statusCfg = (status: string) => {
    if (status === 'propuesta')    return { label: 'Propuesta lista',  badge: 'bg-[#E1F5EE] text-[#0F6E56]' }
    if (status === 'analisis')     return { label: 'En análisis',      badge: 'bg-[#FEF3C7] text-[#92600A]' }
    if (status === 'prospectando') return { label: 'Prospectando',     badge: 'bg-[#EEF2FF] text-[#3730A3]' }
    return { label: 'Borrador', badge: 'bg-[#F3F4F6] text-[#6B7280]' }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto?')) return
    const borrados: string[] = JSON.parse(localStorage.getItem('smt_borrados') || '[]')
    localStorage.setItem('smt_borrados', JSON.stringify([...borrados, id]))
    setProyectos(prev => prev.filter(p => p.id !== id))
    await supabase.from('proyectos').update({ status: 'eliminado' }).eq('id', id)
  }

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
        <div className="ml-auto">
          <button
            onClick={() => router.push('/prospeccion')}
            className="flex items-center gap-1.5 text-[13px] text-[#9aab9f] hover:text-[#111d17] border border-[#E2E8E4] px-3 py-1.5 rounded-xl transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L2 7L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Nuevo análisis
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="w-full max-w-[860px] mx-auto flex flex-col gap-6">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-black text-[#111d17] leading-tight">Mis Proyectos</h1>
              <p className="text-[13px] text-[#9aab9f] mt-0.5">{proyectos.length} {proyectos.length === 1 ? 'proyecto guardado' : 'proyectos guardados'}</p>
            </div>
            <button
              onClick={() => router.push('/prospeccion')}
              className="flex items-center gap-2 bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Nuevo análisis
            </button>
          </div>

          {/* Lista de proyectos */}
          <div>
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
                        onClick={() => {
                          if (p.datos) {
                            const key = p.flujo === 'B' ? 'smt_scout_data' : 'smt_analisis_data'
                            localStorage.setItem(key, JSON.stringify({ ...p.datos, proyecto: p.nombre }))
                          }
                          const path = p.flujo === 'B' ? '/analisis/flujo-b' : '/analisis'
                          router.push(`${path}?proyecto=${encodeURIComponent(p.nombre)}`)
                        }}
                        className="shrink-0 text-[12px] font-semibold text-[#1D9E75] hover:text-[#0F6E56] border border-[#D4EFE3] hover:border-[#1D9E75] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#9aab9f] hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
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
