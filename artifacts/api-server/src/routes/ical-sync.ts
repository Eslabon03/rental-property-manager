import { Router, type IRouter } from "express";
import ICAL from "ical.js";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

interface ICalPropRow {
  id: number;
  nombre: string;
  ical_url: string;
}

interface ExistingReservaRow {
  fecha_inicio: string;
  fecha_fin: string;
}

function parseICalEvents(icalText: string): Array<{ summary: string; dtstart: string; dtend: string }> {
  const jcalData = ICAL.parse(icalText);
  const comp = new ICAL.Component(jcalData);
  const events = comp.getAllSubcomponents("vevent");

  const results: Array<{ summary: string; dtstart: string; dtend: string }> = [];

  for (const event of events) {
    const icalEvent = new ICAL.Event(event);
    const summary = icalEvent.summary || "Reserva sincronizada";
    const startDate = icalEvent.startDate;
    const endDate = icalEvent.endDate;

    if (startDate && endDate) {
      const dtstart = `${startDate.year}-${String(startDate.month).padStart(2, "0")}-${String(startDate.day).padStart(2, "0")}`;
      const dtend = `${endDate.year}-${String(endDate.month).padStart(2, "0")}-${String(endDate.day).padStart(2, "0")}`;

      if (dtstart < dtend) {
        results.push({ summary, dtstart, dtend });
      }
    }
  }

  return results;
}

function detectCanal(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes("airbnb")) return "Airbnb";
  if (lower.includes("expedia")) return "Expedia";
  if (lower.includes("booking")) return "Booking";
  if (lower.includes("vrbo")) return "VRBO";
  return "iCal Sync";
}

router.post("/sync-ical", async (_req, res) => {
  if (!supabase) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  try {
    const { data: propiedades, error: propError } = await supabase
      .from("propiedades")
      .select("id, nombre, ical_url")
      .eq("tipo", "vacacional")
      .not("ical_url", "is", null);

    if (propError) throw propError;

    const propsWithUrl = ((propiedades ?? []) as ICalPropRow[]).filter(
      (p) => p.ical_url && p.ical_url.trim() !== ""
    );

    if (propsWithUrl.length === 0) {
      res.json({ message: "No hay propiedades con iCal configurado", synced: 0, details: [] });
      return;
    }

    const details: Array<{ propiedad: string; nuevas: number; error?: string }> = [];
    let totalSynced = 0;

    for (const prop of propsWithUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(prop.ical_url, {
          headers: { "User-Agent": "BarmelRentalSync/1.0" },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          details.push({ propiedad: prop.nombre, nuevas: 0, error: `HTTP ${response.status}` });
          continue;
        }

        const icalText = await response.text();
        const events = parseICalEvents(icalText);

        const today = new Date().toISOString().split("T")[0];
        const futureEvents = events.filter(e => e.dtend >= today);

        const { data: existingReservas } = await supabase
          .from("reservas")
          .select("fecha_inicio, fecha_fin")
          .eq("propiedad_id", prop.id)
          .eq("origen", "ical");

        const existingSet = new Set(
          ((existingReservas ?? []) as ExistingReservaRow[]).map(
            (r) => `${r.fecha_inicio}|${r.fecha_fin}`
          )
        );

        const newReservas = futureEvents.filter(
          e => !existingSet.has(`${e.dtstart}|${e.dtend}`)
        );

        if (newReservas.length > 0) {
          const rows = newReservas.map(e => ({
            propiedad_id: prop.id,
            nombre_huesped: e.summary,
            fecha_inicio: e.dtstart,
            fecha_fin: e.dtend,
            canal_renta: detectCanal(e.summary),
            origen: "ical",
            creado_por: "sync-ical",
          }));

          const { error: insertError } = await supabase.from("reservas").insert(rows);
          if (insertError) throw insertError;
        }

        details.push({ propiedad: prop.nombre, nuevas: newReservas.length });
        totalSynced += newReservas.length;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        details.push({ propiedad: prop.nombre, nuevas: 0, error: message });
      }
    }

    res.json({
      message: `Sincronización completada`,
      synced: totalSynced,
      details,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    res.status(500).json({ error: message });
  }
});

router.post("/sync-ical/:propiedadId", async (req, res) => {
  if (!supabase) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  const propiedadId = Number(req.params.propiedadId);

  try {
    const { data: prop, error: propError } = await supabase
      .from("propiedades")
      .select("id, nombre, ical_url")
      .eq("id", propiedadId)
      .single();

    if (propError || !prop) {
      res.status(404).json({ error: "Propiedad no encontrada" });
      return;
    }

    const typedProp = prop as ICalPropRow;

    if (!typedProp.ical_url) {
      res.status(400).json({ error: "Esta propiedad no tiene URL iCal configurada" });
      return;
    }

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(typedProp.ical_url, {
      headers: { "User-Agent": "BarmelRentalSync/1.0" },
      signal: controller.signal,
    });
    clearTimeout(fetchTimeout);

    if (!response.ok) {
      res.status(502).json({ error: `No se pudo obtener el calendario: HTTP ${response.status}` });
      return;
    }

    const icalText = await response.text();
    const events = parseICalEvents(icalText);

    const today = new Date().toISOString().split("T")[0];
    const futureEvents = events.filter(e => e.dtend >= today);

    const { data: existingReservas } = await supabase
      .from("reservas")
      .select("fecha_inicio, fecha_fin")
      .eq("propiedad_id", typedProp.id)
      .eq("origen", "ical");

    const existingSet = new Set(
      ((existingReservas ?? []) as ExistingReservaRow[]).map(
        (r) => `${r.fecha_inicio}|${r.fecha_fin}`
      )
    );

    const newReservas = futureEvents.filter(
      e => !existingSet.has(`${e.dtstart}|${e.dtend}`)
    );

    if (newReservas.length > 0) {
      const rows = newReservas.map(e => ({
        propiedad_id: typedProp.id,
        nombre_huesped: e.summary,
        fecha_inicio: e.dtstart,
        fecha_fin: e.dtend,
        canal_renta: detectCanal(e.summary),
        origen: "ical",
        creado_por: "sync-ical",
      }));

      const { error: insertError } = await supabase.from("reservas").insert(rows);
      if (insertError) throw insertError;
    }

    res.json({
      message: `Sincronización completada para ${typedProp.nombre}`,
      synced: newReservas.length,
      total_eventos: futureEvents.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    res.status(500).json({ error: message });
  }
});

export default router;
