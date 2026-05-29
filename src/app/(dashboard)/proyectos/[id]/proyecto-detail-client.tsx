'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Pencil, Plus, Trash2, Check, X,
  FileText, Wallet, TrendingUp, BarChart3, PanelRight,
  ChevronUp, ChevronDown, ChevronsUpDown, Settings2,
  Upload, Paperclip, Image as ImageIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover'
import { ProyectoSidebar } from './proyecto-sidebar'
import {
  ChartPresupuestoVsReal, ChartComposicion, ChartCascada, ChartBurnRate,
} from './proyecto-charts'
import { cn, formatMoney, centavosToSoles, solesToCentavos } from '@/lib/utils'
import type { ProyectoData, ProyectoItem, Proveedor, GastoFecha, ClienteData, FacturaProyecto } from './page'

// ─── Constants ─────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
  activo:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  en_pausa: 'bg-amber-50 text-amber-700 border-amber-200',
  cerrado:  'bg-zinc-100 text-zinc-500 border-zinc-200',
}
const ESTADO_LABEL: Record<string, string> = { activo: 'Activo', en_pausa: 'En pausa', cerrado: 'Cerrado' }

const UNIDADES = [
  { value: 'global', label: 'Global' }, { value: 'unid', label: 'Unid.' },
  { value: 'hora',   label: 'Hora'   }, { value: 'm2',   label: 'm²'    },
  { value: 'kg',     label: 'kg'     }, { value: 'dia',  label: 'Día'   },
  { value: 'otro',   label: 'Otro'   },
]

const COMPROBANTES = [
  { value: 'pendiente',       label: 'Pendiente'   },
  { value: 'factura',         label: 'Factura'     },
  { value: 'boleta',          label: 'Boleta'      },
  { value: 'rxh',             label: 'RxH'         },
  { value: 'sin_comprobante', label: 'Sin comp.'   },
]

const ESTADO_PAGO_CONFIG: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-zinc-100 text-zinc-500' },
  pagado:    { label: 'Pagado',    cls: 'bg-emerald-100 text-emerald-700' },
  parcial:   { label: 'Parcial',   cls: 'bg-amber-100 text-amber-700' },
}

// ─── Column definitions ────────────────────────────────────────────────────────

type ColKey = 'cantidad' | 'unidad' | 'proveedor' | 'tipo_comp' | 'varianza' | 'precio_venta' | 'margen' | 'igv' | 'estado_pago'
const ALL_OPTIONAL_COLS: ColKey[] = ['cantidad', 'unidad', 'proveedor', 'tipo_comp', 'varianza', 'precio_venta', 'margen', 'igv', 'estado_pago']
const COL_LABELS: Record<ColKey, string> = {
  cantidad:     'Cantidad',
  unidad:       'Unidad',
  proveedor:    'Proveedor',
  tipo_comp:    'Tipo comp.',
  varianza:     'Varianza S/',
  precio_venta: 'P. Venta',
  margen:       'Margen',
  igv:          'IGV',
  estado_pago:  'Estado pago',
}

type SortDir = 'asc' | 'desc'
type SortableCol = 'costo_estimado' | 'gasto_real' | 'varianza' | 'precio_venta' | 'margen' | 'igv'

// ─── Item Status ───────────────────────────────────────────────────────────────

type ItemStatus = 'ejecutado' | 'sobregasto' | 'ahorro' | 'extra' | 'no_ejecutado' | 'vacio'

function getItemStatus(item: ProyectoItem): ItemStatus {
  const { costo_estimado, gasto_real } = item
  if (costo_estimado === 0 && gasto_real === 0) return 'vacio'
  if (costo_estimado === 0) return 'extra'
  if (gasto_real === 0) return 'no_ejecutado'
  if (gasto_real > costo_estimado) return 'sobregasto'
  if (gasto_real < Math.round(costo_estimado * 0.85)) return 'ahorro'
  return 'ejecutado'
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; badge: string; row: string; strikethrough: boolean }> = {
  ejecutado:    { label: 'EJECUTADO',    badge: 'bg-emerald-500 text-white', row: '',           strikethrough: false },
  sobregasto:   { label: 'SOBREGASTO',   badge: 'bg-red-500 text-white',     row: 'bg-red-50',  strikethrough: false },
  ahorro:       { label: 'AHORRO',       badge: 'bg-blue-500 text-white',    row: 'bg-blue-50', strikethrough: false },
  extra:        { label: 'EXTRA',        badge: 'bg-amber-500 text-white',   row: 'bg-amber-50',strikethrough: false },
  no_ejecutado: { label: 'NO EJECUTADO', badge: 'bg-zinc-400 text-white',    row: 'opacity-60', strikethrough: true  },
  vacio:        { label: '',             badge: '',                          row: '',           strikethrough: false },
}

// ─── Magic bytes check (client-side) ──────────────────────────────────────────

