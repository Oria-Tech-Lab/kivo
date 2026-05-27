import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type Params = { params: { id: string } }

const facturaSchema = z.object({
  numero_factura:   z.string().min(1).max(50),
  subtotal:         z.number().int().min(0),
  aplica_igv:       z.boolean().default(true),
  aplica_detraccion: z.boolean().default(false),
  pct_detraccion:   z.number().int().min(0).max(100).default(0),
  estado:           z.enum(['borrador','emitida','cobrada','vencida']).default('borrador'),
  fecha_emision:    z.string().nullable().optional(),
  fecha_vencimiento: z.string().nullable().optional(),
  fecha_cobro:      z.string().nullable().optional(),
  notas:            z.string().max(2000).nullable().optional(),
})

const SELECT = `
  id, proyecto_id, org_id, numero_factura, subtotal, aplica_igv, igv,
  aplica_detraccion, pct_detraccion, monto_detraccion, total, cliente_abona,
  estado, fecha_emision, fecha_vencimiento, fecha_cobro, notas, created_at
`

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  const { data: proyecto } = await supabase
    .from('proyectos').select('id').eq('id', params.id).eq('org_id', auth.orgId).single()
  if (!proyecto) return apiError('Proyecto no encontrado', 404)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('facturas_proyecto' as never) as any)
    .select(SELECT)
    .eq('proyecto_id', params.id)
    .eq('org_id', auth.orgId)
    .order('created_at', { ascending: true })

  if (error) return apiError('Error obteniendo facturas', 500, error)
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody<unknown>(req)
  if (body instanceof NextResponse) return body

  const parsed = facturaSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)

  const supabase = createClient()
  const { data: proyecto } = await supabase
    .from('proyectos').select('id').eq('id', params.id).eq('org_id', auth.orgId).single()
  if (!proyecto) return apiError('Proyecto no encontrado', 404)

  const d = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('facturas_proyecto' as never) as any)
    .insert({
      proyecto_id:      params.id,
      org_id:           auth.orgId,
      numero_factura:   d.numero_factura,
      subtotal:         d.subtotal,
      aplica_igv:       d.aplica_igv,
      aplica_detraccion: d.aplica_detraccion,
      pct_detraccion:   d.pct_detraccion,
      estado:           d.estado,
      fecha_emision:    d.fecha_emision ?? null,
      fecha_vencimiento: d.fecha_vencimiento ?? null,
      fecha_cobro:      d.fecha_cobro ?? null,
      notas:            d.notas ?? null,
    })
    .select(SELECT)
    .single()

  if (error) return apiError('Error creando factura', 500, error)
  return NextResponse.json(data, { status: 201 })
}
