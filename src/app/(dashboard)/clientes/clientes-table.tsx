'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface Cliente {
  id: string
  nombre: string
  ruc: string | null
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  estado: string
  created_at: string
}

interface ClientesTableProps {
  data: Cliente[]
  canEdit: boolean
  canDelete: boolean
}

export function ClientesTable({ data, canEdit, canDelete }: ClientesTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = data.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.ruc ?? '').includes(q) ||
      (c.contacto_email ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el cliente "${nombre}"? Esta acción no se puede deshacer.`)) return

    setDeletingId(id)
    setDeleteError(null)

    const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }

    setDeletingId(null)

    if (!res.ok) {
      setDeleteError(json.error ?? 'Error eliminando cliente')
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        />
        <Input
          placeholder="Buscar por nombre, RUC o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
            {search ? 'Sin resultados para esa búsqueda.' : 'Aún no hay clientes registrados.'}
          </p>
          {!search && canEdit && (
            <Button asChild className="mt-4" variant="outline">
              <Link href="/clientes/nuevo">+ Agregar primer cliente</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">RUC</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden md:table-cell">Contacto</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Creado</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((cliente) => (
                <tr
                  key={cliente.id}
                  className="hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{cliente.nombre}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {cliente.ruc ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {cliente.contacto_nombre ? (
                      <div>
                        <div className="text-zinc-700">{cliente.contacto_nombre}</div>
                        {cliente.contacto_email && (
                          <div className="text-xs text-zinc-400">{cliente.contacto_email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={cliente.estado === 'activo' ? 'default' : 'secondary'}
                      className={
                        cliente.estado === 'activo'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }
                    >
                      {cliente.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 hidden lg:table-cell">
                    {formatDate(cliente.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Ver proyectos del cliente */}
                      <Link
                        href={`/proyectos?cliente_id=${cliente.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                        title="Ver proyectos"
                      >
                        Proyectos
                        <ChevronRight size={12} />
                      </Link>

                      {canEdit && (
                        <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Link href={`/clientes/${cliente.id}/editar`} title="Editar">
                            <Pencil size={13} />
                          </Link>
                        </Button>
                      )}

                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(cliente.id, cliente.nombre)}
                          disabled={deletingId === cliente.id}
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
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
          {search ? ` para "${search}"` : ''}
        </p>
      )}
    </div>
  )
}
