-- ============================================================
-- Kivo — Migración 004: nuevos campos en proyecto_items y proyectos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Seguro de re-ejecutar (ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ─── proyecto_items: nuevos campos ───────────────────────────

-- Cantidad y precio unitario (gasto_real = cantidad × precio_unitario)
ALTER TABLE proyecto_items
  ADD COLUMN IF NOT EXISTS cantidad         DECIMAL(10,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS precio_unitario  INTEGER       NOT NULL DEFAULT 0;

-- Estado de pago del ítem
ALTER TABLE proyecto_items
  ADD COLUMN IF NOT EXISTS estado_pago TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_pago IN ('pendiente', 'pagado', 'parcial'));

ALTER TABLE proyecto_items
  ADD COLUMN IF NOT EXISTS fecha_pago DATE;

-- URLs de documentos (Storage)
ALTER TABLE proyecto_items
  ADD COLUMN IF NOT EXISTS foto_url             TEXT,
  ADD COLUMN IF NOT EXISTS factura_url          TEXT,
  ADD COLUMN IF NOT EXISTS constancia_pago_url  TEXT;

-- Actualizar constraint de tipo_comprobante para incluir 'pendiente'
-- (primero lo eliminamos, luego lo recreamos con el nuevo valor)
ALTER TABLE proyecto_items
  DROP CONSTRAINT IF EXISTS proyecto_items_tipo_comprobante_check;

ALTER TABLE proyecto_items
  ADD CONSTRAINT proyecto_items_tipo_comprobante_check
    CHECK (tipo_comprobante IN ('factura', 'boleta', 'rxh', 'sin_comprobante', 'pendiente'));

-- Valor por defecto 'pendiente' para tipo_comprobante
ALTER TABLE proyecto_items
  ALTER COLUMN tipo_comprobante SET DEFAULT 'pendiente';

-- ─── proyectos: facturación al cliente ───────────────────────

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS subtotal_proyecto         INTEGER NOT NULL DEFAULT 0
    CHECK (subtotal_proyecto >= 0),
  ADD COLUMN IF NOT EXISTS aplica_igv_venta          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS aplica_detraccion_venta   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pct_detraccion_venta      INTEGER NOT NULL DEFAULT 0
    CHECK (pct_detraccion_venta BETWEEN 0 AND 100);
