'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { clienteSchema, type ClienteInput } from '@/lib/validations/cliente'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClienteFormProps {
  defaultValues?: Partial<ClienteInput>
  clienteId?: string
}

export function ClienteForm({ defaultValues, clienteId }: ClienteFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      estado: 'activo',
      ...defaultValues,
    },
  })

  async function onSubmit(data: ClienteInput) {
    setServerError(null)

    const url = clienteId ? `/api/clientes/${clienteId}` : '/api/clientes'
    const method = clienteId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json() as { error?: string }

    if (!res.ok) {
      setServerError(json.error ?? 'Error guardando cliente')
      return
    }

    router.push('/clientes')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* ── Datos principales ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Datos del cliente</h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Nombre */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nombre">Nombre / Razón social *</Label>
            <Input
              id="nombre"
              placeholder="Agencia XYZ S.A.C."
              {...register('nombre')}
              aria-invalid={!!errors.nombre}
            />
            {errors.nombre && (
              <p className="text-xs text-red-600">{errors.nombre.message}</p>
            )}
          </div>

          {/* RUC */}
          <div className="space-y-1.5">
            <Label htmlFor="ruc">
              RUC <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="ruc"
              type="text"
              inputMode="numeric"
              maxLength={11}
              placeholder="20123456789"
              {...register('ruc')}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                e.target.value = v
              }}
            />
            {errors.ruc && (
              <p className="text-xs text-red-600">{errors.ruc.message}</p>
            )}
          </div>

          {/* Estado */}
          <div className="space-y-1.5">
            <Label htmlFor="estado">Estado</Label>
            <select
              id="estado"
              {...register('estado')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Contacto ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">
          Contacto <span className="font-normal text-zinc-400">(opcional)</span>
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Contacto nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="contacto_nombre">Nombre del contacto</Label>
            <Input
              id="contacto_nombre"
              placeholder="Juan Pérez"
              {...register('contacto_nombre')}
            />
          </div>

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label htmlFor="contacto_telefono">Teléfono</Label>
            <Input
              id="contacto_telefono"
              type="tel"
              placeholder="+51 999 999 999"
              {...register('contacto_telefono')}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="contacto_email">Email</Label>
            <Input
              id="contacto_email"
              type="email"
              placeholder="contacto@empresa.com"
              {...register('contacto_email')}
            />
            {errors.contacto_email && (
              <p className="text-xs text-red-600">{errors.contacto_email.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={15} className="mr-2 animate-spin" />}
          {clienteId ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/clientes')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
