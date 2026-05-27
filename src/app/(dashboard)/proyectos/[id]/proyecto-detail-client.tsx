'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Pencil, Plus, Trash2, Check, X,
  FileText, Wallet, TrendingUp, BarChart2, PanelRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { ProyectoSidebar } from './proyecto-sidebar'
import {
  ChartPresupuestoVsReal, ChartComposicion, ChartCascada, ChartBurnRate,
} from './proyecto-charts'
import { cn, formatMoney, centavosToSoles, solesToCentavos } from '@/lib/utils'
import type { ProyectoData, ProyectoItem, Proveedor, GastoFecha } from './page'

// ─── Constants ─────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
  activo:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  en_pausa: 'bg-amber-50 text-amber-700 border-amber-200',
  cerrado:  'bg-zinc-100 text-zinc-500 border-zinc-200',
}
const ESTADO_LABEL: Record<string, string> = { activo: 'Activo', en_pausa: 'En pausa', cerrado: 'Cerrado' }

const UNIDADES = [
  { value: 'global', label: 'Global' }, { value: 'unid', label: 'Unid.' },
  { value: 'hora',   label: 'Hora' },   { value: 'm2',   label: 'm²' },
  { value: 'kg',     label: 'kg' },     { value: 'dia',  label: 'Día' },
  { value: 'otro',   label: 'Otro' },
]

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

