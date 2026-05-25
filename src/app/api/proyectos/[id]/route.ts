import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { proyectoSchema } from '@/lib/validations/proyecto'

type Params = { params: { id: string } }

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
