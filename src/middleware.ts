import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware de autenticación — Kivo
 *
 * Responsabilidades:
 * 1. Refrescar el access token de Supabase en cada request (obligatorio con @supabase/ssr)
 * 2. Proteger rutas del dashboard: redirigir a /login si no hay sesión
 * 3. Redirigir al dashboard si un usuario autenticado intenta ir a /login
 *
 * REGLA DE SEGURIDAD CRÍTICA:
 * - Usar getUser() que hace round-trip a Supabase Auth y verifica el JWT
 * - NO usar getSession() en el servidor: solo lee cookies sin verificar
 *
 * El patrón de cookies es obligatorio para que Supabase SSR funcione:
 * los tokens se leen del request y se escriben en el response.
 */
export async function middleware(request: NextRequest) {
  // Inicializar response que se puede mutar con cookies actualizadas
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Escribir cookies en el request (para que el Server Component las lea)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Crear nuevo response con las cookies actualizadas
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRÍTICO: getUser() verifica el JWT contra Supabase Auth server
  // No omitir este llamado — también refresca el access token si está por vencer
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas públicas que no requieren sesión
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') // webhooks de auth

  // Sin sesión en ruta protegida → redirigir a login
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Guardar la URL original para redirigir después del login
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Con sesión en /login → redirigir al dashboard
  if (user && pathname.startsWith('/login')) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/inicio'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
  }

  // IMPORTANTE: retornar siempre supabaseResponse (no NextResponse.next() directo)
  // para que las cookies del token refrescado se propaguen al browser.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Aplicar a todas las rutas excepto:
     * - archivos estáticos de _next/
     * - favicon.ico y archivos de public/
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
