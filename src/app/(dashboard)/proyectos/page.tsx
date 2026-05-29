import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { ProyectosClient } from './proyectos-client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Proyectos — Kivo' }

export type FacturacionStatus = 'sin_facturar' | 'vencida' | 'pendiente' | 'al_dia'

export interface ProyectoConMetricas {
  id: string
  nombre: string
  tipo: string
  estado: 'activo' | 'en_pausa' | 'cerrado'
  fase: string
  fecha_inicio: string
  fecha_cierre_est: string | null
  created_at: string
  responsable_id: string | null
  cliente: { id: string; nombre: string } | null
  precio_venta_total: number
  costo_estimado_total: number
  gasto_real_total: number
  facturado_total: number
  alertas_count: number
  margen_pct: number
  ejecucion_pct: number
  facturacion_status: FacturacionStatus
}

export interface ClienteOption {
  id: string
  nombre: string
}

export default async function ProyectosPage() {
  const supabase = createClient()
  const rol = await getUserRole()

  const [proyectosRes, itemsRes, facturasRes, alertasRes, clientesRes] = await Promise.all([
    supabase
      .from('proyectos')
      .select('id, nombre, tipo, estado, fase, fecha_inicio, fecha_cierre_est, created_at, responsable_id, cliente:clientes(id, nombre)')
      .order('created_at', { ascending: false }),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('proyecto_items' as never) as any)
      .select('proyecto_id, precio_venta, costo_estimado, gasto_real'),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('facturas_proyecto' as never) as any)
      .select('proyecto_id, subtotal, estado, fecha_vencimiento'),

    supabase
      .from('alertas')
      .select('referencia_id')
      .eq('resuelto', false)
      .eq('referencia_tabla', 'proyectos'),

    supabase
      .from('clientes')
      .select('id, nombre')
      .eq('estado', 'activo')
      .order('nombre', { ascending: true }),
  ])

  const proyectosRaw = (proyectosRes.data ?? []) as unknown as Array<{
    id: string; nombre: string; tipo: string; estado: string
    fase: string | null; fecha_inicio: string; fecha_cierre_est: string | null
    created_at: string; responsable_id: string | null
    cliente: { id: string; nombre: string } | null
  }>

  const items = (itemsRes.data ?? []) as Array<{
    proyecto_id: string; precio_venta: number; costo_estimado: number; gasto_real: number
  }>

  const facturas = (facturasRes.data ?? []) as Array<{
    proyecto_id: string; subtotal: number; estado: string; fecha_vencimiento: string | null
  }>

  const alertas = (alertasRes.data ?? []) as Array<{ referencia_id: string }>
  const clientes = (clientesRes.data ?? []) as ClienteOption[]

  const itemsByProyecto = items.reduce<Record<string, { precio_venta: number; costo_estimado: number; gasto_real: number }>>((acc, item) => {
    if (!acc[item.proyecto_id]) acc[item.proyecto_id] = { precio_venta: 0, costo_estimado: 0, gasto_real: 0 }
    acc[item.proyecto_id].precio_venta += item.precio_venta
    acc[item.proyecto_id].costo_estimado += item.costo_estimado
    acc[item.proyecto_id].gasto_real += item.gasto_real
    return acc
  }, {})

  const today = new Date().toISOString().split('T')[0]

  function computeFacturacionStatus(
    rows: Array<{ estado: string; fecha_vencimiento: string | null }>
  ): FacturacionStatus {
    if (rows.length === 0) return 'sin_facturar'
    if (rows.some(f => f.estado !== 'cobrada' && f.fecha_vencimiento != null && f.fecha_vencimiento < today)) return 'vencida'
    if (rows.every(f => f.estado === 'cobrada')) return 'al_dia'
    return 'pendiente'
  }

  const facturasByProyecto = facturas.reduce<Record<string, {
    facturado: number
    rows: Array<{ estado: string; fecha_vencimiento: string | null }>
  }>>((acc, f) => {
    if (!acc[f.proyecto_id]) acc[f.proyecto_id] = { facturado: 0, rows: [] }
    if (f.estado === 'emitida' || f.estado === 'cobrada') {
      acc[f.proyecto_id].facturado += f.subtotal
    }
    acc[f.proyecto_id].rows.push({ estado: f.estado, fecha_vencimiento: f.fecha_vencimiento })
    return acc
  }, {})

  const alertasByProyecto = alertas.reduce<Record<string, number>>((acc, a) => {
    if (a.referencia_id) acc[a.referencia_id] = (acc[a.referencia_id] ?? 0) + 1
    return acc
  }, {})

  const proyectos: ProyectoConMetricas[] = proyectosRaw.map(p => {
    const it = itemsByProyecto[p.id] ?? { precio_venta: 0, costo_estimado: 0, gasto_real: 0 }
    const facturado = facturasByProyecto[p.id]?.facturado ?? 0
    const facturacionRows = facturasByProyecto[p.id]?.rows ?? []
    const alertasCount = alertasByProyecto[p.id] ?? 0
    const margenPct = it.precio_venta > 0
      ? ((it.precio_venta - it.gasto_real) / it.precio_venta) * 100
      : 0
    const ejecucionPct = it.costo_estimado > 0
      ? Math.min((it.gasto_real / it.costo_estimado) * 100, 100)
      : 0

    return {
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      estado: p.estado as 'activo' | 'en_pausa' | 'cerrado',
      fase: p.fase ?? 'cotizacion',
      fecha_inicio: p.fecha_inicio,
      responsable_id: p.responsable_id,
      fecha_cierre_est: p.fecha_cierre_est,
      created_at: p.created_at,
      cliente: p.cliente,
      precio_venta_total: it.precio_venta,
      costo_estimado_total: it.costo_estimado,
      gasto_real_total: it.gasto_real,
      facturado_total: facturado,
      alertas_count: alertasCount,
      margen_pct: margenPct,
      ejecucion_pct: ejecucionPct,
      facturacion_status: computeFacturacionStatus(facturacionRows),
    }
  })

  return (
    <ProyectosClient
      proyectos={proyectos}
      clientes={clientes}
      canEdit={rol === 'admin' || rol === 'pm'}
      canDelete={rol === 'admin'}
    />
  )
}
