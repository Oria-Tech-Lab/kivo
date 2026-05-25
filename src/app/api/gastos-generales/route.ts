import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { gastoGeneralSchema } from '@/lib/validations/gasto-general'

/**
 * GET /api/gastos-generales
 * Lista gastos generales de la organización.
 */
export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data, error } = await supabase
    .from('gastos_generales')
    .select(`
      id, concepto, tipo_recurrencia, monto, total, igv,
      periodo_mes, periodo_anio, tipo_comprobante,
      umbral_proyectos, estado, created_at,
      proveedor:proveedores(id, razon_social, nombre_comercial)
    `)
    .eq('org_id', auth.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return apiError('Error obteniendo gastos generales', 500, error)
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/gastos-generales
 * Crea un gasto general. Calcula IGV automáticamente si es factura.
 * Requiere rol admin o pm.
 */
export async function POST(request: Request) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = gastoGeneralSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data

  // Calcular IGV solo para facturas
  const igv = data.tipo_comprobante === 'factura'
    ? Math.round(data.monto * 0.18)
    : 0
  const total = data.monto + igv

  const supabase = createClient()
  const { data: gg, error } = await supabase
    .from('gastos_generales')
    .insert({
      org_id: auth.orgId,
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
      estado: 'pendiente_asignacion',
    })
    .select()
    .single()

  if (error) {
    return apiError('Error creando gasto general', 500, error)
  }

  return NextResponse.json(gg, { status: 201 })
}
