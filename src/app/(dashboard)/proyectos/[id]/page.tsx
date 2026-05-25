import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient, getUserRole } from '@/lib/supabase/server'
import { ProyectoDetailClient } from './proyecto-detail-client'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('proyectos')
    .select('nombre')
    .eq('id', params.id)
    .single()
  return {
    title: data ? `${data.nombre as string} — Kivo` : 'Proyecto — Kivo',
  }
}

export default async function ProyectoDetallePage({ params }: Props) {
  const supabase = createClient()
  const rol = await getUserRole()

  // Project data
  const { data: proyectoRaw, error } = await supabase
    .from('proyectos')
    .select(`
      *,
      cliente:clientes(id, nombre, ruc, contacto_nombre, contacto_email),
      categoria:categorias(id, nombre, color)
    `)
    .eq('id', params.id)
    .single()

  if (error || !proyectoRaw) notFound()

  // Load items and proveedores in parallel
  const [itemsRes, proveedoresRes] = await Promise.all([
    supabase
      .from('proyecto_items' as never)
      .select(`
        id, concepto, unidad, proveedor_id, costo_estimado, precio_venta,
        gasto_real, tipo_comprobante, sort_order, created_at,
        proveedor:proveedores(id, razon_social, nombre_comercial)
      `)
      .eq('proyecto_id', params.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
      .from('proveedores')
      .select('id, razon_social, nombre_comercial, ruc')
      .order('razon_social', { ascending: true }),
  ])

  const initialItems = (itemsRes.data ?? []) as ProyectoItem[]
  const proveedores = (proveedoresRes.data ?? []) as Proveedor[]

  const proyecto = proyectoRaw as unknown as ProyectoData

  return (
    <ProyectoDetailClient
      proyecto={proyecto}
      initialItems={initialItems}
      proveedores={proveedores}
      rol={rol ?? 'viewer'}
    />
  )
}

// ─── Types exported for client component ────────────────────────────────────

export interface ProyectoData {
  id: string
  nombre: string
  tipo: string
  estado: string
  fecha_inicio: string
  fecha_cierre_est: string | null
  aplica_detraccion: boolean
  notas: string | null
  created_at: string
  org_id: string
  cliente: {
    id: string
    nombre: string
    ruc: string | null
    contacto_nombre: string | null
    contacto_email: string | null
  } | null
  categoria: {
    id: string
    nombre: string
    color: string | null
  } | null
}

export interface ProyectoItem {
  id: string
  concepto: string
  unidad: 'unid' | 'hora' | 'global' | 'm2' | 'kg' | 'dia' | 'otro'
  proveedor_id: string | null
  costo_estimado: number
  precio_venta: number
  gasto_real: number
  tipo_comprobante: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante' | null
  sort_order: number
  created_at: string
  proveedor: {
    id: string
    razon_social: string
    nombre_comercial: string | null
  } | null
}

export interface Proveedor {
  id: string
  razon_social: string
  nombre_comercial: string | null
  ruc: string | null
}
