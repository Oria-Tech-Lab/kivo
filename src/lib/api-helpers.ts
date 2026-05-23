import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

/**
 * Contexto de request autenticado — retornado por requireAuth()
 */
export interface AuthContext {
  userId: string
  orgId: string
  rol: UserRole
}

/**
 * Verifica autenticación y retorna el contexto del usuario.
 * Usar al inicio de TODOS los Route Handlers protegidos.
 *
 * Patrón obligatorio:
 *   const auth = await requireAuth()
 *   if (auth instanceof NextResponse) return auth  // 401
 *
 * @example
 * export async function GET() {
 *   const auth = await requireAuth()
 *   if (auth instanceof NextResponse) return auth
 *   const { userId, orgId } = auth
 *   // ...
 * }
 */
export async function requireAuth(
  requiredRole?: UserRole
): Promise<AuthContext | NextResponse> {
  const supabase = createClient()

  // getUser() hace round-trip a Supabase Auth — no usar getSession()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Obtener org_id y rol del usuario
  const { data: orgUserRaw } = await supabase
    .from('organization_users')
    .select('*')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!orgUserRaw) {
    return NextResponse.json(
      { error: 'Usuario sin organización asignada' },
      { status: 403 }
    )
  }

  const orgUser = orgUserRaw as { org_id: string; user_id: string; rol: string }
  const rol = orgUser.rol as UserRole

  // Verificar rol requerido si se especificó
  if (requiredRole) {
    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      pm: 2,
      viewer: 1,
    }
    if (roleHierarchy[rol] < roleHierarchy[requiredRole]) {
      return NextResponse.json(
        { error: 'Sin permisos para esta acción' },
        { status: 403 }
      )
    }
  }

  return { userId: user.id, orgId: orgUser.org_id as string, rol }
}

/**
 * Respuesta de error genérica para Route Handlers.
 * No exponer detalles internos al cliente.
 */
export function apiError(
  message: string,
  status: number,
  logError?: unknown
): NextResponse {
  if (logError) {
    // Log sin datos de usuario
    console.error(`[API ${status}] ${message}:`, logError instanceof Error ? logError.message : String(logError))
  }
  return NextResponse.json({ error: message }, { status })
}

/**
 * Verifica que el body sea JSON válido y retorna el resultado parseado.
 * Retorna NextResponse con error 400 si el body está malformado.
 */
export async function parseJsonBody<T>(
  request: Request
): Promise<T | NextResponse> {
  try {
    const body = await request.json() as T
    return body
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }
}
