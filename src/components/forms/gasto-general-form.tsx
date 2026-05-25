'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { gastoGeneralSchema, type GastoGeneralInput } from '@/lib/validations/gasto-general'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/lib/utils'

interface Proveedor {
  id: string
  razon_social: string
  nombre_comercial: string | null
}

interface GastoGeneralFormProps {
  proveedores: Proveedor[]
  gastoGeneralId?: string
  defaultValues?: Partial<GastoGeneralInput>
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i)

export function GastoGeneralForm({ proveedores, gastoGeneralId, defaultValues }: GastoGeneralFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [montoSoles, setMontoSoles] = useState(
    defaultValues?.monto ? String((defaultValues.monto / 100).toFixed(2)) : ''
  )

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GastoGeneralInput>({
    resolver: zodResolver(gastoGeneralSchema),
    defaultValues: {
      tipo_recurrencia: 'mensual',
      umbral_proyectos: 1,
      periodo_mes: new Date().getMonth() + 1,
      periodo_anio: CURRENT_YEAR,
      ...defaultValues,
    },
  })

  const tipoRecurrencia = watch('tipo_recurrencia')
  const tipoComprobante = watch('tipo_comprobante')
  const monto = watch('monto')

  // Calcular IGV en tiempo real
  const igv = tipoComprobante === 'factura' ? Math.round((monto ?? 0) * 0.18) : 0
  const total = (monto ?? 0) + igv

  // Sync input de soles → centavos
  function handleMontoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setMontoSoles(raw)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed > 0) {
      setValue('monto', Math.round(parsed * 100), { shouldValidate: true })
    } else {
      setValue('monto', 0)
    }
  }

  async function onSubmit(data: GastoGeneralInput) {
    setServerError(null)
    const url = gastoGeneralId ? `/api/gastos-generales/${gastoGeneralId}` : '/api/gastos-generales'
    const method = gastoGeneralId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json() as { id?: string; error?: string }

    if (!res.ok) {
      setServerError(json.error ?? 'Error guardando gasto general')
      return
    }

    router.push('/gastos-generales')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Concepto */}
      <div>
        <Label htmlFor="concepto">Concepto *</Label>
        <Input
          id="concepto"
          placeholder="Ej: Alquiler oficina, Adobe Creative, Sueldo diseñador"
          className="mt-1"
          {...register('concepto')}
        />
        {errors.concepto && (
          <p className="mt-1 text-xs text-red-600">{errors.concepto.message}</p>
        )}
      </div>

      {/* Proveedor */}
      <div>
        <Label htmlFor="proveedor_id">Proveedor (opcional)</Label>
        <select
          id="proveedor_id"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
          {...register('proveedor_id')}
        >
          <option value="">Sin proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre_comercial ?? p.razon_social}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo comprobante */}
      <div>
        <Label htmlFor="tipo_comprobante">Tipo de comprobante</Label>
        <select
          id="tipo_comprobante"
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
          {...register('tipo_comprobante')}
        >
          <option value="">Sin comprobante</option>
          <option value="factura">Factura (con IGV)</option>
          <option value="boleta">Boleta</option>
          <option value="rxh">Recibo por Honorarios</option>
          <option value="sin_comprobante">Sin comprobante</option>
        </select>
      </div>

      {/* Tipo recurrencia */}
      <div>
        <Label>Recurrencia *</Label>
        <div className="mt-1 flex gap-3">
          {(['mensual', 'puntual'] as const).map((tipo) => (
            <label
              key={tipo}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Controller
                name="tipo_recurrencia"
                control={control}
                render={({ field }) => (
                  <input
                    type="radio"
                    value={tipo}
                    checked={field.value === tipo}
                    onChange={() => field.onChange(tipo)}
                    className="accent-zinc-900"
                  />
                )}
              />
              <span className="text-sm capitalize">{tipo}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Periodo (solo si es mensual) */}
      {tipoRecurrencia === 'mensual' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="periodo_mes">Mes *</Label>
            <Controller
              name="periodo_mes"
              control={control}
              render={({ field }) => (
                <select
                  id="periodo_mes"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Seleccionar</option>
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              )}
            />
            {errors.periodo_mes && (
              <p className="mt-1 text-xs text-red-600">{errors.periodo_mes.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="periodo_anio">Año *</Label>
            <Controller
              name="periodo_anio"
              control={control}
              render={({ field }) => (
                <select
                  id="periodo_anio"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Seleccionar</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>
      )}

      {/* Monto */}
      <div>
        <Label htmlFor="monto">Monto (S/) *</Label>
        <div className="mt-1 flex">
          <span className="flex items-center rounded-l-md border border-r-0 border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500">
            S/
          </span>
          <Input
            id="monto"
            type="number"
            step="0.01"
            min="0.01"
            value={montoSoles}
            onChange={handleMontoChange}
            placeholder="0.00"
            className="rounded-l-none"
          />
        </div>
        {errors.monto && (
          <p className="mt-1 text-xs text-red-600">{errors.monto.message}</p>
        )}

        {/* Desglose IGV */}
        {tipoComprobante === 'factura' && monto > 0 && (
          <div className="mt-2 rounded-md bg-zinc-50 border border-zinc-100 p-3 text-xs space-y-1">
            <div className="flex justify-between text-zinc-500">
              <span>Base imponible</span>
              <span className="font-mono">{formatMoney(monto)}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>IGV (18%)</span>
              <span className="font-mono">{formatMoney(igv)}</span>
            </div>
            <div className="flex justify-between font-semibold text-zinc-900 border-t border-zinc-200 pt-1 mt-1">
              <span>Total</span>
              <span className="font-mono">{formatMoney(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Umbral proyectos */}
      <div>
        <Label htmlFor="umbral_proyectos">
          Umbral de proyectos activos *
        </Label>
        <p className="text-xs text-zinc-400 mb-1">
          Número mínimo de proyectos activos para que este gasto quede cubierto
        </p>
        <Input
          id="umbral_proyectos"
          type="number"
          min="1"
          className="mt-1 max-w-xs"
          {...register('umbral_proyectos', { valueAsNumber: true })}
        />
        {errors.umbral_proyectos && (
          <p className="mt-1 text-xs text-red-600">{errors.umbral_proyectos.message}</p>
        )}
      </div>

      {/* Errores del servidor */}
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Guardando…'
            : gastoGeneralId
            ? 'Guardar cambios'
            : 'Registrar gasto general'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/gastos-generales')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
