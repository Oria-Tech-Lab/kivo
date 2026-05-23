import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AcceptInviteForm } from '@/components/forms/accept-invite-form'

export const metadata: Metadata = {
  title: 'Activar cuenta — Kivo',
}

/**
 * Página de aceptación de invitación.
 *
 * El usuario llega aquí después de hacer click en el email de invitación.
 * Supabase ya validó el token y estableció una sesión vía /auth/callback.
 * Esta página muestra el formulario para establecer la contraseña.
 */
export default async function InvitePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si no hay sesión, el enlace expiró o ya fue usado
  if (!user) {
    redirect('/login?error=invite_expired')
  }

  // Si ya tiene org asignada y contraseña, redirigir al dashboard
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('rol')
    .eq('user_id', user.id)
    .single()

  const hasOrg = !!orgUser

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Kivo</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Gestión financiera para agencias creativas
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-900">
              Activar tu cuenta
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {hasOrg
                ? 'Establece una contraseña para acceder a Kivo.'
                : 'Completa la configuración de tu cuenta.'}
            </p>
          </div>

          <AcceptInviteForm email={user.email ?? ''} />
        </div>
      </div>
    </div>
  )
}
