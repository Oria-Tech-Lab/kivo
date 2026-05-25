import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { ProyectoForm } from '@/components/forms/proyecto-form'
import type { ProyectoInput } from '@/lib/validations/proyecto'

export const metadata: Metadata = {
  title: 'Editar proyecto — Kivo',
}

interface Props {
  params: { id: string }
}

export default async function EditarProyectoPage({ params }: Props) {
  const rol = await getUserRole()

  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/proyectos')
  }

  const supabase = createClient()

  // Cargar proyecto y clientes en paralelo
  const [proyectoRes, clientesRes] = await Promise.all([
    supabase
      .from('proyectos')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('clientes')
      .select('id, nombre, ruc')
      .eq('estado', 'activo')
      .order('nombre', { ascending: true }),
  ])

  if (proyectoRes.error || !proyectoRes.data) {
    notFound()
  }

  const proyecto = proyectoRes.data as {
    id: string
    cliente_id: string
    nombre: string
    tipo: string
    estado: string
    fecha_inicio: string
    fecha_cierre_est: string | null
    aplica_detraccion: boolean
    notas: string | null
  }

  const clientesData = (clientesRes.data ?? []) as Array<{
    id: string
    nombre: string
    ruc: string | null
  }>

  const defaultValues: Partial<ProyectoInput> = {
    cliente_id: proyecto.cliente_id,
    nombre: proyecto.nombre,
    tipo: proyecto.tipo as ProyectoInput['tipo'],
    estado: proyecto.estado as ProyectoInput['estado'],
    fecha_inicio: proyecto.fecha_inicio,
    fecha_cierre_est: proyecto.fecha_cierre_est ?? '',
    aplica_detraccion: proyecto.aplica_detraccion,
    notas: proyecto.notas ?? '',
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/proyectos/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver al proyecto
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Editar proyecto
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">{proyecto.nombre}</p>
      </div>

      <ProyectoForm
        defaultValues={defaultValues}
        proyectoId={params.id}
        clientes={clientesData}
      />
    </div>
  )
}
