'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Trash2, Pencil, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDate } from '@/lib/utils'
import { AsignarPanel } from './asignar-panel'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente_asignacion: { label: 'Sin cubrir',     className: 'bg-red-50 text-red-700 border-red-200' },
  cubierto_parcial:     { label: 'Parcial',         className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cubierto:             { label: 'Cubierto',         className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  generando_ganancia:   { label: 'Con ganancia',     className: 'bg-blue-50 text-blue-700 border-blue-200' },
}

const TIPO_COMP_LABEL: Record<string, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  rxh: 'Recibo por Honorarios',
  sin_comprobante: 'Sin comprobante',
}

interface Asignacion {
  id: string
  monto: number
  pct: number | null
  fecha: string
  proyecto: { id: string; nombre: string } | null
}

interface GastoGeneral {
  id: string
  concepto: string
  tipo_recurrencia: string
  monto: number
  total: number
  igv: number
  periodo_mes: number | null
  periodo_anio: number | null
  tipo_comprobante: string | null
  umbral_proyectos: number
  estado: string
  created_at: string
  proveedor: { id: string; razon_social: string; nombre_comercial: string | null; ruc: string | null } | null
  asignaciones: Asignacion[]
}

export default function GastoGeneralDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [, startTransition] = useTransition()

  const [gg, setGg] = useState<GastoGeneral | null>(null)
  const [proyectos, setProyectos] = useState<Array<{ id: string; nombre: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [ggRes, proyRes] = await Promise.all([
        fetch(`/api/gastos-generales/${id}`),
        fetch('/api/proyectos?estado=activo'),
      ])
      if (!ggRes.ok) { setError('Gasto general no encontrado'); setLoading(false); return }
      const data = await ggRes.json() as GastoGeneral
      const proyData = proyRes.ok ? (await proyRes.json() as Array<{ id: string; nombre: string }>) : []
      setGg(data)
      setProyectos(proyData)
      setLoading(false)
    }
    void load()
  }, [id])

  async function eliminar() {
    if (!confirm('¿Eliminar este gasto general? Las asignaciones también se eliminarán.')) return
    const res = await fetch(`/api/gastos-generales/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setActionError(json.error ?? 'Error eliminando'); return }
    startTransition(() => { router.push('/gastos-generales'); router.refresh() })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </div>
    )
  }

  if (error || !gg) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? 'No encontrado'}</p>
        <Link href="/gastos-generales" className="mt-4 block text-sm text-zinc-500 hover:underline">
          ← Volver
        </Link>
      </div>
    )
  }

  const estadoCfg = ESTADO_CONFIG[gg.estado]
  const totalAsignado = gg.asignaciones.reduce((s, a) => s + a.monto, 0)
  const periodo = gg.periodo_mes && gg.periodo_anio
    ? `${MESES[gg.periodo_mes]} ${gg.periodo_anio}`
    : null

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/gastos-generales"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Gastos Generales
        </Link>

        <div className="mt-2 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {gg.concepto}
              </h1>
              <Badge variant="outline" className={estadoCfg?.className ?? ''}>
                {estadoCfg?.label ?? gg.estado}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {gg.tipo_recurrencia === 'mensual' ? 'Mensual' : 'Puntual'}
              {periodo && ` · ${periodo}`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/gastos-generales/${id}/editar`}>
                <Pencil size={14} className="mr-1.5" />
                Editar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              onClick={eliminar}
            >
              <Trash2 size={14} />
              Eliminar
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Monto</p>
          <p className="mt-2 text-xl font-bold tabular-nums font-mono text-zinc-900">
            {formatMoney(gg.monto)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">Base imponible</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Total</p>
          <p className="mt-2 text-xl font-bold tabular-nums font-mono text-zinc-900">
            {formatMoney(gg.total)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {gg.igv > 0 ? `IGV: ${formatMoney(gg.igv)}` : 'Sin IGV'}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Asignado</p>
          <p className="mt-2 text-xl font-bold tabular-nums font-mono text-zinc-900">
            {totalAsignado > 0 ? formatMoney(totalAsignado) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {gg.asignaciones.length > 0
              ? `${gg.asignaciones.length} proyecto${gg.asignaciones.length !== 1 ? 's' : ''}`
              : 'Sin asignaciones'}
          </p>
        </div>
      </div>

      {/* Detalle */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Info del GG */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Información</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-400">Recurrencia</dt>
              <dd className="mt-0.5 text-zinc-700 capitalize">{gg.tipo_recurrencia}</dd>
            </div>
            {periodo && (
              <div>
                <dt className="text-xs text-zinc-400">Período</dt>
                <dd className="mt-0.5 text-zinc-700">{periodo}</dd>
              </div>
            )}
            {gg.tipo_comprobante && (
              <div>
                <dt className="text-xs text-zinc-400">Comprobante</dt>
                <dd className="mt-0.5 text-zinc-700">{TIPO_COMP_LABEL[gg.tipo_comprobante] ?? gg.tipo_comprobante}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-zinc-400">Umbral de proyectos</dt>
              <dd className="mt-0.5 text-zinc-700">
                {gg.umbral_proyectos} proyecto{gg.umbral_proyectos !== 1 ? 's' : ''} activos para cobertura
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Registrado</dt>
              <dd className="mt-0.5 text-zinc-400 text-xs">{formatDate(gg.created_at, 'time')}</dd>
            </div>
          </dl>
        </div>

        {/* Proveedor */}
        {gg.proveedor && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={15} className="text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">Proveedor</h2>
            </div>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-zinc-400">Nombre</dt>
                <dd className="mt-0.5 text-sm font-medium text-zinc-800">
                  {gg.proveedor.nombre_comercial ?? gg.proveedor.razon_social}
                </dd>
                {gg.proveedor.nombre_comercial && (
                  <dd className="text-xs text-zinc-400">{gg.proveedor.razon_social}</dd>
                )}
              </div>
              {gg.proveedor.ruc && (
                <div>
                  <dt className="text-xs text-zinc-400">RUC</dt>
                  <dd className="mt-0.5 font-mono text-xs text-zinc-500">{gg.proveedor.ruc}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <Link
                href={`/proveedores/${gg.proveedor.id}/editar`}
                className="text-xs text-zinc-500 hover:underline"
              >
                Ver proveedor →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Asignaciones a proyectos — panel interactivo */}
      <AsignarPanel
        gastoGeneralId={gg.id}
        totalGG={gg.total}
        asignacionesIniciales={gg.asignaciones}
        proyectos={proyectos}
      />

      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
    </div>
  )
}
