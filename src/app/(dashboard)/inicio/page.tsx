import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { InicioClient } from './inicio-client'
import type {
  AlertaItem, ClienteOpt, ProveedorOpt, ProyectoOpt,
  RawMovR, RawMovP, RawProyecto, RawItem, RawGasto,
} from './types'

export const revalidate = 300
export const metadata: Metadata = { title: 'Inicio — Kivo' }

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

  const proyectos   = (proyectosRes.data   ?? []) as RawProyecto[]
  const clientes    = (clientesRes.data    ?? []) as ClienteOpt[]
  const proveedores = (proveedoresRes.data ?? []) as ProveedorOpt[]
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
