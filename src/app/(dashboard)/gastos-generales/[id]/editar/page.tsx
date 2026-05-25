import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient, getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { GastoGeneralForm } from '@/components/forms/gasto-general-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Editar gasto general — Kivo',
}

export default async function EditarGastoGeneralPage({ params }: { params: { id: string } }) {
  const rol = await getUserRole()
  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/gastos-generales')
  }

  const supabase = createClient()

  const [ggRes, proveedoresRes] = await Promise.all([
    supabase
      .from('gastos_generales')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('proveedores')
      .select('id, razon_social, nombre_comercial')
      .order('razon_social', { ascending: true }),
  ])

  if (ggRes.error || !ggRes.data) notFound()

  const gg = ggRes.data as {
    id: string
    concepto: string
    tipo_recurrencia: 'mensual' | 'puntual'
    monto: number
    periodo_mes: number | null
    periodo_anio: number | null
    tipo_comprobante: string | null
    proveedor_id: string | null
    umbral_proyectos: number
  }

  const proveedores = (proveedoresRes.data ?? []) as Array<{
    id: string
    razon_social: string
    nombre_comercial: string | null
  }>

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/gastos-generales/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Editar gasto general
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">{gg.concepto}</p>
      </div>

      <GastoGeneralForm
        proveedores={proveedores}
        gastoGeneralId={gg.id}
        defaultValues={{
          concepto: gg.concepto,
          tipo_recurrencia: gg.tipo_recurrencia,
          monto: gg.monto,
          periodo_mes: gg.periodo_mes ?? undefined,
          periodo_anio: gg.periodo_anio ?? undefined,
          tipo_comprobante: (gg.tipo_comprobante as 'factura' | 'boleta' | 'rxh' | 'sin_comprobante' | undefined) ?? undefined,
          proveedor_id: gg.proveedor_id ?? '',
          umbral_proyectos: gg.umbral_proyectos,
        }}
      />
    </div>
  )
}
