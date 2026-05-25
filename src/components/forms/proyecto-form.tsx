'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { proyectoSchema, type ProyectoInput } from '@/lib/validations/proyecto'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface ProyectoFormProps {
  defaultValues?: Partial<ProyectoInput>
  proyectoId?: string
  clientes: Array<{ id: string; nombre: string; ruc: string | null }>
}

const TIPOS_PROYECTO = [
  { value: 'digital', label: 'Digital' },
  { value: 'offline', label: 'Offline' },
  { value: 'evento', label: 'Evento' },
  { value: 'instalacion', label: 'Instalación' },
  { value: 'otro', label: 'Otro' },
] as const

const ESTADOS_PROYECTO = [
  { value: 'activo', label: 'Activo' },
  { value: 'en_pausa', label: 'En pausa' },
  { value: 'cerrado', label: 'Cerrado' },
] as const

export function ProyectoForm({ defaultValues, proyectoId, clientes }: ProyectoFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProyectoInput>({
    resolver: zodResolver(proyectoSchema),
    defaultValues: {
      estado: 'activo',
      tipo: 'digital',
      aplica_detraccion: false,
      fecha_inicio: new Date().toISOString().split('T')[0],
      ...defaultValues,
    },
  })

  async function onSubmit(data: ProyectoInput) {
    setServerError(null)

    const url = proyectoId ? `/api/proyectos/${proyectoId}` : '/api/proyectos'
    const method = proyectoId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json() as { error?: string; id?: string }

    if (!res.ok) {
      setServerError(json.error ?? 'Error guardando proyecto')
      return
    }

    if (!proyectoId && json.id) {
      router.push(`/proyectos/${json.id}`)
    } else {
      router.push('/proyectos')
    }
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
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Datos del proyecto</h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Nombre */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nombre">Nombre del proyecto *</Label>
            <Input
              id="nombre"
              placeholder="Campaña verano 2025"
              {...register('nombre')}
              aria-invalid={!!errors.nombre}
            />
            {errors.nombre && (
              <p className="text-xs text-red-600">{errors.nombre.message}</p>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cliente_id">Cliente *</Label>
            <select
              id="cliente_id"
              {...register('cliente_id')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
              aria-invalid={!!errors.cliente_id}
            >
              <option value="">Selecciona un cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.ruc ? ` — ${c.ruc}` : ''}
                </option>
              ))}
            </select>
            {errors.cliente_id && (
              <p className="text-xs text-red-600">{errors.cliente_id.message}</p>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo *</Label>
            <select
              id="tipo"
              {...register('tipo')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            >
              {TIPOS_PROYECTO.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="space-y-1.5">
            <Label htmlFor="estado">Estado</Label>
            <select
              id="estado"
              {...register('estado')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            >
              {ESTADOS_PROYECTO.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Fechas ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Fechas</h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Fecha inicio */}
          <div className="space-y-1.5">
            <Label htmlFor="fecha_inicio">Fecha de inicio *</Label>
            <Input
              id="fecha_inicio"
              type="date"
              {...register('fecha_inicio')}
              aria-invalid={!!errors.fecha_inicio}
            />
            {errors.fecha_inicio && (
              <p className="text-xs text-red-600">{errors.fecha_inicio.message}</p>
            )}
          </div>

          {/* Fecha cierre estimada */}
          <div className="space-y-1.5">
            <Label htmlFor="fecha_cierre_est">
              Fecha de cierre estimada{' '}
              <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="fecha_cierre_est"
              type="date"
              {...register('fecha_cierre_est')}
            />
          </div>
        </div>
      </section>

      {/* ── Detracción y notas ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Configuración adicional</h3>
        <div className="space-y-4">

          {/* Aplica detracción */}
          <div className="flex items-center gap-3">
            <Controller
              name="aplica_detraccion"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="aplica_detraccion"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <div>
              <Label htmlFor="aplica_detraccion" className="cursor-pointer">
                El cliente aplica detracción SPOT
              </Label>
              <p className="text-xs text-zinc-400 mt-0.5">
                Las facturas emitidas tendrán detracción del 10% (publicidad)
              </p>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="notas">
              Notas <span className="text-zinc-400">(opcional)</span>
            </Label>
            <textarea
              id="notas"
              rows={3}
              placeholder="Observaciones, alcance, condiciones especiales…"
              {...register('notas')}
              className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={15} className="mr-2 animate-spin" />}
          {proyectoId ? 'Guardar cambios' : 'Crear proyecto'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/proyectos')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
