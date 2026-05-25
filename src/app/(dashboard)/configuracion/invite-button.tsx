'use client'

import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Rol = 'admin' | 'pm' | 'viewer'

export function InviteButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('pm')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, rol }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Error al enviar la invitación')
      } else {
        setSuccess(data.message ?? `Invitación enviada a ${email}`)
        setEmail('')
        setRol('pm')
      }
    } catch {
      setError('Error de red. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <UserPlus size={14} />
        Invitar
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <button
              onClick={() => { setOpen(false); setError(''); setSuccess('') }}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-semibold text-zinc-900 mb-4">
              Invitar nuevo miembro
            </h3>

            {success ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
                {success}
                <button
                  onClick={() => { setOpen(false); setSuccess('') }}
                  className="mt-3 block text-xs font-medium text-emerald-800 underline"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 placeholder:text-zinc-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Rol
                  </label>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value as Rol)}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
                  >
                    <option value="admin">Administrador — acceso total</option>
                    <option value="pm">Project Manager — crear y gestionar</option>
                    <option value="viewer">Visualizador — solo lectura</option>
                  </select>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setOpen(false); setError('') }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? 'Enviando…' : 'Enviar invitación'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
