-- ============================================================
-- Kivo — Migración 002: Actualización de proveedores
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Hacer ruc nullable (persona natural puede no tener RUC)
ALTER TABLE proveedores ALTER COLUMN ruc DROP NOT NULL;

-- Agregar tipo_documento y numero_documento para persona natural
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20)
    CHECK (tipo_documento IN ('dni', 'ce', 'pasaporte', 'ruc'));

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(20);

-- Actualizar constraint único: solo aplica cuando ruc NO es null
ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS proveedores_org_id_ruc_key;

CREATE UNIQUE INDEX IF NOT EXISTS proveedores_org_id_ruc_unique
  ON proveedores (org_id, ruc)
  WHERE ruc IS NOT NULL AND ruc != '';
