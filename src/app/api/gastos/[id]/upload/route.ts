import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateFileSize, validateMagicBytes, generateStoragePath } from '@/lib/validations/upload'

type Params = { params: { id: string } }

/**
 * POST /api/gastos/[id]/upload
 * Sube el comprobante de un gasto a Supabase Storage (bucket privado).
 *
 * Validaciones de seguridad:
 * - Tamaño máximo: 10 MB
 * - Tipos permitidos: JPEG, PNG, PDF
 * - Validación por magic bytes (no solo extensión ni Content-Type)
 * - Nombre de archivo generado internamente (UUID-based), nunca del cliente
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // Verificar que el gasto existe y pertenece a la org
  const { data: gasto } = await supabase
    .from('gastos')
    .select('id, proyecto_id, proyectos!inner(org_id)')
    .eq('id', params.id)
    .eq('proyectos.org_id', auth.orgId)
    .single()

  if (!gasto) {
    return apiError('Gasto no encontrado', 404)
  }

  const gastoData = gasto as { id: string; proyecto_id: string }

  // Parsear el multipart form
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return apiError('No se pudo leer el archivo', 400)
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return apiError('No se encontró el archivo en el request', 400)
  }

  const mimeType = file.type

  // Validar tamaño
  try {
    validateFileSize(file.size)
  } catch (e) {
    return apiError((e as Error).message, 400)
  }

  // Validar magic bytes
  const arrayBuffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)

  try {
    validateMagicBytes(uint8, mimeType)
  } catch (e) {
    return apiError((e as Error).message, 400)
  }

  // Generar path seguro: {orgId}/{proyectoId}/{gastoId}/{timestamp}.{ext}
  const storagePath = generateStoragePath(
    auth.orgId,
    gastoData.proyecto_id,
    gastoData.id,
    mimeType
  )

  // Subir a Supabase Storage (bucket privado)
  const supabaseAdmin = createServiceClient()
  const { error: uploadError } = await supabaseAdmin.storage
    .from('comprobantes')
    .upload(storagePath, uint8, {
      contentType: mimeType,
      upsert: true, // reemplazar si ya existe
    })

  if (uploadError) {
    return apiError('Error subiendo archivo', 500, uploadError)
  }

  // Generar URL firmada con 1 año de expiración
  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from('comprobantes')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 año

  if (signError || !signedData) {
    return apiError('Error generando URL del archivo', 500, signError)
  }

  // Actualizar el gasto con la URL firmada
  const { error: updateError } = await supabase
    .from('gastos')
    .update({ adjunto_url: signedData.signedUrl })
    .eq('id', params.id)

  if (updateError) {
    return apiError('Error actualizando URL del comprobante', 500, updateError)
  }

  return NextResponse.json({
    url: signedData.signedUrl,
    path: storagePath,
  })
}
