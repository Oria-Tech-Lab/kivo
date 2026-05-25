import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { ClienteForm } from '@/components/forms/cliente-form'

export const metadata: Metadata = {
  title: 'Nuevo cliente — Kivo',
}

export default async function NuevoClientePage() {
  const rol = await getUserRole()

  // Solo admin y pm pueden crear clientes
  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/clientes')
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
          Nuevo cliente
        </h1>
      </div>

      <ClienteForm />
    </div>
  )
}
