import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'

/**
 * Layout del dashboard — Kivo
 *
 * Server Component: verifica auth y obtiene datos de org/usuario.
 * Pasa los datos al Sidebar (Client Component).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  // Verificar sesión (round-trip a Supabase Auth)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obtener org y rol — si no tiene org, estado inválido
  const { data: orgUserRaw } = await supabase
    .from('organization_users')
    .select('org_id, rol')
    .eq('user_id', user.id)
    .single()

  const orgUser = orgUserRaw as { org_id: string; rol: string } | null

  if (!orgUser) {
    // Usuario sin organización: puede estar en flujo de invitación
    redirect('/invite')
  }

  const { data: orgRaw } = await supabase
    .from('organizations')
    .select('nombre')
    .eq('id', orgUser.org_id)
    .single()

  const org = orgRaw as { nombre: string } | null

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar
        orgName={org?.nombre ?? 'Mi Organización'}
        userEmail={user.email ?? ''}
        userRole={orgUser.rol}
      />

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
