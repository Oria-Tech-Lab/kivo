'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDate } from '@/lib/utils'

type Proyecto = { id: string; nombre: string }

type Asignacion = {
  id: string
  monto: number
  pct: number | null
  fecha: string
  proyecto: { id: string; nombre: string } | null
}

interface AsignarPanelProps {
  gastoGeneralId: string
  totalGG: number
  asignacionesIniciales: Asignacion[]
  proyectos: Proyecto[]
}

export function AsignarPanel({
  gastoGeneralId,
  totalGG,
  asignacionesIniciales,
  proyectos,
}: AsignarPanelProps) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>(asignacionesIniciales)
  const [formOpen, setFormOpen] = useState(false)
  const [proyectoId, setProyectoId] = useState('')
  const [montoSoles, setMontoSoles] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalAsignado = asignaciones.reduce((s, a) => s + a.monto, 0)

  const proyectosDisponibles = proyectos.filter(
    (p) => !asignaciones.some((a) => a.proyecto?.id === p.id)
  )

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const monto = Math.round(parseFloat(montoSoles) * 100)
    if (isNaN(monto) || monto <= 0) { setError('Ingresa un monto válido'); return }
    if (!proyectoId) { setError('Selecciona un proyecto'); return }

    setLoading(true)
    const res = await fetch(`/api/gastos-generales/${gastoGeneralId}/asignar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId,
        monto,
        pct: totalGG > 0 ? Math.round((monto / totalGG) * 10000) / 100 : undefined,
      }),
    })

    const json = await res.json() as { id?: string; error?: string }
    if (!res.ok) { setError(json.error ?? 'Error asignando'); setLoading(false); return }

    const proyecto = proyectos.find((p) => p.id === proyectoId)
    const nuevaAsignacion: Asignacion = {
      id: json.id ?? '',
      monto,
      pct: totalGG > 0 ? Math.round((monto / totalGG) * 10000) / 100 : null,
      fecha: new Date().toISOString().split('T')[0],
      proyecto: proyecto ? { id: proyecto.id, nombre: proyecto.nombre } : null,
    }
    setAsignaciones((prev) => [...prev, nuevaAsignacion])
    setFormOpen(false)
    setProyectoId('')
    setMontoSoles('')
    setLoading(false)
  }

  async function handleEliminar(proyId: string) {
    const res = await fetch(`/api/gastos-generales/${gastoGeneralId}/asignar`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proyecto_id: proyId }),
    })
    if (res.ok) {
      setAsignaciones((prev) => prev.filter((a) => a.proyecto?.id !== proyId))
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Asignaciones a proyectos
            {asignaciones.length > 0 && (
              <span className="ml-2 text-zinc-400 font-normal">({asignaciones.length})</span>
            )}
          </h2>
          {totalAsignado > 0 && (
            <p className="text-xs text-zinc-400 mt-0.5">
              Asignado: {formatMoney(totalAsignado)} de {formatMoney(totalGG)}
              {totalGG > 0 && (
                <span className={`ml-1 ${totalAsignado >= totalGG ? 'text-emerald-600' : 'text-amber-600'}`}>
                  ({Math.round((totalAsignado / totalGG) * 100)}%)
                </span>
              )}
            </p>
          )}
        </div>
        {proyectosDisponibles.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFormOpen(!formOpen)}
            className="gap-1.5"
          >
            <Plus size={13} />
            Asignar
          </Button>
        )}
      </div>

      {/* Formulario de asignación */}
      {formOpen && (
        <form onSubmit={handleAsignar} className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Proyecto</label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
              >
                <option value="">Seleccionar…</option>
                {proyectosDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Monto (S/)</label>
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 border-zinc-200 bg-white px-2 text-xs text-zinc-400">S/</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montoSoles}
                  onChange={(e) => setMontoSoles(e.target.value)}
                  placeholder={String((totalGG / 100).toFixed(2))}
                  className="flex-1 rounded-r-md border border-zinc-200 bg-white px-2 py-2 text-sm outline-none focus:border-zinc-400"
                />
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Guardando…' : 'Asignar'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setFormOpen(false); setError('') }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {asignaciones.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Sin asignaciones. Asigna este gasto a los proyectos que lo generan.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {asignaciones.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2.5 gap-3">
              <div className="min-w-0">
                {a.proyecto ? (
                  <Link
                    href={`/proyectos/${a.proyecto.id}`}
                    className="text-sm font-medium text-zinc-800 hover:underline"
                  >
                    {a.proyecto.nombre}
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-400">Proyecto eliminado</span>
                )}
                <div className="text-xs text-zinc-400">{formatDate(a.fecha)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-sm font-medium text-zinc-900">
                    {formatMoney(a.monto)}
                  </div>
                  {a.pct && (
                    <div className="text-xs text-zinc-400">{Number(a.pct).toFixed(1)}%</div>
                  )}
                </div>
                {a.proyecto && (
                  <button
                    onClick={() => a.proyecto && handleEliminar(a.proyecto.id)}
                    className="text-zinc-300 hover:text-red-500 transition-colors"
                    title="Quitar asignación"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
