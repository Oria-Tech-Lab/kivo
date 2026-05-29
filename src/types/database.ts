/**
 * Tipos de base de datos — Kivo
 *
 * Estos tipos reflejan el schema SQL de Supabase.
 * Se generarán automáticamente con `supabase gen types typescript` en CI,
 * pero aquí los definimos manualmente para la fase inicial.
 *
 * Convención: todos los montos son INTEGER (centavos), nunca FLOAT.
 * UUIDs como PKs en todas las tablas.
 */

// ─── Roles ───────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "pm" | "viewer";

// ─── Organizaciones ───────────────────────────────────────────────────────────
export interface Organization {
  id: string;
  nombre: string;
  ruc: string;
  plan: "free" | "pro" | "enterprise";
  created_at: string;
}

export interface OrganizationUser {
  org_id: string;
  user_id: string;
  rol: UserRole;
}

// ─── M1: Clientes & Proyectos ─────────────────────────────────────────────────
export interface Cliente {
  id: string;
  org_id: string;
  nombre: string;
  ruc: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  estado: "activo" | "inactivo";
  created_at: string;
  updated_at: string;
}

export type TipoProyecto = "digital" | "offline" | "evento" | "instalacion" | "otro";
export type EstadoProyecto = "activo" | "en_pausa" | "cerrado";
export type FaseProyecto = "cotizacion" | "ejecucion" | "finalizado";
export type DescuentoTipo = "pct" | "fijo";

export interface Proyecto {
  id: string;
  org_id: string;
  cliente_id: string;
  nombre: string;
  tipo: TipoProyecto;
  categoria_id: string | null;
  estado: EstadoProyecto;
  responsable_id: string | null;
  fecha_inicio: string;
  fecha_cierre_est: string | null;
  aplica_detraccion: boolean;
  notas: string | null;
  // Migración 008
  fase: FaseProyecto;
  subtotal_manual: boolean;
  descuento_tipo: DescuentoTipo;
  descuento_valor: number;          // centavos si fijo, entero 0-100 si pct
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  org_id: string;
  nombre: string;
  tipo: TipoProyecto | null;
  color: string | null;
}

// ─── M2: Presupuestos ─────────────────────────────────────────────────────────
export type EstadoPresupuesto = "borrador" | "aprobado" | "rechazado";
export type CondicionPago = "contado" | "30d" | "45d" | "hitos";

export interface Presupuesto {
  id: string;
  proyecto_id: string;
  version: number;
  estado: EstadoPresupuesto;
  condicion_pago: CondicionPago;
  fecha_aprobacion: string | null;
  subtotal: number;       // centavos, sin IGV
  igv_total: number;      // centavos, 18%
  total: number;          // centavos, con IGV
  created_at: string;
  updated_at: string;
}

export interface LineaPresupuesto {
  id: string;
  presupuesto_id: string;
  concepto: string;
  subtotal: number;       // centavos, sin IGV
  igv: number;            // centavos, 18%
  total: number;          // centavos, con IGV
  pct_fee: number | null; // porcentaje de fee/margen esperado
}

// ─── M5: Proveedores ──────────────────────────────────────────────────────────
export type TipoProveedor = "persona_natural" | "persona_juridica";

