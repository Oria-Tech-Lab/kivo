/**
 * Cálculos tributarios peruanos — Kivo
 *
 * REGLAS:
 * - Todos los montos son INTEGER (centavos) para evitar errores de punto flotante
 * - IGV = 18% exacto
 * - Retención 4ta = 8% del monto bruto RxH
 * - Detracción = % según actividad × monto total con IGV
 *
 * Estas mismas fórmulas se replican en las Edge Functions de Supabase
 * para garantizar consistencia entre frontend y backend.
 */

export type TipoComprobante = "factura" | "boleta" | "rxh" | "sin_comprobante";

export interface CalculoGasto {
  subtotal: number;           // en centavos, sin IGV
  igvCredito: number;         // en centavos (solo si es factura)
  total: number;              // en centavos, con IGV si aplica
  montoDetraccion: number;    // en centavos (0 si no aplica)
  retencion4ta: number;       // en centavos (0 si no es RxH)
  netoAPagar: number;         // en centavos (total - detracción)
}

export interface ParametrosGasto {
  subtotal: number;           // en centavos, ingresado por el usuario
  tipoComprobante: TipoComprobante;
  aplicaDetraccion: boolean;
  pctDetraccion: number;      // porcentaje entero, ej: 10 para 10%
}

const IGV_PCT = 18; // 18%
const RETENCION_4TA_PCT = 8; // 8%

/**
 * Calcula todos los campos tributarios de un gasto
 */
export function calcularGasto(params: ParametrosGasto): CalculoGasto {
  const { subtotal, tipoComprobante, aplicaDetraccion, pctDetraccion } = params;

  // IGV: solo si es factura (crédito fiscal recuperable)
  const igvCredito =
    tipoComprobante === "factura"
      ? Math.round((subtotal * IGV_PCT) / 100)
      : 0;

  // Total con IGV: factura = subtotal + IGV; boleta y RxH = subtotal (ya incluye IGV conceptualmente)
  // Para boletas el subtotal ingresado ya es el monto total
  // Para RxH el monto bruto es el subtotal
  const total =
    tipoComprobante === "factura" ? subtotal + igvCredito : subtotal;

  // Detracción: se calcula sobre el total con IGV
  const montoDetraccion =
    aplicaDetraccion && pctDetraccion > 0
      ? Math.round((total * pctDetraccion) / 100)
      : 0;

  // Retención 4ta categoría: 8% del monto bruto RxH
  const retencion4ta =
    tipoComprobante === "rxh"
      ? Math.round((subtotal * RETENCION_4TA_PCT) / 100)
      : 0;

  // Neto a pagar al proveedor:
  // - Si hay detracción: total - detracción (el comprador deposita la detracción en el Banco de la Nación)
  // - Si es RxH: subtotal - retención (la empresa retiene el 8%)
  // - Otros: total completo
  let netoAPagar: number;
  if (tipoComprobante === "rxh") {
    netoAPagar = subtotal - retencion4ta;
  } else if (aplicaDetraccion) {
    netoAPagar = total - montoDetraccion;
  } else {
    netoAPagar = total;
  }

  return {
    subtotal,
    igvCredito,
    total,
    montoDetraccion,
    retencion4ta,
    netoAPagar,
  };
}

/**
 * Calcula la posición IGV de un proyecto
 * Positiva = hay que pagar a SUNAT; Negativa = crédito fiscal acumulado
 */
export function calcularPosicionIGV(params: {
  igvDebito: number;   // IGV cobrado al cliente (factura emitida)
  igvCredito: number;  // IGV en facturas de proveedores
}): number {
  return params.igvDebito - params.igvCredito;
}

/**
 * Calcula IGV débito de una factura emitida al cliente
 */
export function calcularIGVDebito(subtotalSinIGV: number): number {
  return Math.round((subtotalSinIGV * IGV_PCT) / 100);
}

/**
 * Calcula margen bruto del proyecto
 */
export function calcularMargenBruto(params: {
  cobradoSinIGV: number;    // en centavos
  costoRealSinIGV: number;  // en centavos
}): { monto: number; porcentaje: number } {
  const { cobradoSinIGV, costoRealSinIGV } = params;
  const monto = cobradoSinIGV - costoRealSinIGV;
  const porcentaje =
    cobradoSinIGV > 0 ? (monto / cobradoSinIGV) * 100 : 0;
  return { monto, porcentaje };
}

/**
 * Calcula margen neto del proyecto (incluye gastos generales asignados)
 */
export function calcularMargenNeto(params: {
  cobradoSinIGV: number;        // en centavos
  costoRealSinIGV: number;      // en centavos
  gastosGeneralesAsignados: number; // en centavos
}): { monto: number; porcentaje: number } {
  const { cobradoSinIGV, costoRealSinIGV, gastosGeneralesAsignados } = params;
  const monto = cobradoSinIGV - costoRealSinIGV - gastosGeneralesAsignados;
  const porcentaje =
    cobradoSinIGV > 0 ? (monto / cobradoSinIGV) * 100 : 0;
  return { monto, porcentaje };
}

/**
 * Calcula varianza presupuesto vs gasto real
 */
export function calcularVarianza(params: {
  presupuestado: number; // en centavos
  gastadoReal: number;   // en centavos
}): { varianza: number; pctEjecucion: number; enRiesgo: boolean; critico: boolean } {
  const { presupuestado, gastadoReal } = params;
  const varianza = presupuestado - gastadoReal;
  const pctEjecucion =
    presupuestado > 0 ? (gastadoReal / presupuestado) * 100 : 0;

  return {
    varianza,
    pctEjecucion,
    enRiesgo: pctEjecucion >= 85,  // Advertencia: ≥85%
    critico: pctEjecucion >= 95,   // Crítico: ≥95%
  };
}

/**
 * Porcentajes de detracción según actividad (Perú 2024)
 */
export const TASAS_DETRACCION: Record<string, number> = {
  "Publicidad y marketing": 10,
  "Instalación y montaje": 4,
  "Arrendamiento de bienes muebles": 12,
  "Otros servicios de 3ra categoría": 12,
  "Contratos de construcción": 4,
};
