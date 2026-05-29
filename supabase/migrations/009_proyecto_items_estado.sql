-- 009: proyecto_items — campo estado de ítem (workflow manual)
ALTER TABLE proyecto_items ADD COLUMN IF NOT EXISTS
  estado TEXT CHECK (estado IN ('presupuestado', 'en_ejecucion', 'ejecutado', 'cancelado'))
  DEFAULT 'presupuestado';
