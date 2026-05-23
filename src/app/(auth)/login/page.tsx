import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

/**
 * Página de login — Paso 4 (Auth)
 * El formulario completo se implementa en el paso de Auth con Supabase.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Kivo</h1>
          <p className="text-sm text-muted-foreground">
            Gestión financiera de proyectos
          </p>
        </div>
        {/* LoginForm se agrega en Paso 4 — Auth */}
        <p className="text-center text-sm text-muted-foreground">
          Configurando autenticación...
        </p>
      </div>
    </div>
  );
}
