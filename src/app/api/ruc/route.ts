import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { apiRateLimit } from '@/lib/rate-limit'

export interface RucData {
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  tipo: 'persona_natural' | 'persona_juridica'
  estado: string
  condicion: string
  actividad: string | null
}

/**
 * GET /api/ruc?numero=20123456789
 * Consulta datos de RUC vía apiperu.dev.
 * Requiere autenticación.
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const rl = await apiRateLimit(auth.userId)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit excedido' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const numero = searchParams.get('numero')?.trim()

  if (!numero || !/^\d{11}$/.test(numero)) {
    return NextResponse.json({ error: 'RUC inválido — debe tener 11 dígitos' }, { status: 400 })
  }

  const apiKey = process.env.APIPERU_API_KEY

  // Sin API key: modo desarrollo, devolver datos de prueba
  if (!apiKey) {
    console.warn('[ruc] APIPERU_API_KEY no configurada — devolviendo datos mock')
    const isMock20 = numero.startsWith('20')
    return NextResponse.json({
      ruc: numero,
      razon_social: `EMPRESA DEMO S.A.C. (${numero})`,
      nombre_comercial: null,
      tipo: isMock20 ? 'persona_juridica' : 'persona_natural',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      actividad: 'Actividades de consultoría de gestión',
    } satisfies RucData)
  }

  try {
    const response = await fetch(
      `https://api.apiperu.dev/api/ruc/${numero}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        // Timeout de 8 segundos
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'RUC no encontrado en SUNAT' }, { status: 404 })
      }
      throw new Error(`apiperu.dev respondió con ${response.status}`)
    }

    const raw = await response.json() as {
      success: boolean
      data?: {
        ruc?: string
        razon_social?: string
        nombre_comercial?: string
        tipo_contribuyente?: string
        condicion?: string
        estado?: string
        actividad_economica?: string
      }
    }

    if (!raw.success || !raw.data) {
      return NextResponse.json({ error: 'RUC no encontrado' }, { status: 404 })
    }

    const d = raw.data

    // Determinar tipo basado en tipo_contribuyente o prefijo del RUC
    const tipoRaw = d.tipo_contribuyente?.toLowerCase() ?? ''
    const tipo: RucData['tipo'] = tipoRaw.includes('natural')
      ? 'persona_natural'
      : tipoRaw.includes('jurid')
      ? 'persona_juridica'
      : numero.startsWith('10')
      ? 'persona_natural'
      : 'persona_juridica'

    const result: RucData = {
      ruc: d.ruc ?? numero,
      razon_social: d.razon_social ?? '',
      nombre_comercial: d.nombre_comercial ?? null,
      tipo,
      estado: d.estado ?? '',
      condicion: d.condicion ?? '',
      actividad: d.actividad_economica ?? null,
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Tiempo de espera agotado consultando SUNAT' },
        { status: 504 }
      )
    }
    console.error('[ruc] Error:', error)
    return NextResponse.json(
      { error: 'Error consultando SUNAT. Intenta de nuevo.' },
      { status: 502 }
    )
  }
}
