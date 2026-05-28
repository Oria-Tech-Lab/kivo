import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { facturaId: string } }

const patchSchema = z.object({
  estado:      z.enum(['borrador', 'emitida', 'cobrada', 'vencida']),
  fecha_cobro: z.string().nullable().optional(),
})

/**
 * PATCH /api/facturas/[facturaId]
 * Actualización rápida de estado desde la página consolidada.
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(req)
  if (body instanceof NextResponse) return body

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('facturas_proyecto' as never) as any)
    .update(parsed.data)
    .eq('id', params.facturaId)
    .eq('org_id', auth.orgId)
    .select('id, estado, fecha_cobro')
    .single()

  if (error) return apiError('Error actualizando estado', 500, error)
  if (!data) return apiError('Factura no encontrada', 404)
  return NextResponse.json(data)
}
