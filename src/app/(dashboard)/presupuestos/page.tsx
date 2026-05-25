import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Presupuestos — Kivo',
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  borrador: { label: 'Borrador', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  aprobado: { label: 'Aprobado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  rechazado: { label: 'Rechazado', className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50' },
}

const CONDICION_LABEL: Record<string, string> = {
  contado: 'Contado',
  '30d': '30 días',
  '45d': '45 días',
  hitos: 'Por hitos',
}

export default async function PresupuestosPage() {
  const supabase = createClient()
  const rol = await getUserRole()

  const { data: presupuestos } = await supabase
    .from('presupuestos')
    .select(`
      id, version, estado, condicion_pago, subtotal, igv_total, total,
      fecha_aprobacion, created_at,
      proyecto:proyectos!inner(id, nombre, org_id, cliente:clientes(id, nombre))
    `)
    .order('created_at', { ascending: false })

  const data = (presupuestos ?? []) as Array<{
    id: string
    version: number
    estado: string
    condicion_pago: string
    subtotal: number
    igv_total: number
    total: number
    fecha_aprobacion: string | null
    created_at: string
    proyecto: {
      id: string
      nombre: string
      cliente: { id: string; nombre: string } | null
    } | null
  }>

  const aprobados = data.filter((p) => p.estado === 'aprobado').length
  const totalAprobado = data
    .filter((p) => p.estado === 'aprobado')
    .reduce((sum, p) => sum + p.total, 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Presupuestos
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data.length} presupuesto{data.length !== 1 ? 's' : ''}
            {aprobados > 0 && ` · ${aprobados} aprobado${aprobados !== 1 ? 's' : ''} (${formatMoney(totalAprobado)})`}
          </p>
        </div>
        {(rol === 'admin' || rol === 'pm') && (
          <Button asChild>
            <Link href="/presupuestos/nuevo">+ Nuevo presupuesto</Link>
          </Button>
        )}
      </div>

      {/* Tabla */}
      {data.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">Aún no hay presupuestos.</p>
          {(rol === 'admin' || rol === 'pm') && (
            <Button asChild className="mt-4" variant="outline">
              <Link href="/presupuestos/nuevo">+ Crear primer presupuesto</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Proyecto</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden md:table-cell">v.</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Total</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Pago</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.map((pres) => (
                <tr key={pres.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/presupuestos/${pres.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-700 hover:underline"
                    >
                      {pres.proyecto?.nombre ?? '—'}
                    </Link>
                    {pres.proyecto?.cliente && (
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {pres.proyecto.cliente.nombre}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 hidden md:table-cell">
                    v{pres.version}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={ESTADO_CONFIG[pres.estado]?.className ?? ''}
                    >
                      {ESTADO_CONFIG[pres.estado]?.label ?? pres.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono tabular-nums font-medium text-zinc-900">
                      {formatMoney(pres.total)}
                    </span>
                    <div className="text-xs text-zinc-400 tabular-nums">
                      IGV: {formatMoney(pres.igv_total)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 hidden lg:table-cell">
                    {CONDICION_LABEL[pres.condicion_pago] ?? pres.condicion_pago}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 hidden lg:table-cell">
                    {pres.fecha_aprobacion
                      ? `Aprobado ${formatDate(pres.fecha_aprobacion)}`
                      : formatDate(pres.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/presupuestos/${pres.id}`}
                      className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
