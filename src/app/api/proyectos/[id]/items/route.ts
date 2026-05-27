import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { id: string } }

const itemSchema = z.object({
  concepto: z.string().max(300).default(''),
  unidad: z.enum(['unid', 'hora', 'global', 'm2', 'kg', 'dia', 'otro']).default('global'),
  proveedor_id: z.string().uuid().optional().nullable(),
  costo_estimado: z.number().int().min(0).default(0),
  precio_venta: z.number().int().min(0).default(0),
  gasto_real: z.number().int().min(0).default(0),
  tipo_comprobante: z.enum(['factura', 'boleta', 'rxh', 'sin_comprobante']).optional().nullable(),
  sort_order: z.number().int().default(0),
})

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // Verify project belongs to org
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (!proyecto) return apiError('Proyecto no encontrado', 404)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('proyecto_items' as never) as any)
    .select(`
      id, concepto, unidad, proveedor_id, costo_estimado, precio_venta,
      gasto_real, tipo_comprobante, sort_order, created_at,
      proveedor:proveedores(id, razon_social, nombre_comercial)
    `)
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
      proyecto_id: params.id,
      org_id: auth.orgId,
      concepto: d.concepto,
      unidad: d.unidad,
      proveedor_id: d.proveedor_id ?? null,
      costo_estimado: d.costo_estimado,
      precio_venta: d.precio_venta,
      gasto_real: d.gasto_real,
      tipo_comprobante: d.tipo_comprobante ?? null,
      sort_order: d.sort_order,
    })
    .select()
    .single()

  if (error) {
    // Retornar detalle para diagnóstico — quitar en producción si es sensible
    return NextResponse.json(
      { error: 'Error creando item', code: error.code, details: error.message, hint: error.hint },
      { status: 500 }
    )
  }
  return NextResponse.json(item, { status: 201 })
}