const MAGIC_SIGS = [
  { sig: [0xFF,0xD8,0xFF],       mime:'image/jpeg'       },
  { sig: [0x89,0x50,0x4E,0x47], mime:'image/png'        },
  { sig: [0x47,0x49,0x46],      mime:'image/gif'        },
  { sig: [0x52,0x49,0x46,0x46], mime:'image/webp'       },
  { sig: [0x25,0x50,0x44,0x46], mime:'application/pdf'  },
]
async function checkMagicBytes(file: File): Promise<boolean> {
  const buf   = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  return MAGIC_SIGS.some(({ sig }) => sig.every((b, i) => buf[i] === b))
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  proyecto: ProyectoData
  initialItems: ProyectoItem[]
  proveedores: Proveedor[]
  gastos: GastoFecha[]
  indirecto: number
  rol: string
  clientes: ClienteData[]
  initialFacturas: FacturaProyecto[]
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ProyectoDetailClient({
  proyecto: initialProyecto, initialItems, proveedores: initialProveedores,
  gastos, indirecto, rol, clientes, initialFacturas,
}: Props) {
  const router = useRouter()
  const [proyecto, setProyecto]       = useState<ProyectoData>(initialProyecto)
  const [items, setItems]             = useState<ProyectoItem[]>(initialItems)
  const [proveedores, setProveedores] = useState<Proveedor[]>(initialProveedores)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [saving, setSaving]           = useState<string | null>(null)
  const [adding, setAdding]           = useState(false)
  const [apiError, setApiError]       = useState<string | null>(null)
  const pendingTempRef = useRef<{ tempId: string; patch: Record<string, unknown> } | null>(null)
  const [filterProv, setFilterProv]   = useState<string | null>(null)
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [editingSheet, setEditingSheet] = useState<ProyectoItem | null>(null)

  // Sort state
  const [sortState, setSortState] = useState<{ col: SortableCol; dir: SortDir } | null>(null)

  // Column visibility — persisted to localStorage
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    if (typeof window === 'undefined') return new Set(ALL_OPTIONAL_COLS)
    try {
      const stored = localStorage.getItem(`kivo_items_cols_${proyecto.id}`)
      if (stored) return new Set(JSON.parse(stored) as ColKey[])
    } catch { /* ignore */ }
    return new Set(ALL_OPTIONAL_COLS)
  })

  function toggleCol(col: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col); else next.add(col)
      try { localStorage.setItem(`kivo_items_cols_${proyecto.id}`, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
      return next
    })
  }

  const show = (col: ColKey) => visibleCols.has(col)

  const canEdit   = rol === 'admin' || rol === 'pm'
  const canDelete = rol === 'admin'

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredItems = useMemo(
    () => filterProv ? items.filter(i => i.proveedor_id === filterProv) : items,
    [items, filterProv],
  )

  const sortedItems = useMemo(() => {
    if (!sortState) return filteredItems
    return [...filteredItems].sort((a, b) => {
      const val = (item: ProyectoItem) => {
        switch (sortState.col) {
          case 'costo_estimado': return item.costo_estimado
          case 'gasto_real':     return item.gasto_real
          case 'varianza':       return item.costo_estimado > 0 ? item.gasto_real - item.costo_estimado : -Infinity
          case 'precio_venta':   return item.precio_venta
          case 'margen':         return item.precio_venta - item.gasto_real
          case 'igv':            return item.tipo_comprobante === 'factura' ? Math.round(item.gasto_real * 0.18) : 0
          default: return 0
        }
      }
      return sortState.dir === 'asc' ? val(a) - val(b) : val(b) - val(a)
    })
  }, [filteredItems, sortState])

  function cycleSort(col: SortableCol) {
    setSortState(prev => {
      if (!prev || prev.col !== col) return { col, dir: 'asc' }
      if (prev.dir === 'asc') return { col, dir: 'desc' }
      return null
    })
  }

  const totals = items.reduce((acc, item) => {
    const igv      = item.tipo_comprobante === 'factura' ? Math.round(item.gasto_real * 0.18) : 0
    const varianza = item.costo_estimado > 0 ? item.gasto_real - item.costo_estimado : 0
    return {
      costo_estimado: acc.costo_estimado + item.costo_estimado,
      gasto_real:     acc.gasto_real     + item.gasto_real,
      precio_venta:   acc.precio_venta   + item.precio_venta,
      igv:            acc.igv            + igv,
      margen:         acc.margen         + (item.precio_venta - item.gasto_real),
      varianza:       acc.varianza       + varianza,
    }
  }, { costo_estimado: 0, gasto_real: 0, precio_venta: 0, igv: 0, margen: 0, varianza: 0 })

  const avancePct        = totals.costo_estimado > 0 ? Math.min((totals.gasto_real / totals.costo_estimado) * 100, 999) : null
  const margenPct        = totals.precio_venta > 0 ? (totals.margen / totals.precio_venta) * 100 : null
  const margenSobreCosto = totals.gasto_real > 0 ? (totals.margen / totals.gasto_real) * 100 : null
  const varianzaPct      = totals.costo_estimado > 0 ? (totals.varianza / totals.costo_estimado) * 100 : null

  const statusCounts = items.reduce((acc, item) => {
    const s = getItemStatus(item); acc[s] = (acc[s] ?? 0) + 1; return acc
  }, {} as Record<string, number>)

  const proveedoresEnProyecto = Array.from(
    items.filter(i => i.proveedor).reduce((map, i) => {
      const p = i.proveedor!
      if (!map.has(p.id)) map.set(p.id, { ...p, total: 0 })
      map.get(p.id)!.total += i.gasto_real
      return map
    }, new Map<string, { id: string; razon_social: string; nombre_comercial: string | null; total: number }>()).values()
  )

  const provGastos = gastos.reduce((map, g) => {
    if (!g.proveedor_id) return map
    if (!map.has(g.proveedor_id)) map.set(g.proveedor_id, [])
    map.get(g.proveedor_id)!.push(g)
    return map
  }, new Map<string, GastoFecha[]>())

  // ── Error helper ─────────────────────────────────────────────────────────────

  function showError(msg: string) {
    setApiError(msg)
    setTimeout(() => setApiError(null), 5000)
  }

  // ── Save helpers ─────────────────────────────────────────────────────────────

  async function saveFields(itemId: string, fields: Record<string, unknown>, opts: { silent?: boolean } = {}) {
    // Optimistic update — UI reflects change immediately
    const snapshot = items
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...fields } as ProyectoItem : i))

    // If this item is still being created (INSERT in flight), accumulate patch and return
    if (pendingTempRef.current?.tempId === itemId) {
      pendingTempRef.current.patch = { ...pendingTempRef.current.patch, ...fields }
      if (!opts.silent) setEditingCell(null)
      return
    }

    if (!opts.silent) setSaving(itemId)
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) {
        const updated = await res.json() as ProyectoItem
        setItems(prev => prev.map(i => i.id === itemId ? updated : i))
        if (editingSheet?.id === itemId) setEditingSheet(updated)
      } else {
        setItems(snapshot) // revert on API error
        const body = await res.json().catch(() => ({})) as { error?: string }
        showError(body.error ?? `Error ${res.status}`)
      }
    } catch {
      setItems(snapshot) // revert on network error
      showError('Error de red al guardar')
    } finally {
      if (!opts.silent) setSaving(null)
      if (!opts.silent) setEditingCell(null)
    }
  }

  async function saveCell(itemId: string, field: string, raw: unknown, silent?: boolean) {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const fields: Record<string, unknown> = {}

    if (['costo_estimado', 'precio_venta'].includes(field)) {
      const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
      fields[field] = isNaN(n) ? 0 : solesToCentavos(n)
    } else if (field === 'precio_unitario') {
      const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
      const pu = isNaN(n) ? 0 : solesToCentavos(n)
      fields.precio_unitario = pu
      fields.gasto_real      = Math.round(pu * item.cantidad)
    } else if (field === 'gasto_real') {
      const n  = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
      const gr = isNaN(n) ? 0 : solesToCentavos(n)
      fields.gasto_real = gr
      if (item.cantidad > 0) fields.precio_unitario = Math.round(gr / item.cantidad)
    } else if (field === 'cantidad') {
      const n   = parseFloat(String(raw))
      const qty = isNaN(n) || n < 0 ? 0 : n
      fields.cantidad   = qty
      fields.gasto_real = Math.round(item.precio_unitario * qty)
    } else if ((field === 'proveedor_id' || field === 'tipo_comprobante') && raw === '') {
      fields[field] = null
    } else {
      fields[field] = raw
    }

    await saveFields(itemId, fields, { silent })
  }

  async function addItem(focusField: 'concepto' | 'gasto_real' = 'concepto') {
    if (!canEdit || adding) return

    // Insert row in local state immediately — no await before this
    const tempId = crypto.randomUUID()
    const tempItem: ProyectoItem = {
      id: tempId,
      concepto: '',
      unidad: 'global',
      proveedor_id: null,
      costo_estimado: 0,
      precio_venta: 0,
      gasto_real: 0,
      cantidad: 1,
      precio_unitario: 0,
      tipo_comprobante: null,
      estado_pago: 'pendiente',
      fecha_pago: null,
      foto_url: null,
      factura_url: null,
      constancia_pago_url: null,
      sort_order: items.length,
      created_at: new Date().toISOString(),
      proveedor: null,
    }
    pendingTempRef.current = { tempId, patch: {} }
    setItems(prev => [...prev, tempItem])
    setEditingCell({ id: tempId, field: focusField })
    setAdding(true)

    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concepto: '', unidad: 'global', costo_estimado: 0, precio_venta: 0, gasto_real: 0, sort_order: items.length }),
      })
      if (res.ok) {
        const newItem = await res.json() as ProyectoItem
        const pending = pendingTempRef.current
        pendingTempRef.current = null
        // Merge any local edits made while INSERT was in flight
        const mergedItem = pending?.patch && Object.keys(pending.patch).length > 0
          ? { ...newItem, ...pending.patch } as ProyectoItem
          : newItem
        setItems(prev => prev.map(i => i.id === tempId ? mergedItem : i))
        setEditingCell(prev => prev?.id === tempId ? { id: newItem.id, field: prev.field } : prev)
        // Persist any pending patch to the real item
        if (pending?.patch && Object.keys(pending.patch).length > 0) {
          fetch(`/api/proyectos/${proyecto.id}/items/${newItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending.patch),
          }).catch(() => {})
        }
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string; code?: string; details?: string; hint?: string }
        const detail = [body.code, body.details, body.hint].filter(Boolean).join(' — ')
        pendingTempRef.current = null
        setItems(prev => prev.filter(i => i.id !== tempId))
        setEditingCell(null)
        showError(detail ? `${body.error}: ${detail}` : (body.error ?? `Error ${res.status}`))
      }
    } catch {
      pendingTempRef.current = null
      setItems(prev => prev.filter(i => i.id !== tempId))
      setEditingCell(null)
      showError('Error de red. Verifica tu conexión.')
    } finally {
      setAdding(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!canDelete || !confirm('¿Eliminar esta fila?')) return
    const snapshot = items
    setItems(prev => prev.filter(i => i.id !== itemId)) // optimistic
    const res = await fetch(`/api/proyectos/${proyecto.id}/items/${itemId}`, { method: 'DELETE' })
    if (!res.ok) {
      setItems(snapshot) // revert
      showError('Error al eliminar el ítem')
    }
  }

  function onProveedorCreated(p: Proveedor) {
    setProveedores(prev => [...prev, p].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
  }

  async function handleFinalizar() {
    setFinalizando(true)
    try {
      await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cerrado' }),
      })
      router.push('/proyectos')
    } finally {
      setFinalizando(false)
      setShowFinalizarDialog(false)
    }
  }

  // ── Column count helper ──────────────────────────────────────────────────────

  // Total columns including fixed ones
  const colCount = 4 /* concepto+presupuestado+real+estado */ +
    (show('cantidad') ? 1 : 0) + (show('unidad') ? 1 : 0) + (show('proveedor') ? 1 : 0) +
    (show('tipo_comp') ? 1 : 0) + (show('varianza') ? 1 : 0) + (show('precio_venta') ? 1 : 0) +
    (show('margen') ? 1 : 0) + (show('igv') ? 1 : 0) + (show('estado_pago') ? 1 : 0) +
    (canEdit ? 1 : 0)

  // ── KPI cards ────────────────────────────────────────────────────────────────

  const igvCredito = totals.igv  // IGV crédito fiscal (de facturas de gasto)
  const igvDebito  = initialFacturas.reduce((s, f) => s + f.igv, 0)  // IGV débito (facturas emitidas al cliente)
  const igvNeto    = igvDebito - igvCredito  // positivo = a pagar SUNAT, negativo = saldo a favor

  const kpiCards = (
    <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
      {/* Presupuestado */}
      <KpiCard
        label="Presupuestado" icon={<FileText size={15} className="text-zinc-400" />}
        value={totals.costo_estimado > 0 ? formatMoney(totals.costo_estimado) : '—'}
        sub={avancePct !== null ? `${avancePct.toFixed(0)}% ejecutado` : 'Sin ítems aún'}
        progress={avancePct !== null ? Math.min(avancePct, 100) : undefined}
        progressColor={avancePct && avancePct > 100 ? 'bg-red-500' : 'bg-blue-500'}
        detail={totals.gasto_real > 0 && totals.costo_estimado > 0 ? (
          <p className="mt-1 text-[11px] text-zinc-400 tabular-nums">
            Real: <span className="font-medium text-zinc-600 font-mono">{formatMoney(totals.gasto_real)}</span>
            {' '}de{' '}
            <span className="font-mono">{formatMoney(totals.costo_estimado)}</span>
          </p>
        ) : undefined}
      />

      {/* Gastado Real */}
      <KpiCard
        label="Gastado (Real)" icon={<Wallet size={15} className="text-zinc-400" />}
        value={totals.gasto_real > 0 ? formatMoney(totals.gasto_real) : '—'}
        sub={avancePct !== null ? `${avancePct.toFixed(0)}% del presupuesto` : 'Sin gastos aún'}
        progress={avancePct !== null ? Math.min(avancePct, 100) : undefined}
        progressColor={avancePct && avancePct > 100 ? 'bg-red-500' : 'bg-blue-500'}
        detail={totals.costo_estimado > 0 ? (
          <p className="mt-1 text-[11px] text-zinc-400 tabular-nums">
            De <span className="font-mono">{formatMoney(totals.costo_estimado)}</span> presupuestados
          </p>
        ) : undefined}
      />

      {/* Margen Bruto */}
      <KpiCard
        label="Margen Bruto"
        icon={<TrendingUp size={15} className={margenSobreCosto === null ? 'text-zinc-400' : margenSobreCosto < 15 ? 'text-red-500' : margenSobreCosto < 30 ? 'text-amber-500' : 'text-emerald-500'} />}
        value={totals.precio_venta > 0 || totals.gasto_real > 0 ? formatMoney(totals.margen) : '—'}
        sub={margenSobreCosto !== null ? `${margenSobreCosto.toFixed(1)}% sobre costo` : 'Sin datos suficientes'}
        progress={margenSobreCosto !== null ? Math.max(0, Math.min(margenSobreCosto, 100)) : undefined}
        progressColor={margenSobreCosto === null ? 'bg-zinc-300' : margenSobreCosto < 0 ? 'bg-red-500' : margenSobreCosto < 15 ? 'bg-red-400' : margenSobreCosto < 30 ? 'bg-amber-400' : 'bg-emerald-500'}
        cardBg={margenSobreCosto === null ? '' : margenSobreCosto < 15 ? 'bg-red-50 border-red-200' : margenSobreCosto < 30 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}
        detail={totals.gasto_real > 0 ? (
          <p className="mt-1 text-[11px] text-zinc-400 tabular-nums">
            De <span className="font-mono">{formatMoney(totals.gasto_real)}</span> en costos
          </p>
        ) : undefined}
      />

      {/* Posición IGV */}
      <KpiCard
        label="Posición IGV" icon={<BarChart3 size={15} className="text-zinc-400" />}
        value={igvCredito > 0 ? formatMoney(igvCredito) : '—'}
        sub={igvCredito > 0 ? 'IGV crédito fiscal (gastos)' : 'Sin facturas de gasto'}
        progress={igvCredito > 0 && igvDebito > 0 ? Math.min((igvCredito / igvDebito) * 100, 100) : igvCredito > 0 ? 100 : undefined}
        progressColor="bg-amber-400"
        detail={(igvCredito > 0 || igvDebito > 0) ? (
          <div className="mt-1 space-y-0.5 text-[11px] tabular-nums">
            {igvDebito > 0 && (
              <p className="text-zinc-400">
                Débito (ventas): <span className="font-mono font-medium text-zinc-600">{formatMoney(igvDebito)}</span>
              </p>
            )}
            {(igvCredito > 0 || igvDebito > 0) && (
              <p className={cn('font-semibold', igvNeto > 0 ? 'text-red-600' : igvNeto < 0 ? 'text-emerald-600' : 'text-zinc-400')}>
                {igvNeto > 0
                  ? `A pagar SUNAT: ${formatMoney(igvNeto)}`
                  : igvNeto < 0
                  ? `Saldo a favor: ${formatMoney(Math.abs(igvNeto))}`
                  : 'Posición neutra'}
              </p>
            )}
          </div>
        ) : undefined}
      />
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar proyecto como concluido</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm mt-1">
              Se marcará el proyecto como <strong>Cerrado</strong>. Podrás seguir consultando
              el historial pero no se podrán agregar nuevos ítems ni gastos.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFinalizarDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleFinalizar} disabled={finalizando}>
              {finalizando ? 'Cerrando...' : 'Confirmar cierre'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error banner */}
      {apiError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-lg text-sm text-red-700 max-w-lg">
          <X size={15} className="shrink-0 text-red-500" />
          <span>{apiError}</span>
          <button onClick={() => setApiError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Item Edit Sheet */}
      {editingSheet && (
        <ItemEditSheet
          item={editingSheet}
          proveedores={proveedores}
          proyectoId={proyecto.id}
          canEdit={canEdit}
          onClose={() => setEditingSheet(null)}
          onSave={saveFields}
          onProveedorCreated={onProveedorCreated}
        />
      )}

      <div className="flex min-h-full">
        {/* ── Main area ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 p-6 space-y-6">

          {/* Header */}
          <div>
            <Link href="/proyectos" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-900 transition-colors">
              <ChevronLeft size={14} /> Volver a Proyectos
            </Link>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{proyecto.nombre}</h1>
                <Badge variant="outline" className={ESTADO_BADGE[proyecto.estado] ?? ''}>{ESTADO_LABEL[proyecto.estado] ?? proyecto.estado}</Badge>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="xl:hidden"><PanelRight size={14} /></Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-96 overflow-y-auto p-0">
                    <SheetHeader className="px-5 py-4 border-b border-zinc-100"><SheetTitle>Detalles del proyecto</SheetTitle></SheetHeader>
                    <ProyectoSidebar
                      proyecto={proyecto} canEdit={canEdit} items={items}
                      clientes={clientes} initialFacturas={initialFacturas}
                      onProyectoUpdate={p => setProyecto(prev => ({ ...prev, ...p }))}
                      onConcluir={canEdit ? () => setShowFinalizarDialog(true) : undefined}
                    />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="resumen">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="graficos">Gráficos</TabsTrigger>
            </TabsList>
            <TabsContent value="resumen">{kpiCards}</TabsContent>
            <TabsContent value="graficos">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[
                  { title: 'Presupuesto vs Real',    el: <ChartPresupuestoVsReal items={items} /> },
                  { title: 'Composición del gasto',  el: <ChartComposicion items={items} getStatus={getItemStatus} /> },
                  { title: 'Cascada de margen',      el: <ChartCascada items={items} indirecto={indirecto} /> },
                  { title: 'Burn rate',              el: <ChartBurnRate gastos={gastos} fechaInicio={proyecto.fecha_inicio} fechaCierre={proyecto.fecha_cierre_est} presupuestadoTotal={totals.costo_estimado} /> },
                ].map(({ title, el }) => (
                  <div key={title} className="rounded-lg border border-zinc-200 bg-white p-5">
                    <h3 className="mb-4 text-sm font-semibold text-zinc-700">{title}</h3>
                    {el}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Items table */}
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Ítems del proyecto</h2>
              <div className="flex items-center gap-2">
                {filterProv && (
                  <button onClick={() => setFilterProv(null)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 rounded border border-zinc-200 px-2 py-1">
                    <X size={11} /> Quitar filtro
                  </button>
                )}
                {/* Column visibility */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-colors">
                      <Settings2 size={12} /> Columnas
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <p className="mb-2 px-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Columnas visibles</p>
                    {ALL_OPTIONAL_COLS.map(col => (
                      <label key={col} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-zinc-700 hover:bg-zinc-50">
                        <input type="checkbox" checked={show(col)} onChange={() => toggleCol(col)} className="h-3.5 w-3.5 accent-zinc-900" />
                        {COL_LABELS[col]}
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5 text-left w-52">Concepto</th>
                    {show('cantidad') && <th className="px-3 py-2.5 text-right w-20">Cantidad</th>}
                    {show('unidad') && <th className="px-3 py-2.5 text-left w-20">Unidad</th>}
                    {show('proveedor') && <th className="px-3 py-2.5 text-left w-36">Proveedor</th>}
                    {show('tipo_comp') && <th className="px-3 py-2.5 text-left w-28">Tipo comp.</th>}
                    <SortHeader col="costo_estimado" label="Presupuestado" sort={sortState} onSort={cycleSort} className="w-28" />
                    <SortHeader col="gasto_real" label="Real" sort={sortState} onSort={cycleSort} className="w-24" />
                    {show('varianza') && <SortHeader col="varianza" label="Varianza S/" sort={sortState} onSort={cycleSort} className="w-24" />}
                    <th className="px-3 py-2.5 text-left w-32">Estado ítem</th>
                    {show('precio_venta') && <SortHeader col="precio_venta" label="P. Venta" sort={sortState} onSort={cycleSort} className="w-28" />}
                    {show('margen') && <SortHeader col="margen" label="Margen" sort={sortState} onSort={cycleSort} className="w-24" />}
                    {show('igv') && <SortHeader col="igv" label="IGV" sort={sortState} onSort={cycleSort} className="w-24" />}
                    {show('estado_pago') && <th className="px-3 py-2.5 text-left w-32">Estado pago</th>}
                    {canEdit && <th className="px-3 py-2.5 w-16" />}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.length === 0 && !canEdit && (
                    <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-zinc-400">Sin ítems aún.</td></tr>
                  )}
                  {sortedItems.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      proveedores={proveedores}
                      editingCell={editingCell}
                      saving={saving}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      show={show}
                      onStartEdit={(id, field) => canEdit && setEditingCell({ id, field })}
                      onSave={saveCell}
                      onSaveFields={saveFields}
                      onDelete={deleteItem}
                      onProveedorCreated={onProveedorCreated}
                      onOpenSheet={() => setEditingSheet(item)}
                      proyectoId={proyecto.id}
                    />
                  ))}
                  {canEdit && (
                    <tr className="border-b border-zinc-100 cursor-text hover:bg-zinc-50/50" onClick={() => addItem('concepto')}>
                      <td colSpan={colCount} className="px-4 py-3">
                        <span className="text-sm text-zinc-300 italic select-none">
                          {adding ? 'Agregando…' : 'Haz clic aquí para agregar un nuevo ítem…'}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Totals */}
                {items.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200" style={{ backgroundColor: '#f0f4ff' }}>
                      <td className="px-4 py-3 text-xs font-bold text-zinc-600 uppercase tracking-wide">
                        Totales {(show('cantidad') || show('unidad') || show('proveedor') || show('tipo_comp')) ? '' : ''}
                      </td>
                      {show('cantidad') && <td />}
                      {show('unidad') && <td />}
                      {show('proveedor') && <td />}
                      {show('tipo_comp') && <td />}
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-zinc-800 text-sm">
                        {totals.costo_estimado > 0 ? formatMoney(totals.costo_estimado) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-zinc-800 text-sm">
                        {totals.gasto_real > 0 ? formatMoney(totals.gasto_real) : '—'}
                      </td>
                      {show('varianza') && (
                        <td className={cn('px-3 py-3 text-right font-bold tabular-nums text-sm', totals.varianza > 0 ? 'text-red-600' : totals.varianza < 0 ? 'text-blue-600' : 'text-zinc-400')}>
                          {totals.costo_estimado > 0 ? `${totals.varianza > 0 ? '+' : ''}${formatMoney(totals.varianza)}` : '—'}
                        </td>
                      )}
                      <td />
                      {show('precio_venta') && (
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-zinc-800 text-sm">
                          {totals.precio_venta > 0 ? formatMoney(totals.precio_venta) : '—'}
                        </td>
                      )}
                      {show('margen') && (
                        <td className={cn('px-3 py-3 text-right font-bold tabular-nums text-sm', margenPct === null ? 'text-zinc-400' : totals.margen < 0 ? 'text-red-600' : 'text-emerald-700')}>
                          {totals.precio_venta > 0 ? `${margenPct?.toFixed(0)}%` : '—'}
                        </td>
                      )}
                      {show('igv') && (
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-blue-700 text-sm">
                          {totals.igv > 0 ? formatMoney(totals.igv) : '—'}
                        </td>
                      )}
                      {show('estado_pago') && <td />}
                      {canEdit && <td />}
                    </tr>
                    <tr style={{ backgroundColor: '#f0f4ff' }}>
                      <td colSpan={colCount} className="px-4 pb-3 text-xs text-zinc-400">
                        {[
                          statusCounts['sobregasto'] && `${statusCounts['sobregasto']} sobregasto${statusCounts['sobregasto'] > 1 ? 's' : ''}`,
                          statusCounts['ahorro']       && `${statusCounts['ahorro']} ahorro${statusCounts['ahorro'] > 1 ? 's' : ''}`,
                          statusCounts['extra']        && `${statusCounts['extra']} extra${statusCounts['extra'] > 1 ? 's' : ''}`,
                          statusCounts['no_ejecutado'] && `${statusCounts['no_ejecutado']} no ejecutado${statusCounts['no_ejecutado'] > 1 ? 's' : ''}`,
                        ].filter(Boolean).join(' · ') || 'Todos los ítems ejecutados dentro del presupuesto'}
                        {varianzaPct !== null && (
                          <span className={cn('ml-3 font-medium', varianzaPct > 0 ? 'text-red-500' : 'text-blue-500')}>
                            {varianzaPct > 0 ? '+' : ''}{varianzaPct.toFixed(1)}% varianza total
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {canEdit && (
              <div className="flex gap-3 px-5 py-4 border-t border-zinc-100">
                <Button size="sm" onClick={() => addItem('concepto')} disabled={adding}>
                  <Plus size={13} className="mr-1.5" /> Agregar ítem presupuestado
                </Button>
                <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => addItem('gasto_real')} disabled={adding}>
                  ✦ Agregar gasto extra
                </Button>
              </div>
            )}
          </div>

          {/* Proveedores */}
          {proveedoresEnProyecto.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">Proveedores en este proyecto</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {proveedoresEnProyecto.map(p => {
                  const gastosProv = provGastos.get(p.id) ?? []
                  const pendientes = gastosProv.filter(g => g.estado_pago === 'pendiente')
                  const tipo       = gastosProv.at(-1)?.tipo_comprobante ?? null
                  const tipoLabel: Record<string, string> = { factura: 'Factura', boleta: 'Boleta', rxh: 'RxH', sin_comprobante: 'Sin comp.' }
                  const isActive   = filterProv === p.id
                  return (
                    <button key={p.id} onClick={() => setFilterProv(isActive ? null : p.id)}
                      className={cn('flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-all hover:shadow-sm', isActive ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200')}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
                        {(p.nombre_comercial ?? p.razon_social).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{p.nombre_comercial ?? p.razon_social}</p>
                        <p className="text-xs font-mono text-zinc-500">{formatMoney(p.total)}</p>
                        {pendientes.length > 0 ? (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-amber-700">
                            Pendiente de pago {tipo && <span className="bg-amber-100 rounded px-1">{tipoLabel[tipo] ?? tipo}</span>}
                          </span>
                        ) : gastosProv.length > 0 ? (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-emerald-700"><Check size={10} /> Pagado</span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────────────────────── */}
        <aside className="hidden xl:block w-80 shrink-0 sticky top-6 self-start" style={{ maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', borderLeft: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <ProyectoSidebar
            proyecto={proyecto} canEdit={canEdit} items={items}
            clientes={clientes} initialFacturas={initialFacturas}
            onProyectoUpdate={p => setProyecto(prev => ({ ...prev, ...p }))}
            onConcluir={canEdit ? () => setShowFinalizarDialog(true) : undefined}
          />
        </aside>
      </div>
    </>
  )
}

// ─── Sort Header ───────────────────────────────────────────────────────────────

function SortHeader({ col, label, sort, onSort, className }: {
  col: SortableCol; label: string
  sort: { col: SortableCol; dir: SortDir } | null
  onSort: (c: SortableCol) => void
  className?: string
}) {
  const active = sort?.col === col
  const Icon   = !active ? ChevronsUpDown : sort!.dir === 'asc' ? ChevronUp : ChevronDown
  return (
    <th
      className={cn('px-3 py-2.5 text-right cursor-pointer select-none hover:text-zinc-700 group', active && 'text-zinc-900', className)}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        <Icon size={11} className={cn('shrink-0', active ? 'opacity-100' : 'opacity-30 group-hover:opacity-60')} />
      </span>
    </th>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, icon, value, sub, progress, progressColor, cardBg, detail }: {
  label: string; icon?: React.ReactNode; value: string; sub?: string
  progress?: number; progressColor?: string; cardBg?: string
  detail?: React.ReactNode
}) {
  return (
    <div className={cn('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', cardBg)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums font-mono text-zinc-900 leading-none">{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', progressColor ?? 'bg-blue-500')} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      {sub && <p className="mt-1.5 text-xs text-zinc-400">{sub}</p>}
      {detail}
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
  show: (col: ColKey) => boolean
  onStartEdit: (id: string, field: string) => void
  onSave: (id: string, field: string, value: unknown, silent?: boolean) => Promise<void>
  onSaveFields: (id: string, fields: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onProveedorCreated: (p: Proveedor) => void
  onOpenSheet: () => void
  proyectoId: string
}

function ItemRow({
  item, proveedores, editingCell, saving, canEdit, canDelete, show,
  onStartEdit, onSave, onSaveFields, onDelete, onProveedorCreated, onOpenSheet,
}: ItemRowProps) {
  const isEditing = (f: string) => editingCell?.id === item.id && editingCell.field === f
  const isSaving  = saving === item.id
  const status    = getItemStatus(item)
  const cfg       = STATUS_CONFIG[status]
  const igv       = item.tipo_comprobante === 'factura' ? Math.round(item.gasto_real * 0.18) : 0
  const margenAmt    = item.precio_venta - item.gasto_real
  const margenRowPct = item.precio_venta > 0 ? (margenAmt / item.precio_venta) * 100 : null
  const varianza     = item.costo_estimado > 0 ? item.gasto_real - item.costo_estimado : 0

  return (
    <tr className={cn('group border-b border-zinc-100 transition-colors', cfg.row, isSaving && 'opacity-50', cfg.strikethrough && 'line-through text-zinc-400')}>

      {/* Concepto */}
      <td className="px-4 py-2.5" onClick={() => onStartEdit(item.id, 'concepto')}>
        {isEditing('concepto') ? (
          <InlineInput defaultValue={item.concepto} onSave={(v, silent) => onSave(item.id, 'concepto', v, silent)} placeholder="Describe el ítem..." />
        ) : (
          <span className={cn('block text-sm', canEdit && 'cursor-text', !item.concepto && 'text-zinc-300 italic')}>
            {item.concepto || (canEdit ? 'Concepto…' : '—')}
          </span>
        )}
      </td>

      {/* Cantidad */}
      {show('cantidad') && (
        <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'cantidad')}>
          {isEditing('cantidad') ? (
            <InlineCantidadInput defaultValue={item.cantidad} onSave={v => onSave(item.id, 'cantidad', v)} />
          ) : (
            <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text')} title={item.precio_unitario > 0 ? `× ${formatMoney(item.precio_unitario)} c/u` : undefined}>
              {item.cantidad !== 1 || item.precio_unitario > 0 ? (
                <span>
                  {item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)}
                  {item.precio_unitario > 0 && <span className="ml-1 text-[10px] text-zinc-400">× {formatMoney(item.precio_unitario)}</span>}
                </span>
              ) : <span className="text-zinc-300">—</span>}
            </span>
          )}
        </td>
      )}

      {/* Unidad */}
      {show('unidad') && (
        <td className="px-3 py-2.5" onClick={() => onStartEdit(item.id, 'unidad')}>
          {isEditing('unidad') ? (
            <InlineSelect value={item.unidad} options={UNIDADES} onSave={v => onSave(item.id, 'unidad', v)} />
          ) : (
            <span className={cn('text-sm text-zinc-500', canEdit && 'cursor-pointer')}>
              {UNIDADES.find(u => u.value === item.unidad)?.label ?? item.unidad}
            </span>
          )}
        </td>
      )}

      {/* Proveedor */}
      {show('proveedor') && (
        <td className="px-3 py-2.5">
          {isEditing('proveedor_id') ? (
            <ProveedorCombobox value={item.proveedor_id ?? ''} proveedores={proveedores} onSave={v => onSave(item.id, 'proveedor_id', v)} onCreated={onProveedorCreated} />
          ) : (
            <span className={cn('block text-sm text-zinc-600 truncate max-w-[130px]', canEdit && 'cursor-pointer')} onClick={() => onStartEdit(item.id, 'proveedor_id')}>
              {item.proveedor ? (item.proveedor.nombre_comercial ?? item.proveedor.razon_social) : <span className="text-zinc-300 italic">{canEdit ? 'Seleccionar…' : '—'}</span>}
            </span>
          )}
        </td>
      )}

      {/* Tipo comprobante */}
      {show('tipo_comp') && (
        <td className="px-3 py-2.5" onClick={() => onStartEdit(item.id, 'tipo_comprobante')}>
          {isEditing('tipo_comprobante') ? (
            <InlineSelect value={item.tipo_comprobante ?? 'pendiente'} options={COMPROBANTES} onSave={v => onSave(item.id, 'tipo_comprobante', v)} />
          ) : (
            <span className={cn('text-xs rounded px-1.5 py-0.5 font-medium', canEdit && 'cursor-pointer',
              item.tipo_comprobante === 'factura'         ? 'bg-blue-50 text-blue-700'
              : item.tipo_comprobante === 'boleta'        ? 'bg-purple-50 text-purple-700'
              : item.tipo_comprobante === 'rxh'           ? 'bg-orange-50 text-orange-700'
              : item.tipo_comprobante === 'sin_comprobante' ? 'bg-red-50 text-red-600'
              : 'bg-zinc-100 text-zinc-400'
            )}>
              {COMPROBANTES.find(c => c.value === (item.tipo_comprobante ?? 'pendiente'))?.label ?? '—'}
            </span>
          )}
        </td>
      )}

      {/* Presupuestado */}
      <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'costo_estimado')}>
        {isEditing('costo_estimado') ? (
          <InlineMoneyInput defaultValue={centavosToSoles(item.costo_estimado)} onSave={v => onSave(item.id, 'costo_estimado', v)} />
        ) : (
          <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text', item.costo_estimado === 0 && status === 'extra' ? 'text-zinc-300' : '')}>
            {item.costo_estimado > 0 ? formatMoney(item.costo_estimado) : '—'}
          </span>
        )}
      </td>

      {/* Real (gasto_real) */}
      <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'gasto_real')}>
        {isEditing('gasto_real') ? (
          <InlineMoneyInput defaultValue={centavosToSoles(item.gasto_real)} onSave={v => onSave(item.id, 'gasto_real', v)} />
        ) : (
          <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text', item.gasto_real === 0 && 'text-zinc-300')}>
            {item.gasto_real > 0 ? formatMoney(item.gasto_real) : '—'}
          </span>
        )}
      </td>

      {/* Varianza S/ */}
      {show('varianza') && (
        <td className="px-3 py-2.5 text-right">
          {status === 'extra' ? (
            <span className="text-sm text-amber-600 font-medium">+{formatMoney(item.gasto_real)}</span>
          ) : status === 'no_ejecutado' || item.costo_estimado === 0 ? (
            <span className="text-sm text-zinc-300">—</span>
          ) : (
            <span className={cn('text-sm tabular-nums font-medium', varianza > 0 ? 'text-red-600' : 'text-blue-600')}>
              {varianza > 0 ? '+' : ''}{formatMoney(varianza)}
            </span>
          )}
        </td>
      )}

      {/* Estado ítem */}
      <td className="px-3 py-2.5">
        {cfg.label && <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold tracking-wide', cfg.badge)}>{cfg.label}</span>}
      </td>

      {/* P. Venta */}
      {show('precio_venta') && (
        <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'precio_venta')}>
          {isEditing('precio_venta') ? (
            <InlineMoneyInput defaultValue={centavosToSoles(item.precio_venta)} onSave={v => onSave(item.id, 'precio_venta', v)} />
          ) : (
            <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text', item.precio_venta === 0 && 'text-zinc-300')}>
              {item.precio_venta > 0 ? formatMoney(item.precio_venta) : '—'}
            </span>
          )}
        </td>
      )}

      {/* Margen */}
      {show('margen') && (
        <td className="px-3 py-2.5 text-right">
          {item.gasto_real === 0 && item.precio_venta === 0 ? (
            <span className="text-sm text-zinc-300">—</span>
          ) : margenRowPct !== null ? (
            <span className={cn('text-sm tabular-nums font-medium', margenRowPct < 0 ? 'text-red-600' : 'text-emerald-700')}>
              {margenRowPct.toFixed(0)}%
            </span>
          ) : (
            <span className={cn('text-sm tabular-nums font-medium', margenAmt < 0 ? 'text-red-600' : 'text-emerald-700')}>
              {formatMoney(margenAmt)}
            </span>
          )}
        </td>
      )}

      {/* IGV */}
      {show('igv') && (
        <td className="px-3 py-2.5 text-right">
          {item.tipo_comprobante === 'factura' ? (
            <span className="text-sm tabular-nums text-blue-700">{formatMoney(igv)}</span>
          ) : item.gasto_real > 0 ? (
            <span className="text-sm text-zinc-300">S/ 0</span>
          ) : (
            <span className="text-sm text-zinc-300">—</span>
          )}
        </td>
      )}

      {/* Estado pago */}
      {show('estado_pago') && (
        <td className="px-3 py-2.5">
          <InlineEstadoPago item={item} canEdit={canEdit} onSave={(ep, fp) => onSaveFields(item.id, { estado_pago: ep, fecha_pago: fp ?? null })} />
        </td>
      )}

      {/* Acciones */}
      {canEdit && (
        <td className="px-2 py-2.5">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onOpenSheet} className="p-1 text-zinc-400 hover:text-zinc-700 rounded" title="Editar detalle">
              <Pencil size={12} />
            </button>
            {canDelete && (
              <button onClick={() => onDelete(item.id)} className="p-1 text-zinc-300 hover:text-red-500 rounded" title="Eliminar">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

// ─── Inline Estado Pago ────────────────────────────────────────────────────────

function InlineEstadoPago({ item, canEdit, onSave }: {
  item: ProyectoItem
  canEdit: boolean
  onSave: (estado: string, fecha: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [estado, setEstado]   = useState(item.estado_pago)
  const [fecha, setFecha]     = useState(item.fecha_pago ?? '')
  const cfg = ESTADO_PAGO_CONFIG[item.estado_pago] ?? ESTADO_PAGO_CONFIG['pendiente']

  function commit(e: string, f: string) {
    setEditing(false)
    onSave(e, e === 'pagado' && f ? f : null)
  }

  if (!canEdit) {
    return <span className={cn('rounded px-2 py-0.5 text-xs font-medium', cfg.cls)}>{cfg.label}</span>
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className={cn('rounded px-2 py-0.5 text-xs font-medium hover:ring-1 hover:ring-offset-1', cfg.cls)}>
        {cfg.label}
        {item.fecha_pago && <span className="ml-1 opacity-60 text-[10px]">{item.fecha_pago}</span>}
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <select
        autoFocus
        value={estado}
        onChange={e => { const v = e.target.value as 'pendiente'|'pagado'|'parcial'; setEstado(v); if (v !== 'pagado') commit(v, '') }}
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-500"
      >
        {Object.entries(ESTADO_PAGO_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
      </select>
      {estado === 'pagado' && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-500"
          />
          <button onClick={() => commit(estado, fecha)} className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-white hover:bg-zinc-700">OK</button>
        </div>
      )}
    </div>
  )
}

// ─── Inline Inputs ─────────────────────────────────────────────────────────────

function InlineInput({ defaultValue, onSave, placeholder }: { defaultValue: string; onSave: (v: string, silent?: boolean) => void; placeholder?: string }) {
  const ref      = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  function cancelDebounce() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    cancelDebounce()
    timerRef.current = setTimeout(() => { timerRef.current = null; onSave(value, true) }, 400)
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    cancelDebounce()
    onSave(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') { cancelDebounce(); onSave(defaultValue); (e.target as HTMLInputElement).blur() }
  }

  return (
    <input ref={ref} defaultValue={defaultValue} placeholder={placeholder}
      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200"
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}

function InlineMoneyInput({ defaultValue, onSave }: { defaultValue: number; onSave: (v: number) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <input ref={ref} type="number" step="0.01" min="0" defaultValue={defaultValue === 0 ? '' : defaultValue.toFixed(2)} placeholder="0.00"
      className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-right tabular-nums outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200"
      onBlur={e => { const n = parseFloat(e.target.value); onSave(isNaN(n) ? 0 : n) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') onSave(defaultValue) }}
    />
  )
}

function InlineCantidadInput({ defaultValue, onSave }: { defaultValue: number; onSave: (v: number) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <input ref={ref} type="number" step="0.01" min="0" defaultValue={defaultValue === 0 ? '' : defaultValue} placeholder="1"
      className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-right tabular-nums outline-none focus:border-zinc-500"
      onBlur={e => { const n = parseFloat(e.target.value); onSave(isNaN(n) || n < 0 ? 0 : n) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') onSave(defaultValue) }}
    />
  )
}

function InlineSelect({ value, options, onSave }: { value: string; options: { value: string; label: string }[]; onSave: (v: string) => void }) {
  const ref = useRef<HTMLSelectElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <select ref={ref} defaultValue={value}
      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
      onChange={e => onSave(e.target.value)}
      onBlur={e => onSave(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Proveedor Combobox ────────────────────────────────────────────────────────

function ProveedorCombobox({ value, proveedores, onSave, onCreated }: {
  value: string; proveedores: Proveedor[]; onSave: (id: string) => void; onCreated: (p: Proveedor) => void
}) {
  const [search, setSearch]     = useState('')
  const [creating, setCreating] = useState(false)
  const [newRazon, setNewRazon] = useState('')
  const [busy, setBusy]         = useState(false)
  const ref                     = useRef<HTMLDivElement>(null)

  const filtered = proveedores.filter(p =>
    p.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    (p.nombre_comercial ?? '').toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onSave(value) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [value, onSave])

  async function createProv() {
    if (!newRazon.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/proveedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'persona_natural', razon_social: newRazon.trim() }) })
      if (res.ok) { const p = await res.json() as Proveedor; onCreated(p); onSave(p.id) }
    } finally { setBusy(false) }
  }

  if (creating) return (
    <div ref={ref} className="flex items-center gap-1">
      <input autoFocus value={newRazon} onChange={e => setNewRazon(e.target.value)} placeholder="Razón social..."
        className="flex-1 min-w-0 rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
        onKeyDown={e => { if (e.key === 'Enter') createProv(); if (e.key === 'Escape') setCreating(false) }}
      />
      <button onClick={createProv} disabled={busy || !newRazon.trim()} className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50">{busy ? '…' : 'Crear'}</button>
      <button onClick={() => setCreating(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={12} /></button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
        onKeyDown={e => { if (e.key === 'Escape') onSave(value) }}
      />
      <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden">
        <button className="w-full px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-50 border-b border-zinc-100" onMouseDown={() => onSave('')}>— Sin proveedor</button>
        <div className="max-h-44 overflow-y-auto">
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-zinc-400">Sin resultados</p>}
          {filtered.map(p => (
            <button key={p.id} className={cn('w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 flex items-center justify-between', value === p.id && 'bg-zinc-100')} onMouseDown={() => onSave(p.id)}>
              <span className="truncate">{p.nombre_comercial ?? p.razon_social}</span>
              {value === p.id && <Check size={12} className="shrink-0 ml-2 text-zinc-500" />}
            </button>
          ))}
        </div>
        <div className="border-t border-zinc-100">
          <button className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1.5" onMouseDown={() => { setCreating(true); setSearch('') }}>
            <Plus size={12} /> Crear &ldquo;{search || 'nuevo proveedor'}&rdquo;
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Item Edit Sheet ───────────────────────────────────────────────────────────

type DocTipo = 'foto' | 'factura' | 'constancia'

interface DocSection { tipo: DocTipo; label: string; desc: string; accept: string; maxSize: number; field: keyof ProyectoItem }
const DOC_SECTIONS: DocSection[] = [
  { tipo: 'foto',       label: 'Foto del producto/servicio', desc: 'Imagen, máx 5MB',         accept: 'image/*',                   maxSize: 5  * 1024 * 1024, field: 'foto_url'            },
  { tipo: 'factura',    label: 'Factura del proveedor',      desc: 'PDF o imagen, máx 10MB',  accept: 'image/*,application/pdf',   maxSize: 10 * 1024 * 1024, field: 'factura_url'         },
  { tipo: 'constancia', label: 'Constancia de pago',         desc: 'PDF o imagen, máx 10MB',  accept: 'image/*,application/pdf',   maxSize: 10 * 1024 * 1024, field: 'constancia_pago_url' },
]

interface EditSheetProps {
  item: ProyectoItem
  proveedores: Proveedor[]
  proyectoId: string
  canEdit: boolean
  onClose: () => void
  onSave: (id: string, fields: Record<string, unknown>) => Promise<void>
  onProveedorCreated: (p: Proveedor) => void
}

function ItemEditSheet({ item, proveedores, proyectoId, canEdit, onClose, onSave }: EditSheetProps) {
  const [form, setForm]         = useState({ ...item })
  const [saving, setSaving]     = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState<DocTipo | null>(null)
  const [docUrls, setDocUrls]   = useState<Partial<Record<DocTipo, string>>>({})

  // Fetch signed URLs for existing docs
  useEffect(() => {
    const paths: Partial<Record<DocTipo, string>> = {
      foto:       item.foto_url ?? undefined,
      factura:    item.factura_url ?? undefined,
      constancia: item.constancia_pago_url ?? undefined,
    }
    for (const [tipo, path] of Object.entries(paths) as [DocTipo, string | undefined][]) {
      if (!path) continue
      fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`)
        .then(r => r.json())
        .then((d: { url?: string }) => { if (d.url) setDocUrls(prev => ({ ...prev, [tipo]: d.url })) })
        .catch(() => { /* ignore */ })
    }
  }, [item.foto_url, item.factura_url, item.constancia_pago_url])

  function setField(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }))
    // Recalculate interdependencies
    if (key === 'cantidad') {
      const qty = Number(value) || 0
      setForm(prev => ({ ...prev, cantidad: qty, gasto_real: Math.round(prev.precio_unitario * qty) }))
    } else if (key === 'precio_unitario') {
      const pu = solesToCentavos(Number(value) || 0)
      setForm(prev => ({ ...prev, precio_unitario: pu, gasto_real: Math.round(pu * prev.cantidad) }))
    } else if (key === 'gasto_real') {
      const gr = solesToCentavos(Number(value) || 0)
      const pu = form.cantidad > 0 ? Math.round(gr / form.cantidad) : 0
      setForm(prev => ({ ...prev, gasto_real: gr, precio_unitario: pu }))
    }
  }

  async function handleSave() {
    setSaving(true)
    await onSave(item.id, {
      concepto:        form.concepto,
      unidad:          form.unidad,
      proveedor_id:    form.proveedor_id,
      costo_estimado:  form.costo_estimado,
      precio_venta:    form.precio_venta,
      gasto_real:      form.gasto_real,
      cantidad:        form.cantidad,
      precio_unitario: form.precio_unitario,
      tipo_comprobante: form.tipo_comprobante,
      estado_pago:     form.estado_pago,
      fecha_pago:      form.fecha_pago,
    })
    setSaving(false)
    onClose()
  }

  async function handleUpload(tipo: DocTipo, file: File, maxSize: number) {
    setUploadErr(null)
    if (file.size > maxSize) { setUploadErr(`Archivo demasiado grande (máx ${maxSize / 1024 / 1024}MB)`); return }
    const ok = await checkMagicBytes(file)
    if (!ok) { setUploadErr('Tipo de archivo no permitido (usa imagen JPEG/PNG o PDF)'); return }

    setUploading(tipo)
    try {
      const fd = new FormData()
      fd.append('tipo', tipo)
      fd.append('file', file)
      const res = await fetch(`/api/proyectos/${proyectoId}/items/${item.id}/upload`, { method: 'POST', body: fd })
      const data = await res.json() as { path?: string; url?: string; error?: string }
      if (!res.ok) { setUploadErr(data.error ?? 'Error al subir archivo'); return }
      if (data.url) setDocUrls(prev => ({ ...prev, [tipo]: data.url }))
      const fieldMap: Record<DocTipo, keyof ProyectoItem> = { foto: 'foto_url', factura: 'factura_url', constancia: 'constancia_pago_url' }
      setForm(prev => ({ ...prev, [fieldMap[tipo]]: data.path }))
    } catch {
      setUploadErr('Error de red al subir')
    } finally {
      setUploading(null)
    }
  }

  async function handleDelete(tipo: DocTipo, path: string) {
    await fetch(`/api/proyectos/${proyectoId}/items/${item.id}/upload`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, path }),
    })
    setDocUrls(prev => { const n = { ...prev }; delete n[tipo]; return n })
    const fieldMap: Record<DocTipo, keyof ProyectoItem> = { foto: 'foto_url', factura: 'factura_url', constancia: 'constancia_pago_url' }
    setForm(prev => ({ ...prev, [fieldMap[tipo]]: null }))
  }

  const fmtSoles = (c: number) => c > 0 ? centavosToSoles(c).toFixed(2) : ''

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-[480px] max-w-full overflow-y-auto p-0">
        <SheetHeader className="px-6 py-4 border-b border-zinc-100">
          <SheetTitle className="text-base">{item.concepto || 'Ítem sin nombre'}</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Concepto */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Concepto</label>
            <input value={form.concepto} onChange={e => setForm(prev => ({ ...prev, concepto: e.target.value }))}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200"
              placeholder="Descripción del ítem..." disabled={!canEdit} />
          </div>

          {/* Cantidad + Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Cantidad</label>
              <input type="number" step="0.01" min="0" value={form.cantidad || ''} onChange={e => setField('cantidad', parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Unidad</label>
              <select value={form.unidad} onChange={e => setForm(prev => ({ ...prev, unidad: e.target.value as ProyectoItem['unidad'] }))}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit}>
                {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>

          {/* Precio unitario + Gasto real */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Precio unitario (S/)</label>
              <input type="number" step="0.01" min="0" value={fmtSoles(form.precio_unitario)} onChange={e => setField('precio_unitario', parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Gasto real (S/) <span className="text-zinc-300 font-normal">autocalculado</span></label>
              <input type="number" step="0.01" min="0" value={fmtSoles(form.gasto_real)} onChange={e => setField('gasto_real', parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit} placeholder="0.00" />
            </div>
          </div>

          {/* Presupuestado + P. Venta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Presupuestado (S/)</label>
              <input type="number" step="0.01" min="0" value={fmtSoles(form.costo_estimado)} onChange={e => setForm(prev => ({ ...prev, costo_estimado: solesToCentavos(parseFloat(e.target.value) || 0) }))}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Precio venta (S/)</label>
              <input type="number" step="0.01" min="0" value={fmtSoles(form.precio_venta)} onChange={e => setForm(prev => ({ ...prev, precio_venta: solesToCentavos(parseFloat(e.target.value) || 0) }))}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit} placeholder="0.00" />
            </div>
          </div>

          {/* Proveedor */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Proveedor</label>
            <select value={form.proveedor_id ?? ''} onChange={e => setForm(prev => ({ ...prev, proveedor_id: e.target.value || null }))}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit}>
              <option value="">— Sin proveedor</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial ?? p.razon_social}</option>)}
            </select>
          </div>

          {/* Tipo comprobante + Estado pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Tipo comprobante</label>
              <select value={form.tipo_comprobante ?? 'pendiente'} onChange={e => setForm(prev => ({ ...prev, tipo_comprobante: e.target.value as ProyectoItem['tipo_comprobante'] }))}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit}>
                {COMPROBANTES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Estado pago</label>
              <select value={form.estado_pago} onChange={e => setForm(prev => ({ ...prev, estado_pago: e.target.value as ProyectoItem['estado_pago'] }))}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit}>
                {Object.entries(ESTADO_PAGO_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha pago */}
          {form.estado_pago === 'pagado' && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha de pago</label>
              <input type="date" value={form.fecha_pago ?? ''} onChange={e => setForm(prev => ({ ...prev, fecha_pago: e.target.value || null }))}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500" disabled={!canEdit} />
            </div>
          )}

          {/* IGV (display) */}
          {form.tipo_comprobante === 'factura' && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-blue-600 font-medium">IGV (18%) calculado</span>
              <span className="text-sm font-bold tabular-nums text-blue-700">{formatMoney(Math.round(form.gasto_real * 0.18))}</span>
            </div>
          )}

          {/* Documentos */}
          <div className="border-t border-zinc-100 pt-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Documentos</h3>
            {uploadErr && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                <X size={12} /> {uploadErr}
                <button onClick={() => setUploadErr(null)} className="ml-auto"><X size={11} /></button>
              </div>
            )}
            <div className="space-y-3">
              {DOC_SECTIONS.map(({ tipo, label, desc, accept, maxSize, field }) => {
                const storedPath = form[field] as string | null
                const url        = docUrls[tipo]
                const isImg      = url && !url.includes('.pdf') && !storedPath?.endsWith('.pdf')
                return (
                  <div key={tipo} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-medium text-zinc-700">{label}</p>
                        <p className="text-[10px] text-zinc-400">{desc}</p>
                      </div>
                      {uploading === tipo && <span className="text-xs text-zinc-400 animate-pulse">Subiendo…</span>}
                    </div>

                    {storedPath ? (
                      <div className="flex items-start gap-2">
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={label} className="h-16 w-16 rounded object-cover border border-zinc-200 shrink-0" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded border border-zinc-200 bg-white shrink-0">
                            <Paperclip size={20} className="text-zinc-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">Ver archivo</a>}
                          {canEdit && (
                            <button onClick={() => handleDelete(tipo, storedPath)} className="mt-1 text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                              <Trash2 size={10} /> Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    ) : canEdit ? (
                      <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors">
                        <input type="file" accept={accept} className="hidden" disabled={uploading !== null}
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (file) { await handleUpload(tipo, file, maxSize); e.target.value = '' }
                          }}
                        />
                        {tipo === 'foto' ? <ImageIcon size={14} /> : <Upload size={14} />}
                        Seleccionar archivo…
                      </label>
                    ) : (
                      <p className="text-xs text-zinc-300 italic">Sin archivo</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-100 bg-white px-6 py-4">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
