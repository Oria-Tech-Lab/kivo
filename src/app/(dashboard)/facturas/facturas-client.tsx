'use client'

import { useState, useMemo, useEffect, useTransition, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, X, Plus, ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Paperclip, AlertTriangle, Clock, Copy,
  Trash2, Upload, LayoutGrid, Table2, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn, formatMoney, formatDate } from '@/lib/utils'
import type { FacturaGlobal, ProyectoBasico } from './page'
import type { FacturaArchivoEntry } from '../proyectos/[id]/page'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClienteOpt { id: string; nombre: string }

interface FacturaKpis {
  totalFacturado: number;  countTotal: number
  porCobrar: number;       countPendientes: number
  cobradoEsteMes: number;  countCobradoMes: number;  mesNombre: string
  totalIgv: number
  totalDetraccion: number
  totalVencido: number;    countVencidas: number
  proximasVencer: { count: number; monto: number }
  diasPromedioCobro: number | null
}

interface HistorialEntry {
  id: string
  estado_anterior: string | null
  estado_nuevo: string | null
  created_at: string
}

type SortField = 'numero_factura' | 'subtotal' | 'igv' | 'monto_detraccion' | 'total' | 'cliente_abona' | 'estado' | 'fecha_emision' | 'fecha_vencimiento'

