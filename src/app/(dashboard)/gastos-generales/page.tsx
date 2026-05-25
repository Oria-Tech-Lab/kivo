import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/utils'
import { Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Gastos Generales — Kivo',
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente_asignacion: { label: 'Sin cubrir',       className: 'bg-red-50 text-red-700 border-red-200' },
  cubierto_parcial:     { label: 'Parcial',           className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cubierto:             { label: 'Cubierto',           className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  generando_ganancia:   { label: 'Con ganancia',       className: 'bg-blue-50 text-blue-700 border-blue-200' },
}

const MESES = [
  '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export default async function GastosGeneralesPage() {
  const supabase = createClient()
  const rol = await getUserRole()

  const { data: gastosGenerales } = await supabase
    .from('gastos_generales')
    .select(`
      id, concepto, tipo_recurrencia, monto, total, igv,
      periodo_mes, periodo_anio, umbral_proyectos, estado, created_at,
      proveedor:proveedores(id, razon_social, nombre_comercial)
    `)
    .order('created_at', { ascending: false })

  const data = (gastosGenerales ?? []) as Array<{
    id: string
    concepto: string
    tipo_recurrencia: string
    monto: number
    total: number
    igv: number
    periodo_mes: number | null
    periodo_anio: number | null
    umbral_proyectos: number
    estado: string
    created_at: string
    proveedor: { id: string; razon_social: string; nombre_comercial: string | null } | null
  }>

  const totalMensual = data
    .filter((g) => g.tipo_recurrencia === 'mensual')
    .reduce((s, g) => s + g.total, 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Gastos Generales
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Costos compartidos de la empresa
            {totalMensual > 0 && (
              <> · <span className="font-medium">{formatMoney(totalMensual)}/mes</span></>
            )}
          </p>
        </div>
        {(rol === 'admin' || rol === 'pm') && (
          <Button asChild>
            <Link href="/gastos-generales/nuevo">+ Nuevo gasto</Link>
          </Button>
        )}
      </div>

      {/* Tabla */}
      {data.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
          <Building2 size={32} className="mx-auto text-zinc-200 mb-3" />
          <p className="text-sm text-zinc-500">No hay gastos generales registrados.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Registra costos compartidos como alquiler, servicios y herramientas.
          </p>
          {(rol === 'admin' || rol === 'pm') && (
            <Button asChild className="mt-4" variant="outline">
              <Link href="/gastos-generales/nuevo">+ Registrar primer gasto</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Concepto</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden md:table-cell">Recurrencia</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 hidden lg:table-cell">Período</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Total</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.map((gg) => {
                const estadoCfg = ESTADO_CONFIG[gg.estado]
                const periodo = gg.periodo_mes && gg.periodo_anio
                  ? `${MESES[gg.periodo_mes]} ${gg.periodo_anio}`
                  : '—'
                return (
                  <tr key={gg.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/gastos-generales/${gg.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {gg.concepto}
                      </Link>
                      {gg.proveedor && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {gg.proveedor.nombre_comercial ?? gg.proveedor.razon_social}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        gg.tipo_recurrencia === 'mensual'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {gg.tipo_recurrencia === 'mensual' ? 'Mensual' : 'Puntual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 hidden lg:table-cell">
                      {periodo}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono tabular-nums font-medium text-zinc-900">
                        {formatMoney(gg.total)}
                      </span>
                      {gg.igv > 0 && (
                        <div className="text-xs text-zinc-400 tabular-nums">
                          IGV: {formatMoney(gg.igv)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${estadoCfg?.className ?? ''}`}>
                        {estadoCfg?.label ?? gg.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/gastos-generales/${gg.id}`}
                        className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
