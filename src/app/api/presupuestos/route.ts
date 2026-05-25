import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { apiRateLimit } from '@/lib/rate-limit'
import { presupuestoSchema } from '@/lib/validations/presupuesto'
import { calcularIGVDebito } from '@/lib/calculations/tributarios'

/**
 * GET /api/presupuestos
 * Lista presupuestos. Soporta ?proyecto_id= para filtrar por proyecto.
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')

  const supabase = createClient()
  let query = supabase
    .from('presupuestos')
    .select(`
      id, version, estado, condicion_pago, fecha_aprobacion,
      subtotal, igv_total, total, created_at,
      proyecto:proyectos!inner(id, nombre, org_id, cliente:clientes(id, nombre))
    `)
    .eq('proyectos.org_id', auth.orgId)
    .order('created_at', { ascending: false })

  if (proyectoId) {
    query = query.eq('proyecto_id', proyectoId)
  }

  const { data, error } = await query

  if (error) {
    return apiError('Error obteniendo presupuestos', 500, error)
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/presupuestos
 * Crea un presupuesto con sus líneas. Calcula totales automáticamente.
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

  const parsed = presupuestoSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data
  const supabase = createClient()

  // Verificar que el proyecto pertenece a la misma organización
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, org_id')
    .eq('id', data.proyecto_id)
    .eq('org_id', auth.orgId)
    .single()

  if (!proyecto) {
    return apiError('Proyecto no encontrado en tu organización', 404)
  }

  // Determinar siguiente versión del presupuesto para este proyecto
  const { count: versionCount } = await supabase
    .from('presupuestos')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', data.proyecto_id)

  const nextVersion = (versionCount ?? 0) + 1

  // Calcular totales: subtotal = suma de subtotales de líneas (sin IGV)
  // Las líneas llevan IGV = 18% del subtotal de cada línea
  const lineasCalculadas = data.lineas.map((linea) => {
    const igv = calcularIGVDebito(linea.subtotal)
    const total = linea.subtotal + igv
    return {
      ...linea,
      igv,
      total,
    }
  })

  const subtotalTotal = lineasCalculadas.reduce((sum, l) => sum + l.subtotal, 0)
  const igvTotal = lineasCalculadas.reduce((sum, l) => sum + l.igv, 0)
  const totalTotal = lineasCalculadas.reduce((sum, l) => sum + l.total, 0)

  // Insertar presupuesto
  const { data: presupuesto, error: presError } = await supabase
    .from('presupuestos')
    .insert({
      org_id: auth.orgId,
      proyecto_id: data.proyecto_id,
      version: nextVersion,
      estado: 'borrador',
      condicion_pago: data.condicion_pago,
      subtotal: subtotalTotal,
      igv_total: igvTotal,
      total: totalTotal,
    })
    .select()
    .single()

  if (presError || !presupuesto) {
    return apiError('Error creando presupuesto', 500, presError)
  }

  // Insertar líneas
  const lineasData = lineasCalculadas.map((linea) => ({
    presupuesto_id: (presupuesto as { id: string }).id,
    concepto: linea.concepto,
    subtotal: linea.subtotal,
    igv: linea.igv,
    total: linea.total,
    pct_fee: linea.pct_fee ?? null,
  }))

  const { error: lineasError } = await supabase
    .from('lineas_presupuesto')
    .insert(lineasData)

  if (lineasError) {
    // Rollback: eliminar el presupuesto creado
    await supabase.from('presupuestos').delete().eq('id', (presupuesto as { id: string }).id)
    return apiError('Error creando líneas del presupuesto', 500, lineasError)
  }

  return NextResponse.json(presupuesto, { status: 201 })
}