interface FormState {
  proyecto_id: string
  numero_factura: string
  subtotalStr: string
  aplica_igv: boolean
  aplica_detraccion: boolean
  pct_detraccion: number
  estado: FacturaGlobal['estado']
  fecha_emision: string
  fecha_vencimiento: string
  fecha_cobro: string
  notas: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<FacturaGlobal['estado'], { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  emitida:  { label: 'Emitida',  cls: 'bg-blue-50 text-blue-700 border-blue-200'  },
  cobrada:  { label: 'Cobrada',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  vencida:  { label: 'Vencida',  cls: 'bg-red-50 text-red-600 border-red-200'     },
}

const EMPTY_FORM: FormState = {
  proyecto_id: '', numero_factura: '', subtotalStr: '',
  aplica_igv: true, aplica_detraccion: false, pct_detraccion: 10,
  estado: 'borrador', fecha_emision: '', fecha_vencimiento: '', fecha_cobro: '', notas: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeKpis(facturas: FacturaGlobal[]): FacturaKpis {
  const now = new Date()
  const todayStr = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().split('T')[0]
  const today = new Date(todayStr + 'T00:00:00')
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const ago90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
  const plus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  let totalFacturado = 0
  let porCobrar = 0, countPendientes = 0
  let cobradoEsteMes = 0, countCobradoMes = 0
  let totalIgv = 0, totalDetraccion = 0
  let totalVencido = 0, countVencidas = 0
  let proximasCount = 0, proximasMonto = 0
  const diasArr: number[] = []

  for (const f of facturas) {
    totalFacturado += f.subtotal
    if (f.aplica_igv) totalIgv += f.igv
    totalDetraccion += f.monto_detraccion

    const venc = f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00') : null
    const cobro = f.fecha_cobro ? new Date(f.fecha_cobro + 'T00:00:00') : null
    const emis = f.fecha_emision ? new Date(f.fecha_emision + 'T00:00:00') : null

    if (f.estado === 'emitida' || f.estado === 'borrador') { porCobrar += f.total; countPendientes++ }
    if (f.estado === 'cobrada' && cobro && cobro >= startOfMonth) { cobradoEsteMes += f.total; countCobradoMes++ }

    const isVencida = f.estado === 'vencida' || (f.estado === 'emitida' && venc !== null && venc < today)
    if (isVencida) { totalVencido += f.total; countVencidas++ }

    if (f.estado === 'emitida' && venc && venc >= today && venc <= plus7) { proximasCount++; proximasMonto += f.total }
    if (f.estado === 'cobrada' && cobro && emis && cobro >= ago90) {
      const dias = Math.round((cobro.getTime() - emis.getTime()) / 86400000)
      if (dias >= 0) diasArr.push(dias)
    }
  }

  return {
    totalFacturado, countTotal: facturas.length,
    porCobrar, countPendientes,
    cobradoEsteMes, countCobradoMes,
    mesNombre: new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(today),
    totalIgv, totalDetraccion, totalVencido, countVencidas,
    proximasVencer: { count: proximasCount, monto: proximasMonto },
    diasPromedioCobro: diasArr.length ? Math.round(diasArr.reduce((a, b) => a + b, 0) / diasArr.length) : null,
  }
}

function diasVencida(f: FacturaGlobal): number | null {
  if (!f.fecha_vencimiento) return null
  const venc = new Date(f.fecha_vencimiento + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dias = Math.floor((today.getTime() - venc.getTime()) / 86400000)
  if (f.estado === 'vencida' || (f.estado === 'emitida' && dias > 0)) return dias
  return null
}

function vencimientoLabel(fecha: string | null): { text: string; red: boolean } | null {
  if (!fecha) return null
  const venc = new Date(fecha + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((venc.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { text: `Vencida hace ${-diff} días`, red: true }
  if (diff === 0) return { text: 'Vence hoy', red: true }
  if (diff <= 7) return { text: `Vence en ${diff} días`, red: true }
  return null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function openStorageFile(path: string) {
  const r = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}&bucket=comprobantes`)
  if (r.ok) { const { url } = await r.json() as { url: string }; window.open(url, '_blank', 'noopener,noreferrer') }
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <div className={cn('relative w-9 h-5 rounded-full transition-colors', checked ? 'bg-blue-600' : 'bg-zinc-200')}>
        <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </div>
      <span className="text-sm text-zinc-700">{label}</span>
    </button>
  )
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, color, icon }: {
  title: string; value: string; sub: string; color?: string; icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{title}</p>
        {icon}
      </div>
      <p className="text-xl font-bold tabular-nums leading-snug" style={{ color: color ?? '#18181b' }}>
        {value}
      </p>
      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{sub}</p>
    </div>
  )
}

function KpiRow({ kpis }: { kpis: FacturaKpis }) {
  const diasColor = kpis.diasPromedioCobro === null ? '#94a3b8'
    : kpis.diasPromedioCobro < 30 ? '#059669'
    : kpis.diasPromedioCobro <= 45 ? '#d97706' : '#dc2626'
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard title="Total facturado" value={formatMoney(kpis.totalFacturado)} sub={`${kpis.countTotal} facturas`} />
      <KpiCard title="Por cobrar" value={formatMoney(kpis.porCobrar)} sub={`${kpis.countPendientes} pendientes`} color="#2563eb" />
      <KpiCard title={`Cobrado ${kpis.mesNombre}`} value={formatMoney(kpis.cobradoEsteMes)} sub={`${kpis.countCobradoMes} cobradas`} color="#059669" />
      <KpiCard title="Total IGV" value={formatMoney(kpis.totalIgv)} sub="IGV emitido acumulado" />
      <KpiCard title="Detracción" value={formatMoney(kpis.totalDetraccion)} sub="Cuenta SPOT" color="#d97706" />
      <KpiCard
        title="Vencido"
        value={formatMoney(kpis.totalVencido)}
        sub={`${kpis.countVencidas} vencidas`}
        color={kpis.countVencidas > 0 ? '#dc2626' : undefined}
        icon={kpis.countVencidas > 0 ? <AlertTriangle size={13} className="text-red-500 shrink-0" /> : undefined}
      />
      <KpiCard
        title="Próx. vencer"
        value={`${kpis.proximasVencer.count} facturas`}
        sub={formatMoney(kpis.proximasVencer.monto)}
        color={kpis.proximasVencer.count > 0 ? '#d97706' : undefined}
        icon={<Clock size={13} className="text-amber-400 shrink-0" />}
      />
      <KpiCard
        title="Días prom. cobro"
        value={kpis.diasPromedioCobro !== null ? `${kpis.diasPromedioCobro} días` : '—'}
        sub="Promedio 90 días"
        color={diasColor}
      />
    </div>
  )
}

// ─── Factura Sidebar ──────────────────────────────────────────────────────────

interface SidebarProps {
  open: boolean
  onClose: () => void
  factura: FacturaGlobal | null
  isCreating: boolean
  proyectos: ProyectoBasico[]
  onSaved: (f: FacturaGlobal) => void
  onDeleted: (id: string) => void
}

function FacturaSidebar({ open, onClose, factura, isCreating, proyectos, onSaved, onDeleted }: SidebarProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [localArchivos, setLocalArchivos] = useState<FacturaArchivoEntry[]>([])
  const [removedPaths, setRemovedPaths] = useState<string[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [historial, setHistorial] = useState<HistorialEntry[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (factura && !isCreating) {
      setForm({
        proyecto_id: factura.proyecto_id,
        numero_factura: factura.numero_factura,
        subtotalStr: (factura.subtotal / 100).toFixed(2),
        aplica_igv: factura.aplica_igv,
        aplica_detraccion: factura.aplica_detraccion,
        pct_detraccion: factura.pct_detraccion || 10,
        estado: factura.estado,
        fecha_emision: factura.fecha_emision ?? '',
        fecha_vencimiento: factura.fecha_vencimiento ?? '',
        fecha_cobro: factura.fecha_cobro ?? '',
        notas: factura.notas ?? '',
      })
      setLocalArchivos(factura.archivos ?? [])
    } else {
      setForm({ ...EMPTY_FORM, fecha_emision: new Date().toISOString().split('T')[0] })
      setLocalArchivos([])
    }
    setRemovedPaths([]); setPendingFiles([]); setSaveError(null)
  }, [open, factura, isCreating])

  useEffect(() => {
    if (!open || !factura || isCreating) { setHistorial([]); return }
    setHistLoading(true)
    fetch(`/api/facturas/${factura.id}/historial`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setHistorial(Array.isArray(d) ? d : []))
      .catch(() => setHistorial([]))
      .finally(() => setHistLoading(false))
  }, [open, factura, isCreating])

  const selectedProyecto = proyectos.find(p => p.id === form.proyecto_id)

  function setF<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function onProyectoChange(pid: string) {
    const proy = proyectos.find(p => p.id === pid)
    setForm(prev => ({
      ...prev, proyecto_id: pid,
      aplica_detraccion: proy?.aplica_detraccion ?? prev.aplica_detraccion,
    }))
  }

  const subtotalCentavos = Math.round(parseFloat(form.subtotalStr || '0') * 100)
  const previewIgv = form.aplica_igv ? Math.round(subtotalCentavos * 18 / 100) : 0
  const previewTotal = subtotalCentavos + previewIgv
  const previewDetraccion = form.aplica_detraccion ? Math.round(previewTotal * form.pct_detraccion / 100) : 0
  const previewClienteAbona = previewTotal - previewDetraccion

  const isDirty = useMemo(() => {
    if (isCreating) return form.numero_factura.length > 0 && form.proyecto_id.length > 0 && subtotalCentavos > 0
    if (!factura) return false
    return (
      form.proyecto_id !== factura.proyecto_id ||
      form.numero_factura !== factura.numero_factura ||
      subtotalCentavos !== factura.subtotal ||
      form.aplica_igv !== factura.aplica_igv ||
      form.aplica_detraccion !== factura.aplica_detraccion ||
      form.pct_detraccion !== factura.pct_detraccion ||
      form.estado !== factura.estado ||
      form.fecha_emision !== (factura.fecha_emision ?? '') ||
      form.fecha_vencimiento !== (factura.fecha_vencimiento ?? '') ||
      form.fecha_cobro !== (factura.fecha_cobro ?? '') ||
      form.notas !== (factura.notas ?? '') ||
      removedPaths.length > 0 || pendingFiles.length > 0
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, factura, isCreating, subtotalCentavos, removedPaths, pendingFiles])

  async function handleSave() {
    setSaving(true); setSaveError(null)
    const body = {
      proyecto_id: form.proyecto_id,
      numero_factura: form.numero_factura,
      subtotal: subtotalCentavos,
      aplica_igv: form.aplica_igv,
      aplica_detraccion: form.aplica_detraccion,
      pct_detraccion: form.aplica_detraccion ? form.pct_detraccion : 0,
      estado: form.estado,
      fecha_emision: form.fecha_emision || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      fecha_cobro: form.estado === 'cobrada' ? (form.fecha_cobro || null) : null,
      notas: form.notas || null,
    }

    let saved: FacturaGlobal
    if (isCreating) {
      const r = await fetch('/api/facturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json() as FacturaGlobal & { error?: string }
      if (!r.ok) { setSaveError(j.error ?? 'Error al crear'); setSaving(false); return }
      saved = j
    } else {
      const r = await fetch(`/api/facturas/${factura!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json() as FacturaGlobal & { error?: string }
      if (!r.ok) { setSaveError(j.error ?? 'Error al guardar'); setSaving(false); return }
      saved = j
    }

    // File operations on the now-existing factura
    const proyectoId = saved.proyecto_id
    const facturaId = saved.id
    for (const path of removedPaths) {
      await fetch(`/api/proyectos/${proyectoId}/facturas/${facturaId}/archivos?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    }
    let finalArchivos = (saved.archivos ?? []).filter(a => !removedPaths.includes(a.path))
    for (const file of pendingFiles) {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(`/api/proyectos/${proyectoId}/facturas/${facturaId}/archivos`, { method: 'POST', body: fd })
      if (r.ok) { const j = await r.json() as { archivos: FacturaArchivoEntry[] }; if (j.archivos) finalArchivos = j.archivos }
    }

    setRemovedPaths([]); setPendingFiles([])
    setLocalArchivos(finalArchivos)
    setSaving(false)
    onSaved({ ...saved, archivos: finalArchivos })
  }

  async function handleDelete() {
    setDeleting(true)
    const r = await fetch(`/api/facturas/${factura!.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!r.ok) { const j = await r.json() as { error?: string }; setSaveError(j.error ?? 'Error'); return }
    setShowDeleteDialog(false)
    onDeleted(factura!.id)
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) setPendingFiles(prev => [...prev, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const vencInfo = vencimientoLabel(form.fecha_vencimiento)

  return (
    <>
      <Sheet open={open} onOpenChange={o => { if (!o) onClose() }}>
        <SheetContent side="right" className="w-[480px] overflow-y-auto flex flex-col gap-0 p-0">
          <SheetHeader className="sticky top-0 bg-white z-10 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <SheetTitle className="truncate">
                  {isCreating ? 'Nueva Factura' : (factura?.numero_factura ?? 'Factura')}
                </SheetTitle>
                {!isCreating && factura && (
                  <Badge variant="outline" className={cn('text-xs shrink-0', ESTADO_CFG[factura.estado].cls)}>
                    {ESTADO_CFG[factura.estado].label}
                  </Badge>
                )}
              </div>
              {!isCreating && factura && (
                <button
                  onClick={async () => {
                    const body = {
                      proyecto_id: factura.proyecto_id, numero_factura: `${factura.numero_factura}-COPIA`,
                      subtotal: factura.subtotal, aplica_igv: factura.aplica_igv,
                      aplica_detraccion: factura.aplica_detraccion, pct_detraccion: factura.pct_detraccion,
                      estado: 'borrador' as const, notas: factura.notas,
                    }
                    const r = await fetch('/api/facturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    if (r.ok) { const j = await r.json() as FacturaGlobal; onSaved(j) }
                  }}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 mr-6"
                >
                  <Copy size={12} /> Duplicar
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {saveError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
            )}

            {/* ── Datos ── */}
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Datos de la factura</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Proyecto *</label>
                  <select
                    value={form.proyecto_id}
                    onChange={e => onProyectoChange(e.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">Seleccionar proyecto…</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                {selectedProyecto?.cliente && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Cliente</label>
                    <div className="h-9 flex items-center rounded-md border border-zinc-100 bg-zinc-50 px-3 text-sm text-zinc-600">
                      {selectedProyecto.cliente.nombre}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Número de factura *</label>
                  <Input value={form.numero_factura} onChange={e => setF('numero_factura', e.target.value)} placeholder="F001-000123" className="font-mono" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Subtotal (S/) *</label>
                  <Input type="number" min="0" step="0.01" value={form.subtotalStr} onChange={e => setF('subtotalStr', e.target.value)} placeholder="0.00" className="tabular-nums" />
                </div>

                <div className="flex items-center justify-between py-1">
                  <Toggle checked={form.aplica_igv} onChange={v => setF('aplica_igv', v)} label="Aplicar IGV (18%)" />
                </div>

                <div className="flex items-center justify-between py-1">
                  <Toggle checked={form.aplica_detraccion} onChange={v => setF('aplica_detraccion', v)} label="Detracción" />
                  {form.aplica_detraccion && (
                    <select
                      value={form.pct_detraccion}
                      onChange={e => setF('pct_detraccion', parseInt(e.target.value))}
                      className="h-8 w-20 rounded-md border border-zinc-200 bg-white px-2 text-sm"
                    >
                      <option value={4}>4%</option>
                      <option value={10}>10%</option>
                      <option value={12}>12%</option>
                    </select>
                  )}
                </div>

                {/* Preview */}
                <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span><span className="tabular-nums">{formatMoney(subtotalCentavos)}</span>
                  </div>
                  {form.aplica_igv && (
                    <div className="flex justify-between text-zinc-600">
                      <span>+ IGV (18%)</span><span className="tabular-nums">{formatMoney(previewIgv)}</span>
                    </div>
                  )}
                  {form.aplica_detraccion && (
                    <div className="flex justify-between text-red-600">
                      <span>− Detracción {form.pct_detraccion}%</span><span className="tabular-nums">−{formatMoney(previewDetraccion)}</span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-zinc-200 flex justify-between font-semibold text-zinc-900">
                    <span>Total factura</span><span className="tabular-nums">{formatMoney(previewTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold" style={{ color: '#059669' }}>
                    <span>Cliente abona</span><span className="tabular-nums">{formatMoney(previewClienteAbona)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setF('estado', e.target.value as FacturaGlobal['estado'])}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    {(Object.entries(ESTADO_CFG) as [FacturaGlobal['estado'], { label: string }][]).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Emisión</label>
                    <Input type="date" value={form.fecha_emision} onChange={e => setF('fecha_emision', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Vencimiento</label>
                    <Input type="date" value={form.fecha_vencimiento} onChange={e => setF('fecha_vencimiento', e.target.value)} />
                    {vencInfo && <p className={cn('text-[11px] mt-1', vencInfo.red ? 'text-red-600' : 'text-zinc-400')}>{vencInfo.text}</p>}
                  </div>
                </div>

                {form.estado === 'cobrada' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de cobro</label>
                    <Input type="date" value={form.fecha_cobro} onChange={e => setF('fecha_cobro', e.target.value)} />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={e => setF('notas', e.target.value)}
                    rows={2}
                    placeholder="Observaciones opcionales…"
                    className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>
            </section>

            {/* ── Archivos ── */}
            {!isCreating && factura && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Documentos</p>
                <div className="space-y-2">
                  {localArchivos.filter(a => !removedPaths.includes(a.path)).map(a => (
                    <div key={a.path} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                      <Paperclip size={13} className="text-zinc-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-800 truncate">{a.name}</p>
                        <p className="text-[11px] text-zinc-400">{formatFileSize(a.size)}</p>
                      </div>
                      <button onClick={() => openStorageFile(a.path)} className="text-xs text-blue-600 hover:underline shrink-0">Ver</button>
                      <button onClick={() => setRemovedPaths(prev => [...prev, a.path])} className="text-zinc-400 hover:text-red-500 transition-colors shrink-0"><X size={13} /></button>
                    </div>
                  ))}
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                      <Upload size={13} className="text-blue-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-blue-800 truncate">{f.name}</p>
                        <p className="text-[11px] text-blue-500">{formatFileSize(f.size)} · pendiente</p>
                      </div>
                      <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500 shrink-0"><X size={13} /></button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 py-3 text-sm text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <Upload size={14} /> Agregar documento
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileAdd} />
                </div>
              </section>
            )}

            {/* ── Historial ── */}
            {!isCreating && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Historial</p>
                {histLoading ? (
                  <p className="text-xs text-zinc-400">Cargando…</p>
                ) : historial.length === 0 ? (
                  <p className="text-xs text-zinc-400">Sin cambios registrados</p>
                ) : (
                  <div className="space-y-2">
                    {historial.map(h => (
                      <div key={h.id} className="flex items-start gap-2 text-xs text-zinc-600">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-300 shrink-0" />
                        <span>
                          {h.estado_anterior ? (
                            <><span className="text-zinc-400">{ESTADO_CFG[h.estado_anterior as FacturaGlobal['estado']]?.label ?? h.estado_anterior}</span>{' → '}</>
                          ) : null}
                          <span className="font-medium">{ESTADO_CFG[h.estado_nuevo as FacturaGlobal['estado']]?.label ?? h.estado_nuevo}</span>
                          <span className="text-zinc-400 ml-1">· {formatDate(h.created_at, 'time')}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-5 py-4 flex flex-col gap-2">
            {isDirty && (
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Guardando…' : isCreating ? 'Crear Factura' : 'Guardar cambios'}
              </Button>
            )}
            {!isCreating && factura?.estado === 'borrador' && (
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 size={13} className="mr-1.5" /> Eliminar factura
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Eliminar factura</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600 mt-1">
            ¿Eliminar la factura <strong>{factura?.numero_factura}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

function SortHeader({ col, label, sortCol, sortDir, onSort, className }: {
  col: SortField; label: string; sortCol: SortField | null; sortDir: 'asc' | 'desc'
  onSort: (col: SortField) => void; className?: string
}) {
  const active = sortCol === col
  return (
    <th
      className={cn('px-3 py-2.5 text-left text-xs font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-700', className)}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronsUpDown size={11} className="opacity-40" />}
      </span>
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  initialFacturas: FacturaGlobal[]
  proyectos: ProyectoBasico[]
  clientes: ClienteOpt[]
  kpis?: FacturaKpis
}

export function FacturasClient({ initialFacturas, proyectos, clientes }: Props) {
  const [, startTransition] = useTransition()
  const router = useRouter()

  const [localFacturas, setLocalFacturas] = useState<FacturaGlobal[]>(initialFacturas)
  const [estadoTab, setEstadoTab] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [clienteFilter, setClienteFilter] = useState('all')
  const [proyectoFilter, setProyectoFilter] = useState('all')
  const [sortCol, setSortCol] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState<FacturaGlobal | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  void startTransition; void router

  const kpis = useMemo(() => computeKpis(localFacturas), [localFacturas])

  function openFactura(f: FacturaGlobal) { setSelectedFactura(f); setIsCreating(false); setSidebarOpen(true) }
  function openCreate() { setSelectedFactura(null); setIsCreating(true); setSidebarOpen(true) }

  function handleSaved(f: FacturaGlobal) {
    setLocalFacturas(prev => {
      const exists = prev.some(x => x.id === f.id)
      return exists ? prev.map(x => x.id === f.id ? f : x) : [f, ...prev]
    })
    setSelectedFactura(f); setIsCreating(false)
  }

  function handleDeleted(id: string) {
    setLocalFacturas(prev => prev.filter(f => f.id !== id))
    setSidebarOpen(false)
  }

  async function handleEstadoChange(id: string, estado: FacturaGlobal['estado']) {
    const r = await fetch(`/api/facturas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) })
    if (r.ok) { const j = await r.json() as FacturaGlobal; setLocalFacturas(prev => prev.map(f => f.id === id ? { ...f, ...j } : f)) }
  }

  function toggleSort(col: SortField) {
    if (sortCol === col) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const hasFilters = !!(search || dateFrom || dateTo || clienteFilter !== 'all' || proyectoFilter !== 'all' || estadoTab !== 'all')

  const filtered = useMemo(() => {
    let list = localFacturas.filter(f => {
      if (estadoTab !== 'all' && f.estado !== estadoTab) return false
      if (clienteFilter !== 'all' && f.proyecto?.cliente?.id !== clienteFilter) return false
      if (proyectoFilter !== 'all' && f.proyecto_id !== proyectoFilter) return false
      if (dateFrom && f.fecha_emision && f.fecha_emision < dateFrom) return false
      if (dateTo && f.fecha_emision && f.fecha_emision > dateTo) return false
      if (search) {
        const q = search.toLowerCase()
        if (!f.numero_factura.toLowerCase().includes(q) &&
            !(f.proyecto?.nombre ?? '').toLowerCase().includes(q) &&
            !(f.proyecto?.cliente?.nombre ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
    if (sortCol) {
      list = [...list].sort((a, b) => {
        const av = a[sortCol] as string | number | null
        const bv = b[sortCol] as string | number | null
        if (av == null && bv == null) return 0
        if (av == null) return sortDir === 'asc' ? 1 : -1
        if (bv == null) return sortDir === 'asc' ? -1 : 1
        if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
        return 0
      })
    }
    return list
  }, [localFacturas, estadoTab, clienteFilter, proyectoFilter, dateFrom, dateTo, search, sortCol, sortDir])

  const totals = useMemo(() => filtered.reduce(
    (acc, f) => ({ subtotal: acc.subtotal + f.subtotal, igv: acc.igv + f.igv, monto_detraccion: acc.monto_detraccion + f.monto_detraccion, total: acc.total + f.total, cliente_abona: acc.cliente_abona + f.cliente_abona }),
    { subtotal: 0, igv: 0, monto_detraccion: 0, total: 0, cliente_abona: 0 }
  ), [filtered])

  const statusLine = useMemo(() => {
    const c = { cobradas: 0, emitidas: 0, borradores: 0, vencidas: 0 }
    for (const f of localFacturas) {
      if (f.estado === 'cobrada') c.cobradas++
      else if (f.estado === 'emitida') c.emitidas++
      else if (f.estado === 'borrador') c.borradores++
      else if (f.estado === 'vencida') c.vencidas++
    }
    return c
  }, [localFacturas])

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Facturas</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {localFacturas.length} factura{localFacturas.length !== 1 ? 's' : ''} · {formatMoney(kpis.totalFacturado)} en total
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus size={14} /> Nueva factura
        </Button>
      </div>

      {/* KPIs */}
      <KpiRow kpis={kpis} />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-zinc-200 bg-white p-0.5 gap-0.5">
          {(['all', 'borrador', 'emitida', 'cobrada', 'vencida'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setEstadoTab(tab)}
              className={cn('rounded px-3 py-1 text-xs font-medium transition-colors', estadoTab === tab ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800')}
            >
              {tab === 'all' ? 'Todas' : ESTADO_CFG[tab].label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input placeholder="Buscar por número, proyecto o cliente…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>

        <div className="flex items-center gap-1.5">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36 text-xs" title="Desde" />
          <span className="text-xs text-zinc-400">—</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36 text-xs" title="Hasta" />
        </div>

        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {proyectos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setClienteFilter('all'); setProyectoFilter('all'); setEstadoTab('all') }}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded hover:bg-zinc-100"
          >
            <X size={12} /> Limpiar
          </button>
        )}

        <div className="ml-auto flex rounded-md border border-zinc-200 bg-white p-0.5 gap-0.5">
          <button onClick={() => setViewMode('table')} className={cn('rounded p-1.5 transition-colors', viewMode === 'table' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700')}><Table2 size={15} /></button>
          <button onClick={() => setViewMode('cards')} className={cn('rounded p-1.5 transition-colors', viewMode === 'cards' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700')}><LayoutGrid size={15} /></button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">{hasFilters ? 'Sin resultados para los filtros aplicados.' : 'Aún no hay facturas registradas.'}</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <SortHeader col="numero_factura" label="Número" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="pl-4" />
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Proyecto</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Cliente</th>
                  <SortHeader col="subtotal" label="Subtotal" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortHeader col="igv" label="IGV" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortHeader col="monto_detraccion" label="Detracción" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="text-right hidden 2xl:table-cell" />
                  <SortHeader col="total" label="Total" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortHeader col="cliente_abona" label="Cliente abona" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortHeader col="estado" label="Estado" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortHeader col="fecha_emision" label="Emisión" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortHeader col="fecha_vencimiento" label="Vencimiento" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hidden 2xl:table-cell">Días venc.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Arch.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500 pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(f => {
                  const dias = diasVencida(f)
                  const vencRed = f.estado === 'vencida' || (f.fecha_vencimiento != null && new Date(f.fecha_vencimiento + 'T00:00:00') <= new Date())
                  const archCount = (f.archivos ?? []).length
                  return (
                    <tr key={f.id} className="hover:bg-zinc-50/60 transition-colors cursor-pointer" onClick={() => openFactura(f)}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-zinc-900">{f.numero_factura}</span>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        {f.proyecto ? (
                          <Link href={`/proyectos/${f.proyecto.id}`} className="text-blue-600 hover:underline text-xs">{f.proyecto.nombre}</Link>
                        ) : <span className="text-zinc-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-600">{f.proyecto?.cliente?.nombre ?? <span className="text-zinc-400">—</span>}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-zinc-700">{formatMoney(f.subtotal)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-zinc-500">{formatMoney(f.igv)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-red-500 hidden 2xl:table-cell">
                        {f.monto_detraccion > 0 ? `−${formatMoney(f.monto_detraccion)}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs font-medium text-zinc-900">{formatMoney(f.total)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs font-bold" style={{ color: '#059669' }}>{formatMoney(f.cliente_abona)}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn('text-xs', ESTADO_CFG[f.estado].cls)}>{ESTADO_CFG[f.estado].label}</Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {f.fecha_emision ? formatDate(f.fecha_emision) : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: vencRed ? '#dc2626' : '#71717a' }}>
                        {f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs hidden 2xl:table-cell">
                        {dias !== null ? <span className="font-medium text-red-600">+{dias}d</span> : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-500">
                        {archCount > 0 ? <span className="flex items-center gap-1"><Paperclip size={11} />{archCount}</span> : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-3 py-3 pr-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><MoreHorizontal size={14} /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openFactura(f)}>Ver / Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                const body = { proyecto_id: f.proyecto_id, numero_factura: `${f.numero_factura}-COPIA`, subtotal: f.subtotal, aplica_igv: f.aplica_igv, aplica_detraccion: f.aplica_detraccion, pct_detraccion: f.pct_detraccion, estado: 'borrador' as const, notas: f.notas }
                                const r = await fetch('/api/facturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                                if (r.ok) { const j = await r.json() as FacturaGlobal; handleSaved(j); openFactura(j) }
                              }}>
                                <Copy size={13} className="mr-2" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(['borrador', 'emitida', 'cobrada', 'vencida'] as const).map(s => (
                                <DropdownMenuItem key={s} disabled={f.estado === s} onClick={() => handleEstadoChange(f.id, s)} className="flex items-center gap-2 text-xs">
                                  {f.estado === s && <Check size={11} />} {ESTADO_CFG[s].label}
                                </DropdownMenuItem>
                              ))}
                              {f.estado === 'borrador' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 flex items-center gap-2"
                                    onClick={async () => {
                                      if (!confirm(`¿Eliminar la factura ${f.numero_factura}?`)) return
                                      const r = await fetch(`/api/facturas/${f.id}`, { method: 'DELETE' })
                                      if (r.ok) handleDeleted(f.id)
                                    }}
                                  >
                                    <Trash2 size={13} /> Eliminar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#eff6ff' }}>
                  <td className="px-4 py-2.5 text-xs font-bold text-zinc-700">TOTAL ({filtered.length})</td>
                  <td colSpan={2} />
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-zinc-900 tabular-nums">{formatMoney(totals.subtotal)}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-zinc-700 tabular-nums">{formatMoney(totals.igv)}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-red-500 tabular-nums hidden 2xl:table-cell">
                    {totals.monto_detraccion > 0 ? `−${formatMoney(totals.monto_detraccion)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-zinc-900 tabular-nums">{formatMoney(totals.total)}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums" style={{ color: '#059669' }}>{formatMoney(totals.cliente_abona)}</td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50/60">
            <p className="text-xs text-zinc-400">
              {[
                statusLine.cobradas > 0 && `${statusLine.cobradas} cobrada${statusLine.cobradas !== 1 ? 's' : ''}`,
                statusLine.emitidas > 0 && `${statusLine.emitidas} emitida${statusLine.emitidas !== 1 ? 's' : ''}`,
                statusLine.borradores > 0 && `${statusLine.borradores} borrador${statusLine.borradores !== 1 ? 'es' : ''}`,
                statusLine.vencidas > 0 && `${statusLine.vencidas} vencida${statusLine.vencidas !== 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(f => {
            const vencInfo = vencimientoLabel(f.fecha_vencimiento)
            const archCount = (f.archivos ?? []).length
            return (
              <div key={f.id} onClick={() => openFactura(f)} className="rounded-xl border border-zinc-200 bg-white p-4 cursor-pointer hover:border-zinc-300 transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-zinc-900">{f.numero_factura}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate">{f.proyecto?.nombre ?? '—'}</p>
                    {f.proyecto?.cliente && <p className="text-[11px] text-zinc-400 truncate">{f.proyecto.cliente.nombre}</p>}
                  </div>
                  <Badge variant="outline" className={cn('text-xs shrink-0', ESTADO_CFG[f.estado].cls)}>{ESTADO_CFG[f.estado].label}</Badge>
                </div>

                {/* Montos */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 border-t border-b border-zinc-100">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-0.5">Subtotal</p>
                    <p className="text-sm tabular-nums text-zinc-700">{formatMoney(f.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-0.5">IGV</p>
                    <p className="text-sm tabular-nums text-zinc-500">{f.aplica_igv ? formatMoney(f.igv) : <span className="text-zinc-300">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-0.5">Total</p>
                    <p className="text-sm font-bold tabular-nums text-zinc-900">{formatMoney(f.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 mb-0.5">Cliente abona</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#059669' }}>{formatMoney(f.cliente_abona)}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 text-[11px]">
                  <div className="flex items-center gap-2 text-zinc-400">
                    {f.fecha_emision && <span>Emitida {formatDate(f.fecha_emision)}</span>}
                    {archCount > 0 && <span className="flex items-center gap-0.5"><Paperclip size={11} />{archCount}</span>}
                  </div>
                  {f.fecha_vencimiento && (
                    <span className={cn(vencInfo?.red ? 'text-red-600 font-medium' : 'text-zinc-400')}>
                      Vence {formatDate(f.fecha_vencimiento)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <FacturaSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        factura={selectedFactura}
        isCreating={isCreating}
        proyectos={proyectos}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
