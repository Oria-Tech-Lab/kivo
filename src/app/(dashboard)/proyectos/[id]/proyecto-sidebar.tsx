'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import Link from 'next/link'
import {
  Tag, Check, ChevronDown, ChevronRight, Plus, Pencil,
  Trash2, X, AlertTriangle, RefreshCw, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn, formatDate, formatMoney, centavosToSoles, solesToCentavos } from '@/lib/utils'
import type { ProyectoData, ProyectoItem, ClienteData, FacturaProyecto, TeamMember } from './page'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  digital:     { label: 'Digital',     cls: 'bg-blue-100 text-blue-700'    },
  offline:     { label: 'Offline',     cls: 'bg-violet-100 text-violet-700' },
  evento:      { label: 'Evento',      cls: 'bg-pink-100 text-pink-700'    },
  instalacion: { label: 'Instalación', cls: 'bg-orange-100 text-orange-700' },
  otro:        { label: 'Otro',        cls: 'bg-zinc-100 text-zinc-600'    },
}
const TIPO_OPTIONS = [
  { value: 'digital',     label: 'Digital'     },
  { value: 'offline',     label: 'Offline'     },
  { value: 'evento',      label: 'Evento'      },
  { value: 'instalacion', label: 'Instalación' },
  { value: 'otro',        label: 'Otro'        },
]
const ESTADO_OPTIONS = [
  { value: 'activo',   label: 'Activo',   cls: 'text-emerald-700', dot: 'bg-emerald-500' },
  { value: 'en_pausa', label: 'En pausa', cls: 'text-amber-700',   dot: 'bg-amber-400'   },
  { value: 'cerrado',  label: 'Cerrado',  cls: 'text-zinc-500',    dot: 'bg-zinc-400'     },
]
const DETRACCION_OPTIONS = [
  { value: '0',  label: 'No aplica' },
  { value: '4',  label: '4%'        },
  { value: '10', label: '10%'       },
  { value: '12', label: '12%'       },
]
const PCT_DETRACCION_VENTA = [
  { value: '4',  label: '4%'  },
  { value: '10', label: '10%' },
  { value: '12', label: '12%' },
]
const FACTURA_ESTADO_CFG: Record<FacturaProyecto['estado'], { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'bg-zinc-100 text-zinc-500'        },
  emitida:  { label: 'Emitida',  cls: 'bg-blue-100 text-blue-700'        },
  cobrada:  { label: 'Cobrada',  cls: 'bg-emerald-100 text-emerald-700'  },
  vencida:  { label: 'Vencida',  cls: 'bg-red-100 text-red-600'          },
}

const MAX_NOTAS = 500

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">{children}</p>
  )
}

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
      <Check size={10} /> Guardado
    </span>
  )
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-blue-600' : 'bg-zinc-200',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

// ─── Inline date field ────────────────────────────────────────────────────────

function InlineDateField({ label, value, onSave, disabled, warnIfPast, accentRed }: {
  label: string; value: string | null; onSave: (v: string | null) => void
  disabled?: boolean; warnIfPast?: boolean; accentRed?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value ?? '')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setLocal(value ?? '') }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const isPast = warnIfPast && value && new Date(value) < new Date()

  function commit() {
    setEditing(false)
    if (local !== (value ?? '')) onSave(local || null)
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-zinc-400 shrink-0">{label}</dt>
      <dd>
        {editing ? (
          <input ref={ref} type="date" value={local}
            onChange={e => setLocal(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLocal(value ?? ''); setEditing(false) } }}
            className="w-36 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-right outline-none focus:border-blue-400"
          />
        ) : (
          <button onClick={() => !disabled && setEditing(true)}
            className={cn(
              'text-xs',
              isPast || accentRed ? 'text-red-600 font-medium' : 'text-zinc-700',
              !disabled && 'hover:underline cursor-pointer',
            )}
          >
            {value ? (
              <span>{formatDate(value)}{isPast && ' ⚠'}</span>
            ) : (
              <span className="text-zinc-300 italic">{disabled ? '—' : 'Agregar…'}</span>
            )}
          </button>
        )}
      </dd>
    </div>
  )
}

