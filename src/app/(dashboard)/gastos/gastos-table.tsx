'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Pencil, Trash2, ChevronRight, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatDate } from '@/lib/utils'

interface GastoRow {
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

interface GastosTableProps {
  data: GastoRow[]
  canEdit: boolean
  canDelete: boolean
}

const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  rxh: 'RxH',
  sin_comprobante: 'Sin comprobante',
}

export function GastosTable({ data, canEdit, canDelete }: GastosTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = data.filter((g) => {
    if (estadoFilter === 'pendiente' && g.estado_pago !== 'pendiente') return false
    if (estadoFilter === 'pagado' && g.estado_pago !== 'pagado') return false
    if (estadoFilter === 'detraccion' && g.estado_detraccion !== 'pendiente') return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      g.concepto.toLowerCase().includes(q) ||
      (g.proveedor?.razon_social ?? '').toLowerCase().includes(q) ||
      (g.proyecto?.nombre ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDelete(id: string, concepto: string) {
    if (!confirm(`¿Eliminar el gasto "${concepto}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    setDeleteError(null)
    const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }
    setDeletingId(null)
    if (!res.ok) {
      setDeleteError(json.error ?? 'Error eliminando gasto')
      return
    }
    startTransition(() => { router.refresh() })
  }

  async function marcarPagado(id: string) {
    setMarkingId(id)
    await fetch(`/api/gastos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_pago: 'pagado' }),
    })
    setMarkingId(null)
    startTransition(() => { router.refresh() })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Buscar por concepto, proveedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-md border border-zinc-200 bg-white p-1">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'pendiente', label: 'Pendientes' },
            { key: 'pagado', label: 'Pagados' },
            { key: 'detraccion', label: 'Det. pendiente' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setEstadoFilter(key)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                estadoFilter === key
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {deleteError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">
            {search || estadoFilter !== 'todos'
              ? 'Sin resultados para esa búsqueda.'
              : 'Aún no hay gastos registrados.'}
          </p>
          {!search && estadoFilter === 'todos' && canEdit && (
            <Button asChild className="mt-4" variant="outline">
              <Link href="/gastos/nuevo">+ Registrar primer gasto</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Concepto / Proveedor</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Total</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Pago</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Detracción</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((gasto) => {
                const vencido =
                  gasto.estado_pago === 'pendiente' &&
                  gasto.fecha_vencimiento_pago &&
                  new Date(gasto.fecha_vencimiento_pago) < new Date()

                return (
                  <tr key={gasto.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/gastos/${gasto.id}`}
                        className={`font-medium hover:underline ${vencido ? 'text-red-700' : 'text-zinc-900 hover:text-zinc-700'}`}
                      >
                        {gasto.concepto}
                      </Link>
                      {gasto.proveedor && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {gasto.proveedor.nombre_comercial ?? gasto.proveedor.razon_social}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-zinc-500">
                        {TIPO_LABEL[gasto.tipo_comprobante] ?? gasto.tipo_comprobante}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono tabular-nums font-medium">
                        {formatMoney(gasto.neto_a_pagar)}
                      </span>
                      {gasto.monto_detraccion > 0 && (
                        <div className="text-xs text-amber-600 tabular-nums">
                          Det: {formatMoney(gasto.monto_detraccion)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {gasto.estado_pago === 'pagado' ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1">
                          <CheckCircle size={11} />
                          Pagado
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={vencido
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50 gap-1'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 gap-1'
                          }
                        >
                          <Clock size={11} />
                          {vencido ? 'Vencido' : 'Pendiente'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {gasto.aplica_detraccion ? (
                        <Badge
                          variant="outline"
                          className={
                            gasto.estado_detraccion === 'depositada'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50'
                          }
                        >
                          {gasto.estado_detraccion === 'depositada' ? 'Depositada' : 'Pendiente'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 hidden lg:table-cell">
                      {formatDate(gasto.fecha_comprobante)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Marcar como pagado rápido */}
                        {canEdit && gasto.estado_pago === 'pendiente' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50"
                            onClick={() => marcarPagado(gasto.id)}
                            disabled={markingId === gasto.id}
                            title="Marcar como pagado"
                          >
                            <CheckCircle size={13} />
                          </Button>
                        )}

                        <Link
                          href={`/gastos/${gasto.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                        >
                          <ChevronRight size={12} />
                        </Link>

                        {canEdit && (
                          <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Link href={`/gastos/${gasto.id}`} title="Ver/editar">
                              <Pencil size={13} />
                            </Link>
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(gasto.id, gasto.concepto)}
                            disabled={deletingId === gasto.id}
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-zinc-400">
          {filtered.length} gasto{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
