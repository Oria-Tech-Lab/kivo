import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { facturaId: string } }

// Campos seleccionados en todas las respuestas de factura
const FACTURA_SELECT = `
  id, proyecto_id, org_id, numero_factura, subtotal, aplica_igv, igv,
  aplica_detraccion, pct_detraccion, monto_detraccion, total, cliente_abona,
  estado, fecha_emision, fecha_vencimiento, fecha_cobro, notas, archivos, created_at,
  proyecto:proyectos(id, nombre, aplica_detraccion, cliente:clientes(id, nombre))
`.trim()

const patchSchema = z.object({
  proyecto_id:        z.string().uuid().optional(),
  numero_factura:     z.string().min(1).max(100).optional(),
  subtotal:           z.number().int().min(0).optional(),
  aplica_igv:         z.boolean().optional(),
  aplica_detraccion:  z.boolean().optional(),
  pct_detraccion:     z.number().int().min(0).max(100).optional(),
  estado:             z.enum(['borrador', 'emitida', 'cobrada', 'vencida']).optional(),
  fecha_emision:      z.string().nullable().optional(),
  fecha_vencimiento:  z.string().nullable().optional(),
  fecha_cobro:        z.string().nullable().optional(),
  notas:              z.string().max(2000).nullable().optional(),
})

/**
 * PATCH /api/facturas/[facturaId]
 * Actualización completa de campos editables.
 * No acepta columnas GENERATED (igv, monto_detraccion, total, cliente_abona).
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(req)
  if (body instanceof NextResponse) return body

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const updates = parsed.data

  // Si viene proyecto_id, verificar que pertenece a la org antes de asignarlo
  if (updates.proyecto_id !== undefined) {
    const supabase = createClient()
    const { data: proyecto } = await supabase
      .from('proyectos')
      .select('id')
      .eq('id', updates.proyecto_id)
      .eq('org_id', auth.orgId)
      .maybeSingle()

    if (!proyecto) {
      return apiError('Proyecto no encontrado en esta organización', 400)
    }
  }

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('facturas_proyecto' as never) as any)
    .update(updates)
    .eq('id', params.facturaId)
    .eq('org_id', auth.orgId)
    .select(FACTURA_SELECT)
    .single()

  if (error) return apiError('Error actualizando factura', 500, error)
  if (!data) return apiError('Factura no encontrada', 404)

  return NextResponse.json(data)
}

/**
 * DELETE /api/facturas/[facturaId]
 * Solo se puede eliminar si estado === 'borrador'.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // Obtener la factura para verificar estado antes de borrar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura, error: fetchError } = await (supabase.from('facturas_proyecto' as never) as any)
    .select('id, estado')
    .eq('id', params.facturaId)
    .eq('org_id', auth.orgId)
    .maybeSingle()

  if (fetchError) return apiError('Error consultando factura', 500, fetchError)
  if (!factura) return apiError('Factura no encontrada', 404)

  if (factura.estado !== 'borrador') {
    return apiError('Solo se pueden eliminar facturas en estado borrador', 400)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase.from('facturas_proyecto' as never) as any)
    .delete()
    .eq('id', params.facturaId)
    .eq('org_id', auth.orgId)

  if (deleteError) return apiError('Error eliminando factura', 500, deleteError)

  return new NextResponse(null, { status: 204 })
}
