import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { supabase } from "../lib/supabase";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

const SYSTEM_PROMPT = `Eres el asistente virtual de Barmel, una empresa de gestión de propiedades de alquiler en Honduras. Tu nombre es "Asistente Barmel".

Responde siempre en español. Sé conciso, profesional y útil.

Tienes acceso a herramientas para consultar la base de datos en tiempo real:
- consultar_reservas: Para buscar reservaciones, verificar disponibilidad, ver ingresos
- consultar_propiedades: Para ver las propiedades disponibles, sus tipos y detalles
- consultar_mantenimiento: Para revisar reportes de mantenimiento pendientes

Cuando el usuario pregunte sobre disponibilidad, ingresos, reservas o propiedades, USA las herramientas para obtener datos reales. No inventes datos.

Contexto de negocio:
- Las propiedades son de tipo "vacacional" (alquiler corto plazo) o "mensual" (renta fija)
- Los montos están en Lempiras (L)
- monto_bruto = ingreso total, monto_neto = ingreso después de comisiones
- canal_renta indica de dónde viene la reserva (Airbnb, Booking, Directo, etc.)
- origen puede ser "manual" o "ical" (sincronizado de calendario externo)
- Las fechas están en formato ISO (YYYY-MM-DD)

Formatea los montos como "L X,XXX.XX" y las fechas de forma legible en español.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "consultar_reservas",
      description:
        "Consulta reservaciones de propiedades. Puede filtrar por propiedad, rango de fechas, nombre de huésped, canal de renta. Útil para verificar disponibilidad, calcular ingresos, listar próximas reservas.",
      parameters: {
        type: "object",
        properties: {
          propiedad_id: {
            type: "number",
            description: "ID de la propiedad para filtrar",
          },
          fecha_inicio_desde: {
            type: "string",
            description: "Filtrar reservas que inician desde esta fecha (YYYY-MM-DD)",
          },
          fecha_fin_hasta: {
            type: "string",
            description: "Filtrar reservas que terminan hasta esta fecha (YYYY-MM-DD)",
          },
          nombre_huesped: {
            type: "string",
            description: "Buscar por nombre de huésped (búsqueda parcial)",
          },
          canal_renta: {
            type: "string",
            description: "Filtrar por canal: Airbnb, Booking, Directo, etc.",
          },
          limite: {
            type: "number",
            description: "Número máximo de resultados (default 20)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_propiedades",
      description:
        "Lista las propiedades disponibles con sus detalles. Puede filtrar por tipo (vacacional/mensual), nombre, o estado de alquiler.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            description: "Filtrar por tipo: vacacional o mensual",
          },
          nombre: {
            type: "string",
            description: "Buscar por nombre de propiedad (búsqueda parcial)",
          },
          esta_alquilada: {
            type: "boolean",
            description: "Filtrar por estado de alquiler: true = alquiladas, false = disponibles",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_mantenimiento",
      description:
        "Consulta reportes de mantenimiento pendientes o resueltos. Puede filtrar por propiedad o estado.",
      parameters: {
        type: "object",
        properties: {
          propiedad_id: {
            type: "number",
            description: "Filtrar por ID de propiedad",
          },
          estado: {
            type: "string",
            description: "Filtrar por estado: pendiente o resuelto",
          },
        },
        required: [],
      },
    },
  },
];

interface ReservasParams {
  propiedad_id?: number;
  fecha_inicio_desde?: string;
  fecha_fin_hasta?: string;
  nombre_huesped?: string;
  canal_renta?: string;
  limite?: number;
}

interface PropiedadesParams {
  tipo?: string;
  nombre?: string;
  esta_alquilada?: boolean;
}

interface MantenimientoParams {
  propiedad_id?: number;
  estado?: string;
}

async function ejecutarConsultaReservas(
  params: ReservasParams
): Promise<string> {
  if (!supabase) return JSON.stringify({ error: "Supabase no configurado" });

  let query = supabase
    .from("reservas")
    .select(
      "id, propiedad_id, fecha_inicio, fecha_fin, nombre_huesped, celular_huesped, canal_renta, monto_bruto, monto_neto, origen, propiedades(nombre)"
    )
    .order("fecha_inicio", { ascending: false })
    .limit(params.limite ?? 20);

  if (params.propiedad_id) {
    query = query.eq("propiedad_id", params.propiedad_id);
  }
  if (params.fecha_inicio_desde) {
    query = query.gte("fecha_inicio", params.fecha_inicio_desde);
  }
  if (params.fecha_fin_hasta) {
    query = query.lte("fecha_fin", params.fecha_fin_hasta);
  }
  if (params.nombre_huesped) {
    query = query.ilike("nombre_huesped", `%${params.nombre_huesped}%`);
  }
  if (params.canal_renta) {
    query = query.ilike("canal_renta", `%${params.canal_renta}%`);
  }

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ total: (data ?? []).length, reservas: data ?? [] });
}

async function ejecutarConsultaPropiedades(
  params: PropiedadesParams
): Promise<string> {
  if (!supabase) return JSON.stringify({ error: "Supabase no configurado" });

  let query = supabase
    .from("propiedades")
    .select("id, nombre, tipo, pais, renta_fija_lps, instrucciones, esta_alquilada, ical_url")
    .order("nombre");

  if (params.tipo) {
    query = query.eq("tipo", params.tipo);
  }
  if (params.nombre) {
    query = query.ilike("nombre", `%${params.nombre}%`);
  }
  if (typeof params.esta_alquilada === "boolean") {
    query = query.eq("esta_alquilada", params.esta_alquilada);
  }

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: (data ?? []).length,
    propiedades: data ?? [],
  });
}

async function ejecutarConsultaMantenimiento(
  params: MantenimientoParams
): Promise<string> {
  if (!supabase) return JSON.stringify({ error: "Supabase no configurado" });

  let query = supabase
    .from("mantenimiento_pendientes")
    .select("id, propiedad_id, descripcion, foto_url, estado, creado_en, creado_por")
    .order("creado_en", { ascending: false })
    .limit(30);

  if (params.propiedad_id) {
    query = query.eq("propiedad_id", params.propiedad_id);
  }
  if (params.estado) {
    query = query.eq("estado", params.estado);
  }

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: (data ?? []).length,
    mantenimiento: data ?? [],
  });
}

async function ejecutarTool(
  name: string,
  args: string
): Promise<string> {
  const parsed = JSON.parse(args) as Record<string, unknown>;
  switch (name) {
    case "consultar_reservas":
      return ejecutarConsultaReservas(parsed as ReservasParams);
    case "consultar_propiedades":
      return ejecutarConsultaPropiedades(parsed as PropiedadesParams);
    case "consultar_mantenimiento":
      return ejecutarConsultaMantenimiento(parsed as MantenimientoParams);
    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}

router.post(
  "/chat",
  async (req: Request, res: Response): Promise<void> => {
    const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

    if (!baseUrl || !apiKey) {
      res.status(503).json({
        error: "AI integration not configured",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token de autenticación requerido" });
      return;
    }

    if (!supabase) {
      res.status(503).json({ error: "Supabase no configurado" });
      return;
    }

    const token = authHeader.slice(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Token inválido o expirado" });
      return;
    }

    const userEmail = user.email ?? "";
    if (userEmail.toLowerCase().includes("limpieza")) {
      res.status(403).json({ error: "Acceso no autorizado" });
      return;
    }

    const body = req.body as {
      messages?: ChatMessage[];
    };

    if (!body.messages || !Array.isArray(body.messages)) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const firstResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 4096,
        messages,
        tools,
        tool_choice: "auto",
      });

      const firstChoice = firstResponse.choices[0];
      if (!firstChoice) {
        res.write(`data: ${JSON.stringify({ error: "No response from AI" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      }

      if (firstChoice.message.tool_calls && firstChoice.message.tool_calls.length > 0) {
        const toolCall = firstChoice.message.tool_calls[0];
        if (!toolCall || toolCall.type !== "function") {
          res.write(`data: ${JSON.stringify({ error: "Invalid tool call" })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          return;
        }

        const toolResult = await ejecutarTool(
          toolCall.function.name,
          toolCall.function.arguments
        );

        messages.push(firstChoice.message);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });

        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          max_completion_tokens: 4096,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (firstChoice.message.content) {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          max_completion_tokens: 4096,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err: unknown) {
      console.error("[Chat] Error:", err);
      const message =
        err instanceof Error ? err.message : "Error en el asistente";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  }
);

export default router;
