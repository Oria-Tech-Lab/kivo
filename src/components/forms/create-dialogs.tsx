'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Minimal local types to keep this component self-contained
export interface GastoProyectoOpt { id: string; nombre: string }
export interface GastoProveedorOpt { id: string; razon_social: string; nombre_comercial: string | null }
export interface ProyectoClienteOpt { id: string; nombre: string }

// ── Gasto Sheet ───────────────────────────────────────────────────────────────

type TipoComprobante = 'factura' | 'boleta' | 'rxh' | 'sin_comprobante'
type EstadoPago = 'pendiente' | 'pagado'

export function GastoSheet({ open, onClose, proyectos, proveedores }: {
  open: boolean; onClose: () => void
  proyectos: GastoProyectoOpt[]; proveedores: GastoProveedorOpt[]
}) {
  const todayStr = new Date().toISOString().split('T')[0]
  const emptyForm = {
    proyecto_id: '', proveedor_id: '', concepto: '', montoStr: '',
    tipo_comprobante: 'factura' as TipoComprobante,
    fecha_comprobante: todayStr,
    estado_pago: 'pendiente' as EstadoPago,
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setError(null)
    if (!form.proyecto_id)     return setError('Selecciona un proyecto')
    if (!form.proveedor_id)    return setError('Selecciona un proveedor')
    if (!form.concepto.trim()) return setError('Ingresa el concepto del gasto')
    const totalSoles = parseFloat(form.montoStr || '0')
    if (totalSoles <= 0) return setError('Ingresa un monto válido')

    const totalCentavos = Math.round(totalSoles * 100)
    const subtotal = form.tipo_comprobante === 'factura'
      ? Math.round(totalCentavos / 1.18)
      : totalCentavos

    setSaving(true)
    const r = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id:       form.proyecto_id,
        proveedor_id:      form.proveedor_id,
        concepto:          form.concepto,
        tipo_comprobante:  form.tipo_comprobante,
        subtotal,
        aplica_detraccion: false,
        pct_detraccion:    0,
        fecha_comprobante: form.fecha_comprobante,
        estado_pago:       form.estado_pago,
        notas:             '',
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json() as { error?: string }
      setError(j.error ?? 'Error al registrar el gasto')
    } else {
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setForm(emptyForm); onClose() }, 1500)
    }
  }

  const montoLabel = form.tipo_comprobante === 'factura' ? 'Total con IGV (S/)' : 'Monto (S/)'

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) { setError(null); setSuccess(false); onClose() } }}>
      <SheetContent side="right" className="w-[420px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-zinc-100">
          <SheetTitle>Registrar Gasto</SheetTitle>
        </SheetHeader>
        <div className="pt-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm font-medium text-zinc-900">Gasto registrado correctamente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Proyecto *</label>
                <select value={form.proyecto_id} onChange={e => setF('proyecto_id', e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                  <option value="">Seleccionar proyecto…</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Proveedor *</label>
                <select value={form.proveedor_id} onChange={e => setF('proveedor_id', e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                  <option value="">Seleccionar proveedor…</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre_comercial ?? p.razon_social}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Concepto *</label>
                <Input value={form.concepto} onChange={e => setF('concepto', e.target.value)} placeholder="Descripción del gasto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo comprobante</label>
                  <select value={form.tipo_comprobante} onChange={e => setF('tipo_comprobante', e.target.value as TipoComprobante)}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                    <option value="factura">Factura</option>
                    <option value="boleta">Boleta</option>
                    <option value="rxh">RxH</option>
                    <option value="sin_comprobante">Sin comprobante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{montoLabel}</label>
                  <Input type="number" min="0" step="0.01" value={form.montoStr} onChange={e => setF('montoStr', e.target.value)} placeholder="0.00" className="tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha comprobante</label>
                  <Input type="date" value={form.fecha_comprobante} onChange={e => setF('fecha_comprobante', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Estado de pago</label>
                  <select value={form.estado_pago} onChange={e => setF('estado_pago', e.target.value as EstadoPago)}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                  </select>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
                {saving ? 'Registrando…' : 'Registrar Gasto'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── New Project Dialog ────────────────────────────────────────────────────────

export function NuevoProyectoDialog({ open, onClose, clientes }: {
  open: boolean; onClose: () => void; clientes: ProyectoClienteOpt[]
}) {
  const router = useRouter()
  const todayStr = new Date().toISOString().split('T')[0]
  const emptyForm = {
    cliente_id: '', nombre: '', tipo: 'digital', estado: 'activo',
    fecha_inicio: todayStr, fecha_cierre_est: '', aplica_detraccion: false,
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function handleClose() { setError(null); setForm(emptyForm); onClose() }

  async function handleSave() {
    setError(null)
    if (!form.cliente_id) return setError('Selecciona un cliente')
    if (form.nombre.trim().length < 2) return setError('El nombre del proyecto es requerido (mínimo 2 caracteres)')
    setSaving(true)
    const r = await fetch('/api/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: form.cliente_id, nombre: form.nombre.trim(),
        tipo: form.tipo, estado: form.estado,
        fecha_inicio: form.fecha_inicio,
        fecha_cierre_est: form.fecha_cierre_est || undefined,
        aplica_detraccion: form.aplica_detraccion,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json() as { error?: string }
      setError(j.error ?? 'Error al crear el proyecto')
    } else {
      const j = await r.json() as { id: string }
      handleClose()
      router.push(`/proyectos/${j.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader><DialogTitle>Nuevo Proyecto</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Cliente *</label>
            <select value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
              <option value="">Seleccionar cliente…</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre del proyecto *</label>
            <Input value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Ej: Campaña Digital Q3" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setF('tipo', e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="digital">Digital</option>
                <option value="offline">Offline</option>
                <option value="evento">Evento</option>
                <option value="instalacion">Instalación</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Estado inicial</label>
              <select value={form.estado} onChange={e => setF('estado', e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="activo">Activo</option>
                <option value="en_pausa">En pausa</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de inicio *</label>
              <Input type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Cierre estimado</label>
              <Input type="date" value={form.fecha_cierre_est} onChange={e => setF('fecha_cierre_est', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input type="checkbox" checked={form.aplica_detraccion} onChange={e => setF('aplica_detraccion', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 accent-blue-600" />
            <span className="text-sm text-zinc-700">Aplica detracción</span>
          </label>
          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100">
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Creando…' : 'Crear Proyecto'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
