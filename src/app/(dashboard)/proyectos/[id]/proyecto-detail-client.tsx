'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Plus, Trash2, Check, X, Pencil,
  FileText, Wallet, TrendingUp, BarChart3, PanelRight,
  ChevronUp, ChevronDown, ChevronsUpDown, Settings2,
  Upload, Paperclip, Image as ImageIcon, Copy,
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

type ColKey = 'cantidad' | 'unidad' | 'proveedor' | 'tipo_comp' | 'varianza' | 'precio_venta' | 'margen_s' | 'margen' | 'igv' | 'estado_pago'
const ALL_OPTIONAL_COLS: ColKey[] = ['cantidad', 'unidad', 'proveedor', 'tipo_comp', 'varianza', 'precio_venta', 'margen_s', 'margen', 'igv', 'estado_pago']
const COL_LABELS: Record<ColKey, string> = {
  cantidad:     'Cantidad',
  unidad:       'Unidad',
  proveedor:    'Proveedor',
  tipo_comp:    'Tipo comp.',
  varianza:     'Varianza S/',
  precio_venta: 'P. Venta',
  margen_s:     'Margen S/',
  margen:       'Margen %',
  igv:          'IGV',
  estado_pago:  'Estado pago',
}

type SortDir = 'asc' | 'desc'
type SortableCol = 'costo_estimado' | 'gasto_real' | 'varianza' | 'precio_venta' | 'margen_s' | 'margen' | 'igv'

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

const STATUS_CONFIG: Record<ItemStatus, { row: string }> = {
  ejecutado:    { row: ''            },
  sobregasto:   { row: 'bg-red-50'  },
  ahorro:       { row: 'bg-blue-50' },
  extra:        { row: 'bg-amber-50'},
  no_ejecutado: { row: ''           },
  vacio:        { row: ''           },
}

