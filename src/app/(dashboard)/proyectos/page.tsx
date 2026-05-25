import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProyectosTable } from './proyectos-table'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Proyectos — Kivo',
}

export default async function ProyectosPage() {
  const supabase = createClient()
  const rol = await getUserRole()

  const { data: proyectos } = await supabase
    .from('proyectos')
    .select(`
      id, nombre, tipo, estado, fecha_inicio, fecha_cierre_est,
      aplica_detraccion, created_at,
      cliente:clientes(id, nombre, ruc)
    `)
    .order('created_at', { ascending: false })

  const data = (proyectos ?? []) as Array<{
    id: string
    nombre: string
    tipo: string
    estado: string
    fecha_inicio: string
    fecha_cierre_est: string | null
    aplica_detraccion: boolean
    created_at: string
    cliente: { id: string; nombre: string; ruc: string | null } | null
  }>

  const activos = data.filter((p) => p.estado === 'activo').length

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data.length} proyecto{data.length !== 1 ? 's' : ''} total
            {activos > 0 && ` · ${activos} activo${activos !== 1 ? 's' : ''}`}
          </p>
        </div>
        {(rol === 'admin' || rol === 'pm') && (
          <Button asChild>
            <Link href="/proyectos/nuevo">+ Nuevo proyecto</Link>
          </Button>
        )}
      </div>

      <ProyectosTable
        data={data}
        canEdit={rol === 'admin' || rol === 'pm'}
        canDelete={rol === 'admin'}
      />
    </div>
  )
}
