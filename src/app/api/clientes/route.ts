import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { apiRateLimit } from '@/lib/rate-limit'
import { clienteSchema } from '@/lib/validations/cliente'

/**
 * GET /api/clientes
 * Lista todos los clientes de la organización.
 * Soporta ?search= para filtrar por nombre o RUC.
 * Soporta ?estado=activo|inactivo
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const estado = searchParams.get('estado')

  const supabase = createClient()
  let query = supabase
    .from('clientes')
    .select('id, nombre, ruc, contacto_nombre, contacto_email, contacto_telefono, estado, created_at')
    .eq('org_id', auth.orgId)
    .order('nombre', { ascending: true })

  if (search) {
    query = query.or(
      `nombre.ilike.%${search}%,ruc.ilike.%${search}%`
    )
  }

  if (estado && (estado === 'activo' || estado === 'inactivo')) {
    query = query.eq('estado', estado)
  }

  const { data, error } = await query

  if (error) {
    return apiError('Error obteniendo clientes', 500, error)
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/clientes
 * Crea un nuevo cliente. Requiere rol admin o pm.
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

  const parsed = clienteSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data

  const supabase = createClient()
  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({
      org_id: auth.orgId,
      nombre: data.nombre,
      ruc: data.ruc || null,
      contacto_nombre: data.contacto_nombre || null,
      contacto_email: data.contacto_email || null,
      contacto_telefono: data.contacto_telefono || null,
      estado: data.estado,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return apiError('Ya existe un cliente con ese RUC en tu organización', 409)
    }
    return apiError('Error creando cliente', 500, error)
  }

  return NextResponse.json(cliente, { status: 201 })
}
