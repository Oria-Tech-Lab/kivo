'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface ProyectoRow {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string
  fecha_cierre_est: string | null
  aplica_detraccion: boolean
  created_at: string
  cliente: {
    id: string
    nombre: string
    ruc: string | null
  } | null
}

interface ProyectosTableProps {
  data: ProyectoRow[]
  canEdit: boolean
  canDelete: boolean
}

const TIPO_LABEL: Record<string, string> = {
  digital: 'Digital',
  offline: 'Offline',
  evento: 'Evento',
  instalacion: 'Instalación',
  otro: 'Otro',
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  activo: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  en_pausa: { label: 'En pausa', className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50' },
  cerrado: { label: 'Cerrado', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

export function ProyectosTable({ data, canEdit, canDelete }: ProyectosTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = data.filter((p) => {
    if (estadoFilter !== 'todos' && p.estado !== estadoFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.cliente?.nombre ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el proyecto "${nombre}"? Esta acción no se puede deshacer.`)) return

    setDeletingId(id)
    setDeleteError(null)

    const res = await fetch(`/api/proyectos/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }

    setDeletingId(null)

    if (!res.ok) {
      setDeleteError(json.error ?? 'Error eliminando proyecto')
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <Input
            placeholder="Buscar por nombre o cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filtro de estado */}
        <div className="flex gap-1 rounded-md border border-zinc-200 bg-white p-1">
          {['todos', 'activo', 'en_pausa', 'cerrado'].map((estado) => (
            <button
              key={estado}
              onClick={() => setEstadoFilter(estado)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                estadoFilter === estado
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {estado === 'todos' ? 'Todos' :
               estado === 'activo' ? 'Activos' :
               estado === 'en_pausa' ? 'En pausa' : 'Cerrados'}
            </button>
          ))}
        </div>
      </div>

      {deleteError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">
            {search || estadoFilter !== 'todos'
              ? 'Sin resultados para esa búsqueda.'
              : 'Aún no hay proyectos registrados.'}
          </p>
          {!search && estadoFilter === 'todos' && canEdit && (
            <Button asChild className="mt-4" variant="outline">
              <Link href="/proyectos/nuevo">+ Crear primer proyecto</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Proyecto</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden md:table-cell">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Inicio</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((proyecto) => (
                <tr
                  key={proyecto.id}
                  className="hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/proyectos/${proyecto.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-700 hover:underline"
                    >
                      {proyecto.nombre}
                    </Link>
                    {/* Cliente en mobile */}
                    {proyecto.cliente && (
                      <div className="text-xs text-zinc-400 mt-0.5 md:hidden">
                        {proyecto.cliente.nombre}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {proyecto.cliente ? (
                      <Link
                        href={`/clientes/${proyecto.cliente.id}/editar`}
                        className="text-zinc-600 hover:text-zinc-900 hover:underline"
                      >
                        {proyecto.cliente.nombre}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-zinc-500">
                      {TIPO_LABEL[proyecto.tipo] ?? proyecto.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={ESTADO_CONFIG[proyecto.estado]?.className ?? ''}
                    >
                      {ESTADO_CONFIG[proyecto.estado]?.label ?? proyecto.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 hidden lg:table-cell">
                    {formatDate(proyecto.fecha_inicio)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/proyectos/${proyecto.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                        title="Ver detalle"
                      >
                        Detalle
                        <ChevronRight size={12} />
                      </Link>

                      {canEdit && (
                        <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Link href={`/proyectos/${proyecto.id}/editar`} title="Editar">
                            <Pencil size={13} />
                          </Link>
                        </Button>
                      )}

                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(proyecto.id, proyecto.nombre)}
                          disabled={deletingId === proyecto.id}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-zinc-400">
          {filtered.length} proyecto{filtered.length !== 1 ? 's' : ''}
          {search ? ` para "${search}"` : ''}
        </p>
      )}
    </div>
  )
}
