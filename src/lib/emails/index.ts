import { Resend } from 'resend'
import { render } from '@react-email/components'
import { InviteEmail } from './invite'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY no configurada')
}

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@kivo.pe'

/**
 * Envía el email de invitación a un nuevo miembro.
 */
export async function sendInviteEmail(params: {
  to: string
  inviterName: string
  orgName: string
  rol: string
  inviteUrl: string
}): Promise<{ id: string }> {
  const html = await render(
    InviteEmail({
      inviterName: params.inviterName,
      orgName: params.orgName,
      rol: params.rol,
      inviteUrl: params.inviteUrl,
    })
  )

  const { data, error } = await resend.emails.send({
    from: `Kivo <${FROM}>`,
    to: params.to,
    subject: `${params.inviterName} te invita a ${params.orgName} en Kivo`,
    html,
  })

  if (error || !data) {
    throw new Error(`Error enviando email: ${error?.message ?? 'desconocido'}`)
  }

  return { id: data.id }
}
