-- ============================================================
-- Kivo — Script combinado SEGURO (idempotente)
-- Incluye migraciones 001 + 002 + 003
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Seguro de re-ejecutar: usa IF NOT EXISTS en todo.
-- ============================================================

-- ─── EXTENSIONES ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── FUNCIONES HELPER ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id FROM organization_users WHERE user_id = auth.uid() LIMIT 1;
  RETURN v_org_id;
END; $$;

CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE v_rol TEXT;
BEGIN
  SELECT rol INTO v_rol FROM organization_users WHERE user_id = auth.uid() LIMIT 1;
  RETURN v_rol;
END; $$;

-- ─── TABLAS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT        NOT NULL,
  ruc        VARCHAR(11) NOT NULL UNIQUE,
  plan       TEXT        NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_users (
  org_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol     TEXT NOT NULL CHECK (rol IN ('admin', 'pm', 'viewer')),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS categorias (
  id     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo   TEXT CHECK (tipo IN ('digital', 'offline', 'evento', 'instalacion', 'otro')),
  color  VARCHAR(7)
);

CREATE TABLE IF NOT EXISTS clientes (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre            TEXT        NOT NULL,
  ruc               VARCHAR(11),
  contacto_nombre   TEXT,
  contacto_email    TEXT,
  contacto_telefono VARCHAR(20),
  estado            TEXT        NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS proyectos (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cliente_id        UUID    NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  nombre            TEXT    NOT NULL,
  tipo              TEXT    NOT NULL CHECK (tipo IN ('digital', 'offline', 'evento', 'instalacion', 'otro')),
  categoria_id      UUID    REFERENCES categorias(id) ON DELETE SET NULL,
  estado            TEXT    NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'en_pausa', 'cerrado')),
  responsable_id    UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_inicio      DATE    NOT NULL,
  fecha_cierre_est  DATE,
  aplica_detraccion BOOLEAN NOT NULL DEFAULT false,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Migración 002: columnas extras en proveedores (incluidas desde el inicio)
CREATE TABLE IF NOT EXISTS proveedores (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ruc               VARCHAR(11),  -- nullable (migración 002)
  razon_social      TEXT        NOT NULL,
  nombre_comercial  TEXT,
  tipo              TEXT        NOT NULL CHECK (tipo IN ('persona_natural', 'persona_juridica')),
  actividad         TEXT,
  aplica_detraccion BOOLEAN     NOT NULL DEFAULT false,
  pct_detraccion    INTEGER     NOT NULL DEFAULT 0 CHECK (pct_detraccion BETWEEN 0 AND 100),
  condicion_pago    TEXT,
  cuenta_banco_enc  BYTEA,
  cuenta_spot_enc   BYTEA,
  email             TEXT,
  notas             TEXT,
  tipo_documento    VARCHAR(20) CHECK (tipo_documento IN ('dni', 'ce', 'pasaporte', 'ruc')),
  numero_documento  VARCHAR(20),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Unique index parcial: RUC único solo cuando no es NULL
CREATE UNIQUE INDEX IF NOT EXISTS proveedores_org_id_ruc_unique
  ON proveedores (org_id, ruc) WHERE ruc IS NOT NULL AND ruc != '';

CREATE TABLE IF NOT EXISTS presupuestos (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id      UUID    NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  org_id           UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version          INTEGER NOT NULL DEFAULT 1,
  estado           TEXT    NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobado', 'rechazado')),
  condicion_pago   TEXT    NOT NULL CHECK (condicion_pago IN ('contado', '30d', '45d', 'hitos')),
  fecha_aprobacion DATE,
  subtotal         INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  igv_total        INTEGER NOT NULL DEFAULT 0 CHECK (igv_total >= 0),
  total            INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS lineas_presupuesto (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  presupuesto_id UUID          NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  concepto       TEXT          NOT NULL,
  subtotal       INTEGER       NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  igv            INTEGER       NOT NULL DEFAULT 0 CHECK (igv >= 0),
  total          INTEGER       NOT NULL DEFAULT 0 CHECK (total >= 0),
  pct_fee        NUMERIC(5,2)
);

CREATE TABLE IF NOT EXISTS gastos (
  id                        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id               UUID    NOT NULL REFERENCES proyectos(id) ON DELETE RESTRICT,
  org_id                    UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linea_presupuesto_id      UUID    REFERENCES lineas_presupuesto(id) ON DELETE SET NULL,
  proveedor_id              UUID    NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  concepto                  TEXT    NOT NULL,
  tipo_comprobante          TEXT    NOT NULL CHECK (tipo_comprobante IN ('factura', 'boleta', 'rxh', 'sin_comprobante')),
  serie                     VARCHAR(10),
  numero_doc                VARCHAR(20),
  subtotal                  INTEGER NOT NULL CHECK (subtotal >= 0),
  igv                       INTEGER NOT NULL DEFAULT 0 CHECK (igv >= 0),
  total                     INTEGER NOT NULL CHECK (total >= 0),
  aplica_detraccion         BOOLEAN NOT NULL DEFAULT false,
  pct_detraccion            INTEGER NOT NULL DEFAULT 0,
  monto_detraccion          INTEGER NOT NULL DEFAULT 0 CHECK (monto_detraccion >= 0),
  neto_a_pagar              INTEGER NOT NULL CHECK (neto_a_pagar >= 0),
  retencion_4ta             INTEGER NOT NULL DEFAULT 0 CHECK (retencion_4ta >= 0),
  adjunto_url               TEXT,
  fecha_comprobante         DATE    NOT NULL,
  fecha_vencimiento_pago    DATE,
  estado_pago               TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado')),
  fecha_pago_real           DATE,
  estado_detraccion         TEXT    NOT NULL DEFAULT 'no_aplica' CHECK (estado_detraccion IN ('pendiente', 'depositada', 'no_aplica')),
  fecha_deposito_detraccion DATE,
  notas                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS gastos_generales (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proveedor_id     UUID          REFERENCES proveedores(id) ON DELETE SET NULL,
  concepto         TEXT          NOT NULL,
  tipo_recurrencia TEXT          NOT NULL CHECK (tipo_recurrencia IN ('mensual', 'puntual')),
  monto            INTEGER       NOT NULL CHECK (monto >= 0),
  periodo_mes      INTEGER       CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_anio     INTEGER,
  tipo_comprobante TEXT          CHECK (tipo_comprobante IN ('factura', 'boleta', 'rxh', 'sin_comprobante')),
  igv              INTEGER       NOT NULL DEFAULT 0,
  total            INTEGER       NOT NULL CHECK (total >= 0),
  adjunto_url      TEXT,
  umbral_proyectos INTEGER       NOT NULL DEFAULT 1 CHECK (umbral_proyectos >= 1),
  estado           TEXT          NOT NULL DEFAULT 'pendiente_asignacion'
                                 CHECK (estado IN ('pendiente_asignacion', 'cubierto_parcial', 'cubierto', 'generando_ganancia')),
  created_at       TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS asignaciones_gg (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  gasto_general_id UUID          NOT NULL REFERENCES gastos_generales(id) ON DELETE CASCADE,
  proyecto_id      UUID          NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  monto            INTEGER       NOT NULL CHECK (monto >= 0),
  pct              NUMERIC(5,2),
  fecha            DATE          NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (gasto_general_id, proyecto_id)
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tipo         TEXT        NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'detraccion', 'retencion')),
  origen_tabla TEXT        NOT NULL,
  origen_id    UUID        NOT NULL,
  proyecto_id  UUID        REFERENCES proyectos(id) ON DELETE SET NULL,
  cliente_id   UUID        REFERENCES clientes(id) ON DELETE SET NULL,
  proveedor_id UUID        REFERENCES proveedores(id) ON DELETE SET NULL,
  concepto     TEXT        NOT NULL,
  monto        INTEGER     NOT NULL CHECK (monto >= 0),
  fecha_esperada DATE      NOT NULL,
  fecha_real   DATE,
  estado       TEXT        NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'realizado', 'vencido')),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS alertas (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tipo             TEXT        NOT NULL CHECK (tipo IN (
                                 'factura_proveedor_pendiente', 'detraccion_vencida',
                                 'detraccion_proxima', 'factura_cobro_vencida',
                                 'proyecto_sin_margen', 'pago_proximo_proveedor',
                                 'proyecto_margen_riesgo', 'semana_caja_negativa',
                                 'gasto_general_cubierto'
                               )),
  nivel            TEXT        NOT NULL CHECK (nivel IN ('critico', 'advertencia', 'informativo')),
  referencia_tabla TEXT,
  referencia_id    UUID,
  mensaje          TEXT        NOT NULL,
  fecha_generada   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  fecha_visto      TIMESTAMPTZ,
  resuelto         BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id),
  tabla       TEXT        NOT NULL,
  registro_id UUID        NOT NULL,
  accion      TEXT        NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  datos_antes JSONB,
  datos_des   JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Migración 003 — proyecto_items
CREATE TABLE IF NOT EXISTS proyecto_items (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id      UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  concepto         TEXT        NOT NULL DEFAULT '',
  unidad           TEXT        NOT NULL DEFAULT 'global'
                               CHECK (unidad IN ('unid', 'hora', 'global', 'm2', 'kg', 'dia', 'otro')),
  proveedor_id     UUID        REFERENCES proveedores(id) ON DELETE SET NULL,
  costo_estimado   INTEGER     NOT NULL DEFAULT 0 CHECK (costo_estimado >= 0),
  precio_venta     INTEGER     NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  gasto_real       INTEGER     NOT NULL DEFAULT 0 CHECK (gasto_real >= 0),
  tipo_comprobante TEXT        CHECK (tipo_comprobante IN ('factura', 'boleta', 'rxh', 'sin_comprobante')),
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── ÍNDICES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_users_user_id       ON organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org_id         ON clientes(org_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_org_id        ON proyectos(org_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id    ON proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_estado        ON proyectos(estado);
CREATE INDEX IF NOT EXISTS idx_proyectos_responsable   ON proyectos(responsable_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_org_id      ON proveedores(org_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_proyecto   ON presupuestos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_org_id     ON presupuestos(org_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado     ON presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_lineas_presupuesto_id   ON lineas_presupuesto(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_proyecto_id      ON gastos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_org_id           ON gastos(org_id);
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor_id     ON gastos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_gastos_estado_pago      ON gastos(estado_pago);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha_vto_pago   ON gastos(fecha_vencimiento_pago);
CREATE INDEX IF NOT EXISTS idx_gastos_tipo_comprobante ON gastos(tipo_comprobante);
CREATE INDEX IF NOT EXISTS idx_gastos_estado_detraccion ON gastos(estado_detraccion);
CREATE INDEX IF NOT EXISTS idx_gg_org_id               ON gastos_generales(org_id);
CREATE INDEX IF NOT EXISTS idx_aagg_proyecto_id        ON asignaciones_gg(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_mc_org_id               ON movimientos_caja(org_id);
CREATE INDEX IF NOT EXISTS idx_mc_fecha_esperada       ON movimientos_caja(fecha_esperada);
CREATE INDEX IF NOT EXISTS idx_mc_estado               ON movimientos_caja(estado);
CREATE INDEX IF NOT EXISTS idx_mc_proyecto_id          ON movimientos_caja(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_mc_origen               ON movimientos_caja(origen_tabla, origen_id);
CREATE INDEX IF NOT EXISTS idx_alertas_org_id          ON alertas(org_id);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelto        ON alertas(resuelto);
CREATE INDEX IF NOT EXISTS idx_alertas_nivel           ON alertas(nivel);
CREATE INDEX IF NOT EXISTS idx_audit_org_id            ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabla             ON audit_log(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_items_proyecto_id ON proyecto_items(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_items_org_id   ON proyecto_items(org_id);

-- ─── TRIGGERS updated_at (DROP IF EXISTS para idempotencia) ──
DROP TRIGGER IF EXISTS trg_clientes_updated_at       ON clientes;
DROP TRIGGER IF EXISTS trg_proyectos_updated_at      ON proyectos;
DROP TRIGGER IF EXISTS trg_proveedores_updated_at    ON proveedores;
DROP TRIGGER IF EXISTS trg_presupuestos_updated_at   ON presupuestos;
DROP TRIGGER IF EXISTS trg_gastos_updated_at         ON gastos;
DROP TRIGGER IF EXISTS trg_gastos_generales_updated_at ON gastos_generales;
DROP TRIGGER IF EXISTS trg_proyecto_items_updated_at ON proyecto_items;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_proyectos_updated_at
  BEFORE UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON proveedores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_gastos_updated_at
  BEFORE UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_gastos_generales_updated_at
  BEFORE UPDATE ON gastos_generales FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_proyecto_items_updated_at
  BEFORE UPDATE ON proyecto_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── TRIGGER — Movimientos de caja desde gastos ───────────────
CREATE OR REPLACE FUNCTION create_movimientos_from_gasto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_proveedor_nombre TEXT;
BEGIN
  SELECT COALESCE(nombre_comercial, razon_social) INTO v_proveedor_nombre
    FROM proveedores WHERE id = NEW.proveedor_id;

  INSERT INTO movimientos_caja (org_id, tipo, origen_tabla, origen_id, proyecto_id, proveedor_id, concepto, monto, fecha_esperada, estado)
  VALUES (NEW.org_id, 'egreso', 'gastos', NEW.id, NEW.proyecto_id, NEW.proveedor_id,
    v_proveedor_nombre || ' — ' || NEW.concepto, NEW.neto_a_pagar,
    COALESCE(NEW.fecha_vencimiento_pago, NEW.fecha_comprobante), 'pendiente');

  IF NEW.aplica_detraccion AND NEW.monto_detraccion > 0 THEN
    INSERT INTO movimientos_caja (org_id, tipo, origen_tabla, origen_id, proyecto_id, proveedor_id, concepto, monto, fecha_esperada, estado)
    VALUES (NEW.org_id, 'detraccion', 'gastos', NEW.id, NEW.proyecto_id, NEW.proveedor_id,
      'Detracción SPOT — ' || v_proveedor_nombre, NEW.monto_detraccion,
      (DATE_TRUNC('month', NEW.fecha_comprobante) + INTERVAL '1 month' + INTERVAL '4 days')::DATE, 'pendiente');
  END IF;

  IF NEW.tipo_comprobante = 'rxh' AND NEW.retencion_4ta > 0 THEN
    INSERT INTO movimientos_caja (org_id, tipo, origen_tabla, origen_id, proyecto_id, proveedor_id, concepto, monto, fecha_esperada, estado)
    VALUES (NEW.org_id, 'retencion', 'gastos', NEW.id, NEW.proyecto_id, NEW.proveedor_id,
      'Retención 4ta Cat. — ' || v_proveedor_nombre, NEW.retencion_4ta,
      (DATE_TRUNC('month', NEW.fecha_comprobante) + INTERVAL '1 month' + INTERVAL '11 days')::DATE, 'pendiente');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gasto_create_movimientos ON gastos;
CREATE TRIGGER trg_gasto_create_movimientos
  AFTER INSERT ON gastos FOR EACH ROW EXECUTE FUNCTION create_movimientos_from_gasto();

-- ─── TRIGGER — Ingreso desde presupuesto aprobado ─────────────
CREATE OR REPLACE FUNCTION create_ingreso_from_presupuesto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_cliente_id UUID; v_proyecto_nombre TEXT; v_fecha_vencimiento DATE;
BEGIN
  IF OLD.estado = 'aprobado' OR NEW.estado != 'aprobado' THEN RETURN NEW; END IF;
  SELECT p.cliente_id, p.nombre INTO v_cliente_id, v_proyecto_nombre FROM proyectos p WHERE p.id = NEW.proyecto_id;
  v_fecha_vencimiento := CASE NEW.condicion_pago
    WHEN 'contado' THEN COALESCE(NEW.fecha_aprobacion, CURRENT_DATE)
    WHEN '30d'     THEN COALESCE(NEW.fecha_aprobacion, CURRENT_DATE) + INTERVAL '30 days'
    WHEN '45d'     THEN COALESCE(NEW.fecha_aprobacion, CURRENT_DATE) + INTERVAL '45 days'
    ELSE COALESCE(NEW.fecha_aprobacion, CURRENT_DATE) + INTERVAL '30 days'
  END;
  INSERT INTO movimientos_caja (org_id, tipo, origen_tabla, origen_id, proyecto_id, cliente_id, concepto, monto, fecha_esperada, estado)
  VALUES (NEW.org_id, 'ingreso', 'presupuestos', NEW.id, NEW.proyecto_id, v_cliente_id,
    'Factura — ' || v_proyecto_nombre || ' (v' || NEW.version || ')', NEW.total, v_fecha_vencimiento, 'pendiente');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_presupuesto_aprobado_ingreso ON presupuestos;
CREATE TRIGGER trg_presupuesto_aprobado_ingreso
  AFTER UPDATE ON presupuestos FOR EACH ROW EXECUTE FUNCTION create_ingreso_from_presupuesto();

-- ─── TRIGGER — Alerta sin comprobante ────────────────────────
CREATE OR REPLACE FUNCTION create_alerta_factura_pendiente()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_proveedor_nombre TEXT;
BEGIN
  IF NEW.tipo_comprobante != 'sin_comprobante' THEN RETURN NEW; END IF;
  SELECT COALESCE(nombre_comercial, razon_social) INTO v_proveedor_nombre FROM proveedores WHERE id = NEW.proveedor_id;
  INSERT INTO alertas (org_id, tipo, nivel, referencia_tabla, referencia_id, mensaje)
  VALUES (NEW.org_id, 'factura_proveedor_pendiente', 'critico', 'gastos', NEW.id,
    'Factura pendiente de ' || v_proveedor_nombre || ' por S/ ' || TO_CHAR(NEW.total::NUMERIC / 100, 'FM999,999,999.00'));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gasto_alerta_sin_comprobante ON gastos;
CREATE TRIGGER trg_gasto_alerta_sin_comprobante
  AFTER INSERT ON gastos FOR EACH ROW EXECUTE FUNCTION create_alerta_factura_pendiente();

-- ─── TRIGGER — Audit log ──────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (org_id, user_id, tabla, registro_id, accion, datos_antes, datos_des)
  VALUES (COALESCE(OLD.org_id, NEW.org_id), auth.uid(), TG_TABLE_NAME, COALESCE(OLD.id, NEW.id),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END);
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS audit_gastos        ON gastos;
DROP TRIGGER IF EXISTS audit_presupuestos  ON presupuestos;
DROP TRIGGER IF EXISTS audit_movimientos_caja ON movimientos_caja;

CREATE TRIGGER audit_gastos        AFTER UPDATE OR DELETE ON gastos        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_presupuestos  AFTER UPDATE OR DELETE ON presupuestos  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_movimientos_caja AFTER UPDATE OR DELETE ON movimientos_caja FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ─── RLS: HABILITAR EN TODAS LAS TABLAS ──────────────────────
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_generales   ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_gg    ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_items     ENABLE ROW LEVEL SECURITY;

ALTER TABLE organizations      FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_users FORCE ROW LEVEL SECURITY;
ALTER TABLE clientes           FORCE ROW LEVEL SECURITY;
ALTER TABLE proyectos          FORCE ROW LEVEL SECURITY;
ALTER TABLE categorias         FORCE ROW LEVEL SECURITY;
ALTER TABLE presupuestos       FORCE ROW LEVEL SECURITY;
ALTER TABLE lineas_presupuesto FORCE ROW LEVEL SECURITY;
ALTER TABLE proveedores        FORCE ROW LEVEL SECURITY;
ALTER TABLE gastos             FORCE ROW LEVEL SECURITY;
ALTER TABLE gastos_generales   FORCE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_gg    FORCE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja   FORCE ROW LEVEL SECURITY;
ALTER TABLE alertas            FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log          FORCE ROW LEVEL SECURITY;
ALTER TABLE proyecto_items     FORCE ROW LEVEL SECURITY;

-- ─── RLS POLICIES (DROP IF EXISTS para idempotencia) ─────────

-- organizations
DROP POLICY IF EXISTS "organizations_select"      ON organizations;
DROP POLICY IF EXISTS "organizations_update_admin" ON organizations;
CREATE POLICY "organizations_select"       ON organizations FOR SELECT TO authenticated USING (id = get_user_org_id());
CREATE POLICY "organizations_update_admin" ON organizations FOR UPDATE TO authenticated
  USING (id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (id = get_user_org_id() AND get_user_rol() = 'admin');

-- organization_users
DROP POLICY IF EXISTS "org_users_select"       ON organization_users;
DROP POLICY IF EXISTS "org_users_insert_admin" ON organization_users;
DROP POLICY IF EXISTS "org_users_update_admin" ON organization_users;
DROP POLICY IF EXISTS "org_users_delete_admin" ON organization_users;
CREATE POLICY "org_users_select"       ON organization_users FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "org_users_insert_admin" ON organization_users FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');
CREATE POLICY "org_users_update_admin" ON organization_users FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');
CREATE POLICY "org_users_delete_admin" ON organization_users FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- clientes
DROP POLICY IF EXISTS "clientes_select"         ON clientes;
DROP POLICY IF EXISTS "clientes_insert_admin_pm" ON clientes;
DROP POLICY IF EXISTS "clientes_update_admin_pm" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_admin"   ON clientes;
CREATE POLICY "clientes_select"          ON clientes FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "clientes_insert_admin_pm" ON clientes FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "clientes_update_admin_pm" ON clientes FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "clientes_delete_admin"    ON clientes FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- proyectos
DROP POLICY IF EXISTS "proyectos_select"          ON proyectos;
DROP POLICY IF EXISTS "proyectos_insert_admin_pm" ON proyectos;
DROP POLICY IF EXISTS "proyectos_update_admin_pm" ON proyectos;
DROP POLICY IF EXISTS "proyectos_delete_admin"    ON proyectos;
CREATE POLICY "proyectos_select"          ON proyectos FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "proyectos_insert_admin_pm" ON proyectos FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "proyectos_update_admin_pm" ON proyectos FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "proyectos_delete_admin"    ON proyectos FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- categorias
DROP POLICY IF EXISTS "categorias_select"       ON categorias;
DROP POLICY IF EXISTS "categorias_insert_admin" ON categorias;
DROP POLICY IF EXISTS "categorias_update_admin" ON categorias;
DROP POLICY IF EXISTS "categorias_delete_admin" ON categorias;
CREATE POLICY "categorias_select"       ON categorias FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "categorias_insert_admin" ON categorias FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');
CREATE POLICY "categorias_update_admin" ON categorias FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');
CREATE POLICY "categorias_delete_admin" ON categorias FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- presupuestos
DROP POLICY IF EXISTS "presupuestos_select"          ON presupuestos;
DROP POLICY IF EXISTS "presupuestos_insert_admin_pm" ON presupuestos;
DROP POLICY IF EXISTS "presupuestos_update_admin_pm" ON presupuestos;
DROP POLICY IF EXISTS "presupuestos_delete_admin"    ON presupuestos;
CREATE POLICY "presupuestos_select"          ON presupuestos FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "presupuestos_insert_admin_pm" ON presupuestos FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "presupuestos_update_admin_pm" ON presupuestos FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "presupuestos_delete_admin"    ON presupuestos FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- lineas_presupuesto
DROP POLICY IF EXISTS "lineas_presupuesto_select"          ON lineas_presupuesto;
DROP POLICY IF EXISTS "lineas_presupuesto_insert_admin_pm" ON lineas_presupuesto;
DROP POLICY IF EXISTS "lineas_presupuesto_update_admin_pm" ON lineas_presupuesto;
DROP POLICY IF EXISTS "lineas_presupuesto_delete_admin_pm" ON lineas_presupuesto;
CREATE POLICY "lineas_presupuesto_select" ON lineas_presupuesto FOR SELECT TO authenticated
  USING (presupuesto_id IN (SELECT id FROM presupuestos WHERE org_id = get_user_org_id()));
CREATE POLICY "lineas_presupuesto_insert_admin_pm" ON lineas_presupuesto FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'pm') AND presupuesto_id IN (SELECT id FROM presupuestos WHERE org_id = get_user_org_id()));
CREATE POLICY "lineas_presupuesto_update_admin_pm" ON lineas_presupuesto FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('admin', 'pm') AND presupuesto_id IN (SELECT id FROM presupuestos WHERE org_id = get_user_org_id()))
  WITH CHECK (get_user_rol() IN ('admin', 'pm') AND presupuesto_id IN (SELECT id FROM presupuestos WHERE org_id = get_user_org_id()));
CREATE POLICY "lineas_presupuesto_delete_admin_pm" ON lineas_presupuesto FOR DELETE TO authenticated
  USING (get_user_rol() IN ('admin', 'pm') AND presupuesto_id IN (SELECT id FROM presupuestos WHERE org_id = get_user_org_id()));

-- proveedores
DROP POLICY IF EXISTS "proveedores_select"          ON proveedores;
DROP POLICY IF EXISTS "proveedores_insert_admin_pm" ON proveedores;
DROP POLICY IF EXISTS "proveedores_update_admin_pm" ON proveedores;
DROP POLICY IF EXISTS "proveedores_delete_admin"    ON proveedores;
CREATE POLICY "proveedores_select"          ON proveedores FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "proveedores_insert_admin_pm" ON proveedores FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "proveedores_update_admin_pm" ON proveedores FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "proveedores_delete_admin"    ON proveedores FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- gastos
DROP POLICY IF EXISTS "gastos_select"        ON gastos;
DROP POLICY IF EXISTS "gastos_insert_admin"  ON gastos;
DROP POLICY IF EXISTS "gastos_insert_pm"     ON gastos;
DROP POLICY IF EXISTS "gastos_update_admin"  ON gastos;
DROP POLICY IF EXISTS "gastos_update_pm"     ON gastos;
DROP POLICY IF EXISTS "gastos_delete_admin"  ON gastos;
CREATE POLICY "gastos_select"       ON gastos FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "gastos_insert_admin" ON gastos FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');
CREATE POLICY "gastos_insert_pm"    ON gastos FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'pm' AND
    proyecto_id IN (SELECT id FROM proyectos WHERE org_id = get_user_org_id() AND responsable_id = auth.uid()));
CREATE POLICY "gastos_update_admin" ON gastos FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');
CREATE POLICY "gastos_update_pm"    ON gastos FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'pm' AND
    proyecto_id IN (SELECT id FROM proyectos WHERE org_id = get_user_org_id() AND responsable_id = auth.uid()))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'pm' AND
    proyecto_id IN (SELECT id FROM proyectos WHERE org_id = get_user_org_id() AND responsable_id = auth.uid()));
CREATE POLICY "gastos_delete_admin" ON gastos FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- gastos_generales
DROP POLICY IF EXISTS "gastos_generales_select"          ON gastos_generales;
DROP POLICY IF EXISTS "gastos_generales_insert_admin_pm" ON gastos_generales;
DROP POLICY IF EXISTS "gastos_generales_update_admin_pm" ON gastos_generales;
DROP POLICY IF EXISTS "gastos_generales_delete_admin"    ON gastos_generales;
CREATE POLICY "gastos_generales_select"          ON gastos_generales FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "gastos_generales_insert_admin_pm" ON gastos_generales FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "gastos_generales_update_admin_pm" ON gastos_generales FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "gastos_generales_delete_admin"    ON gastos_generales FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- asignaciones_gg
DROP POLICY IF EXISTS "asignaciones_gg_select"          ON asignaciones_gg;
DROP POLICY IF EXISTS "asignaciones_gg_insert_admin_pm" ON asignaciones_gg;
DROP POLICY IF EXISTS "asignaciones_gg_update_admin_pm" ON asignaciones_gg;
DROP POLICY IF EXISTS "asignaciones_gg_delete_admin_pm" ON asignaciones_gg;
CREATE POLICY "asignaciones_gg_select" ON asignaciones_gg FOR SELECT TO authenticated
  USING (gasto_general_id IN (SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()));
CREATE POLICY "asignaciones_gg_insert_admin_pm" ON asignaciones_gg FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'pm') AND gasto_general_id IN (SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()));
CREATE POLICY "asignaciones_gg_update_admin_pm" ON asignaciones_gg FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('admin', 'pm') AND gasto_general_id IN (SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()))
  WITH CHECK (get_user_rol() IN ('admin', 'pm') AND gasto_general_id IN (SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()));
CREATE POLICY "asignaciones_gg_delete_admin_pm" ON asignaciones_gg FOR DELETE TO authenticated
  USING (get_user_rol() IN ('admin', 'pm') AND gasto_general_id IN (SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()));

-- movimientos_caja
DROP POLICY IF EXISTS "movimientos_caja_select"       ON movimientos_caja;
DROP POLICY IF EXISTS "movimientos_caja_insert_admin" ON movimientos_caja;
CREATE POLICY "movimientos_caja_select"       ON movimientos_caja FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "movimientos_caja_insert_admin" ON movimientos_caja FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- alertas
DROP POLICY IF EXISTS "alertas_select"              ON alertas;
DROP POLICY IF EXISTS "alertas_update_leida_admin_pm" ON alertas;
DROP POLICY IF EXISTS "alertas_delete_admin"        ON alertas;
CREATE POLICY "alertas_select"               ON alertas FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "alertas_update_leida_admin_pm" ON alertas FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "alertas_delete_admin"         ON alertas FOR DELETE TO authenticated USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- audit_log
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
CREATE POLICY "audit_log_select_admin" ON audit_log FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- proyecto_items
DROP POLICY IF EXISTS "proyecto_items_select"          ON proyecto_items;
DROP POLICY IF EXISTS "proyecto_items_insert_admin_pm" ON proyecto_items;
DROP POLICY IF EXISTS "proyecto_items_update_admin_pm" ON proyecto_items;
DROP POLICY IF EXISTS "proyecto_items_delete_admin"    ON proyecto_items;
CREATE POLICY "proyecto_items_select"          ON proyecto_items FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "proyecto_items_insert_admin_pm" ON proyecto_items FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "proyecto_items_update_admin_pm" ON proyecto_items FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));
CREATE POLICY "proyecto_items_delete_admin"    ON proyecto_items FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- ============================================================
-- FIN — Todas las tablas y políticas creadas correctamente.
-- ============================================================
