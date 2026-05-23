import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/forms/login-form'

export const metadata: Metadata = {
  title: 'Iniciar sesión — Kivo',
  description: 'Accede a tu cuenta de Kivo',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Kivo</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Gestión financiera para agencias creativas
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-zinc-900">
            Iniciar sesión
          </h2>

          {/* Suspense necesario por useSearchParams en LoginForm */}
          <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-zinc-100" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          ¿Problemas para acceder? Contacta al administrador de tu organización.
        </p>
      </div>
    </div>
  )
}
