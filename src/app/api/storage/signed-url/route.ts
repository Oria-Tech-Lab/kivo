import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const path   = searchParams.get('path')
  const bucket = searchParams.get('bucket') ?? 'comprobantes'

  if (!path) return apiError('Falta parámetro path', 400)

  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600) // 1 hora

  if (error || !data?.signedUrl) return apiError('No se pudo generar URL firmada', 500)
  return NextResponse.json({ url: data.signedUrl })
}
