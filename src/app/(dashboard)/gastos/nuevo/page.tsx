import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { GastoForm } from '@/components/forms/gasto-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Registrar gasto — Kivo',
}

interface Props {
  searchParams: { proyecto_id?: string }
}

export default async function NuevoGastoPage({ searchParams }: Props) {
  const rol = await getUserRole()

  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/gastos')
  }

  const supabase = createClient()

  // Cargar proyectos activos y proveedores en paralelo
  const [proyectosRes, proveedoresRes] = await Promise.all([
    supabase
      .from('proyectos')
      .select('id, nombre, cliente:clientes(nombre)')
      .eq('estado', 'activo')
      .order('nombre', { ascending: true }),
    supabase
      .from('proveedores')
      .select('id, razon_social, nombre_comercial, aplica_detraccion, pct_detraccion')
      .order('razon_social', { ascending: true }),
  ])

  const proyectos = (proyectosRes.data ?? []) as Array<{
    id: string
    nombre: string
    cliente: { nombre: string } | null
  }>

  const proveedores = (proveedoresRes.data ?? []) as Array<{
    id: string
    razon_social: string
    nombre_comercial: string | null
    aplica_detraccion: boolean
    pct_detraccion: number
  }>

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/gastos"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a Gastos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Registrar gasto
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Los montos se ingresan en soles. IGV, detracción y retención se calculan automáticamente.
        </p>
      </div>

      {proyectos.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800 font-medium">No hay proyectos activos</p>
          <Link href="/proyectos/nuevo" className="mt-2 text-sm text-amber-800 underline block">
            Crear proyecto →
          </Link>
        </div>
      ) : proveedores.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800 font-medium">No hay proveedores registrados</p>
          <Link href="/proveedores/nuevo" className="mt-2 text-sm text-amber-800 underline block">
            Crear proveedor →
          </Link>
        </div>
      ) : (
        <GastoForm
          proyectos={proyectos}
          proveedores={proveedores}
          defaultProyectoId={searchParams.proyecto_id}
        />
      )}
    </div>
  )
}
