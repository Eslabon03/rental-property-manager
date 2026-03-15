import { Router, type Request, type Response } from "express";
import {
  GoogleGenerativeAI,
  type FunctionDeclarationSchemaType,
  type FunctionDeclaration,
  type Content,
  type Part,
} from "@google/generative-ai";
import { supabase } from "../lib/supabase";

const router = Router();

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
  role: "user" | "assistant";
  content: string;
}

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "consultar_reservas",
    description:
      "Consulta reservaciones de propiedades. Puede filtrar por propiedad, rango de fechas, nombre de huésped, canal de renta. Útil para verificar disponibilidad, calcular ingresos, listar próximas reservas.",
    parameters: {
      type: "OBJECT" as FunctionDeclarationSchemaType,
      properties: {
        propiedad_id: {
          type: "NUMBER" as FunctionDeclarationSchemaType,
          description: "ID de la propiedad para filtrar",
        },
        fecha_inicio_desde: {
          type: "STRING" as FunctionDeclarationSchemaType,
          description: "Filtrar reservas que inician desde esta fecha (YYYY-MM-DD)",
        },
        fecha_fin_hasta: {
          type: "STRING" as FunctionDeclarationSchemaType,
          description: "Filtrar reservas que terminan hasta esta fecha (YYYY-MM-DD)",
        },
        nombre_huesped: {
          type: "STRING" as FunctionDeclarationSchemaType,
          description: "Buscar por nombre de huésped (búsqueda parcial)",
        },
        canal_renta: {
          type: "STRING" as FunctionDeclarationSchemaType,
          description: "Filtrar por canal: Airbnb, Booking, Directo, etc.",
        },
        limite: {
          type: "NUMBER" as FunctionDeclarationSchemaType,
          description: "Número máximo de resultados (default 20)",
        },
      },
    },
  },
  {
    name: "consultar_propiedades",
    description:
      "Lista las propiedades disponibles con sus detalles. Puede filtrar por tipo (vacacional/mensual), nombre, o estado de alquiler.",
    parameters: {
      type: "OBJECT" as FunctionDeclarationSchemaType,
      properties: {
        tipo: {
          type: "STRING" as FunctionDeclarationSchemaType,
          description: "Filtrar por tipo: vacacional o mensual",
        },
        nombre: {
          type: "STRING" as FunctionDeclarationSchemaType,
          description: "Buscar por nombre de propiedad (búsqueda parcial)",
        },
        esta_alquilada: {
          type: "BOOLEAN" as FunctionDeclarationSchemaType,
          description: "Filtrar por estado de alquiler: true = alquiladas, false = disponibles",
        },
      },
    },
  },
  {
    name: "consultar_mantenimiento",
    description:
      "Consulta reportes de mantenimiento pendientes o resueltos. Puede filtrar por propiedad o estado.",
    parameters: {
      type: "OBJECT" as FunctionDeclarationSchemaType,
      properties: {
        propiedad_id: {
          type: "NUMBER" as FunctionDeclarationSchemaType,
          description: "Filtrar por ID de propiedad",
        },
        estado: {
          type: "STRING" as FunctionDeclarationSchemaType,
          description: "Filtrar por estado: pendiente o resuelto",
        },
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
): Promise<Record<string, unknown>> {
  if (!supabase) return { error: "Supabase no configurado" };

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
  if (error) return { error: error.message };
  return { total: (data ?? []).length, reservas: data ?? [] };
}

async function ejecutarConsultaPropiedades(
  params: PropiedadesParams
): Promise<Record<string, unknown>> {
  if (!supabase) return { error: "Supabase no configurado" };

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
  if (error) return { error: error.message };
  return { total: (data ?? []).length, propiedades: data ?? [] };
}

async function ejecutarConsultaMantenimiento(
  params: MantenimientoParams
): Promise<Record<string, unknown>> {
  if (!supabase) return { error: "Supabase no configurado" };

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
  if (error) return { error: error.message };
  return { total: (data ?? []).length, mantenimiento: data ?? [] };
}

async function ejecutarTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (name) {
    case "consultar_reservas":
      return ejecutarConsultaReservas(args as ReservasParams);
    case "consultar_propiedades":
      return ejecutarConsultaPropiedades(args as PropiedadesParams);
    case "consultar_mantenimiento":
      return ejecutarConsultaMantenimiento(args as MantenimientoParams);
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

router.post(
  "/chat",
  async (req: Request, res: Response): Promise<void> => {
    const geminiKey = process.env["GEMINI_API_KEY"];

    if (!geminiKey) {
      res.status(503).json({
        error: "GEMINI_API_KEY no configurada. Agrega tu API Key en los Secrets de Replit.",
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
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: toolDeclarations }],
      });

      const history: Content[] = body.messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const lastMessage = body.messages[body.messages.length - 1];
      if (!lastMessage) {
        res.write(`data: ${JSON.stringify({ error: "No message provided" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      }

      const chat = model.startChat({ history });

      const firstResult = await chat.sendMessage(lastMessage.content);
      const firstResponse = firstResult.response;
      const firstCandidateParts = firstResponse.candidates?.[0]?.content?.parts ?? [];

      const functionCalls = firstCandidateParts.filter(
        (p): p is Part & { functionCall: { name: string; args: Record<string, unknown> } } =>
          "functionCall" in p && p.functionCall !== undefined
      );

      if (functionCalls.length > 0) {
        const functionResponses: Part[] = [];

        for (const fc of functionCalls) {
          const result = await ejecutarTool(
            fc.functionCall.name,
            fc.functionCall.args ?? {}
          );
          functionResponses.push({
            functionResponse: {
              name: fc.functionCall.name,
              response: result,
            },
          });
        }

        const secondResult = await chat.sendMessageStream(functionResponses);

        for await (const chunk of secondResult.stream) {
          const text = chunk.text();
          if (text) {
            res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
          }
        }
      } else {
        const textParts = firstCandidateParts.filter(
          (p): p is Part & { text: string } => "text" in p && typeof p.text === "string"
        );

        if (textParts.length > 0) {
          const fullText = textParts.map((p) => p.text).join("");
          res.write(`data: ${JSON.stringify({ content: fullText })}\n\n`);
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
