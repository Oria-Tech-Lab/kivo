import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/caja
 * Lista movimientos de caja. Soporta filtros:
 * ?tipo=ingreso|egreso|detraccion|retencion
 * ?estado=pendiente|realizado|vencido
 * ?proyecto_id=UUID
 * ?desde=YYYY-MM-DD
 * ?hasta=YYYY-MM-DD
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')
  const estado = searchParams.get('estado')
  const proyectoId = searchParams.get('proyecto_id')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const supabase = createClient()

  let query = supabase
    .from('movimientos_caja')
    .select(`
      id, tipo, origen_tabla, origen_id,
      concepto, monto, fecha_esperada, fecha_real, estado, created_at,
      proyecto:proyectos(id, nombre),
      cliente:clientes(id, nombre),
      proveedor:proveedores(id, razon_social, nombre_comercial)
    `)
    .eq('org_id', auth.orgId)
    .order('fecha_esperada', { ascending: true })

  if (tipo && ['ingreso', 'egreso', 'detraccion', 'retencion'].includes(tipo)) {
    query = query.eq('tipo', tipo as 'ingreso' | 'egreso' | 'detraccion' | 'retencion')
  }

  if (estado && ['pendiente', 'realizado', 'vencido'].includes(estado)) {
    query = query.eq('estado', estado as 'pendiente' | 'realizado' | 'vencido')
  }

  if (proyectoId) {
    query = query.eq('proyecto_id', proyectoId)
  }

  if (desde) {
    query = query.gte('fecha_esperada', desde)
  }

  if (hasta) {
    query = query.lte('fecha_esperada', hasta)
  }

  const { data, error } = await query

  if (error) {
    return apiError('Error obteniendo movimientos de caja', 500, error)
  }

  return NextResponse.json(data ?? [])
}
