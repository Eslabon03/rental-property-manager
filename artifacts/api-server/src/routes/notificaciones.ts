import { Router, type IRouter, type Request, type Response } from "express";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

interface ReservaRow {
  id: number;
  propiedad_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_huesped: string;
  celular_huesped: string | null;
}

interface PropiedadRow {
  nombre: string;
  instrucciones: string | null;
}

interface RawReservaWithProp extends ReservaRow {
  propiedades: PropiedadRow | PropiedadRow[] | null;
}

interface NotificacionPendiente {
  reserva_id: number;
  propiedad_id: number;
  propiedad_nombre: string;
  nombre_huesped: string;
  celular_huesped: string | null;
  fecha_checkout: string;
  tipo: "7_dias" | "1_dia";
  mensaje: string;
}

interface EnviadaRow {
  reserva_id: number;
  tipo: string;
}

function calcularDuracion(inicio: string, fin: string): number {
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  const opciones: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return d.toLocaleDateString("es-HN", opciones);
}

function generarMensaje(
  tipo: "7_dias" | "1_dia",
  nombreHuesped: string,
  propiedadNombre: string,
  fechaCheckout: string,
  instrucciones: string | null
): string {
  const fechaFormateada = formatearFecha(fechaCheckout);

  if (tipo === "7_dias") {
    let msg =
      `Hola ${nombreHuesped}, le recordamos que su estadía en *${propiedadNombre}* ` +
      `finaliza el *${fechaFormateada}*. Quedan 7 días para su check-out.`;
    if (instrucciones) {
      msg += `\n\nInstrucciones de salida:\n${instrucciones}`;
    }
    msg += "\n\nGracias por su preferencia. ¡Estamos para servirle!";
    return msg;
  }

  let msg =
    `Hola ${nombreHuesped}, le recordamos que su check-out en *${propiedadNombre}* ` +
    `es *mañana ${fechaFormateada}*.`;
  if (instrucciones) {
    msg += `\n\nInstrucciones de salida:\n${instrucciones}`;
  }
  msg +=
    "\n\nPor favor asegúrese de revisar las instrucciones de salida. ¡Gracias por hospedarse con nosotros!";
  return msg;
}

