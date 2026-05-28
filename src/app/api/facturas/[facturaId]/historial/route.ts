import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'

type Params = { params: { facturaId: string } }

/**
 * GET /api/facturas/[facturaId]/historial
 * Retorna las últimas 10 entradas del historial de estado para la factura,
 * verificando previamente que la factura pertenece a la organización del usuario.
 */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // Verificar que la factura pertenece a la org del usuario (RLS también lo garantiza,
  // pero hacerlo explícito evita filtrar historial de otras orgs si el facturaId coincidiera)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase.from('facturas_proyecto' as never) as any)
    .select('id')
    .eq('id', params.facturaId)
    .eq('org_id', auth.orgId)
    .maybeSingle()

  if (!factura) return apiError('Factura no encontrada', 404)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('factura_historial' as never) as any)
    .select('id, estado_anterior, estado_nuevo, created_at')
    .eq('factura_id', params.facturaId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return apiError('Error consultando historial', 500, error)

  return NextResponse.json(data ?? [])
}
