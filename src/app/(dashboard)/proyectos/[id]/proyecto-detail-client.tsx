'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Pencil, Plus, Trash2, Check,
  Building2, Calendar, Tag, TrendingUp, TrendingDown, X
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatMoney, centavosToSoles, solesToCentavos, formatDate } from '@/lib/utils'
import type { ProyectoData, ProyectoItem, Proveedor } from './page'

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  digital: 'Digital', offline: 'Offline', evento: 'Evento',
  instalacion: 'Instalación', otro: 'Otro',
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  activo:   { label: 'Activo',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  en_pausa: { label: 'En pausa', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cerrado:  { label: 'Cerrado',  className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

const UNIDADES = [
  { value: 'global', label: 'Global' },
  { value: 'unid',   label: 'Unid.' },
  { value: 'hora',   label: 'Hora' },
  { value: 'm2',     label: 'm²' },
  { value: 'kg',     label: 'kg' },
  { value: 'dia',    label: 'Día' },
  { value: 'otro',   label: 'Otro' },
]

const COMPROBANTES = [
  { value: '',               label: '—' },
  { value: 'factura',        label: 'Factura' },
  { value: 'boleta',         label: 'Boleta' },
  { value: 'rxh',            label: 'RxH' },
  { value: 'sin_comprobante', label: 'Sin comp.' },
]

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  proyecto: ProyectoData
  initialItems: ProyectoItem[]
  proveedores: Proveedor[]
  rol: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProyectoDetailClient({ proyecto, initialItems, proveedores: initialProveedores, rol }: Props) {
  const [items, setItems] = useState<ProyectoItem[]>(initialItems)
  const [proveedores, setProveedores] = useState<Proveedor[]>(initialProveedores)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // itemId being saved
  const [adding, setAdding] = useState(false)

  const canEdit = rol === 'admin' || rol === 'pm'
  const canDelete = rol === 'admin'
  const estadoConfig = ESTADO_CONFIG[proyecto.estado] ?? { label: proyecto.estado, className: '' }

  // ── Derived KPIs ──────────────────────────────────────────────────────────

  const totals = items.reduce(
    (acc, item) => {
      const igv = item.tipo_comprobante === 'factura' ? Math.round(item.gasto_real * 0.18 / 1.18) : 0
      return {
        costo_estimado: acc.costo_estimado + item.costo_estimado,
        precio_venta: acc.precio_venta + item.precio_venta,
        gasto_real: acc.gasto_real + item.gasto_real,
        igv: acc.igv + igv,
        margen: acc.margen + (item.precio_venta - item.gasto_real),
      }
    },
    { costo_estimado: 0, precio_venta: 0, gasto_real: 0, igv: 0, margen: 0 }
  )

  const margenPct = totals.precio_venta > 0
    ? (totals.margen / totals.precio_venta) * 100
    : null

  const avancePct = totals.costo_estimado > 0
    ? Math.min((totals.gasto_real / totals.costo_estimado) * 100, 100)
    : null

  // ── Unique providers used in this project ────────────────────────────────

  const proveedoresEnProyecto = Array.from(
    new Map(
      items
        .filter(i => i.proveedor)
        .map(i => [i.proveedor!.id, i.proveedor!])
    ).values()
  )

  // ── Cell editing helpers ──────────────────────────────────────────────────

  function startEdit(id: string, field: string) {
    if (!canEdit) return
    setEditingCell({ id, field })
  }

  async function saveCell(itemId: string, field: string, raw: unknown) {
    setSaving(itemId)
    try {
      // Convert money fields to centavos
      let value = raw
      if (['costo_estimado', 'precio_venta', 'gasto_real'].includes(field)) {
        const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
        value = isNaN(n) ? 0 : solesToCentavos(n)
      }
      if (field === 'proveedor_id' && raw === '') value = null
      if (field === 'tipo_comprobante' && raw === '') value = null

      const res = await fetch(`/api/proyectos/${proyecto.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        console.error('Error saving item', await res.text())
        return
      }
      const updated = await res.json() as ProyectoItem
      setItems(prev => prev.map(i => i.id === itemId ? updated : i))
    } finally {
      setSaving(null)
      setEditingCell(null)
    }
  }

  async function addItem() {
    if (!canEdit || adding) return
    setAdding(true)
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concepto: '',
          unidad: 'global',
          costo_estimado: 0,
          precio_venta: 0,
          gasto_real: 0,
          sort_order: items.length,
        }),
      })
      if (!res.ok) return
      const newItem = await res.json() as ProyectoItem
      setItems(prev => [...prev, newItem])
      // Immediately start editing the concepto cell
      setTimeout(() => setEditingCell({ id: newItem.id, field: 'concepto' }), 50)
    } finally {
      setAdding(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!canDelete) return
    if (!confirm('¿Eliminar esta fila?')) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/items/${itemId}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== itemId))
  }

  // When a new provider is created via combobox
  function onProveedorCreated(p: Proveedor) {
    setProveedores(prev => [...prev, p].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/proyectos"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Proyectos
        </Link>

        <div className="mt-2 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {proyecto.nombre}
              </h1>
              <Badge variant="outline" className={estadoConfig.className}>
                {estadoConfig.label}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              {proyecto.cliente && (
                <span>
                  Cliente:{' '}
                  <Link href={`/clientes/${proyecto.cliente.id}/editar`} className="text-zinc-700 hover:underline">
                    {proyecto.cliente.nombre}
                  </Link>
                </span>
              )}
              {proyecto.categoria && (
                <span className="inline-flex items-center gap-1">
                  {proyecto.categoria.color && (
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: proyecto.categoria.color }} />
                  )}
                  {proyecto.categoria.nombre}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDate(proyecto.fecha_inicio)}
                {proyecto.fecha_cierre_est && ` → ${formatDate(proyecto.fecha_cierre_est)}`}
              </span>
              <span className="flex items-center gap-1">
                <Tag size={12} />
                {TIPO_LABEL[proyecto.tipo] ?? proyecto.tipo}
              </span>
            </div>
          </div>

          {canEdit && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/proyectos/${proyecto.id}/editar`}>
                <Pencil size={13} className="mr-1.5" />
                Editar proyecto
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Precio de venta"
          value={totals.precio_venta > 0 ? formatMoney(totals.precio_venta) : '—'}
          sub={totals.precio_venta > 0 ? 'Total cobrado al cliente' : 'Sin líneas con precio'}
          variant="neutral"
        />

        <KpiCard
          label="Gasto real"
          value={totals.gasto_real > 0 ? formatMoney(totals.gasto_real) : '—'}
          sub={
            avancePct !== null
              ? `${avancePct.toFixed(0)}% del costo estimado`
              : totals.gasto_real > 0 ? 'Sin costo estimado' : 'Sin gastos registrados'
          }
          variant={
            avancePct === null ? 'neutral'
            : avancePct > 100 ? 'danger'
            : avancePct > 80 ? 'warning'
            : 'neutral'
          }
          progress={avancePct ?? undefined}
        />

        <KpiCard
          label="Margen bruto"
          value={totals.precio_venta > 0 || totals.gasto_real > 0 ? formatMoney(totals.margen) : '—'}
          sub={margenPct !== null ? `${margenPct.toFixed(1)}% sobre precio venta` : 'Sin datos suficientes'}
          variant={
            margenPct === null ? 'neutral'
            : margenPct < 0 ? 'danger'
            : margenPct < 20 ? 'warning'
            : 'success'
          }
          icon={
            margenPct === null ? undefined
            : margenPct >= 0 ? <TrendingUp size={16} />
            : <TrendingDown size={16} />
          }
        />

        <KpiCard
          label="IGV en gastos"
          value={totals.igv > 0 ? formatMoney(totals.igv) : '—'}
          sub={totals.igv > 0 ? 'Crédito fiscal facturas' : 'Sin IGV registrado'}
          variant={totals.igv > 0 ? 'info' : 'neutral'}
        />
      </div>

      {/* ── Items Table ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Líneas del proyecto</h2>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={addItem} disabled={adding}>
              <Plus size={14} className="mr-1.5" />
              Agregar ítem
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60">
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500 text-xs w-64">Concepto</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 text-xs w-24">Unidad</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 text-xs w-44">Proveedor</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500 text-xs w-32">Costo estim.</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500 text-xs w-32">Gasto real</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500 text-xs w-32">Precio venta</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500 text-xs w-28">Margen</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500 text-xs w-28">IGV</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 text-xs w-28">Comprobante</th>
                {canEdit && <th className="px-3 py-2.5 w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 10 : 9} className="px-4 py-10 text-center text-sm text-zinc-400">
                    Sin líneas aún.{canEdit ? ' Usa "Agregar ítem" para comenzar.' : ''}
                  </td>
                </tr>
              )}
              {items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  proveedores={proveedores}
                  editingCell={editingCell}
                  saving={saving}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onStartEdit={startEdit}
                  onSave={saveCell}
                  onDelete={deleteItem}
                  onProveedorCreated={onProveedorCreated}
                />
              ))}
            </tbody>

            {/* Sticky totals footer */}
            {items.length > 0 && (
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
                <tr>
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    Totales
                  </td>
                  <td />
                  <td />
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-zinc-700 text-sm">
                    {totals.costo_estimado > 0 ? formatMoney(totals.costo_estimado) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-zinc-700 text-sm">
                    {totals.gasto_real > 0 ? formatMoney(totals.gasto_real) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-zinc-700 text-sm">
                    {totals.precio_venta > 0 ? formatMoney(totals.precio_venta) : '—'}
                  </td>
                  <td className={cn(
                    'px-3 py-3 text-right font-semibold tabular-nums text-sm',
                    totals.margen < 0 ? 'text-red-600' : 'text-emerald-700'
                  )}>
                    {totals.precio_venta > 0 || totals.gasto_real > 0 ? formatMoney(totals.margen) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-blue-700 text-sm">
                    {totals.igv > 0 ? formatMoney(totals.igv) : '—'}
                  </td>
                  <td />
                  {canEdit && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Proveedores en este proyecto ────────────────────────────────── */}
      {proveedoresEnProyecto.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            Proveedores en este proyecto
          </h2>
          <div className="flex flex-wrap gap-3">
            {proveedoresEnProyecto.map(p => (
              <Link
                key={p.id}
                href={`/proveedores/${p.id}/editar`}
                className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm hover:border-zinc-300 hover:shadow-sm transition-all"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                  <Building2 size={13} />
                </span>
                <span className="font-medium text-zinc-800">
                  {p.nombre_comercial ?? p.razon_social}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Project Info (compact) ──────────────────────────────────────── */}
      {proyecto.notas && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Notas</h2>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{proyecto.notas}</p>
        </div>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

type KpiVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const variantStyles: Record<KpiVariant, {
  card: string; label: string; value: string; sub: string; bar: string
}> = {
  neutral: {
    card:  'border-zinc-200 bg-white',
    label: 'text-zinc-400',
    value: 'text-zinc-900',
    sub:   'text-zinc-400',
    bar:   'bg-zinc-300',
  },
  success: {
    card:  'border-emerald-200 bg-emerald-50',
    label: 'text-emerald-600',
    value: 'text-emerald-900',
    sub:   'text-emerald-700',
    bar:   'bg-emerald-500',
  },
  warning: {
    card:  'border-amber-200 bg-amber-50',
    label: 'text-amber-600',
    value: 'text-amber-900',
    sub:   'text-amber-700',
    bar:   'bg-amber-400',
  },
  danger: {
    card:  'border-red-200 bg-red-50',
    label: 'text-red-500',
    value: 'text-red-700',
    sub:   'text-red-600',
    bar:   'bg-red-500',
  },
  info: {
    card:  'border-blue-200 bg-blue-50',
    label: 'text-blue-600',
    value: 'text-blue-900',
    sub:   'text-blue-700',
    bar:   'bg-blue-500',
  },
}

function KpiCard({
  label, value, sub, variant = 'neutral', progress, icon,
}: {
  label: string
  value: string
  sub?: string
  variant?: KpiVariant
  progress?: number
  icon?: React.ReactNode
}) {
  const s = variantStyles[variant]
  return (
    <div className={cn('rounded-lg border p-5 shadow-sm', s.card)}>
      <p className={cn('text-xs font-medium uppercase tracking-wide', s.label)}>{label}</p>
      <p className={cn('mt-2 text-xl font-bold tabular-nums font-mono', s.value)}>
        {value}
      </p>
      {sub && (
        <p className={cn('mt-0.5 text-xs flex items-center gap-1', s.sub)}>
          {icon && <span>{icon}</span>}
          {sub}
        </p>
      )}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', s.bar)}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ProyectoItem
  proveedores: Proveedor[]
  editingCell: { id: string; field: string } | null
  saving: string | null
  canEdit: boolean
  canDelete: boolean
  onStartEdit: (id: string, field: string) => void
  onSave: (id: string, field: string, value: unknown) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onProveedorCreated: (p: Proveedor) => void
}

function ItemRow({
  item, proveedores, editingCell, saving, canEdit, canDelete,
  onStartEdit, onSave, onDelete, onProveedorCreated,
}: ItemRowProps) {
  const isEditing = (field: string) => editingCell?.id === item.id && editingCell?.field === field
  const isSaving = saving === item.id

  const igv = item.tipo_comprobante === 'factura'
    ? Math.round(item.gasto_real * 0.18 / 1.18)
    : 0
  const margen = item.precio_venta - item.gasto_real

  return (
    <tr className={cn(
      'group border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors',
      isSaving && 'opacity-60'
    )}>
      {/* Concepto */}
      <td className="px-4 py-2" onClick={() => onStartEdit(item.id, 'concepto')}>
        {isEditing('concepto') ? (
          <InlineInput
            defaultValue={item.concepto}
            onSave={v => onSave(item.id, 'concepto', v)}
            placeholder="Describe el ítem..."
            className="w-full"
          />
        ) : (
          <span className={cn('block', canEdit && 'cursor-text', !item.concepto && 'text-zinc-300 italic')}>
            {item.concepto || (canEdit ? 'Concepto...' : '—')}
          </span>
        )}
      </td>

      {/* Unidad */}
      <td className="px-3 py-2" onClick={() => onStartEdit(item.id, 'unidad')}>
        {isEditing('unidad') ? (
          <InlineSelect
            value={item.unidad}
            options={UNIDADES}
            onSave={v => onSave(item.id, 'unidad', v)}
          />
        ) : (
          <span className={cn('block text-zinc-600', canEdit && 'cursor-pointer')}>
            {UNIDADES.find(u => u.value === item.unidad)?.label ?? item.unidad}
          </span>
        )}
      </td>

      {/* Proveedor */}
      <td className="px-3 py-2">
        {isEditing('proveedor_id') ? (
          <ProveedorCombobox
            value={item.proveedor_id ?? ''}
            proveedores={proveedores}
            onSave={v => onSave(item.id, 'proveedor_id', v)}
            onCreated={onProveedorCreated}
          />
        ) : (
          <span
            className={cn('block text-zinc-600 truncate max-w-[160px]', canEdit && 'cursor-pointer')}
            onClick={() => onStartEdit(item.id, 'proveedor_id')}
          >
            {item.proveedor
              ? (item.proveedor.nombre_comercial ?? item.proveedor.razon_social)
              : <span className="text-zinc-300 italic">{canEdit ? 'Seleccionar...' : '—'}</span>}
          </span>
        )}
      </td>

      {/* Costo estimado */}
      <td className="px-3 py-2 text-right" onClick={() => onStartEdit(item.id, 'costo_estimado')}>
        {isEditing('costo_estimado') ? (
          <InlineMoneyInput
            defaultValue={centavosToSoles(item.costo_estimado)}
            onSave={v => onSave(item.id, 'costo_estimado', v)}
            className="text-right"
          />
        ) : (
          <span className={cn('block tabular-nums', canEdit && 'cursor-text', item.costo_estimado === 0 && 'text-zinc-300')}>
            {item.costo_estimado > 0 ? formatMoney(item.costo_estimado) : '—'}
          </span>
        )}
      </td>

      {/* Gasto real */}
      <td className="px-3 py-2 text-right" onClick={() => onStartEdit(item.id, 'gasto_real')}>
        {isEditing('gasto_real') ? (
          <InlineMoneyInput
            defaultValue={centavosToSoles(item.gasto_real)}
            onSave={v => onSave(item.id, 'gasto_real', v)}
            className="text-right"
          />
        ) : (
          <span className={cn('block tabular-nums', canEdit && 'cursor-text', item.gasto_real === 0 && 'text-zinc-300')}>
            {item.gasto_real > 0 ? formatMoney(item.gasto_real) : '—'}
          </span>
        )}
      </td>

      {/* Precio de venta */}
      <td className="px-3 py-2 text-right" onClick={() => onStartEdit(item.id, 'precio_venta')}>
        {isEditing('precio_venta') ? (
          <InlineMoneyInput
            defaultValue={centavosToSoles(item.precio_venta)}
            onSave={v => onSave(item.id, 'precio_venta', v)}
            className="text-right"
          />
        ) : (
          <span className={cn('block tabular-nums', canEdit && 'cursor-text', item.precio_venta === 0 && 'text-zinc-300')}>
            {item.precio_venta > 0 ? formatMoney(item.precio_venta) : '—'}
          </span>
        )}
      </td>

      {/* Margen (read-only, computed) */}
      <td className="px-3 py-2 text-right">
        <span className={cn(
          'block tabular-nums font-medium',
          item.precio_venta === 0 && item.gasto_real === 0 ? 'text-zinc-300'
          : margen < 0 ? 'text-red-600'
          : 'text-emerald-700'
        )}>
          {item.precio_venta > 0 || item.gasto_real > 0 ? formatMoney(margen) : '—'}
        </span>
      </td>

      {/* IGV (read-only, computed) */}
      <td className="px-3 py-2 text-right">
        <span className={cn('block tabular-nums', igv === 0 ? 'text-zinc-300' : 'text-blue-700')}>
          {igv > 0 ? formatMoney(igv) : '—'}
        </span>
      </td>

      {/* Comprobante */}
      <td className="px-3 py-2" onClick={() => onStartEdit(item.id, 'tipo_comprobante')}>
        {isEditing('tipo_comprobante') ? (
          <InlineSelect
            value={item.tipo_comprobante ?? ''}
            options={COMPROBANTES}
            onSave={v => onSave(item.id, 'tipo_comprobante', v)}
          />
        ) : (
          <span className={cn('block text-zinc-500 text-xs', canEdit && 'cursor-pointer')}>
            {COMPROBANTES.find(c => c.value === (item.tipo_comprobante ?? ''))?.label ?? '—'}
          </span>
        )}
      </td>

      {/* Delete */}
      {canEdit && (
        <td className="px-2 py-2">
          {canDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all rounded"
              title="Eliminar fila"
            >
              <Trash2 size={14} />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

// ─── Inline Inputs ────────────────────────────────────────────────────────────

function InlineInput({
  defaultValue, onSave, placeholder, className,
}: {
  defaultValue: string
  onSave: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={cn(
        'w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none',
        'focus:border-zinc-500 focus:ring-1 focus:ring-zinc-300',
        className
      )}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') onSave(defaultValue)
      }}
    />
  )
}

function InlineMoneyInput({
  defaultValue, onSave, className,
}: {
  defaultValue: number
  onSave: (v: number) => void
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      type="number"
      step="0.01"
      min="0"
      defaultValue={defaultValue === 0 ? '' : defaultValue.toFixed(2)}
      placeholder="0.00"
      className={cn(
        'w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none tabular-nums',
        'focus:border-zinc-500 focus:ring-1 focus:ring-zinc-300',
        className
      )}
      onBlur={e => {
        const n = parseFloat(e.target.value)
        onSave(isNaN(n) ? 0 : n)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') onSave(defaultValue)
      }}
    />
  )
}

function InlineSelect({
  value, options, onSave,
}: {
  value: string
  options: { value: string; label: string }[]
  onSave: (v: string) => void
}) {
  const ref = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <select
      ref={ref}
      defaultValue={value}
      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
      onChange={e => onSave(e.target.value)}
      onBlur={e => onSave(e.target.value)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ─── Proveedor Combobox ───────────────────────────────────────────────────────

function ProveedorCombobox({
  value, proveedores, onSave, onCreated,
}: {
  value: string
  proveedores: Proveedor[]
  onSave: (id: string) => void
  onCreated: (p: Proveedor) => void
}) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newRazon, setNewRazon] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = proveedores.filter(p =>
    p.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    (p.nombre_comercial ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.ruc ?? '').includes(search)
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onSave(value) // cancel — keep existing value
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value, onSave])

  async function createProveedor() {
    if (!newRazon.trim() || savingNew) return
    setSavingNew(true)
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'persona_juridica',
          ruc: '',
          razon_social: newRazon.trim(),
        }),
      })
      if (!res.ok) {
        // Try as persona_natural if juridica fails
        const res2 = await fetch('/api/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'persona_natural',
            razon_social: newRazon.trim(),
          }),
        })
        if (!res2.ok) return
        const p = await res2.json() as Proveedor
        onCreated(p)
        onSave(p.id)
        return
      }
      const p = await res.json() as Proveedor
      onCreated(p)
      onSave(p.id)
    } finally {
      setSavingNew(false)
    }
  }

  if (creating) {
    return (
      <div ref={containerRef} className="flex items-center gap-1">
        <input
          autoFocus
          value={newRazon}
          onChange={e => setNewRazon(e.target.value)}
          placeholder="Razón social..."
          className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
          onKeyDown={e => {
            if (e.key === 'Enter') createProveedor()
            if (e.key === 'Escape') setCreating(false)
          }}
        />
        <button
          onClick={createProveedor}
          disabled={savingNew || !newRazon.trim()}
          className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {savingNew ? '...' : 'Crear'}
        </button>
        <button onClick={() => setCreating(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar proveedor..."
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
        onKeyDown={e => {
          if (e.key === 'Escape') onSave(value)
        }}
      />
      <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden">
        {/* Clear option */}
        <button
          className="w-full px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-50 border-b border-zinc-100"
          onMouseDown={() => onSave('')}
        >
          — Sin proveedor
        </button>

        {/* Filtered list */}
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-zinc-400">Sin resultados</p>
          )}
          {filtered.map(p => (
            <button
              key={p.id}
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 flex items-center justify-between',
                value === p.id && 'bg-zinc-100'
              )}
              onMouseDown={() => onSave(p.id)}
            >
              <span>{p.nombre_comercial ?? p.razon_social}</span>
              {value === p.id && <Check size={13} className="text-zinc-500" />}
            </button>
          ))}
        </div>

        {/* Create new */}
        <div className="border-t border-zinc-100">
          <button
            className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1.5"
            onMouseDown={() => { setCreating(true); setSearch('') }}
          >
            <Plus size={13} />
            Crear &ldquo;{search || 'nuevo proveedor'}&rdquo;
          </button>
        </div>
      </div>
    </div>
  )
}
