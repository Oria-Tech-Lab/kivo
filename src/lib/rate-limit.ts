/**
 * Rate limiting con Upstash Redis — Kivo
 *
 * Protege endpoints críticos de abuso.
 * Requiere UPSTASH_REDIS_URL y UPSTASH_REDIS_TOKEN en .env.local
 *
 * Si las variables no están configuradas (desarrollo sin Redis),
 * las funciones retornan success: true para no bloquear el desarrollo.
 */

/**
 * Resultado del rate limit check
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // timestamp en ms
}

/**
 * Verifica el rate limit para un identificador dado.
 * Importación dinámica para evitar errores si Redis no está configurado.
 */
async function checkRateLimit(
  prefix: string,
  identifier: string,
  requests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Si no hay Redis configurado, permitir (modo desarrollo)
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
    console.warn('[Kivo] Rate limiting deshabilitado: configura UPSTASH_REDIS_URL y UPSTASH_REDIS_TOKEN')
    return { success: true, limit: requests, remaining: requests, reset: Date.now() + windowSeconds * 1000 }
  }

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis } = await import('@upstash/redis')

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })

    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
      prefix: `rl:${prefix}`,
    })

    const result = await limiter.limit(identifier)
    return result
  } catch (error) {
    // Si Redis falla, permitir la request (fail open para no bloquear usuarios legítimos)
    // En producción considera fail closed para endpoints más sensibles
    console.error('[Kivo] Error en rate limiting:', error)
    return { success: true, limit: requests, remaining: 0, reset: Date.now() }
  }
}

/**
 * Rate limit para autenticación: 5 intentos por IP en 15 minutos
 */
export async function authRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit('auth', ip, 5, 15 * 60)
}

/**
 * Rate limit para upload de archivos: 20 por usuario por hora
 */
export async function uploadRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit('upload', userId, 20, 60 * 60)
}

/**
 * Rate limit para API general: 100 requests por minuto por usuario
 */
export async function apiRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit('api', userId, 100, 60)
}

/**
 * Rate limit para exportaciones: 10 reportes por hora por usuario
 */
export async function exportRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit('export', userId, 10, 60 * 60)
}

/**
 * Obtiene la IP real del request considerando proxies (Vercel, Cloudflare).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}
