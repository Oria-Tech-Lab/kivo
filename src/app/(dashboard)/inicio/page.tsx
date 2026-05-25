import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, CheckCircle, TrendingUp, Clock, Plus } from 'lucide-react'
import { formatMoney } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Inicio — Kivo',
}

export default async function InicioPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Saludo personalizado por hora Lima
  const hora = new Date().toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    hour: 'numeric',
    hour12: false,
  })
  const horaNum = parseInt(hora)
  const saludo =
    horaNum < 12 ? 'Buenos días' : horaNum < 19 ? 'Buenas tardes' : 'Buenas noches'

  // Cargar KPIs en paralelo
  const [
    alertasRes,
    gastosPendientesRes,
    presupuestosAprobadosRes,
    detraccPendientesRes,
    proyectosActivosRes,
  ] = await Promise.all([
    // Alertas activas
    supabase
      .from('alertas')
      .select('id, nivel, mensaje, tipo')
      .eq('resuelto', false)
      .order('fecha_generada', { ascending: false })
      .limit(8),

    // Total de gastos pendientes de pago (neto_a_pagar)
    supabase
      .from('gastos')
      .select('neto_a_pagar')
      .eq('estado_pago', 'pendiente'),

    // Total presupuestado aprobado (todos los proyectos activos)
    supabase
      .from('presupuestos')
      .select('total')
      .eq('estado', 'aprobado'),

    // Detracciones pendientes
    supabase
      .from('gastos')
      .select('monto_detraccion, fecha_comprobante')
      .eq('aplica_detraccion', true)
      .eq('estado_detraccion', 'pendiente'),

    // Proyectos activos
    supabase
      .from('proyectos')
      .select('id')
      .eq('estado', 'activo'),
  ])

  const alertas = (alertasRes.data ?? []) as Array<{
    id: string
    nivel: string
    mensaje: string
    tipo: string
  }>

  const gastosPendientesTotal = (gastosPendientesRes.data ?? []).reduce(
    (sum, g) => sum + ((g as { neto_a_pagar: number }).neto_a_pagar ?? 0),
    0
  )

  const presupuestadoTotal = (presupuestosAprobadosRes.data ?? []).reduce(
    (sum, p) => sum + ((p as { total: number }).total ?? 0),
    0
  )

  const detraccTotal = (detraccPendientesRes.data ?? []).reduce(
    (sum, d) => sum + ((d as { monto_detraccion: number }).monto_detraccion ?? 0),
    0
  )

  const detraccCount = detraccPendientesRes.data?.length ?? 0
  const proyectosActivos = proyectosActivosRes.data?.length ?? 0

  // Nivel de color para alertas
  const nivelColor: Record<string, string> = {
    critico: 'border-red-200 bg-red-50 text-red-700',
    advertencia: 'border-amber-200 bg-amber-50 text-amber-700',
    informativo: 'border-blue-200 bg-blue-50 text-blue-700',
  }
  const nivelBadge: Record<string, string> = {
    critico: 'bg-red-100 text-red-700',
    advertencia: 'bg-amber-100 text-amber-700',
    informativo: 'bg-blue-100 text-blue-700',
  }

  const nombre = user?.email?.split('@')[0] ?? ''

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {saludo}{nombre ? `, ${nombre}` : ''}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Resumen financiero de tu organización
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Por pagar */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Por pagar
            </p>
            <Clock size={14} className="text-zinc-300" />
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono text-zinc-900">
            {formatMoney(gastosPendientesTotal)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">Gastos pendientes</p>
        </div>

        {/* Presupuestado aprobado */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Presupuestado
            </p>
            <TrendingUp size={14} className="text-zinc-300" />
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono text-zinc-900">
            {formatMoney(presupuestadoTotal)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">Aprobado (total)</p>
        </div>

        {/* Detracciones pendientes */}
        <div className={`rounded-lg border p-5 shadow-sm ${detraccCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-medium uppercase tracking-wide ${detraccCount > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
              Detracciones
            </p>
            <AlertTriangle size={14} className={detraccCount > 0 ? 'text-amber-400' : 'text-zinc-300'} />
          </div>
          <p className={`text-2xl font-bold tabular-nums font-mono ${detraccCount > 0 ? 'text-amber-900' : 'text-zinc-900'}`}>
            {detraccCount > 0 ? formatMoney(detraccTotal) : '—'}
          </p>
          <p className={`mt-0.5 text-xs ${detraccCount > 0 ? 'text-amber-700' : 'text-zinc-400'}`}>
            {detraccCount > 0 ? `${detraccCount} por depositar` : 'Sin pendientes'}
          </p>
        </div>

        {/* Proyectos activos */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Proyectos activos
            </p>
            <CheckCircle size={14} className="text-zinc-300" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-zinc-900">
            {proyectosActivos}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">En curso</p>
        </div>
      </div>

      {/* Alertas */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Alertas pendientes
          {alertas.length > 0 && (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {alertas.length}
            </span>
          )}
        </h2>

        {alertas.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No hay alertas activas. ¡Todo en orden 🎉
          </p>
        ) : (
          <ul className="space-y-2">
            {alertas.map((alerta) => (
              <li
                key={alerta.id}
                className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${nivelColor[alerta.nivel] ?? ''}`}
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${nivelBadge[alerta.nivel] ?? ''}`}
                >
                  {alerta.nivel}
                </span>
                <span>{alerta.mensaje}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Acciones rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Nuevo proyecto', href: '/proyectos/nuevo', icon: Plus },
            { label: 'Registrar gasto', href: '/gastos/nuevo', icon: Plus },
            { label: 'Nuevo presupuesto', href: '/presupuestos/nuevo', icon: Plus },
            { label: 'Ver todos los gastos', href: '/gastos', icon: null },
          ].map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              {Icon && <Icon size={14} className="text-zinc-400" />}
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Estado de detracciones (si hay pendientes) */}
      {detraccCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                {detraccCount} detracción{detraccCount !== 1 ? 'es' : ''} pendiente{detraccCount !== 1 ? 's' : ''}
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                Total: {formatMoney(detraccTotal)} · Deben depositarse al Banco de la Nación
                antes del 5to día hábil del siguiente mes.
              </p>
              <Link
                href="/gastos?estado_pago=pendiente"
                className="mt-2 inline-flex text-sm font-medium text-amber-800 underline"
              >
                Ver gastos con detracción pendiente →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
