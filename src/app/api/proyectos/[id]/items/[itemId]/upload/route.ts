import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'

type Params = { params: { id: string; itemId: string } }

type DocTipo = 'foto' | 'factura' | 'constancia'
const FIELD_MAP: Record<DocTipo, string> = {
  foto:        'foto_url',
  factura:     'factura_url',
  constancia:  'constancia_pago_url',
}

const MAGIC: Array<{ sig: number[]; mime: string }> = [
  { sig: [0xFF, 0xD8, 0xFF],          mime: 'image/jpeg'      },
  { sig: [0x89, 0x50, 0x4E, 0x47],   mime: 'image/png'       },
  { sig: [0x47, 0x49, 0x46],          mime: 'image/gif'       },
  { sig: [0x52, 0x49, 0x46, 0x46],   mime: 'image/webp'      },
  { sig: [0x25, 0x50, 0x44, 0x46],   mime: 'application/pdf' },
]

function detectMime(buf: Uint8Array): string | null {
  for (const { sig, mime } of MAGIC) {
    if (sig.every((b, i) => buf[i] === b)) return mime
  }
  return null
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const formData = await req.formData()
  const tipo = formData.get('tipo') as string | null
  const file = formData.get('file') as File | null

  if (!tipo || !['foto', 'factura', 'constancia'].includes(tipo))
    return apiError('Tipo de documento inválido', 400)
  if (!file) return apiError('No se recibió archivo', 400)

  const maxSize = tipo === 'foto' ? 5 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > maxSize)
    return apiError(`Archivo demasiado grande (máx ${maxSize / 1024 / 1024}MB)`, 400)

  const buf  = new Uint8Array(await file.arrayBuffer())
  const mime = detectMime(buf)
  if (!mime) return apiError('Tipo de archivo no permitido (usa imagen o PDF)', 400)
  if (tipo === 'foto' && mime === 'application/pdf')
    return apiError('La foto debe ser una imagen, no un PDF', 400)

  const supabase = createClient()

  // Verify item belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (supabase.from('proyecto_items' as never) as any)
    .select('id')
    .eq('id', params.itemId)
    .eq('org_id', auth.orgId)
    .single()
  if (!item) return apiError('Ítem no encontrado', 404)

  const ext  = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1]
  const path = `${auth.orgId}/${params.id}/items/${params.itemId}/${tipo}_${Date.now()}.${ext}`

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('comprobantes')
    .upload(path, buf, { contentType: mime, upsert: false })

  if (uploadErr) return apiError(uploadErr.message, 500)

  // Signed URL valid for 24 h
  const { data: signed } = await supabase.storage
    .from('comprobantes')
    .createSignedUrl(uploadData.path, 86400)

  // Persist path (not signed URL) so we can refresh later
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('proyecto_items' as never) as any)
    .update({ [FIELD_MAP[tipo as DocTipo]]: uploadData.path })
    .eq('id', params.itemId)

  return NextResponse.json({ path: uploadData.path, url: signed?.signedUrl ?? null }, { status: 201 })
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth('pm')
  if (auth instanceof NextResponse) return auth

  const { tipo, path } = await req.json() as { tipo: string; path: string }
  if (!tipo || !['foto', 'factura', 'constancia'].includes(tipo))
    return apiError('Tipo inválido', 400)

  const supabase = createClient()

  await supabase.storage.from('comprobantes').remove([path])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('proyecto_items' as never) as any)
    .update({ [FIELD_MAP[tipo as DocTipo]]: null })
    .eq('id', params.itemId)
    .eq('org_id', auth.orgId)

  return NextResponse.json({ success: true })
}
