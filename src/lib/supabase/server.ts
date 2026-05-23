import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

/**
 * Cliente Supabase para uso en Server Components, Route Handlers y Server Actions.
 *
 * Lee y escribe cookies del request para mantener la sesión activa.
 * El bloque catch en setAll() es intencional: los Server Components no pueden
 * escribir cookies; el middleware se encarga de refrescarlas.
 *
 * REGLA DE SEGURIDAD: siempre verificar con getUser() (no getSession()) en
 * endpoints protegidos, ya que getUser() hace round-trip a Supabase Auth.
 *
 * Uso en Server Component:
 *   const supabase = createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Llamado desde Server Component — el middleware refresca las cookies.
            // Este catch es intencional y esperado.
          }
        },
      },
    }
  )
}

/**
 * Obtiene el usuario autenticado actual.
 * Usa getUser() que verifica el JWT contra Supabase Auth (más seguro que getSession()).
 * Retorna null si no hay sesión activa.
 */
export async function getAuthUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

/**
 * Obtiene el org_id del usuario autenticado.
 * Lanza error si no hay sesión o el usuario no pertenece a ninguna org.
 */
export async function getUserOrgId(): Promise<string> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('No autenticado')

  const { data, error } = await supabase
    .from('organization_users')
    .select('*')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (error || !data) throw new Error('Organización no encontrada')

  return (data as { org_id: string; user_id: string; rol: string }).org_id
}

/**
 * Obtiene el rol del usuario en su organización.
 */
export async function getUserRole(): Promise<'admin' | 'pm' | 'viewer' | null> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data } = await supabase
    .from('organization_users')
    .select('*')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const row = data as { org_id: string; user_id: string; rol: string } | null
  return (row?.rol as 'admin' | 'pm' | 'viewer') ?? null
}
