import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { GastosTable } from './gastos-table'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Gastos — Kivo',
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: { proyecto_id?: string }
}) {
  const supabase = createClient()
  const rol = await getUserRole()

  let query = supabase
    .from('gastos')
    .select(`
      id, concepto, tipo_comprobante, subtotal, igv, total,
      monto_detraccion, neto_a_pagar, retencion_4ta,
      fecha_comprobante, fecha_vencimiento_pago,
      estado_pago, estado_detraccion, aplica_detraccion,
      created_at,
      proveedor:proveedores(id, razon_social, nombre_comercial),
      proyecto:proyectos!inner(id, nombre, org_id)
    `)
    .order('fecha_comprobante', { ascending: false })

  if (searchParams.proyecto_id) {
    query = query.eq('proyecto_id', searchParams.proyecto_id)
  }

  const { data: gastos } = await query

  type GastoRow = {
    id: string
    concepto: string
    tipo_comprobante: string
    subtotal: number
    igv: number
    total: number
    monto_detraccion: number
    neto_a_pagar: number
    retencion_4ta: number
    fecha_comprobante: string
    fecha_vencimiento_pago: string | null
    estado_pago: string
    estado_detraccion: string
    aplica_detraccion: boolean
    created_at: string
    proveedor: { id: string; razon_social: string; nombre_comercial: string | null } | null
    proyecto: { id: string; nombre: string } | null
  }

  const data = (gastos ?? []) as GastoRow[]

  const pendientes = data.filter((g) => g.estado_pago === 'pendiente').length
  const detracciones = data.filter(
    (g) => g.aplica_detraccion && g.estado_detraccion === 'pendiente'
  ).length

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Gastos
            {searchParams.proyecto_id && (
              <span className="ml-2 text-base font-normal text-zinc-400">
                filtrado por proyecto
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data.length} gasto{data.length !== 1 ? 's' : ''}
            {pendientes > 0 && ` · ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`}
            {detracciones > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {detracciones} detracción{detracciones !== 1 ? 'es' : ''} por depositar
              </span>
            )}
          </p>
        </div>
        {(rol === 'admin' || rol === 'pm') && (
          <Button asChild>
            <Link
              href={
                searchParams.proyecto_id
                  ? `/gastos/nuevo?proyecto_id=${searchParams.proyecto_id}`
                  : '/gastos/nuevo'
              }
            >
              + Registrar gasto
            </Link>
          </Button>
        )}
      </div>

      <GastosTable
        data={data}
        canEdit={rol === 'admin' || rol === 'pm'}
        canDelete={rol === 'admin'}
      />
    </div>
  )
}
