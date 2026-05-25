import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { ClienteForm } from '@/components/forms/cliente-form'
import type { ClienteInput } from '@/lib/validations/cliente'

export const metadata: Metadata = {
  title: 'Editar cliente — Kivo',
}

interface Props {
  params: { id: string }
}

export default async function EditarClientePage({ params }: Props) {
  const rol = await getUserRole()

  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/clientes')
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    notFound()
  }

  const cliente = data as {
    id: string
    nombre: string
    ruc: string | null
    contacto_nombre: string | null
    contacto_email: string | null
    contacto_telefono: string | null
    estado: string
  }

  const defaultValues: Partial<ClienteInput> = {
    nombre: cliente.nombre,
    ruc: cliente.ruc ?? '',
    contacto_nombre: cliente.contacto_nombre ?? '',
    contacto_email: cliente.contacto_email ?? '',
    contacto_telefono: cliente.contacto_telefono ?? '',
    estado: cliente.estado as 'activo' | 'inactivo',
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a Clientes
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Editar cliente
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">{cliente.nombre}</p>
      </div>

      <ClienteForm defaultValues={defaultValues} clienteId={params.id} />
    </div>
  )
}
