import { supabase } from './supabase'

export async function saveProyecto({
  nombre,
  datos,
  flujo,
  status = 'analisis',
}: {
  nombre: string
  datos: object
  flujo: 'A' | 'B'
  status?: string
}): Promise<{ ok: boolean; error?: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.warn('[saveProyecto] No hay sesión activa — proyecto no guardado en BD')
    return { ok: false, error: 'Sin sesión' }
  }

  const { error } = await supabase.from('proyectos').insert({
    usuario_id: user.id,
    nombre,
    datos,
    flujo,
    status,
  })

  if (error) {
    console.error('[saveProyecto] Error al guardar:', error.message, error.details, error.hint)
    return { ok: false, error: error.message }
  }

  console.log('[saveProyecto] Proyecto guardado:', nombre, `(Flujo ${flujo})`)
  return { ok: true }
}
