'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, LayoutGrid, Table2, AlertTriangle, ChevronRight,
  MoreHorizontal, Plus, Pencil, Trash2, Activity, TrendingUp,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { cn, formatMoney, formatDate } from '@/lib/utils'
import { proyectoSchema, type ProyectoInput } from '@/lib/validations/proyecto'
import type { ProyectoConMetricas, ClienteOption, FacturacionStatus } from './page'

const TIPO_LABEL: Record<string, string> = {
  digital: 'Digital',
  offline: 'Offline',
  evento: 'Evento',
  instalacion: 'Instalación',
  otro: 'Otro',
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  activo:   { label: 'Activo',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  en_pausa: { label: 'En pausa',  className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50' },
  cerrado:  { label: 'Cerrado',   className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

const TIPOS_PROYECTO = [
  { value: 'digital',    label: 'Digital'    },
  { value: 'offline',    label: 'Offline'    },
  { value: 'evento',     label: 'Evento'     },
  { value: 'instalacion',label: 'Instalación'},
  { value: 'otro',       label: 'Otro'       },
] as const

function margenStyle(pct: number): { color: string; bg: string } {
  if (pct >= 30) return { color: '#059669', bg: '#ecfdf5' }
  if (pct >= 15) return { color: '#d97706', bg: '#fffbeb' }
  return { color: '#dc2626', bg: '#fef2f2' }
}

const FACTURACION_CFG: Record<FacturacionStatus, { label: string; cls: string }> = {
  sin_facturar: { label: 'Sin facturar',  cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  vencida:      { label: 'Vencida',       cls: 'bg-red-50 text-red-700 border-red-200' },
  pendiente:    { label: 'Pend. de pago', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  al_dia:       { label: 'Al día',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

function FacturacionBadge({ status }: { status: FacturacionStatus }) {
  const cfg = FACTURACION_CFG[status]
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', cfg.cls)}>{cfg.label}</Badge>
  )
}

function healthLabel(avg: number): { label: string } {
  if (avg >= 35) return { label: 'Excelente' }
  if (avg >= 25) return { label: 'Buena'     }
  if (avg >= 15) return { label: 'Regular'   }
  return           { label: 'Crítica'    }
}

function FeaturedProjectCard({ proyecto }: { proyecto: ProyectoConMetricas }) {
  const ms = margenStyle(proyecto.margen_pct)
  const estado = ESTADO_CONFIG[proyecto.estado]
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Proyecto destacado
          </span>
          {proyecto.alertas_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
              <AlertTriangle size={10} />
              {proyecto.alertas_count} alerta{proyecto.alertas_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Badge variant="outline" className={estado?.className ?? ''}>
          {estado?.label ?? proyecto.estado}
        </Badge>
      </div>

      <h2 className="text-lg font-bold text-zinc-900 leading-tight mb-1">
        {proyecto.nombre}
      </h2>
      <p className="text-sm text-zinc-500 mb-4">
        {proyecto.cliente?.nombre ?? '—'}
        <span className="mx-2 text-zinc-300">·</span>
        {TIPO_LABEL[proyecto.tipo] ?? proyecto.tipo}
        {proyecto.fecha_inicio && (
          <>
            <span className="mx-2 text-zinc-300">·</span>
            {formatDate(proyecto.fecha_inicio)}
            {proyecto.fecha_cierre_est && ` → ${formatDate(proyecto.fecha_cierre_est)}`}
          </>
        )}
      </p>

      <div className="grid grid-cols-3 gap-3 mt-auto">
        {/* Margen */}
        <div className="rounded-lg p-3" style={{ background: ms.bg }}>
          <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: ms.color }}>
            Margen
          </p>
          <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: ms.color }}>
            {proyecto.margen_pct.toFixed(1)}%
          </p>
          {proyecto.precio_venta_total > 0 && (
            <p className="text-[11px] mt-1" style={{ color: ms.color, opacity: 0.7 }}>
              de {formatMoney(proyecto.precio_venta_total)}
            </p>
          )}
        </div>

        {/* Ejecución */}
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-1">
            Ejecución
          </p>
          <p className="text-2xl font-bold tabular-nums text-zinc-900 leading-none">
            {proyecto.ejecucion_pct.toFixed(0)}%
          </p>
          <div className="mt-2">
            <Progress
              value={proyecto.ejecucion_pct}
              className="h-1.5"
            />
          </div>
          {proyecto.costo_estimado_total > 0 && (
            <p className="text-[11px] text-zinc-400 mt-1">
              de {formatMoney(proyecto.costo_estimado_total)}
            </p>
          )}
        </div>

        {/* Facturado */}
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-1">
            Facturado
          </p>
          <p className="text-lg font-bold tabular-nums text-zinc-900 leading-snug">
            {formatMoney(proyecto.facturado_total)}
          </p>
          {proyecto.precio_venta_total > 0 && (
            <>
              <div className="mt-2">
                <Progress
                  value={proyecto.precio_venta_total > 0 ? (proyecto.facturado_total / proyecto.precio_venta_total) * 100 : 0}
                  className="h-1.5"
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                de {formatMoney(proyecto.precio_venta_total)}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={`/proyectos/${proyecto.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Ver proyecto
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}

function PortfolioHealthCard({ proyectos }: { proyectos: ProyectoConMetricas[] }) {
  const activos = proyectos.filter(p => p.estado === 'activo')
  const cerrados = proyectos.filter(p => p.estado === 'cerrado')
  const enPausa = proyectos.filter(p => p.estado === 'en_pausa')
  const activosConVenta = activos.filter(p => p.precio_venta_total > 0)
  const avgMargen = activosConVenta.length > 0
    ? activosConVenta.reduce((s, p) => s + p.margen_pct, 0) / activosConVenta.length
    : 0
  const enRiesgo = activos.filter(p => p.margen_pct < 15 && p.precio_venta_total > 0).length
  const health = healthLabel(avgMargen)

  return (
    <div className="rounded-xl p-5 h-full flex flex-col" style={{ background: '#1e40af' }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} style={{ color: '#93c5fd' }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#93c5fd' }}>
          Salud del Portafolio
        </span>
      </div>

      <div className="mb-3">
        <p className="text-2xl font-medium leading-none" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {health.label}
        </p>
        <p className="text-sm mt-1" style={{ color: '#bfdbfe' }}>
          Margen promedio activos
        </p>
        <p className="text-4xl font-black tabular-nums mt-1" style={{ color: '#ffffff' }}>
          {avgMargen.toFixed(1)}%
        </p>
        <div className="w-full bg-white/20 rounded-full h-1.5 mt-2 mb-4">
          <div
            className="bg-white rounded-full h-1.5 transition-all duration-500"
            style={{ width: `${Math.min(avgMargen, 100)}%` }}
          />
        </div>
      </div>

      {enRiesgo > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4"
          style={{ background: 'rgba(239,68,68,0.15)' }}
        >
          <AlertTriangle size={13} style={{ color: '#fca5a5' }} />
          <p className="text-xs font-medium" style={{ color: '#fca5a5' }}>
            {enRiesgo} proyecto{enRiesgo !== 1 ? 's' : ''} en riesgo (&lt;15%)
          </p>
        </div>
      )}

      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: '#93c5fd' }}>Activos</span>
          <span className="text-sm font-bold text-white">{activos.length}</span>
        </div>
        {enPausa.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#93c5fd' }}>En pausa</span>
            <span className="text-sm font-bold text-white">{enPausa.length}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: '#93c5fd' }}>Cerrados</span>
          <span className="text-sm font-bold text-white">{cerrados.length}</span>
        </div>
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(147,197,253,0.2)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#93c5fd' }}>Total proyectos</span>
            <span className="text-sm font-bold text-white">{proyectos.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NuevoProyectoDialog({ clientes, canCreate }: { clientes: ClienteOption[]; canCreate: boolean }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProyectoInput>({
    resolver: zodResolver(proyectoSchema),
    defaultValues: {
      estado: 'activo',
      tipo: 'digital',
      aplica_detraccion: false,
      fecha_inicio: new Date().toISOString().split('T')[0],
    },
  })

  function handleOpenChange(o: boolean) {
    setOpen(o)
    if (!o) { reset(); setServerError(null) }
  }

  async function onSubmit(values: ProyectoInput) {
    setServerError(null)
    const res = await fetch('/api/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const json = await res.json() as { error?: string; id?: string }
    if (!res.ok) {
      setServerError(json.error ?? 'Error al crear el proyecto')
      return
    }
    setOpen(false)
    reset()
    router.push(`/proyectos/${json.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!canCreate} className="gap-1.5">
          <Plus size={14} />
          Nuevo Proyecto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nuevo Proyecto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1" noValidate>
          {serverError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="np-nombre">Nombre *</Label>
            <Input
              id="np-nombre"
              placeholder="Campaña verano 2025"
              {...register('nombre')}
            />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-cliente">Cliente *</Label>
            <select
              id="np-cliente"
              {...register('cliente_id')}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">Seleccionar cliente…</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            {errors.cliente_id && <p className="text-xs text-red-600">{errors.cliente_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="np-tipo">Tipo</Label>
              <select
                id="np-tipo"
                {...register('tipo')}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                {TIPOS_PROYECTO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-inicio">Fecha inicio *</Label>
              <Input id="np-inicio" type="date" {...register('fecha_inicio')} />
              {errors.fecha_inicio && <p className="text-xs text-red-600">{errors.fecha_inicio.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-cierre">Fecha cierre estimado</Label>
            <Input id="np-cierre" type="date" {...register('fecha_cierre_est')} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando…' : 'Crear Proyecto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MargenCell({ pct, montoS }: { pct: number; montoS: number }) {
  const ms = margenStyle(pct)
  return (
    <div className="text-right">
      <div className="font-semibold text-sm tabular-nums" style={{ color: ms.color }}>
        {formatMoney(montoS)}
      </div>
      <div className="text-xs tabular-nums text-zinc-400">{pct.toFixed(1)}%</div>
    </div>
  )
}

function ProjectCard({
  proyecto,
  canEdit,
  canDelete,
  onDelete,
}: {
  proyecto: ProyectoConMetricas
  canEdit: boolean
  canDelete: boolean
  onDelete: (id: string, nombre: string) => void
}) {
  const ms = margenStyle(proyecto.margen_pct)
  const estado = ESTADO_CONFIG[proyecto.estado]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/proyectos/${proyecto.id}`}
            className="font-semibold text-zinc-900 hover:text-zinc-700 hover:underline line-clamp-2 leading-snug"
          >
            {proyecto.nombre}
          </Link>
          <p className="text-xs text-zinc-400 mt-0.5">
            {proyecto.cliente?.nombre ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={cn('text-xs', estado?.className ?? '')}>
            {estado?.label ?? proyecto.estado}
          </Badge>
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link href={`/proyectos/${proyecto.id}/editar`} className="flex items-center gap-2">
                      <Pencil size={13} /> Editar
                    </Link>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 flex items-center gap-2"
                    onClick={() => onDelete(proyecto.id, proyecto.nombre)}
                  >
                    <Trash2 size={13} /> Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg p-2.5" style={{ background: ms.bg }}>
          <p className="font-medium" style={{ color: ms.color, opacity: 0.7 }}>Margen</p>
          <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: ms.color }}>
            {proyecto.margen_pct.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2.5">
          <p className="text-zinc-400 font-medium">Ejecución</p>
          <p className="text-lg font-bold tabular-nums text-zinc-800 leading-tight">
            {proyecto.ejecucion_pct.toFixed(0)}%
          </p>
          <Progress value={proyecto.ejecucion_pct} className="h-1 mt-1" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100">
        <span>
          Facturado:{' '}
          <span className="font-medium text-zinc-700">{formatMoney(proyecto.facturado_total)}</span>
        </span>
        {proyecto.alertas_count > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <AlertTriangle size={11} />
            {proyecto.alertas_count}
          </span>
        )}
        <Link
          href={`/proyectos/${proyecto.id}`}
          className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-medium"
        >
          Ver <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  )
}

interface ProyectosClientProps {
  proyectos: ProyectoConMetricas[]
  clientes: ClienteOption[]
  canEdit: boolean
  canDelete: boolean
}

export function ProyectosClient({ proyectos, clientes, canEdit, canDelete }: ProyectosClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [clienteFilter, setClienteFilter] = useState('all')
  const [tipoFilter, setTipoFilter] = useState('all')
  const [estadoFilter, setEstadoFilter] = useState('activo')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const featured = useMemo(
    () =>
      proyectos
        .filter(p => p.estado === 'activo')
        .sort((a, b) => b.precio_venta_total - a.precio_venta_total)[0] ?? null,
    [proyectos],
  )

  const uniqueClientes = useMemo(() => {
    const seen = new Set<string>()
    return proyectos
      .filter(p => p.cliente)
      .map(p => p.cliente!)
      .filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [proyectos])

  const filtered = useMemo(() => {
    return proyectos.filter(p => {
      if (estadoFilter !== 'all' && p.estado !== estadoFilter) return false
      if (clienteFilter !== 'all' && p.cliente?.id !== clienteFilter) return false
      if (tipoFilter !== 'all' && p.tipo !== tipoFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const matchNombre = p.nombre.toLowerCase().includes(q)
        const matchCliente = (p.cliente?.nombre ?? '').toLowerCase().includes(q)
        if (!matchNombre && !matchCliente) return false
      }
      return true
    })
  }, [proyectos, estadoFilter, clienteFilter, tipoFilter, search])

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    setDeleteError(null)
    const res = await fetch(`/api/proyectos/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }
    setDeletingId(null)
    if (!res.ok) {
      setDeleteError(json.error ?? 'Error eliminando proyecto')
      return
    }
    startTransition(() => router.refresh())
  }

  const activos = proyectos.filter(p => p.estado === 'activo').length

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Proyectos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''}
            {activos > 0 && ` · ${activos} activo${activos !== 1 ? 's' : ''}`}
          </p>
        </div>
        <NuevoProyectoDialog clientes={clientes} canCreate={canEdit} />
      </div>

      {/* Featured + Health */}
      {featured && (
        <div className="grid grid-cols-10 gap-4">
          <div className="col-span-7">
            <FeaturedProjectCard proyecto={featured} />
          </div>
          <div className="col-span-3">
            <PortfolioHealthCard proyectos={proyectos} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Buscar por nombre o cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="en_pausa">En pausa</SelectItem>
            <SelectItem value="cerrado">Cerrados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {uniqueClientes.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TIPOS_PROYECTO.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="ml-auto flex rounded-md border border-zinc-200 bg-white p-1 gap-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'rounded p-1.5 transition-colors',
              viewMode === 'table'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-400 hover:text-zinc-700',
            )}
            title="Vista tabla"
          >
            <Table2 size={15} />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={cn(
              'rounded p-1.5 transition-colors',
              viewMode === 'cards'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-400 hover:text-zinc-700',
            )}
            title="Vista tarjetas"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <TrendingUp size={32} className="mx-auto mb-3 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">
            {search || clienteFilter !== 'all' || tipoFilter !== 'all' || estadoFilter !== 'all'
              ? 'Sin resultados para los filtros aplicados.'
              : 'Aún no hay proyectos registrados.'}
          </p>
          {canEdit && !search && clienteFilter === 'all' && tipoFilter === 'all' && estadoFilter === 'all' && (
            <p className="mt-2 text-xs text-zinc-400">Crea tu primer proyecto con el botón &quot;Nuevo Proyecto&quot;.</p>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE ── */
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Proyecto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 hidden md:table-cell">Total gastos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Margen S/</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">Facturación</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 hidden md:table-cell">Alertas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(proyecto => (
                <tr key={proyecto.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/proyectos/${proyecto.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-700 hover:underline"
                    >
                      {proyecto.nombre}
                    </Link>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {TIPO_LABEL[proyecto.tipo] ?? proyecto.tipo}
                      {proyecto.fecha_inicio && (
                        <> · {formatDate(proyecto.fecha_inicio)}</>
                      )}
                    </p>
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell text-sm text-zinc-600">
                    {proyecto.cliente ? (
                      <Link href={`/clientes/${proyecto.cliente.id}/editar`} className="hover:underline">
                        {proyecto.cliente.nombre}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant="outline" className={ESTADO_CONFIG[proyecto.estado]?.className ?? ''}>
                      {ESTADO_CONFIG[proyecto.estado]?.label ?? proyecto.estado}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums text-sm hidden md:table-cell">
                    {proyecto.gasto_real_total > 0
                      ? <span className="text-zinc-700">{formatMoney(proyecto.gasto_real_total)}</span>
                      : <span className="text-zinc-300">{formatMoney(0)}</span>
                    }
                  </td>

                  <td className="px-4 py-3">
                    <MargenCell
                      pct={proyecto.margen_pct}
                      montoS={proyecto.precio_venta_total - proyecto.gasto_real_total}
                    />
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    <FacturacionBadge status={proyecto.facturacion_status} />
                  </td>

                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {proyecto.alertas_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertTriangle size={12} />
                        {proyecto.alertas_count}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/proyectos/${proyecto.id}`}
                        className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                      >
                        Detalle <ChevronRight size={12} />
                      </Link>

                      {(canEdit || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                              disabled={deletingId === proyecto.id}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {canEdit && (
                              <DropdownMenuItem asChild>
                                <Link href={`/proyectos/${proyecto.id}/editar`} className="flex items-center gap-2">
                                  <Pencil size={13} /> Editar
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 flex items-center gap-2"
                                onClick={() => handleDelete(proyecto.id, proyecto.nombre)}
                              >
                                <Trash2 size={13} /> Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── CARDS ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(proyecto => (
            <ProjectCard
              key={proyecto.id}
              proyecto={proyecto}
              canEdit={canEdit}
              canDelete={canDelete}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-zinc-400">
          {filtered.length} proyecto{filtered.length !== 1 ? 's' : ''}
          {search ? ` que coinciden con "${search}"` : ''}
        </p>
      )}
    </div>
  )
}
