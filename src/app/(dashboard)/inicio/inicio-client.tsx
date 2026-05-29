'use client'

import { useState } from 'react'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatMoney } from '@/lib/utils'
import type {
  ChartDataPoint, KpiData, ProyectoRentabilidad, DistribucionItem,
  AlertaItem, SaludData, ClienteOpt, ProveedorOpt, ProyectoOpt,
} from './page'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  saludo: string
  nombre: string
  chartData: ChartDataPoint[]
  kpis: KpiData
  rentabilidad: ProyectoRentabilidad[]
  distribucion: DistribucionItem[]
  alertas: AlertaItem[]
  salud: SaludData
  clientes: ClienteOpt[]
  proveedores: ProveedorOpt[]
  proyectosOpts: ProyectoOpt[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

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

function IngresosGastosChart({ data }: { data: ChartDataPoint[] }) {
  const hasData = data.some(d => d.ingresos > 0 || d.gastos > 0)

  const fmtY = (v: number) => {
    const s = v / 100
    if (s >= 1000) return `S/ ${Math.round(s / 1000)}k`
    return s > 0 ? `S/ ${s.toFixed(0)}` : '0'
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Ingresos vs Gastos por mes</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Comparativa semestral de desempeño financiero</p>
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
        <div className="px-5 py-8 text-center text-sm text-zinc-400">Sin proyectos activos</div>
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
                          style={{
                            width: `${Math.min(Math.max(p.margen_pct, 0), 100)}%`,
                            background: barColor,
                          }}
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
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => resolver(a.id)}
                  className="text-zinc-300 hover:text-zinc-500 shrink-0 mt-0.5 transition-colors"
                >
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
      {/* Decorative circles */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute right-0 top-16 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute right-24 -bottom-6 w-14 h-14 rounded-full bg-white/10" />
      {/* Stars */}
      <span className="absolute right-10 top-7 text-white/20 text-xl leading-none select-none">✦</span>
      <span className="absolute right-24 top-14 text-white/15 text-sm leading-none select-none">✦</span>

      <p className="relative text-xs font-medium text-white/70 mb-1">Salud Financiera</p>
      <p className="relative text-5xl font-bold text-white leading-none mb-2">{data.score}%</p>
      <p className="relative text-xs text-white/70 leading-relaxed mb-4 max-w-[200px]">
        {data.subtitle}
      </p>
      <Link
        href="/reportes"
        className="relative inline-flex items-center text-xs font-medium text-white border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/10 transition-colors"
      >
        Ver Detalles
      </Link>
    </div>
  )
}

// ── Quick Expense Sheet ───────────────────────────────────────────────────────

type TipoComprobante = 'factura' | 'boleta' | 'rxh' | 'sin_comprobante'
type EstadoPago = 'pendiente' | 'pagado'

function GastoSheet({ open, onClose, proyectos, proveedores }: {
  open: boolean; onClose: () => void
  proyectos: ProyectoOpt[]; proveedores: ProveedorOpt[]
}) {
  const todayStr = new Date().toISOString().split('T')[0]
  const emptyForm = {
    proyecto_id: '', proveedor_id: '', concepto: '', montoStr: '',
    tipo_comprobante: 'factura' as TipoComprobante,
    fecha_comprobante: todayStr,
    estado_pago: 'pendiente' as EstadoPago,
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setError(null)
    if (!form.proyecto_id)    return setError('Selecciona un proyecto')
    if (!form.proveedor_id)   return setError('Selecciona un proveedor')
    if (!form.concepto.trim()) return setError('Ingresa el concepto del gasto')
    const totalSoles = parseFloat(form.montoStr || '0')
    if (totalSoles <= 0) return setError('Ingresa un monto válido')

    // For facturas: user enters total with IGV → back-calculate subtotal
    const totalCentavos = Math.round(totalSoles * 100)
    const subtotal = form.tipo_comprobante === 'factura'
      ? Math.round(totalCentavos / 1.18)
      : totalCentavos

    setSaving(true)
    const r = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id:       form.proyecto_id,
        proveedor_id:      form.proveedor_id,
        concepto:          form.concepto,
        tipo_comprobante:  form.tipo_comprobante,
        subtotal,
        aplica_detraccion: false,
        pct_detraccion:    0,
        fecha_comprobante: form.fecha_comprobante,
        estado_pago:       form.estado_pago,
        notas:             '',
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json() as { error?: string }
      setError(j.error ?? 'Error al registrar el gasto')
    } else {
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setForm(emptyForm); onClose() }, 1500)
    }
  }

  const montoLabel = form.tipo_comprobante === 'factura' ? 'Total con IGV (S/)' : 'Monto (S/)'

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) { setError(null); setSuccess(false); onClose() } }}>
      <SheetContent side="right" className="w-[420px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-zinc-100">
          <SheetTitle>Registrar Gasto</SheetTitle>
        </SheetHeader>
        <div className="pt-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm font-medium text-zinc-900">Gasto registrado correctamente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Proyecto *</label>
                <select value={form.proyecto_id} onChange={e => setF('proyecto_id', e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                  <option value="">Seleccionar proyecto…</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Proveedor *</label>
                <select value={form.proveedor_id} onChange={e => setF('proveedor_id', e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                  <option value="">Seleccionar proveedor…</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre_comercial ?? p.razon_social}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Concepto *</label>
                <Input
                  value={form.concepto}
                  onChange={e => setF('concepto', e.target.value)}
                  placeholder="Descripción del gasto"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo comprobante</label>
                  <select
                    value={form.tipo_comprobante}
                    onChange={e => setF('tipo_comprobante', e.target.value as TipoComprobante)}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="factura">Factura</option>
                    <option value="boleta">Boleta</option>
                    <option value="rxh">RxH</option>
                    <option value="sin_comprobante">Sin comprobante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{montoLabel}</label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={form.montoStr}
                    onChange={e => setF('montoStr', e.target.value)}
                    placeholder="0.00"
                    className="tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha comprobante</label>
                  <Input
                    type="date"
                    value={form.fecha_comprobante}
                    onChange={e => setF('fecha_comprobante', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Estado de pago</label>
                  <select
                    value={form.estado_pago}
                    onChange={e => setF('estado_pago', e.target.value as EstadoPago)}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                  </select>
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
                {saving ? 'Registrando…' : 'Registrar Gasto'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── New Project Dialog ────────────────────────────────────────────────────────

function NuevoProyectoDialog({ open, onClose, clientes }: {
  open: boolean; onClose: () => void; clientes: ClienteOpt[]
}) {
  const router = useRouter()
  const todayStr = new Date().toISOString().split('T')[0]
  const emptyForm = {
    cliente_id: '', nombre: '', tipo: 'digital', estado: 'activo',
    fecha_inicio: todayStr, fecha_cierre_est: '',
    aplica_detraccion: false,
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setError(null)
    if (!form.cliente_id) return setError('Selecciona un cliente')
    if (form.nombre.trim().length < 2) return setError('El nombre del proyecto es requerido (mínimo 2 caracteres)')
    setSaving(true)
    const r = await fetch('/api/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id:         form.cliente_id,
        nombre:             form.nombre.trim(),
        tipo:               form.tipo,
        estado:             form.estado,
        fecha_inicio:       form.fecha_inicio,
        fecha_cierre_est:   form.fecha_cierre_est || undefined,
        aplica_detraccion:  form.aplica_detraccion,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json() as { error?: string }
      setError(j.error ?? 'Error al crear el proyecto')
    } else {
      const j = await r.json() as { id: string }
      setForm(emptyForm)
      onClose()
      router.push(`/proyectos/${j.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { setError(null); onClose() } }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nuevo Proyecto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Cliente *</label>
            <select value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              <option value="">Seleccionar cliente…</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre del proyecto *</label>
            <Input
              value={form.nombre}
              onChange={e => setF('nombre', e.target.value)}
              placeholder="Ej: Campaña Digital Q3"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setF('tipo', e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="digital">Digital</option>
                <option value="offline">Offline</option>
                <option value="evento">Evento</option>
                <option value="instalacion">Instalación</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Estado inicial</label>
              <select value={form.estado} onChange={e => setF('estado', e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="activo">Activo</option>
                <option value="en_pausa">En pausa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de inicio *</label>
              <Input type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Cierre estimado</label>
              <Input type="date" value={form.fecha_cierre_est} onChange={e => setF('fecha_cierre_est', e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={form.aplica_detraccion}
              onChange={e => setF('aplica_detraccion', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 accent-blue-600"
            />
            <span className="text-sm text-zinc-700">Aplica detracción</span>
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100">
            <Button variant="outline" onClick={() => { setError(null); onClose() }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Creando…' : 'Crear Proyecto'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Client Component ────────────────────────────────────────────────────

export function InicioClient({
  saludo, nombre, chartData, kpis, rentabilidad, distribucion,
  alertas, salud, clientes, proveedores, proyectosOpts,
}: Props) {
  const [gastoSheetOpen,    setGastoSheetOpen]    = useState(false)
  const [proyectoDialogOpen, setProyectoDialogOpen] = useState(false)

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
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
          varPositiveIsBad={true}
        />
        <KpiCard
          title="Flujo neto real"
          value={formatMoney(Math.abs(kpis.flujoNetoMes))}
          sub="Liquidez disponible inmediata"
          valueColor={kpis.flujoNetoMes >= 0 ? '#2563eb' : '#dc2626'}
        />
      </div>

      {/* ── Main 2-column layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: chart + table */}
        <div className="lg:col-span-2 space-y-6">
          <IngresosGastosChart data={chartData} />
          <ProfitabilityTable data={rentabilidad} />
        </div>

        {/* Right: donut + alerts + health */}
        <div className="space-y-4">
          <DistribucionChart data={distribucion} />
          <AlertasCard alertasIniciales={alertas} />
          <SaludCard data={salud} />
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
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
