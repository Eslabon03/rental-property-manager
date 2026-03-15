import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Loader2, Bot, User, AlertCircle } from "lucide-react";
import { useRole, useUserEmail } from "@/lib/roles";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AsistenteChat() {
  const role = useRole();
  const email = useUserEmail();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const BASE_URL = import.meta.env.BASE_URL;

  if (role !== "admin") return null;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const enviarMensaje = async () => {
    const texto = input.trim();
    if (!texto || loading) return;

    const nuevosMensajes: Message[] = [
      ...messages,
      { role: "user", content: texto },
    ];
    setMessages(nuevosMensajes);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${BASE_URL}api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nuevosMensajes,
          userEmail: email,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(
          (data as Record<string, string>).error ?? "Error del servidor"
        );
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No se pudo leer la respuesta");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const parsed = JSON.parse(jsonStr) as {
              content?: string;
              done?: boolean;
              error?: string;
            };
            if (parsed.error) {
              setError(parsed.error);
            } else if (parsed.content) {
              assistantContent += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: assistantContent,
                  };
                }
                return updated;
              });
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (!assistantContent && !error) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            updated.pop();
          }
          return updated;
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al conectar con el asistente";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 z-[60] w-[calc(100vw-2rem)] max-w-[400px] h-[500px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          >
            <div className="bg-[#1e293b] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Bot size={18} className="text-blue-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    Asistente Barmel
                  </h3>
                  <p className="text-[10px] text-blue-300/80">
                    IA con acceso a datos en tiempo real
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
                    <Bot size={28} className="text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Hola, soy tu asistente
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Puedo consultar reservas, disponibilidad, ingresos y mantenimiento. Pregunta lo que necesites.
                  </p>
                  <div className="mt-4 space-y-2 w-full">
                    {[
                      "¿Qué reservas hay esta semana?",
                      "¿Cuánto se ha generado este mes?",
                      "¿Hay mantenimiento pendiente?",
                    ].map((sugerencia) => (
                      <button
                        key={sugerencia}
                        onClick={() => {
                          setInput(sugerencia);
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        className="w-full text-left text-xs px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
                      >
                        {sugerencia}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={14} className="text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
                    }`}
                  >
                    {msg.content ||
                      (loading && i === messages.length - 1 ? (
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <Loader2 size={14} className="animate-spin" />
                          Consultando...
                        </span>
                      ) : null)}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-gray-200 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  disabled={loading}
                  className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all disabled:opacity-50 placeholder:text-gray-400"
                />
                <button
                  onClick={enviarMensaje}
                  disabled={loading || !input.trim()}
                  className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:hover:bg-blue-600"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-24 right-4 z-[60] w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-90 transition-all flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        style={{ display: open ? "none" : "flex" }}
      >
        <MessageSquare size={24} />
      </motion.button>
    </>
  );
}
