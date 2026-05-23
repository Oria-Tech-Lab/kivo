'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search, Loader2 } from 'lucide-react'
import { proveedorSchema, type ProveedorInput } from '@/lib/validations/proveedor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { RucData } from '@/app/api/ruc/route'

interface ProveedorFormProps {
  defaultValues?: Partial<ProveedorInput>
  proveedorId?: string // si existe → modo edición
}

const DETRACCIONES_COMUNES = [4, 9, 10, 12, 15]

export function ProveedorForm({ defaultValues, proveedorId }: ProveedorFormProps) {
  const router = useRouter()
  const [rucSearch, setRucSearch] = useState(defaultValues?.ruc ?? '')
  const [searching, setSearching] = useState(false)
  const [rucError, setRucError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProveedorInput>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      aplica_detraccion: false,
      pct_detraccion: 0,
      tipo: 'persona_juridica',
      ...defaultValues,
    },
  })

  const aplicaDetraccion = watch('aplica_detraccion')

  // ─── Lookup de RUC ───────────────────────────────────────────
  async function handleRucSearch() {
    setRucError(null)
    const ruc = rucSearch.trim()

    if (!/^\d{11}$/.test(ruc)) {
      setRucError('El RUC debe tener 11 dígitos')
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/ruc?numero=${ruc}`)
      const json = await res.json() as RucData & { error?: string }

      if (!res.ok) {
        setRucError(json.error ?? 'RUC no encontrado')
        return
      }

      // Autofill
      setValue('ruc', json.ruc)
      setValue('razon_social', json.razon_social)
      setValue('nombre_comercial', json.nombre_comercial ?? '')
      setValue('tipo', json.tipo)
      setValue('actividad', json.actividad ?? '')
    } catch {
      setRucError('Error de conexión. Ingresa los datos manualmente.')
    } finally {
      setSearching(false)
    }
  }

  // ─── Submit ──────────────────────────────────────────────────
  async function onSubmit(data: ProveedorInput) {
    setServerError(null)

    const url = proveedorId ? `/api/proveedores/${proveedorId}` : '/api/proveedores'
    const method = proveedorId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json() as { error?: string }

    if (!res.ok) {
      setServerError(json.error ?? 'Error guardando proveedor')
      return
    }

    router.push('/proveedores')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* ── Sección RUC ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Datos tributarios</h3>
        <div className="space-y-4">

          {/* Buscador de RUC */}
          <div className="space-y-1.5">
            <Label htmlFor="rucSearch">RUC</Label>
            <div className="flex gap-2">
              <Input
                id="rucSearch"
                type="text"
                inputMode="numeric"
                maxLength={11}
                placeholder="20123456789"
                value={rucSearch}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                  setRucSearch(v)
                  setValue('ruc', v)
                  setRucError(null)
                }}
                className="max-w-[200px]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleRucSearch}
                disabled={searching || rucSearch.length !== 11}
              >
                {searching ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                <span className="ml-1.5">Buscar en SUNAT</span>
              </Button>
            </div>
            {rucError && <p className="text-xs text-red-600">{rucError}</p>}
            {errors.ruc && <p className="text-xs text-red-600">{errors.ruc.message}</p>}
            <input type="hidden" {...register('ruc')} />
          </div>

          {/* Razón social */}
          <div className="space-y-1.5">
            <Label htmlFor="razon_social">Razón social *</Label>
            <Input
              id="razon_social"
              placeholder="EMPRESA S.A.C."
              {...register('razon_social')}
              aria-invalid={!!errors.razon_social}
            />
            {errors.razon_social && (
              <p className="text-xs text-red-600">{errors.razon_social.message}</p>
            )}
          </div>

          {/* Nombre comercial */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre_comercial">
              Nombre comercial <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="nombre_comercial"
              placeholder="Como aparece en facturas"
              {...register('nombre_comercial')}
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de contribuyente *</Label>
            <select
              id="tipo"
              {...register('tipo')}
              className="flex h-9 w-full max-w-[260px] rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            >
              <option value="persona_juridica">Persona jurídica</option>
              <option value="persona_natural">Persona natural</option>
            </select>
          </div>

          {/* Actividad */}
          <div className="space-y-1.5">
            <Label htmlFor="actividad">
              Actividad económica <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="actividad"
              placeholder="Ej: Servicios de publicidad"
              {...register('actividad')}
            />
          </div>
        </div>
      </section>

      {/* ── Sección Detracción ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Detracción SPOT</h3>
        <div className="space-y-4">

          {/* Toggle detracción */}
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
            <Label htmlFor="aplica_detraccion" className="cursor-pointer">
              Aplica detracción SPOT
            </Label>
          </div>

          {/* Porcentaje */}
          {aplicaDetraccion && (
            <div className="space-y-1.5 pl-7">
              <Label htmlFor="pct_detraccion">Porcentaje (%)</Label>
              <div className="flex flex-wrap gap-2">
                {DETRACCIONES_COMUNES.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setValue('pct_detraccion', pct)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      watch('pct_detraccion') === pct
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    id="pct_detraccion"
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    {...register('pct_detraccion', { valueAsNumber: true })}
                  />
                  <span className="text-sm text-zinc-500">%</span>
                </div>
              </div>
              {errors.pct_detraccion && (
                <p className="text-xs text-red-600">{errors.pct_detraccion.message}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Sección Contacto / Pago ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Contacto y condiciones</h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Condición de pago */}
          <div className="space-y-1.5">
            <Label htmlFor="condicion_pago">
              Condición de pago <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="condicion_pago"
              placeholder="Ej: 30 días"
              {...register('condicion_pago')}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="proveedor@empresa.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notas">
              Notas <span className="text-zinc-400">(opcional)</span>
            </Label>
            <textarea
              id="notas"
              rows={3}
              placeholder="Observaciones, condiciones especiales…"
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
          {proveedorId ? 'Guardar cambios' : 'Crear proveedor'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/proveedores')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
