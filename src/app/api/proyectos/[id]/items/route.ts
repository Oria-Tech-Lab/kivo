import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { id: string } }

const itemSchema = z.object({
  concepto:            z.string().max(300).default(''),
  unidad:              z.enum(['unid', 'hora', 'global', 'm2', 'kg', 'dia', 'otro']).default('global'),
  proveedor_id:        z.string().uuid().optional().nullable(),
  costo_estimado:      z.number().int().min(0).default(0),
  precio_venta:        z.number().int().min(0).default(0),
  gasto_real:          z.number().int().min(0).default(0),
  cantidad:            z.number().min(0).default(1),
  precio_unitario:     z.number().int().min(0).default(0),
  tipo_comprobante:    z.enum(['factura', 'boleta', 'rxh', 'sin_comprobante', 'pendiente']).optional().nullable(),
  estado_pago:         z.enum(['pendiente', 'pagado', 'parcial']).default('pendiente'),
  fecha_pago:          z.string().nullable().optional(),
  foto_url:            z.string().nullable().optional(),
  factura_url:         z.string().nullable().optional(),
  constancia_pago_url: z.string().nullable().optional(),
  sort_order:          z.number().int().default(0),
  estado:              z.enum(['presupuestado', 'en_ejecucion', 'ejecutado', 'cancelado']).default('presupuestado'),
})

const SELECT_FIELDS = `
  id, concepto, unidad, proveedor_id, costo_estimado, precio_venta,
  gasto_real, cantidad, precio_unitario, tipo_comprobante,
  estado_pago, fecha_pago, foto_url, factura_url, constancia_pago_url,
  sort_order, created_at, estado,
  proveedor:proveedores(id, razon_social, nombre_comercial)
`

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (!proyecto) return apiError('Proyecto no encontrado', 404)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('proyecto_items' as never) as any)
    .select(SELECT_FIELDS)
    .eq('proyecto_id', params.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return apiError('Error obteniendo items', 500, error)
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(req)
  if (body instanceof NextResponse) return body

  const parsed = itemSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)

  const supabase = createClient()
  const { data: proyecto } = await supabase
    .from('proyectos').select('id').eq('id', params.id).eq('org_id', auth.orgId).single()
  if (!proyecto) return apiError('Proyecto no encontrado', 404)

  const d = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase.from('proyecto_items' as never) as any)
    .insert({
      proyecto_id:         params.id,
      org_id:              auth.orgId,
      concepto:            d.concepto,
      unidad:              d.unidad,
      proveedor_id:        d.proveedor_id ?? null,
      costo_estimado:      d.costo_estimado,
      precio_venta:        d.precio_venta,
      gasto_real:          d.gasto_real,
      cantidad:            d.cantidad,
      precio_unitario:     d.precio_unitario,
      tipo_comprobante:    d.tipo_comprobante ?? 'pendiente',
      estado_pago:         d.estado_pago,
      fecha_pago:          d.fecha_pago ?? null,
      foto_url:            d.foto_url ?? null,
      factura_url:         d.factura_url ?? null,
      constancia_pago_url: d.constancia_pago_url ?? null,
      sort_order:          d.sort_order,
      estado:              d.estado,
    })
    .select(SELECT_FIELDS)
    .single()

  if (error) return apiError('Error creando item', 500, error)
  return NextResponse.json(item, { status: 201 })
}
