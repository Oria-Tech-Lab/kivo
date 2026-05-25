import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { ChevronLeft, Pencil, Calendar, Building2, Tag, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatMoney, formatPercent } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('proyectos')
    .select('nombre')
    .eq('id', params.id)
    .single()
  return {
    title: data ? `${data.nombre as string} — Kivo` : 'Proyecto — Kivo',
  }
}

interface Props {
  params: { id: string }
}

const TIPO_LABEL: Record<string, string> = {
  digital: 'Digital',
  offline: 'Offline',
  evento: 'Evento',
  instalacion: 'Instalación',
  otro: 'Otro',
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  activo: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  en_pausa: { label: 'En pausa', className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50' },
  cerrado: { label: 'Cerrado', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

export default async function ProyectoDetallePage({ params }: Props) {
  const supabase = createClient()
  const rol = await getUserRole()

  const { data, error } = await supabase
    .from('proyectos')
    .select(`
      *,
      cliente:clientes(id, nombre, ruc, contacto_nombre, contacto_email),
      categoria:categorias(id, nombre, color)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) {
    notFound()
  }

  const proyecto = data as {
    id: string
    nombre: string
    tipo: string
    estado: string
    fecha_inicio: string
    fecha_cierre_est: string | null
    aplica_detraccion: boolean
    notas: string | null
    created_at: string
    cliente: {
      id: string
      nombre: string
      ruc: string | null
      contacto_nombre: string | null
      contacto_email: string | null
    } | null
    categoria: {
      id: string
      nombre: string
      color: string | null
    } | null
  }

  // KPIs financieros en paralelo
  const [presupuestosRes, gastosRes] = await Promise.all([
    // Presupuestos aprobados del proyecto
    supabase
      .from('presupuestos')
      .select('total, igv_total')
      .eq('proyecto_id', params.id)
      .eq('estado', 'aprobado'),

    // Gastos registrados del proyecto
    supabase
      .from('gastos')
      .select('total, igv')
      .eq('proyecto_id', params.id),
  ])

  const presupuestadoTotal = (presupuestosRes.data ?? []).reduce(
    (s, p) => s + ((p as { total: number }).total ?? 0), 0
  )
  const igvDebito = (presupuestosRes.data ?? []).reduce(
    (s, p) => s + ((p as { igv_total: number }).igv_total ?? 0), 0
  )

  const gastosData = (gastosRes.data ?? []) as Array<{ total: number; igv: number }>
  const gastadoTotal = gastosData.reduce((s, g) => s + (g.total ?? 0), 0)
  const igvCredito = gastosData.reduce((s, g) => s + (g.igv ?? 0), 0)

  const gastoCount = gastosData.length
  const margenBruto = presupuestadoTotal - gastadoTotal
  const margenPct = presupuestadoTotal > 0 ? (margenBruto / presupuestadoTotal) * 100 : null
  const posicionIGV = igvDebito - igvCredito // positivo = debo pagar; negativo = saldo a favor

  const estadoConfig = ESTADO_CONFIG[proyecto.estado] ?? { label: proyecto.estado, className: '' }
  const canEdit = rol === 'admin' || rol === 'pm'

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/proyectos"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a Proyectos
        </Link>

        <div className="mt-2 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {proyecto.nombre}
              </h1>
              <Badge variant="outline" className={estadoConfig.className}>
                {estadoConfig.label}
              </Badge>
            </div>
            {proyecto.cliente && (
              <p className="mt-0.5 text-sm text-zinc-500">
                Cliente:{' '}
                <Link
                  href={`/clientes/${proyecto.cliente.id}/editar`}
                  className="text-zinc-700 hover:underline"
                >
                  {proyecto.cliente.nombre}
                </Link>
              </p>
            )}
          </div>

          {canEdit && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/proyectos/${proyecto.id}/editar`}>
                <Pencil size={14} className="mr-1.5" />
                Editar
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* KPIs financieros */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Presupuestado aprobado */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Presupuestado</p>
          <p className="mt-2 text-xl font-bold tabular-nums font-mono text-zinc-900">
            {presupuestadoTotal > 0 ? formatMoney(presupuestadoTotal) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {presupuestadoTotal > 0 ? 'Total aprobado' : 'Sin presupuesto aprobado'}
          </p>
        </div>

        {/* Gastado */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Gastado</p>
          <p className="mt-2 text-xl font-bold tabular-nums font-mono text-zinc-900">
            {gastadoTotal > 0 ? formatMoney(gastadoTotal) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {gastoCount > 0 ? `${gastoCount} gasto${gastoCount !== 1 ? 's' : ''}` : 'Sin gastos aún'}
          </p>
        </div>

        {/* Margen bruto */}
        <div className={`rounded-lg border p-5 shadow-sm ${
          margenPct === null ? 'border-zinc-200 bg-white'
          : margenPct < 0 ? 'border-red-200 bg-red-50'
          : margenPct < 20 ? 'border-amber-200 bg-amber-50'
          : 'border-emerald-200 bg-emerald-50'
        }`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${
            margenPct === null ? 'text-zinc-400'
            : margenPct < 0 ? 'text-red-500'
            : margenPct < 20 ? 'text-amber-600'
            : 'text-emerald-600'
          }`}>
            Margen bruto
          </p>
          <p className={`mt-2 text-xl font-bold tabular-nums font-mono ${
            margenPct === null ? 'text-zinc-900'
            : margenPct < 0 ? 'text-red-700'
            : margenPct < 20 ? 'text-amber-900'
            : 'text-emerald-900'
          }`}>
            {presupuestadoTotal > 0 ? formatMoney(margenBruto) : '—'}
          </p>
          <p className={`mt-0.5 text-xs ${
            margenPct === null ? 'text-zinc-400'
            : margenPct < 0 ? 'text-red-600'
            : margenPct < 20 ? 'text-amber-700'
            : 'text-emerald-700'
          }`}>
            {margenPct !== null ? `${formatPercent(margenPct)} sobre presupuesto` : 'Sin datos suficientes'}
          </p>
        </div>

        {/* Posición IGV */}
        <div className={`rounded-lg border p-5 shadow-sm ${
          igvDebito === 0 && igvCredito === 0 ? 'border-zinc-200 bg-white'
          : posicionIGV > 0 ? 'border-blue-200 bg-blue-50'
          : 'border-emerald-200 bg-emerald-50'
        }`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${
            igvDebito === 0 && igvCredito === 0 ? 'text-zinc-400'
            : posicionIGV > 0 ? 'text-blue-600'
            : 'text-emerald-600'
          }`}>
            Posición IGV
          </p>
          <p className={`mt-2 text-xl font-bold tabular-nums font-mono ${
            igvDebito === 0 && igvCredito === 0 ? 'text-zinc-900'
            : posicionIGV > 0 ? 'text-blue-900'
            : 'text-emerald-900'
          }`}>
            {igvDebito > 0 || igvCredito > 0 ? formatMoney(Math.abs(posicionIGV)) : '—'}
          </p>
          <p className={`mt-0.5 text-xs ${
            igvDebito === 0 && igvCredito === 0 ? 'text-zinc-400'
            : posicionIGV > 0 ? 'text-blue-700'
            : 'text-emerald-700'
          }`}>
            {igvDebito === 0 && igvCredito === 0
              ? 'Sin movimientos IGV'
              : posicionIGV > 0
              ? 'A pagar a SUNAT'
              : 'Saldo a favor'}
          </p>
        </div>
      </div>

      {/* Datos del proyecto */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Información general */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Información del proyecto</h2>
          <dl className="space-y-3">
            <div className="flex items-start gap-3">
              <Tag size={15} className="mt-0.5 text-zinc-400 shrink-0" />
              <div>
                <dt className="text-xs text-zinc-400">Tipo</dt>
                <dd className="text-sm text-zinc-700">{TIPO_LABEL[proyecto.tipo] ?? proyecto.tipo}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={15} className="mt-0.5 text-zinc-400 shrink-0" />
              <div>
                <dt className="text-xs text-zinc-400">Fecha de inicio</dt>
                <dd className="text-sm text-zinc-700">{formatDate(proyecto.fecha_inicio)}</dd>
              </div>
            </div>

            {proyecto.fecha_cierre_est && (
              <div className="flex items-start gap-3">
                <Calendar size={15} className="mt-0.5 text-zinc-400 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-400">Cierre estimado</dt>
                  <dd className="text-sm text-zinc-700">{formatDate(proyecto.fecha_cierre_est)}</dd>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <AlertTriangle size={15} className="mt-0.5 text-zinc-400 shrink-0" />
              <div>
                <dt className="text-xs text-zinc-400">Detracción al facturar</dt>
                <dd className="text-sm text-zinc-700">
                  {proyecto.aplica_detraccion ? (
                    <span className="text-amber-700">Aplica (10%)</span>
                  ) : (
                    'No aplica'
                  )}
                </dd>
              </div>
            </div>

            {proyecto.categoria && (
              <div className="flex items-start gap-3">
                <Tag size={15} className="mt-0.5 text-zinc-400 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-400">Categoría</dt>
                  <dd className="text-sm text-zinc-700 flex items-center gap-1.5">
                    {proyecto.categoria.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: proyecto.categoria.color }}
                      />
                    )}
                    {proyecto.categoria.nombre}
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </div>

        {/* Datos del cliente */}
        {proyecto.cliente && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Cliente</h2>
            <dl className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 size={15} className="mt-0.5 text-zinc-400 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-400">Empresa</dt>
                  <dd className="text-sm font-medium text-zinc-700">{proyecto.cliente.nombre}</dd>
                  {proyecto.cliente.ruc && (
                    <dd className="font-mono text-xs text-zinc-400">{proyecto.cliente.ruc}</dd>
                  )}
                </div>
              </div>

              {proyecto.cliente.contacto_nombre && (
                <div className="flex items-start gap-3">
                  <Building2 size={15} className="mt-0.5 text-zinc-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-zinc-400">Contacto</dt>
                    <dd className="text-sm text-zinc-700">{proyecto.cliente.contacto_nombre}</dd>
                    {proyecto.cliente.contacto_email && (
                      <dd className="text-xs text-zinc-400">{proyecto.cliente.contacto_email}</dd>
                    )}
                  </div>
                </div>
              )}
            </dl>

            <div className="mt-4 pt-4 border-t border-zinc-100">
              <Link
                href={`/clientes/${proyecto.cliente.id}/editar`}
                className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
              >
                Ver / editar cliente →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Notas */}
      {proyecto.notas && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Notas</h2>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{proyecto.notas}</p>
        </div>
      )}

      {/* Accesos rápidos a módulos futuros */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Acciones</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/gastos/nuevo?proyecto_id=${proyecto.id}`}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            + Registrar gasto
          </Link>
          <Link
            href={`/presupuestos/nuevo?proyecto_id=${proyecto.id}`}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            + Crear presupuesto
          </Link>
          <Link
            href={`/gastos?proyecto_id=${proyecto.id}`}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            Ver gastos del proyecto →
          </Link>
        </div>
      </div>
    </div>
  )
}
