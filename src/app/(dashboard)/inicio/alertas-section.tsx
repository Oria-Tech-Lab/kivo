'use client'

import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'

type Alerta = {
  id: string
  nivel: string
  mensaje: string
  tipo: string
}

const nivelColor: Record<string, string> = {
  critico:     'border-red-200 bg-red-50 text-red-700',
  advertencia: 'border-amber-200 bg-amber-50 text-amber-700',
  informativo: 'border-blue-200 bg-blue-50 text-blue-700',
}

const nivelBadge: Record<string, string> = {
  critico:     'bg-red-100 text-red-700',
  advertencia: 'bg-amber-100 text-amber-700',
  informativo: 'bg-blue-100 text-blue-700',
}

export function AlertasSection({ alertasIniciales }: { alertasIniciales: Alerta[] }) {
  const [alertas, setAlertas] = useState<Alerta[]>(alertasIniciales)

  async function resolver(id: string) {
    // Optimistic update
    setAlertas((prev) => prev.filter((a) => a.id !== id))

    const res = await fetch(`/api/alertas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resuelto: true }),
    })

    if (!res.ok) {
      // Revert on failure
      setAlertas(alertasIniciales)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">
        Alertas pendientes
        {alertas.length > 0 && (
          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {alertas.length}
          </span>
        )}
      </h2>

      {alertas.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <CheckCircle2 size={16} className="text-emerald-400" />
          No hay alertas activas. ¡Todo en orden!
        </div>
      ) : (
        <ul className="space-y-2">
          {alertas.map((alerta) => (
            <li
              key={alerta.id}
              className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm ${nivelColor[alerta.nivel] ?? ''}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${nivelBadge[alerta.nivel] ?? ''}`}
                >
                  {alerta.nivel}
                </span>
                <span className="leading-snug">{alerta.mensaje}</span>
              </div>
              <button
                onClick={() => resolver(alerta.id)}
                title="Marcar como resuelta"
                className="shrink-0 mt-0.5 rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
