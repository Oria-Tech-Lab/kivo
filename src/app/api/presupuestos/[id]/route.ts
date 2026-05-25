import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

/**
 * GET /api/presupuestos/[id]
 * Obtiene un presupuesto completo con sus líneas.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data, error } = await supabase
    .from('presupuestos')
    .select(`
      *,
      lineas:lineas_presupuesto(*),
      proyecto:proyectos!inner(id, nombre, org_id, cliente:clientes(id, nombre, ruc))
    `)
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (error || !data) {
    return apiError('Presupuesto no encontrado', 404)
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/presupuestos/[id]
 * Actualiza el estado del presupuesto: borrador → aprobado / rechazado.
 * Requiere rol admin o pm.
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
  const { estado } = bodyObj

  if (!estado || !['aprobado', 'rechazado', 'borrador'].includes(estado as string)) {
    return apiError('Estado inválido. Usa: aprobado, rechazado o borrador', 400)
  }

  const supabase = createClient()

  // Verificar que el presupuesto existe y pertenece a la org
  const { data: existing } = await supabase
    .from('presupuestos')
    .select('id, estado, proyectos!inner(org_id)')
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Presupuesto no encontrado', 404)
  }

  // Si se aprueba, registrar fecha de aprobación
  const fechaAprobacion = estado === 'aprobado' ? new Date().toISOString() : null

  const { data: presupuesto, error } = await supabase
    .from('presupuestos')
    .update({
      estado: estado as 'borrador' | 'aprobado' | 'rechazado',
      fecha_aprobacion: fechaAprobacion,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return apiError('Error actualizando presupuesto', 500, error)
  }

  return NextResponse.json(presupuesto)
}

/**
 * DELETE /api/presupuestos/[id]
 * Elimina un presupuesto en estado borrador. Requiere rol admin.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // Solo permite borrar borradores
  const { data: existing } = await supabase
    .from('presupuestos')
    .select('id, estado, proyectos!inner(org_id)')
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Presupuesto no encontrado', 404)
  }

  const existingData = existing as { id: string; estado: string }
  if (existingData.estado !== 'borrador') {
    return apiError('Solo se pueden eliminar presupuestos en estado borrador', 409)
  }

  const { error } = await supabase
    .from('presupuestos')
    .delete()
    .eq('id', params.id)

  if (error) {
    return apiError('Error eliminando presupuesto', 500, error)
  }

  return NextResponse.json({ success: true })
}
