import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FacturasClient } from './facturas-client'
import type { FacturaArchivoEntry } from '../proyectos/[id]/page'

export const metadata: Metadata = { title: 'Facturas — Kivo' }
export const dynamic = 'force-dynamic'

export interface FacturaGlobal {
  id: string
  proyecto_id: string
  org_id: string
  numero_factura: string
  subtotal: number
  aplica_igv: boolean
  igv: number
  aplica_detraccion: boolean
  pct_detraccion: number
  monto_detraccion: number
  total: number
  cliente_abona: number
  estado: 'borrador' | 'emitida' | 'cobrada' | 'vencida'
  fecha_emision: string | null
  fecha_vencimiento: string | null
  fecha_cobro: string | null
  notas: string | null
  archivos: FacturaArchivoEntry[]
  created_at: string
  proyecto: {
    id: string
    nombre: string
    cliente: { id: string; nombre: string } | null
  } | null
}

export interface ProyectoBasico {
  id: string
  nombre: string
  cliente_id: string | null
  cliente: { id: string; nombre: string } | null
}

export default async function FacturasPage() {
  const supabase = createClient()

  const [facturasRes, proyectosRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('facturas_proyecto' as never) as any)
      .select(`
        id, proyecto_id, org_id, numero_factura, subtotal, aplica_igv, igv,
        aplica_detraccion, pct_detraccion, monto_detraccion, total, cliente_abona,
        estado, fecha_emision, fecha_vencimiento, fecha_cobro, notas, archivos, created_at,
        proyecto:proyectos(id, nombre, cliente:clientes(id, nombre))
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('proyectos')
      .select('id, nombre, cliente_id, cliente:clientes(id, nombre)')
      .order('nombre', { ascending: true }),
  ])

  const facturas = (facturasRes.data ?? []) as FacturaGlobal[]
  const proyectos = (proyectosRes.data ?? []) as ProyectoBasico[]

  return <FacturasClient initialFacturas={facturas} proyectos={proyectos} />
}
