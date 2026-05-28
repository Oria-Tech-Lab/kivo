-- 007: factura_historial
-- Tabla de auditoría de cambios de estado en facturas_proyecto.
-- El trigger log_factura_estado_change registra automáticamente cada transición.

CREATE TABLE IF NOT EXISTS factura_historial (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id      UUID        NOT NULL REFERENCES facturas_proyecto(id) ON DELETE CASCADE,
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  usuario_id      UUID        REFERENCES auth.users(id),
  estado_anterior TEXT,
  estado_nuevo    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE factura_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura_historial FORCE ROW LEVEL SECURITY;

CREATE POLICY "factura_historial_select" ON factura_historial
  FOR SELECT TO authenticated USING (org_id = get_user_org_id());

CREATE POLICY "factura_historial_insert" ON factura_historial
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id());

-- Trigger que registra cambios de estado automáticamente
CREATE OR REPLACE FUNCTION log_factura_estado_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO factura_historial (factura_id, org_id, usuario_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, NEW.org_id, auth.uid(), OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factura_historial ON facturas_proyecto;
CREATE TRIGGER trg_factura_historial
  AFTER UPDATE ON facturas_proyecto
  FOR EACH ROW EXECUTE FUNCTION log_factura_estado_change();
