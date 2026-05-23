import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { proveedorSchema } from '@/lib/validations/proveedor'

type Params = { params: { id: string } }

/**
 * GET /api/proveedores/[id]
 * Obtiene un proveedor por ID.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', auth.orgId) // RLS + validación explícita
    .single()

  if (error || !data) {
    return apiError('Proveedor no encontrado', 404)
  }

  return NextResponse.json(data)
}

/**
 * PUT /api/proveedores/[id]
 * Actualiza un proveedor. Requiere rol admin o pm.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = proveedorSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  const { data: proveedor, error } = await supabase
    .from('proveedores')
    .update({
      ruc: data.ruc,
      razon_social: data.razon_social,
      nombre_comercial: data.nombre_comercial || null,
      tipo: data.tipo,
      actividad: data.actividad || null,
      aplica_detraccion: data.aplica_detraccion,
      pct_detraccion: data.aplica_detraccion ? data.pct_detraccion : 0,
      condicion_pago: data.condicion_pago || null,
      email: data.email || null,
      notas: data.notas || null,
    })
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return apiError('Ya existe un proveedor con ese RUC', 409)
    }
    return apiError('Error actualizando proveedor', 500, error)
  }

  if (!proveedor) {
    return apiError('Proveedor no encontrado', 404)
  }

  return NextResponse.json(proveedor)
}

/**
 * DELETE /api/proveedores/[id]
 * Elimina un proveedor. Solo admin.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { error } = await supabase
    .from('proveedores')
    .delete()
    .eq('id', params.id)
    .eq('org_id', auth.orgId)

  if (error) {
    if (error.code === '23503') {
      return apiError('No se puede eliminar: el proveedor tiene gastos asociados', 409)
    }
    return apiError('Error eliminando proveedor', 500, error)
  }

  return new NextResponse(null, { status: 204 })
}
