'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
} from 'recharts'
import { formatMoney, centavosToSoles } from '@/lib/utils'
import type { ProyectoItem, GastoFecha } from './page'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(centavos: number) {
  const s = centavosToSoles(centavos)
  return s >= 1000 ? `S/${(s / 1000).toFixed(1)}k` : `S/${s.toFixed(0)}`
}

function fmtFull(centavos: number) {
  return formatMoney(centavos)
}

// ── 1. Presupuesto vs Real ─────────────────────────────────────────────────────

export function ChartPresupuestoVsReal({ items }: { items: ProyectoItem[] }) {
  const data = items
    .filter(i => i.costo_estimado > 0 || i.gasto_real > 0)
    .map(i => ({
      name: i.concepto.length > 14 ? i.concepto.slice(0, 14) + '…' : (i.concepto || '(sin nombre)'),
      presupuestado: i.costo_estimado,
      real: i.gasto_real,
      esExtra: i.costo_estimado === 0,
    }))

  if (data.length === 0) return <ChartEmpty text="Sin ítems con montos para comparar" />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barCategoryGap="30%" barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => fmt(v)}
          tick={{ fontSize: 11, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [fmtFull(Number(value)), name === 'presupuestado' ? 'Presupuestado' : 'Real']}
          labelStyle={{ color: '#18181b', fontWeight: 600 }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
        />
        <Legend
          formatter={v => v === 'presupuestado' ? 'Presupuestado' : 'Real'}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="presupuestado" fill="#3b82f6" radius={[3, 3, 0, 0]} name="presupuestado" />
        <Bar dataKey="real" radius={[3, 3, 0, 0]} name="real">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.esExtra ? '#f59e0b' : '#10b981'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 2. Composición del gasto (Donut) ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ejecutado:    '#10b981',
  ahorro:       '#3b82f6',
  sobregasto:   '#ef4444',
  extra:        '#f59e0b',
  no_ejecutado: '#d4d4d8',
}

const STATUS_LABELS: Record<string, string> = {
  ejecutado:    'Ejecutado',
  ahorro:       'Ahorro',
  sobregasto:   'Sobregasto',
  extra:        'Extra',
  no_ejecutado: 'No ejecutado',
}

interface DonutProps {
  items: ProyectoItem[]
  getStatus: (item: ProyectoItem) => string
}

export function ChartComposicion({ items, getStatus }: DonutProps) {
  const grouped: Record<string, number> = {}
  items.forEach(i => {
    const s = getStatus(i)
    if (i.gasto_real > 0) grouped[s] = (grouped[s] ?? 0) + i.gasto_real
  })

  const data = Object.entries(grouped)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: STATUS_LABELS[key] ?? key, value, key }))

  const total = data.reduce((s, d) => s + d.value, 0)

  if (data.length === 0) return <ChartEmpty text="Sin gastos registrados aún" />

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.key] ?? '#a1a1aa'} />
              ))}
            </Pie>
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmtFull(Number(v)), '']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-zinc-400">Total</span>
          <span className="text-sm font-bold text-zinc-900">{fmt(total)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0">
        {data.map(d => (
          <div key={d.key} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[d.key] ?? '#a1a1aa' }} />
            <span className="text-zinc-600 truncate">{d.name}</span>
            <span className="ml-auto font-mono text-zinc-700 pl-2">{fmt(d.value)}</span>
            <span className="text-zinc-400 w-8 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 3. Cascada de margen ──────────────────────────────────────────────────────

export function ChartCascada({
  items,
  indirecto,
}: {
  items: ProyectoItem[]
  indirecto: number
}) {
  const ingreso      = items.reduce((s, i) => s + i.precio_venta, 0)
  const costoDirecto = items.reduce((s, i) => s + i.gasto_real, 0)
  const margen       = ingreso - costoDirecto - indirecto

  const data = [
    { name: 'Ingreso',       value: ingreso,      color: '#3b82f6' },
    { name: 'Costo Directo', value: costoDirecto, color: '#f87171' },
    ...(indirecto > 0 ? [{ name: 'Indirecto', value: indirecto, color: '#f59e0b' }] : []),
    { name: 'Margen',        value: Math.abs(margen), color: margen >= 0 ? '#10b981' : '#ef4444' },
  ]

  if (ingreso === 0 && costoDirecto === 0) return <ChartEmpty text="Sin datos de ingreso o gasto" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={v => fmt(v)}
          tick={{ fontSize: 11, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#3f3f46' }}
          axisLine={false}
          tickLine={false}
          width={88}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmtFull(Number(v)), '']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 4. Burn rate ──────────────────────────────────────────────────────────────

export function ChartBurnRate({
  gastos,
  fechaInicio,
  fechaCierre,
  presupuestadoTotal,
}: {
  gastos: GastoFecha[]
  fechaInicio: string
  fechaCierre: string | null
  presupuestadoTotal: number
}) {
  if (gastos.length === 0 || !fechaCierre || presupuestadoTotal === 0) {
    return <ChartEmpty text="Registra gastos con fecha para ver el burn rate" />
  }

  const start = new Date(fechaInicio).getTime()
  const end   = new Date(fechaCierre).getTime()
  if (end <= start) return <ChartEmpty text="Define una fecha de cierre válida" />

  // Acumular gastos reales por fecha
  const sorted = [...gastos].sort((a, b) => new Date(a.fecha_comprobante).getTime() - new Date(b.fecha_comprobante).getTime())
  let cumReal = 0
  const realPoints: { date: number; real: number }[] = []
  for (const g of sorted) {
    const t = new Date(g.fecha_comprobante).getTime()
    if (t >= start && t <= Math.max(end, Date.now())) {
      cumReal += g.total
      realPoints.push({ date: t, real: cumReal })
    }
  }

  // Build chart data: daily points from start to max(end, today)
  const chartEnd  = Math.max(end, realPoints.at(-1)?.date ?? end)
  const days = Math.ceil((chartEnd - start) / 86400000)
  const step = Math.max(1, Math.floor(days / 20)) // max ~20 points

  const data: { label: string; planificado: number; real?: number }[] = []
  let realIdx = 0
  let lastReal: number | undefined

  for (let d = 0; d <= days; d += step) {
    const t    = start + d * 86400000
    const pct  = Math.min((t - start) / (end - start), 1)
    const plan = Math.round(presupuestadoTotal * pct)
    const label = new Date(t).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })

    // Advance real pointer
    while (realIdx < realPoints.length && realPoints[realIdx].date <= t) {
      lastReal = realPoints[realIdx].real
      realIdx++
    }

    data.push({ label, planificado: plan, real: lastReal })
  }

  const overBudgetDate = data.find(d => d.real !== undefined && d.real > d.planificado)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis
          tickFormatter={v => fmt(v)}
          tick={{ fontSize: 11, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, name: any) => [fmtFull(Number(v)), name === 'planificado' ? 'Planificado' : 'Real acumulado']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
        />
        <Legend
          formatter={v => v === 'planificado' ? 'Planificado' : 'Real acumulado'}
          iconType="circle" iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="planificado"
          stroke="#a1a1aa"
          strokeDasharray="5 4"
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="real"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        {overBudgetDate && (
          <ReferenceLine
            x={overBudgetDate.label}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{ value: '⚠', position: 'top', fontSize: 12 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Placeholder ────────────────────────────────────────────────────────────────

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-zinc-400 text-center">{text}</p>
    </div>
  )
}
