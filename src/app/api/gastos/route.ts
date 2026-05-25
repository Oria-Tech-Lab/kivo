import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { apiRateLimit } from '@/lib/rate-limit'
import { gastoSchema } from '@/lib/validations/gasto'
import { calcularGasto } from '@/lib/calculations/tributarios'

/**
 * GET /api/gastos
 * Lista gastos. Soporta ?proyecto_id=, ?estado_pago=, ?search=
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')
  const estadoPago = searchParams.get('estado_pago')
  const search = searchParams.get('search')?.trim() ?? ''

  const supabase = createClient()
  let query = supabase
    .from('gastos')
    .select(`
      id, concepto, tipo_comprobante, serie, numero_doc,
      subtotal, igv, total, aplica_detraccion, pct_detraccion,
      monto_detraccion, neto_a_pagar, retencion_4ta,
      fecha_comprobante, fecha_vencimiento_pago, estado_pago,
      estado_detraccion, adjunto_url, notas, created_at,
      proveedor:proveedores(id, razon_social, nombre_comercial),
      proyecto:proyectos!inner(id, nombre, org_id)
    `)
    .eq('proyectos.org_id', auth.orgId)
    .order('fecha_comprobante', { ascending: false })

  if (proyectoId) {
    query = query.eq('proyecto_id', proyectoId)
  }

  if (estadoPago && ['pendiente', 'pagado'].includes(estadoPago)) {
    query = query.eq('estado_pago', estadoPago as 'pendiente' | 'pagado')
  }

  if (search) {
    query = query.ilike('concepto', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return apiError('Error obteniendo gastos', 500, error)
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/gastos
 * Crea un gasto. Calcula IGV, detracción y retención automáticamente.
 * Requiere rol admin o pm.
 */
export async function POST(request: Request) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const rl = await apiRateLimit(auth.userId)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit excedido' }, { status: 429 })
  }

  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = gastoSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  // Verificar que el proyecto pertenece a la organización
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, org_id')
    .eq('id', data.proyecto_id)
    .eq('org_id', auth.orgId)
    .single()

  if (!proyecto) {
    return apiError('Proyecto no encontrado en tu organización', 404)
  }

  // Verificar que el proveedor pertenece a la organización
  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, org_id')
    .eq('id', data.proveedor_id)
    .eq('org_id', auth.orgId)
    .single()

  if (!proveedor) {
    return apiError('Proveedor no encontrado en tu organización', 404)
  }

  // Calcular montos tributarios
  const calculo = calcularGasto({
    subtotal: data.subtotal,
    tipoComprobante: data.tipo_comprobante,
    aplicaDetraccion: data.aplica_detraccion,
    pctDetraccion: data.pct_detraccion,
  })

  const { data: gasto, error } = await supabase
    .from('gastos')
    .insert({
      org_id: auth.orgId,
      proyecto_id: data.proyecto_id,
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
      estado_detraccion: data.aplica_detraccion ? 'pendiente' : 'no_aplica',
      notas: data.notas || null,
    })
    .select()
    .single()

  if (error) {
    return apiError('Error creando gasto', 500, error)
  }

  return NextResponse.json(gasto, { status: 201 })
}
