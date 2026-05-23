-- ============================================================
-- Kivo — Schema SQL completo
-- Migración: 001_initial_schema.sql
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONES
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN HELPER PARA TRIGGERS (sin dependencias de tablas)
-- ────────────────────────────────────────────────────────────

-- Actualiza updated_at automáticamente en cada UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- NOTA: get_user_org_id() y get_user_rol() se definen DESPUÉS de las tablas
-- porque LANGUAGE SQL valida las referencias a tablas en el momento de CREATE.

-- ────────────────────────────────────────────────────────────
-- TABLAS (orden por dependencias de FK)
-- ────────────────────────────────────────────────────────────

-- Organización (multi-tenant base)
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  ruc         VARCHAR(11) NOT NULL UNIQUE,
  plan        TEXT        NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Usuarios por organización y sus roles
CREATE TABLE IF NOT EXISTS organization_users (
  org_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol      TEXT NOT NULL CHECK (rol IN ('admin', 'pm', 'viewer')),
  PRIMARY KEY (org_id, user_id)
);

-- M1 — Categorías personalizables de proyectos
CREATE TABLE IF NOT EXISTS categorias (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre  TEXT NOT NULL,
  tipo    TEXT CHECK (tipo IN ('digital', 'offline', 'evento', 'instalacion', 'otro')),
  color   VARCHAR(7)  -- color hex (#RRGGBB)
);

-- M1 — Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre             TEXT        NOT NULL,
  ruc                VARCHAR(11),
  contacto_nombre    TEXT,
  contacto_email     TEXT,
  contacto_telefono  VARCHAR(20),
  estado             TEXT        NOT NULL DEFAULT 'activo'
                                 CHECK (estado IN ('activo', 'inactivo')),
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- M1 — Proyectos
CREATE TABLE IF NOT EXISTS proyectos (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cliente_id          UUID    NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  nombre              TEXT    NOT NULL,
  tipo                TEXT    NOT NULL CHECK (tipo IN ('digital', 'offline', 'evento', 'instalacion', 'otro')),
  categoria_id        UUID    REFERENCES categorias(id) ON DELETE SET NULL,
  estado              TEXT    NOT NULL DEFAULT 'activo'
                              CHECK (estado IN ('activo', 'en_pausa', 'cerrado')),
  responsable_id      UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_inicio        DATE    NOT NULL,
  fecha_cierre_est    DATE,
  aplica_detraccion   BOOLEAN NOT NULL DEFAULT false,
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- M5 — Proveedores (antes de gastos por FK)
CREATE TABLE IF NOT EXISTS proveedores (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ruc               VARCHAR(11) NOT NULL,
  razon_social      TEXT        NOT NULL,
  nombre_comercial  TEXT,
  tipo              TEXT        NOT NULL CHECK (tipo IN ('persona_natural', 'persona_juridica')),
  actividad         TEXT,
  aplica_detraccion BOOLEAN     NOT NULL DEFAULT false,
  pct_detraccion    INTEGER     NOT NULL DEFAULT 0
                                CHECK (pct_detraccion BETWEEN 0 AND 100),
  condicion_pago    TEXT,
  cuenta_banco_enc  BYTEA,  -- cifrado con pgcrypto, clave en DB_ENCRYPTION_KEY
  cuenta_spot_enc   BYTEA,  -- cifrado con pgcrypto
  email             TEXT,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (org_id, ruc)  -- RUC único por organización
);

-- M2 — Presupuestos
CREATE TABLE IF NOT EXISTS presupuestos (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id      UUID    NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  org_id           UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, -- desnormalizado para RLS
  version          INTEGER NOT NULL DEFAULT 1,
  estado           TEXT    NOT NULL DEFAULT 'borrador'
                           CHECK (estado IN ('borrador', 'aprobado', 'rechazado')),
  condicion_pago   TEXT    NOT NULL
                           CHECK (condicion_pago IN ('contado', '30d', '45d', 'hitos')),
  fecha_aprobacion DATE,
  subtotal         INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0), -- centavos
  igv_total        INTEGER NOT NULL DEFAULT 0 CHECK (igv_total >= 0),
  total            INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- M2 — Líneas de presupuesto
CREATE TABLE IF NOT EXISTS lineas_presupuesto (
  id               UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  presupuesto_id   UUID           NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  concepto         TEXT           NOT NULL,
  subtotal         INTEGER        NOT NULL DEFAULT 0 CHECK (subtotal >= 0), -- centavos
  igv              INTEGER        NOT NULL DEFAULT 0 CHECK (igv >= 0),
  total            INTEGER        NOT NULL DEFAULT 0 CHECK (total >= 0),
  pct_fee          NUMERIC(5, 2)  -- % de fee/margen esperado sobre esta línea
);

-- M3 — Gastos de proyecto
CREATE TABLE IF NOT EXISTS gastos (
  id                         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id                UUID    NOT NULL REFERENCES proyectos(id) ON DELETE RESTRICT,
  org_id                     UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, -- desnormalizado para RLS
  linea_presupuesto_id       UUID    REFERENCES lineas_presupuesto(id) ON DELETE SET NULL,
  proveedor_id               UUID    NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  concepto                   TEXT    NOT NULL,
  tipo_comprobante           TEXT    NOT NULL
                                     CHECK (tipo_comprobante IN ('factura', 'boleta', 'rxh', 'sin_comprobante')),
  serie                      VARCHAR(10),
  numero_doc                 VARCHAR(20),
  subtotal                   INTEGER NOT NULL CHECK (subtotal >= 0),       -- centavos, sin IGV
  igv                        INTEGER NOT NULL DEFAULT 0 CHECK (igv >= 0),  -- centavos, solo facturas
  total                      INTEGER NOT NULL CHECK (total >= 0),           -- centavos
  aplica_detraccion          BOOLEAN NOT NULL DEFAULT false,
  pct_detraccion             INTEGER NOT NULL DEFAULT 0,
  monto_detraccion           INTEGER NOT NULL DEFAULT 0 CHECK (monto_detraccion >= 0),
  neto_a_pagar               INTEGER NOT NULL CHECK (neto_a_pagar >= 0),
  retencion_4ta              INTEGER NOT NULL DEFAULT 0 CHECK (retencion_4ta >= 0), -- solo RxH
  adjunto_url                TEXT,
  fecha_comprobante          DATE    NOT NULL,
  fecha_vencimiento_pago     DATE,
  estado_pago                TEXT    NOT NULL DEFAULT 'pendiente'
                                     CHECK (estado_pago IN ('pendiente', 'pagado')),
  fecha_pago_real            DATE,
  estado_detraccion          TEXT    NOT NULL DEFAULT 'no_aplica'
                                     CHECK (estado_detraccion IN ('pendiente', 'depositada', 'no_aplica')),
  fecha_deposito_detraccion  DATE,
  notas                      TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at                 TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- M4 — Gastos generales (costos compartidos de la empresa)
CREATE TABLE IF NOT EXISTS gastos_generales (
  id                UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proveedor_id      UUID           REFERENCES proveedores(id) ON DELETE SET NULL,
  concepto          TEXT           NOT NULL,
  tipo_recurrencia  TEXT           NOT NULL CHECK (tipo_recurrencia IN ('mensual', 'puntual')),
  monto             INTEGER        NOT NULL CHECK (monto >= 0),    -- centavos
  periodo_mes       INTEGER        CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_anio      INTEGER,
  tipo_comprobante  TEXT           CHECK (tipo_comprobante IN ('factura', 'boleta', 'rxh', 'sin_comprobante')),
  igv               INTEGER        NOT NULL DEFAULT 0,
  total             INTEGER        NOT NULL CHECK (total >= 0),
  adjunto_url       TEXT,
  umbral_proyectos  INTEGER        NOT NULL DEFAULT 1 CHECK (umbral_proyectos >= 1),
  estado            TEXT           NOT NULL DEFAULT 'pendiente_asignacion'
                                   CHECK (estado IN ('pendiente_asignacion', 'cubierto_parcial', 'cubierto', 'generando_ganancia')),
  created_at        TIMESTAMPTZ    DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ    DEFAULT NOW() NOT NULL
);

-- M4 — Asignaciones de gastos generales a proyectos
CREATE TABLE IF NOT EXISTS asignaciones_gg (
  id                UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  gasto_general_id  UUID           NOT NULL REFERENCES gastos_generales(id) ON DELETE CASCADE,
  proyecto_id       UUID           NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  monto             INTEGER        NOT NULL CHECK (monto >= 0), -- centavos
  pct               NUMERIC(5, 2),
  fecha             DATE           NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (gasto_general_id, proyecto_id)
);

-- M6 — Movimientos de caja (generados automáticamente por triggers)
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tipo           TEXT        NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'detraccion', 'retencion')),
  origen_tabla   TEXT        NOT NULL, -- 'gastos' | 'presupuestos'
  origen_id      UUID        NOT NULL,
  proyecto_id    UUID        REFERENCES proyectos(id) ON DELETE SET NULL,
  cliente_id     UUID        REFERENCES clientes(id) ON DELETE SET NULL,
  proveedor_id   UUID        REFERENCES proveedores(id) ON DELETE SET NULL,
  concepto       TEXT        NOT NULL,
  monto          INTEGER     NOT NULL CHECK (monto >= 0), -- centavos
  fecha_esperada DATE        NOT NULL,
  fecha_real     DATE,
  estado         TEXT        NOT NULL DEFAULT 'pendiente'
                             CHECK (estado IN ('pendiente', 'realizado', 'vencido')),
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Alertas del sistema
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

-- Audit log (INSERT-only para todos los roles, nadie puede borrar historial)
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID        NOT NULL,
  user_id      UUID        NOT NULL REFERENCES auth.users(id),
  tabla        TEXT        NOT NULL,
  registro_id  UUID        NOT NULL,
  accion       TEXT        NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  datos_antes  JSONB,
  datos_des    JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ────────────────────────────────────────────────────────────
-- ÍNDICES (campos de filtro frecuente)
-- ────────────────────────────────────────────────────────────

-- organization_users: lookup frecuente por user_id
CREATE INDEX IF NOT EXISTS idx_org_users_user_id     ON organization_users(user_id);

-- clientes
CREATE INDEX IF NOT EXISTS idx_clientes_org_id       ON clientes(org_id);

-- proyectos
CREATE INDEX IF NOT EXISTS idx_proyectos_org_id      ON proyectos(org_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id  ON proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_estado      ON proyectos(estado);
CREATE INDEX IF NOT EXISTS idx_proyectos_responsable ON proyectos(responsable_id);

-- proveedores
CREATE INDEX IF NOT EXISTS idx_proveedores_org_id    ON proveedores(org_id);

-- presupuestos
CREATE INDEX IF NOT EXISTS idx_presupuestos_proyecto ON presupuestos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_org_id   ON presupuestos(org_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado   ON presupuestos(estado);

-- lineas_presupuesto
CREATE INDEX IF NOT EXISTS idx_lineas_presupuesto_id ON lineas_presupuesto(presupuesto_id);

-- gastos (los más consultados)
CREATE INDEX IF NOT EXISTS idx_gastos_proyecto_id    ON gastos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_org_id         ON gastos(org_id);
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor_id   ON gastos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_gastos_estado_pago    ON gastos(estado_pago);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha_vto_pago ON gastos(fecha_vencimiento_pago);
CREATE INDEX IF NOT EXISTS idx_gastos_tipo_comprobante ON gastos(tipo_comprobante);
CREATE INDEX IF NOT EXISTS idx_gastos_estado_detracccion ON gastos(estado_detraccion);

-- gastos_generales
CREATE INDEX IF NOT EXISTS idx_gg_org_id             ON gastos_generales(org_id);

-- asignaciones_gg
CREATE INDEX IF NOT EXISTS idx_aagg_proyecto_id      ON asignaciones_gg(proyecto_id);

-- movimientos_caja (dashboard y flujo de caja)
CREATE INDEX IF NOT EXISTS idx_mc_org_id             ON movimientos_caja(org_id);
CREATE INDEX IF NOT EXISTS idx_mc_fecha_esperada     ON movimientos_caja(fecha_esperada);
CREATE INDEX IF NOT EXISTS idx_mc_estado             ON movimientos_caja(estado);
CREATE INDEX IF NOT EXISTS idx_mc_proyecto_id        ON movimientos_caja(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_mc_origen             ON movimientos_caja(origen_tabla, origen_id);

-- alertas
CREATE INDEX IF NOT EXISTS idx_alertas_org_id        ON alertas(org_id);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelto      ON alertas(resuelto);
CREATE INDEX IF NOT EXISTS idx_alertas_nivel         ON alertas(nivel);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_org_id          ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabla           ON audit_log(tabla, registro_id);


-- ────────────────────────────────────────────────────────────
-- FUNCIONES HELPER RLS
-- Definidas DESPUÉS de las tablas porque LANGUAGE SQL valida
-- referencias a tablas en el momento de CREATE FUNCTION.
-- ────────────────────────────────────────────────────────────

-- Retorna el org_id del usuario autenticado.
-- SECURITY DEFINER + STABLE permite usarla eficientemente en políticas RLS
-- y garantiza que lee organization_users sin restricciones de RLS (bypasses RLS).
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id
  FROM organization_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Retorna el rol del usuario autenticado ('admin' | 'pm' | 'viewer').
CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT rol
  FROM organization_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


-- ────────────────────────────────────────────────────────────
-- TRIGGERS — updated_at automático
-- ────────────────────────────────────────────────────────────

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_proyectos_updated_at
  BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_gastos_updated_at
  BEFORE UPDATE ON gastos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_gastos_generales_updated_at
  BEFORE UPDATE ON gastos_generales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ────────────────────────────────────────────────────────────
-- TRIGGER — Movimientos de caja automáticos desde gastos
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_movimientos_from_gasto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proveedor_nombre TEXT;
BEGIN
  -- Obtener nombre del proveedor para el concepto
  SELECT COALESCE(nombre_comercial, razon_social)
    INTO v_proveedor_nombre
    FROM proveedores WHERE id = NEW.proveedor_id;

  -- 1. Egreso: pago neto al proveedor
  INSERT INTO movimientos_caja (
    org_id, tipo, origen_tabla, origen_id,
    proyecto_id, proveedor_id,
    concepto, monto, fecha_esperada, estado
  ) VALUES (
    NEW.org_id, 'egreso', 'gastos', NEW.id,
    NEW.proyecto_id, NEW.proveedor_id,
    v_proveedor_nombre || ' — ' || NEW.concepto,
    NEW.neto_a_pagar,
    COALESCE(NEW.fecha_vencimiento_pago, NEW.fecha_comprobante),
    'pendiente'
  );

  -- 2. Detracción: depósito en cuenta SPOT (si aplica)
  IF NEW.aplica_detraccion AND NEW.monto_detraccion > 0 THEN
    INSERT INTO movimientos_caja (
      org_id, tipo, origen_tabla, origen_id,
      proyecto_id, proveedor_id,
      concepto, monto, fecha_esperada, estado
    ) VALUES (
      NEW.org_id, 'detraccion', 'gastos', NEW.id,
      NEW.proyecto_id, NEW.proveedor_id,
      'Detracción SPOT — ' || v_proveedor_nombre,
      NEW.monto_detraccion,
      -- 5to día hábil del mes siguiente (aproximado al día 5)
      (DATE_TRUNC('month', NEW.fecha_comprobante) + INTERVAL '1 month' + INTERVAL '4 days')::DATE,
      'pendiente'
    );
  END IF;

  -- 3. Retención 4ta categoría (si es RxH)
  IF NEW.tipo_comprobante = 'rxh' AND NEW.retencion_4ta > 0 THEN
    INSERT INTO movimientos_caja (
      org_id, tipo, origen_tabla, origen_id,
      proyecto_id, proveedor_id,
      concepto, monto, fecha_esperada, estado
    ) VALUES (
      NEW.org_id, 'retencion', 'gastos', NEW.id,
      NEW.proyecto_id, NEW.proveedor_id,
      'Retención 4ta Cat. — ' || v_proveedor_nombre,
      NEW.retencion_4ta,
      -- Retención se declara el mes siguiente
      (DATE_TRUNC('month', NEW.fecha_comprobante) + INTERVAL '1 month' + INTERVAL '11 days')::DATE,
      'pendiente'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gasto_create_movimientos
  AFTER INSERT ON gastos
  FOR EACH ROW EXECUTE FUNCTION create_movimientos_from_gasto();


-- ────────────────────────────────────────────────────────────
-- TRIGGER — Movimiento de ingreso al aprobar presupuesto
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_ingreso_from_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_proyecto_nombre TEXT;
  v_fecha_vencimiento DATE;
BEGIN
  -- Solo actuar cuando el estado cambia a 'aprobado'
  IF OLD.estado = 'aprobado' OR NEW.estado != 'aprobado' THEN
    RETURN NEW;
  END IF;

  -- Obtener cliente y nombre del proyecto
  SELECT p.cliente_id, p.nombre
    INTO v_cliente_id, v_proyecto_nombre
    FROM proyectos p WHERE p.id = NEW.proyecto_id;

  -- Calcular fecha de vencimiento según condición de pago
  v_fecha_vencimiento := CASE NEW.condicion_pago
    WHEN 'contado' THEN COALESCE(NEW.fecha_aprobacion, CURRENT_DATE)
    WHEN '30d'     THEN COALESCE(NEW.fecha_aprobacion, CURRENT_DATE) + INTERVAL '30 days'
    WHEN '45d'     THEN COALESCE(NEW.fecha_aprobacion, CURRENT_DATE) + INTERVAL '45 days'
    WHEN 'hitos'   THEN COALESCE(NEW.fecha_aprobacion, CURRENT_DATE) + INTERVAL '30 days'
    ELSE CURRENT_DATE + INTERVAL '30 days'
  END;

  INSERT INTO movimientos_caja (
    org_id, tipo, origen_tabla, origen_id,
    proyecto_id, cliente_id,
    concepto, monto, fecha_esperada, estado
  ) VALUES (
    NEW.org_id, 'ingreso', 'presupuestos', NEW.id,
    NEW.proyecto_id, v_cliente_id,
    'Factura — ' || v_proyecto_nombre || ' (v' || NEW.version || ')',
    NEW.total,
    v_fecha_vencimiento,
    'pendiente'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_presupuesto_aprobado_ingreso
  AFTER UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION create_ingreso_from_presupuesto();


-- ────────────────────────────────────────────────────────────
-- TRIGGER — Alerta automática cuando tipo_comprobante es 'sin_comprobante'
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_alerta_factura_pendiente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proveedor_nombre TEXT;
BEGIN
  IF NEW.tipo_comprobante != 'sin_comprobante' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nombre_comercial, razon_social)
    INTO v_proveedor_nombre
    FROM proveedores WHERE id = NEW.proveedor_id;

  INSERT INTO alertas (
    org_id, tipo, nivel, referencia_tabla, referencia_id, mensaje
  ) VALUES (
    NEW.org_id,
    'factura_proveedor_pendiente',
    'critico',
    'gastos',
    NEW.id,
    'Factura pendiente de ' || v_proveedor_nombre || ' por S/ ' ||
    TO_CHAR(NEW.total::NUMERIC / 100, 'FM999,999,999.00')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gasto_alerta_sin_comprobante
  AFTER INSERT ON gastos
  FOR EACH ROW EXECUTE FUNCTION create_alerta_factura_pendiente();


-- ────────────────────────────────────────────────────────────
-- TRIGGER — Audit log en tablas financieras críticas
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_log (
    org_id, user_id, tabla, registro_id,
    accion, datos_antes, datos_des
  ) VALUES (
    COALESCE(OLD.org_id, NEW.org_id),
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(OLD.id, NEW.id),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_gastos
  AFTER UPDATE OR DELETE ON gastos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_presupuestos
  AFTER UPDATE OR DELETE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_movimientos_caja
  AFTER UPDATE OR DELETE ON movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Todas las tablas deben tener RLS antes del primer INSERT.
-- Roles: admin (full), pm (read-all + write propios), viewer (read-only)
-- Las funciones SECURITY DEFINER (get_user_org_id, get_user_rol)
-- consultan organization_users sin RLS interference.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENABLE + FORCE RLS en todas las tablas
-- ────────────────────────────────────────────────────────────
ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_presupuesto     ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_generales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_gg        ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- FORCE garantiza que incluso el table owner pase por RLS
ALTER TABLE organizations          FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_users     FORCE ROW LEVEL SECURITY;
ALTER TABLE clientes               FORCE ROW LEVEL SECURITY;
ALTER TABLE proyectos              FORCE ROW LEVEL SECURITY;
ALTER TABLE categorias             FORCE ROW LEVEL SECURITY;
ALTER TABLE presupuestos           FORCE ROW LEVEL SECURITY;
ALTER TABLE lineas_presupuesto     FORCE ROW LEVEL SECURITY;
ALTER TABLE proveedores            FORCE ROW LEVEL SECURITY;
ALTER TABLE gastos                 FORCE ROW LEVEL SECURITY;
ALTER TABLE gastos_generales       FORCE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_gg        FORCE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja       FORCE ROW LEVEL SECURITY;
ALTER TABLE alertas                FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log              FORCE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- organizations
-- Miembros sólo ven su propia organización.
-- Solo admin puede actualizar datos de la org.
-- INSERT: solo via código privilegiado (service role), no users directos.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "organizations_select"
  ON organizations FOR SELECT
  TO authenticated
  USING (id = get_user_org_id());

CREATE POLICY "organizations_update_admin"
  ON organizations FOR UPDATE
  TO authenticated
  USING    (id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- organization_users
-- Todos los miembros ven al resto de su org.
-- Solo admin puede agregar/modificar/eliminar miembros.
-- Nota: get_user_org_id() es SECURITY DEFINER → no hay recursión RLS.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_users_select"
  ON organization_users FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "org_users_insert_admin"
  ON organization_users FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

CREATE POLICY "org_users_update_admin"
  ON organization_users FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

CREATE POLICY "org_users_delete_admin"
  ON organization_users FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- clientes
-- Todos los roles leen clientes de su org.
-- Admin y PM pueden crear/actualizar; solo admin puede eliminar.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "clientes_select"
  ON clientes FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "clientes_insert_admin_pm"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "clientes_update_admin_pm"
  ON clientes FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "clientes_delete_admin"
  ON clientes FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- proyectos
-- Todos los roles leen proyectos de su org.
-- Admin y PM pueden crear/actualizar; solo admin puede eliminar.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "proyectos_select"
  ON proyectos FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "proyectos_insert_admin_pm"
  ON proyectos FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "proyectos_update_admin_pm"
  ON proyectos FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "proyectos_delete_admin"
  ON proyectos FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- categorias
-- Todos los roles leen categorías de su org.
-- Solo admin puede crear/actualizar/eliminar.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "categorias_select"
  ON categorias FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "categorias_insert_admin"
  ON categorias FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

CREATE POLICY "categorias_update_admin"
  ON categorias FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

CREATE POLICY "categorias_delete_admin"
  ON categorias FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- presupuestos
-- Todos los roles leen presupuestos de su org.
-- Admin y PM pueden crear/actualizar; solo admin puede eliminar.
-- org_id está desnormalizado en presupuestos para eficiencia RLS.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "presupuestos_select"
  ON presupuestos FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "presupuestos_insert_admin_pm"
  ON presupuestos FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "presupuestos_update_admin_pm"
  ON presupuestos FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "presupuestos_delete_admin"
  ON presupuestos FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- lineas_presupuesto
-- Acceso via presupuesto padre (misma org).
-- Admin y PM pueden gestionar líneas; viewer solo lectura.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "lineas_presupuesto_select"
  ON lineas_presupuesto FOR SELECT
  TO authenticated
  USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "lineas_presupuesto_insert_admin_pm"
  ON lineas_presupuesto FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_rol() IN ('admin', 'pm') AND
    presupuesto_id IN (
      SELECT id FROM presupuestos WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "lineas_presupuesto_update_admin_pm"
  ON lineas_presupuesto FOR UPDATE
  TO authenticated
  USING (
    get_user_rol() IN ('admin', 'pm') AND
    presupuesto_id IN (
      SELECT id FROM presupuestos WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_rol() IN ('admin', 'pm') AND
    presupuesto_id IN (
      SELECT id FROM presupuestos WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "lineas_presupuesto_delete_admin_pm"
  ON lineas_presupuesto FOR DELETE
  TO authenticated
  USING (
    get_user_rol() IN ('admin', 'pm') AND
    presupuesto_id IN (
      SELECT id FROM presupuestos WHERE org_id = get_user_org_id()
    )
  );


-- ────────────────────────────────────────────────────────────
-- proveedores
-- Todos los roles leen proveedores de su org.
-- Admin y PM pueden crear/actualizar (con campos bancarios cifrados).
-- Solo admin puede eliminar.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "proveedores_select"
  ON proveedores FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "proveedores_insert_admin_pm"
  ON proveedores FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "proveedores_update_admin_pm"
  ON proveedores FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "proveedores_delete_admin"
  ON proveedores FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- gastos
-- Todos los roles leen gastos de su org.
-- Admin puede crear/actualizar/eliminar cualquier gasto.
-- PM puede crear/actualizar solo gastos de proyectos donde es responsable.
-- PM no puede eliminar (solo admin).
-- org_id está desnormalizado para eficiencia RLS.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "gastos_select"
  ON gastos FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "gastos_insert_admin"
  ON gastos FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- PM puede insertar gastos solo en proyectos donde es responsable_id
CREATE POLICY "gastos_insert_pm"
  ON gastos FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() AND
    get_user_rol() = 'pm' AND
    proyecto_id IN (
      SELECT id FROM proyectos
      WHERE org_id = get_user_org_id()
        AND responsable_id = auth.uid()
    )
  );

CREATE POLICY "gastos_update_admin"
  ON gastos FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- PM puede actualizar gastos solo en proyectos donde es responsable_id
CREATE POLICY "gastos_update_pm"
  ON gastos FOR UPDATE
  TO authenticated
  USING (
    org_id = get_user_org_id() AND
    get_user_rol() = 'pm' AND
    proyecto_id IN (
      SELECT id FROM proyectos
      WHERE org_id = get_user_org_id()
        AND responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id = get_user_org_id() AND
    get_user_rol() = 'pm' AND
    proyecto_id IN (
      SELECT id FROM proyectos
      WHERE org_id = get_user_org_id()
        AND responsable_id = auth.uid()
    )
  );

CREATE POLICY "gastos_delete_admin"
  ON gastos FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- gastos_generales
-- Todos los roles leen GG de su org.
-- Admin y PM pueden crear/actualizar; solo admin puede eliminar.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "gastos_generales_select"
  ON gastos_generales FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "gastos_generales_insert_admin_pm"
  ON gastos_generales FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "gastos_generales_update_admin_pm"
  ON gastos_generales FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "gastos_generales_delete_admin"
  ON gastos_generales FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- asignaciones_gg
-- Acceso vía gasto_general padre (misma org).
-- Admin y PM pueden gestionar asignaciones; viewer solo lectura.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "asignaciones_gg_select"
  ON asignaciones_gg FOR SELECT
  TO authenticated
  USING (
    gasto_general_id IN (
      SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "asignaciones_gg_insert_admin_pm"
  ON asignaciones_gg FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_rol() IN ('admin', 'pm') AND
    gasto_general_id IN (
      SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "asignaciones_gg_update_admin_pm"
  ON asignaciones_gg FOR UPDATE
  TO authenticated
  USING (
    get_user_rol() IN ('admin', 'pm') AND
    gasto_general_id IN (
      SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_rol() IN ('admin', 'pm') AND
    gasto_general_id IN (
      SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY "asignaciones_gg_delete_admin_pm"
  ON asignaciones_gg FOR DELETE
  TO authenticated
  USING (
    get_user_rol() IN ('admin', 'pm') AND
    gasto_general_id IN (
      SELECT id FROM gastos_generales WHERE org_id = get_user_org_id()
    )
  );


-- ────────────────────────────────────────────────────────────
-- movimientos_caja
-- Todos los roles leen movimientos de su org (visibilidad completa).
-- Los movimientos se crean principalmente via triggers SECURITY DEFINER.
-- Admin puede insertar movimientos manuales (ajustes de caja).
-- Nadie puede actualizar ni eliminar movimientos (inmutabilidad).
-- ────────────────────────────────────────────────────────────
CREATE POLICY "movimientos_caja_select"
  ON movimientos_caja FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

CREATE POLICY "movimientos_caja_insert_admin"
  ON movimientos_caja FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- No se permiten UPDATE ni DELETE en movimientos_caja (libro de caja inmutable)
-- Los triggers SECURITY DEFINER pueden insertar sin políticas adicionales.


-- ────────────────────────────────────────────────────────────
-- alertas
-- Todos los roles leen alertas de su org.
-- Las alertas se crean via triggers SECURITY DEFINER.
-- Admin y PM pueden marcar alertas como leídas (UPDATE leida=true).
-- Nadie puede crear alertas directamente ni eliminarlas (solo admin).
-- ────────────────────────────────────────────────────────────
CREATE POLICY "alertas_select"
  ON alertas FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

-- Solo actualizar el campo leida (marcar como leída)
CREATE POLICY "alertas_update_leida_admin_pm"
  ON alertas FOR UPDATE
  TO authenticated
  USING    (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_rol() IN ('admin', 'pm'));

CREATE POLICY "alertas_delete_admin"
  ON alertas FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');


-- ────────────────────────────────────────────────────────────
-- audit_log
-- Solo admin puede leer el audit log de su org.
-- INSERT solo via triggers SECURITY DEFINER (audit_trigger_fn).
-- Nadie puede actualizar ni eliminar registros de auditoría.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "audit_log_select_admin"
  ON audit_log FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND get_user_rol() = 'admin');

-- No se permiten INSERT, UPDATE ni DELETE directos en audit_log.
-- Los triggers SECURITY DEFINER manejan los inserts de forma interna.


-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================
