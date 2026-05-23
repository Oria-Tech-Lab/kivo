'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Pencil, Trash2, Building2, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Proveedor {
  id: string
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  tipo: string
  aplica_detraccion: boolean
  pct_detraccion: number
  condicion_pago: string | null
  email: string | null
  created_at: string
}

interface Props {
  data: Proveedor[]
  canEdit: boolean
  canDelete: boolean
}

export function ProveedoresTable({ data, canEdit, canDelete }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = data.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.ruc.includes(q) ||
      p.razon_social.toLowerCase().includes(q) ||
      (p.nombre_comercial?.toLowerCase().includes(q) ?? false)
    )
  })

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) return

    setDeletingId(id)
    const res = await fetch(`/api/proveedores/${id}`, { method: 'DELETE' })

    if (!res.ok) {
      const json = await res.json() as { error?: string }
      alert(json.error ?? 'Error eliminando proveedor')
    } else {
      router.refresh()
    }
    setDeletingId(null)
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      {/* Barra de búsqueda */}
      <div className="border-b border-zinc-100 p-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Buscar por RUC o nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-400">
              {search
                ? `Sin resultados para "${search}"`
                : 'No hay proveedores registrados aún.'}
            </p>
            {!search && canEdit && (
              <Link
                href="/proveedores/nuevo"
                className="mt-2 inline-block text-sm font-medium text-zinc-700 underline underline-offset-2"
              >
                Crear el primero →
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium text-zinc-500">Proveedor</th>
                <th className="px-4 py-3 font-medium text-zinc-500">RUC</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Tipo</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Detracción</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Condición pago</th>
                {(canEdit || canDelete) && (
                  <th className="px-4 py-3 font-medium text-zinc-500 text-right">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-zinc-900">{p.razon_social}</p>
                      {p.nombre_comercial && (
                        <p className="text-xs text-zinc-400">{p.nombre_comercial}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{p.ruc}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      {p.tipo === 'persona_juridica' ? (
                        <Building2 size={14} className="text-zinc-400" />
                      ) : (
                        <User size={14} className="text-zinc-400" />
                      )}
                      {p.tipo === 'persona_juridica' ? 'Jurídica' : 'Natural'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.aplica_detraccion ? (
                      <Badge variant="warning">{p.pct_detraccion}%</Badge>
                    ) : (
                      <span className="text-zinc-400 text-xs">No aplica</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {p.condicion_pago ?? <span className="text-zinc-300">—</span>}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/proveedores/${p.id}/editar`}>
                              <Pencil size={14} />
                            </Link>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(p.id, p.razon_social)}
                            disabled={deletingId === p.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
