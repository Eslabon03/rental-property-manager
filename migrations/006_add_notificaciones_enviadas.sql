CREATE TABLE IF NOT EXISTS notificaciones_enviadas (
  id serial PRIMARY KEY,
  reserva_id integer NOT NULL REFERENCES reservas(id),
  propiedad_id integer NOT NULL REFERENCES propiedades(id),
  tipo text NOT NULL,
  mensaje text NOT NULL,
  celular_huesped text DEFAULT NULL,
  nombre_huesped text DEFAULT NULL,
  enviado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reserva_id, tipo)
);
