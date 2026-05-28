import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { id: string; facturaId: string } }

const patchSchema = z.object({
  numero_factura:    z.string().min(1).max(50).optional(),
  subtotal:          z.number().int().min(0).optional(),
  aplica_igv:        z.boolean().optional(),
  aplica_detraccion: z.boolean().optional(),
  pct_detraccion:    z.number().int().min(0).max(100).optional(),
  estado:            z.enum(['borrador','emitida','cobrada','vencida']).optional(),
  fecha_emision:     z.string().nullable().optional(),
  fecha_vencimiento: z.string().nullable().optional(),
  fecha_cobro:       z.string().nullable().optional(),
  notas:             z.string().max(2000).nullable().optional(),
})

const SELECT = `
  id, proyecto_id, org_id, numero_factura, subtotal, aplica_igv, igv,
  aplica_detraccion, pct_detraccion, monto_detraccion, total, cliente_abona,
  estado, fecha_emision, fecha_vencimiento, fecha_cobro, notas, archivos, created_at
`

export async function PUT(req: Request, { params }: Params) {
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
    .eq('proyecto_id', params.id)
    .eq('org_id', auth.orgId)
    .select(SELECT)
    .single()

  if (error) return apiError('Error actualizando factura', 500, error)
  if (!data) return apiError('Factura no encontrada', 404)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas_proyecto' as never) as any)
    .delete()
    .eq('id', params.facturaId)
    .eq('proyecto_id', params.id)
    .eq('org_id', auth.orgId)

  if (error) return apiError('Error eliminando factura', 500, error)
  return NextResponse.json({ success: true })
}
