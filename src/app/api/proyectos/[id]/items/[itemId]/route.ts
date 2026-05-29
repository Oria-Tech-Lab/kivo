import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { id: string; itemId: string } }

const patchSchema = z.object({
  concepto:            z.string().max(300).optional(),
  unidad:              z.enum(['unid', 'hora', 'global', 'm2', 'kg', 'dia', 'otro']).optional(),
  proveedor_id:        z.string().uuid().optional().nullable(),
  costo_estimado:      z.number().int().min(0).optional(),
  precio_venta:        z.number().int().min(0).optional(),
  gasto_real:          z.number().int().min(0).optional(),
  cantidad:            z.number().min(0).optional(),
  precio_unitario:     z.number().int().min(0).optional(),
  tipo_comprobante:    z.enum(['factura', 'boleta', 'rxh', 'sin_comprobante', 'pendiente']).optional().nullable(),
  estado_pago:         z.enum(['pendiente', 'pagado', 'parcial']).optional(),
  fecha_pago:          z.string().nullable().optional(),
  foto_url:            z.string().nullable().optional(),
  factura_url:         z.string().nullable().optional(),
  constancia_pago_url: z.string().nullable().optional(),
  sort_order:          z.number().int().optional(),
  estado:              z.enum(['presupuestado', 'en_ejecucion', 'ejecutado', 'cancelado']).optional(),
})

const SELECT_FIELDS = `
  id, concepto, unidad, proveedor_id, costo_estimado, precio_venta,
  gasto_real, cantidad, precio_unitario, tipo_comprobante,
  estado_pago, fecha_pago, foto_url, factura_url, constancia_pago_url,
  sort_order, created_at, estado,
  proveedor:proveedores(id, razon_social, nombre_comercial)
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
  const { data: item, error } = await ((supabase.from('proyecto_items' as never)) as any)
    .update(parsed.data)
    .eq('id', params.itemId)
    .eq('org_id', auth.orgId)
    .select(SELECT_FIELDS)
    .single()

  if (error) return apiError('Error actualizando item', 500, error)
  if (!item) return apiError('Item no encontrado', 404)
  return NextResponse.json(item)
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await ((supabase.from('proyecto_items' as never)) as any)
    .delete()
    .eq('id', params.itemId)
    .eq('org_id', auth.orgId)

  if (error) return apiError('Error eliminando item', 500, error)
  return NextResponse.json({ success: true })
}
