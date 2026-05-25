import { z } from 'zod'

export const proyectoSchema = z.object({
  cliente_id: z.string().uuid('Selecciona un cliente'),
  nombre: z.string().min(2, 'El nombre del proyecto es requerido').max(200),
  tipo: z.enum(['digital', 'offline', 'evento', 'instalacion', 'otro']),
  categoria_id: z.string().uuid().optional().or(z.literal('')),
  estado: z.enum(['activo', 'en_pausa', 'cerrado']),
  responsable_id: z.string().uuid().optional().or(z.literal('')),
  fecha_inicio: z.string().min(1, 'La fecha de inicio es requerida'),
  fecha_cierre_est: z.string().optional().or(z.literal('')),
  aplica_detraccion: z.boolean(),
  notas: z.string().max(2000).optional().or(z.literal('')),
})

export type ProyectoInput = z.infer<typeof proyectoSchema>
