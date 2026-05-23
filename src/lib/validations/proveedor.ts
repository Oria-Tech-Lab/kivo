import { z } from 'zod'

export const proveedorSchema = z.object({
  ruc: z
    .string()
    .length(11, 'El RUC debe tener exactamente 11 dígitos')
    .regex(/^\d{11}$/, 'El RUC solo debe contener dígitos'),
  razon_social: z.string().min(2, 'Razón social requerida').max(200),
  nombre_comercial: z.string().max(200).optional().or(z.literal('')),
  tipo: z.enum(['persona_natural', 'persona_juridica']),
  actividad: z.string().max(200).optional().or(z.literal('')),
  aplica_detraccion: z.boolean(),
  pct_detraccion: z.number().int().min(0).max(100),
  condicion_pago: z.string().max(100).optional().or(z.literal('')),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  notas: z.string().max(1000).optional().or(z.literal('')),
}).refine(
  (data) => !data.aplica_detraccion || data.pct_detraccion > 0,
  {
    message: 'Ingresa el porcentaje de detracción',
    path: ['pct_detraccion'],
  }
)

export type ProveedorInput = z.infer<typeof proveedorSchema>
