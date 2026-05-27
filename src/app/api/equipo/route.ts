import { NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = createClient()
  const { data: orgUsers, error } = await supabase
    .from('organization_users')
    .select('user_id, rol')
    .eq('org_id', auth.orgId)

  if (error || !orgUsers) return apiError('Error obteniendo equipo', 500, error)

  const service = createServiceClient()
  const { data: { users }, error: adminErr } = await service.auth.admin.listUsers({ perPage: 200 })
  if (adminErr) return apiError('Error obteniendo usuarios', 500, adminErr)

  const orgUserIds = new Set(orgUsers.map(u => u.user_id))
  const members = users
    .filter(u => orgUserIds.has(u.id))
    .map(u => ({
      user_id: u.id,
      email:   u.email ?? '',
      nombre:  (u.user_metadata?.full_name as string | undefined) ?? u.email ?? u.id,
      rol:     orgUsers.find(o => o.user_id === u.id)?.rol ?? 'viewer',
    }))

  return NextResponse.json(members)
}
