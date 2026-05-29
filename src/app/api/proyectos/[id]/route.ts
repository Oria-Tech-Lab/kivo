import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { proyectoSchema } from '@/lib/validations/proyecto'
import { z } from 'zod'

type Params = { params: { id: string } }

const patchSchema = z.object({
  estado:                  z.enum(['activo', 'en_pausa', 'cerrado']).optional(),
  notas:                   z.string().max(5000).optional().nullable(),
  tipo:                    z.enum(['digital', 'offline', 'evento', 'instalacion', 'otro']).optional(),
  fecha_inicio:            z.string().optional(),
  fecha_cierre_est:        z.string().optional().nullable(),
  aplica_detraccion:       z.boolean().optional(),
  cliente_id:              z.string().uuid().optional().nullable(),
  responsable_id:          z.string().uuid().optional().nullable(),
  subtotal_proyecto:       z.number().int().min(0).optional(),
  aplica_igv_venta:        z.boolean().optional(),
  aplica_detraccion_venta: z.boolean().optional(),
  pct_detraccion_venta:    z.number().int().min(0).max(100).optional(),
  fase:                    z.enum(['cotizacion', 'aprobado', 'ejecucion', 'finalizado']).optional(),
  subtotal_manual:         z.boolean().optional(),
  descuento_tipo:          z.enum(['pct', 'fijo']).optional(),
  descuento_valor:         z.number().int().min(0).optional(),
})

/**
 * PATCH /api/proyectos/[id]
 * Actualización parcial: estado y/o notas. Requiere rol pm o admin.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proyecto, error } = await (supabase.from('proyectos') as any)
    .update(parsed.data)
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .select('id, estado, notas, tipo, fecha_inicio, fecha_cierre_est, aplica_detraccion, cliente_id, responsable_id, subtotal_proyecto, subtotal_manual, aplica_igv_venta, aplica_detraccion_venta, pct_detraccion_venta, fase, descuento_tipo, descuento_valor')
    .single()

  if (error || !proyecto) return apiError('Error actualizando proyecto', 500, error ?? undefined)
  return NextResponse.json(proyecto)
}

/**
 * GET /api/proyectos/[id]
 * Obtiene un proyecto por ID con datos del cliente.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data, error } = await supabase
    .from('proyectos')
    .select(`
      *,
      cliente:clientes(id, nombre, ruc),
      categoria:categorias(id, nombre, color)
    `)
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (error || !data) {
    return apiError('Proyecto no encontrado', 404)
  }

  return NextResponse.json(data)
}

/**
 * PUT /api/proyectos/[id]
 * Actualiza un proyecto. Requiere rol admin o pm.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = proyectoSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  // Verificar que el cliente pertenece a la misma organización
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('id', data.cliente_id)
    .eq('org_id', auth.orgId)
    .single()

  if (!cliente) {
    return apiError('Cliente no encontrado en tu organización', 404)
  }

  const { data: proyecto, error } = await supabase
    .from('proyectos')
    .update({
      cliente_id: data.cliente_id,
      nombre: data.nombre,
      tipo: data.tipo,
      categoria_id: data.categoria_id || null,
      estado: data.estado,
      responsable_id: data.responsable_id || null,
      fecha_inicio: data.fecha_inicio,
      fecha_cierre_est: data.fecha_cierre_est || null,
      aplica_detraccion: data.aplica_detraccion,
      notas: data.notas || null,
    })
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .select()
    .single()

  if (error) {
    return apiError('Error actualizando proyecto', 500, error)
  }

  if (!proyecto) {
    return apiError('Proyecto no encontrado', 404)
  }

  return NextResponse.json(proyecto)
}

/**
 * DELETE /api/proyectos/[id]
 * Elimina un proyecto. Requiere rol admin.
 * Solo permite borrar proyectos sin gastos asociados.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // Verificar que no tenga gastos asociados
  const { count } = await supabase
    .from('gastos')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', params.id)

  if (count && count > 0) {
    return apiError(
      'No se puede eliminar un proyecto con gastos registrados. Primero elimina los gastos.',
      409
    )
  }

  const { error } = await supabase
    .from('proyectos')
    .delete()
    .eq('id', params.id)
    .eq('org_id', auth.orgId)

  if (error) {
    return apiError('Error eliminando proyecto', 500, error)
  }

  return NextResponse.json({ success: true })
}
