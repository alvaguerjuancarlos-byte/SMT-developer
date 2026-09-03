import { redirect } from 'next/navigation'

// Antes esto revisaba la sesion guardada (Supabase la persiste en localStorage) y si ya
// habia una, saltaba directo a /dashboard sin pedir credenciales. Decision del cliente:
// la raiz del sitio siempre debe mostrar la pantalla de login, sin importar si hay sesion
// guardada en el navegador.
export default function Home() {
  redirect('/login')
}
