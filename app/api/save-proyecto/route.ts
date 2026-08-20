import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY!
export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  try {
    const { id, nombre, datos, flujo } = await req.json()
    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('[save-proyecto] Supabase env vars not set')
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
    }

    // Si viene "id" es un autoguardado sobre un proyecto ya creado (PATCH in-place) — evita que
    // cada guardado del pipeline en curso (PREFORMA autoguarda mientras corren los agentes)
    // acumule una fila nueva por intento; sin id se comporta como antes (INSERT).
    if (id) {
      console.log('[save-proyecto] Actualizando:', id, nombre)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/proyectos?id=eq.${id}&usuario_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ nombre, datos: datos ?? {} }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('[save-proyecto] Supabase error (update)', res.status, text)
        return NextResponse.json({ error: text }, { status: res.status })
      }
      const data = await res.json()
      return NextResponse.json({ ok: true, id: data[0]?.id ?? id })
    }

    console.log('[save-proyecto] Guardando:', nombre, 'flujo:', flujo)

    const body: Record<string, unknown> = {
      nombre,
      datos: datos ?? {},
      flujo: flujo || 'A',
      status: 'en-revision',
      usuario_id: user.id,
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/proyectos`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[save-proyecto] Supabase error', res.status, text)
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const data = await res.json()
    console.log('[save-proyecto] OK, id:', data[0]?.id)
    return NextResponse.json({ ok: true, id: data[0]?.id })
  } catch (err) {
    console.error('[save-proyecto] Excepción:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
