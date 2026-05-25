import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type AlertaUpdate = Database['public']['Tables']['alertas']['Update']
type Params = { params: { id: string } }

/**
 * PATCH /api/alertas/[id]
 * Marca una alerta como resuelta o leída.
 * Body: { resuelto?: boolean, fecha_visto?: true }
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Body JSON inválido', 400)
  }

  const bodyObj = body as Record<string, unknown>
  const supabase = createClient()

  // Verificar que la alerta pertenece a la org
  const { data: existing } = await supabase
    .from('alertas')
    .select('id')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Alerta no encontrada', 404)
  }

  const updates: AlertaUpdate = {}

  if (bodyObj.resuelto === true) {
    updates.resuelto = true
  }

  if (bodyObj.fecha_visto === true) {
    updates.fecha_visto = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return apiError('Sin campos válidos para actualizar', 400)
  }

  const { data: alerta, error } = await supabase
    .from('alertas')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return apiError('Error actualizando alerta', 500, error)
  }

  return NextResponse.json(alerta)
}
