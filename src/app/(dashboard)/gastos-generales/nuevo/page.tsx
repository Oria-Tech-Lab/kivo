import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { GastoGeneralForm } from '@/components/forms/gasto-general-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nuevo gasto general — Kivo',
}

export default async function NuevoGastoGeneralPage() {
  const rol = await getUserRole()
  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/gastos-generales')
  }

  const supabase = createClient()
  const { data: proveedoresData } = await supabase
    .from('proveedores')
    .select('id, razon_social, nombre_comercial')
    .order('razon_social', { ascending: true })

  const proveedores = (proveedoresData ?? []) as Array<{
    id: string
    razon_social: string
    nombre_comercial: string | null
  }>

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/gastos-generales"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Gastos Generales
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Nuevo gasto general
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Costos compartidos como alquiler, servicios, herramientas y sueldos fijos.
        </p>
      </div>

      <GastoGeneralForm proveedores={proveedores} />
    </div>
  )
}