function evaluarNotificaciones(
  reservas: RawReservaWithProp[],
  enviadas: EnviadaRow[],
  ahora: Date
): NotificacionPendiente[] {
  const enviadasSet = new Set(
    enviadas.map((e) => `${e.reserva_id}:${e.tipo}`)
  );
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const pendientes: NotificacionPendiente[] = [];

  for (const reserva of reservas) {
    const prop = Array.isArray(reserva.propiedades)
      ? reserva.propiedades[0]
      : reserva.propiedades;
    const propNombre = prop?.nombre ?? `Propiedad #${reserva.propiedad_id}`;
    const instrucciones = prop?.instrucciones ?? null;

    const duracion = calcularDuracion(reserva.fecha_inicio, reserva.fecha_fin);
    const checkout = new Date(reserva.fecha_fin);
    const diasHastaCheckout = Math.round(
      (checkout.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (duracion > 7 && diasHastaCheckout === 7) {
      const key = `${reserva.id}:7_dias`;
      if (!enviadasSet.has(key)) {
        pendientes.push({
          reserva_id: reserva.id,
          propiedad_id: reserva.propiedad_id,
          propiedad_nombre: propNombre,
          nombre_huesped: reserva.nombre_huesped,
          celular_huesped: reserva.celular_huesped,
          fecha_checkout: reserva.fecha_fin,
          tipo: "7_dias",
          mensaje: generarMensaje(
            "7_dias",
            reserva.nombre_huesped,
            propNombre,
            reserva.fecha_fin,
            instrucciones
          ),
        });
      }
    }

    if (diasHastaCheckout === 1) {
      const key = `${reserva.id}:1_dia`;
      if (!enviadasSet.has(key)) {
        pendientes.push({
          reserva_id: reserva.id,
          propiedad_id: reserva.propiedad_id,
          propiedad_nombre: propNombre,
          nombre_huesped: reserva.nombre_huesped,
          celular_huesped: reserva.celular_huesped,
          fecha_checkout: reserva.fecha_fin,
          tipo: "1_dia",
          mensaje: generarMensaje(
            "1_dia",
            reserva.nombre_huesped,
            propNombre,
            reserva.fecha_fin,
            instrucciones
          ),
        });
      }
    }
  }

  return pendientes;
}

router.get(
  "/notificaciones/pendientes",
  async (_req: Request, res: Response): Promise<void> => {
    if (!supabase) {
      res.status(503).json({ error: "Supabase no configurado" });
      return;
    }

    try {
      const hoy = new Date();
      const en8Dias = new Date(hoy);
      en8Dias.setDate(en8Dias.getDate() + 8);

      const { data: reservas, error: resErr } = await supabase
        .from("reservas")
        .select(
          "id, propiedad_id, fecha_inicio, fecha_fin, nombre_huesped, celular_huesped, propiedades(nombre, instrucciones)"
        )
        .gte("fecha_fin", hoy.toISOString().split("T")[0])
        .lte("fecha_fin", en8Dias.toISOString().split("T")[0]);

      if (resErr) throw resErr;

      const { data: enviadas, error: envErr } = await supabase
        .from("notificaciones_enviadas")
        .select("reserva_id, tipo");

      const enviadasSafe: EnviadaRow[] =
        envErr ? [] : (enviadas ?? []) as EnviadaRow[];

      const pendientes = evaluarNotificaciones(
        (reservas ?? []) as RawReservaWithProp[],
        enviadasSafe,
        hoy
      );

      res.json({ pendientes, total: pendientes.length });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al evaluar notificaciones";
      res.status(500).json({ error: message });
    }
  }
);

const TIPOS_VALIDOS = ["7_dias", "1_dia"] as const;
type TipoNotificacion = (typeof TIPOS_VALIDOS)[number];

interface WebhookBody {
  reserva_id: number;
  tipo: TipoNotificacion;
  mensaje: string;
  propiedad_id: number;
  celular_huesped?: string | null;
  nombre_huesped?: string | null;
}

router.post(
  "/notificaciones/webhook",
  async (req: Request, res: Response): Promise<void> => {
    if (!supabase) {
      res.status(503).json({ error: "Supabase no configurado" });
      return;
    }

    const body = req.body as WebhookBody;

    if (!body.reserva_id || !body.tipo || !body.mensaje || !body.propiedad_id) {
      res.status(400).json({
        error:
          "Campos requeridos: reserva_id, tipo, mensaje, propiedad_id",
      });
      return;
    }

    if (!TIPOS_VALIDOS.includes(body.tipo as TipoNotificacion)) {
      res.status(400).json({
        error: `Tipo inválido: '${body.tipo}'. Valores válidos: ${TIPOS_VALIDOS.join(", ")}`,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("notificaciones_enviadas")
        .insert({
          reserva_id: body.reserva_id,
          propiedad_id: body.propiedad_id,
          tipo: body.tipo,
          mensaje: body.mensaje,
          celular_huesped: body.celular_huesped ?? null,
          nombre_huesped: body.nombre_huesped ?? null,
        });

      if (error) {
        if ("code" in error && error.code === "23505") {
          res.json({
            ok: true,
            message: "Notificación ya fue enviada anteriormente",
            duplicate: true,
          });
          return;
        }
        const msg =
          "message" in error ? (error.message as string) : "";
        if (
          error.code === "42P01" ||
          msg.includes("relation") ||
          msg.includes("does not exist")
        ) {
          res.status(503).json({
            error:
              "La tabla notificaciones_enviadas no existe. Ejecute la migración 006.",
          });
          return;
        }
        throw error;
      }

      console.log(
        `[Webhook] Notificación registrada: reserva=${body.reserva_id} tipo=${body.tipo}`
      );

      res.json({ ok: true, message: "Notificación registrada como enviada" });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al registrar notificación";
      res.status(500).json({ error: message });
    }
  }
);

router.get(
  "/notificaciones/enviadas",
  async (_req: Request, res: Response): Promise<void> => {
    if (!supabase) {
      res.status(503).json({ error: "Supabase no configurado" });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notificaciones_enviadas")
        .select("*")
        .order("enviado_en", { ascending: false })
        .limit(50);

      if (error) {
        res.json({ enviadas: [] });
        return;
      }
      res.json({ enviadas: data ?? [] });
    } catch {
      res.json({ enviadas: [] });
    }
  }
);

export default router;
