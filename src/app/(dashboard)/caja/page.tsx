import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react'
import { MovimientosTable } from './movimientos-table'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Caja — Kivo',
}

export default async function CajaPage() {
  const supabase = createClient()

  const { data: movimientos } = await supabase
    .from('movimientos_caja')
    .select(`
      id, tipo, concepto, monto, fecha_esperada, fecha_real, estado,
      proyecto:proyectos(id, nombre),
      cliente:clientes(id, nombre),
      proveedor:proveedores(id, razon_social, nombre_comercial)
    `)
    .order('fecha_esperada', { ascending: true })

  const data = (movimientos ?? []) as unknown as Array<{
    id: string
    tipo: 'ingreso' | 'egreso' | 'detraccion' | 'retencion'
    concepto: string
    monto: number
    fecha_esperada: string
    fecha_real: string | null
    estado: 'pendiente' | 'realizado' | 'vencido'
    proyecto: { id: string; nombre: string } | null
    cliente: { id: string; nombre: string } | null
    proveedor: { id: string; razon_social: string; nombre_comercial: string | null } | null
  }>

  // KPIs: solo pendientes (lo que falta por mover)
  const ingresosPendientes = data
    .filter((m) => m.tipo === 'ingreso' && m.estado === 'pendiente')
    .reduce((s, m) => s + m.monto, 0)

  const egresosPendientes = data
    .filter((m) => m.tipo === 'egreso' && m.estado === 'pendiente')
    .reduce((s, m) => s + m.monto, 0)

  const detraccionesPendientes = data
    .filter((m) => m.tipo === 'detraccion' && m.estado === 'pendiente')
    .reduce((s, m) => s + m.monto, 0)

  const saldoNeto = ingresosPendientes - egresosPendientes - detraccionesPendientes

  // Vencidos
  const today = new Date().toISOString().split('T')[0]
  const vencidosCount = data.filter(
    (m) => m.estado === 'pendiente' && m.fecha_esperada < today
  ).length

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Flujo de Caja</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Movimientos pendientes y realizados de la organización
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ingresos esperados */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Cobrar (pendiente)
            </p>
            <TrendingUp size={14} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono text-emerald-700">
            {formatMoney(ingresosPendientes)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">Ingresos por cobrar</p>
        </div>

        {/* Egresos pendientes */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Pagar (pendiente)
            </p>
            <TrendingDown size={14} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono text-red-700">
            {formatMoney(egresosPendientes)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">Egresos a pagar</p>
        </div>

        {/* Detracciones pendientes */}
        <div className={`rounded-lg border p-5 shadow-sm ${detraccionesPendientes > 0 ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-medium uppercase tracking-wide ${detraccionesPendientes > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
              Detracciones
            </p>
            <AlertTriangle size={14} className={detraccionesPendientes > 0 ? 'text-amber-400' : 'text-zinc-300'} />
          </div>
          <p className={`text-2xl font-bold tabular-nums font-mono ${detraccionesPendientes > 0 ? 'text-amber-900' : 'text-zinc-900'}`}>
            {detraccionesPendientes > 0 ? formatMoney(detraccionesPendientes) : '—'}
          </p>
          <p className={`mt-0.5 text-xs ${detraccionesPendientes > 0 ? 'text-amber-700' : 'text-zinc-400'}`}>
            Por depositar al Banco de la Nación
          </p>
        </div>

        {/* Saldo neto proyectado */}
        <div className={`rounded-lg border p-5 shadow-sm ${saldoNeto < 0 ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-medium uppercase tracking-wide ${saldoNeto < 0 ? 'text-red-500' : 'text-zinc-400'}`}>
              Saldo neto
            </p>
            <Wallet size={14} className={saldoNeto < 0 ? 'text-red-400' : 'text-zinc-300'} />
          </div>
          <p className={`text-2xl font-bold tabular-nums font-mono ${saldoNeto < 0 ? 'text-red-700' : 'text-zinc-900'}`}>
            {formatMoney(saldoNeto)}
          </p>
          <p className={`mt-0.5 text-xs ${saldoNeto < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
            {saldoNeto < 0 ? 'Posición negativa' : 'Cobros − pagos − detrac.'}
          </p>
        </div>
      </div>

      {/* Alerta de vencidos */}
      {vencidosCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{vencidosCount} movimiento{vencidosCount !== 1 ? 's' : ''} vencido{vencidosCount !== 1 ? 's' : ''}</span>
            {' '}— La fecha esperada ya pasó. Revisa y marca como realizado o vencido.
          </p>
        </div>
      )}

      {/* Tabla */}
      {data.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <Wallet size={32} className="mx-auto text-zinc-200 mb-3" />
          <p className="text-sm text-zinc-400">
            No hay movimientos aún. Se generan automáticamente al aprobar presupuestos y registrar gastos.
          </p>
        </div>
      ) : (
        <MovimientosTable movimientos={data} />
      )}
    </div>
  )
}
