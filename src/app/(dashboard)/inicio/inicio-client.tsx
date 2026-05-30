'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Plus, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight,
  ArrowUpRight, ArrowDownRight, X, BarChart2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatMoney } from '@/lib/utils'
import type {
  AlertaItem, ClienteOpt, ProveedorOpt, ProyectoOpt,
  RawMovR, RawMovP, RawProyecto, RawItem, RawGasto,
  ChartDataPoint, KpiData, ProyectoRentabilidad, DistribucionItem, SaludData,
} from './types'
import { TIPO_CFG } from './types'
import { GastoSheet, NuevoProyectoDialog } from '@/components/forms/create-dialogs'

// ── Filter types ──────────────────────────────────────────────────────────────

export type DashboardFilters = {
  periodo: 'mes' | 'mes_anterior' | '3m' | '6m' | 'año' | 'custom'
  fechaInicio?: Date
  fechaFin?: Date
  clienteId?: string
  tipo?: string
  estado?: string
}

const DEFAULT_FILTERS: DashboardFilters = { periodo: '6m', estado: 'activo' }
const LS_KEY = 'kivo_dashboard_filters'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  saludo: string
  nombre: string
  alertas: AlertaItem[]
  clientes: ClienteOpt[]
  proveedores: ProveedorOpt[]
  proyectosOpts: ProyectoOpt[]
  // Raw arrays for client-side filter computation:
  proyectosRaw: RawProyecto[]
  itemsRaw: RawItem[]
  movRealizadosRaw: RawMovR[]
  movPendientesRaw: RawMovP[]
  gastosChartRaw: RawGasto[]
  limaYear: number
  limaMonth: number  // 0-indexed
  todayStr: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, { label: string; cls: string }> = {
  activo:   { label: 'En progreso', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_pausa: { label: 'En pausa',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cerrado:  { label: 'Completado',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

const NIVEL_CFG: Record<'critico' | 'advertencia' | 'informativo', {
  leftBorder: string; bg: string; titleCls: string
}> = {
  critico:     { leftBorder: 'border-l-red-500',   bg: 'bg-red-50',   titleCls: 'text-red-700'   },
  advertencia: { leftBorder: 'border-l-amber-500', bg: 'bg-amber-50', titleCls: 'text-amber-700' },
  informativo: { leftBorder: 'border-l-blue-500',  bg: 'bg-blue-50',  titleCls: 'text-blue-700'  },
}

const PERIODO_LABEL: Record<DashboardFilters['periodo'], string> = {
  mes:          'Este mes',
  mes_anterior: 'Mes anterior',
  '3m':         'Últimos 3 meses',
  '6m':         'Últimos 6 meses',
  año:          'Este año',
  custom:       'Personalizado',
}

const CHART_SUBTITLE: Record<DashboardFilters['periodo'], string> = {
  mes:          'Ingresos y gastos del mes actual por día',
  mes_anterior: 'Ingresos y gastos del mes anterior por día',
  '3m':         'Comparativa semanal — últimos 3 meses',
  '6m':         'Comparativa semestral de desempeño financiero',
  año:          'Comparativa anual de desempeño financiero',
  custom:       'Período personalizado',
}

// ── Period bounds ─────────────────────────────────────────────────────────────

type Granularity = 'day' | 'week' | 'month'

function computePeriodBounds(
  filters: DashboardFilters,
  limaYear: number,
  limaMonth: number,
  todayStr: string,
): { dateStart: string; dateEnd: string; granularity: Granularity } {
  const pad = (n: number) => String(n).padStart(2, '0')
  switch (filters.periodo) {
    case 'mes': {
      const start = `${limaYear}-${pad(limaMonth + 1)}-01`
      return { dateStart: start, dateEnd: todayStr, granularity: 'day' }
    }
    case 'mes_anterior': {
      const d = new Date(Date.UTC(limaYear, limaMonth - 1, 1))
      const y = d.getUTCFullYear(); const m = d.getUTCMonth()
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
      return {
        dateStart: `${y}-${pad(m + 1)}-01`,
        dateEnd:   `${y}-${pad(m + 1)}-${pad(lastDay)}`,
        granularity: 'day',
      }
    }
    case '3m':
      return {
        dateStart: new Date(Date.UTC(limaYear, limaMonth - 3, 1)).toISOString().split('T')[0],
        dateEnd: todayStr,
        granularity: 'week',
      }
    case '6m':
      return {
        dateStart: new Date(Date.UTC(limaYear, limaMonth - 6, 1)).toISOString().split('T')[0],
        dateEnd: todayStr,
        granularity: 'month',
      }
    case 'año':
      return { dateStart: `${limaYear}-01-01`, dateEnd: todayStr, granularity: 'month' }
    case 'custom': {
      const start = filters.fechaInicio
        ? filters.fechaInicio.toISOString().split('T')[0]
        : new Date(Date.UTC(limaYear, limaMonth - 6, 1)).toISOString().split('T')[0]
      const end = filters.fechaFin
        ? filters.fechaFin.toISOString().split('T')[0]
        : todayStr
      const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
      const granularity: Granularity = days <= 62 ? 'day' : days <= 120 ? 'week' : 'month'
      return { dateStart: start, dateEnd: end, granularity }
    }
  }
}

// ── Chart data computation ────────────────────────────────────────────────────

interface Bucket {
  label: string
  ingresos: number; gastos: number
  altIngresos: number; altGastos: number
  match: (d: string) => boolean
}

function buildBuckets(dateStart: string, dateEnd: string, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = []
  if (granularity === 'day') {
    let cur = new Date(dateStart + 'T00:00:00Z')
    const end = new Date(dateEnd + 'T00:00:00Z')
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0]
      buckets.push({ label: String(cur.getUTCDate()), ingresos: 0, gastos: 0, altIngresos: 0, altGastos: 0, match: d => d.substring(0, 10) === key })
      cur = new Date(cur.getTime() + 86400000)
    }
  } else if (granularity === 'week') {
    let cur = new Date(dateStart + 'T00:00:00Z')
    const end = new Date(dateEnd + 'T00:00:00Z')
    let n = 1
    while (cur <= end) {
      const ws = cur.toISOString().split('T')[0]
      const we = new Date(Math.min(cur.getTime() + 6 * 86400000, end.getTime())).toISOString().split('T')[0]
      const weekLabel = `Sem ${n++}`
      buckets.push({ label: weekLabel, ingresos: 0, gastos: 0, altIngresos: 0, altGastos: 0, match: d => d >= ws && d <= we })
      cur = new Date(cur.getTime() + 7 * 86400000)
    }
  } else {
    // month
    let cur = new Date(dateStart + 'T00:00:00Z')
    const end = new Date(dateEnd + 'T00:00:00Z')
    while (cur <= end) {
      const y = cur.getUTCFullYear(); const m = cur.getUTCMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const raw = cur.toLocaleString('es-PE', { month: 'short', timeZone: 'UTC' })
      const label = raw.charAt(0).toUpperCase() + raw.slice(1, 3)
      buckets.push({ label, ingresos: 0, gastos: 0, altIngresos: 0, altGastos: 0, match: d => d.substring(0, 7) === key })
      cur = new Date(Date.UTC(y, m + 1, 1))
    }
  }
  return buckets
}

function computeChartData(
  movRealizados: RawMovR[],
  gastosChart: RawGasto[],
  proyectos: RawProyecto[],
  itemsByProy: Record<string, { pv: number; gr: number }>,
  dateStart: string,
  dateEnd: string,
  granularity: Granularity,
): ChartDataPoint[] {
  const buckets = buildBuckets(dateStart, dateEnd, granularity)
  if (buckets.length === 0) return []

  for (const mc of movRealizados) {
    if (!mc.fecha_real || mc.fecha_real < dateStart || mc.fecha_real > dateEnd) continue
    const b = buckets.find(b => b.match(mc.fecha_real!))
    if (!b) continue
    if (mc.tipo === 'ingreso') b.ingresos += mc.monto
    else b.gastos += mc.monto
  }

  for (const g of gastosChart) {
    if (!g.fecha_comprobante || g.fecha_comprobante < dateStart || g.fecha_comprobante > dateEnd) continue
    const b = buckets.find(b => b.match(g.fecha_comprobante!))
    if (b) b.altGastos += g.neto_a_pagar ?? 0
  }

  for (const p of proyectos) {
    if (!p.fecha_inicio || p.fecha_inicio < dateStart || p.fecha_inicio > dateEnd) continue
    const b = buckets.find(b => b.match(p.fecha_inicio!))
    if (b) b.altIngresos += (itemsByProy[p.id] ?? { pv: 0 }).pv
  }

  const hasPrimary = buckets.some(b => b.ingresos > 0 || b.gastos > 0)
  return buckets.map(b => ({
    mes: b.label,
    ingresos: hasPrimary ? b.ingresos : b.altIngresos,
    gastos:   hasPrimary ? b.gastos   : b.altGastos,
  }))
}

// ── KPI computation ───────────────────────────────────────────────────────────

function computeKpis(
  movRealizados: RawMovR[],
  movPendientes: RawMovP[],
  dateStart: string,
  dateEnd: string,
  todayStr: string,
  limaYear: number,
  limaMonth: number,
): KpiData {
  const pad = (n: number) => String(n).padStart(2, '0')
  const currentMonthKey = `${limaYear}-${pad(limaMonth + 1)}`
  const prevD = new Date(Date.UTC(limaYear, limaMonth - 1, 1))
  const prevMonthKey = `${prevD.getUTCFullYear()}-${pad(prevD.getUTCMonth() + 1)}`
  const thirtyDaysLater = new Date(new Date(todayStr).getTime() + 30 * 86400000).toISOString().split('T')[0]

  const pendingIngresos = movPendientes.filter(m => m.tipo === 'ingreso')
  const pendingEgresos  = movPendientes.filter(m => m.tipo === 'egreso')

  const porCobrar      = pendingIngresos.reduce((s, m) => s + m.monto, 0)
  const porCobrarCount = pendingIngresos.length
  const porPagar       = pendingEgresos.reduce((s, m) => s + m.monto, 0)
  const porPagarCount  = pendingEgresos.length

  // flujoNeto: realized movements within the selected period
  const periodRealized = movRealizados.filter(
    m => m.fecha_real && m.fecha_real >= dateStart && m.fecha_real <= dateEnd
  )
  const flujoNeto = periodRealized.reduce(
    (s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0
  )

  const flujoProyectado = pendingIngresos
    .filter(m => m.fecha_esperada && m.fecha_esperada >= todayStr && m.fecha_esperada <= thirtyDaysLater)
    .reduce((s, m) => s + m.monto, 0)

  // metaMensualPct: projected vs avg of last 3 months ingresos (current month buckets in realized)
  const last3Months = [-2, -1, 0].map(off => {
    const d = new Date(Date.UTC(limaYear, limaMonth + off, 1))
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
  })
  const last3AvgIngresos = last3Months.reduce((sum, mk) => {
    return sum + movRealizados.filter(m => m.tipo === 'ingreso' && m.fecha_real?.startsWith(mk)).reduce((s, m) => s + m.monto, 0)
  }, 0) / 3
  const metaMensualPct = last3AvgIngresos > 0 ? Math.round((flujoProyectado / last3AvgIngresos) * 100) : 0

  const porCobrarCurrentMonth = pendingIngresos.filter(m => m.fecha_esperada?.startsWith(currentMonthKey)).reduce((s, m) => s + m.monto, 0)
  const porCobrarPrevMonth    = pendingIngresos.filter(m => m.fecha_esperada?.startsWith(prevMonthKey)).reduce((s, m) => s + m.monto, 0)
  const varPorCobrarPct: number | null = porCobrarPrevMonth > 0
    ? Math.round(((porCobrarCurrentMonth - porCobrarPrevMonth) / porCobrarPrevMonth) * 100)
    : null

  const prevMonthEgresos = movRealizados.filter(m => m.tipo === 'egreso' && m.fecha_real?.startsWith(prevMonthKey)).reduce((s, m) => s + m.monto, 0)
  const curMonthEgresos  = movRealizados.filter(m => m.tipo === 'egreso' && m.fecha_real?.startsWith(currentMonthKey)).reduce((s, m) => s + m.monto, 0)
  const reduccionGastosPct: number | null = prevMonthEgresos > 0
    ? Math.round(((prevMonthEgresos - curMonthEgresos) / prevMonthEgresos) * 100)
    : null

  return {
    porCobrar, porCobrarCount, porPagar, porPagarCount,
    flujoNeto, flujoProyectado, metaMensualPct,
    reduccionGastosPct, varPorCobrarPct,
  }
}

// ── Rentabilidad + Distribución computation ───────────────────────────────────

function computeRentabilidad(
  proyectos: RawProyecto[],
  itemsByProy: Record<string, { pv: number; gr: number }>,
  estado: string | undefined,
): ProyectoRentabilidad[] {
  const estadoFilter = estado && estado !== 'todos' ? estado : null
  return proyectos
    .filter(p => estadoFilter ? p.estado === estadoFilter : p.estado !== 'cerrado')
    .map(p => {
      const it = itemsByProy[p.id] ?? { pv: 0, gr: 0 }
      const margen_pct = it.pv > 0 ? ((it.pv - it.gr) / it.pv) * 100 : 0
      return { id: p.id, nombre: p.nombre, tipo: p.tipo, estado: p.estado, cliente: p.cliente, ingresos: it.pv, gasto_real: it.gr, margen_pct }
    })
    .sort((a, b) => b.margen_pct - a.margen_pct)
    .slice(0, 5)
}

function computeDistribucion(
  proyectos: RawProyecto[],
  itemsByProy: Record<string, { pv: number; gr: number }>,
): DistribucionItem[] {
  const map: Record<string, number> = {}
  proyectos.filter(p => p.estado === 'activo').forEach(p => {
    const pv = (itemsByProy[p.id] ?? { pv: 0 }).pv
    if (pv > 0) map[p.tipo] = (map[p.tipo] ?? 0) + pv
  })
  const total = Object.values(map).reduce((a, b) => a + b, 0)
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([tipo, monto]) => ({
      tipo, monto,
      pct:   total > 0 ? Math.round((monto / total) * 100) : 0,
      label: TIPO_CFG[tipo]?.label ?? tipo,
      color: TIPO_CFG[tipo]?.color ?? '#94a3b8',
    }))
}

function computeSalud(
  proyectos: RawProyecto[],
  itemsByProy: Record<string, { pv: number; gr: number }>,
  flujoNeto: number,
  alertas: AlertaItem[],
): SaludData {
  const activeMargins = proyectos
    .filter(p => p.estado === 'activo')
    .flatMap(p => {
      const it = itemsByProy[p.id] ?? { pv: 0, gr: 0 }
      if (it.pv === 0) return []
      return [((it.pv - it.gr) / it.pv) * 100]
    })
  const avgMargen = activeMargins.length > 0
    ? activeMargins.reduce((a, b) => a + b, 0) / activeMargins.length
    : 0
  const proyectosEnRiesgo = activeMargins.filter(m => m < 15).length
  const alertasCriticas   = alertas.filter(a => a.nivel === 'critico').length

  let score = 0
  if (avgMargen > 30)       score += 40
  if (flujoNeto > 0)        score += 30
  if (alertasCriticas === 0) score += 20
  if (proyectosEnRiesgo === 0) score += 10

  return {
    score,
    subtitle:
      score >= 90 ? 'Tu empresa está en un estado óptimo de crecimiento este mes.'
      : score >= 70 ? 'Buen desempeño general, hay oportunidades de mejora.'
      : score >= 50 ? 'Atención requerida en algunos indicadores clave.'
      : 'Se requiere acción inmediata en finanzas del negocio.',
  }
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadFilters(): DashboardFilters {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_FILTERS
    const p = JSON.parse(raw) as Record<string, unknown>
    return {
      ...DEFAULT_FILTERS,
      ...p,
      fechaInicio: p.fechaInicio ? new Date(p.fechaInicio as string) : undefined,
      fechaFin:    p.fechaFin    ? new Date(p.fechaFin    as string) : undefined,
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

function saveFilters(f: DashboardFilters) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(f)) } catch {}
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const selectCls = 'h-8 rounded-md border border-zinc-200 bg-white pl-2.5 pr-6 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 appearance-none cursor-pointer'

function FilterBar({
  filters, onChange, clientes,
}: {
  filters: DashboardFilters
  onChange: (f: DashboardFilters) => void
  clientes: ClienteOpt[]
}) {
  const isDefault = (
    filters.periodo === DEFAULT_FILTERS.periodo &&
    !filters.clienteId &&
    !filters.tipo &&
    (filters.estado === DEFAULT_FILTERS.estado || !filters.estado)
  )

  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch })

  // Active filter pills (non-default)
  const pills: { key: string; label: string; clear: () => void }[] = []
  if (filters.periodo !== DEFAULT_FILTERS.periodo) {
    const label = filters.periodo === 'custom' && filters.fechaInicio && filters.fechaFin
      ? `${filters.fechaInicio.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} – ${filters.fechaFin.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`
      : PERIODO_LABEL[filters.periodo]
    pills.push({ key: 'periodo', label, clear: () => set({ periodo: DEFAULT_FILTERS.periodo, fechaInicio: undefined, fechaFin: undefined }) })
  }
  if (filters.clienteId) {
    const c = clientes.find(c => c.id === filters.clienteId)
    pills.push({ key: 'cliente', label: c?.nombre ?? 'Cliente', clear: () => set({ clienteId: undefined }) })
  }
  if (filters.tipo) {
    pills.push({ key: 'tipo', label: TIPO_CFG[filters.tipo]?.label ?? filters.tipo, clear: () => set({ tipo: undefined }) })
  }
  if (filters.estado && filters.estado !== DEFAULT_FILTERS.estado) {
    const estadoMap: Record<string, string> = { en_pausa: 'En pausa', cerrado: 'Cerrados', todos: 'Todos' }
    pills.push({ key: 'estado', label: estadoMap[filters.estado] ?? filters.estado, clear: () => set({ estado: DEFAULT_FILTERS.estado }) })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Period */}
        <div className="relative">
          <select
            value={filters.periodo}
            onChange={e => set({ periodo: e.target.value as DashboardFilters['periodo'], fechaInicio: undefined, fechaFin: undefined })}
            className={selectCls}
          >
            <option value="mes">Este mes</option>
            <option value="mes_anterior">Mes anterior</option>
            <option value="3m">Últimos 3 meses</option>
            <option value="6m">Últimos 6 meses</option>
            <option value="año">Este año</option>
            <option value="custom">Personalizado</option>
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]">▾</span>
        </div>

        {/* Custom date range */}
        {filters.periodo === 'custom' && (
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={filters.fechaInicio ? filters.fechaInicio.toISOString().split('T')[0] : ''}
              onChange={e => set({ fechaInicio: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined })}
            />
            <span className="text-zinc-400 text-xs">—</span>
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={filters.fechaFin ? filters.fechaFin.toISOString().split('T')[0] : ''}
              onChange={e => set({ fechaFin: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined })}
            />
          </div>
        )}

        <div className="h-4 w-px bg-zinc-200 mx-0.5" />

        {/* Cliente */}
        <div className="relative">
          <select
            value={filters.clienteId ?? ''}
            onChange={e => set({ clienteId: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]">▾</span>
        </div>

        {/* Tipo */}
        <div className="relative">
          <select
            value={filters.tipo ?? ''}
            onChange={e => set({ tipo: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">Todos los tipos</option>
            <option value="digital">Digital</option>
            <option value="instalacion">Instalación</option>
            <option value="evento">Evento</option>
            <option value="offline">Offline</option>
            <option value="otro">Otro</option>
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]">▾</span>
        </div>

        {/* Estado */}
        <div className="relative">
          <select
            value={filters.estado ?? 'activo'}
            onChange={e => set({ estado: e.target.value })}
            className={selectCls}
          >
            <option value="activo">Activos</option>
            <option value="en_pausa">En pausa</option>
            <option value="cerrado">Cerrados</option>
            <option value="todos">Todos</option>
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]">▾</span>
        </div>

        {/* Clear */}
        {!isDefault && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors ml-1"
          >
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Active pills */}
      {pills.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[11px] text-zinc-400">Filtrando:</span>
          {pills.map(pill => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700"
            >
              {pill.label}
              <button onClick={pill.clear} className="hover:text-blue-900">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, varPct, varPositiveIsBad = false, valueColor }: {
  title: string; value: string; sub: string
  varPct?: number | null; varPositiveIsBad?: boolean; valueColor?: string
}) {
  const isPositive = varPct != null && varPct >= 0
  const badgeGreen = varPositiveIsBad ? !isPositive : isPositive
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
        {varPct != null && (
          <span className={cn(
            'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            badgeGreen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
          )}>
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(varPct)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: valueColor ?? '#18181b' }}>
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-400 leading-snug">{sub}</p>
    </div>
  )
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function IngresosGastosChart({ data, periodo }: { data: ChartDataPoint[]; periodo: DashboardFilters['periodo'] }) {
  const hasData = data.some(d => d.ingresos > 0 || d.gastos > 0)

  const fmtY = (v: number) => {
    const s = v / 100
    if (s >= 1000) return `S/ ${Math.round(s / 1000)}k`
    return s > 0 ? `S/ ${s.toFixed(0)}` : '0'
  }

  const xAxisInterval = data.length > 20 ? 4 : data.length > 13 ? 1 : 0

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Ingresos vs Gastos</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{CHART_SUBTITLE[periodo]}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#1e40af' }} />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#93c5fd' }} />
            Gastos
          </span>
        </div>
      </div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barCategoryGap="35%" barGap={3}>
            <XAxis
              dataKey="mes"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              interval={xAxisInterval}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={fmtY}
              width={68}
            />
            {hasData && (
              <Tooltip
                cursor={{ fill: 'rgba(241,245,249,0.8)' }}
                formatter={(v: unknown, name: unknown) => [
                  formatMoney(v as number),
                  (name as string) === 'ingresos' ? 'Ingresos' : 'Gastos',
                ]}
                labelStyle={{ fontSize: 12, color: '#1e293b', fontWeight: 600 }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 10px' }}
              />
            )}
            {hasData && <Bar dataKey="ingresos" fill="#1e40af" radius={[3, 3, 0, 0]} />}
            {hasData && <Bar dataKey="gastos"   fill="#93c5fd" radius={[3, 3, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
        {!hasData && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none"
            style={{ top: 8, left: 68, right: 0, bottom: 28 }}
          >
            <BarChart2 size={32} className="text-zinc-300" />
            <p className="text-sm font-medium text-zinc-400">Sin movimientos registrados aún</p>
            <p className="text-xs text-zinc-300 text-center max-w-[200px]">
              Los datos aparecerán cuando registres ingresos y gastos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DistribucionChart({ data }: { data: DistribucionItem[] }) {
  const dominant = data[0] ?? null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-900 mb-4">Distribución de Proyectos</h2>
      {data.length === 0 ? (
        <p className="text-xs text-zinc-400 py-6 text-center">Sin proyectos activos con ingresos</p>
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  dataKey="monto"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: unknown) => [formatMoney(v as number), '']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {dominant && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold text-zinc-900 leading-none">{dominant.pct}%</p>
                <p className="text-xs text-zinc-400 mt-1">{dominant.label}</p>
              </div>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {data.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-zinc-600">{d.label}</span>
                </div>
                <span className="font-medium tabular-nums text-zinc-700">{formatMoney(d.monto)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Profitability Table ───────────────────────────────────────────────────────

function ProfitabilityTable({ data }: { data: ProyectoRentabilidad[] }) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">Rentabilidad por Proyecto</h2>
        <Link href="/proyectos" className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline">
          Ver todos <ChevronRight size={12} />
        </Link>
      </div>
      {data.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-zinc-400">Sin datos para los filtros seleccionados</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Proyecto</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Cliente</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500">Ingresos</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 w-44">Margen</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.map(p => {
              const barColor = p.margen_pct >= 30 ? '#059669' : p.margen_pct >= 15 ? '#d97706' : '#dc2626'
              const estadoCfg = ESTADO_CFG[p.estado] ?? { label: p.estado, cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' }
              return (
                <tr
                  key={p.id}
                  className="hover:bg-zinc-50/60 transition-colors cursor-pointer"
                  onClick={() => router.push(`/proyectos/${p.id}`)}
                >
                  <td className="px-4 py-3 min-w-[200px]">
                    <p className="text-xs font-medium text-zinc-900">{p.nombre}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-500">
                    {p.cliente?.nombre ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-xs text-zinc-700">
                    {formatMoney(p.ingresos)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-100 rounded-full h-1.5 min-w-[50px]">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(Math.max(p.margen_pct, 0), 100)}%`, background: barColor }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: barColor }}>
                        {p.margen_pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('text-xs', estadoCfg.cls)}>
                      {estadoCfg.label}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Alerts Card ───────────────────────────────────────────────────────────────

function AlertasCard({ alertasIniciales }: { alertasIniciales: AlertaItem[] }) {
  const [alertas, setAlertas] = useState(alertasIniciales)

  async function resolver(id: string) {
    setAlertas(prev => prev.filter(a => a.id !== id))
    const r = await fetch(`/api/alertas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resuelto: true }),
    })
    if (!r.ok) setAlertas(alertasIniciales)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-900">Alertas Críticas</h2>
        {alertas.length > 0 && (
          <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            {alertas.length}
          </span>
        )}
      </div>
      {alertas.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
          <p className="text-xs text-emerald-700">Sin alertas pendientes — todo en orden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map(a => {
            const cfg = NIVEL_CFG[a.nivel]
            return (
              <div
                key={a.id}
                className={cn('border-l-2 rounded-r-lg px-3 py-2.5 flex items-start gap-2', cfg.leftBorder, cfg.bg)}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium leading-snug', cfg.titleCls)}>{a.mensaje}</p>
                  {a.fecha_generada && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {new Date(a.fecha_generada).toLocaleString('es-PE', {
                        timeZone: 'America/Lima',
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                <button onClick={() => resolver(a.id)} className="text-zinc-300 hover:text-zinc-500 shrink-0 mt-0.5 transition-colors">
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Financial Health Card ─────────────────────────────────────────────────────

function SaludCard({ data }: { data: SaludData }) {
  return (
    <div className="rounded-xl p-5 relative overflow-hidden" style={{ background: '#1e40af' }}>
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute right-0 top-16 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute right-24 -bottom-6 w-14 h-14 rounded-full bg-white/10" />
      <span className="absolute right-10 top-7 text-white/20 text-xl leading-none select-none">✦</span>
      <span className="absolute right-24 top-14 text-white/15 text-sm leading-none select-none">✦</span>
      <p className="relative text-xs font-medium text-white/70 mb-1">Salud Financiera</p>
      <p className="relative text-5xl font-bold text-white leading-none mb-2">{data.score}%</p>
      <p className="relative text-xs text-white/70 leading-relaxed mb-4 max-w-[200px]">{data.subtitle}</p>
      <Link
        href="/reportes"
        className="relative inline-flex items-center text-xs font-medium text-white border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/10 transition-colors"
      >
        Ver Detalles
      </Link>
    </div>
  )
}


// ── Main Client Component ────────────────────────────────────────────────────

export function InicioClient({
  saludo, nombre, alertas, clientes, proveedores, proyectosOpts,
  proyectosRaw, itemsRaw, movRealizadosRaw, movPendientesRaw, gastosChartRaw,
  limaYear, limaMonth, todayStr,
}: Props) {
  const [gastoSheetOpen,     setGastoSheetOpen]     = useState(false)
  const [proyectoDialogOpen, setProyectoDialogOpen] = useState(false)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)

  // Load persisted filters after mount
  useEffect(() => {
    const saved = loadFilters()
    setFilters(saved)
  }, [])

  function updateFilters(f: DashboardFilters) {
    setFilters(f)
    saveFilters(f)
  }

  // ── Derived data via useMemo ─────────────────────────────────────────────

  const { dateStart, dateEnd, granularity } = useMemo(
    () => computePeriodBounds(filters, limaYear, limaMonth, todayStr),
    [filters, limaYear, limaMonth, todayStr],
  )

  const filteredProyectos = useMemo(() => {
    return proyectosRaw.filter(p => {
      if (filters.clienteId && p.cliente?.id !== filters.clienteId) return false
      if (filters.tipo && p.tipo !== filters.tipo) return false
      return true
    })
  }, [proyectosRaw, filters.clienteId, filters.tipo])

  const itemsByProy = useMemo(() => {
    return itemsRaw.reduce<Record<string, { pv: number; gr: number }>>((acc, it) => {
      if (!acc[it.proyecto_id]) acc[it.proyecto_id] = { pv: 0, gr: 0 }
      acc[it.proyecto_id].pv += it.precio_venta
      acc[it.proyecto_id].gr += it.gasto_real
      return acc
    }, {})
  }, [itemsRaw])

  const chartData = useMemo(
    () => computeChartData(movRealizadosRaw, gastosChartRaw, filteredProyectos, itemsByProy, dateStart, dateEnd, granularity),
    [movRealizadosRaw, gastosChartRaw, filteredProyectos, itemsByProy, dateStart, dateEnd, granularity],
  )

  const kpis = useMemo(
    () => computeKpis(movRealizadosRaw, movPendientesRaw, dateStart, dateEnd, todayStr, limaYear, limaMonth),
    [movRealizadosRaw, movPendientesRaw, dateStart, dateEnd, todayStr, limaYear, limaMonth],
  )

  const rentabilidad = useMemo(
    () => computeRentabilidad(filteredProyectos, itemsByProy, filters.estado),
    [filteredProyectos, itemsByProy, filters.estado],
  )

  const distribucion = useMemo(
    () => computeDistribucion(filteredProyectos, itemsByProy),
    [filteredProyectos, itemsByProy],
  )

  const salud = useMemo(
    () => computeSalud(proyectosRaw, itemsByProy, kpis.flujoNeto, alertas),
    [proyectosRaw, itemsByProy, kpis.flujoNeto, alertas],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  const flujoNetoColor =
    kpis.flujoNeto > 0 ? '#2563eb'
    : kpis.flujoNeto < 0 ? '#dc2626'
    : '#71717a'

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {saludo}{nombre ? `, ${nombre}` : ''}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rastrea tus finanzas, monitorea el crecimiento y mantén el control.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setGastoSheetOpen(true)}>
            <Plus size={14} /> Registrar Gasto
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setProyectoDialogOpen(true)}>
            <TrendingUp size={14} /> Nuevo Proyecto
          </Button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <FilterBar filters={filters} onChange={updateFilters} clientes={clientes} />

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Por cobrar"
          value={formatMoney(kpis.porCobrar)}
          sub={`${kpis.porCobrarCount} factura${kpis.porCobrarCount !== 1 ? 's' : ''} pendiente${kpis.porCobrarCount !== 1 ? 's' : ''} de cobro`}
          varPct={kpis.varPorCobrarPct}
          varPositiveIsBad={false}
        />
        <KpiCard
          title="Flujo proyectado"
          value={formatMoney(kpis.flujoProyectado)}
          sub={`Meta mensual: ${kpis.metaMensualPct}% alcanzado`}
        />
        <KpiCard
          title="Por pagar"
          value={formatMoney(kpis.porPagar)}
          sub={
            kpis.reduccionGastosPct !== null
              ? `${kpis.reduccionGastosPct > 0 ? 'Reducción' : 'Aumento'} en gastos: ${Math.abs(kpis.reduccionGastosPct)}%`
              : `${kpis.porPagarCount} pago${kpis.porPagarCount !== 1 ? 's' : ''} pendiente${kpis.porPagarCount !== 1 ? 's' : ''}`
          }
          varPositiveIsBad
        />
        <KpiCard
          title="Flujo neto real"
          value={formatMoney(Math.abs(kpis.flujoNeto))}
          sub="Liquidez disponible inmediata"
          valueColor={flujoNetoColor}
        />
      </div>

      {/* ── Main 2-column layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <IngresosGastosChart data={chartData} periodo={filters.periodo} />
          <ProfitabilityTable data={rentabilidad} />
        </div>
        <div className="space-y-4">
          <DistribucionChart data={distribucion} />
          <AlertasCard alertasIniciales={alertas} />
          <SaludCard data={salud} />
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <GastoSheet
        open={gastoSheetOpen}
        onClose={() => setGastoSheetOpen(false)}
        proyectos={proyectosOpts}
        proveedores={proveedores}
      />
      <NuevoProyectoDialog
        open={proyectoDialogOpen}
        onClose={() => setProyectoDialogOpen(false)}
        clientes={clientes}
      />
    </div>
  )
}
