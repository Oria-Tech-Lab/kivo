'use client'

import { useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook para acceder al cliente Supabase en Client Components.
 *
 * Memoriza la instancia para evitar re-crear el cliente en cada render.
 * La sesión se mantiene automáticamente via el SSR middleware.
 *
 * Uso:
 *   const supabase = useSupabase()
 *   const { data } = await supabase.from('proyectos').select()
 */
export function useSupabase() {
  return useMemo(() => createClient(), [])
}
