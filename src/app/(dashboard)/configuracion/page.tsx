import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound, redirect } from 'next/navigation'
import { Building2, Users, Crown, Briefcase, Eye, Mail } from 'lucide-react'
import { InviteButton } from './invite-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Configuración — Kivo',
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const ROL_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  admin:  { label: 'Administrador', icon: Crown,    className: 'text-amber-700 bg-amber-50 border-amber-200' },
  pm:     { label: 'Project Manager', icon: Briefcase, className: 'text-blue-700 bg-blue-50 border-blue-200' },
  viewer: { label: 'Visualizador',  icon: Eye,      className: 'text-zinc-600 bg-zinc-50 border-zinc-200' },
}

export default async function ConfiguracionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener org del usuario actual
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('org_id, rol')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) notFound()

  const orgId = (orgUser as { org_id: string; rol: string }).org_id
  const miRol = (orgUser as { org_id: string; rol: string }).rol

  // Cargar org + miembros en paralelo
  const [orgRes, miembrosRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, nombre, ruc, plan, created_at')
      .eq('id', orgId)
      .single(),
    supabase
      .from('organization_users')
      .select('user_id, rol')
      .eq('org_id', orgId),
  ])

  const org = orgRes.data as {
    id: string
    nombre: string
    ruc: string
    plan: string
    created_at: string
  } | null

  if (!org) notFound()

  // Obtener emails de los usuarios via service role
  const supabaseAdmin = createServiceClient()
  const miembros = (miembrosRes.data ?? []) as Array<{ user_id: string; rol: string }>

  // Cargar detalles de los usuarios desde auth.users
  const userIds = miembros.map((m) => m.user_id)
  let authUsers: Array<{ id: string; email: string; created_at: string }> = []

  if (userIds.length > 0) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    })
    authUsers = (users ?? [])
      .filter((u) => userIds.includes(u.id))
      .map((u) => ({ id: u.id, email: u.email ?? '', created_at: u.created_at }))
  }

  const emailByUserId = Object.fromEntries(authUsers.map((u) => [u.id, u.email]))

  const isAdmin = miRol === 'admin'

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Información de la organización y gestión del equipo
        </p>
      </div>

      {/* Organización */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Organización</h2>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-400">Nombre</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-800">{org.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">RUC</dt>
            <dd className="mt-0.5 text-sm font-mono text-zinc-800">{org.ruc}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">Plan</dt>
            <dd className="mt-0.5">
              <span className={`inline-block text-xs font-semibold rounded px-2 py-0.5 ${
                org.plan === 'pro'
                  ? 'bg-blue-100 text-blue-700'
                  : org.plan === 'enterprise'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-zinc-100 text-zinc-500'
              }`}>
                {PLAN_LABEL[org.plan] ?? org.plan}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">ID</dt>
            <dd className="mt-0.5 text-xs font-mono text-zinc-400 truncate">{org.id}</dd>
          </div>
        </dl>
      </div>

      {/* Equipo */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900">
              Equipo
              <span className="ml-2 text-zinc-400 font-normal">({miembros.length})</span>
            </h2>
          </div>
          {isAdmin && <InviteButton />}
        </div>

        <ul className="divide-y divide-zinc-100">
          {miembros.map((m) => {
            const email = emailByUserId[m.user_id] ?? m.user_id
            const rolCfg = ROL_CONFIG[m.rol]
            const Icon = rolCfg?.icon ?? Eye
            const isMe = m.user_id === user.id

            return (
              <li key={m.user_id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-800">{email}</p>
                      {isMe && (
                        <span className="text-[10px] bg-zinc-100 text-zinc-500 rounded px-1.5 py-0.5">
                          Tú
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Icon size={11} className={rolCfg?.className.split(' ').find((c) => c.startsWith('text-')) ?? 'text-zinc-400'} />
                      <span className="text-xs text-zinc-400">{rolCfg?.label ?? m.rol}</span>
                    </div>
                  </div>
                </div>
                {isAdmin && !isMe && (
                  <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${rolCfg?.className ?? ''}`}>
                    <Icon size={11} />
                    {rolCfg?.label ?? m.rol}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Cuenta actual */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Tu cuenta</h2>
        </div>
        <dl className="space-y-2">
          <div>
            <dt className="text-xs text-zinc-400">Email</dt>
            <dd className="mt-0.5 text-sm text-zinc-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">Rol en la organización</dt>
            <dd className="mt-0.5">
              {(() => {
                const cfg = ROL_CONFIG[miRol]
                const Icon = cfg?.icon ?? Eye
                return (
                  <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ${cfg?.className ?? ''}`}>
                    <Icon size={12} />
                    {cfg?.label ?? miRol}
                  </span>
                )
              })()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
