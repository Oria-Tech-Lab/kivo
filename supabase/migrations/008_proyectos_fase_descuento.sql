-- 008: proyectos — fase de workflow, subtotal_manual y descuento en facturación
-- Todas las columnas usan IF NOT EXISTS + DEFAULT → seguras para filas existentes.

-- Fase del proyecto (flujo de trabajo)
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS
  fase TEXT CHECK (fase IN ('cotizacion','aprobado','ejecucion','finalizado'))
  DEFAULT 'cotizacion';

-- Subtotal manual vs sincronizado desde ítems
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS
  subtotal_manual BOOLEAN DEFAULT false;

-- Descuento en facturación
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS
  descuento_tipo TEXT CHECK (descuento_tipo IN ('pct','fijo')) DEFAULT 'pct';

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS
  descuento_valor INTEGER DEFAULT 0;
