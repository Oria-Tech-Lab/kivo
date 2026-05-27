'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Tag, Check, ChevronDown } from 'lucide-react'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import type { ProyectoData, ProyectoItem } from './page'

// ─── Types ────────────────────────────────────────────────────────────────────

type PatchPayload = {
  estado?: 'activo' | 'en_pausa' | 'cerrado'
  notas?: string | null
  tipo?: string
  fecha_inicio?: string
  fecha_cierre_est?: string | null
  subtotal_proyecto?: number
  aplica_igv_venta?: boolean
  aplica_detraccion_venta?: boolean
  pct_detraccion_venta?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  digital:     { label: 'Digital',     cls: 'bg-blue-100 text-blue-700' },
  offline:     { label: 'Offline',     cls: 'bg-violet-100 text-violet-700' },
  evento:      { label: 'Evento',      cls: 'bg-pink-100 text-pink-700' },
  instalacion: { label: 'Instalación', cls: 'bg-orange-100 text-orange-700' },
  otro:        { label: 'Otro',        cls: 'bg-zinc-100 text-zinc-600' },
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

const MAX_NOTAS = 800

// ─── Mini components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{children}</p>
}

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
      <Check size={10} /> Guardado
    </span>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
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

// ─── Inline editable text field ───────────────────────────────────────────────

function InlineField({ label, value, displayValue, onSave, disabled, type = 'text', placeholder }: {
  label: string
  value: string
  displayValue?: string
  onSave: (v: string) => void
  disabled?: boolean
  type?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(value) }, [value])
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  function commit() {
    setEditing(false)
    if (local !== value) onSave(local)
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-zinc-400 shrink-0">{label}</dt>
      <dd className="text-right">
        {editing ? (
          <input
            ref={ref} type={type} value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') { setLocal(value); setEditing(false) }
            }}
            className="w-32 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-right outline-none focus:border-blue-400"
            placeholder={placeholder}
          />
        ) : (
          <button
            onClick={() => !disabled && setEditing(true)}
            className={cn(
              'text-xs',
              !disabled && 'hover:text-blue-600 hover:underline cursor-pointer text-zinc-700',
              disabled && 'cursor-default text-zinc-700',
            )}
          >
            {(displayValue ?? value) || <span className="text-zinc-300 italic">{placeholder ?? '—'}</span>}
          </button>
        )}
      </dd>
    </div>
  )
}

// ─── Inline select ────────────────────────────────────────────────────────────

