import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { apiRateLimit } from '@/lib/rate-limit'
import { proveedorSchema } from '@/lib/validations/proveedor'

/**
 * GET /api/proveedores
 * Lista todos los proveedores de la organización.
 * Soporta ?search= para filtrar por RUC o razón social.
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''

  const supabase = createClient()
  let query = supabase
    .from('proveedores')
    .select('id, ruc, tipo_documento, numero_documento, razon_social, nombre_comercial, tipo, condicion_pago, email, created_at')
    .eq('org_id', auth.orgId)
    .order('razon_social', { ascending: true })

  if (search) {
    query = query.or(
      `ruc.ilike.%${search}%,razon_social.ilike.%${search}%,nombre_comercial.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    return apiError('Error obteniendo proveedores', 500, error)
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/proveedores
 * Crea un nuevo proveedor. Requiere rol admin o pm.
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

  const parsed = proveedorSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const data = parsed.data

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertPayload: any = {
    org_id: auth.orgId,
    ruc: data.tipo === 'persona_juridica' ? (data.ruc ?? null) : null,
    tipo_documento: data.tipo === 'persona_natural' ? (data.tipo_documento ?? null) : null,
    numero_documento: data.tipo === 'persona_natural' ? (data.numero_documento ?? null) : null,
    razon_social: data.razon_social,
    nombre_comercial: data.nombre_comercial || null,
    tipo: data.tipo,
    actividad: data.actividad || null,
    aplica_detraccion: false,
    pct_detraccion: 0,
    condicion_pago: data.condicion_pago || null,
    email: data.email || null,
    notas: data.notas || null,
  }
  const { data: proveedor, error } = await supabase
    .from('proveedores')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return apiError('Ya existe un proveedor con ese RUC en tu organización', 409)
    }
    return apiError('Error creando proveedor', 500, error)
  }

  return NextResponse.json(proveedor, { status: 201 })
}
