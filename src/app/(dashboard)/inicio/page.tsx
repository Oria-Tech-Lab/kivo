import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { InicioClient } from './inicio-client'

export const revalidate = 300

export const metadata: Metadata = { title: 'Inicio — Kivo' }

// ─── Exported types (consumed by InicioClient) ───────────────────────────────

export interface ChartDataPoint { mes: string; ingresos: number; gastos: number }

export interface KpiData {
  porCobrar: number; porCobrarCount: number
  porPagar: number;  porPagarCount: number
  flujoNetoMes: number
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

export interface AlertaItem {
  id: string; tipo: string
  nivel: 'critico' | 'advertencia' | 'informativo'
  mensaje: string; fecha_generada: string
}

export interface SaludData { score: number; subtitle: string }
export interface ClienteOpt { id: string; nombre: string }
export interface ProveedorOpt { id: string; razon_social: string; nombre_comercial: string | null }
export interface ProyectoOpt {
  id: string; nombre: string; tipo: string; estado: string
  cliente: { id: string; nombre: string } | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

const TIPO_CFG: Record<string, { label: string; color: string }> = {
  digital:     { label: 'Digital',      color: '#1e40af' },
  instalacion: { label: 'Instalación',  color: '#f97316' },
  evento:      { label: 'Evento',       color: '#8b5cf6' },
  offline:     { label: 'Offline',      color: '#6b7280' },
  otro:        { label: 'Otro',         color: '#14b8a6' },
}

// ─── Internal row types ───────────────────────────────────────────────────────

type McR = { tipo: string; monto: number; fecha_real: string | null }
type McP = { tipo: string; monto: number; fecha_esperada: string | null }
type PrRaw = {
  id: string; nombre: string; tipo: string; estado: string
  cliente: { id: string; nombre: string } | null
}
type ItRaw = { proyecto_id: string; precio_venta: number; gasto_real: number }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InicioPage() {
  const supabase = createClient()

  // ── User & greeting ──────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const nombre = (user?.user_metadata?.full_name as string | undefined)
    ?? (user?.email?.split('@')[0] ?? '')

  const nowLima = new Date(Date.now() - 5 * 60 * 60 * 1000)
  const hora = nowLima.getUTCHours()
  const saludo =
    hora >= 5 && hora <= 11 ? 'Buenos días'
    : hora >= 12 && hora <= 18 ? 'Buenas tardes'
    : 'Buenas noches'

  // ── Date boundaries ──────────────────────────────────────────────────────
  const limaYear  = nowLima.getUTCFullYear()
  const limaMonth = nowLima.getUTCMonth() // 0-indexed

  const currentMonthKey   = `${limaYear}-${String(limaMonth + 1).padStart(2, '0')}`
  const currentMonthStart = `${currentMonthKey}-01`
  const todayStr          = dateStr(nowLima)
  const thirtyDaysLater   = dateStr(new Date(nowLima.getTime() + 30 * 24 * 60 * 60 * 1000))
  const sixMonthsAgoStart = dateStr(new Date(Date.UTC(limaYear, limaMonth - 6, 1)))
  const prevMonthKey = (() => {
    const d = new Date(Date.UTC(limaYear, limaMonth - 1, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })()

  // Suppress unused-variable warning — currentMonthStart is kept for clarity
  void currentMonthStart

  // ── Parallel fetches ─────────────────────────────────────────────────────
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
  ] = await Promise.all([
    // 1. Realized movements last 6 months (chart + monthly net flow)
    mcTable
      .select('tipo, monto, fecha_real')
      .eq('estado', 'realizado')
      .gte('fecha_real', sixMonthsAgoStart)
      .in('tipo', ['ingreso', 'egreso']),

    // 2. All pending movements (KPI cards)
    mcTable
      .select('tipo, monto, fecha_esperada')
      .eq('estado', 'pendiente')
      .in('tipo', ['ingreso', 'egreso']),

    // 3. Unresolved alerts (max 4)
    supabase.from('alertas')
      .select('id, tipo, nivel, mensaje, fecha_generada')
      .eq('resuelto', false)
      .order('fecha_generada', { ascending: false })
      .limit(4),

    // 4. All proyectos with cliente
    supabase.from('proyectos')
      .select('id, nombre, tipo, estado, cliente:clientes(id, nombre)')
      .order('created_at', { ascending: false }),

    // 5. proyecto_items for margin + pie chart
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('proyecto_items' as never) as any)
      .select('proyecto_id, precio_venta, gasto_real'),

    // 6. Clientes activos (new project dialog)
    supabase.from('clientes')
      .select('id, nombre')
      .eq('estado', 'activo')
      .order('nombre', { ascending: true }),

    // 7. Proveedores (quick expense sheet)
    supabase.from('proveedores')
      .select('id, razon_social, nombre_comercial')
      .order('razon_social', { ascending: true }),
  ])

  // ── Chart data (last 6 months) ───────────────────────────────────────────
  const months: { key: string; mes: string; ingresos: number; gastos: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(limaYear, limaMonth - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const raw = d.toLocaleString('es-PE', { month: 'short', timeZone: 'UTC' })
    months.push({ key, mes: raw.charAt(0).toUpperCase() + raw.slice(1, 3), ingresos: 0, gastos: 0 })
  }

  for (const mc of (realizedRes.data ?? []) as McR[]) {
    if (!mc.fecha_real) continue
    const entry = months.find(m => m.key === mc.fecha_real!.substring(0, 7))
    if (!entry) continue
    if (mc.tipo === 'ingreso') entry.ingresos += mc.monto
    else if (mc.tipo === 'egreso') entry.gastos += mc.monto
  }

  const chartData: ChartDataPoint[] = months.map(({ mes, ingresos, gastos }) => ({ mes, ingresos, gastos }))

  // ── KPI data ─────────────────────────────────────────────────────────────
  const pending = (pendingRes.data ?? []) as McP[]
  const pendingIngresos = pending.filter(m => m.tipo === 'ingreso')
  const pendingEgresos  = pending.filter(m => m.tipo === 'egreso')

  const porCobrar      = pendingIngresos.reduce((s, m) => s + m.monto, 0)
  const porCobrarCount = pendingIngresos.length
  const porPagar       = pendingEgresos.reduce((s, m) => s + m.monto, 0)
  const porPagarCount  = pendingEgresos.length

  const curMonthRealized = (realizedRes.data ?? [] as McR[]).filter(
    (m: McR) => m.fecha_real?.startsWith(currentMonthKey)
  )
  const flujoNetoMes = (curMonthRealized as McR[]).reduce(
    (s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto),
    0
  )

  const flujoProyectado = pendingIngresos
    .filter(m => m.fecha_esperada && m.fecha_esperada >= todayStr && m.fecha_esperada <= thirtyDaysLater)
    .reduce((s, m) => s + m.monto, 0)

  const last3AvgIngresos = months.slice(-3).reduce((s, m) => s + m.ingresos, 0) / 3
  const metaMensualPct = last3AvgIngresos > 0 ? Math.round((flujoProyectado / last3AvgIngresos) * 100) : 0

  const porCobrarEstesMes    = pendingIngresos.filter(m => m.fecha_esperada?.startsWith(currentMonthKey)).reduce((s, m) => s + m.monto, 0)
  const porCobrarMesAnterior = pendingIngresos.filter(m => m.fecha_esperada?.startsWith(prevMonthKey)).reduce((s, m) => s + m.monto, 0)
  const varPorCobrarPct: number | null = porCobrarMesAnterior > 0
    ? Math.round(((porCobrarEstesMes - porCobrarMesAnterior) / porCobrarMesAnterior) * 100)
    : null

  const prevMonthEgresosSum = (realizedRes.data ?? [] as McR[])
    .filter((m: McR) => m.tipo === 'egreso' && m.fecha_real?.startsWith(prevMonthKey))
    .reduce((s: number, m: McR) => s + m.monto, 0)
  const curMonthEgresosSum  = (curMonthRealized as McR[])
    .filter(m => m.tipo === 'egreso')
    .reduce((s, m) => s + m.monto, 0)
  const reduccionGastosPct: number | null = prevMonthEgresosSum > 0
    ? Math.round(((prevMonthEgresosSum - curMonthEgresosSum) / prevMonthEgresosSum) * 100)
    : null

  const kpis: KpiData = {
    porCobrar, porCobrarCount, porPagar, porPagarCount,
    flujoNetoMes, flujoProyectado, metaMensualPct,
    reduccionGastosPct, varPorCobrarPct,
  }

  // ── Proyectos + items ────────────────────────────────────────────────────
  const proyectos = (proyectosRes.data ?? []) as PrRaw[]
  const items     = (itemsRes.data ?? []) as ItRaw[]

  const itemsByProy = items.reduce<Record<string, { pv: number; gr: number }>>((acc, it) => {
    if (!acc[it.proyecto_id]) acc[it.proyecto_id] = { pv: 0, gr: 0 }
    acc[it.proyecto_id].pv += it.precio_venta
    acc[it.proyecto_id].gr += it.gasto_real
    return acc
  }, {})

  // ── Profitability table (top 5 non-closed, sorted by margin desc) ────────
  const rentabilidad: ProyectoRentabilidad[] = proyectos
    .filter(p => p.estado !== 'cerrado')
    .map(p => {
      const it = itemsByProy[p.id] ?? { pv: 0, gr: 0 }
      const margen_pct = it.pv > 0 ? ((it.pv - it.gr) / it.pv) * 100 : 0
      return {
        id: p.id, nombre: p.nombre, tipo: p.tipo, estado: p.estado,
        cliente: p.cliente, ingresos: it.pv, gasto_real: it.gr, margen_pct,
      }
    })
    .sort((a, b) => b.margen_pct - a.margen_pct)
    .slice(0, 5)

  // ── Distribucion (active projects grouped by tipo) ───────────────────────
  const distribucionMap: Record<string, number> = {}
  proyectos.filter(p => p.estado === 'activo').forEach(p => {
    const pv = (itemsByProy[p.id] ?? { pv: 0 }).pv
    if (pv > 0) distribucionMap[p.tipo] = (distribucionMap[p.tipo] ?? 0) + pv
  })
  const totalDist = Object.values(distribucionMap).reduce((a, b) => a + b, 0)
  const distribucion: DistribucionItem[] = Object.entries(distribucionMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([tipo, monto]) => ({
      tipo, monto,
      pct: totalDist > 0 ? Math.round((monto / totalDist) * 100) : 0,
      label: TIPO_CFG[tipo]?.label ?? tipo,
      color: TIPO_CFG[tipo]?.color ?? '#94a3b8',
    }))

  // ── Alertas (critico first) ──────────────────────────────────────────────
  const NIVEL_ORDER: Record<string, number> = { critico: 0, advertencia: 1, informativo: 2 }
  const alertas: AlertaItem[] = ((alertasRes.data ?? []) as AlertaItem[])
    .sort((a, b) => (NIVEL_ORDER[a.nivel] ?? 3) - (NIVEL_ORDER[b.nivel] ?? 3))

  // ── Health score ─────────────────────────────────────────────────────────
  const allActiveMargins = proyectos
    .filter(p => p.estado === 'activo')
    .map(p => {
      const it = itemsByProy[p.id] ?? { pv: 0, gr: 0 }
      return it.pv > 0 ? ((it.pv - it.gr) / it.pv) * 100 : 0
    })
  const avgMargen = allActiveMargins.length > 0
    ? allActiveMargins.reduce((a, b) => a + b, 0) / allActiveMargins.length
    : 0
  const proyectosEnRiesgo = allActiveMargins.filter(m => m < 15).length
  const alertasCriticas   = alertas.filter(a => a.nivel === 'critico').length

  let score = 0
  if (avgMargen > 30) score += 40
  if (flujoNetoMes > 0) score += 30
  if (alertasCriticas === 0) score += 20
  if (proyectosEnRiesgo === 0) score += 10

  const salud: SaludData = {
    score,
    subtitle: score >= 90 ? 'Tu empresa está en un estado óptimo de crecimiento este mes.'
      : score >= 70 ? 'Buen desempeño general, hay oportunidades de mejora.'
      : score >= 50 ? 'Atención requerida en algunos indicadores clave.'
      : 'Se requiere acción inmediata en finanzas del negocio.',
  }

  // ── Options for forms ────────────────────────────────────────────────────
  const clientes    = (clientesRes.data    ?? []) as ClienteOpt[]
  const proveedores = (proveedoresRes.data ?? []) as ProveedorOpt[]
  const proyectosOpts: ProyectoOpt[] = proyectos
    .filter(p => p.estado === 'activo')
    .map(p => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, estado: p.estado, cliente: p.cliente }))

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <InicioClient
      saludo={saludo}
      nombre={nombre}
      chartData={chartData}
      kpis={kpis}
      rentabilidad={rentabilidad}
      distribucion={distribucion}
      alertas={alertas}
      salud={salud}
      clientes={clientes}
      proveedores={proveedores}
      proyectosOpts={proyectosOpts}
    />
  )
}
