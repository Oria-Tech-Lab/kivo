# Kivo — Guía para Claude Code

## Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript estricto + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Emails:** Resend + React Email
- **Rate limiting:** Upstash Redis
- **Deploy:** Vercel

## Convenciones críticas

### Montos
- **SIEMPRE en centavos (INTEGER)** — nunca FLOAT
- `solesToCentavos(n)` para convertir input del usuario
- `formatMoney(centavos)` para display

### Fechas
- **Almacenar en UTC** internamente
- **Mostrar en Lima** (America/Lima, UTC-5) con `formatDate()`

### Seguridad — NUNCA violar
1. `SUPABASE_SERVICE_ROLE_KEY` solo server-side (Route Handlers, Edge Functions)
2. Usar `supabase.auth.getUser()` para verificar auth, nunca `getSession()` en el servidor
3. RLS habilitado en TODAS las tablas antes del primer INSERT
4. Validación con Zod en todos los endpoints
5. UUIDs como PKs (nunca IDs secuenciales)
6. Storage: bucket privado, validar por magic bytes, nombres UUID

### Componentes
- Server Components por defecto
- `'use client'` solo cuando sea necesario (formularios, estado, efectos)
- Layouts por sección: `(auth)/` y `(dashboard)/`

## Estructura de carpetas

```
src/
├── app/
│   ├── (auth)/          # login, invite/[token]
│   ├── (dashboard)/     # inicio, proyectos, clientes, proveedores, etc.
│   └── api/             # Route Handlers (server-only)
├── components/
│   ├── ui/              # shadcn/ui base
│   ├── forms/           # formularios con React Hook Form + Zod
│   ├── charts/          # gráficos de flujo y márgenes
│   ├── alerts/          # componente de alertas
│   └── layout/          # sidebar, header, nav
├── lib/
│   ├── supabase/        # clientes (server, client, middleware)
│   ├── calculations/    # IGV, detracción, margen (tributarios.ts)
│   ├── emails/          # templates React Email
│   ├── validations/     # schemas Zod + validación de uploads
│   └── utils/           # cn(), formatMoney(), formatDate(), etc.
├── types/
│   └── database.ts      # tipos del schema Supabase
└── hooks/               # custom hooks (use client)

supabase/
├── migrations/          # SQL del schema con RLS
├── functions/           # Edge Functions (Deno)
│   ├── calcular-gasto/
│   ├── calcular-margen/
│   ├── calcular-posicion-igv/
│   ├── alertas-diarias/
│   └── lookup-ruc/
└── seed/                # datos de prueba
```

## Lógica tributaria peruana

```typescript
// IGV (solo facturas)
igv = subtotal * 0.18
total = subtotal + igv

// Detracción (sobre total con IGV)
detraccion = total * (pct_detraccion / 100)
neto_a_pagar = total - detraccion

// Retención 4ta categoría (solo RxH)
retencion = monto_bruto * 0.08
neto_a_pagar = monto_bruto - retencion

// Fecha límite SPOT = 5to día hábil del mes siguiente
```

Ver: `src/lib/calculations/tributarios.ts`

## Fases de construcción

1. ✅ Setup Next.js 14 + TypeScript + Tailwind + shadcn/ui
2. ⬜ Cliente Supabase + middleware de auth
3. ⬜ Schema SQL con RLS
4. ⬜ Auth: login, middleware, invitación por email
5. ⬜ M5: Catálogo de proveedores
6. ⬜ M1: Clientes y proyectos
7. ⬜ M2: Presupuestos y líneas
8. ⬜ M3: Registro de gastos con upload
9. ⬜ Pantalla de inicio con alertas

## Variables de entorno

Ver `.env.local.example` para la lista completa.
**Regla:** ninguna `NEXT_PUBLIC_*` puede contener secrets.
