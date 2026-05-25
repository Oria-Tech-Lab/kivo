-- ============================================================
-- Kivo — Migración 003: proyecto_items (tabla unificada)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS proyecto_items (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id       UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  concepto          TEXT        NOT NULL DEFAULT '',
  unidad            TEXT        NOT NULL DEFAULT 'global'
                                CHECK (unidad IN ('unid', 'hora', 'global', 'm2', 'kg', 'dia', 'otro')),
  proveedor_id      UUID        REFERENCES proveedores(id) ON DELETE SET NULL,
  costo_estimado    INTEGER     NOT NULL DEFAULT 0 CHECK (costo_estimado >= 0),
  precio_venta      INTEGER     NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  gasto_real        INTEGER     NOT NULL DEFAULT 0 CHECK (gasto_real >= 0),
  tipo_comprobante  TEXT        CHECK (tipo_comprobante IN ('factura', 'boleta', 'rxh', 'sin_comprobante')),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proyecto_items_proyecto_id ON proyecto_items(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_items_org_id ON proyecto_items(org_id);

CREATE TRIGGER trg_proyecto_items_updated_at
  BEFORE UPDATE ON proyecto_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE proyecto_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_items FORCE ROW LEVEL SECURITY;

CREATE POLICY "proyecto_items_select"
  ON proyecto_items FOR SELECT TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "proyecto_items_insert_admin_pm"
  ON proyecto_items FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "proyecto_items_update_admin_pm"
  ON proyecto_items FOR UPDATE TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "proyecto_items_delete_admin"
  ON proyecto_items FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');
