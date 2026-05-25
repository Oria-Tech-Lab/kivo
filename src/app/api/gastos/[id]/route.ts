import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { gastoSchema } from '@/lib/validations/gasto'
import { calcularGasto } from '@/lib/calculations/tributarios'
import type { Database } from '@/types/supabase'

type GastoUpdate = Database['public']['Tables']['gastos']['Update']

type Params = { params: { id: string } }

/**
 * GET /api/gastos/[id]
 * Obtiene un gasto con datos de proveedor y proyecto.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data, error } = await supabase
    .from('gastos')
    .select(`
      *,
      proveedor:proveedores(id, razon_social, nombre_comercial, ruc),
      proyecto:proyectos!inner(id, nombre, org_id, cliente:clientes(id, nombre))
    `)
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (error || !data) {
    return apiError('Gasto no encontrado', 404)
  }

  return NextResponse.json(data)
}

/**
 * PUT /api/gastos/[id]
 * Actualiza un gasto. Recalcula montos automáticamente.
 * Requiere rol admin o pm.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = gastoSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  // Verificar acceso al gasto
  const { data: existing } = await supabase
    .from('gastos')
    .select('id, proyectos!inner(org_id)')
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Gasto no encontrado', 404)
  }

  const calculo = calcularGasto({
    subtotal: data.subtotal,
    tipoComprobante: data.tipo_comprobante,
    aplicaDetraccion: data.aplica_detraccion,
    pctDetraccion: data.pct_detraccion,
  })

  const { data: gasto, error } = await supabase
    .from('gastos')
    .update({
      proveedor_id: data.proveedor_id,
      linea_presupuesto_id: data.linea_presupuesto_id || null,
      concepto: data.concepto,
      tipo_comprobante: data.tipo_comprobante,
      serie: data.serie || null,
      numero_doc: data.numero_doc || null,
      subtotal: calculo.subtotal,
      igv: calculo.igvCredito,
      total: calculo.total,
      aplica_detraccion: data.aplica_detraccion,
      pct_detraccion: data.aplica_detraccion ? data.pct_detraccion : 0,
      monto_detraccion: calculo.montoDetraccion,
      neto_a_pagar: calculo.netoAPagar,
      retencion_4ta: calculo.retencion4ta,
      fecha_comprobante: data.fecha_comprobante,
      fecha_vencimiento_pago: data.fecha_vencimiento_pago || null,
      estado_pago: data.estado_pago,
      notas: data.notas || null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return apiError('Error actualizando gasto', 500, error)
  }

  return NextResponse.json(gasto)
}

/**
 * PATCH /api/gastos/[id]
 * Actualiza estado de pago o detracción.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Body JSON inválido', 400)
  }

  const bodyObj = body as Record<string, unknown>
  const supabase = createClient()

  // Verificar acceso
  const { data: existing } = await supabase
    .from('gastos')
    .select('id, proyectos!inner(org_id)')
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Gasto no encontrado', 404)
  }

  const updates: GastoUpdate = {}

  if (bodyObj.estado_pago && ['pendiente', 'pagado'].includes(bodyObj.estado_pago as string)) {
    updates.estado_pago = bodyObj.estado_pago as 'pendiente' | 'pagado'
    if (bodyObj.estado_pago === 'pagado') {
      updates.fecha_pago_real = (bodyObj.fecha_pago_real as string | undefined) ?? new Date().toISOString().split('T')[0]
    } else {
      updates.fecha_pago_real = null
    }
  }

  if (bodyObj.estado_detraccion && ['pendiente', 'depositada', 'no_aplica'].includes(bodyObj.estado_detraccion as string)) {
    updates.estado_detraccion = bodyObj.estado_detraccion as 'pendiente' | 'depositada' | 'no_aplica'
    if (bodyObj.estado_detraccion === 'depositada') {
      updates.fecha_deposito_detraccion = (bodyObj.fecha_deposito as string | undefined) ?? new Date().toISOString().split('T')[0]
    }
  }

  if (Object.keys(updates).length === 0) {
    return apiError('No hay campos válidos para actualizar', 400)
  }

  const { data: gasto, error } = await supabase
    .from('gastos')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return apiError('Error actualizando gasto', 500, error)
  }

  return NextResponse.json(gasto)
}

/**
 * DELETE /api/gastos/[id]
 * Elimina un gasto. Requiere rol admin.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('gastos')
    .select('id, adjunto_url, proyectos!inner(org_id)')
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (!existing) {
    return apiError('Gasto no encontrado', 404)
  }

  // Si tiene adjunto, eliminar de Storage
  const existingGasto = existing as { id: string; adjunto_url: string | null }
  if (existingGasto.adjunto_url) {
    // Extraer path del storage desde la URL pública
    // URL: .../storage/v1/object/sign/comprobantes/<path>?token=...
    // o URL pública: .../storage/v1/object/public/comprobantes/<path>
    const url = existingGasto.adjunto_url
    const match = url.match(/\/comprobantes\/(.+?)(\?|$)/)
    if (match) {
      await supabase.storage.from('comprobantes').remove([match[1]])
    }
  }

  const { error } = await supabase
    .from('gastos')
    .delete()
    .eq('id', params.id)

  if (error) {
    return apiError('Error eliminando gasto', 500, error)
  }

  return NextResponse.json({ success: true })
}
