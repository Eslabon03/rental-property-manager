import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

interface ReservaRow {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_huesped: string;
  canal_renta: string | null;
  creado_en: string;
}

interface PropiedadRow {
  id: number;
  nombre: string;
}

function formatICalDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

router.get("/export-ical/:propiedadId", async (req, res) => {
  if (!supabase) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  const propiedadId = Number(req.params.propiedadId);

  try {
    const { data: prop, error: propError } = await supabase
      .from("propiedades")
      .select("id, nombre")
      .eq("id", propiedadId)
      .single();

    if (propError || !prop) {
      res.status(404).json({ error: "Propiedad no encontrada" });
      return;
    }

    const typedProp = prop as PropiedadRow;

    const { data: reservas, error: resError } = await supabase
      .from("reservas")
      .select("id, fecha_inicio, fecha_fin, nombre_huesped, canal_renta, creado_en")
      .eq("propiedad_id", propiedadId)
      .eq("origen", "manual")
      .order("fecha_inicio", { ascending: true });

    if (resError) throw resError;

    const typedReservas = (reservas ?? []) as ReservaRow[];

    const now = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

    const events = typedReservas.map((r) => {
      const uid = `reserva-${r.id}@barmel-rentas`;
      const dtstart = formatICalDate(r.fecha_inicio);
      const dtend = formatICalDate(r.fecha_fin);
      const summary = escapeICalText(`Reserva - ${typedProp.nombre}`);
      const created = r.creado_en
        ? r.creado_en.replace(/[-:]/g, "").replace(/\.\d+.*$/, "Z")
        : now;

      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${summary}`,
        `DTSTAMP:${now}`,
        `CREATED:${created}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    });

    const calName = escapeICalText(`Barmel - ${typedProp.nombre}`);
    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Barmel Rentas//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${calName}`,
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    const filename = `barmel-${typedProp.nombre.toLowerCase().replace(/\s+/g, "-")}.ics`;
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(ical);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    res.status(500).json({ error: message });
  }
});

export default router;
