'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { acceptInviteSchema, type AcceptInviteInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AcceptInviteFormProps {
  email: string
}

export function AcceptInviteForm({ email }: AcceptInviteFormProps) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
  })

  const password = watch('password', '')

  // Indicador de fortaleza de contraseña
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const strengthScore = strength.filter(Boolean).length

  const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
  const strengthColors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']

  async function onSubmit(data: AcceptInviteInput) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    })

    if (error) {
      setServerError('Error activando la cuenta. El enlace puede haber expirado.')
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/inicio')
      router.refresh()
    }, 1500)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <CheckCircle2 size={40} className="text-green-500" />
        <p className="text-sm text-zinc-600">
          Cuenta activada. Redirigiendo…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Email (solo display) */}
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={email} disabled className="bg-zinc-50 text-zinc-500" />
      </div>

      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* Nueva contraseña */}
      <div className="space-y-1.5">
        <Label htmlFor="password">Nueva contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            className="pr-10"
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {/* Barra de fortaleza */}
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= strengthScore ? strengthColors[strengthScore] : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              Contraseña {strengthLabels[strengthScore]}
            </p>
          </div>
        )}
        {errors.password && (
          <p className="text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      {/* Confirmar contraseña */}
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            className="pr-10"
            {...register('confirmPassword')}
            aria-invalid={!!errors.confirmPassword}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label={showConfirm ? 'Ocultar' : 'Mostrar'}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Activando cuenta…
          </>
        ) : (
          'Activar cuenta'
        )}
      </Button>
    </form>
  )
}
