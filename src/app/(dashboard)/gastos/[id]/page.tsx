'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, Loader2, CheckCircle, Clock, AlertTriangle,
  FileText, ExternalLink, Trash2, Pencil
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDate } from '@/lib/utils'

interface GastoDetalle {
  id: string
  concepto: string
  tipo_comprobante: string
  serie: string | null
  numero_doc: string | null
  subtotal: number
  igv: number
  total: number
  aplica_detraccion: boolean
  pct_detraccion: number
  monto_detraccion: number
  neto_a_pagar: number
  retencion_4ta: number
  fecha_comprobante: string
  fecha_vencimiento_pago: string | null
  fecha_pago_real: string | null
  estado_pago: string
  estado_detraccion: string
  fecha_deposito_detraccion: string | null
  adjunto_url: string | null
  notas: string | null
  created_at: string
  proveedor: {
    id: string
    razon_social: string
    nombre_comercial: string | null
    ruc: string | null
  } | null
  proyecto: {
    id: string
    nombre: string
    cliente: { id: string; nombre: string } | null
  } | null
}

const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  rxh: 'Recibo por Honorarios',
  sin_comprobante: 'Sin comprobante',
}

export default function GastoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [gasto, setGasto] = useState<GastoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/gastos/${id}`)
      if (!res.ok) {
        setError('Gasto no encontrado')
        setLoading(false)
        return
      }
      const data = await res.json() as GastoDetalle
      setGasto(data)
      setLoading(false)
    }
    void load()
  }, [id])

  async function marcarPagado() {
    setActionError(null)
    const res = await fetch(`/api/gastos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_pago: 'pagado' }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) {
      setActionError(json.error ?? 'Error actualizando estado')
      return
    }
    setGasto((prev) =>
      prev ? { ...prev, estado_pago: 'pagado', fecha_pago_real: new Date().toISOString().split('T')[0] } : prev
    )
  }

  async function marcarDetraccionDepositada() {
    setActionError(null)
    const res = await fetch(`/api/gastos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_detraccion: 'depositada' }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) {
      setActionError(json.error ?? 'Error actualizando detracción')
      return
    }
    setGasto((prev) =>
      prev ? { ...prev, estado_detraccion: 'depositada', fecha_deposito_detraccion: new Date().toISOString().split('T')[0] } : prev
    )
  }

  async function eliminar() {
    if (!confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return
    const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }
    if (!res.ok) {
      setActionError(json.error ?? 'Error eliminando gasto')
      return
    }
    startTransition(() => {
      router.push('/gastos')
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

  if (error || !gasto) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? 'Gasto no encontrado'}</p>
        <Link href="/gastos" className="mt-4 block text-sm text-zinc-500 hover:underline">
          ← Volver a Gastos
        </Link>
      </div>
    )
  }

  const vencido =
    gasto.estado_pago === 'pendiente' &&
    gasto.fecha_vencimiento_pago &&
    new Date(gasto.fecha_vencimiento_pago) < new Date()

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/gastos"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a Gastos
        </Link>

        <div className="mt-2 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {gasto.concepto}
              </h1>
              {gasto.estado_pago === 'pagado' ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1">
                  <CheckCircle size={11} />
                  Pagado
                </Badge>
              ) : vencido ? (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 gap-1">
                  <AlertTriangle size={11} />
                  Vencido
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-zinc-100 text-zinc-500 border-zinc-200 gap-1">
                  <Clock size={11} />
                  Pendiente
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {TIPO_LABEL[gasto.tipo_comprobante]}
              {gasto.serie && gasto.numero_doc && ` · ${gasto.serie}-${gasto.numero_doc}`}
              {gasto.proyecto && (
                <> ·{' '}
                  <Link href={`/proyectos/${gasto.proyecto.id}`} className="hover:underline">
                    {gasto.proyecto.nombre}
                  </Link>
                </>
              )}
            </p>
          </div>

          {/* Acciones rápidas */}
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/gastos/${id}/editar`}>
                <Pencil size={14} className="mr-1.5" />
                Editar
              </Link>
            </Button>
            {gasto.estado_pago === 'pendiente' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={marcarPagado}
              >
                <CheckCircle size={14} />
                Marcar pagado
              </Button>
            )}
          </div>
        </div>

        {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-400">Total facturado</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums font-mono">{formatMoney(gasto.total)}</p>
        </div>
        {gasto.aplica_detraccion && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-400">Detracción {gasto.pct_detraccion}%</p>
            <p className="mt-1.5 text-xl font-bold tabular-nums font-mono text-amber-700">
              {formatMoney(gasto.monto_detraccion)}
            </p>
          </div>
        )}
        {gasto.retencion_4ta > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-400">Retención 4ta cat.</p>
            <p className="mt-1.5 text-xl font-bold tabular-nums font-mono text-amber-700">
              {formatMoney(gasto.retencion_4ta)}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-400">Neto a pagar</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums font-mono">{formatMoney(gasto.neto_a_pagar)}</p>
        </div>
      </div>

      {/* Desglose */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Datos del comprobante */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Comprobante</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Tipo</dt>
              <dd className="text-zinc-700">{TIPO_LABEL[gasto.tipo_comprobante]}</dd>
            </div>
            {gasto.serie && gasto.numero_doc && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Número</dt>
                <dd className="font-mono text-zinc-700">{gasto.serie}-{gasto.numero_doc}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-zinc-500">Fecha</dt>
              <dd className="text-zinc-700">{formatDate(gasto.fecha_comprobante)}</dd>
            </div>
            {gasto.fecha_vencimiento_pago && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Vencimiento</dt>
                <dd className={`font-medium ${vencido ? 'text-red-600' : 'text-zinc-700'}`}>
                  {formatDate(gasto.fecha_vencimiento_pago)}
                </dd>
              </div>
            )}
            <div className="border-t border-zinc-100 pt-3 flex justify-between">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-mono tabular-nums">{formatMoney(gasto.subtotal)}</dd>
            </div>
            {gasto.igv > 0 && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">IGV 18%</dt>
                <dd className="font-mono tabular-nums text-zinc-400">{formatMoney(gasto.igv)}</dd>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <dt className="text-zinc-700">Total</dt>
              <dd className="font-mono tabular-nums text-zinc-900">{formatMoney(gasto.total)}</dd>
            </div>
          </dl>

          {/* Adjunto */}
          {gasto.adjunto_url && (
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <a
                href={gasto.adjunto_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 hover:underline"
              >
                <FileText size={14} />
                Ver comprobante
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Proveedor y estados */}
        <div className="space-y-4">
          {/* Proveedor */}
          {gasto.proveedor && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">Proveedor</h2>
              <p className="font-medium text-zinc-700">{gasto.proveedor.razon_social}</p>
              {gasto.proveedor.nombre_comercial && (
                <p className="text-sm text-zinc-500">{gasto.proveedor.nombre_comercial}</p>
              )}
              {gasto.proveedor.ruc && (
                <p className="font-mono text-xs text-zinc-400 mt-1">{gasto.proveedor.ruc}</p>
              )}
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <Link
                  href={`/proveedores/${gasto.proveedor.id}/editar`}
                  className="text-xs text-zinc-500 hover:underline"
                >
                  Ver proveedor →
                </Link>
              </div>
            </div>
          )}

          {/* Estado detracción */}
          {gasto.aplica_detraccion && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">Detracción SPOT</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Monto</span>
                  <span className="font-mono tabular-nums font-medium text-amber-700">
                    {formatMoney(gasto.monto_detraccion)} ({gasto.pct_detraccion}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Estado</span>
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
                </div>
                {gasto.fecha_deposito_detraccion && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Depositado el</span>
                    <span>{formatDate(gasto.fecha_deposito_detraccion)}</span>
                  </div>
                )}
              </div>
              {gasto.estado_detraccion === 'pendiente' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={marcarDetraccionDepositada}
                >
                  Marcar como depositada
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notas */}
      {gasto.notas && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Notas</h2>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{gasto.notas}</p>
        </div>
      )}

      {/* Zona de peligro */}
      <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
        <h3 className="text-sm font-medium text-red-800 mb-2">Eliminar gasto</h3>
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 text-red-700 hover:bg-red-50 gap-1.5"
          onClick={eliminar}
        >
          <Trash2 size={13} />
          Eliminar gasto
        </Button>
        <p className="mt-2 text-xs text-red-600">
          Se eliminará también el comprobante adjunto si existe.
        </p>
      </div>
    </div>
  )
}
