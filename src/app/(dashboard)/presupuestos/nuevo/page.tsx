import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { PresupuestoForm } from '@/components/forms/presupuesto-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nuevo presupuesto — Kivo',
}

interface Props {
  searchParams: { proyecto_id?: string }
}

export default async function NuevoPresupuestoPage({ searchParams }: Props) {
  const rol = await getUserRole()

  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/presupuestos')
  }

  const supabase = createClient()
  const { data: proyectos } = await supabase
    .from('proyectos')
    .select(`
      id, nombre,
      cliente:clientes(nombre)
    `)
    .eq('estado', 'activo')
    .order('nombre', { ascending: true })

  const proyectosData = (proyectos ?? []) as Array<{
    id: string
    nombre: string
    cliente: { nombre: string } | null
  }>

  return (
    <div className="p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/presupuestos"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a Presupuestos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Nuevo presupuesto
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Los montos se ingresan en soles. El IGV (18%) se calcula automáticamente.
        </p>
      </div>

      {proyectosData.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800 font-medium">No hay proyectos activos</p>
          <p className="mt-1 text-sm text-amber-700">
            Necesitas al menos un proyecto activo para crear un presupuesto.
          </p>
          <Link
            href="/proyectos/nuevo"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-800 underline"
          >
            Crear proyecto →
          </Link>
        </div>
      ) : (
        <PresupuestoForm
          proyectos={proyectosData}
          defaultProyectoId={searchParams.proyecto_id}
        />
      )}
    </div>
  )
}
