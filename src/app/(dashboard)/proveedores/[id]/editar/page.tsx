import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient, getUserRole } from '@/lib/supabase/server'
import { ProveedorForm } from '@/components/forms/proveedor-form'

export const metadata: Metadata = {
  title: 'Editar proveedor — Kivo',
}

export default async function EditarProveedorPage({
  params,
}: {
  params: { id: string }
}) {
  const rol = await getUserRole()

  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/proveedores')
  }

  const supabase = createClient()
  const { data: proveedorRaw } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!proveedorRaw) notFound()

  const proveedor = proveedorRaw as unknown as {
    id: string
    ruc: string | null
    tipo_documento: 'dni' | 'ce' | 'pasaporte' | 'ruc' | null
    numero_documento: string | null
    razon_social: string
    nombre_comercial: string | null
    tipo: 'persona_natural' | 'persona_juridica'
    actividad: string | null
    condicion_pago: string | null
    email: string | null
    notas: string | null
  }

  const identificador = proveedor.ruc ?? proveedor.numero_documento ?? ''

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <Link
          href="/proveedores"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={15} />
          Proveedores
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Editar proveedor
        </h1>
        {identificador && (
          <p className="mt-1 font-mono text-xs text-zinc-400">{identificador}</p>
        )}
      </div>

      <ProveedorForm
        proveedorId={proveedor.id}
        defaultValues={{
          tipo: proveedor.tipo,
          ruc: proveedor.ruc ?? '',
          tipo_documento: proveedor.tipo_documento ?? undefined,
          numero_documento: proveedor.numero_documento ?? '',
          razon_social: proveedor.razon_social,
          nombre_comercial: proveedor.nombre_comercial ?? '',
          actividad: proveedor.actividad ?? '',
          condicion_pago: proveedor.condicion_pago ?? '',
          email: proveedor.email ?? '',
          notas: proveedor.notas ?? '',
        }}
      />
    </div>
  )
}
