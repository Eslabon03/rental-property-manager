CREATE TABLE IF NOT EXISTS limpiezas_completadas (
  id serial PRIMARY KEY,
  reserva_id integer NOT NULL REFERENCES reservas(id) UNIQUE,
  propiedad_id integer NOT NULL REFERENCES propiedades(id),
  evidencia_url text DEFAULT NULL,
  creado_por text DEFAULT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
