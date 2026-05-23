import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

/**
 * Cliente Supabase para uso en Client Components ('use client').
 *
 * Usa la ANON_KEY pública. La seguridad real la implementa RLS en PostgreSQL.
 * No usar en Server Components ni Route Handlers — usar server.ts en su lugar.
 *
 * Uso:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('proyectos').select()
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
