import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Inicio — Kivo',
}

/**
 * Pantalla de inicio — resumen ejecutivo.
 * Los KPIs y alertas completos se implementan en el Paso 9.
 * Por ahora muestra estructura y datos reales de sesión.
 */
export default async function InicioPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Hora en Lima para el saludo
  const hora = new Date().toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    hour: 'numeric',
    hour12: true,
  })
  const horaNum = parseInt(hora)
  const saludo =
    horaNum < 12 ? 'Buenos días' : horaNum < 19 ? 'Buenas tardes' : 'Buenas noches'

  // Alertas activas (si las hay)
  const { data: alertas } = await supabase
    .from('alertas')
    .select('id, nivel, mensaje, tipo')
    .eq('resuelto', false)
    .order('fecha_generada', { ascending: false })
    .limit(5)

  const alertasData = (alertas ?? []) as Array<{
    id: string
    nivel: string
    mensaje: string
    tipo: string
  }>

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

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {saludo}{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Aquí verás las alertas y métricas clave de tu organización.
        </p>
      </div>

      {/* KPI cards — valores reales en Paso 9 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Por cobrar', value: '—', sub: 'Presupuestos aprobados' },
          { label: 'Por pagar', value: '—', sub: 'Gastos pendientes' },
          { label: 'Alertas activas', value: alertasData.length.toString(), sub: 'Sin resolver' },
          { label: 'Flujo neto estimado', value: '—', sub: 'Próximos 30 días' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Alertas pendientes
          {alertasData.length > 0 && (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {alertasData.length}
            </span>
          )}
        </h2>

        {alertasData.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No hay alertas activas. ¡Todo en orden 🎉
          </p>
        ) : (
          <ul className="space-y-2">
            {alertasData.map((alerta) => (
              <li
                key={alerta.id}
                className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${nivelColor[alerta.nivel]}`}
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${nivelBadge[alerta.nivel]}`}
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
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Accesos rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Nuevo proyecto', href: '/proyectos/nuevo' },
            { label: 'Registrar gasto', href: '/gastos/nuevo' },
            { label: 'Ver flujo de caja', href: '/caja' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              {label} →
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
