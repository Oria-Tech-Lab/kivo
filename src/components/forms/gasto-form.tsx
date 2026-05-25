'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, X, FileText } from 'lucide-react'
import { gastoSchema, type GastoInput } from '@/lib/validations/gasto'
import { calcularGasto } from '@/lib/calculations/tributarios'
import { formatMoney, solesToCentavos } from '@/lib/utils'
import { validateFile } from '@/lib/validations/upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface ProyectoOption {
  id: string
  nombre: string
  cliente: { nombre: string } | null
}

interface ProveedorOption {
  id: string
  razon_social: string
  nombre_comercial: string | null
  aplica_detraccion: boolean
  pct_detraccion: number
}

interface GastoFormProps {
  proyectos: ProyectoOption[]
  proveedores: ProveedorOption[]
  defaultProyectoId?: string
  defaultValues?: Partial<GastoInput>
  gastoId?: string
}

const TIPOS_COMPROBANTE = [
  { value: 'factura', label: 'Factura (con IGV crédito)' },
  { value: 'boleta', label: 'Boleta' },
  { value: 'rxh', label: 'Recibo por Honorarios' },
  { value: 'sin_comprobante', label: 'Sin comprobante' },
] as const

export function GastoForm({
  proyectos,
  proveedores,
  defaultProyectoId,
  defaultValues,
  gastoId,
}: GastoFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [subtotalSoles, setSubtotalSoles] = useState(
    defaultValues?.subtotal ? String((defaultValues.subtotal / 100).toFixed(2)) : ''
  )
  const [adjunto, setAdjunto] = useState<File | null>(null)
  const [adjuntoError, setAdjuntoError] = useState<string | null>(null)
  const [uploadingAdjunto, setUploadingAdjunto] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GastoInput>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      proyecto_id: defaultProyectoId ?? '',
      tipo_comprobante: 'factura',
      aplica_detraccion: false,
      pct_detraccion: 0,
      estado_pago: 'pendiente',
      fecha_comprobante: new Date().toISOString().split('T')[0],
      subtotal: 0,
      ...defaultValues,
    },
  })

  const tipoComprobante = watch('tipo_comprobante')
  const aplicaDetraccion = watch('aplica_detraccion')
  const pctDetraccion = watch('pct_detraccion')
  const subtotal = watch('subtotal')

  // Cálculo en tiempo real
  const calculo = calcularGasto({
    subtotal: subtotal ?? 0,
    tipoComprobante: tipoComprobante,
    aplicaDetraccion: aplicaDetraccion,
    pctDetraccion: pctDetraccion ?? 0,
  })

  /** Cuando cambia el proveedor */
  function handleProveedorChange(proveedorId: string) {
    setValue('proveedor_id', proveedorId)
  }

  /** Convierte soles → centavos al cambiar el input */
  function handleSubtotalChange(solesStr: string) {
    setSubtotalSoles(solesStr)
    const soles = parseFloat(solesStr.replace(',', '.'))
    if (isNaN(soles) || soles < 0) {
      setValue('subtotal', 0)
      return
    }
    setValue('subtotal', solesToCentavos(soles))
  }

  /** Validación del archivo adjunto */
  async function handleAdjuntoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAdjuntoError(null)
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await validateFile(file)
      setAdjunto(file)
    } catch (err) {
      setAdjuntoError((err as Error).message)
      e.target.value = ''
    }
  }

  async function onSubmit(data: GastoInput) {
    setServerError(null)

    const url = gastoId ? `/api/gastos/${gastoId}` : '/api/gastos'
    const method = gastoId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json() as { error?: string; id?: string }

    if (!res.ok) {
      setServerError(json.error ?? 'Error guardando gasto')
      return
    }

    const nuevoGastoId = gastoId ?? json.id

    // Si hay adjunto, subirlo
    if (adjunto && nuevoGastoId) {
      setUploadingAdjunto(true)
      const fd = new FormData()
      fd.append('file', adjunto)

      const uploadRes = await fetch(`/api/gastos/${nuevoGastoId}/upload`, {
        method: 'POST',
        body: fd,
      })

      setUploadingAdjunto(false)

      if (!uploadRes.ok) {
        const uploadJson = await uploadRes.json() as { error?: string }
        // El gasto fue creado, solo falló el upload
        setServerError(`Gasto guardado pero error subiendo comprobante: ${uploadJson.error ?? 'desconocido'}`)
        router.push(`/gastos/${nuevoGastoId}`)
        router.refresh()
        return
      }
    }

    router.push(`/gastos/${nuevoGastoId}`)
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
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Datos del gasto</h3>
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

          {/* Proveedor */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="proveedor_id">Proveedor *</Label>
            <select
              id="proveedor_id"
              value={watch('proveedor_id') ?? ''}
              onChange={(e) => handleProveedorChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
              aria-invalid={!!errors.proveedor_id}
            >
              <option value="">Selecciona un proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razon_social}
                  {p.nombre_comercial && p.nombre_comercial !== p.razon_social
                    ? ` (${p.nombre_comercial})`
                    : ''}
                </option>
              ))}
            </select>
            {errors.proveedor_id && (
              <p className="text-xs text-red-600">{errors.proveedor_id.message}</p>
            )}
          </div>

          {/* Concepto */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="concepto">Concepto *</Label>
            <Input
              id="concepto"
              placeholder="Ej: Diseño de piezas gráficas"
              {...register('concepto')}
              aria-invalid={!!errors.concepto}
            />
            {errors.concepto && (
              <p className="text-xs text-red-600">{errors.concepto.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Comprobante ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Comprobante</h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label htmlFor="tipo_comprobante">Tipo *</Label>
            <select
              id="tipo_comprobante"
              {...register('tipo_comprobante')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            >
              {TIPOS_COMPROBANTE.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label htmlFor="fecha_comprobante">Fecha del comprobante *</Label>
            <Input
              id="fecha_comprobante"
              type="date"
              {...register('fecha_comprobante')}
              aria-invalid={!!errors.fecha_comprobante}
            />
            {errors.fecha_comprobante && (
              <p className="text-xs text-red-600">{errors.fecha_comprobante.message}</p>
            )}
          </div>

          {/* Serie */}
          <div className="space-y-1.5">
            <Label htmlFor="serie">
              Serie <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="serie"
              placeholder="F001"
              maxLength={10}
              {...register('serie')}
            />
          </div>

          {/* Número */}
          <div className="space-y-1.5">
            <Label htmlFor="numero_doc">
              Número <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="numero_doc"
              placeholder="00001234"
              maxLength={20}
              {...register('numero_doc')}
            />
          </div>
        </div>
      </section>

      {/* ── Montos ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Montos</h3>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Subtotal / Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="subtotal">
              {tipoComprobante === 'factura' ? 'Subtotal sin IGV (S/)' :
               tipoComprobante === 'rxh' ? 'Monto bruto (S/)' :
               'Monto total (S/)'} *
            </Label>
            <Input
              id="subtotal"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={subtotalSoles}
              onChange={(e) => handleSubtotalChange(e.target.value)}
              className="font-mono"
              aria-invalid={!!errors.subtotal}
            />
            {errors.subtotal && (
              <p className="text-xs text-red-600">{errors.subtotal.message}</p>
            )}
          </div>

          {/* Estado de pago */}
          <div className="space-y-1.5">
            <Label htmlFor="estado_pago">Estado de pago</Label>
            <select
              id="estado_pago"
              {...register('estado_pago')}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            >
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

          {/* Fecha vencimiento */}
          <div className="space-y-1.5">
            <Label htmlFor="fecha_vencimiento_pago">
              Vencimiento de pago <span className="text-zinc-400">(opcional)</span>
            </Label>
            <Input
              id="fecha_vencimiento_pago"
              type="date"
              {...register('fecha_vencimiento_pago')}
            />
          </div>
        </div>

        {/* Detracción */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Controller
              name="aplica_detraccion"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="aplica_detraccion"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={tipoComprobante !== 'factura'}
                />
              )}
            />
            <div>
              <Label
                htmlFor="aplica_detraccion"
                className={tipoComprobante !== 'factura' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              >
                Aplica detracción SPOT
              </Label>
              {tipoComprobante !== 'factura' && (
                <p className="text-xs text-zinc-400">Solo aplica en facturas</p>
              )}
            </div>
          </div>

          {aplicaDetraccion && tipoComprobante === 'factura' && (
            <div className="pl-7 space-y-1.5">
              <Label htmlFor="pct_detraccion">Porcentaje de detracción (%)</Label>
              <div className="flex gap-2 flex-wrap">
                {[4, 9, 10, 12, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setValue('pct_detraccion', pct)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      pctDetraccion === pct
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-20"
                  {...register('pct_detraccion', { valueAsNumber: true })}
                />
              </div>
              {errors.pct_detraccion && (
                <p className="text-xs text-red-600">{errors.pct_detraccion.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Resumen de cálculo */}
        {(subtotal ?? 0) > 0 && (
          <div className="mt-5 rounded-md bg-zinc-50 border border-zinc-100 p-4">
            <p className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Resumen de montos
            </p>
            <dl className="space-y-1.5">
              {tipoComprobante === 'factura' && (
                <>
                  <div className="flex justify-between text-sm">
                    <dt className="text-zinc-500">Subtotal sin IGV</dt>
                    <dd className="font-mono tabular-nums">{formatMoney(calculo.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-zinc-500">IGV 18% (crédito fiscal)</dt>
                    <dd className="font-mono tabular-nums text-zinc-400">{formatMoney(calculo.igvCredito)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm font-medium border-t border-zinc-200 pt-1.5">
                <dt className="text-zinc-700">Total a pagar</dt>
                <dd className="font-mono tabular-nums">{formatMoney(calculo.total)}</dd>
              </div>
              {calculo.montoDetraccion > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <dt className="text-amber-700">Detracción {pctDetraccion}%</dt>
                    <dd className="font-mono tabular-nums text-amber-700">
                      −{formatMoney(calculo.montoDetraccion)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <dt className="text-zinc-900">Neto a pagar proveedor</dt>
                    <dd className="font-mono tabular-nums text-zinc-900">
                      {formatMoney(calculo.netoAPagar)}
                    </dd>
                  </div>
                </>
              )}
              {calculo.retencion4ta > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <dt className="text-amber-700">Retención 4ta cat. 8%</dt>
                    <dd className="font-mono tabular-nums text-amber-700">
                      −{formatMoney(calculo.retencion4ta)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <dt className="text-zinc-900">Neto a pagar</dt>
                    <dd className="font-mono tabular-nums text-zinc-900">
                      {formatMoney(calculo.netoAPagar)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        )}
      </section>

      {/* ── Adjunto ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">
          Comprobante adjunto{' '}
          <span className="font-normal text-zinc-400">(opcional)</span>
        </h3>

        {!adjunto ? (
          <div className="relative">
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleAdjuntoChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="adjunto"
            />
            <label
              htmlFor="adjunto"
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 px-6 py-8 text-center cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              <Upload size={20} className="text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-700">
                  Subir comprobante
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  JPEG, PNG o PDF · máximo 10 MB
                </p>
              </div>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <FileText size={16} className="text-zinc-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-700 truncate">{adjunto.name}</p>
              <p className="text-xs text-zinc-400">
                {(adjunto.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdjunto(null)}
              className="rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {adjuntoError && (
          <p className="mt-2 text-xs text-red-600">{adjuntoError}</p>
        )}
      </section>

      {/* ── Notas ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="space-y-1.5">
          <Label htmlFor="notas">
            Notas <span className="text-zinc-400">(opcional)</span>
          </Label>
          <textarea
            id="notas"
            rows={3}
            placeholder="Observaciones adicionales sobre este gasto…"
            {...register('notas')}
            className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1 resize-none"
          />
        </div>
      </section>

      {/* Acciones */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || uploadingAdjunto}>
          {(isSubmitting || uploadingAdjunto) && (
            <Loader2 size={15} className="mr-2 animate-spin" />
          )}
          {uploadingAdjunto ? 'Subiendo comprobante…' : gastoId ? 'Guardar cambios' : 'Registrar gasto'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/gastos')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