export interface Proveedor {
  id: string;
  org_id: string;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  tipo: TipoProveedor;
  actividad: string | null;
  aplica_detraccion: boolean;
  pct_detraccion: number;     // porcentaje entero, ej: 10
  condicion_pago: string | null;
  cuenta_banco_enc: string | null;  // cifrado en BD
  cuenta_spot_enc: string | null;   // cifrado en BD
  email: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// ─── M3: Gastos de Proyecto ───────────────────────────────────────────────────
export type TipoComprobante = "factura" | "boleta" | "rxh" | "sin_comprobante";
export type EstadoPago = "pendiente" | "pagado";
export type EstadoDetraccion = "pendiente" | "depositada" | "no_aplica";

export interface Gasto {
  id: string;
  proyecto_id: string;
  linea_presupuesto_id: string | null;
  proveedor_id: string;
  concepto: string;
  tipo_comprobante: TipoComprobante;
  serie: string | null;
  numero_doc: string | null;
  subtotal: number;              // centavos, sin IGV (o monto bruto RxH)
  igv: number;                   // centavos (0 si no es factura)
  total: number;                 // centavos
  aplica_detraccion: boolean;
  pct_detraccion: number;
  monto_detraccion: number;      // centavos
  neto_a_pagar: number;          // centavos
  retencion_4ta: number;         // centavos (0 si no es RxH)
  adjunto_url: string | null;    // URL firmada de Supabase Storage
  fecha_comprobante: string;
  fecha_vencimiento_pago: string | null;
  estado_pago: EstadoPago;
  fecha_pago_real: string | null;
  estado_detraccion: EstadoDetraccion;
  fecha_deposito_detraccion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// ─── M4: Gastos Generales ─────────────────────────────────────────────────────
export type TipoRecurrencia = "mensual" | "puntual";
export type EstadoGastoGeneral =
  | "pendiente_asignacion"
  | "cubierto_parcial"
  | "cubierto"
  | "generando_ganancia";

export interface GastoGeneral {
  id: string;
  org_id: string;
  proveedor_id: string | null;
  concepto: string;
  tipo_recurrencia: TipoRecurrencia;
  monto: number;           // centavos
  periodo_mes: number | null;
  periodo_anio: number | null;
  tipo_comprobante: TipoComprobante | null;
  igv: number;             // centavos
  total: number;           // centavos
  adjunto_url: string | null;
  umbral_proyectos: number;
  estado: EstadoGastoGeneral;
  created_at: string;
  updated_at: string;
}

export interface AsignacionGG {
  id: string;
  gasto_general_id: string;
  proyecto_id: string;
  monto: number;   // centavos
  pct: number | null;
  fecha: string;
}

// ─── M6: Flujo de Caja ───────────────────────────────────────────────────────
export type TipoMovimiento = "ingreso" | "egreso" | "detraccion" | "retencion";
export type EstadoMovimiento = "pendiente" | "realizado" | "vencido";

export interface MovimientoCaja {
  id: string;
  org_id: string;
  tipo: TipoMovimiento;
  origen_tabla: string;
  origen_id: string;
  proyecto_id: string | null;
  cliente_id: string | null;
  proveedor_id: string | null;
  concepto: string;
  monto: number;           // centavos
  fecha_esperada: string;
  fecha_real: string | null;
  estado: EstadoMovimiento;
  created_at: string;
}

// ─── Alertas ──────────────────────────────────────────────────────────────────
export type TipoAlerta =
  | "factura_proveedor_pendiente"
  | "detraccion_vencida"
  | "detraccion_proxima"
  | "factura_cobro_vencida"
  | "proyecto_sin_margen"
  | "pago_proximo_proveedor"
  | "proyecto_margen_riesgo"
  | "semana_caja_negativa"
  | "gasto_general_cubierto";

export type NivelAlerta = "critico" | "advertencia" | "informativo";

export interface Alerta {
  id: string;
  org_id: string;
  tipo: TipoAlerta;
  nivel: NivelAlerta;
  referencia_tabla: string | null;
  referencia_id: string | null;
  mensaje: string;
  fecha_generada: string;
  fecha_visto: string | null;
  resuelto: boolean;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string;
  tabla: string;
  registro_id: string;
  accion: "UPDATE" | "DELETE";
  datos_antes: Record<string, unknown> | null;
  datos_des: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ─── Tipos de UI ──────────────────────────────────────────────────────────────

/** Proyecto con datos de cliente para display */
export interface ProyectoConCliente extends Proyecto {
  cliente: Pick<Cliente, "id" | "nombre" | "ruc">;
}

/** Gasto con datos de proveedor para display */
export interface GastoConProveedor extends Gasto {
  proveedor: Pick<Proveedor, "id" | "razon_social" | "nombre_comercial">;
}

/** Resumen financiero de un proyecto */
export interface ResumenProyecto {
  proyecto_id: string;
  presupuestado: number;         // centavos
  gastado_real: number;          // centavos
  varianza: number;              // centavos
  pct_ejecucion: number;         // 0-100
  igv_debito: number;            // centavos
  igv_credito: number;           // centavos
  posicion_igv: number;          // centavos (positivo = pagar, negativo = crédito)
  margen_bruto_monto: number;    // centavos
  margen_bruto_pct: number;      // 0-100
  detracciones_pendientes: number; // centavos
}
