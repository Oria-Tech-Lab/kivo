import { NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, apiError } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/emails'
import { inviteUserSchema } from '@/lib/validations/auth'
import { authRateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/auth/invite
 * Invita a un usuario nuevo a la organización.
 *
 * Requiere rol admin.
 * Body: { email: string, rol: 'admin' | 'pm' | 'viewer' }
 *
 * Flujo:
 * 1. Genera el link de invitación vía Supabase Admin
 * 2. Inserta en organization_users con el user_id retornado
 * 3. Envía el email con Resend usando el link generado
 */
export async function POST(request: Request) {
  // Rate limiting por IP
  const ip = getClientIp(request)
  const rl = await authRateLimit(ip)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
      { status: 429 }
    )
  }

  // Solo admins pueden invitar
  const auth = await requireAuth('admin')
  if (auth instanceof NextResponse) return auth

  // Validar body
  const body = await parseJsonBody<unknown>(request)
  if (body instanceof NextResponse) return body

  const parsed = inviteUserSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? 'Datos inválidos',
      400
    )
  }

  const { email, rol } = parsed.data

  // Obtener datos de la org y del invitante
  const supabase = createClient()
  const { data: orgData } = await supabase
    .from('organizations')
    .select('nombre')
    .eq('id', auth.orgId)
    .single()

  const { data: { user: inviterUser } } = await supabase.auth.getUser()

  const orgName = (orgData as { nombre: string } | null)?.nombre ?? 'tu organización'
  const inviterName = inviterUser?.email ?? 'Un administrador'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Generar invite link con Supabase Admin (service role)
  const supabaseAdmin = createServiceClient()
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/invite`,
    },
  })

  if (linkError || !linkData) {
    return apiError('Error generando invitación', 500, linkError)
  }

  const inviteUrl = linkData.properties.action_link
  const invitedUserId = linkData.user.id

  // Insertar en organization_users (o actualizar rol si ya existe)
  const { error: orgUserError } = await supabaseAdmin
    .from('organization_users')
    .upsert(
      { org_id: auth.orgId, user_id: invitedUserId, rol },
      { onConflict: 'org_id,user_id' }
    )

  if (orgUserError) {
    return apiError('Error asignando usuario a la organización', 500, orgUserError)
  }

  // Enviar email con Resend
  try {
    await sendInviteEmail({
      to: email,
      inviterName,
      orgName,
      rol,
      inviteUrl,
    })
  } catch (emailError) {
    // Si el email falla, el usuario ya fue creado. Loguear y continuar.
    console.error('[invite] Error enviando email:', emailError)
    return apiError('Usuario creado pero el email de invitación falló', 500, emailError)
  }

  return NextResponse.json(
    { message: `Invitación enviada a ${email}` },
    { status: 201 }
  )
}
