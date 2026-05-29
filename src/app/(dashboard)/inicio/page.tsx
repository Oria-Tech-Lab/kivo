import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { InicioClient } from './inicio-client'

export const revalidate = 300
export const metadata: Metadata = { title: 'Inicio — Kivo' }

// ─── Types consumed by InicioClient ──────────────────────────────────────────

export interface AlertaItem {
  id: string; tipo: string
  nivel: 'critico' | 'advertencia' | 'informativo'
  mensaje: string; fecha_generada: string
}
export interface ClienteOpt { id: string; nombre: string }
export interface ProveedorOpt { id: string; razon_social: string; nombre_comercial: string | null }
export interface ProyectoOpt {
  id: string; nombre: string; tipo: string; estado: string
  cliente: { id: string; nombre: string } | null
}

// Raw arrays — passed to client for useMemo filter computations
export interface RawMovR { tipo: string; monto: number; fecha_real: string | null }
export interface RawMovP { tipo: string; monto: number; fecha_esperada: string | null }
export interface RawProyecto {
  id: string; nombre: string; tipo: string; estado: string
  fecha_inicio: string | null
  cliente: { id: string; nombre: string } | null
}
export interface RawItem { proyecto_id: string; precio_venta: number; gasto_real: number }
export interface RawGasto { neto_a_pagar: number | null; fecha_comprobante: string | null }

// Computed types (computed client-side, typed here for sharing)
export interface ChartDataPoint { mes: string; ingresos: number; gastos: number }
export interface KpiData {
  porCobrar: number; porCobrarCount: number
  porPagar: number;  porPagarCount: number
  flujoNeto: number
  flujoProyectado: number; metaMensualPct: number
  reduccionGastosPct: number | null
  varPorCobrarPct: number | null
}
export interface ProyectoRentabilidad {
  id: string; nombre: string; tipo: string; estado: string
  cliente: { id: string; nombre: string } | null
  ingresos: number; gasto_real: number; margen_pct: number
}
export interface DistribucionItem {
  tipo: string; label: string; monto: number; pct: number; color: string
}
export interface SaludData { score: number; subtitle: string }

export const TIPO_CFG: Record<string, { label: string; color: string }> = {
  digital:     { label: 'Digital',      color: '#1e40af' },
  instalacion: { label: 'Instalación',  color: '#f97316' },
  evento:      { label: 'Evento',       color: '#8b5cf6' },
  offline:     { label: 'Offline',      color: '#6b7280' },
  otro:        { label: 'Otro',         color: '#14b8a6' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InicioPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const nombre = (user?.user_metadata?.full_name as string | undefined)
    ?? (user?.email?.split('@')[0] ?? '')

  const nowLima = new Date(Date.now() - 5 * 60 * 60 * 1000)
  const hora    = nowLima.getUTCHours()
  const saludo  =
    hora >= 5 && hora <= 11 ? 'Buenos días'
    : hora >= 12 && hora <= 18 ? 'Buenas tardes'
    : 'Buenas noches'

  const limaYear  = nowLima.getUTCFullYear()
  const limaMonth = nowLima.getUTCMonth()  // 0-indexed
  const todayStr  = nowLima.toISOString().split('T')[0]

  // 13 months covers "este año" for any calendar month
  const thirteenMonthsAgoStart =
    new Date(Date.UTC(limaYear, limaMonth - 12, 1)).toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcTable = supabase.from('movimientos_caja' as never) as any

  const [
    realizedRes,
    pendingRes,
    alertasRes,
    proyectosRes,
    itemsRes,
    clientesRes,
    proveedoresRes,
    gastosChartRes,
  ] = await Promise.all([
    mcTable
      .select('tipo, monto, fecha_real')
      .eq('estado', 'realizado')
      .gte('fecha_real', thirteenMonthsAgoStart)
      .in('tipo', ['ingreso', 'egreso']),
    mcTable
      .select('tipo, monto, fecha_esperada')
      .eq('estado', 'pendiente')
      .in('tipo', ['ingreso', 'egreso']),
    supabase.from('alertas')
      .select('id, tipo, nivel, mensaje, fecha_generada')
      .eq('resuelto', false)
      .order('fecha_generada', { ascending: false })
      .limit(4),
    supabase.from('proyectos')
      .select('id, nombre, tipo, estado, fecha_inicio, cliente:clientes(id, nombre)')
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('proyecto_items' as never) as any)
      .select('proyecto_id, precio_venta, gasto_real'),
    supabase.from('clientes')
      .select('id, nombre')
      .eq('estado', 'activo')
      .order('nombre', { ascending: true }),
    supabase.from('proveedores')
      .select('id, razon_social, nombre_comercial')
      .order('razon_social', { ascending: true }),
    supabase.from('gastos')
      .select('neto_a_pagar, fecha_comprobante')
      .gte('fecha_comprobante', thirteenMonthsAgoStart),
  ])

  const NIVEL_ORDER: Record<string, number> = { critico: 0, advertencia: 1, informativo: 2 }
  const alertas: AlertaItem[] = ((alertasRes.data ?? []) as AlertaItem[])
    .sort((a, b) => (NIVEL_ORDER[a.nivel] ?? 3) - (NIVEL_ORDER[b.nivel] ?? 3))

  const proyectos    = (proyectosRes.data    ?? []) as RawProyecto[]
  const clientes     = (clientesRes.data     ?? []) as ClienteOpt[]
  const proveedores  = (proveedoresRes.data  ?? []) as ProveedorOpt[]
  const proyectosOpts: ProyectoOpt[] = proyectos
    .filter(p => p.estado === 'activo')
    .map(p => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, estado: p.estado, cliente: p.cliente }))

  return (
    <InicioClient
      saludo={saludo}
      nombre={nombre}
      alertas={alertas}
      clientes={clientes}
      proveedores={proveedores}
      proyectosOpts={proyectosOpts}
      proyectosRaw={proyectos}
      itemsRaw={(itemsRes.data ?? []) as RawItem[]}
      movRealizadosRaw={(realizedRes.data ?? []) as RawMovR[]}
      movPendientesRaw={(pendingRes.data  ?? []) as RawMovP[]}
      gastosChartRaw={(gastosChartRes.data ?? []) as RawGasto[]}
      limaYear={limaYear}
      limaMonth={limaMonth}
      todayStr={todayStr}
    />
  )
}
