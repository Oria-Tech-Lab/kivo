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
  const { data } = await supabase.from('proyectos').select('nombre').eq('id', params.id).single()
  return { title: data ? `${data.nombre as string} — Kivo` : 'Proyecto — Kivo' }
}

export default async function ProyectoDetallePage({ params }: Props) {
  const supabase = createClient()
  const rol = await getUserRole()

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

  const [itemsRes, proveedoresRes, gastosRes, asignacionesRes, clientesRes, facturasRes] = await Promise.all([
    // Items tabla unificada
    (supabase.from('proyecto_items' as never) as ReturnType<typeof supabase.from>)
      .select(`
        id, concepto, unidad, proveedor_id, costo_estimado, precio_venta,
        gasto_real, cantidad, precio_unitario, tipo_comprobante,
        estado_pago, fecha_pago, foto_url, factura_url, constancia_pago_url,
        sort_order, created_at,
        proveedor:proveedores(id, razon_social, nombre_comercial)
      `)
      .eq('proyecto_id', params.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    // Proveedores de la org para el combobox
    supabase
      .from('proveedores')
      .select('id, razon_social, nombre_comercial, ruc')
      .order('razon_social', { ascending: true }),

    // Gastos con fecha para el burn rate y tarjetas de proveedores
    supabase
      .from('gastos')
      .select('id, proveedor_id, total, fecha_comprobante, tipo_comprobante, estado_pago')
      .eq('proyecto_id', params.id)
      .order('fecha_comprobante', { ascending: true }),

    // GG asignados — para la cascada de margen
    supabase
      .from('asignaciones_gg')
      .select('monto')
      .eq('proyecto_id', params.id),

    // Clientes de la org para el combobox del sidebar
    supabase
      .from('clientes')
      .select('id, nombre, ruc, contacto_nombre, contacto_email')
      .order('nombre', { ascending: true }),

    // Facturas emitidas del proyecto
    (supabase.from('facturas_proyecto' as never) as ReturnType<typeof supabase.from>)
      .select('*')
      .eq('proyecto_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  const initialItems   = (itemsRes.data   ?? []) as ProyectoItem[]
  const proveedores    = (proveedoresRes.data ?? []) as Proveedor[]
  const gastos         = (gastosRes.data  ?? []) as GastoFecha[]
  const indirecto      = ((asignacionesRes.data ?? []) as { monto: number }[])
                           .reduce((s, a) => s + a.monto, 0)
  const clientes       = (clientesRes.data ?? []) as ClienteData[]
  const initialFacturas = (facturasRes.data ?? []) as FacturaProyecto[]

  return (
    <ProyectoDetailClient
      proyecto={proyectoRaw as unknown as ProyectoData}
      initialItems={initialItems}
      proveedores={proveedores}
      gastos={gastos}
      indirecto={indirecto}
      rol={rol ?? 'viewer'}
      clientes={clientes}
      initialFacturas={initialFacturas}
    />
  )
}

// ─── Exported types (used by client components) ──────────────────────────────

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
  cliente_id: string | null
  responsable_id: string | null
  subtotal_proyecto: number
  aplica_igv_venta: boolean
  aplica_detraccion_venta: boolean
  pct_detraccion_venta: number
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
  cantidad: number
  precio_unitario: number
  tipo_comprobante: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante' | 'pendiente' | null
  estado_pago: 'pendiente' | 'pagado' | 'parcial'
  fecha_pago: string | null
  foto_url: string | null
  factura_url: string | null
  constancia_pago_url: string | null
  sort_order: number
  created_at: string
  proveedor: { id: string; razon_social: string; nombre_comercial: string | null } | null
}

export interface Proveedor {
  id: string
  razon_social: string
  nombre_comercial: string | null
  ruc: string | null
}

export interface GastoFecha {
  id: string
  proveedor_id: string | null
  total: number
  fecha_comprobante: string
  tipo_comprobante: string
  estado_pago: string
}

export interface ClienteData {
  id: string
  nombre: string
  ruc: string | null
  contacto_nombre: string | null
  contacto_email: string | null
}

export interface FacturaProyecto {
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
  created_at: string
}

export interface TeamMember {
  user_id: string
  email: string
  nombre: string
  rol: string
}
