import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { id: string } }

const asignarSchema = z.object({
  proyecto_id: z.string().uuid('ID de proyecto inválido'),
  monto: z.number().int().min(1, 'El monto debe ser mayor a 0'),
  pct: z.number().min(0).max(100).optional(),
})

/**
 * POST /api/gastos-generales/[id]/asignar
 * Asigna un GG a un proyecto (upsert).
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = asignarSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  // Verificar GG de la org
  const { data: gg } = await supabase
    .from('gastos_generales')
    .select('id, total')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (!gg) {
    return apiError('Gasto general no encontrado', 404)
  }

  // Verificar proyecto de la org
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id', data.proyecto_id)
    .eq('org_id', auth.orgId)
    .single()

  if (!proyecto) {
    return apiError('Proyecto no encontrado en tu organización', 404)
  }

  // Upsert de la asignación
  const { data: asignacion, error } = await supabase
    .from('asignaciones_gg')
    .upsert(
      {
        gasto_general_id: params.id,
        proyecto_id: data.proyecto_id,
        monto: data.monto,
        pct: data.pct ?? null,
        fecha: new Date().toISOString().split('T')[0],
      },
      { onConflict: 'gasto_general_id,proyecto_id' }
    )
    .select()
    .single()

  if (error) {
    return apiError('Error creando asignación', 500, error)
  }

  // Actualizar estado del GG según cobertura
  const { data: todasAsignaciones } = await supabase
    .from('asignaciones_gg')
    .select('monto')
    .eq('gasto_general_id', params.id)

  const totalAsignado = (todasAsignaciones ?? []).reduce(
    (s, a) => s + ((a as { monto: number }).monto ?? 0), 0
  )
  const totalGG = (gg as { total: number }).total

  type GGEstado = 'pendiente_asignacion' | 'cubierto_parcial' | 'cubierto' | 'generando_ganancia'
  let estado: GGEstado
  if (totalAsignado <= 0) {
    estado = 'pendiente_asignacion'
  } else if (totalAsignado < totalGG) {
    estado = 'cubierto_parcial'
  } else if (totalAsignado === totalGG) {
    estado = 'cubierto'
  } else {
    estado = 'generando_ganancia'
  }

  await supabase
    .from('gastos_generales')
    .update({ estado })
    .eq('id', params.id)

  return NextResponse.json(asignacion, { status: 201 })
}

/**
 * DELETE /api/gastos-generales/[id]/asignar
 * Elimina la asignación de un proyecto.
 * Body: { proyecto_id: UUID }
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Body JSON inválido', 400)
  }

  const bodyObj = body as Record<string, unknown>
  const proyectoId = bodyObj.proyecto_id as string | undefined

  if (!proyectoId) {
    return apiError('proyecto_id es requerido', 400)
  }

  const supabase = createClient()

  // Verificar GG de la org
  const { data: gg } = await supabase
    .from('gastos_generales')
    .select('id, total')
    .eq('id', params.id)
    .eq('org_id', auth.orgId)
    .single()

  if (!gg) {
    return apiError('Gasto general no encontrado', 404)
  }

  const { error } = await supabase
    .from('asignaciones_gg')
    .delete()
    .eq('gasto_general_id', params.id)
    .eq('proyecto_id', proyectoId)

  if (error) {
    return apiError('Error eliminando asignación', 500, error)
  }

  // Recalcular estado
  const { data: todasAsignaciones } = await supabase
    .from('asignaciones_gg')
    .select('monto')
    .eq('gasto_general_id', params.id)

  const totalAsignado = (todasAsignaciones ?? []).reduce(
    (s, a) => s + ((a as { monto: number }).monto ?? 0), 0
  )
  const totalGG = (gg as { total: number }).total

  type GGEstado = 'pendiente_asignacion' | 'cubierto_parcial' | 'cubierto' | 'generando_ganancia'
  let estado: GGEstado
  if (totalAsignado <= 0) {
    estado = 'pendiente_asignacion'
  } else if (totalAsignado < totalGG) {
    estado = 'cubierto_parcial'
  } else if (totalAsignado === totalGG) {
    estado = 'cubierto'
  } else {
    estado = 'generando_ganancia'
  }

  await supabase
    .from('gastos_generales')
    .update({ estado })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
