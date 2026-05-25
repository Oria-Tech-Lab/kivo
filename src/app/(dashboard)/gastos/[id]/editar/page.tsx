import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient, getUserRole } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { GastoForm } from '@/components/forms/gasto-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Editar gasto — Kivo',
}

interface Props {
  params: { id: string }
}

export default async function EditarGastoPage({ params }: Props) {
  const rol = await getUserRole()
  if (rol !== 'admin' && rol !== 'pm') {
    redirect('/gastos')
  }

  const supabase = createClient()

  // Cargar el gasto, proyectos y proveedores en paralelo
  const [gastoRes, proyectosRes, proveedoresRes] = await Promise.all([
    supabase
      .from('gastos')
      .select(`
        *,
        proyecto:proyectos!inner(id, nombre, org_id, cliente:clientes(nombre))
      `)
      .eq('id', params.id)
      .single(),
    supabase
      .from('proyectos')
      .select('id, nombre, cliente:clientes(nombre)')
      .in('estado', ['activo', 'en_pausa'])
      .order('nombre', { ascending: true }),
    supabase
      .from('proveedores')
      .select('id, razon_social, nombre_comercial, aplica_detraccion, pct_detraccion')
      .order('razon_social', { ascending: true }),
  ])

  if (gastoRes.error || !gastoRes.data) notFound()

  const gasto = gastoRes.data as {
    id: string
    proyecto_id: string
    proveedor_id: string
    linea_presupuesto_id: string | null
    concepto: string
    tipo_comprobante: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante'
    serie: string | null
    numero_doc: string | null
    subtotal: number
    aplica_detraccion: boolean
    pct_detraccion: number
    fecha_comprobante: string
    fecha_vencimiento_pago: string | null
    estado_pago: 'pendiente' | 'pagado'
    notas: string | null
  }

  const proyectos = (proyectosRes.data ?? []) as Array<{
    id: string
    nombre: string
    cliente: { nombre: string } | null
  }>

  // Asegurar que el proyecto del gasto esté en la lista
  if (!proyectos.find((p) => p.id === gasto.proyecto_id)) {
    const gastoProyecto = (gastoRes.data as { proyecto: { id: string; nombre: string; cliente: { nombre: string } | null } | null }).proyecto
    if (gastoProyecto) {
      proyectos.unshift({
        id: gastoProyecto.id,
        nombre: gastoProyecto.nombre,
        cliente: gastoProyecto.cliente,
      })
    }
  }

  const proveedores = (proveedoresRes.data ?? []) as Array<{
    id: string
    razon_social: string
    nombre_comercial: string | null
    aplica_detraccion: boolean
    pct_detraccion: number
  }>

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/gastos/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver al gasto
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Editar gasto
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {gasto.concepto}
        </p>
      </div>

      <GastoForm
        proyectos={proyectos}
        proveedores={proveedores}
        gastoId={gasto.id}
        defaultValues={{
          proyecto_id: gasto.proyecto_id,
          proveedor_id: gasto.proveedor_id,
          linea_presupuesto_id: gasto.linea_presupuesto_id ?? '',
          concepto: gasto.concepto,
          tipo_comprobante: gasto.tipo_comprobante,
          serie: gasto.serie ?? '',
          numero_doc: gasto.numero_doc ?? '',
          subtotal: gasto.subtotal,
          aplica_detraccion: gasto.aplica_detraccion,
          pct_detraccion: gasto.pct_detraccion,
          fecha_comprobante: gasto.fecha_comprobante,
          fecha_vencimiento_pago: gasto.fecha_vencimiento_pago ?? '',
          estado_pago: gasto.estado_pago,
          notas: gasto.notas ?? '',
        }}
      />
    </div>
  )
}
