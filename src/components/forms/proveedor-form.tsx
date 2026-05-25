'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search, Loader2 } from 'lucide-react'
import {
  proveedorSchema,
  type ProveedorInput,
  CONDICIONES_PAGO,
  TIPOS_DOCUMENTO,
} from '@/lib/validations/proveedor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RucData } from '@/app/api/ruc/route'

interface ProveedorFormProps {
  defaultValues?: Partial<ProveedorInput>
  proveedorId?: string
}

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
      tipo: 'persona_juridica',
      ...defaultValues,
    },
  })

  const tipo = watch('tipo')

  async function handleRucSearch() {
    setRucError(null)
    const ruc = rucSearch.trim()
    if (!/^\d{11}$/.test(ruc)) {
      setRucError('Ingresa un RUC de 11 dígitos')
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/ruc?ruc=${ruc}`)
      const data = await res.json() as RucData | { error: string }
      if (!res.ok || 'error' in data) {
        setRucError(('error' in data ? data.error : null) ?? 'RUC no encontrado en SUNAT')
        setSearching(false)
        return
      }
      setValue('ruc', ruc, { shouldValidate: true })
      setValue('razon_social', data.razon_social)
      setValue('tipo', data.tipo === 'persona_natural' ? 'persona_natural' : 'persona_juridica')
      if (data.actividad) setValue('actividad', data.actividad)
    } catch {
      setRucError('Error conectando con SUNAT')
    }
    setSearching(false)
  }

  async function onSubmit(data: ProveedorInput) {
    setServerError(null)
    const url = proveedorId ? `/api/proveedores/${proveedorId}` : '/api/proveedores'
    const method = proveedorId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json() as { id?: string; error?: string }
    if (!res.ok) {
      setServerError(json.error ?? 'Error guardando proveedor')
      return
    }
    router.push('/proveedores')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* 1. Tipo de contribuyente */}
      <div>
        <Label className="mb-2 block">Tipo de contribuyente *</Label>
        <Controller
          name="tipo"
          control={control}
          render={({ field }) => (
            <div className="flex gap-3">
              {([
                { value: 'persona_juridica', label: 'Persona jurídica' },
                { value: 'persona_natural',  label: 'Persona natural'  },
              ] as const).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    field.value === opt.value
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    checked={field.value === opt.value}
                    onChange={() => field.onChange(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
        />
      </div>

      {/* 2A. Persona jurídica → RUC + SUNAT */}
      {tipo === 'persona_juridica' && (
        <div>
          <Label htmlFor="ruc-search">RUC *</Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="ruc-search"
              value={rucSearch}
              onChange={(e) => setRucSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRucSearch())}
              placeholder="20XXXXXXXXX"
              maxLength={11}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleRucSearch}
              disabled={searching}
              className="shrink-0 gap-1.5"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar en SUNAT
            </Button>
          </div>
          {rucError && <p className="mt-1 text-xs text-red-600">{rucError}</p>}
          {errors.ruc && <p className="mt-1 text-xs text-red-600">{errors.ruc.message}</p>}
          <p className="mt-1 text-xs text-zinc-400">Busca el RUC para autocompletar desde SUNAT.</p>
        </div>
      )}

      {/* 2B. Persona natural → documento opcional */}
      {tipo === 'persona_natural' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tipo_documento">
              Tipo de documento <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Controller
              name="tipo_documento"
              control={control}
              render={({ field }) => (
                <select
                  id="tipo_documento"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || undefined)}
                >
                  <option value="">Sin documento</option>
                  {TIPOS_DOCUMENTO.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="numero_documento">
              Número de documento <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="numero_documento"
              placeholder="Ej: 12345678"
              className="mt-1 font-mono"
              {...register('numero_documento')}
            />
          </div>
        </div>
      )}

      {/* 3. Razón social / Nombre */}
      <div>
        <Label htmlFor="razon_social">
          {tipo === 'persona_natural' ? 'Nombre completo *' : 'Razón social *'}
        </Label>
        <Input
          id="razon_social"
          placeholder={tipo === 'persona_natural' ? 'Ej: Juan Pérez García' : 'Ej: Empresa S.A.C.'}
          className="mt-1"
          {...register('razon_social')}
        />
        {errors.razon_social && (
          <p className="mt-1 text-xs text-red-600">{errors.razon_social.message}</p>
        )}
      </div>

      {/* 4. Nombre comercial */}
      <div>
        <Label htmlFor="nombre_comercial">
          Nombre comercial <span className="text-zinc-400">(opcional)</span>
        </Label>
        <Input
          id="nombre_comercial"
          placeholder="Como aparece en facturas"
          className="mt-1"
          {...register('nombre_comercial')}
        />
      </div>

      {/* 5. Actividad económica */}
      <div>
        <Label htmlFor="actividad">
          Actividad económica <span className="text-zinc-400">(opcional)</span>
        </Label>
        <Input
          id="actividad"
          placeholder="Ej: Servicios de publicidad"
          className="mt-1"
          {...register('actividad')}
        />
      </div>

      {/* 6. Contacto y condiciones */}
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Contacto y condiciones
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="condicion_pago">
              Condición de pago <span className="text-zinc-400">(opcional)</span>
            </Label>
            <select
              id="condicion_pago"
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
              {...register('condicion_pago')}
            >
              <option value="">Seleccionar…</option>
              {CONDICIONES_PAGO.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="email">
              Email <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="proveedor@empresa.com"
              className="mt-1"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="notas">
            Notas <span className="text-zinc-400">(opcional)</span>
          </Label>
          <textarea
            id="notas"
            rows={3}
            placeholder="Información adicional sobre este proveedor…"
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 resize-none"
            {...register('notas')}
          />
        </div>
      </div>

      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : proveedorId ? 'Guardar cambios' : 'Crear proveedor'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/proveedores')}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
