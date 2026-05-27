-- 005: facturas_proyecto
-- Tabla de facturas emitidas al cliente por proyecto.
-- Usa GENERATED ALWAYS AS para calcular igv, total, etc. desde columnas base.

CREATE TABLE IF NOT EXISTS facturas_proyecto (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id       UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  numero_factura    TEXT        NOT NULL,
  subtotal          INTEGER     NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  aplica_igv        BOOLEAN     NOT NULL DEFAULT true,
  igv               INTEGER     GENERATED ALWAYS AS (
                      CASE WHEN aplica_igv THEN (subtotal * 18 / 100) ELSE 0 END
                    ) STORED,
  aplica_detraccion BOOLEAN     NOT NULL DEFAULT false,
  pct_detraccion    INTEGER     NOT NULL DEFAULT 0 CHECK (pct_detraccion BETWEEN 0 AND 100),
  monto_detraccion  INTEGER     GENERATED ALWAYS AS (
                      CASE WHEN aplica_detraccion
                        THEN (
                          (subtotal + CASE WHEN aplica_igv THEN (subtotal * 18 / 100) ELSE 0 END)
                          * pct_detraccion / 100
                        )
                        ELSE 0
                      END
                    ) STORED,
  total             INTEGER     GENERATED ALWAYS AS (
                      subtotal + CASE WHEN aplica_igv THEN (subtotal * 18 / 100) ELSE 0 END
                    ) STORED,
  cliente_abona     INTEGER     GENERATED ALWAYS AS (
                      subtotal
                      + CASE WHEN aplica_igv THEN (subtotal * 18 / 100) ELSE 0 END
                      - CASE WHEN aplica_detraccion
                          THEN (
                            (subtotal + CASE WHEN aplica_igv THEN (subtotal * 18 / 100) ELSE 0 END)
                            * pct_detraccion / 100
                          )
                          ELSE 0
                        END
                    ) STORED,
  estado            TEXT        NOT NULL DEFAULT 'borrador'
                      CHECK (estado IN ('borrador','emitida','cobrada','vencida')),
  fecha_emision     DATE,
  fecha_vencimiento DATE,
  fecha_cobro       DATE,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facturas_proyecto_proyecto ON facturas_proyecto(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_facturas_proyecto_org      ON facturas_proyecto(org_id);

ALTER TABLE facturas_proyecto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON facturas_proyecto;
CREATE POLICY "org_isolation" ON facturas_proyecto
  USING  (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());
