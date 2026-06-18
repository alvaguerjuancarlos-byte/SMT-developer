import { supabase } from './supabase'

export async function saveProyecto({
  nombre,
  datos,
  flujo,
}: {
  nombre: string
  datos: object
  flujo: 'A' | 'B'
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const usuario_id = session?.user?.id ?? null

    const res = await fetch('/api/save-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, datos, flujo, usuario_id }),
    })
    const json = await res.json()
    if (!res.ok) {
      console.error('[saveProyecto] Error:', json.error)
      return { ok: false, error: json.error }
    }
    console.log('[saveProyecto] Guardado:', nombre, `(Flujo ${flujo})`)
    return { ok: true, id: json.id }
  } catch (err) {
    console.error('[saveProyecto] Error de red:', err)
    return { ok: false, error: String(err) }
  }
}
