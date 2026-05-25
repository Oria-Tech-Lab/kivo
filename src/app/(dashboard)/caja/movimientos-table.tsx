'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatMoney, formatDate } from '@/lib/utils'

type Movimiento = {
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
}

const TIPO_CONFIG: Record<string, { label: string; className: string }> = {
  ingreso:    { label: 'Ingreso',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  egreso:     { label: 'Egreso',      className: 'bg-red-50 text-red-700 border-red-200' },
  detraccion: { label: 'Detracción',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  retencion:  { label: 'Retención',   className: 'bg-blue-50 text-blue-700 border-blue-200' },
}

const ESTADO_CONFIG: Record<string, { label: string; dot: string }> = {
  pendiente: { label: 'Pendiente', dot: 'bg-zinc-400' },
  realizado: { label: 'Realizado', dot: 'bg-emerald-500' },
  vencido:   { label: 'Vencido',   dot: 'bg-red-500' },
}

type FiltroTipo = 'todos' | 'ingreso' | 'egreso' | 'detraccion' | 'retencion'
type FiltroEstado = 'todos' | 'pendiente' | 'realizado' | 'vencido'

export function MovimientosTable({ movimientos }: { movimientos: Movimiento[] }) {
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')

  const filtered = useMemo(() => {
    return movimientos.filter((m) => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
      if (filtroEstado !== 'todos' && m.estado !== filtroEstado) return false
      return true
    })
  }, [movimientos, filtroTipo, filtroEstado])

  const tiposBtn: { value: FiltroTipo; label: string }[] = [
    { value: 'todos',      label: 'Todos' },
    { value: 'ingreso',    label: 'Ingresos' },
    { value: 'egreso',     label: 'Egresos' },
    { value: 'detraccion', label: 'Detracciones' },
    { value: 'retencion',  label: 'Retenciones' },
  ]

  const estadosBtn: { value: FiltroEstado; label: string }[] = [
    { value: 'todos',     label: 'Todos' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'realizado', label: 'Realizado' },
    { value: 'vencido',   label: 'Vencido' },
  ]

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {tiposBtn.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFiltroTipo(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtroTipo === value
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-zinc-200 hidden sm:block" />
        <div className="flex gap-1 flex-wrap">
          {estadosBtn.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFiltroEstado(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtroEstado === value
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {(filtroTipo !== 'todos' || filtroEstado !== 'todos') && (
          <button
            onClick={() => { setFiltroTipo('todos'); setFiltroEstado('todos') }}
            className="text-xs text-zinc-400 hover:text-zinc-700 ml-1"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-400">No hay movimientos con estos filtros.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Concepto</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Proyecto</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Monto</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden md:table-cell">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((mov) => {
                const esTipoIngreso = mov.tipo === 'ingreso'
                const estaVencido = mov.estado === 'pendiente' && mov.fecha_esperada < today
                const cfg = TIPO_CONFIG[mov.tipo]
                const estadoCfg = ESTADO_CONFIG[mov.estado]
                return (
                  <tr key={mov.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold border ${cfg?.className ?? ''}`}>
                        {cfg?.label ?? mov.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-800 font-medium leading-snug">{mov.concepto}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {esTipoIngreso ? mov.cliente?.nombre : mov.proveedor?.nombre_comercial ?? mov.proveedor?.razon_social}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {mov.proyecto ? (
                        <Link
                          href={`/proyectos/${mov.proyecto.id}`}
                          className="text-zinc-600 text-xs hover:underline"
                        >
                          {mov.proyecto.nombre}
                        </Link>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono tabular-nums font-medium ${esTipoIngreso ? 'text-emerald-700' : 'text-red-700'}`}>
                        {esTipoIngreso ? '+' : '-'}{formatMoney(mov.monto)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className={`text-xs ${estaVencido ? 'text-red-600 font-medium' : 'text-zinc-500'}`}>
                        {formatDate(mov.fecha_esperada)}
                        {estaVencido && <span className="ml-1 text-[10px] bg-red-100 text-red-600 rounded px-1">VENCIDO</span>}
                      </p>
                      {mov.fecha_real && (
                        <p className="text-[11px] text-zinc-400">
                          Real: {formatDate(mov.fecha_real)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${estadoCfg?.dot ?? 'bg-zinc-300'}`} />
                        <span className="text-xs text-zinc-500">{estadoCfg?.label ?? mov.estado}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50/50 text-xs text-zinc-400">
            {filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