const STATUS_CONFIG: Record<ItemStatus, {
  label: string; badge: string; row: string; strikethrough: boolean
}> = {
  ejecutado:    { label: 'EJECUTADO',    badge: 'bg-emerald-500 text-white',  row: '',              strikethrough: false },
  sobregasto:   { label: 'SOBREGASTO',   badge: 'bg-red-500 text-white',      row: 'bg-red-50',     strikethrough: false },
  ahorro:       { label: 'AHORRO',       badge: 'bg-blue-500 text-white',     row: 'bg-blue-50',    strikethrough: false },
  extra:        { label: 'EXTRA',        badge: 'bg-amber-500 text-white',    row: 'bg-amber-50',   strikethrough: false },
  no_ejecutado: { label: 'NO EJECUTADO', badge: 'bg-zinc-400 text-white',     row: 'opacity-60',    strikethrough: true },
  vacio:        { label: '',             badge: '',                           row: '',              strikethrough: false },
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  proyecto: ProyectoData
  initialItems: ProyectoItem[]
  proveedores: Proveedor[]
  gastos: GastoFecha[]
  indirecto: number
  rol: string
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ProyectoDetailClient({
  proyecto, initialItems, proveedores: initialProveedores,
  gastos, indirecto, rol,
}: Props) {
  const router = useRouter()
  const [items, setItems]                 = useState<ProyectoItem[]>(initialItems)
  const [proveedores, setProveedores]     = useState<Proveedor[]>(initialProveedores)
  const [editingCell, setEditingCell]     = useState<{ id: string; field: string } | null>(null)
  const [saving, setSaving]               = useState<string | null>(null)
  const [adding, setAdding]               = useState(false)
  const [filterProv, setFilterProv]       = useState<string | null>(null)
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false)
  const [finalizando, setFinalizando]     = useState(false)

  const canEdit   = rol === 'admin' || rol === 'pm'
  const canDelete = rol === 'admin'

  // ── Derived ──────────────────────────────────────────────────────────────────

  const displayItems = filterProv
    ? items.filter(i => i.proveedor_id === filterProv)
    : items

  const totals = items.reduce((acc, item) => {
    const igv = item.tipo_comprobante === 'factura' ? Math.round(item.gasto_real * 18 / 118) : 0
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

  const avancePct   = totals.costo_estimado > 0
    ? Math.min((totals.gasto_real / totals.costo_estimado) * 100, 999)
    : null
  const margenPct   = totals.precio_venta > 0
    ? (totals.margen / totals.precio_venta) * 100
    : null
  const varianzaPct = totals.costo_estimado > 0
    ? (totals.varianza / totals.costo_estimado) * 100
    : null

  // Status counts for footer summary
  const statusCounts = items.reduce((acc, item) => {
    const s = getItemStatus(item)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Proveedores in project (from items) with totals
  const proveedoresEnProyecto = Array.from(
    items
      .filter(i => i.proveedor)
      .reduce((map, i) => {
        const p = i.proveedor!
        if (!map.has(p.id)) map.set(p.id, { ...p, total: 0 })
        map.get(p.id)!.total += i.gasto_real
        return map
      }, new Map<string, { id: string; razon_social: string; nombre_comercial: string | null; total: number }>())
      .values()
  )

  // Provider payment status (from actual gastos)
  const provGastos = gastos.reduce((map, g) => {
    if (!g.proveedor_id) return map
    if (!map.has(g.proveedor_id)) map.set(g.proveedor_id, [])
    map.get(g.proveedor_id)!.push(g)
    return map
  }, new Map<string, GastoFecha[]>())

  // ── Inline editing ──────────────────────────────────────────────────────────

  async function saveCell(itemId: string, field: string, raw: unknown) {
    setSaving(itemId)
    try {
      let value = raw
      if (['costo_estimado', 'precio_venta', 'gasto_real'].includes(field)) {
        const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
        value = isNaN(n) ? 0 : solesToCentavos(n)
      }
      if ((field === 'proveedor_id' || field === 'tipo_comprobante') && raw === '') value = null

      const res = await fetch(`/api/proyectos/${proyecto.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        const updated = await res.json() as ProyectoItem
        setItems(prev => prev.map(i => i.id === itemId ? updated : i))
      }
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
        body: JSON.stringify({ concepto: '', unidad: 'global', costo_estimado: 0, precio_venta: 0, gasto_real: 0, sort_order: items.length }),
      })
      if (res.ok) {
        const newItem = await res.json() as ProyectoItem
        setItems(prev => [...prev, newItem])
        setTimeout(() => setEditingCell({ id: newItem.id, field: 'concepto' }), 50)
      }
    } finally {
      setAdding(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!canDelete || !confirm('¿Eliminar esta fila?')) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/items/${itemId}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== itemId))
  }

  function onProveedorCreated(p: Proveedor) {
    setProveedores(prev => [...prev, p].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
  }

  // ── Finalizar Registro ──────────────────────────────────────────────────────

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

  // ── KPI cards ───────────────────────────────────────────────────────────────

  const kpiCards = (
    <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
      {/* Presupuestado */}
      <KpiCard
        label="Presupuestado"
        icon={<FileText size={15} className="text-zinc-400" />}
        value={totals.costo_estimado > 0 ? formatMoney(totals.costo_estimado) : '—'}
        sub="Base planificada"
        progress={avancePct !== null ? Math.min(avancePct, 100) : undefined}
        progressColor="bg-blue-500"
      />
      {/* Gastado */}
      <KpiCard
        label="Gastado (Real)"
        icon={<Wallet size={15} className="text-zinc-400" />}
        value={totals.gasto_real > 0 ? formatMoney(totals.gasto_real) : '—'}
        sub={avancePct !== null ? `${avancePct.toFixed(0)}% del presupuesto` : 'Sin gastos aún'}
        progress={avancePct !== null ? Math.min(avancePct, 100) : undefined}
        progressColor={avancePct && avancePct > 100 ? 'bg-red-500' : 'bg-blue-500'}
      />
      {/* Margen */}
      <KpiCard
        label="Margen Bruto"
        icon={<TrendingUp size={15} className={margenPct === null ? 'text-zinc-400' : margenPct < 15 ? 'text-red-500' : margenPct < 30 ? 'text-amber-500' : 'text-emerald-500'} />}
        value={totals.precio_venta > 0 || totals.gasto_real > 0 ? formatMoney(totals.margen) : '—'}
        sub={margenPct !== null ? `${margenPct.toFixed(1)}% sobre precio venta` : 'Sin datos de venta'}
        progress={margenPct !== null ? Math.max(0, Math.min(margenPct, 100)) : undefined}
        progressColor={margenPct === null ? 'bg-zinc-300' : margenPct < 0 ? 'bg-red-500' : margenPct < 15 ? 'bg-red-400' : margenPct < 30 ? 'bg-amber-400' : 'bg-emerald-500'}
        cardBg={margenPct === null ? '' : margenPct < 15 ? 'bg-red-50 border-red-200' : margenPct < 30 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}
      />
      {/* IGV */}
      <KpiCard
        label="Posición IGV"
        icon={<BarChart2 size={15} className="text-zinc-400" />}
        value={totals.igv > 0 ? formatMoney(totals.igv) : '—'}
        sub={totals.igv > 0 ? 'Crédito fiscal acumulado' : 'Sin facturas registradas'}
        progress={totals.igv > 0 && totals.gasto_real > 0
          ? Math.min((totals.igv / totals.gasto_real) * 100, 100)
          : undefined}
        progressColor="bg-amber-400"
      />
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Finalizar dialog */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar registro del proyecto</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm mt-1">
              Se marcará el proyecto como <strong>Cerrado</strong>. Podrás seguir consultando
              el historial pero no se podrán agregar nuevos ítems ni gastos.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFinalizarDialog(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleFinalizar} disabled={finalizando}>
              {finalizando ? 'Cerrando...' : 'Confirmar cierre'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-full">
        {/* ── Left / main ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 p-6 space-y-6">

          {/* Header */}
          <div>
            <Link
              href="/proyectos"
              className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
            >
              <ChevronLeft size={14} />
              Volver a Proyectos
            </Link>

            <div className="mt-2 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
                    {proyecto.nombre}
                  </h1>
                  <Badge variant="outline" className={ESTADO_BADGE[proyecto.estado] ?? ''}>
                    {ESTADO_LABEL[proyecto.estado] ?? proyecto.estado}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Sheet trigger on small screens */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="xl:hidden">
                      <PanelRight size={14} />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80 overflow-y-auto p-0">
                    <SheetHeader>
                      <SheetTitle>Detalles del proyecto</SheetTitle>
                    </SheetHeader>
                    <ProyectoSidebar proyecto={proyecto} canEdit={canEdit} />
                  </SheetContent>
                </Sheet>

                {canEdit && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/proyectos/${proyecto.id}/editar`}>
                      <Pencil size={13} className="mr-1.5" />
                      Editar
                    </Link>
                  </Button>
                )}
                {canEdit && proyecto.estado !== 'cerrado' && (
                  <Button size="sm" onClick={() => setShowFinalizarDialog(true)}>
                    Finalizar Registro
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="resumen">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="graficos">Gráficos</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen">
              {kpiCards}
            </TabsContent>

            <TabsContent value="graficos">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-lg border border-zinc-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-700">Presupuesto vs Real</h3>
                  <ChartPresupuestoVsReal items={items} />
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-700">Composición del gasto</h3>
                  <ChartComposicion items={items} getStatus={getItemStatus} />
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-700">Cascada de margen</h3>
                  <ChartCascada items={items} indirecto={indirecto} />
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-700">Burn rate</h3>
                  <ChartBurnRate
                    gastos={gastos}
                    fechaInicio={proyecto.fecha_inicio}
                    fechaCierre={proyecto.fecha_cierre_est}
                    presupuestadoTotal={totals.costo_estimado}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Items table */}
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Ítems del proyecto</h2>
              {filterProv && (
                <button
                  onClick={() => setFilterProv(null)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 rounded border border-zinc-200 px-2 py-1"
                >
                  <X size={11} /> Quitar filtro
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5 text-left w-52">Concepto</th>
                    <th className="px-3 py-2.5 text-left w-20">Unidad</th>
                    <th className="px-3 py-2.5 text-left w-36">Proveedor</th>
                    <th className="px-3 py-2.5 text-right w-28">Presupuestado</th>
                    <th className="px-3 py-2.5 text-right w-24">Real</th>
                    <th className="px-3 py-2.5 text-right w-24">Varianza</th>
                    <th className="px-3 py-2.5 text-right w-16">%</th>
                    <th className="px-3 py-2.5 text-left w-32">Estado</th>
                    <th className="px-3 py-2.5 text-right w-28">P. Venta</th>
                    <th className="px-3 py-2.5 text-right w-24">Margen</th>
                    <th className="px-3 py-2.5 text-right w-24">IGV</th>
                    {canEdit && <th className="px-3 py-2.5 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {displayItems.length === 0 && !canEdit && (
                    <tr>
                      <td colSpan={12} className="px-4 py-10 text-center text-sm text-zinc-400">
                        Sin ítems aún.
                      </td>
                    </tr>
                  )}
                  {displayItems.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      proveedores={proveedores}
                      editingCell={editingCell}
                      saving={saving}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onStartEdit={(id, field) => canEdit && setEditingCell({ id, field })}
                      onSave={saveCell}
                      onDelete={deleteItem}
                      onProveedorCreated={onProveedorCreated}
                      proyectoId={proyecto.id}
                    />
                  ))}
                  {/* Inline add row */}
                  {canEdit && (
                    <tr
                      className="border-b border-zinc-100 cursor-text hover:bg-zinc-50/50"
                      onClick={addItem}
                    >
                      <td colSpan={12} className="px-4 py-3">
                        <span className="text-sm text-zinc-300 italic select-none">
                          {adding ? 'Agregando…' : 'Haz clic aquí para agregar un nuevo ítem…'}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Totals row */}
                {items.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200" style={{ backgroundColor: '#f0f4ff' }}>
                      <td colSpan={3} className="px-4 py-3 text-xs font-bold text-zinc-600 uppercase tracking-wide">
                        Totales
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-zinc-800 text-sm">
                        {totals.costo_estimado > 0 ? formatMoney(totals.costo_estimado) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-zinc-800 text-sm">
                        {totals.gasto_real > 0 ? formatMoney(totals.gasto_real) : '—'}
                      </td>
                      <td className={cn(
                        'px-3 py-3 text-right font-bold tabular-nums text-sm',
                        totals.varianza > 0 ? 'text-red-600' : totals.varianza < 0 ? 'text-blue-600' : 'text-zinc-400'
                      )}>
                        {totals.costo_estimado > 0
                          ? `${totals.varianza > 0 ? '+' : ''}${formatMoney(totals.varianza)}`
                          : '—'}
                      </td>
                      <td className={cn(
                        'px-3 py-3 text-right font-bold tabular-nums text-sm',
                        varianzaPct === null ? 'text-zinc-400'
                        : varianzaPct > 0 ? 'text-red-600' : 'text-blue-600'
                      )}>
                        {varianzaPct !== null ? `${varianzaPct > 0 ? '+' : ''}${varianzaPct.toFixed(0)}%` : '—'}
                      </td>
                      <td />
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-zinc-800 text-sm">
                        {totals.precio_venta > 0 ? formatMoney(totals.precio_venta) : '—'}
                      </td>
                      <td className={cn(
                        'px-3 py-3 text-right font-bold tabular-nums text-sm',
                        margenPct === null ? 'text-zinc-400'
                        : totals.margen < 0 ? 'text-red-600' : 'text-emerald-700'
                      )}>
                        {totals.precio_venta > 0
                          ? `${margenPct?.toFixed(0)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-blue-700 text-sm">
                        {totals.igv > 0 ? formatMoney(totals.igv) : '—'}
                      </td>
                      {canEdit && <td />}
                    </tr>
                    {/* Summary line */}
                    <tr style={{ backgroundColor: '#f0f4ff' }}>
                      <td colSpan={12} className="px-4 pb-3 text-xs text-zinc-400">
                        {[
                          statusCounts['sobregasto'] && `${statusCounts['sobregasto']} sobregasto${statusCounts['sobregasto'] > 1 ? 's' : ''}`,
                          statusCounts['ahorro']     && `${statusCounts['ahorro']} ahorro${statusCounts['ahorro'] > 1 ? 's' : ''}`,
                          statusCounts['extra']      && `${statusCounts['extra']} extra${statusCounts['extra'] > 1 ? 's' : ''}`,
                          statusCounts['no_ejecutado'] && `${statusCounts['no_ejecutado']} no ejecutado${statusCounts['no_ejecutado'] > 1 ? 's' : ''}`,
                        ].filter(Boolean).join(' · ') || 'Todos los ítems ejecutados dentro del presupuesto'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Add buttons */}
            {canEdit && (
              <div className="flex gap-3 px-5 py-4 border-t border-zinc-100">
                <Button size="sm" onClick={addItem} disabled={adding}>
                  <Plus size={13} className="mr-1.5" />
                  Agregar ítem presupuestado
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={async () => {
                    setAdding(true)
                    try {
                      const res = await fetch(`/api/proyectos/${proyecto.id}/items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ concepto: '', unidad: 'global', costo_estimado: 0, precio_venta: 0, gasto_real: 0, sort_order: items.length }),
                      })
                      if (res.ok) {
                        const newItem = await res.json() as ProyectoItem
                        setItems(prev => [...prev, newItem])
                        setTimeout(() => setEditingCell({ id: newItem.id, field: 'gasto_real' }), 50)
                      }
                    } finally {
                      setAdding(false)
                    }
                  }}
                >
                  ✦ Agregar gasto extra
                </Button>
              </div>
            )}
          </div>

          {/* Proveedores en este proyecto */}
          {proveedoresEnProyecto.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">Proveedores en este proyecto</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {proveedoresEnProyecto.map(p => {
                  const gastosProv = provGastos.get(p.id) ?? []
                  const pendientes = gastosProv.filter(g => g.estado_pago === 'pendiente')
                  const tipo       = gastosProv.at(-1)?.tipo_comprobante ?? null
                  const tipoLabel: Record<string, string> = {
                    factura: 'Factura', boleta: 'Boleta', rxh: 'RxH', sin_comprobante: 'Sin comp.'
                  }
                  const isActive = filterProv === p.id

                  return (
                    <button
                      key={p.id}
                      onClick={() => setFilterProv(isActive ? null : p.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left',
                        'transition-all hover:shadow-sm',
                        isActive ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200'
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
                        {(p.nombre_comercial ?? p.razon_social).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">
                          {p.nombre_comercial ?? p.razon_social}
                        </p>
                        <p className="text-xs font-mono text-zinc-500">{formatMoney(p.total)}</p>
                        {pendientes.length > 0 ? (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-amber-700">
                            Pendiente de pago
                            {tipo && <span className="bg-amber-100 rounded px-1">{tipoLabel[tipo] ?? tipo}</span>}
                          </span>
                        ) : gastosProv.length > 0 ? (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-emerald-700">
                            <Check size={10} /> Pagado
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar (hidden on <1280px — use Sheet instead) ───────── */}
        <aside className="hidden xl:flex w-72 shrink-0 flex-col border-l border-zinc-200 bg-white sticky top-0 self-start max-h-screen overflow-y-auto">
          <ProyectoSidebar proyecto={proyecto} canEdit={canEdit} />
        </aside>
      </div>
    </>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, icon, value, sub, progress, progressColor, cardBg,
}: {
  label: string
  icon?: React.ReactNode
  value: string
  sub?: string
  progress?: number
  progressColor?: string
  cardBg?: string
}) {
  return (
    <div className={cn('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', cardBg)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums font-mono text-zinc-900 leading-none">
        {value}
      </p>
      {progress !== undefined && (
        <div className="mt-3 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', progressColor ?? 'bg-blue-500')}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
      {sub && <p className="mt-1.5 text-xs text-zinc-400">{sub}</p>}
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
  proyectoId: string
}

function ItemRow({
  item, proveedores, editingCell, saving, canEdit, canDelete,
  onStartEdit, onSave, onDelete, onProveedorCreated,
}: ItemRowProps) {
  const isEditing = (field: string) => editingCell?.id === item.id && editingCell.field === field
  const isSaving  = saving === item.id

  const status  = getItemStatus(item)
  const cfg     = STATUS_CONFIG[status]
  const igv     = item.tipo_comprobante === 'factura' ? Math.round(item.gasto_real * 18 / 118) : 0
  const margen  = item.precio_venta - item.gasto_real
  const varianza = item.costo_estimado > 0 ? item.gasto_real - item.costo_estimado : 0
  const varianzaPct = item.costo_estimado > 0 ? (varianza / item.costo_estimado) * 100 : null

  return (
    <tr className={cn(
      'group border-b border-zinc-100 transition-colors',
      cfg.row,
      isSaving && 'opacity-50',
      cfg.strikethrough && 'line-through text-zinc-400'
    )}>
      {/* Concepto */}
      <td className="px-4 py-2.5" onClick={() => onStartEdit(item.id, 'concepto')}>
        {isEditing('concepto') ? (
          <InlineInput
            defaultValue={item.concepto}
            onSave={v => onSave(item.id, 'concepto', v)}
            placeholder="Describe el ítem..."
          />
        ) : (
          <span className={cn('block text-sm', canEdit && 'cursor-text', !item.concepto && 'text-zinc-300 italic')}>
            {item.concepto || (canEdit ? 'Concepto…' : '—')}
          </span>
        )}
      </td>

      {/* Unidad */}
      <td className="px-3 py-2.5" onClick={() => onStartEdit(item.id, 'unidad')}>
        {isEditing('unidad') ? (
          <InlineSelect value={item.unidad} options={UNIDADES} onSave={v => onSave(item.id, 'unidad', v)} />
        ) : (
          <span className={cn('text-sm text-zinc-500', canEdit && 'cursor-pointer')}>
            {UNIDADES.find(u => u.value === item.unidad)?.label ?? item.unidad}
          </span>
        )}
      </td>

      {/* Proveedor */}
      <td className="px-3 py-2.5">
        {isEditing('proveedor_id') ? (
          <ProveedorCombobox
            value={item.proveedor_id ?? ''}
            proveedores={proveedores}
            onSave={v => onSave(item.id, 'proveedor_id', v)}
            onCreated={onProveedorCreated}
          />
        ) : (
          <span
            className={cn('block text-sm text-zinc-600 truncate max-w-[130px]', canEdit && 'cursor-pointer')}
            onClick={() => onStartEdit(item.id, 'proveedor_id')}
          >
            {item.proveedor
              ? (item.proveedor.nombre_comercial ?? item.proveedor.razon_social)
              : <span className="text-zinc-300 italic">{canEdit ? 'Seleccionar…' : '—'}</span>}
          </span>
        )}
      </td>

      {/* Costo estimado */}
      <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'costo_estimado')}>
        {isEditing('costo_estimado') ? (
          <InlineMoneyInput defaultValue={centavosToSoles(item.costo_estimado)} onSave={v => onSave(item.id, 'costo_estimado', v)} />
        ) : (
          <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text', item.costo_estimado === 0 && status === 'extra' ? 'text-zinc-300' : '')}>
            {item.costo_estimado > 0 ? formatMoney(item.costo_estimado) : '—'}
          </span>
        )}
      </td>

      {/* Gasto real */}
      <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'gasto_real')}>
        {isEditing('gasto_real') ? (
          <InlineMoneyInput defaultValue={centavosToSoles(item.gasto_real)} onSave={v => onSave(item.id, 'gasto_real', v)} />
        ) : (
          <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text', item.gasto_real === 0 && 'text-zinc-300')}>
            {item.gasto_real > 0 ? formatMoney(item.gasto_real) : '—'}
          </span>
        )}
      </td>

      {/* Varianza */}
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

      {/* % varianza */}
      <td className="px-3 py-2.5 text-right">
        {varianzaPct !== null && status !== 'no_ejecutado' && status !== 'extra' ? (
          <span className={cn('text-sm tabular-nums font-medium', varianzaPct > 0 ? 'text-red-600' : 'text-blue-600')}>
            {varianzaPct > 0 ? '+' : ''}{varianzaPct.toFixed(1)}%
          </span>
        ) : status === 'extra' ? (
          <span className="text-sm text-amber-600">Extra</span>
        ) : (
          <span className="text-sm text-zinc-300">—</span>
        )}
      </td>

      {/* Estado badge */}
      <td className="px-3 py-2.5">
        {cfg.label && (
          <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold tracking-wide', cfg.badge)}>
            {cfg.label}
          </span>
        )}
      </td>

      {/* Precio venta */}
      <td className="px-3 py-2.5 text-right" onClick={() => onStartEdit(item.id, 'precio_venta')}>
        {isEditing('precio_venta') ? (
          <InlineMoneyInput defaultValue={centavosToSoles(item.precio_venta)} onSave={v => onSave(item.id, 'precio_venta', v)} />
        ) : (
          <span className={cn('text-sm tabular-nums', canEdit && 'cursor-text', item.precio_venta === 0 && 'text-zinc-300')}>
            {item.precio_venta > 0 ? formatMoney(item.precio_venta) : '—'}
          </span>
        )}
      </td>

      {/* Margen */}
      <td className="px-3 py-2.5 text-right">
        <span className={cn(
          'text-sm tabular-nums font-medium',
          item.precio_venta === 0 && item.gasto_real === 0 ? 'text-zinc-300'
          : margen < 0 ? 'text-red-600' : 'text-emerald-700'
        )}>
          {item.precio_venta > 0 || item.gasto_real > 0 ? formatMoney(margen) : '—'}
        </span>
      </td>

      {/* IGV */}
      <td className="px-3 py-2.5 text-right">
        <span className={cn('text-sm tabular-nums', igv === 0 ? 'text-zinc-300' : 'text-blue-700')}>
          {igv > 0 ? formatMoney(igv) : '—'}
        </span>
      </td>

      {/* Delete */}
      {canEdit && (
        <td className="px-2 py-2.5">
          {canDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all rounded"
            >
              <Trash2 size={13} />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

// ─── Inline Inputs ─────────────────────────────────────────────────────────────

function InlineInput({ defaultValue, onSave, placeholder }: {
  defaultValue: string; onSave: (v: string) => void; placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <input
      ref={ref}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200"
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') onSave(defaultValue)
      }}
    />
  )
}

function InlineMoneyInput({ defaultValue, onSave }: {
  defaultValue: number; onSave: (v: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <input
      ref={ref}
      type="number"
      step="0.01"
      min="0"
      defaultValue={defaultValue === 0 ? '' : defaultValue.toFixed(2)}
      placeholder="0.00"
      className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-right tabular-nums outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200"
      onBlur={e => { const n = parseFloat(e.target.value); onSave(isNaN(n) ? 0 : n) }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') onSave(defaultValue)
      }}
    />
  )
}

function InlineSelect({ value, options, onSave }: {
  value: string; options: { value: string; label: string }[]; onSave: (v: string) => void
}) {
  const ref = useRef<HTMLSelectElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <select
      ref={ref}
      defaultValue={value}
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
  value: string
  proveedores: Proveedor[]
  onSave: (id: string) => void
  onCreated: (p: Proveedor) => void
}) {
  const [search, setSearch]     = useState('')
  const [creating, setCreating] = useState(false)
  const [newRazon, setNewRazon] = useState('')
  const [busy, setBusy]         = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)

  const filtered = proveedores.filter(p =>
    p.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    (p.nombre_comercial ?? '').toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onSave(value)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [value, onSave])

  async function createProv() {
    if (!newRazon.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'persona_natural', razon_social: newRazon.trim() }),
      })
      if (res.ok) {
        const p = await res.json() as Proveedor
        onCreated(p); onSave(p.id)
      }
    } finally { setBusy(false) }
  }

  if (creating) return (
    <div ref={containerRef} className="flex items-center gap-1">
      <input
        autoFocus
        value={newRazon}
        onChange={e => setNewRazon(e.target.value)}
        placeholder="Razón social..."
        className="flex-1 min-w-0 rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
        onKeyDown={e => { if (e.key === 'Enter') createProv(); if (e.key === 'Escape') setCreating(false) }}
      />
      <button
        onClick={createProv}
        disabled={busy || !newRazon.trim()}
        className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? '…' : 'Crear'}
      </button>
      <button onClick={() => setCreating(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
        <X size={12} />
      </button>
    </div>
  )

  return (
    <div ref={containerRef} className="relative">
      <input
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar…"
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-500"
        onKeyDown={e => { if (e.key === 'Escape') onSave(value) }}
      />
      <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden">
        <button
          className="w-full px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-50 border-b border-zinc-100"
          onMouseDown={() => onSave('')}
        >
          — Sin proveedor
        </button>
        <div className="max-h-44 overflow-y-auto">
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-zinc-400">Sin resultados</p>}
          {filtered.map(p => (
            <button
              key={p.id}
              className={cn('w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 flex items-center justify-between', value === p.id && 'bg-zinc-100')}
              onMouseDown={() => onSave(p.id)}
            >
              <span className="truncate">{p.nombre_comercial ?? p.razon_social}</span>
              {value === p.id && <Check size={12} className="shrink-0 ml-2 text-zinc-500" />}
            </button>
          ))}
        </div>
        <div className="border-t border-zinc-100">
          <button
            className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1.5"
            onMouseDown={() => { setCreating(true); setSearch('') }}
          >
            <Plus size={12} />
            Crear &ldquo;{search || 'nuevo proveedor'}&rdquo;
          </button>
        </div>
      </div>
    </div>
  )
}
