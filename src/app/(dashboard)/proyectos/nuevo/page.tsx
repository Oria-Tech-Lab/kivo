import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { ProyectoForm } from '@/components/forms/proyecto-form'

export const metadata: Metadata = {
  title: 'Nuevo proyecto — Kivo',
}

export default async function NuevoProyectoPage() {
  const rol = await getUserRole()

  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/proyectos')
  }

  const supabase = createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, ruc')
    .eq('estado', 'activo')
    .order('nombre', { ascending: true })

  const clientesData = (clientes ?? []) as Array<{
    id: string
    nombre: string
    ruc: string | null
  }>

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/proyectos"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a Proyectos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Nuevo proyecto
        </h1>
      </div>

      {clientesData.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800 font-medium">No hay clientes activos</p>
          <p className="mt-1 text-sm text-amber-700">
            Debes crear al menos un cliente antes de crear un proyecto.
          </p>
          <Link
            href="/clientes/nuevo"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-800 underline"
          >
            Crear cliente →
          </Link>
        </div>
      ) : (
        <ProyectoForm clientes={clientesData} />
      )}
    </div>
  )
}
