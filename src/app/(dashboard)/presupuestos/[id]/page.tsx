'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDate } from '@/lib/utils'

interface LineaPresupuesto {
  id: string
  concepto: string
  subtotal: number
  igv: number
  total: number
  pct_fee: number | null
}

interface PresupuestoDetalle {
  id: string
  version: number
  estado: string
  condicion_pago: string
  subtotal: number
  igv_total: number
  total: number
  fecha_aprobacion: string | null
  created_at: string
  lineas: LineaPresupuesto[]
  proyecto: {
    id: string
    nombre: string
    cliente: {
      id: string
      nombre: string
      ruc: string | null
    } | null
  } | null
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

export default function PresupuestoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [presupuesto, setPresupuesto] = useState<PresupuestoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/presupuestos/${id}`)
      if (!res.ok) {
        setError('Presupuesto no encontrado')
        setLoading(false)
        return
      }
      const data = await res.json() as PresupuestoDetalle
      setPresupuesto(data)
      setLoading(false)
    }
    void load()
  }, [id])

  async function cambiarEstado(nuevoEstado: string) {
    setActionError(null)
    const res = await fetch(`/api/presupuestos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    const json = await res.json() as { error?: string; estado?: string }
    if (!res.ok) {
      setActionError(json.error ?? 'Error actualizando estado')
      return
    }
    setPresupuesto((prev) => prev ? { ...prev, estado: nuevoEstado, fecha_aprobacion: json.estado === 'aprobado' ? new Date().toISOString() : null } : prev)
  }

  async function eliminar() {
    if (!confirm('¿Eliminar este presupuesto? Esta acción no se puede deshacer.')) return
    const res = await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }
    if (!res.ok) {
      setActionError(json.error ?? 'Error eliminando presupuesto')
      return
    }
    startTransition(() => {
      router.push('/presupuestos')
      router.refresh()
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </div>
    )
  }

  if (error || !presupuesto) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? 'Presupuesto no encontrado'}</p>
        <Link href="/presupuestos" className="mt-4 block text-sm text-zinc-500 hover:underline">
          ← Volver a Presupuestos
        </Link>
      </div>
    )
  }

  const estadoConfig = ESTADO_CONFIG[presupuesto.estado] ?? { label: presupuesto.estado, className: '' }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/presupuestos"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a Presupuestos
        </Link>

        <div className="mt-2 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Presupuesto v{presupuesto.version}
              </h1>
              <Badge variant="outline" className={estadoConfig.className}>
                {estadoConfig.label}
              </Badge>
            </div>
            {presupuesto.proyecto && (
              <p className="mt-0.5 text-sm text-zinc-500">
                <Link
                  href={`/proyectos/${presupuesto.proyecto.id}`}
                  className="text-zinc-700 hover:underline"
                >
                  {presupuesto.proyecto.nombre}
                </Link>
                {presupuesto.proyecto.cliente && (
                  <> — {presupuesto.proyecto.cliente.nombre}</>
                )}
              </p>
            )}
          </div>

          {/* Acciones de estado */}
          {presupuesto.estado === 'borrador' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                onClick={() => cambiarEstado('aprobado')}
              >
                <CheckCircle size={14} />
                Aprobar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={() => cambiarEstado('rechazado')}
              >
                <XCircle size={14} />
                Rechazar
              </Button>
            </div>
          )}

          {presupuesto.estado !== 'borrador' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cambiarEstado('borrador')}
            >
              Revertir a borrador
            </Button>
          )}
        </div>

        {actionError && (
          <p className="mt-2 text-sm text-red-600">{actionError}</p>
        )}
      </div>

      {/* Info general */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-400">Condición de pago</p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {CONDICION_LABEL[presupuesto.condicion_pago] ?? presupuesto.condicion_pago}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-400">Creado</p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {formatDate(presupuesto.created_at)}
          </p>
        </div>
        {presupuesto.fecha_aprobacion && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-400">Aprobado</p>
            <p className="mt-1 text-sm font-medium text-emerald-700">
              {formatDate(presupuesto.fecha_aprobacion)}
            </p>
          </div>
        )}
      </div>

      {/* Líneas de presupuesto */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Líneas de presupuesto</h2>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="px-5 py-2.5 text-left font-medium text-zinc-400">Concepto</th>
              <th className="px-5 py-2.5 text-right font-medium text-zinc-400">Subtotal</th>
              <th className="px-5 py-2.5 text-right font-medium text-zinc-400 hidden sm:table-cell">IGV 18%</th>
              <th className="px-5 py-2.5 text-right font-medium text-zinc-400">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {presupuesto.lineas.map((linea) => (
              <tr key={linea.id} className="hover:bg-zinc-50/50">
                <td className="px-5 py-3 text-zinc-700">{linea.concepto}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-zinc-600">
                  {formatMoney(linea.subtotal)}
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-zinc-400 hidden sm:table-cell">
                  {formatMoney(linea.igv)}
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums font-medium text-zinc-900">
                  {formatMoney(linea.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-200 bg-zinc-50/50">
              <td className="px-5 py-3 text-sm font-medium text-zinc-500" colSpan={1}>Totales</td>
              <td className="px-5 py-3 text-right font-mono tabular-nums font-medium text-zinc-700">
                {formatMoney(presupuesto.subtotal)}
              </td>
              <td className="px-5 py-3 text-right font-mono tabular-nums text-zinc-500 hidden sm:table-cell">
                {formatMoney(presupuesto.igv_total)}
              </td>
              <td className="px-5 py-3 text-right font-mono tabular-nums text-lg font-bold text-zinc-900">
                {formatMoney(presupuesto.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Zona de peligro */}
      {presupuesto.estado === 'borrador' && (
        <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
          <h3 className="text-sm font-medium text-red-800 mb-2">Zona de peligro</h3>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-50"
            onClick={eliminar}
          >
            Eliminar presupuesto
          </Button>
          <p className="mt-2 text-xs text-red-600">
            Solo los presupuestos en borrador se pueden eliminar.
          </p>
        </div>
      )}
    </div>
  )
}