type EstadoItem = 'presupuestado' | 'en_ejecucion' | 'ejecutado' | 'cancelado'
const ESTADO_ITEM_OPTIONS: { value: EstadoItem; label: string }[] = [
  { value: 'presupuestado', label: 'Presupuestado' },
  { value: 'en_ejecucion',  label: 'En ejecución' },
  { value: 'ejecutado',     label: 'Ejecutado' },
  { value: 'cancelado',     label: 'Cancelado' },
]
const ESTADO_ITEM_CFG: Record<EstadoItem, { cls: string }> = {
  presupuestado: { cls: 'bg-zinc-100 text-zinc-600' },
  en_ejecucion:  { cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  ejecutado:     { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  cancelado:     { cls: 'bg-red-50 text-red-700 border border-red-200' },
}

// ─── Fase de proyecto ─────────────────────────────────────────────────────────

type FaseProyecto = 'cotizacion' | 'aprobado' | 'ejecucion' | 'finalizado'

const FASES: { value: FaseProyecto; label: string }[] = [
  { value: 'cotizacion', label: 'Cotización' },
  { value: 'aprobado',   label: 'Aprobado' },
  { value: 'ejecucion',  label: 'En ejecución' },
  { value: 'finalizado', label: 'Finalizado' },
]

const FASE_DESCRIPTIONS: Record<FaseProyecto, string> = {
  cotizacion: 'El proyecto vuelve a fase de cotización.',
  aprobado:   'El cliente aprobó la propuesta. Los costos presupuestados quedarán como referencia.',
  ejecucion:  'El proyecto entra en ejecución. Se habilitará el registro de gastos reales.',
  finalizado: 'El proyecto se marcará como finalizado. La tabla quedará en solo lectura.',
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
  const [kpiView, setKpiView] = useState<'presupuesto' | 'real'>(() => {
    if (typeof window === 'undefined') return 'presupuesto'
    try { return (localStorage.getItem('kivo_project_kpi_view') as 'presupuesto' | 'real' | null) ?? 'presupuesto' } catch { return 'presupuesto' }
  })

  function switchKpiView(v: 'presupuesto' | 'real') {
    setKpiView(v)
    try { localStorage.setItem('kivo_project_kpi_view', v) } catch { /* ignore */ }
  }

  const [fase, setFase]           = useState<FaseProyecto>((proyecto.fase as FaseProyecto) ?? 'cotizacion')
  const [faseTarget, setFaseTarget] = useState<FaseProyecto | null>(null)
  const [savingFase, setSavingFase] = useState(false)
  const [successMsg, setSuccessMsg]       = useState<string | null>(null)
  const [showMigrationDialog, setShowMigrationDialog] = useState(false)
  const [migrando, setMigrando]           = useState(false)
  const [editingNombre, setEditingNombre] = useState(false)
  const [nombreLocal, setNombreLocal]     = useState(proyecto.nombre)
  const nombreInputRef                    = useRef<HTMLInputElement>(null)

  // Sync local fase state when proyecto.fase is updated (e.g. via sidebar selector)
  useEffect(() => { setFase((proyecto.fase as FaseProyecto) ?? 'cotizacion') }, [proyecto.fase])
  useEffect(() => { setNombreLocal(proyecto.nombre) }, [proyecto.nombre])
  useEffect(() => {
    if (editingNombre) { nombreInputRef.current?.focus(); nombreInputRef.current?.select() }
  }, [editingNombre])

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [bulkOperating, setBulkOperating]     = useState(false)

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })
  }

  function toggleSelectAll() {
    setSelectedIds(prev =>
      prev.size === sortedItems.length && sortedItems.length > 0
        ? new Set()
        : new Set(sortedItems.map(i => i.id))
    )
  }

  async function duplicateSelected() {
    if (bulkOperating) return
    setBulkOperating(true)
    const toDuplicate = items.filter(i => selectedIds.has(i.id))
    const tempItems = toDuplicate.map((item, idx) => ({
      ...item,
      id: crypto.randomUUID(),
      estado: 'presupuestado' as const,
      gasto_real: 0,
      precio_unitario: 0,
      estado_pago: 'pendiente' as const,
      fecha_pago: null,
      foto_url: null,
      factura_url: null,
      constancia_pago_url: null,
      sort_order: items.length + idx,
      created_at: new Date().toISOString(),
    }))
    const tempIds = tempItems.map(t => t.id)
    setItems(prev => [...prev, ...tempItems])
    setSelectedIds(new Set())
    try {
      const responses = await Promise.all(
        toDuplicate.map((item, idx) =>
          fetch(`/api/proyectos/${proyecto.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              concepto: item.concepto, unidad: item.unidad, proveedor_id: item.proveedor_id,
              costo_estimado: item.costo_estimado, precio_venta: item.precio_venta,
              gasto_real: 0, cantidad: item.cantidad, precio_unitario: item.precio_unitario,
              tipo_comprobante: item.tipo_comprobante, estado_pago: 'pendiente',
              estado: 'presupuestado', sort_order: items.length + idx,
            }),
          }).then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<ProyectoItem> })
        )
      )
      setItems(prev => {
        const base = prev.filter(i => !tempIds.includes(i.id))
        return [...base, ...responses]
      })
    } catch {
      setItems(prev => prev.filter(i => !tempIds.includes(i.id)))
      showError('Error al duplicar ítems')
    } finally {
      setBulkOperating(false)
    }
  }

  async function deleteSelected() {
    if (bulkOperating) return
    setBulkOperating(true)
    const toDelete = Array.from(selectedIds)
    const snapshot = items
    setItems(prev => prev.filter(i => !toDelete.includes(i.id)))
    setSelectedIds(new Set())
    setShowBulkDeleteDialog(false)
    try {
      const results = await Promise.all(
        toDelete.map(id => fetch(`/api/proyectos/${proyecto.id}/items/${id}`, { method: 'DELETE' }))
      )
      if (results.some(r => !r.ok)) {
        setItems(snapshot)
        showError('Error al eliminar algunos ítems')
      }
    } catch {
      setItems(snapshot)
      showError('Error al eliminar ítems')
    } finally {
      setBulkOperating(false)
    }
  }

  async function saveFase(newFase: FaseProyecto) {
    setSavingFase(true)
    const prevFase = fase
    setFase(newFase)
    setProyecto(prev => ({ ...prev, fase: newFase }))
    setFaseTarget(null)
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: newFase }),
      })
      if (!res.ok) {
        setFase(prevFase)
        setProyecto(prev => ({ ...prev, fase: prevFase }))
        showError('Error al cambiar la fase del proyecto')
      } else if (newFase === 'ejecucion') {
        try {
          const key = `kivo_migration_dialog_${proyecto.id}`
          const hasSeen = localStorage.getItem(key)
          const hasItemsToMigrate = items.some(i => i.gasto_real === 0 && i.costo_estimado > 0)
          if (!hasSeen && hasItemsToMigrate) setShowMigrationDialog(true)
        } catch { /* ignore */ }
      }
    } catch {
      setFase(prevFase)
      setProyecto(prev => ({ ...prev, fase: prevFase }))
      showError('Error de red al cambiar la fase')
    } finally {
      setSavingFase(false)
    }
  }

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
  // fase-based editing rules
  const canEditRow  = canEdit && fase !== 'finalizado'
  const realDisabled = fase === 'cotizacion' || fase === 'aprobado'

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
          case 'margen_s':       return item.precio_venta - item.costo_estimado
          case 'margen':         return item.precio_venta > 0 && item.costo_estimado > 0 ? ((item.precio_venta - item.costo_estimado) / item.precio_venta) * 100 : -Infinity
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
      margen:         acc.margen         + (item.precio_venta - item.costo_estimado),
      varianza:       acc.varianza       + varianza,
    }
  }, { costo_estimado: 0, gasto_real: 0, precio_venta: 0, igv: 0, margen: 0, varianza: 0 })

  const avancePct   = totals.costo_estimado > 0 ? Math.min((totals.gasto_real / totals.costo_estimado) * 100, 999) : null
  const margenPct   = totals.precio_venta > 0 ? (totals.margen / totals.precio_venta) * 100 : null
  const varianzaPct = totals.costo_estimado > 0 ? (totals.varianza / totals.costo_estimado) * 100 : null

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

  // ── Nombre inline save ────────────────────────────────────────────────────────

  async function saveNombre(newNombre: string) {
    const trimmed = newNombre.trim()
    setEditingNombre(false)
    if (!trimmed || trimmed === proyecto.nombre) {
      setNombreLocal(proyecto.nombre)
      return
    }
    const prevNombre = proyecto.nombre
    setProyecto(prev => ({ ...prev, nombre: trimmed }))
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: trimmed }),
      })
      if (!res.ok) {
        setProyecto(prev => ({ ...prev, nombre: prevNombre }))
        setNombreLocal(prevNombre)
        showError('Error al guardar el nombre')
      } else {
        showSuccess('Nombre guardado')
      }
    } catch {
      setProyecto(prev => ({ ...prev, nombre: prevNombre }))
      setNombreLocal(prevNombre)
      showError('Error de red al guardar el nombre')
    }
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
      // Auto-advance estado based on gasto_real vs costo_estimado
      if (item.estado !== 'cancelado' && item.costo_estimado > 0 && gr > 0) {
        fields.estado = gr < item.costo_estimado ? 'en_ejecucion' : 'ejecutado'
      }
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
      estado: 'presupuestado',
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

  function onProveedorCreated(p: Proveedor) {
    setProveedores(prev => [...prev, p].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
  }

  async function handleFinalizar() {
    setFinalizando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 'finalizado' }),
      })
      if (res.ok) {
        setFase('finalizado')
        setProyecto(prev => ({ ...prev, fase: 'finalizado' }))
        showSuccess('Proyecto marcado como finalizado')
      }
    } finally {
      setFinalizando(false)
      setShowFinalizarDialog(false)
    }
  }

  async function handleMigracion() {
    setMigrando(true)
    try { localStorage.setItem(`kivo_migration_dialog_${proyecto.id}`, '1') } catch { /* ignore */ }
    const toMigrate = items.filter(i => i.gasto_real === 0 && i.costo_estimado > 0)
    setItems(prev => prev.map(i =>
      i.gasto_real === 0 && i.costo_estimado > 0
        ? { ...i, gasto_real: i.costo_estimado, estado: 'en_ejecucion' as EstadoItem, precio_unitario: i.cantidad > 0 ? Math.round(i.costo_estimado / i.cantidad) : i.precio_unitario }
        : i
    ))
    setShowMigrationDialog(false)
    try {
      await Promise.all(toMigrate.map(i =>
        fetch(`/api/proyectos/${proyecto.id}/items/${i.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gasto_real: i.costo_estimado, estado: 'en_ejecucion', precio_unitario: i.cantidad > 0 ? Math.round(i.costo_estimado / i.cantidad) : i.precio_unitario }),
        }).then(r => { if (!r.ok) throw new Error() })
      ))
      showSuccess(`${toMigrate.length} ítem${toMigrate.length !== 1 ? 's' : ''} copiado${toMigrate.length !== 1 ? 's' : ''} al gasto real`)
    } catch {
      setItems(prev => prev.map(i => {
        const orig = toMigrate.find(o => o.id === i.id)
        return orig ? { ...i, gasto_real: orig.gasto_real, estado: orig.estado, precio_unitario: orig.precio_unitario } : i
      }))
      showError('Error al migrar los ítems')
    } finally {
      setMigrando(false)
    }
  }

  function dismissMigration() {
    try { localStorage.setItem(`kivo_migration_dialog_${proyecto.id}`, '1') } catch { /* ignore */ }
    setShowMigrationDialog(false)
  }

  // ── Column count helper ──────────────────────────────────────────────────────

  // Total columns including fixed ones
  const colCount = 4 /* concepto+presupuestado+real+estado */ +
    (canEditRow ? 1 : 0) /* checkbox */ +
    (show('cantidad') ? 1 : 0) + (show('unidad') ? 1 : 0) + (show('proveedor') ? 1 : 0) +
    (show('tipo_comp') ? 1 : 0) + (show('varianza') ? 1 : 0) + (show('precio_venta') ? 1 : 0) +
    (show('margen_s') ? 1 : 0) + (show('margen') ? 1 : 0) + (show('igv') ? 1 : 0) + (show('estado_pago') ? 1 : 0) +
    (canEditRow ? 1 : 0) /* actions */

  // ── KPI cards ────────────────────────────────────────────────────────────────

  const totalCotizado     = proyecto.subtotal_proyecto > 0 ? proyecto.subtotal_proyecto : totals.precio_venta
  const margenEstimadoMto = totalCotizado - totals.costo_estimado
  const margenEstimadoPct = totalCotizado > 0 ? (margenEstimadoMto / totalCotizado) * 100 : null
  const varianzaAhorro    = totals.costo_estimado - totals.gasto_real  // positive = ahorro
  const margenRealMto     = totalCotizado - totals.gasto_real
  const margenRealPct     = totalCotizado > 0 ? (margenRealMto / totalCotizado) * 100 : null
  const igvReal           = totals.igv

  const kpiCards = (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 gap-0.5">
          {(['presupuesto', 'real'] as const).map((v) => (
            <button
              key={v}
              onClick={() => switchKpiView(v)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                kpiView === v
                  ? 'bg-white shadow-sm text-zinc-900 border border-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {v === 'presupuesto' ? 'Presupuesto' : 'Ejecución Real'}
            </button>
          ))}
        </div>
      </div>

      {/* Group: Presupuesto */}
      {kpiView === 'presupuesto' && (
        <div key="presupuesto" className="grid gap-4 grid-cols-2 xl:grid-cols-4 animate-in fade-in duration-150">
          <KpiCard
            label="Total cotizado" icon={<FileText size={15} className="text-zinc-400" />}
            value={totalCotizado > 0 ? formatMoney(totalCotizado) : '—'}
            sub="Propuesta al cliente"
          />
          <KpiCard
            label="Costo estimado" icon={<Wallet size={15} className="text-zinc-400" />}
            value={totals.costo_estimado > 0 ? formatMoney(totals.costo_estimado) : '—'}
            sub="Suma de ítems presupuestados"
          />
          <KpiCard
            label="Margen estimado S/"
            icon={<TrendingUp size={15} className={margenEstimadoMto >= 0 ? 'text-emerald-500' : 'text-red-500'} />}
            value={totalCotizado > 0 || totals.costo_estimado > 0 ? formatMoney(margenEstimadoMto) : '—'}
            sub={margenEstimadoPct !== null ? `${margenEstimadoPct.toFixed(1)}% sobre el cotizado` : 'Sin datos'}
            cardBg={margenEstimadoMto >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}
          />
          <KpiCard
            label="Margen estimado %"
            icon={<BarChart3 size={15} className={
              margenEstimadoPct === null ? 'text-zinc-400'
              : margenEstimadoPct < 15    ? 'text-red-500'
              : margenEstimadoPct < 30    ? 'text-amber-500'
              : 'text-emerald-500'
            } />}
            value={margenEstimadoPct !== null ? `${margenEstimadoPct.toFixed(1)}%` : '—'}
            sub={margenEstimadoPct !== null
              ? margenEstimadoPct >= 30 ? 'Margen saludable'
              : margenEstimadoPct >= 15 ? 'Margen ajustado'
              : 'Margen en riesgo'
              : 'Sin datos suficientes'
            }
            progress={margenEstimadoPct !== null ? Math.max(0, Math.min(margenEstimadoPct, 100)) : undefined}
            progressColor={
              margenEstimadoPct === null ? 'bg-zinc-300'
              : margenEstimadoPct < 0   ? 'bg-red-500'
              : margenEstimadoPct < 15  ? 'bg-red-400'
              : margenEstimadoPct < 30  ? 'bg-amber-400'
              : 'bg-emerald-500'
            }
            cardBg={
              margenEstimadoPct === null ? ''
              : margenEstimadoPct < 15   ? 'bg-red-50 border-red-200'
              : margenEstimadoPct < 30   ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
            }
          />
        </div>
      )}

      {/* Group: Ejecución Real */}
      {kpiView === 'real' && (
        <div key="real" className="grid gap-4 grid-cols-2 xl:grid-cols-4 animate-in fade-in duration-150">
          <KpiCard
            label="Gastado real" icon={<Wallet size={15} className="text-zinc-400" />}
            value={totals.gasto_real > 0 ? formatMoney(totals.gasto_real) : '—'}
            sub={avancePct !== null ? `${avancePct.toFixed(0)}% del presupuesto ejecutado` : 'Sin gastos aún'}
            progress={avancePct !== null ? Math.min(avancePct, 100) : undefined}
            progressColor={avancePct && avancePct > 100 ? 'bg-red-500' : 'bg-blue-500'}
          />
          <KpiCard
            label="Varianza"
            icon={<TrendingUp size={15} className={varianzaAhorro >= 0 ? 'text-emerald-500' : 'text-red-500'} />}
            value={totals.costo_estimado > 0 ? formatMoney(Math.abs(varianzaAhorro)) : '—'}
            sub={totals.costo_estimado > 0
              ? varianzaAhorro > 0 ? `Ahorro de ${formatMoney(varianzaAhorro)}`
              : varianzaAhorro < 0 ? `Sobregasto de ${formatMoney(Math.abs(varianzaAhorro))}`
              : 'Sin varianza'
              : 'vs costo presupuestado'
            }
            cardBg={totals.costo_estimado === 0 ? '' : varianzaAhorro >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}
          />
          <KpiCard
            label="Margen real S/"
            icon={<TrendingUp size={15} className={margenRealMto >= 0 ? 'text-emerald-500' : 'text-red-500'} />}
            value={totalCotizado > 0 || totals.gasto_real > 0 ? formatMoney(margenRealMto) : '—'}
            sub={margenRealPct !== null ? `${margenRealPct.toFixed(1)}% actual` : 'Sin datos'}
            cardBg={margenRealMto >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}
          />
          <KpiCard
            label="IGV real" icon={<BarChart3 size={15} className="text-zinc-400" />}
            value={igvReal > 0 ? formatMoney(igvReal) : '—'}
            sub="Crédito fiscal acumulado"
            progress={igvReal > 0 ? 100 : undefined}
            progressColor="bg-amber-400"
          />
        </div>
      )}
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
              Se marcará el proyecto como <strong>Finalizado</strong>. La tabla quedará en
              solo lectura pero podrás seguir consultando el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFinalizarDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleFinalizar} disabled={finalizando}>
              {finalizando ? 'Guardando…' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fase change confirmation */}
      <Dialog open={!!faseTarget} onOpenChange={open => { if (!open) setFaseTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar fase a {FASES.find(f => f.value === faseTarget)?.label}</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm mt-1">
              {faseTarget ? FASE_DESCRIPTIONS[faseTarget] : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFaseTarget(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => faseTarget && saveFase(faseTarget)} disabled={savingFase}>
              {savingFase ? 'Guardando…' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar {selectedIds.size} ítem{selectedIds.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm mt-1">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowBulkDeleteDialog(false)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={bulkOperating}>
              {bulkOperating ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Migration dialog */}
      <Dialog open={showMigrationDialog} onOpenChange={v => { if (!v) dismissMigration() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Copiar presupuesto a gasto real?</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm mt-1">
              El proyecto entra en ejecución. Hay{' '}
              <strong>{items.filter(i => i.gasto_real === 0 && i.costo_estimado > 0).length} ítems</strong>{' '}
              con costo presupuestado pero sin gasto real registrado.
              <br /><br />
              ¿Quieres copiar el costo presupuestado como punto de partida del gasto real? Podrás ajustar cada valor después.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={dismissMigration}>No, después</Button>
            <Button size="sm" onClick={handleMigracion} disabled={migrando}>
              {migrando ? 'Copiando…' : 'Sí, copiar presupuestados'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success banner */}
      {successMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg text-sm text-emerald-700 max-w-lg">
          <Check size={15} className="shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-600"><X size={14} /></button>
        </div>
      )}

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
                {editingNombre ? (
                  <input
                    ref={nombreInputRef}
                    value={nombreLocal}
                    onChange={e => setNombreLocal(e.target.value)}
                    onBlur={e => saveNombre(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') { setNombreLocal(proyecto.nombre); setEditingNombre(false) }
                    }}
                    className="text-2xl font-bold tracking-tight text-zinc-900 bg-transparent border-b-2 border-blue-400 outline-none min-w-0 w-full max-w-xl"
                  />
                ) : (
                  <h1
                    className="text-2xl font-bold tracking-tight text-zinc-900 group/nombre flex items-center gap-2"
                    onDoubleClick={() => canEdit && setEditingNombre(true)}
                  >
                    {proyecto.nombre}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setEditingNombre(true) }}
                        className="text-zinc-300 hover:text-zinc-600 transition-colors opacity-0 group-hover/nombre:opacity-100"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </h1>
                )}
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

          {/* Fase stepper */}
          <FaseStepper fase={fase} onStepClick={f => { if (canEdit && f !== fase) setFaseTarget(f) }} />

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
                {canEditRow && (
                  <>
                    <Button size="sm" onClick={() => addItem('concepto')} disabled={adding} className="h-7 px-3 text-xs">
                      <Plus size={12} className="mr-1" /> Agregar ítem
                    </Button>
                    <Button size="sm" variant="outline" disabled={adding}
                      className="h-7 px-3 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => addItem('gasto_real')}>
                      <Plus size={12} className="mr-1" /> Gasto extra
                    </Button>
                  </>
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

            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-5 py-2.5 bg-zinc-900 text-white text-sm">
                <span className="font-medium">{selectedIds.size} ítem{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                <span className="text-zinc-500">·</span>
                <button onClick={duplicateSelected} disabled={bulkOperating}
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 transition-colors disabled:opacity-50">
                  <Copy size={12} /> Duplicar
                </button>
                {canDelete && (
                  <button onClick={() => setShowBulkDeleteDialog(true)} disabled={bulkOperating}
                    className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50">
                    <Trash2 size={12} /> Eliminar
                  </button>
                )}
                <button onClick={() => setSelectedIds(new Set())}
                  className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors">
                  <X size={12} /> Cancelar
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs font-medium text-zinc-500">
                    {canEditRow && (
                      <th className="pl-4 pr-2 py-2.5 w-8">
                        <input type="checkbox"
                          checked={sortedItems.length > 0 && selectedIds.size === sortedItems.length}
                          ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < sortedItems.length }}
                          onChange={toggleSelectAll}
                          className="h-3.5 w-3.5 rounded accent-zinc-900 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-4 py-2.5 text-left min-w-[240px]">Concepto</th>
                    {show('cantidad') && <th className="px-3 py-2.5 text-right w-20">Cantidad</th>}
                    {show('unidad') && <th className="px-3 py-2.5 text-left w-20">Unidad</th>}
                    {show('proveedor') && <th className="px-3 py-2.5 text-left w-36">Proveedor</th>}
                    {show('tipo_comp') && <th className="px-3 py-2.5 text-left w-28">Tipo comp.</th>}
                    <SortHeader col="costo_estimado" label="Presupuestado" sort={sortState} onSort={cycleSort} className="w-28" />
                    <SortHeader col="gasto_real" label="Real" sort={sortState} onSort={cycleSort} className="w-24" />
                    {show('varianza') && <SortHeader col="varianza" label="Varianza S/" sort={sortState} onSort={cycleSort} className="w-24" />}
                    <th className="px-3 py-2.5 text-left w-32">Estado ítem</th>
                    {show('precio_venta') && <SortHeader col="precio_venta" label="P. Venta" sort={sortState} onSort={cycleSort} className="w-28" />}
                    {show('margen_s') && <SortHeader col="margen_s" label="Margen S/" sort={sortState} onSort={cycleSort} className="w-24" />}
                    {show('margen') && <SortHeader col="margen" label="Margen %" sort={sortState} onSort={cycleSort} className="w-20" />}
                    {show('igv') && <SortHeader col="igv" label="IGV" sort={sortState} onSort={cycleSort} className="w-24" />}
                    {show('estado_pago') && <th className="px-3 py-2.5 text-left w-32">Estado pago</th>}
                    {canEditRow && <th className="px-3 py-2.5 w-16" />}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.length === 0 && !canEditRow && (
                    <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-zinc-400">Sin ítems aún.</td></tr>
                  )}
                  {sortedItems.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      proveedores={proveedores}
                      editingCell={editingCell}
                      saving={saving}
                      canEdit={canEditRow}
                      realDisabled={realDisabled}
                      show={show}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={toggleSelect}
                      onStartEdit={(id, field) => canEditRow && setEditingCell({ id, field })}
                      onSave={saveCell}
                      onSaveFields={saveFields}
                      onProveedorCreated={onProveedorCreated}
                      onOpenSheet={() => setEditingSheet(item)}
                      proyectoId={proyecto.id}
                    />
                  ))}
                  {canEditRow && (
                    <tr className="border-b border-zinc-100 cursor-text hover:bg-zinc-50/50" onClick={() => addItem('concepto')}>
                      {canEditRow && <td className="pl-4 pr-2 py-3" />}
                      <td colSpan={colCount - 1} className="px-4 py-3">
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
                      {canEditRow && <td className="pl-4 pr-2 py-3" />}
                      <td className="px-4 py-3 text-xs font-bold text-zinc-600 uppercase tracking-wide">Totales</td>
                      {show('cantidad') && <td className="px-3 py-3" />}
                      {show('unidad') && <td className="px-3 py-3" />}
                      {show('proveedor') && <td className="px-3 py-3" />}
                      {show('tipo_comp') && <td className="px-3 py-3" />}
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
                      <td className="px-3 py-3" />
                      {show('precio_venta') && (
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-zinc-800 text-sm">
                          {totals.precio_venta > 0 ? formatMoney(totals.precio_venta) : '—'}
                        </td>
                      )}
                      {show('margen_s') && (
                        <td className={cn('px-3 py-3 text-right font-bold tabular-nums text-sm', totals.margen < 0 ? 'text-red-600' : totals.margen > 0 ? 'text-emerald-700' : 'text-zinc-400')}>
                          {totals.precio_venta > 0 || totals.costo_estimado > 0 ? formatMoney(totals.margen) : '—'}
                        </td>
                      )}
                      {show('margen') && (
                        <td className={cn('px-3 py-3 text-right font-bold tabular-nums text-sm', margenPct === null ? 'text-zinc-400' : totals.margen < 0 ? 'text-red-600' : 'text-emerald-700')}>
                          {totals.precio_venta > 0 && totals.costo_estimado > 0 ? `${margenPct?.toFixed(0)}%` : '—'}
                        </td>
                      )}
                      {show('igv') && (
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-blue-700 text-sm">
                          {totals.igv > 0 ? formatMoney(totals.igv) : '—'}
                        </td>
                      )}
                      {show('estado_pago') && <td className="px-3 py-3" />}
                      {canEditRow && <td className="px-2 py-3" />}
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
  realDisabled: boolean
  show: (col: ColKey) => boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onStartEdit: (id: string, field: string) => void
  onSave: (id: string, field: string, value: unknown, silent?: boolean) => Promise<void>
  onSaveFields: (id: string, fields: Record<string, unknown>) => Promise<void>
  onProveedorCreated: (p: Proveedor) => void
  onOpenSheet: () => void
  proyectoId: string
}

function ItemRow({
  item, proveedores, editingCell, saving, canEdit, realDisabled, show,
  isSelected, onToggleSelect, onStartEdit, onSave, onSaveFields,
  onProveedorCreated, onOpenSheet,
}: ItemRowProps) {
  const isEditing = (f: string) => editingCell?.id === item.id && editingCell.field === f
  const isSaving  = saving === item.id
  const status    = getItemStatus(item)
  const cfg       = STATUS_CONFIG[status]
  const igv       = item.tipo_comprobante === 'factura' ? Math.round(item.gasto_real * 0.18) : 0
  const margenAmt    = item.precio_venta - item.costo_estimado
  const margenRowPct = (item.precio_venta > 0 && item.costo_estimado > 0) ? (margenAmt / item.precio_venta) * 100 : null
  const varianza     = item.costo_estimado > 0 ? item.gasto_real - item.costo_estimado : 0
  const isCancelado  = item.estado === 'cancelado'

  return (
    <tr className={cn('group border-b border-zinc-100 transition-colors', cfg.row, isSelected && 'bg-blue-50/60', isSaving && 'opacity-50', isCancelado && 'line-through text-zinc-400 opacity-60')}>

      {/* Checkbox */}
      {canEdit && (
        <td className="pl-4 pr-2 py-2.5" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(item.id)}
            className="h-3.5 w-3.5 rounded accent-zinc-900 cursor-pointer" />
        </td>
      )}

      {/* Concepto */}
      <td className="px-4 py-2.5" onClick={() => onStartEdit(item.id, 'concepto')}>
        {isEditing('concepto') ? (
          <InlineInput defaultValue={item.concepto} onSave={(v, silent) => onSave(item.id, 'concepto', v, silent)} placeholder="Describe el ítem..." />
        ) : (
          <span className={cn('block text-sm whitespace-normal break-words line-clamp-2', canEdit && 'cursor-text', !item.concepto && 'text-zinc-300 italic')}>
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
      {realDisabled ? (
        <td className="px-3 py-2.5 text-right cursor-not-allowed" title="Disponible en ejecución">
          <span className="text-sm tabular-nums text-zinc-300 opacity-50">
            {item.gasto_real > 0 ? formatMoney(item.gasto_real) : '—'}
          </span>
        </td>
      ) : (
        <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'gasto_real')}>
          {isEditing('gasto_real') ? (
            <InlineMoneyInput defaultValue={centavosToSoles(item.gasto_real)} onSave={v => onSave(item.id, 'gasto_real', v)} />
          ) : (
            <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text', item.gasto_real === 0 && 'text-zinc-300')}>
              {item.gasto_real > 0 ? formatMoney(item.gasto_real) : '—'}
            </span>
          )}
        </td>
      )}

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
        {canEdit ? (
          <select
            value={item.estado ?? 'presupuestado'}
            onChange={e => onSave(item.id, 'estado', e.target.value as EstadoItem)}
            onClick={e => e.stopPropagation()}
            className={cn(
              'rounded px-2 py-0.5 text-[10px] font-medium cursor-pointer border-0 outline-none focus:ring-1 focus:ring-zinc-300',
              ESTADO_ITEM_CFG[item.estado ?? 'presupuestado'].cls,
            )}
          >
            {ESTADO_ITEM_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium', ESTADO_ITEM_CFG[item.estado ?? 'presupuestado'].cls)}>
            {ESTADO_ITEM_OPTIONS.find(o => o.value === (item.estado ?? 'presupuestado'))?.label}
          </span>
        )}
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

      {/* Margen S/ = precio_venta − costo_estimado */}
      {show('margen_s') && (
        <td className="px-3 py-2.5 text-right">
          {item.precio_venta === 0 && item.costo_estimado === 0 ? (
            <span className="text-sm text-zinc-300">—</span>
          ) : (
            <span className={cn('text-sm tabular-nums font-medium', margenAmt >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {formatMoney(margenAmt)}
            </span>
          )}
        </td>
      )}

      {/* Margen % */}
      {show('margen') && (
        <td className="px-3 py-2.5 text-right">
          {margenRowPct === null ? (
            <span className="text-sm text-zinc-300">—</span>
          ) : (
            <span className={cn('text-sm tabular-nums font-medium', margenRowPct < 0 ? 'text-red-600' : 'text-emerald-700')}>
              {margenRowPct.toFixed(0)}%
            </span>
          )}
        </td>
      )}

      {/* IGV */}
      {show('igv') && (
        <td className={cn('px-3 py-2.5 text-right', realDisabled && 'cursor-not-allowed opacity-50')} title={realDisabled ? 'Disponible en ejecución' : undefined}>
          {!realDisabled && item.tipo_comprobante === 'factura' ? (
            <span className="text-sm tabular-nums text-blue-700">{formatMoney(igv)}</span>
          ) : item.gasto_real > 0 && !realDisabled ? (
            <span className="text-sm text-zinc-300">S/ 0</span>
          ) : (
            <span className="text-sm text-zinc-300">—</span>
          )}
        </td>
      )}

      {/* Estado pago */}
      {show('estado_pago') && (
        <td className={cn('px-3 py-2.5', realDisabled && 'cursor-not-allowed')} title={realDisabled ? 'Disponible en ejecución' : undefined}>
          <InlineEstadoPago item={item} canEdit={canEdit && !realDisabled} onSave={(ep, fp) => onSaveFields(item.id, { estado_pago: ep, fecha_pago: fp ?? null })} />
        </td>
      )}

      {/* Acciones */}
      {canEdit && (
        <td className="px-2 py-2">
          <Button variant="ghost" size="sm" onClick={onOpenSheet}
            title="Ver descripción, imagen y adjuntos"
            className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-900 gap-1">
            <FileText size={13} /> Detalle
          </Button>
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
  const [search, setSearch]         = useState('')
  const [crearOpen, setCrearOpen]   = useState(false)
  const [crearRazon, setCrearRazon] = useState('')
  const [busy, setBusy]             = useState(false)
  const ref                         = useRef<HTMLDivElement>(null)
  const crearOpenRef                = useRef(false)

  const filtered = proveedores.filter(p =>
    p.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    (p.nombre_comercial ?? '').toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!crearOpenRef.current && !ref.current?.contains(e.target as Node)) onSave(value)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [value, onSave])

  async function createProv() {
    if (!crearRazon.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/proveedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'persona_natural', razon_social: crearRazon.trim() }) })
      if (res.ok) {
        const p = await res.json() as Proveedor
        onCreated(p)
        onSave(p.id)
        crearOpenRef.current = false
        setCrearOpen(false)
      }
    } finally { setBusy(false) }
  }

  function closeCrear() {
    crearOpenRef.current = false
    setCrearOpen(false)
    setCrearRazon('')
  }

  return (
    <>
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
            <button className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1.5"
              onMouseDown={() => { crearOpenRef.current = true; setCrearRazon(search); setCrearOpen(true) }}>
              <Plus size={12} /> Crear &ldquo;{search || 'nuevo proveedor'}&rdquo;
            </button>
          </div>
        </div>
      </div>

      <Dialog open={crearOpen} onOpenChange={v => { if (!v) closeCrear() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Razón social</label>
            <input autoFocus value={crearRazon} onChange={e => setCrearRazon(e.target.value)}
              placeholder="Razón social del proveedor..."
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              onKeyDown={e => { if (e.key === 'Enter') createProv() }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={closeCrear}>Cancelar</Button>
            <Button size="sm" onClick={createProv} disabled={!crearRazon.trim() || busy}>
              {busy ? 'Creando…' : 'Crear proveedor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

// ─── Fase Stepper ─────────────────────────────────────────────────────────────

function FaseStepper({ fase, onStepClick }: {
  fase: FaseProyecto
  onStepClick: (f: FaseProyecto) => void
}) {
  const currentIdx = FASES.findIndex(f => f.value === fase)

  return (
    <nav className="flex items-center gap-0">
      {FASES.map((step, idx) => {
        const isPast    = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isFuture  = idx > currentIdx

        return (
          <div key={step.value} className="flex items-center">
            <button
              onClick={() => onStepClick(step.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                isPast    && 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                isCurrent && 'bg-blue-600 text-white shadow-sm',
                isFuture  && 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200',
              )}
            >
              {isPast && <Check size={11} strokeWidth={3} />}
              {step.label}
            </button>
            {idx < FASES.length - 1 && (
              <div className={cn('mx-1 h-px w-6', idx < currentIdx ? 'bg-emerald-300' : 'bg-zinc-200')} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
