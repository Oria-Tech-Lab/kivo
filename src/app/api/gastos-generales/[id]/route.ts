import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { gastoGeneralSchema } from '@/lib/validations/gasto-general'

type Params = { params: { id: string } }

/**
 * GET /api/gastos-generales/[id]
 * Obtiene un GG con proveedor y asignaciones a proyectos.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data, error } = await supabase
    .from('gastos_generales')
    .select(`
      *,
      proveedor:proveedores(id, razon_social, nombre_comercial, ruc),
      asignaciones:asignaciones_gg(
        id, monto, pct, fecha,
        proyecto:proyectos(id, nombre)
      )
    `)
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (error || !data) {
    return apiError('Gasto general no encontrado', 404)
  }

  return NextResponse.json(data)
}

/**
 * PUT /api/gastos-generales/[id]
 * Actualiza un gasto general.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = gastoGeneralSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  // Verificar acceso
  const { data: existing } = await supabase
    .from('gastos_generales')
    .select('id')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Gasto general no encontrado', 404)
  }

  const igv = data.tipo_comprobante === 'factura'
    ? Math.round(data.monto * 0.18)
    : 0
  const total = data.monto + igv

  const { data: gg, error } = await supabase
    .from('gastos_generales')
    .update({
      proveedor_id: data.proveedor_id || null,
      concepto: data.concepto,
      tipo_recurrencia: data.tipo_recurrencia,
      monto: data.monto,
      periodo_mes: data.periodo_mes ?? null,
      periodo_anio: data.periodo_anio ?? null,
      tipo_comprobante: data.tipo_comprobante ?? null,
      igv,
      total,
      umbral_proyectos: data.umbral_proyectos,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return apiError('Error actualizando gasto general', 500, error)
  }

  return NextResponse.json(gg)
}

/**
 * DELETE /api/gastos-generales/[id]
 * Elimina un GG. Requiere rol admin.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('gastos_generales')
    .select('id')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Gasto general no encontrado', 404)
  }

  const { error } = await supabase
    .from('gastos_generales')
    .delete()
    .eq('id', params.id)

  if (error) {
    return apiError('Error eliminando gasto general', 500, error)
  }

  return NextResponse.json({ success: true })
}
