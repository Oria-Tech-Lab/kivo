import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Cliente Supabase con SERVICE_ROLE_KEY — bypasea RLS completamente.
 *
 * ⚠️  SOLO usar en:
 *   - Edge Functions de Supabase (cron de alertas, lookup-ruc, etc.)
 *   - Route Handlers que necesitan acceso elevado (ej: invitación por email)
 *
 * NUNCA:
 *   - Exponer en Client Components
 *   - Usar en Server Components que renderizan data del usuario
 *   - Llamar desde código que llega al browser
 *
 * La clave vive en SUPABASE_SERVICE_ROLE_KEY (sin prefijo NEXT_PUBLIC_).
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      '[Kivo] SUPABASE_SERVICE_ROLE_KEY no está configurada. ' +
      'Agregar en .env.local y en las variables de entorno de Vercel.'
    )
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        // Service role no necesita gestión de sesión
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
