'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Calendar, Tag, AlertTriangle, Check } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatDate } from '@/lib/utils'
import type { ProyectoData } from './page'

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  digital:     { label: 'Digital',     cls: 'bg-blue-100 text-blue-700' },
  offline:     { label: 'Offline',     cls: 'bg-violet-100 text-violet-700' },
  evento:      { label: 'Evento',      cls: 'bg-pink-100 text-pink-700' },
  instalacion: { label: 'Instalación', cls: 'bg-orange-100 text-orange-700' },
  otro:        { label: 'Otro',        cls: 'bg-zinc-100 text-zinc-600' },
}

const ESTADO_OPTIONS = [
  { value: 'activo',   label: 'Activo' },
  { value: 'en_pausa', label: 'En pausa' },
  { value: 'cerrado',  label: 'Cerrado' },
]

interface Props {
  proyecto: ProyectoData
  canEdit: boolean
}

export function ProyectoSidebar({ proyecto, canEdit }: Props) {
  const [estado, setEstado] = useState(proyecto.estado)
  const [notas, setNotas] = useState(proyecto.notas ?? '')
  const [estadoSaved, setEstadoSaved] = useState(false)
  const [notasSaved, setNotasSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save estado on change
  async function handleEstadoChange(next: string) {
    setEstado(next)
    try {
      await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: next }),
      })
      setEstadoSaved(true)
      setTimeout(() => setEstadoSaved(false), 2000)
    } catch {
      // silent fail — user can retry via edit page
    }
  }

  // Auto-save notas with 1 s debounce
  const saveNotas = useCallback(async (value: string) => {
    try {
      await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: value || null }),
      })
      setNotasSaved(true)
      setTimeout(() => setNotasSaved(false), 2000)
    } catch {
      // silent fail
    }
  }, [proyecto.id])

  function handleNotasChange(value: string) {
    setNotas(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNotas(value), 1000)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const tipoBadge = TIPO_BADGE[proyecto.tipo] ?? { label: proyecto.tipo, cls: 'bg-zinc-100 text-zinc-600' }
  const hoy = new Date()
  const cierreVencido = proyecto.fecha_cierre_est && new Date(proyecto.fecha_cierre_est) < hoy && estado !== 'cerrado'

  return (
    <div className="flex flex-col gap-0 divide-y divide-zinc-100">

      {/* ── Sección: Cliente ── */}
      {proyecto.cliente && (
        <div className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Cliente</p>
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100">
              <Building2 size={14} className="text-zinc-500" />
            </span>
            <div>
              <p className="font-medium text-sm text-zinc-900">{proyecto.cliente.nombre}</p>
              {proyecto.cliente.ruc && (
                <p className="text-xs text-zinc-400 font-mono">{proyecto.cliente.ruc}</p>
              )}
              {proyecto.cliente.contacto_nombre && (
                <p className="text-xs text-zinc-500 mt-0.5">{proyecto.cliente.contacto_nombre}</p>
              )}
            </div>
          </div>
          <Link
            href={`/clientes/${proyecto.cliente.id}/editar`}
            className="mt-3 block text-xs text-blue-600 hover:underline"
          >
            Ver / editar cliente →
          </Link>
        </div>
      )}

      {/* ── Sección: Info del proyecto ── */}
      <div className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Información
        </p>
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Tag size={12} /> Tipo
            </dt>
            <dd>
              <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', tipoBadge.cls)}>
                {tipoBadge.label}
              </span>
            </dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Calendar size={12} /> Inicio
            </dt>
            <dd className="text-xs text-zinc-700">{formatDate(proyecto.fecha_inicio)}</dd>
          </div>

          {proyecto.fecha_cierre_est && (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Calendar size={12} /> Cierre est.
              </dt>
              <dd className={cn('text-xs font-medium', cierreVencido ? 'text-red-600' : 'text-zinc-700')}>
                {formatDate(proyecto.fecha_cierre_est)}
                {cierreVencido && ' ⚠'}
              </dd>
            </div>
          )}

          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
              <AlertTriangle size={12} /> Detracción
            </dt>
            <dd>
              {proyecto.aplica_detraccion ? (
                <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                  Sí 10%
                </span>
              ) : (
                <span className="text-xs text-zinc-400">No aplica</span>
              )}
            </dd>
          </div>

          {proyecto.categoria && (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Tag size={12} /> Categoría
              </dt>
              <dd className="flex items-center gap-1.5 text-xs text-zinc-700">
                {proyecto.categoria.color && (
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: proyecto.categoria.color }}
                  />
                )}
                {proyecto.categoria.nombre}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* ── Sección: Estado ── */}
      {canEdit && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Estado</p>
            {estadoSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Check size={11} /> Guardado
              </span>
            )}
          </div>
          <select
            value={estado}
            onChange={e => handleEstadoChange(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          >
            {ESTADO_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Sección: Notas ── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Notas</p>
          {notasSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Check size={11} /> Guardado
            </span>
          )}
        </div>
        {canEdit ? (
          <Textarea
            value={notas}
            onChange={e => handleNotasChange(e.target.value)}
            placeholder="Agregar nota sobre el proyecto..."
            rows={4}
          />
        ) : (
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">
            {notas || <span className="text-zinc-300 italic">Sin notas</span>}
          </p>
        )}
      </div>
    </div>
  )
}
