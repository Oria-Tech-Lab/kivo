import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

/**
 * Ruta de callback para el flujo PKCE de Supabase Auth.
 * Supabase redirige aquí después de verificar el token de invitación
 * o confirmación de email.
 *
 * El code exchange convierte el authorization code en una sesión
 * y la persiste en cookies.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/invite'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* ignorado en Server Component */ }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] Error exchanging code:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback`)
  }

  // Redirigir a /invite si es un invite, a /inicio si ya tiene sesión
  const redirectTo = next.startsWith('/') ? `${origin}${next}` : origin
  return NextResponse.redirect(redirectTo)
}
