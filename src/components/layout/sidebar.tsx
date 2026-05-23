'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Building2,
  FileText,
  Receipt,
  Wallet,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Inicio',
    href: '/inicio',
    icon: LayoutDashboard,
  },
  {
    label: 'Proyectos',
    href: '/proyectos',
    icon: FolderKanban,
  },
  {
    label: 'Clientes',
    href: '/clientes',
    icon: Users,
  },
  {
    label: 'Proveedores',
    href: '/proveedores',
    icon: Building2,
  },
  {
    label: 'Presupuestos',
    href: '/presupuestos',
    icon: FileText,
  },
  {
    label: 'Gastos',
    href: '/gastos',
    icon: Receipt,
  },
  {
    label: 'Caja',
    href: '/caja',
    icon: Wallet,
  },
] as const

interface SidebarProps {
  orgName: string
  userEmail: string
  userRole: string
}

export function Sidebar({ orgName, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    pm: 'Project Manager',
    viewer: 'Visualizador',
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-200 bg-white">
      {/* Org header */}
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-100 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-xs font-bold text-white">
          {orgName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{orgName}</p>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide">
            {roleLabel[userRole] ?? userRole}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                  )}
                >
                  <Icon
                    size={16}
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-zinc-900' : 'text-zinc-400'
                    )}
                  />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Separador */}
        <div className="my-3 border-t border-zinc-100" />

        <ul>
          <li>
            <Link
              href="/configuracion"
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/configuracion')
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <Settings
                size={16}
                className={cn(
                  'shrink-0',
                  pathname.startsWith('/configuracion') ? 'text-zinc-900' : 'text-zinc-400'
                )}
              />
              Configuración
            </Link>
          </li>
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-zinc-100 p-3">
        <div className="mb-1.5 px-1">
          <p className="truncate text-xs font-medium text-zinc-700">{userEmail}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} className="shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
