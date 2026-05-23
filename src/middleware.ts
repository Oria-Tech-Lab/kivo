/**
 * Middleware de autenticación — Kivo
 *
 * Protege todas las rutas del dashboard.
 * Se implementa completamente en el Paso 2 (cliente Supabase + auth).
 *
 * Principio: nunca confiar en cookies del cliente; verificar sesión server-side.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Placeholder — se reemplaza con verificación real de Supabase en Paso 2
  // El patrón final usará createServerClient de @supabase/ssr
  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren autenticación
  const publicPaths = ["/login", "/invite"];
  const isPublic = publicPaths.some((path) => pathname.startsWith(path));

  if (isPublic) {
    return NextResponse.next();
  }

  // En Paso 2: verificar sesión con Supabase y redirigir si no hay sesión
  // Por ahora: permitir acceso para desarrollo
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplicar middleware a todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - archivos de public/
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
