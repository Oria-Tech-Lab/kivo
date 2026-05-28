import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FacturasClient } from './facturas-client'
import type { FacturaArchivoEntry } from '../proyectos/[id]/page'

export const metadata: Metadata = { title: 'Facturas — Kivo' }
export const revalidate = 60

// Lima is UTC-5 — fixed offset (Peru does not observe DST)
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000

function limaToday(): Date {
  const now = new Date()
  return new Date(now.getTime() + LIMA_OFFSET_MS)
}

function startOfMonthLima(): Date {
  const d = limaToday()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - LIMA_OFFSET_MS)
}

export interface FacturaGlobal {
  id: string
  proyecto_id: string
  org_id: string
  numero_factura: string
  subtotal: number
  aplica_igv: boolean
  igv: number
  aplica_detraccion: boolean
  pct_detraccion: number
  monto_detraccion: number
  total: number
  cliente_abona: number
  estado: 'borrador' | 'emitida' | 'cobrada' | 'vencida'
  fecha_emision: string | null
  fecha_vencimiento: string | null
  fecha_cobro: string | null
  notas: string | null
  archivos: FacturaArchivoEntry[]
  created_at: string
  proyecto: {
    id: string
    nombre: string
    aplica_detraccion: boolean
    cliente: { id: string; nombre: string } | null
  } | null
}

export interface ProyectoBasico {
  id: string
  nombre: string
  cliente_id: string | null
  aplica_detraccion: boolean
  cliente: { id: string; nombre: string } | null
}

export interface ClienteBasico {
  id: string
  nombre: string
}

export interface FacturaKpis {
  totalFacturado: number        // sum subtotal all
  countTotal: number
  porCobrar: number             // sum total where estado in (emitida, borrador)
  countPendientes: number
  cobradoEsteMes: number        // sum total where estado=cobrada AND fecha_cobro >= start of current month (Lima)
  countCobradoMes: number
  mesNombre: string             // e.g. "mayo"
  totalIgv: number              // sum igv where aplica_igv=true
  totalDetraccion: number       // sum monto_detraccion
  totalVencido: number          // sum total where estado='vencida' OR (estado='emitida' AND fecha_vencimiento < today)
  countVencidas: number
  proximasVencer: { count: number; monto: number }  // emitidas with venc in next 7 days
  diasPromedioCobro: number | null  // avg days cobro-emision for cobradas in last 90 days
}

function computeKpis(facturas: FacturaGlobal[]): FacturaKpis {
  const today = limaToday()
  // YYYY-MM-DD string in Lima
  const todayStr = today.toISOString().slice(0, 10)
  const in7DaysStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)

  const startOfMonth = startOfMonthLima()
  // UTC ISO string for comparison with fecha_cobro (stored as DATE, compared as string)
  const startOfMonthStr = startOfMonth.toISOString().slice(0, 10)

  const mesNombre = today.toLocaleDateString('es-PE', {
    month: 'long',
    timeZone: 'America/Lima',
  })

  let totalFacturado = 0
  let porCobrar = 0
  let countPendientes = 0
  let cobradoEsteMes = 0
  let countCobradoMes = 0
  let totalIgv = 0
  let totalDetraccion = 0
  let totalVencido = 0
  let countVencidas = 0
  let proximasVencerCount = 0
  let proximasVencerMonto = 0
  const diasCobroSamples: number[] = []
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)

  for (const f of facturas) {
    totalFacturado += f.subtotal

    if (f.aplica_igv) totalIgv += f.igv
    totalDetraccion += f.monto_detraccion

    if (f.estado === 'emitida' || f.estado === 'borrador') {
      porCobrar += f.total
      countPendientes++
    }

    if (f.estado === 'cobrada' && f.fecha_cobro && f.fecha_cobro >= startOfMonthStr) {
      cobradoEsteMes += f.total
      countCobradoMes++
    }

    const esVencida =
      f.estado === 'vencida' ||
      (f.estado === 'emitida' && f.fecha_vencimiento !== null && f.fecha_vencimiento < todayStr)

    if (esVencida) {
      totalVencido += f.total
      countVencidas++
    }

    // Próximas a vencer: emitida, no vencida, con vencimiento en los próximos 7 días
    if (
      f.estado === 'emitida' &&
      f.fecha_vencimiento !== null &&
      f.fecha_vencimiento >= todayStr &&
      f.fecha_vencimiento <= in7DaysStr
    ) {
      proximasVencerCount++
      proximasVencerMonto += f.total
    }

    // Días promedio cobro (cobradas en últimos 90 días, con ambas fechas)
    if (
      f.estado === 'cobrada' &&
      f.fecha_cobro &&
      f.fecha_emision &&
      f.fecha_cobro >= ninetyDaysAgo
    ) {
      const emision = new Date(f.fecha_emision).getTime()
      const cobro = new Date(f.fecha_cobro).getTime()
      const days = Math.round((cobro - emision) / (1000 * 60 * 60 * 24))
      if (days >= 0) diasCobroSamples.push(days)
    }
  }

  const diasPromedioCobro =
    diasCobroSamples.length > 0
      ? Math.round(diasCobroSamples.reduce((a, b) => a + b, 0) / diasCobroSamples.length)
      : null

  return {
    totalFacturado,
    countTotal: facturas.length,
    porCobrar,
    countPendientes,
    cobradoEsteMes,
    countCobradoMes,
    mesNombre,
    totalIgv,
    totalDetraccion,
    totalVencido,
    countVencidas,
    proximasVencer: { count: proximasVencerCount, monto: proximasVencerMonto },
    diasPromedioCobro,
  }
}

export default async function FacturasPage() {
  const supabase = createClient()

  const [facturasRes, proyectosRes, clientesRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('facturas_proyecto' as never) as any)
      .select(`
        id, proyecto_id, org_id, numero_factura, subtotal, aplica_igv, igv,
        aplica_detraccion, pct_detraccion, monto_detraccion, total, cliente_abona,
        estado, fecha_emision, fecha_vencimiento, fecha_cobro, notas, archivos, created_at,
        proyecto:proyectos(id, nombre, aplica_detraccion, cliente:clientes(id, nombre))
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('proyectos')
      .select('id, nombre, cliente_id, aplica_detraccion, cliente:clientes(id, nombre)')
      .order('nombre', { ascending: true }),

    supabase
      .from('clientes')
      .select('id, nombre')
      .order('nombre', { ascending: true }),
  ])

  const facturas = (facturasRes.data ?? []) as FacturaGlobal[]
  const proyectos = (proyectosRes.data ?? []) as ProyectoBasico[]
  const clientes = (clientesRes.data ?? []) as ClienteBasico[]

  const kpis = computeKpis(facturas)

  return (
    <FacturasClient
      initialFacturas={facturas}
      proyectos={proyectos}
      clientes={clientes}
      kpis={kpis}
    />
  )
}
