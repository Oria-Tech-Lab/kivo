// Shared types and constants for the inicio dashboard.
// Imported by both page.tsx (server) and inicio-client.tsx (client).

export interface AlertaItem {
  id: string; tipo: string
  nivel: 'critico' | 'advertencia' | 'informativo'
  mensaje: string; fecha_generada: string
}
export interface ClienteOpt { id: string; nombre: string }
export interface ProveedorOpt { id: string; razon_social: string; nombre_comercial: string | null }
export interface ProyectoOpt {
  id: string; nombre: string; tipo: string; estado: string
  cliente: { id: string; nombre: string } | null
}

export interface RawMovR { tipo: string; monto: number; fecha_real: string | null }
export interface RawMovP { tipo: string; monto: number; fecha_esperada: string | null }
export interface RawProyecto {
  id: string; nombre: string; tipo: string; estado: string; fase: string | null
  fecha_inicio: string | null
  cliente: { id: string; nombre: string } | null
}
export interface RawItem { proyecto_id: string; precio_venta: number; gasto_real: number }
export interface RawGasto {
  neto_a_pagar: number | null; fecha_comprobante: string | null; estado_pago: string | null
}
export interface RawFacturaProyecto { proyecto_id: string; subtotal: number; estado: string }

export interface ChartDataPoint { mes: string; ingresos: number; gastos: number }
export interface KpiData {
  porCobrar: number; porCobrarCount: number
  porPagar: number;  porPagarCount: number
  flujoNeto: number
  flujoProyectado: number; metaMensualPct: number
  reduccionGastosPct: number | null
  varPorCobrarPct: number | null
}
export interface ProyectoRentabilidad {
  id: string; nombre: string; tipo: string; estado: string
  cliente: { id: string; nombre: string } | null
  ingresos: number; gasto_real: number; margen_pct: number
}
export interface DistribucionItem {
  tipo: string; label: string; monto: number; pct: number; color: string
}
export interface SaludData { score: number; subtitle: string }

export interface FacturaPendiente {
  id: string
  subtotal: number
  estado: string
  fecha_vencimiento: string | null
  numero_factura: string | null
  proyecto: { id: string; nombre: string; cliente: { nombre: string } | null } | null
}

export interface GastoPendiente {
  id: string
  concepto: string
  neto_a_pagar: number
  tipo_comprobante: string
  proyecto: { id: string; nombre: string } | null
  proveedor: { razon_social: string; nombre_comercial: string | null } | null
}

export const TIPO_CFG: Record<string, { label: string; color: string }> = {
  digital:     { label: 'Digital',      color: '#1e40af' },
  instalacion: { label: 'Instalación',  color: '#f97316' },
  evento:      { label: 'Evento',       color: '#8b5cf6' },
  offline:     { label: 'Offline',      color: '#6b7280' },
  otro:        { label: 'Otro',         color: '#14b8a6' },
}
