import { z } from 'zod'

export const clienteSchema = z.object({
  nombre: z.string().min(2, 'El nombre del cliente es requerido').max(200),
  ruc: z
    .string()
    .length(11, 'El RUC debe tener exactamente 11 dígitos')
    .regex(/^\d{11}$/, 'El RUC solo debe contener dígitos')
    .optional()
    .or(z.literal('')),
  contacto_nombre: z.string().max(200).optional().or(z.literal('')),
  contacto_email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  contacto_telefono: z.string().max(50).optional().or(z.literal('')),
  estado: z.enum(['activo', 'inactivo']),
})

export type ClienteInput = z.infer<typeof clienteSchema>
