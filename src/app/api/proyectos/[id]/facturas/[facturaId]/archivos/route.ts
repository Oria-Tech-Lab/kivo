import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateFileSize, validateMagicBytes } from '@/lib/validations/upload'
import { randomUUID } from 'crypto'

type Params = { params: { id: string; facturaId: string } }

interface ArchivoEntry {
  path: string
  name: string
  size: number
  uploaded_at: string
}

const SELECT = `
  id, proyecto_id, org_id, numero_factura, subtotal, aplica_igv, igv,
  aplica_detraccion, pct_detraccion, monto_detraccion, total, cliente_abona,
  estado, fecha_emision, fecha_vencimiento, fecha_cobro, notas, archivos, created_at
`

/**
 * POST /api/proyectos/[id]/facturas/[facturaId]/archivos
 * Sube un archivo adjunto y lo agrega al arreglo archivos[] de la factura.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase.from('facturas_proyecto' as never) as any)
    .select('id, archivos')
    .eq('id', params.facturaId)
    .eq('proyecto_id', params.id)
    .eq('org_id', auth.orgId)
    .single()
  if (!factura) return apiError('Factura no encontrada', 404)

  let formData: FormData
  try { formData = await req.formData() }
  catch { return apiError('No se pudo leer el archivo', 400) }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) return apiError('No se encontró el archivo', 400)

  const originalName = (file as File).name ?? 'archivo'
  const mimeType = file.type

  try { validateFileSize(file.size) } catch (e) { return apiError((e as Error).message, 400) }

  const buf = new Uint8Array(await file.arrayBuffer())
  try { validateMagicBytes(buf, mimeType) } catch (e) { return apiError((e as Error).message, 400) }

  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg'
  const storagePath = `facturas/${auth.orgId}/${params.id}/${params.facturaId}/${randomUUID()}.${ext}`

  const admin = createServiceClient()
  const { error: uploadErr } = await admin.storage
    .from('comprobantes')
    .upload(storagePath, buf, { contentType: mimeType, upsert: false })
  if (uploadErr) return apiError('Error subiendo archivo', 500, uploadErr)

  const existing = ((factura as { archivos: ArchivoEntry[] }).archivos) ?? []
  const newEntry: ArchivoEntry = {
    path:        storagePath,
    name:        originalName.slice(0, 200),
    size:        file.size,
    uploaded_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateErr } = await (supabase.from('facturas_proyecto' as never) as any)
    .update({ archivos: [...existing, newEntry] })
    .eq('id', params.facturaId)
    .eq('org_id', auth.orgId)
    .select(SELECT)
    .single()

  if (updateErr) return apiError('Error actualizando archivos', 500, updateErr)
  return NextResponse.json(updated, { status: 201 })
}

/**
 * DELETE /api/proyectos/[id]/facturas/[facturaId]/archivos
 * Elimina un archivo adjunto (body: { path }).
 */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const { path } = await req.json() as { path: string }
  if (!path) return apiError('Falta path del archivo', 400)

  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase.from('facturas_proyecto' as never) as any)
    .select('id, archivos')
    .eq('id', params.facturaId)
    .eq('proyecto_id', params.id)
    .eq('org_id', auth.orgId)
    .single()
  if (!factura) return apiError('Factura no encontrada', 404)

  const existing = ((factura as { archivos: ArchivoEntry[] }).archivos) ?? []
  const filtered = existing.filter(a => a.path !== path)

  const admin = createServiceClient()
  await admin.storage.from('comprobantes').remove([path])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('facturas_proyecto' as never) as any)
    .update({ archivos: filtered })
    .eq('id', params.facturaId)
    .eq('org_id', auth.orgId)

  return NextResponse.json({ success: true })
}
