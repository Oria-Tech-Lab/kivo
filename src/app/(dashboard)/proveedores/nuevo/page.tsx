import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUserRole } from '@/lib/supabase/server'
import { ProveedorForm } from '@/components/forms/proveedor-form'

export const metadata: Metadata = {
  title: 'Nuevo proveedor — Kivo',
}

export default async function NuevoProveedorPage() {
  const rol = await getUserRole()

  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/proveedores')
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/proveedores"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          Proveedores
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Nuevo proveedor
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Busca el RUC en SUNAT para autocompletar los datos.
        </p>
      </div>

      <ProveedorForm />
    </div>
  )
}
