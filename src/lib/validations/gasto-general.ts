import { z } from 'zod'

export const gastoGeneralSchema = z.object({
  proveedor_id: z.string().uuid().optional().or(z.literal('')),
  concepto: z.string().min(2, 'El concepto es requerido').max(300),
  tipo_recurrencia: z.enum(['mensual', 'puntual']),
  monto: z
    .number()
    .int('El monto debe ser entero en centavos')
    .min(1, 'El monto debe ser mayor a 0'),
  periodo_mes: z.number().int().min(1).max(12).optional(),
  periodo_anio: z.number().int().min(2020).max(2099).optional(),
  tipo_comprobante: z
    .enum(['factura', 'boleta', 'rxh', 'sin_comprobante'])
    .optional(),
  umbral_proyectos: z.number().int().min(1, 'Mínimo 1 proyecto'),
}).refine(
  (data) => {
    // Si es mensual, requiere mes y año
    if (data.tipo_recurrencia === 'mensual') {
      return data.periodo_mes !== undefined && data.periodo_anio !== undefined
    }
    return true
  },
  {
    message: 'Para gastos mensuales indica el mes y el año',
    path: ['periodo_mes'],
  }
)

export type GastoGeneralInput = z.infer<typeof gastoGeneralSchema>
