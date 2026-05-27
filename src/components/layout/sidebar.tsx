'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  Landmark,
  PlusCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Inicio',       href: '/inicio',           icon: LayoutDashboard },
  { label: 'Proyectos',    href: '/proyectos',         icon: FolderKanban   },
  { label: 'Clientes',     href: '/clientes',          icon: Users          },
  { label: 'Proveedores',  href: '/proveedores',       icon: Building2      },
  { label: 'Presupuestos', href: '/presupuestos',      icon: FileText       },
  { label: 'Gastos',       href: '/gastos',            icon: Receipt        },
  { label: 'GG',           href: '/gastos-generales',  icon: Landmark       },
  { label: 'Caja',         href: '/caja',              icon: Wallet         },
] as const

interface SidebarProps {
  orgName: string
  userEmail: string
  userRole: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-56 flex-col" style={{ background: '#0f172a' }}>

      {/* ── Logo ──────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: '#2563eb' }}
          >
            K
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Kivo</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
              Digital Treasurer
            </p>
          </div>
        </div>

        {/* ── CTA Registrar Gasto ───────────────────── */}
        <Link
          href="/gastos/nuevo"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: '#2563eb' }}
        >
          <PlusCircle size={15} className="shrink-0" />
          Registrar Gasto
        </Link>
      </div>

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  )}
                  style={
                    isActive
                      ? { background: '#2563eb', color: '#ffffff' }
                      : { color: '#94a3b8' }
                  }
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = '#1e293b'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <Icon size={16} className="shrink-0" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Separator */}
        <div className="my-3 border-t" style={{ borderColor: '#1e293b' }} />

        <ul>
          <li>
            <Link
              href="/configuracion"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={
                pathname.startsWith('/configuracion')
                  ? { background: '#2563eb', color: '#ffffff' }
                  : { color: '#94a3b8' }
              }
              onMouseEnter={e => {
                if (!pathname.startsWith('/configuracion'))
                  (e.currentTarget as HTMLElement).style.background = '#1e293b'
              }}
              onMouseLeave={e => {
                if (!pathname.startsWith('/configuracion'))
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Settings size={16} className="shrink-0" />
              Configuración
            </Link>
          </li>
        </ul>
      </nav>

      {/* ── User footer ───────────────────────────────── */}
      <div className="p-3" style={{ borderTop: '1px solid #1e293b' }}>
        <p className="truncate px-1 pb-1.5 text-xs" style={{ color: '#64748b' }}>
          {userEmail}
        </p>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={{ color: '#94a3b8' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = '#1e293b'
            ;(e.currentTarget as HTMLElement).style.color = '#f87171'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
          }}
        >
          <LogOut size={16} className="shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
