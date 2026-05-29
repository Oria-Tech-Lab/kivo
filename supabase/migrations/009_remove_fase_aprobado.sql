-- Mover proyectos en fase 'aprobado' a 'cotizacion' antes de eliminar el valor
UPDATE proyectos SET fase = 'cotizacion' WHERE fase = 'aprobado';

-- Reemplazar el CHECK constraint de la columna fase
ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_fase_check;
ALTER TABLE proyectos ADD CONSTRAINT proyectos_fase_check
  CHECK (fase IN ('cotizacion', 'ejecucion', 'finalizado'));
