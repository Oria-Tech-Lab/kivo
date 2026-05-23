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

  const proveedor = proveedorRaw as {
    id: string
    ruc: string
    razon_social: string
    nombre_comercial: string | null
    tipo: 'persona_natural' | 'persona_juridica'
    actividad: string | null
    aplica_detraccion: boolean
    pct_detraccion: number
    condicion_pago: string | null
    email: string | null
    notas: string | null
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
          Editar proveedor
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-400">{proveedor.ruc}</p>
      </div>

      <ProveedorForm
        proveedorId={proveedor.id}
        defaultValues={{
          ruc: proveedor.ruc,
          razon_social: proveedor.razon_social,
          nombre_comercial: proveedor.nombre_comercial ?? '',
          tipo: proveedor.tipo,
          actividad: proveedor.actividad ?? '',
          aplica_detraccion: proveedor.aplica_detraccion,
          pct_detraccion: proveedor.pct_detraccion,
          condicion_pago: proveedor.condicion_pago ?? '',
          email: proveedor.email ?? '',
          notas: proveedor.notas ?? '',
        }}
      />
    </div>
  )
}
