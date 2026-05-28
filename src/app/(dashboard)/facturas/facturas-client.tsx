'use client'

import { useState, useMemo, useId } from 'react'
import Link from 'next/link'
import {
  Plus, Search, X, Upload, Paperclip, Check, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn, formatDate, formatMoney, solesToCentavos } from '@/lib/utils'
import type { FacturaGlobal, ProyectoBasico } from './page'
import type { FacturaArchivoEntry } from '../proyectos/[id]/page'

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<FacturaGlobal['estado'], { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'bg-zinc-100 text-zinc-500'       },
  emitida:  { label: 'Emitida',  cls: 'bg-blue-100 text-blue-700'       },
  cobrada:  { label: 'Cobrada',  cls: 'bg-emerald-100 text-emerald-700' },
  vencida:  { label: 'Vencida',  cls: 'bg-red-100 text-red-600'         },
}

const PCT_OPTIONS = [
  { value: '4',  label: '4%'  },
  { value: '10', label: '10%' },
  { value: '12', label: '12%' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function openStorageFile(path: string) {
  const r = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}&bucket=comprobantes`)
  if (r.ok) {
    const { url } = await r.json() as { url: string }
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-blue-600' : 'bg-zinc-200',
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

// ─── Proyecto Combobox ────────────────────────────────────────────────────────

function ProyectoCombobox({ value, proyectos, onChange }: {
  value: string
  proyectos: ProyectoBasico[]
  onChange: (id: string, p: ProyectoBasico | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const current = proyectos.find(p => p.id === value)

  const filtered = proyectos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <span className={cn('truncate text-left', !current && 'text-zinc-400 italic')}>
          {current?.nombre ?? 'Seleccionar proyecto…'}
        </span>
        <ChevronDown size={13} className="text-zinc-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar proyecto…"
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(p => (
              <button key={p.id} type="button"
                onMouseDown={() => { onChange(p.id, p); setOpen(false); setSearch('') }}
                className={cn('w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 flex items-center justify-between', value === p.id && 'bg-zinc-100')}
              >
                <div className="min-w-0">
                  <span className="block truncate">{p.nombre}</span>
                  {p.cliente && <span className="text-xs text-zinc-400">{p.cliente.nombre}</span>}
                </div>
                {value === p.id && <Check size={12} className="text-zinc-500 shrink-0 ml-2" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Factura form state ───────────────────────────────────────────────────────

interface FormState {
  proyecto_id:       string
  numero_factura:    string
  subtotal:          string
  aplica_igv:        boolean
  aplica_detraccion: boolean
  pct_detraccion:    number
  estado:            FacturaGlobal['estado']
  fecha_emision:     string
  fecha_vencimiento: string
  fecha_cobro:       string
  notas:             string
}

function emptyForm(): FormState {
  return {
    proyecto_id: '', numero_factura: '', subtotal: '',
    aplica_igv: true, aplica_detraccion: false, pct_detraccion: 10,
    estado: 'borrador', fecha_emision: '', fecha_vencimiento: '', fecha_cobro: '', notas: '',
  }
}

function calcPreview(form: FormState) {
  const subtotal     = solesToCentavos(parseFloat(form.subtotal) || 0)
  const igv          = form.aplica_igv ? Math.round(subtotal * 18 / 100) : 0
  const total        = subtotal + igv
  const det          = form.aplica_detraccion ? Math.round(total * form.pct_detraccion / 100) : 0
  const clienteAbona = total - det
  return { subtotal, igv, total, det, clienteAbona }
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function NuevaFacturaDialog({ open, onClose, proyectos, onCreated }: {
  open: boolean
  onClose: () => void
  proyectos: ProyectoBasico[]
  onCreated: (f: FacturaGlobal) => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedProyecto, setSelectedProyecto] = useState<ProyectoBasico | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const formId = useId()

  const preview = calcPreview(form)

  function reset() {
    setForm(emptyForm())
    setSelectedProyecto(null)
    setPendingFiles([])
    setErr(null)
  }

  function handleClose() { reset(); onClose() }

  const f = (k: keyof FormState, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setPendingFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])
    e.target.value = ''
  }

  async function handleSave() {
    if (!form.proyecto_id) { setErr('Selecciona un proyecto'); return }
    if (!form.numero_factura.trim()) { setErr('El número de factura es requerido'); return }
    if (!form.subtotal || parseFloat(form.subtotal) <= 0) { setErr('El subtotal debe ser mayor a 0'); return }

    setSaving(true); setErr(null)
    try {
      const payload = {
        proyecto_id:       form.proyecto_id,
        numero_factura:    form.numero_factura.trim(),
        subtotal:          preview.subtotal,
        aplica_igv:        form.aplica_igv,
        aplica_detraccion: form.aplica_detraccion,
        pct_detraccion:    form.aplica_detraccion ? form.pct_detraccion : 0,
        estado:            form.estado,
        fecha_emision:     form.fecha_emision || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        fecha_cobro:       form.estado === 'cobrada' ? (form.fecha_cobro || null) : null,
        notas:             form.notas || null,
      }
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setErr(d.error ?? `Error ${res.status}`)
        return
      }
      const created = await res.json() as FacturaGlobal

      // Attach proyecto data (not returned by POST endpoint)
      const withProyecto: FacturaGlobal = {
        ...created,
        proyecto: selectedProyecto
          ? { id: selectedProyecto.id, nombre: selectedProyecto.nombre, cliente: selectedProyecto.cliente }
          : null,
      }

      // Upload pending files
      let finalArchivos: FacturaArchivoEntry[] = []
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch(`/api/proyectos/${created.proyecto_id}/facturas/${created.id}/archivos`, {
          method: 'POST', body: fd,
        })
        if (r.ok) {
          const updated = await r.json() as { archivos: FacturaArchivoEntry[] }
          finalArchivos = updated.archivos ?? finalArchivos
        }
      }

      onCreated({ ...withProyecto, archivos: finalArchivos })
      handleClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Nueva factura</DialogTitle>
          <DialogDescription className="sr-only">Crear factura y asociar a proyecto</DialogDescription>
        </DialogHeader>

        <div id={formId} className="space-y-4 pt-1">
          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
              <X size={12} /> {err}
            </div>
          )}

          {/* Proyecto */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Proyecto *</label>
            <ProyectoCombobox
              value={form.proyecto_id}
              proyectos={proyectos}
              onChange={(id, p) => { f('proyecto_id', id); setSelectedProyecto(p) }}
            />
            {selectedProyecto?.cliente && (
              <p className="mt-1 text-xs text-zinc-400">Cliente: {selectedProyecto.cliente.nombre}</p>
            )}
          </div>

          {/* Número */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Número de factura *</label>
            <input value={form.numero_factura} onChange={e => f('numero_factura', e.target.value)}
              placeholder="F001-00001"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>

          {/* Subtotal */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Subtotal (S/) *</label>
            <input type="number" step="0.01" min="0" value={form.subtotal}
              onChange={e => f('subtotal', e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400 tabular-nums"
            />
          </div>

          {/* IGV */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-700">+ IGV (18%)</span>
            <Toggle checked={form.aplica_igv} onChange={v => f('aplica_igv', v)} />
          </div>

          {/* Detracción */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-700">− Detracción</span>
              <Toggle checked={form.aplica_detraccion} onChange={v => f('aplica_detraccion', v)} />
            </div>
            {form.aplica_detraccion && (
              <select value={form.pct_detraccion} onChange={e => f('pct_detraccion', parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              >
                {PCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span className="tabular-nums font-mono">{formatMoney(preview.subtotal)}</span></div>
            {form.aplica_igv && <div className="flex justify-between text-zinc-500"><span>+ IGV 18%</span><span className="tabular-nums font-mono">{formatMoney(preview.igv)}</span></div>}
            {form.aplica_detraccion && <div className="flex justify-between text-red-500"><span>− Detracción {form.pct_detraccion}%</span><span className="tabular-nums font-mono">−{formatMoney(preview.det)}</span></div>}
            <div className="border-t border-zinc-200 pt-1.5 flex justify-between font-semibold text-zinc-800"><span>Total factura</span><span className="tabular-nums font-mono text-sm">{formatMoney(preview.total)}</span></div>
            <div className="flex justify-between text-emerald-700 font-medium"><span>Cliente abona</span><span className="tabular-nums font-mono">{formatMoney(preview.clienteAbona)}</span></div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Estado</label>
            <select value={form.estado} onChange={e => f('estado', e.target.value as FacturaGlobal['estado'])}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
            >
              {Object.entries(ESTADO_CFG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha emisión</label>
              <input type="date" value={form.fecha_emision} onChange={e => f('fecha_emision', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => f('fecha_vencimiento', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          {form.estado === 'cobrada' && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha cobro</label>
              <input type="date" value={form.fecha_cobro} onChange={e => f('fecha_cobro', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={2}
              placeholder="Notas de la factura…"
              className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Archivos */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">
              Archivos adjuntos
              <span className="text-zinc-400 font-normal"> (PDF, JPEG, PNG — máx. 10 MB c/u)</span>
            </label>
            {pendingFiles.length > 0 && (
              <div className="mb-2 space-y-1">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs">
                    <span className="flex-1 truncate text-blue-700 flex items-center gap-1.5">
                      <Upload size={10} className="shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <span className="text-zinc-400 shrink-0">{formatFileSize(file.size)}</span>
                    <button type="button" onClick={() => setPendingFiles(p => p.filter((_, i) => i !== idx))}
                      className="text-zinc-300 hover:text-red-500"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-3 py-3 text-xs text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors">
              <Upload size={14} />
              Agregar archivos…
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="sr-only" />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear factura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

interface Props {
  initialFacturas: FacturaGlobal[]
  proyectos: ProyectoBasico[]
}

export function FacturasClient({ initialFacturas, proyectos }: Props) {
  const [facturas, setFacturas] = useState<FacturaGlobal[]>(initialFacturas)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<FacturaGlobal['estado'] | 'todas'>('todas')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = useMemo(() => {
    return facturas.filter(f => {
      if (filterEstado !== 'todas' && f.estado !== filterEstado) return false
      if (search) {
        const q = search.toLowerCase()
        const num = f.numero_factura.toLowerCase().includes(q)
        const proy = f.proyecto?.nombre.toLowerCase().includes(q) ?? false
        const cli = f.proyecto?.cliente?.nombre.toLowerCase().includes(q) ?? false
        if (!num && !proy && !cli) return false
      }
      return true
    })
  }, [facturas, filterEstado, search])

  const totales = useMemo(() => ({
    subtotal: filtered.reduce((s, f) => s + f.subtotal, 0),
    igv:      filtered.reduce((s, f) => s + f.igv, 0),
    total:    filtered.reduce((s, f) => s + f.total, 0),
    abona:    filtered.reduce((s, f) => s + f.cliente_abona, 0),
  }), [filtered])

  async function handleEstadoChange(facturaId: string, estado: FacturaGlobal['estado']) {
    const res = await fetch(`/api/facturas/${facturaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado,
        fecha_cobro: estado === 'cobrada' ? new Date().toISOString().split('T')[0] : null,
      }),
    })
    if (res.ok) {
      const updated = await res.json() as { id: string; estado: string; fecha_cobro: string | null }
      setFacturas(prev => prev.map(f =>
        f.id === updated.id ? { ...f, estado: updated.estado as FacturaGlobal['estado'], fecha_cobro: updated.fecha_cobro } : f
      ))
    }
  }

  const estadoTabs: Array<{ value: FacturaGlobal['estado'] | 'todas'; label: string }> = [
    { value: 'todas',   label: 'Todas'   },
    { value: 'borrador', label: 'Borrador' },
    { value: 'emitida',  label: 'Emitida'  },
    { value: 'cobrada',  label: 'Cobrada'  },
    { value: 'vencida',  label: 'Vencida'  },
  ]

  return (
    <div className="flex flex-col gap-6 px-6 py-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Facturas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {facturas.length} factura{facturas.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
          <Plus size={15} /> Nueva factura
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Estado tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {estadoTabs.map(tab => (
            <button key={tab.value} onClick={() => setFilterEstado(tab.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filterEstado === tab.value
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, proyecto o cliente…"
            className="w-72 rounded-lg border border-zinc-200 bg-white pl-8 pr-8 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Número</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Proyecto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">Subtotal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">IGV</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Emisión</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">Archivos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-400">
                    {facturas.length === 0 ? 'Sin facturas registradas' : 'Sin resultados para los filtros aplicados'}
                  </td>
                </tr>
              ) : (
                filtered.map(factura => (
                  <tr key={factura.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {factura.numero_factura}
                    </td>
                    <td className="px-4 py-3">
                      {factura.proyecto ? (
                        <Link href={`/proyectos/${factura.proyecto.id}`}
                          className="text-blue-600 hover:underline truncate block max-w-[180px]">
                          {factura.proyecto.nombre}
                        </Link>
                      ) : (
                        <span className="text-zinc-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {factura.proyecto?.cliente?.nombre ?? <span className="text-zinc-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-zinc-700">
                      {formatMoney(factura.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-zinc-500">
                      {factura.aplica_igv ? formatMoney(factura.igv) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono font-semibold text-zinc-900">
                      {formatMoney(factura.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={factura.estado}
                        onChange={e => handleEstadoChange(factura.id, e.target.value as FacturaGlobal['estado'])}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold border-0 outline-none cursor-pointer',
                          ESTADO_CFG[factura.estado].cls,
                        )}
                        style={{ appearance: 'none' }}
                      >
                        {Object.entries(ESTADO_CFG).map(([v, { label }]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">
                      {factura.fecha_emision ? formatDate(factura.fecha_emision) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {factura.archivos?.length > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          {factura.archivos.map((a, i) => (
                            <button key={i} type="button" onClick={() => openStorageFile(a.path)}
                              title={a.name}
                              className="text-blue-400 hover:text-blue-600 transition-colors">
                              <Paperclip size={13} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-200">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    Total ({filtered.length})
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono font-semibold text-zinc-700">
                    {formatMoney(totales.subtotal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono font-semibold text-zinc-500">
                    {formatMoney(totales.igv)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono font-bold text-zinc-900">
                    {formatMoney(totales.total)}
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-right">
                    <span className="text-xs text-zinc-500">Cliente abona: </span>
                    <span className="tabular-nums font-mono font-semibold text-emerald-700">
                      {formatMoney(totales.abona)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <NuevaFacturaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        proyectos={proyectos}
        onCreated={f => setFacturas(prev => [f, ...prev])}
      />
    </div>
  )
}
