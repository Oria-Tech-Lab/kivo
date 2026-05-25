'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { presupuestoSchema, type PresupuestoInput } from '@/lib/validations/presupuesto'
import { calcularIGVDebito } from '@/lib/calculations/tributarios'
import { formatMoney, solesToCentavos } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProyectoOption {
  id: string
  nombre: string
  cliente: { nombre: string } | null
}

interface PresupuestoFormProps {
  proyectos: ProyectoOption[]
  defaultProyectoId?: string
}

const CONDICIONES_PAGO = [
  { value: 'contado', label: 'Contado' },
  { value: '30d', label: '30 días' },
  { value: '45d', label: '45 días' },
  { value: 'hitos', label: 'Por hitos' },
] as const

/** Línea vacía para agregar */
const LINEA_VACIA = {
  concepto: '',
  subtotal: 0,
  igv: 0,
  total: 0,
  pct_fee: null,
}

export function PresupuestoForm({ proyectos, defaultProyectoId }: PresupuestoFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  // Valores de soles para input (UI); los centavos van al form
  const [subtotalesSoles, setSubtotalesSoles] = useState<string[]>([''])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PresupuestoInput>({
    resolver: zodResolver(presupuestoSchema),
    defaultValues: {
      proyecto_id: defaultProyectoId ?? '',
      condicion_pago: 'contado',
      lineas: [{ ...LINEA_VACIA }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineas',
  })

  const lineas = watch('lineas')

  /** Recalcula IGV y total de una línea cuando cambia el subtotal */
  const handleSubtotalChange = useCallback(
    (index: number, solesStr: string) => {
      // Actualizar display
      const newSoles = [...subtotalesSoles]
      newSoles[index] = solesStr
      setSubtotalesSoles(newSoles)

      const soles = parseFloat(solesStr.replace(',', '.'))
      if (isNaN(soles) || soles < 0) {
        setValue(`lineas.${index}.subtotal`, 0)
        setValue(`lineas.${index}.igv`, 0)
        setValue(`lineas.${index}.total`, 0)
        return
      }

      const centavos = solesToCentavos(soles)
      const igv = calcularIGVDebito(centavos)
      const total = centavos + igv

      setValue(`lineas.${index}.subtotal`, centavos)
      setValue(`lineas.${index}.igv`, igv)
      setValue(`lineas.${index}.total`, total)
    },
    [setValue, subtotalesSoles]
  )

  function agregarLinea() {
    append({ ...LINEA_VACIA })
    setSubtotalesSoles((prev) => [...prev, ''])
  }

  function eliminarLinea(index: number) {
    remove(index)
    setSubtotalesSoles((prev) => prev.filter((_, i) => i !== index))
  }

  // Totales calculados en tiempo real (en centavos)
  const subtotalTotal = lineas.reduce((sum, l) => sum + (l.subtotal ?? 0), 0)
  const igvTotal = lineas.reduce((sum, l) => sum + (l.igv ?? 0), 0)
  const totalTotal = lineas.reduce((sum, l) => sum + (l.total ?? 0), 0)

  async function onSubmit(data: PresupuestoInput) {
    setServerError(null)

    const res = await fetch('/api/presupuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json() as { error?: string; id?: string }

    if (!res.ok) {
      setServerError(json.error ?? 'Error guardando presupuesto')
      return
    }

    if (json.id) {
      router.push(`/presupuestos/${json.id}`)
    } else {
      router.push('/presupuestos')
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

      {/* ── Datos generales ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Datos del presupuesto</h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Proyecto */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="proyecto_id">Proyecto *</Label>
            <select
              id="proyecto_id"
              {...register('proyecto_id')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
              aria-invalid={!!errors.proyecto_id}
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.cliente ? ` — ${p.cliente.nombre}` : ''}
                </option>
              ))}
            </select>
            {errors.proyecto_id && (
              <p className="text-xs text-red-600">{errors.proyecto_id.message}</p>
            )}
          </div>

          {/* Condición de pago */}
          <div className="space-y-1.5">
            <Label htmlFor="condicion_pago">Condición de pago *</Label>
            <select
              id="condicion_pago"
              {...register('condicion_pago')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            >
              {CONDICIONES_PAGO.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Líneas de presupuesto ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">
            Líneas de presupuesto
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={agregarLinea}
            className="h-7 gap-1 text-xs"
          >
            <Plus size={12} />
            Agregar línea
          </Button>
        </div>

        {errors.lineas && typeof errors.lineas === 'object' && 'message' in errors.lineas && (
          <p className="mb-3 text-xs text-red-600">{errors.lineas.message as string}</p>
        )}

        <div className="space-y-3">
          {/* Header de la tabla */}
          <div className="hidden md:grid md:grid-cols-[1fr_140px_90px_90px_28px] gap-3 pb-1 border-b border-zinc-100">
            <span className="text-xs font-medium text-zinc-400">Concepto</span>
            <span className="text-xs font-medium text-zinc-400 text-right">Subtotal (S/)</span>
            <span className="text-xs font-medium text-zinc-400 text-right">IGV 18%</span>
            <span className="text-xs font-medium text-zinc-400 text-right">Total</span>
            <span />
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 md:grid-cols-[1fr_140px_90px_90px_28px] md:gap-3 md:items-center"
            >
              {/* Concepto */}
              <div>
                <Input
                  placeholder={`Concepto ${index + 1}`}
                  {...register(`lineas.${index}.concepto`)}
                  aria-invalid={!!errors.lineas?.[index]?.concepto}
                  className="text-sm"
                />
                {errors.lineas?.[index]?.concepto && (
                  <p className="mt-0.5 text-xs text-red-600">
                    {errors.lineas[index]?.concepto?.message}
                  </p>
                )}
              </div>

              {/* Subtotal */}
              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={subtotalesSoles[index] ?? ''}
                  onChange={(e) => handleSubtotalChange(index, e.target.value)}
                  className="text-sm text-right font-mono"
                  aria-label={`Subtotal línea ${index + 1}`}
                />
                {errors.lineas?.[index]?.subtotal && (
                  <p className="mt-0.5 text-xs text-red-600">
                    {errors.lineas[index]?.subtotal?.message}
                  </p>
                )}
              </div>

              {/* IGV (solo lectura) */}
              <div className="text-right">
                <span className="text-sm text-zinc-500 font-mono tabular-nums">
                  {formatMoney(lineas[index]?.igv ?? 0)}
                </span>
              </div>

              {/* Total (solo lectura) */}
              <div className="text-right">
                <span className="text-sm font-medium text-zinc-900 font-mono tabular-nums">
                  {formatMoney(lineas[index]?.total ?? 0)}
                </span>
              </div>

              {/* Botón eliminar */}
              <div className="flex justify-end md:justify-center">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => eliminarLinea(index)}
                    title="Eliminar línea"
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div className="mt-5 border-t border-zinc-100 pt-4 flex justify-end">
          <div className="w-full max-w-[320px] space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Subtotal (sin IGV)</span>
              <span className="font-mono tabular-nums text-zinc-700">
                {formatMoney(subtotalTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">IGV 18%</span>
              <span className="font-mono tabular-nums text-zinc-500">
                {formatMoney(igvTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
              <span className="font-semibold text-zinc-900">Total</span>
              <span className="font-mono tabular-nums text-lg font-bold text-zinc-900">
                {formatMoney(totalTotal)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={15} className="mr-2 animate-spin" />}
          Crear presupuesto
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/presupuestos')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