function InlineTipoSelect({ value, onSave, disabled }: {
  value: string; onSave: (v: string) => void; disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLSelectElement>(null)
  const badge = TIPO_BADGE[value] ?? TIPO_BADGE['otro']

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  if (editing) {
    return (
      <select
        ref={ref}
        defaultValue={value}
        onChange={e => { onSave(e.target.value); setEditing(false) }}
        onBlur={() => setEditing(false)}
        className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs outline-none focus:border-blue-400"
      >
        {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  return (
    <button
      onClick={() => !disabled && setEditing(true)}
      className={cn('flex items-center gap-0.5', !disabled && 'cursor-pointer')}
    >
      <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', badge.cls)}>{badge.label}</span>
      {!disabled && <ChevronDown size={10} className="text-zinc-400" />}
    </button>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  proyecto: ProyectoData
  canEdit: boolean
  items: ProyectoItem[]
  onProyectoUpdate: (fields: PatchPayload) => void
}

// ─── Main Sidebar Component ───────────────────────────────────────────────────

export function ProyectoSidebar({ proyecto, canEdit, items, onProyectoUpdate }: Props) {
  const [estado, setEstado]         = useState(proyecto.estado)
  const [notas, setNotas]           = useState(proyecto.notas ?? '')
  const [apIGV, setApIGV]           = useState(proyecto.aplica_igv_venta)
  const [apDet, setApDet]           = useState(proyecto.aplica_detraccion_venta)
  const [pctDet, setPctDet]         = useState(proyecto.pct_detraccion_venta)
  const [pctDetInput, setPctDetInput] = useState(String(proyecto.pct_detraccion_venta))

  const [estadoSaved, setEstadoSaved]     = useState(false)
  const [notasSaved, setNotasSaved]       = useState(false)
  const [facturaSaved, setFacturaSaved]   = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived billing numbers
  const subtotalItems = items.reduce((s, i) => s + i.precio_venta, 0)
  const totalGastos   = items.reduce((s, i) => s + i.gasto_real,   0)
  const igvMonto      = apIGV ? Math.round(subtotalItems * 0.18) : 0
  const totalConIGV   = subtotalItems + igvMonto
  const detMonto      = apDet ? Math.round(totalConIGV * pctDet / 100) : 0
  const totalNeto     = totalConIGV - detMonto
  const margenNeto    = totalNeto - totalGastos
  const margenPct     = totalNeto > 0 ? (margenNeto / totalNeto) * 100 : null

  const hoy = new Date()
  const cierreVencido = proyecto.fecha_cierre_est &&
    new Date(proyecto.fecha_cierre_est) < hoy && estado !== 'cerrado'

  // ── API helper ──────────────────────────────────────────────────────────────

  async function patch(fields: PatchPayload) {
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) onProyectoUpdate(await res.json() as PatchPayload)
    } catch { /* silent */ }
  }

  function flashSaved(setter: (v: boolean) => void) {
    setter(true); setTimeout(() => setter(false), 2000)
  }

  // ── Estado ──────────────────────────────────────────────────────────────────

  async function handleEstadoChange(next: string) {
    setEstado(next)
    await patch({ estado: next as 'activo' | 'en_pausa' | 'cerrado' })
    flashSaved(setEstadoSaved)
  }

  // ── Notas ───────────────────────────────────────────────────────────────────

  const saveNotas = useCallback(async (value: string) => {
    await patch({ notas: value || null })
    flashSaved(setNotasSaved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  function handleNotasChange(value: string) {
    if (value.length > MAX_NOTAS) return
    setNotas(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNotas(value), 800)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // ── Facturación ─────────────────────────────────────────────────────────────

  async function handleToggleIGV(val: boolean) {
    setApIGV(val)
    await patch({ aplica_igv_venta: val })
    flashSaved(setFacturaSaved)
  }

  async function handleToggleDet(val: boolean) {
    setApDet(val)
    await patch({ aplica_detraccion_venta: val })
    flashSaved(setFacturaSaved)
  }

  async function handlePctDetBlur() {
    const n = parseInt(pctDetInput, 10)
    const clamped = isNaN(n) ? 0 : Math.max(0, Math.min(100, n))
    setPctDet(clamped)
    setPctDetInput(String(clamped))
    await patch({ pct_detraccion_venta: clamped })
    flashSaved(setFacturaSaved)
  }

  const estadoCfg = ESTADO_OPTIONS.find(o => o.value === estado)

  return (
    <div className="flex flex-col divide-y divide-[#e2e8f0]">

      {/* ── FACTURACIÓN AL CLIENTE ─────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Facturación al cliente</SectionTitle>
          <SavedBadge show={facturaSaved} />
        </div>

        {/* Subtotal from items */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Subtotal ítems</span>
          <span className="text-sm font-bold tabular-nums font-mono text-zinc-900">
            {subtotalItems > 0 ? formatMoney(subtotalItems) : '—'}
          </span>
        </div>

        {/* IGV toggle */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">+ IGV (18%)</span>
          <div className="flex items-center gap-2">
            {apIGV && (
              <span className="text-xs tabular-nums font-mono text-zinc-500">
                {formatMoney(igvMonto)}
              </span>
            )}
            {canEdit ? (
              <Toggle checked={apIGV} onChange={handleToggleIGV} />
            ) : (
              <span className="text-xs text-zinc-400">{apIGV ? 'Sí' : 'No'}</span>
            )}
          </div>
        </div>

        {/* Detracción toggle */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500 shrink-0">− Detracción</span>
          <div className="flex items-center gap-1.5">
            {apDet && (
              <>
                {canEdit ? (
                  <input
                    type="number" min="0" max="100" step="1"
                    value={pctDetInput}
                    onChange={e => setPctDetInput(e.target.value)}
                    onBlur={handlePctDetBlur}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-12 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-right outline-none focus:border-blue-400"
                  />
                ) : (
                  <span className="text-xs text-zinc-500">{pctDet}</span>
                )}
                <span className="text-xs text-zinc-400">%</span>
                <span className="text-xs tabular-nums font-mono text-red-500">
                  −{formatMoney(detMonto)}
                </span>
              </>
            )}
            {canEdit ? (
              <Toggle checked={apDet} onChange={handleToggleDet} />
            ) : (
              <span className="text-xs text-zinc-400">{apDet ? 'Sí' : 'No'}</span>
            )}
          </div>
        </div>

        {/* Total a cobrar */}
        <div className="mt-3 pt-3 border-t border-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600">Total a cobrar</span>
            <span className="text-base font-bold tabular-nums font-mono text-zinc-900">
              {totalNeto > 0 ? formatMoney(totalNeto) : '—'}
            </span>
          </div>

          {/* Margen badge */}
          {(totalNeto > 0 || totalGastos > 0) && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Margen neto</span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                margenNeto >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
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

      {/* ── CLIENTE ────────────────────────────────────────────────────── */}
      {proyecto.cliente && (
        <div className="p-5">
          <SectionTitle>Cliente</SectionTitle>
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-zinc-200">
              <Building2 size={14} className="text-zinc-500" />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-sm text-zinc-900 truncate">{proyecto.cliente.nombre}</p>
              {proyecto.cliente.ruc && (
                <p className="text-xs text-zinc-400 font-mono">{proyecto.cliente.ruc}</p>
              )}
              {proyecto.cliente.contacto_nombre && (
                <p className="text-xs text-zinc-500 mt-0.5">{proyecto.cliente.contacto_nombre}</p>
              )}
            </div>
          </div>
          <Link href={`/clientes/${proyecto.cliente.id}/editar`} className="mt-3 block text-xs text-blue-600 hover:underline">
            Ver / editar cliente →
          </Link>
        </div>
      )}

      {/* ── INFORMACIÓN ────────────────────────────────────────────────── */}
      <div className="p-5">
        <SectionTitle>Información</SectionTitle>
        <dl className="space-y-2.5">

          {/* Tipo */}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-zinc-400 shrink-0">Tipo</dt>
            <dd>
              <InlineTipoSelect
                value={proyecto.tipo}
                onSave={v => patch({ tipo: v })}
                disabled={!canEdit}
              />
            </dd>
          </div>

          {/* Fecha inicio */}
          <InlineField
            label="Inicio"
            value={proyecto.fecha_inicio}
            displayValue={formatDate(proyecto.fecha_inicio)}
            type="date"
            disabled={!canEdit}
            onSave={v => patch({ fecha_inicio: v })}
          />

          {/* Fecha cierre est. */}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-zinc-400 shrink-0">Cierre est.</dt>
            <dd className={cn('text-xs font-medium', cierreVencido ? 'text-red-600' : 'text-zinc-700')}>
              {proyecto.fecha_cierre_est ? formatDate(proyecto.fecha_cierre_est) : (
                <span className="text-zinc-300 italic">—</span>
              )}
              {cierreVencido && ' ⚠'}
            </dd>
          </div>

          {/* Detracción costos */}
          <div className="flex items-center justify-between">
            <dt className="text-xs text-zinc-400">Detr. costos</dt>
            <dd>
              {proyecto.aplica_detraccion ? (
                <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Sí 10%</span>
              ) : (
                <span className="text-xs text-zinc-400">No aplica</span>
              )}
            </dd>
          </div>

          {/* Categoría */}
          {proyecto.categoria && (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Tag size={12} /> Categoría
              </dt>
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

      {/* ── ESTADO ─────────────────────────────────────────────────────── */}
      {canEdit && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Estado</SectionTitle>
            <SavedBadge show={estadoSaved} />
          </div>
          <select
            value={estado}
            onChange={e => handleEstadoChange(e.target.value)}
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
        </div>
      )}

      {/* ── NOTAS ──────────────────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>Notas</SectionTitle>
          <SavedBadge show={notasSaved} />
        </div>
        {canEdit ? (
          <>
            <textarea
              value={notas}
              onChange={e => handleNotasChange(e.target.value)}
              placeholder="Agregar nota sobre el proyecto..."
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
            <div className="mt-1 flex justify-end">
              <span className={cn(
                'text-[10px]',
                notas.length > MAX_NOTAS * 0.9 ? 'text-amber-500' : 'text-zinc-300',
              )}>
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
    </div>
  )
}
