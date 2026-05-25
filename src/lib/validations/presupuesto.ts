import { z } from 'zod'

export const lineaPresupuestoSchema = z.object({
  concepto: z.string().min(1, 'El concepto es requerido').max(300),
  subtotal: z
    .number()
    .int('El monto debe ser un número entero en centavos')
    .min(1, 'El subtotal debe ser mayor a 0'),
  igv: z.number().int().min(0),
  total: z.number().int().min(0),
  pct_fee: z.number().min(0).max(100).nullable().optional(),
})

export const presupuestoSchema = z.object({
  proyecto_id: z.string().uuid('Selecciona un proyecto'),
  condicion_pago: z.enum(['contado', '30d', '45d', 'hitos']),
  lineas: z
    .array(lineaPresupuestoSchema)
    .min(1, 'Agrega al menos una línea de presupuesto'),
})

export type LineaPresupuestoInput = z.infer<typeof lineaPresupuestoSchema>
export type PresupuestoInput = z.infer<typeof presupuestoSchema>
