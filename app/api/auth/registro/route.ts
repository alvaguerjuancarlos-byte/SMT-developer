import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Acceso restringido a JC y sus socios — no es registro público.
// Agregar aquí el correo de cada socio nuevo que se quiera dar de alta.
const ALLOWED_EMAILS = [
  'jcalvarez@mindbridge.com.mx',
  'ajuancarlos5@gmail.com',
]

export async function POST(req: NextRequest) {
  const { nombre, empresa, email, password } = await req.json()

  if (!nombre || !email || !password) {
    return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 })
  }
  if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
    return NextResponse.json(
      { error: 'Este correo no tiene acceso. Contacta al administrador para que te agregue.' },
      { status: 403 }
    )
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sin fricción de correo de confirmación — acceso ya está controlado por el allowlist
  })

  if (error) {
    const msg = error.message.includes('already been registered')
      ? 'Este correo ya está registrado. Inicia sesión.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (data.user) {
    const { error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({ id: data.user.id, nombre, empresa: empresa || '', email })
    if (insertError) {
      // el usuario de auth ya se creó; no revertimos por un fallo en la tabla de perfil
      console.error('Error insertando perfil de usuario:', insertError)
    }
  }

  return NextResponse.json({ ok: true })
}
