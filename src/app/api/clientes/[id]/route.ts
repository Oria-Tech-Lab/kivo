import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { clienteSchema } from '@/lib/validations/cliente'

type Params = { params: { id: string } }

/**
 * GET /api/clientes/[id]
 * Obtiene un cliente por ID.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (error || !data) {
    return apiError('Cliente no encontrado', 404)
  }

  return NextResponse.json(data)
}

/**
 * PUT /api/clientes/[id]
 * Actualiza un cliente. Requiere rol admin o pm.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = clienteSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .update({
      nombre: data.nombre,
      ruc: data.ruc || null,
      contacto_nombre: data.contacto_nombre || null,
      contacto_email: data.contacto_email || null,
      contacto_telefono: data.contacto_telefono || null,
      estado: data.estado,
    })
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return apiError('Ya existe un cliente con ese RUC en tu organización', 409)
    }
    return apiError('Error actualizando cliente', 500, error)
  }

  if (!cliente) {
    return apiError('Cliente no encontrado', 404)
  }

  return NextResponse.json(cliente)
}

/**
 * DELETE /api/clientes/[id]
 * Elimina un cliente. Requiere rol admin.
 * Solo permite borrar clientes sin proyectos asociados.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // Verificar que no tenga proyectos asociados
  const { count } = await supabase
    .from('proyectos')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', params.id)

  if (count && count > 0) {
    return apiError(
      'No se puede eliminar un cliente con proyectos asociados. Primero elimina o reasigna los proyectos.',
      409
    )
  }

  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', params.id)
    .eq('org_id', auth.orgId)

  if (error) {
    return apiError('Error eliminando cliente', 500, error)
  }

  return NextResponse.json({ success: true })
}
