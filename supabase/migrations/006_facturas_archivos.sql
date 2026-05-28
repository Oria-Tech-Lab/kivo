-- 006: facturas_archivos
-- Añade columna 'archivos' a facturas_proyecto para adjuntos en Storage.
-- Formato: [{path, name, size, uploaded_at}]

ALTER TABLE facturas_proyecto
  ADD COLUMN IF NOT EXISTS archivos JSONB NOT NULL DEFAULT '[]';
