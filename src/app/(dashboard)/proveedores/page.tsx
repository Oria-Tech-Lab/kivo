import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProveedoresTable } from './proveedores-table'

export const metadata: Metadata = {
  title: 'Proveedores — Kivo',
}

export default async function ProveedoresPage() {
  const supabase = createClient()
  const rol = await getUserRole()

  const { data: proveedores } = await supabase
    .from('proveedores')
    .select('id, ruc, razon_social, nombre_comercial, tipo, aplica_detraccion, pct_detraccion, condicion_pago, email, created_at')
    .order('razon_social', { ascending: true })

  const data = (proveedores ?? []) as Array<{
    id: string
    ruc: string
    razon_social: string
    nombre_comercial: string | null
    tipo: string
    aplica_detraccion: boolean
    pct_detraccion: number
    condicion_pago: string | null
    email: string | null
    created_at: string
  }>

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Proveedores
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data.length} proveedor{data.length !== 1 ? 'es' : ''} registrado{data.length !== 1 ? 's' : ''}
          </p>
        </div>
        {(rol === 'admin' || rol === 'pm') && (
          <Button asChild>
            <Link href="/proveedores/nuevo">+ Nuevo proveedor</Link>
          </Button>
        )}
      </div>

      {/* Tabla con búsqueda client-side */}
      <ProveedoresTable data={data} canEdit={rol === 'admin' || rol === 'pm'} canDelete={rol === 'admin'} />
    </div>
  )
}
