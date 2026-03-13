CREATE TABLE IF NOT EXISTS inventario_insumos (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  cantidad_actual numeric NOT NULL DEFAULT 0,
  cantidad_por_limpieza numeric NOT NULL DEFAULT 1,
  unidad text NOT NULL DEFAULT 'unidad',
  creado_en timestamptz NOT NULL DEFAULT now()
);
