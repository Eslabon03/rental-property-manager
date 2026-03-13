CREATE TABLE IF NOT EXISTS mantenimiento_pendientes (
  id serial PRIMARY KEY,
  propiedad_id integer NOT NULL REFERENCES propiedades(id),
  descripcion text NOT NULL,
  foto_url text DEFAULT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por text DEFAULT NULL
);
