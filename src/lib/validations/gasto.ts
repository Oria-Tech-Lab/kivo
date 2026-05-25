import { z } from 'zod'

export const gastoSchema = z.object({
  proyecto_id: z.string().uuid('Selecciona un proyecto'),
  proveedor_id: z.string().uuid('Selecciona un proveedor'),
  linea_presupuesto_id: z.string().uuid().optional().or(z.literal('')),
  concepto: z.string().min(2, 'El concepto es requerido').max(300),
  tipo_comprobante: z.enum(['factura', 'boleta', 'rxh', 'sin_comprobante']),
  serie: z.string().max(10).optional().or(z.literal('')),
  numero_doc: z.string().max(20).optional().or(z.literal('')),
  subtotal: z
    .number()
    .int('El monto debe ser entero en centavos')
    .min(1, 'El monto debe ser mayor a 0'),
  aplica_detraccion: z.boolean(),
  pct_detraccion: z.number().int().min(0).max(100),
  fecha_comprobante: z.string().min(1, 'La fecha del comprobante es requerida'),
  fecha_vencimiento_pago: z.string().optional().or(z.literal('')),
  estado_pago: z.enum(['pendiente', 'pagado']),
  notas: z.string().max(2000).optional().or(z.literal('')),
}).refine(
  (data) => !data.aplica_detraccion || data.pct_detraccion > 0,
  {
    message: 'Ingresa el porcentaje de detracción',
    path: ['pct_detraccion'],
  }
)

export type GastoInput = z.infer<typeof gastoSchema>
