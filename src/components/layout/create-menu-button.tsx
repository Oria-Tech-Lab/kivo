'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, Receipt, FileText } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  GastoSheet, NuevoProyectoDialog,
  type GastoProyectoOpt, type GastoProveedorOpt, type ProyectoClienteOpt,
} from '@/components/forms/create-dialogs'
import { createClient } from '@/lib/supabase/client'

export function CreateMenuButton() {
  const router = useRouter()
  const [gastoOpen, setGastoOpen] = useState(false)
  const [proyectoOpen, setProyectoOpen] = useState(false)
  const [proyectos, setProyectos] = useState<GastoProyectoOpt[]>([])
  const [proveedores, setProveedores] = useState<GastoProveedorOpt[]>([])
  const [clientes, setClientes] = useState<ProyectoClienteOpt[]>([])

  async function openGasto() {
    const supabase = createClient()
    const [pRes, pvRes] = await Promise.all([
      supabase.from('proyectos').select('id, nombre').eq('estado', 'activo').order('nombre'),
      supabase.from('proveedores').select('id, razon_social, nombre_comercial').order('razon_social'),
    ])
    setProyectos((pRes.data ?? []) as GastoProyectoOpt[])
    setProveedores((pvRes.data ?? []) as GastoProveedorOpt[])
    setGastoOpen(true)
  }

  async function openProyecto() {
    const supabase = createClient()
    const res = await supabase.from('clientes').select('id, nombre').eq('estado', 'activo').order('nombre')
    setClientes((res.data ?? []) as ProyectoClienteOpt[])
    setProyectoOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#2563eb' }}
          >
            ＋ Crear
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-48"
        >
          <DropdownMenuItem
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={openProyecto}
          >
            <FolderPlus size={14} className="text-zinc-500" />
            Nuevo Proyecto
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={openGasto}
          >
            <Receipt size={14} className="text-zinc-500" />
            Registrar Gasto
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => router.push('/facturas?nueva=true')}
          >
            <FileText size={14} className="text-zinc-500" />
            Nueva Factura
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <GastoSheet
        open={gastoOpen}
        onClose={() => setGastoOpen(false)}
        proyectos={proyectos}
        proveedores={proveedores}
      />
      <NuevoProyectoDialog
        open={proyectoOpen}
        onClose={() => setProyectoOpen(false)}
        clientes={clientes}
      />
    </>
  )
}
