import { z } from 'zod'

export const CONDICIONES_PAGO = [
  { value: 'contado', label: 'Contado' },
  { value: '15d',     label: '15 días' },
  { value: '30d',     label: '30 días' },
  { value: '45d',     label: '45 días' },
  { value: '60d',     label: '60 días' },
  { value: '90d',     label: '90 días' },
] as const

export const TIPOS_DOCUMENTO = [
  { value: 'dni',       label: 'DNI' },
  { value: 'ce',        label: 'Carnet de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'ruc',       label: 'RUC' },
] as const

export const proveedorSchema = z.object({
  // Tipo va primero — condiciona los campos de documento
  tipo: z.enum(['persona_natural', 'persona_juridica']),

  // Persona jurídica: RUC obligatorio (11 dígitos)
  // Persona natural: sin RUC (usa tipo_documento + numero_documento)
  ruc: z.string().max(11).optional().or(z.literal('')),

  // Solo persona natural
  tipo_documento: z.enum(['dni', 'ce', 'pasaporte', 'ruc']).optional(),
  numero_documento: z.string().max(20).optional().or(z.literal('')),

  razon_social: z.string().min(2, 'El nombre / razón social es requerido').max(300),
  nombre_comercial: z.string().max(200).optional().or(z.literal('')),
  actividad: z.string().max(200).optional().or(z.literal('')),

  condicion_pago: z.string().optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notas: z.string().max(2000).optional().or(z.literal('')),
}).refine(
  (data) => {
    if (data.tipo === 'persona_juridica') {
      return !!data.ruc && /^\d{11}$/.test(data.ruc)
    }
    return true
  },
  { message: 'El RUC debe tener 11 dígitos numéricos', path: ['ruc'] }
)

export type ProveedorInput = z.infer<typeof proveedorSchema>
