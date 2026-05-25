import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ClientesTable } from './clientes-table'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Clientes — Kivo',
}

export default async function ClientesPage() {
  const supabase = createClient()
  const rol = await getUserRole()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, ruc, contacto_nombre, contacto_email, contacto_telefono, estado, created_at')
    .order('nombre', { ascending: true })

  const data = (clientes ?? []) as Array<{
    id: string
    nombre: string
    ruc: string | null
    contacto_nombre: string | null
    contacto_email: string | null
    contacto_telefono: string | null
    estado: string
    created_at: string
  }>

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data.length} cliente{data.length !== 1 ? 's' : ''} registrado{data.length !== 1 ? 's' : ''}
          </p>
        </div>
        {(rol === 'admin' || rol === 'pm') && (
          <Button asChild>
            <Link href="/clientes/nuevo">+ Nuevo cliente</Link>
          </Button>
        )}
      </div>

      <ClientesTable
        data={data}
        canEdit={rol === 'admin' || rol === 'pm'}
        canDelete={rol === 'admin'}
      />
    </div>
  )
}
