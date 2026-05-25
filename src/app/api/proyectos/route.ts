import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { apiRateLimit } from '@/lib/rate-limit'
import { proyectoSchema } from '@/lib/validations/proyecto'

/**
 * GET /api/proyectos
 * Lista todos los proyectos de la organización con datos del cliente.
 * Soporta ?search=, ?estado=, ?cliente_id=
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const estado = searchParams.get('estado')
  const clienteId = searchParams.get('cliente_id')

  const supabase = createClient()
  let query = supabase
    .from('proyectos')
    .select(`
      id, nombre, tipo, estado, fecha_inicio, fecha_cierre_est,
      aplica_detraccion, notas, created_at,
      cliente:clientes(id, nombre, ruc)
    `)
    .eq('org_id', auth.orgId)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('nombre', `%${search}%`)
  }

  if (estado && (['activo', 'en_pausa', 'cerrado'] as string[]).includes(estado)) {
    query = query.eq('estado', estado as 'activo' | 'en_pausa' | 'cerrado')
  }

  if (clienteId) {
    query = query.eq('cliente_id', clienteId)
  }

  const { data, error } = await query

  if (error) {
    return apiError('Error obteniendo proyectos', 500, error)
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/proyectos
 * Crea un nuevo proyecto. Requiere rol admin o pm.
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

  const parsed = proyectoSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data

  // Verificar que el cliente pertenece a la misma organización
  const supabase = createClient()
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
    .insert({
      org_id: auth.orgId,
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
    .select()
    .single()

  if (error) {
    return apiError('Error creando proyecto', 500, error)
  }

  return NextResponse.json(proyecto, { status: 201 })
}