// ─── Cliente combobox ─────────────────────────────────────────────────────────

function ClienteCombobox({ value, clientes, onSave, onCreated, disabled }: {
  value: string | null
  clientes: ClienteData[]
  onSave: (id: string | null, cliente: ClienteData | null) => void
  onCreated: (c: ClienteData) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newRuc, setNewRuc] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = clientes.find(c => c.id === value)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.ruc ?? '').includes(search)
  )

  async function createCliente() {
    if (!newNombre.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newNombre.trim(), ruc: newRuc.trim() || null }),
      })
      if (res.ok) {
        const c = await res.json() as ClienteData
        onCreated(c); onSave(c.id, c); setOpen(false); setCreating(false)
      }
    } finally { setBusy(false) }
  }

  if (disabled) {
    return (
      <div>
        <p className="text-sm font-medium text-zinc-900">{current?.nombre ?? <span className="text-zinc-300 italic">Sin cliente</span>}</p>
        {current?.contacto_nombre && <p className="text-xs text-zinc-400 mt-0.5">{current.contacto_nombre}</p>}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <span className={cn('truncate text-left', !current && 'text-zinc-400 italic')}>
          {current?.nombre ?? 'Seleccionar cliente…'}
        </span>
        <ChevronDown size={13} className="text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden">
          {!creating ? (
            <>
              <div className="p-2 border-b border-zinc-100">
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o RUC…"
                  className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <button className="w-full px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-50 border-b border-zinc-100"
                  onMouseDown={() => { onSave(null, null); setOpen(false) }}>
                  — Sin cliente
                </button>
                {filtered.map(c => (
                  <button key={c.id} onMouseDown={() => { onSave(c.id, c); setOpen(false) }}
                    className={cn('w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 flex items-center justify-between', value === c.id && 'bg-zinc-100')}>
                    <div className="min-w-0">
                      <span className="block truncate">{c.nombre}</span>
                      {c.ruc && <span className="text-xs text-zinc-400 font-mono">{c.ruc}</span>}
                    </div>
                    {value === c.id && <Check size={12} className="text-zinc-500 shrink-0 ml-2" />}
                  </button>
                ))}
                {filtered.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">Sin resultados</p>}
              </div>
              <div className="border-t border-zinc-100">
                <button className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1.5"
                  onMouseDown={() => { setCreating(true); setNewNombre(search); setSearch('') }}>
                  <Plus size={11} /> Crear &ldquo;{search || 'nuevo cliente'}&rdquo;
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-zinc-700">Nuevo cliente</p>
              <input autoFocus value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre *"
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                onKeyDown={e => e.key === 'Enter' && createCliente()}
              />
              <input value={newRuc} onChange={e => setNewRuc(e.target.value)} placeholder="RUC (opcional)"
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={createCliente} disabled={!newNombre.trim() || busy}>
                  {busy ? 'Creando…' : 'Crear'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Factura Dialog ───────────────────────────────────────────────────────────

interface FacturaFormState {
  numero_factura: string
  subtotal: string
  aplica_igv: boolean
  aplica_detraccion: boolean
  pct_detraccion: number
  estado: FacturaProyecto['estado']
  fecha_emision: string
  fecha_vencimiento: string
  fecha_cobro: string
  notas: string
}

function emptyForm(defaults?: Partial<FacturaProyecto>): FacturaFormState {
  return {
    numero_factura:    defaults?.numero_factura ?? '',
    subtotal:          defaults ? centavosToSoles(defaults.subtotal ?? 0).toFixed(2) : '',
    aplica_igv:        defaults?.aplica_igv ?? true,
    aplica_detraccion: defaults?.aplica_detraccion ?? false,
    pct_detraccion:    defaults?.pct_detraccion ?? 10,
    estado:            defaults?.estado ?? 'borrador',
    fecha_emision:     defaults?.fecha_emision ?? '',
    fecha_vencimiento: defaults?.fecha_vencimiento ?? '',
    fecha_cobro:       defaults?.fecha_cobro ?? '',
    notas:             defaults?.notas ?? '',
  }
}

function calcPreview(form: FacturaFormState) {
  const subtotal      = solesToCentavos(parseFloat(form.subtotal) || 0)
  const igv           = form.aplica_igv ? Math.round(subtotal * 18 / 100) : 0
  const total         = subtotal + igv
  const det           = form.aplica_detraccion ? Math.round(total * form.pct_detraccion / 100) : 0
  const clienteAbona  = total - det
  return { subtotal, igv, total, det, clienteAbona }
}

function FacturaDialog({ open, onClose, factura, proyectoId, onSaved, defaultDetPct }: {
  open: boolean
  onClose: () => void
  factura: FacturaProyecto | null
  proyectoId: string
  onSaved: (f: FacturaProyecto) => void
  defaultDetPct: number
}) {
  const isEdit = !!factura
  const [form, setForm] = useState<FacturaFormState>(() =>
    emptyForm(factura ?? { aplica_detraccion: false, pct_detraccion: defaultDetPct > 0 ? defaultDetPct : 10 })
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const formId = useId()

  useEffect(() => {
    if (open) {
      setForm(emptyForm(factura ?? { aplica_detraccion: false, pct_detraccion: defaultDetPct > 0 ? defaultDetPct : 10 }))
      setErr(null)
    }
  }, [open, factura, defaultDetPct])

  const preview = calcPreview(form)

  const f = (k: keyof FacturaFormState, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSave() {
    if (!form.numero_factura.trim()) { setErr('El número de factura es requerido'); return }
    if (!form.subtotal || parseFloat(form.subtotal) <= 0) { setErr('El subtotal debe ser mayor a 0'); return }

    setSaving(true); setErr(null)
    try {
      const payload = {
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
      const url = isEdit
        ? `/api/proyectos/${proyectoId}/facturas/${factura!.id}`
        : `/api/proyectos/${proyectoId}/facturas`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setErr(d.error ?? `Error ${res.status}`)
        return
      }
      onSaved(await res.json() as FacturaProyecto)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar factura' : 'Nueva factura'}</DialogTitle>
          <DialogDescription className="sr-only">Formulario de factura emitida al cliente</DialogDescription>
        </DialogHeader>

        <div id={formId} className="space-y-4 pt-1">
          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
              <X size={12} /> {err}
            </div>
          )}

          {/* Número de factura */}
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
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 tabular-nums"
            />
          </div>

          {/* IGV toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-700">+ IGV (18%)</span>
            <Toggle checked={form.aplica_igv} onChange={v => f('aplica_igv', v)} />
          </div>

          {/* Detracción toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-700">− Detracción</span>
              <Toggle checked={form.aplica_detraccion} onChange={v => f('aplica_detraccion', v)} />
            </div>
            {form.aplica_detraccion && (
              <select value={form.pct_detraccion}
                onChange={e => f('pct_detraccion', parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              >
                {PCT_DETRACCION_VENTA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            <select value={form.estado} onChange={e => f('estado', e.target.value as FacturaProyecto['estado'])}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
            >
              {Object.entries(FACTURA_ESTADO_CFG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
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
            <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={2} placeholder="Notas de la factura…"
              className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Crear factura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Factura Card ─────────────────────────────────────────────────────────────

function FacturaCard({ factura, canEdit, onEdit, onDelete }: {
  factura: FacturaProyecto
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const cfg = FACTURA_ESTADO_CFG[factura.estado]

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-50" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown size={13} className="text-zinc-400 shrink-0" /> : <ChevronRight size={13} className="text-zinc-400 shrink-0" />}
        <span className="text-sm font-medium text-zinc-800 flex-1 min-w-0 truncate">{factura.numero_factura}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0', cfg.cls)}>{cfg.label}</span>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1 text-zinc-400 hover:text-zinc-700 rounded"><Pencil size={11} /></button>
            <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1 text-zinc-300 hover:text-red-500 rounded"><Trash2 size={11} /></button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-zinc-100 pt-2.5 text-xs">
          <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span className="tabular-nums font-mono">{formatMoney(factura.subtotal)}</span></div>
          {factura.aplica_igv && <div className="flex justify-between text-zinc-500"><span>+ IGV 18%</span><span className="tabular-nums font-mono">{formatMoney(factura.igv)}</span></div>}
          {factura.aplica_detraccion && <div className="flex justify-between text-red-500"><span>− Detracción {factura.pct_detraccion}%</span><span className="tabular-nums font-mono">−{formatMoney(factura.monto_detraccion)}</span></div>}
          <div className="flex justify-between border-t border-zinc-100 pt-1.5 font-semibold text-zinc-800"><span>Total factura</span><span className="tabular-nums font-mono">{formatMoney(factura.total)}</span></div>
          <div className="flex justify-between text-emerald-700 font-medium"><span>Cliente abona</span><span className="tabular-nums font-mono">{formatMoney(factura.cliente_abona)}</span></div>
          {factura.fecha_emision && <div className="flex justify-between text-zinc-400"><span>Emisión</span><span>{formatDate(factura.fecha_emision)}</span></div>}
          {factura.fecha_vencimiento && <div className="flex justify-between text-zinc-400"><span>Vencimiento</span><span>{formatDate(factura.fecha_vencimiento)}</span></div>}
          {factura.fecha_cobro && <div className="flex justify-between text-zinc-400"><span>Cobro</span><span>{formatDate(factura.fecha_cobro)}</span></div>}
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  proyecto: ProyectoData
  canEdit: boolean
  items: ProyectoItem[]
  clientes: ClienteData[]
  initialFacturas: FacturaProyecto[]
  onProyectoUpdate: (fields: Partial<ProyectoData>) => void
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function ProyectoSidebar({
  proyecto, canEdit, items, clientes: initialClientes, initialFacturas, onProyectoUpdate,
}: Props) {
  const [clientes, setClientes]       = useState<ClienteData[]>(initialClientes)
  const [facturas, setFacturas]       = useState<FacturaProyecto[]>(initialFacturas)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [notas, setNotas]             = useState(proyecto.notas ?? '')
  const [estadoSaved, setEstadoSaved] = useState(false)
  const [infoSaved, setInfoSaved]     = useState(false)
  const [notasSaved, setNotasSaved]   = useState(false)
  const [facturaSaved, setFacturaSaved] = useState(false)
  const [facturaDialog, setFacturaDialog] = useState<{ open: boolean; factura: FacturaProyecto | null }>({ open: false, factura: null })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load team members client-side
  useEffect(() => {
    fetch('/api/equipo')
      .then(r => r.ok ? r.json() : [])
      .then((d: TeamMember[]) => setTeamMembers(d))
      .catch(() => { /* silent */ })
  }, [])

  // Derived billing
  const subtotalItems = items.reduce((s, i) => s + i.precio_venta, 0)
  const totalGastos   = items.reduce((s, i) => s + i.gasto_real, 0)
  const subtotal      = proyecto.subtotal_proyecto
  const igvMonto      = proyecto.aplica_igv_venta ? Math.round(subtotal * 18 / 100) : 0
  const totalConIGV   = subtotal + igvMonto
  const detMonto      = proyecto.aplica_detraccion_venta ? Math.round(totalConIGV * proyecto.pct_detraccion_venta / 100) : 0
  const totalNeto     = totalConIGV - detMonto
  const margenNeto    = totalNeto - totalGastos
  const margenPct     = totalNeto > 0 ? (margenNeto / totalNeto) * 100 : null

  const subtotalDifiere = subtotalItems > 0 && subtotalItems !== subtotal

  // Facturas resumen
  const totalFacturado    = facturas.reduce((s, f) => s + f.subtotal, 0)
  const totalIGVEmitido   = facturas.reduce((s, f) => s + f.igv, 0)
  const totalDetracciones = facturas.reduce((s, f) => s + f.monto_detraccion, 0)
  const totalAcobrar      = facturas.reduce((s, f) => s + f.cliente_abona, 0)
  const diferencia        = subtotal - totalFacturado

  const hoy = new Date()
  const cierreVencido = proyecto.fecha_cierre_est && new Date(proyecto.fecha_cierre_est) < hoy && proyecto.estado !== 'cerrado'

  // ── API helper ──────────────────────────────────────────────────────────────

  async function patch(fields: Partial<ProyectoData>) {
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) onProyectoUpdate(await res.json() as Partial<ProyectoData>)
    } catch { /* silent */ }
  }

  function flash(setter: (v: boolean) => void) {
    setter(true); setTimeout(() => setter(false), 2000)
  }

  // ── Estado ──────────────────────────────────────────────────────────────────

  async function handleEstadoChange(next: string) {
    onProyectoUpdate({ estado: next })
    await patch({ estado: next as ProyectoData['estado'] })
    flash(setEstadoSaved)
  }

  // ── Notas ───────────────────────────────────────────────────────────────────

  const saveNotas = useCallback(async (value: string) => {
    await patch({ notas: value || null })
    flash(setNotasSaved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  function handleNotasChange(value: string) {
    if (value.length > MAX_NOTAS) return
    setNotas(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNotas(value), 800)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // ── Info inline save ────────────────────────────────────────────────────────

  async function saveInfo(fields: Partial<ProyectoData>) {
    onProyectoUpdate(fields)
    await patch(fields)
    flash(setInfoSaved)
  }

  // ── Facturación ─────────────────────────────────────────────────────────────

  async function patchFacturacion(fields: Partial<ProyectoData>) {
    onProyectoUpdate(fields)
    await patch(fields)
    flash(setFacturaSaved)
  }

  async function handleSyncSubtotal() {
    await patchFacturacion({ subtotal_proyecto: subtotalItems })
  }

  // ── Facturas CRUD ────────────────────────────────────────────────────────────

  async function deleteFactura(id: string) {
    if (!confirm('¿Eliminar esta factura?')) return
    const res = await fetch(`/api/proyectos/${proyecto.id}/facturas/${id}`, { method: 'DELETE' })
    if (res.ok) setFacturas(prev => prev.filter(f => f.id !== id))
  }

  const estadoCfg = ESTADO_OPTIONS.find(o => o.value === proyecto.estado)

  return (
    <div className="flex flex-col">

      {/* ── 1. ESTADO ────────────────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Estado del proyecto</SectionTitle>
          <SavedBadge show={estadoSaved} />
        </div>
        {canEdit ? (
          <>
            <select value={proyecto.estado} onChange={e => handleEstadoChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            >
              {ESTADO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {estadoCfg && (
              <div className={cn('mt-2 flex items-center gap-1.5 text-xs font-medium', estadoCfg.cls)}>
                <span className={cn('inline-block h-2 w-2 rounded-full', estadoCfg.dot)} />
                {estadoCfg.label}
              </div>
            )}
          </>
        ) : (
          estadoCfg && (
            <div className={cn('flex items-center gap-1.5 text-sm font-medium', estadoCfg.cls)}>
              <span className={cn('inline-block h-2 w-2 rounded-full', estadoCfg.dot)} />
              {estadoCfg.label}
            </div>
          )
        )}
      </div>

      <Separator />

      {/* ── 2. INFORMACIÓN ───────────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Información del proyecto</SectionTitle>
          <SavedBadge show={infoSaved} />
        </div>

        <div className="space-y-4">

          {/* Cliente */}
          <div>
            <p className="text-xs text-zinc-400 mb-1.5">Cliente</p>
            <ClienteCombobox
              value={proyecto.cliente_id}
              clientes={clientes}
              disabled={!canEdit}
              onCreated={c => setClientes(prev => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
              onSave={(id, cliente) => {
                onProyectoUpdate({ cliente_id: id, cliente: cliente ?? undefined })
                patch({ cliente_id: id })
                flash(setInfoSaved)
              }}
            />
            {proyecto.cliente && (
              <div className="mt-1.5 space-y-0.5">
                {proyecto.cliente.contacto_nombre && (
                  <p className="text-xs text-zinc-400">{proyecto.cliente.contacto_nombre}</p>
                )}
                <Link href={`/clientes/${proyecto.cliente.id}`} className="text-xs text-blue-600 hover:underline block">
                  Ver cliente →
                </Link>
              </div>
            )}
          </div>

          {/* Responsable */}
          {(canEdit || proyecto.responsable_id) && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-zinc-400 shrink-0 flex items-center gap-1"><User size={11} /> Responsable</dt>
              <dd>
                {canEdit ? (
                  <select value={proyecto.responsable_id ?? ''}
                    onChange={e => saveInfo({ responsable_id: e.target.value || null })}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">— Sin asignar</option>
                    {teamMembers.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.nombre || m.email}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-zinc-700">
                    {teamMembers.find(m => m.user_id === proyecto.responsable_id)?.nombre ?? proyecto.responsable_id?.slice(0, 8) ?? '—'}
                  </span>
                )}
              </dd>
            </div>
          )}

          <dl className="space-y-2.5">
            {/* Tipo */}
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-zinc-400 shrink-0">Tipo</dt>
              <dd>
                {canEdit ? (
                  <select value={proyecto.tipo} onChange={e => saveInfo({ tipo: e.target.value })}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', (TIPO_BADGE[proyecto.tipo] ?? TIPO_BADGE['otro']).cls)}>
                    {(TIPO_BADGE[proyecto.tipo] ?? TIPO_BADGE['otro']).label}
                  </span>
                )}
              </dd>
            </div>

            {/* Fecha inicio */}
            <InlineDateField label="Inicio" value={proyecto.fecha_inicio}
              disabled={!canEdit} onSave={v => saveInfo({ fecha_inicio: v ?? proyecto.fecha_inicio })} />

            {/* Cierre estimado */}
            <InlineDateField label="Cierre est." value={proyecto.fecha_cierre_est}
              disabled={!canEdit} warnIfPast={!!cierreVencido} accentRed={!!cierreVencido}
              onSave={v => saveInfo({ fecha_cierre_est: v })} />

            {/* Detracción costos */}
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-zinc-400 shrink-0">Detr. costos</dt>
              <dd>
                {canEdit ? (
                  <select value={proyecto.aplica_detraccion ? '10' : '0'}
                    onChange={e => saveInfo({ aplica_detraccion: e.target.value !== '0' })}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {DETRACCION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  proyecto.aplica_detraccion ? (
                    <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Sí 10%</span>
                  ) : (
                    <span className="text-xs text-zinc-400">No aplica</span>
                  )
                )}
              </dd>
            </div>

            {/* Categoría (read-only) */}
            {proyecto.categoria && (
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1 text-xs text-zinc-400"><Tag size={11} /> Categoría</dt>
                <dd className="flex items-center gap-1.5 text-xs text-zinc-700">
                  {proyecto.categoria.color && (
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: proyecto.categoria.color }} />
                  )}
                  {proyecto.categoria.nombre}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <Separator />

      {/* ── 3. FACTURACIÓN AL CLIENTE ────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Facturación al cliente</SectionTitle>
          <SavedBadge show={facturaSaved} />
        </div>

        {/* Subtotal editable */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Subtotal proyecto</span>
            {canEdit ? (
              <InlineMoneyInput
                value={subtotal}
                onSave={v => patchFacturacion({ subtotal_proyecto: v })}
              />
            ) : (
              <span className="text-sm font-bold tabular-nums font-mono text-zinc-900">
                {subtotal > 0 ? formatMoney(subtotal) : '—'}
              </span>
            )}
          </div>
          {subtotalDifiere && canEdit && (
            <button onClick={handleSyncSubtotal}
              className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
              <RefreshCw size={9} /> Sincronizar desde ítems ({formatMoney(subtotalItems)})
            </button>
          )}
        </div>

        {/* IGV toggle */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">+ IGV (18%)</span>
          <div className="flex items-center gap-2">
            {proyecto.aplica_igv_venta && (
              <span className="text-xs tabular-nums font-mono text-zinc-500">{formatMoney(igvMonto)}</span>
            )}
            {canEdit ? (
              <Toggle checked={proyecto.aplica_igv_venta} onChange={v => patchFacturacion({ aplica_igv_venta: v })} />
            ) : (
              <span className="text-xs text-zinc-400">{proyecto.aplica_igv_venta ? 'Sí' : 'No'}</span>
            )}
          </div>
        </div>

        {/* Detracción */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500 shrink-0">− Detracción</span>
          <div className="flex items-center gap-1.5">
            {proyecto.aplica_detraccion_venta && (
              <>
                {canEdit ? (
                  <select value={proyecto.pct_detraccion_venta}
                    onChange={e => patchFacturacion({ pct_detraccion_venta: parseInt(e.target.value, 10) })}
                    className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-blue-400"
                  >
                    {PCT_DETRACCION_VENTA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-zinc-500">{proyecto.pct_detraccion_venta}%</span>
                )}
                <span className="text-xs tabular-nums font-mono text-red-500">−{formatMoney(detMonto)}</span>
              </>
            )}
            {canEdit ? (
              <Toggle checked={proyecto.aplica_detraccion_venta} onChange={v => patchFacturacion({ aplica_detraccion_venta: v })} />
            ) : (
              <span className="text-xs text-zinc-400">{proyecto.aplica_detraccion_venta ? 'Sí' : 'No'}</span>
            )}
          </div>
        </div>

        {/* Total neto */}
        <div className="mt-3 pt-3 border-t border-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600">Total a cobrar</span>
            <span className="text-base font-bold tabular-nums font-mono text-zinc-900">
              {totalNeto > 0 ? formatMoney(totalNeto) : '—'}
            </span>
          </div>
          {(totalNeto > 0 || totalGastos > 0) && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Margen neto</span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                margenPct === null ? 'bg-zinc-100 text-zinc-400'
                : margenPct >= 30 ? 'bg-emerald-100 text-emerald-700'
                : margenPct >= 15 ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700',
              )}>
                {margenPct !== null ? `${margenPct.toFixed(0)}%` : '—'}
                <span className="font-mono font-normal opacity-75">
                  {margenNeto >= 0 ? '+' : ''}{formatMoney(margenNeto)}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* ── 4. FACTURAS EMITIDAS ─────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Facturas emitidas</SectionTitle>
          {canEdit && (
            <button onClick={() => setFacturaDialog({ open: true, factura: null })}
              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 transition-colors">
              <Plus size={11} /> Agregar
            </button>
          )}
        </div>

        {facturas.length === 0 ? (
          <p className="text-xs text-zinc-300 italic">Sin facturas registradas</p>
        ) : (
          <div className="space-y-2">
            {facturas.map(f => (
              <FacturaCard key={f.id} factura={f} canEdit={canEdit}
                onEdit={() => setFacturaDialog({ open: true, factura: f })}
                onDelete={() => deleteFactura(f.id)}
              />
            ))}
          </div>
        )}

        {/* Alerta diferencia */}
        {facturas.length > 0 && subtotal > 0 && (
          <div className={cn(
            'mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
            diferencia === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : diferencia > 0 ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-red-50 border-red-200 text-red-600',
          )}>
            {diferencia === 0
              ? <><Check size={12} className="mt-0.5 shrink-0" /> El total del proyecto está completamente facturado</>
              : <><AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {diferencia > 0
                    ? `Falta facturar ${formatMoney(diferencia)} para cubrir el total del proyecto`
                    : `Las facturas superan el total del proyecto por ${formatMoney(Math.abs(diferencia))}`}
                </>
            }
          </div>
        )}

        {/* Resumen consolidado */}
        {facturas.length > 0 && (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-500"><span>Total facturado</span><span className="tabular-nums font-mono">{formatMoney(totalFacturado)}</span></div>
            {totalIGVEmitido > 0 && <div className="flex justify-between text-zinc-500"><span>IGV emitido</span><span className="tabular-nums font-mono">{formatMoney(totalIGVEmitido)}</span></div>}
            {totalDetracciones > 0 && <div className="flex justify-between text-red-500"><span>Detracciones</span><span className="tabular-nums font-mono">−{formatMoney(totalDetracciones)}</span></div>}
            <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-semibold text-zinc-800"><span>Total a cobrar</span><span className="tabular-nums font-mono">{formatMoney(totalAcobrar)}</span></div>
          </div>
        )}
      </div>

      <Separator />

      {/* ── 5. NOTAS ─────────────────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>Notas</SectionTitle>
          <SavedBadge show={notasSaved} />
        </div>
        {canEdit ? (
          <>
            <textarea value={notas} onChange={e => handleNotasChange(e.target.value)}
              placeholder="Agregar nota sobre el proyecto..." rows={4}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
            <div className="mt-1 flex justify-end">
              <span className={cn('text-[10px]', notas.length > MAX_NOTAS * 0.9 ? 'text-amber-500' : 'text-zinc-300')}>
                {notas.length}/{MAX_NOTAS}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">
            {notas || <span className="text-zinc-300 italic">Sin notas</span>}
          </p>
        )}
      </div>

      {/* ── Factura Dialog ────────────────────────────────────────────────── */}
      <FacturaDialog
        open={facturaDialog.open}
        onClose={() => setFacturaDialog({ open: false, factura: null })}
        factura={facturaDialog.factura}
        proyectoId={proyecto.id}
        defaultDetPct={proyecto.pct_detraccion_venta}
        onSaved={f => setFacturas(prev =>
          facturaDialog.factura
            ? prev.map(x => x.id === f.id ? f : x)
            : [...prev, f]
        )}
      />
    </div>
  )
}

// ─── Inline money input for sidebar ──────────────────────────────────────────

function InlineMoneyInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(centavosToSoles(value).toFixed(2))
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(centavosToSoles(value).toFixed(2)) }, [value])
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  function commit() {
    setEditing(false)
    const n = parseFloat(local)
    const centavos = isNaN(n) ? value : solesToCentavos(n)
    if (centavos !== value) onSave(centavos)
  }

  if (editing) {
    return (
      <input ref={ref} type="number" step="0.01" min="0" value={local}
        onChange={e => setLocal(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLocal(centavosToSoles(value).toFixed(2)); setEditing(false) } }}
        className="w-28 rounded border border-zinc-300 bg-white px-2 py-0.5 text-sm text-right tabular-nums outline-none focus:border-blue-400"
      />
    )
  }

  return (
    <button onClick={() => setEditing(true)}
      className="text-sm font-bold tabular-nums font-mono text-zinc-900 hover:text-blue-600 hover:underline cursor-pointer">
      {value > 0 ? formatMoney(value) : <span className="text-zinc-300 italic font-normal text-xs">Agregar…</span>}
    </button>
  )
}
