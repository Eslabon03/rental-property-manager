import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  ArrowRightLeft,
  Download,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUserEmail } from "@/lib/roles";
import { Button, Card, Modal, Select } from "@/components/ui";

type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
};

type Reserva = {
  id: number;
  propiedad_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_huesped: string;
  celular_huesped: string | null;
  canal_renta: string | null;
  origen: string | null;
  monto: number | null;
  monto_bruto: number | null;
  monto_neto: number | null;
};

const PROPERTY_COLORS = [
  { bg: "bg-blue-500", text: "text-white", light: "bg-blue-100 text-blue-800 border-blue-200" },
  { bg: "bg-emerald-500", text: "text-white", light: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { bg: "bg-amber-500", text: "text-white", light: "bg-amber-100 text-amber-800 border-amber-200" },
  { bg: "bg-purple-500", text: "text-white", light: "bg-purple-100 text-purple-800 border-purple-200" },
  { bg: "bg-rose-500", text: "text-white", light: "bg-rose-100 text-rose-800 border-rose-200" },
  { bg: "bg-cyan-500", text: "text-white", light: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { bg: "bg-orange-500", text: "text-white", light: "bg-orange-100 text-orange-800 border-orange-200" },
  { bg: "bg-indigo-500", text: "text-white", light: "bg-indigo-100 text-indigo-800 border-indigo-200" },
];

function getColorForIndex(i: number) {
  return PROPERTY_COLORS[i % PROPERTY_COLORS.length];
}

function useVacacionales() {
  return useQuery<Propiedad[]>({
    queryKey: ["calendario-propiedades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propiedades")
        .select("id, nombre, tipo, pais")
        .eq("tipo", "vacacional")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useReservasAll() {
  return useQuery<Reserva[]>({
    queryKey: ["calendario-reservas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export default function Calendario() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hiddenProps, setHiddenProps] = useState<Set<number>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchStart, setSearchStart] = useState("");
  const [searchEnd, setSearchEnd] = useState("");
  const [searchResults, setSearchResults] = useState<Propiedad[] | null>(null);
  const [swapReserva, setSwapReserva] = useState<Reserva | null>(null);
  const [swapTarget, setSwapTarget] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const userEmail = useUserEmail();

  const { data: propiedades = [] } = useVacacionales();
  const { data: reservas = [] } = useReservasAll();

  const propColorMap = useMemo(() => {
    const map: Record<number, ReturnType<typeof getColorForIndex>> = {};
    propiedades.forEach((p, i) => {
      map[p.id] = getColorForIndex(i);
    });
    return map;
  }, [propiedades]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);
  const paddingDays = startDow === 0 ? 6 : startDow - 1;

  const visibleReservas = useMemo(() => {
    return reservas.filter((r) => {
      if (hiddenProps.has(r.propiedad_id)) return false;
      const propExists = propiedades.some((p) => p.id === r.propiedad_id);
      if (!propExists) return false;
      return rangesOverlap(
        r.fecha_inicio,
        r.fecha_fin,
        format(monthStart, "yyyy-MM-dd"),
        format(addDays(monthEnd, 1), "yyyy-MM-dd")
      );
    });
  }, [reservas, hiddenProps, propiedades, monthStart, monthEnd]);

  const toggleProp = (id: number) => {
    setHiddenProps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = () => {
    if (!searchStart || !searchEnd || searchEnd <= searchStart) return;
    const free = propiedades.filter((p) => {
      const overlapping = reservas.some(
        (r) =>
          r.propiedad_id === p.id &&
          rangesOverlap(r.fecha_inicio, r.fecha_fin, searchStart, searchEnd)
      );
      return !overlapping;
    });
    setSearchResults(free);
  };

  const clearSearch = () => {
    setSearchStart("");
    setSearchEnd("");
    setSearchResults(null);
    setSearchOpen(false);
  };

  const handleSwap = async () => {
    if (!swapReserva || !swapTarget) return;
    setSwapError(null);
    const targetId = parseInt(swapTarget);
    const hasOverlap = reservas.some(
      (r) =>
        r.propiedad_id === targetId &&
        r.id !== swapReserva.id &&
        rangesOverlap(r.fecha_inicio, r.fecha_fin, swapReserva.fecha_inicio, swapReserva.fecha_fin)
    );
    if (hasOverlap) {
      setSwapError("La propiedad destino tiene reservas que se solapan con estas fechas.");
      return;
    }
    setSwapping(true);
    try {
      const { error } = await supabase
        .from("reservas")
        .update({
          propiedad_id: targetId,
          modificado_por: userEmail,
          modificado_en: new Date().toISOString(),
        })
        .eq("id", swapReserva.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["calendario-reservas"] });
      setSwapReserva(null);
      setSwapTarget("");
    } catch {
      setSwapError("Error al reasignar la reserva. Inténtalo de nuevo.");
    }
    setSwapping(false);
  };

  const getReservasForDay = useCallback(
    (day: Date) => {
      const dayStr = format(day, "yyyy-MM-dd");
      return visibleReservas.filter((r) => {
        const start = r.fecha_inicio;
        const end = r.fecha_fin;
        return dayStr >= start && dayStr < end;
      });
    },
    [visibleReservas]
  );

  const exportIcalUrl = (propId: number) => {
    const base = import.meta.env.BASE_URL;
    return `${base}api/export-ical/${propId}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold">Calendario</h2>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          <Search size={16} />
          Disponibilidad
        </button>
      </div>

      {searchOpen && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Search size={14} />
            Consultar Disponibilidad
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Desde</label>
              <input
                type="date"
                value={searchStart}
                onChange={(e) => setSearchStart(e.target.value)}
                className="w-full text-sm p-2 rounded-lg border border-border bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Hasta</label>
              <input
                type="date"
                value={searchEnd}
                onChange={(e) => setSearchEnd(e.target.value)}
                className="w-full text-sm p-2 rounded-lg border border-border bg-background"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSearch} disabled={!searchStart || !searchEnd || searchEnd <= searchStart}>
              Buscar
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSearch}>
              Limpiar
            </Button>
          </div>
          {searchResults !== null && (
            <div className="pt-2 border-t border-border">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay propiedades disponibles en ese rango.</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-emerald-600">
                    {searchResults.length} propiedad(es) disponible(s):
                  </p>
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-800 rounded-lg px-3 py-1.5"
                    >
                      <Check size={14} />
                      {p.nombre}
                      <span className="text-xs text-emerald-600 ml-auto">{p.pais}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        {propiedades.map((p, i) => {
          const color = getColorForIndex(i);
          const isHidden = hiddenProps.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggleProp(p.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                isHidden
                  ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60"
                  : `${color.light} border`
              }`}
            >
              {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
              {p.nombre.length > 18 ? p.nombre.slice(0, 18) + "…" : p.nombre}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-base font-bold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-bold text-muted-foreground py-2 border-b border-border bg-card/50"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[60px] border-b border-r border-border/30 bg-slate-50/50" />
          ))}

          {daysInMonth.map((day) => {
            const dayReservas = getReservasForDay(day);
            const isToday = isSameDay(day, new Date());
            const dayNum = day.getDate();

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[60px] border-b border-r border-border/30 p-0.5 relative ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                <div
                  className={`text-[11px] font-semibold px-1 ${
                    isToday
                      ? "text-primary"
                      : "text-foreground/70"
                  }`}
                >
                  {dayNum}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {dayReservas.slice(0, 3).map((r) => {
                    const color = propColorMap[r.propiedad_id];
                    const isIcal = r.origen === "ical";
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (isIcal) {
                            setSwapReserva(r);
                            setSwapTarget("");
                          }
                        }}
                        className={`w-full text-left text-[8px] leading-tight truncate px-1 py-0.5 rounded ${
                          color?.bg ?? "bg-gray-400"
                        } ${color?.text ?? "text-white"} ${
                          isIcal ? "cursor-pointer ring-1 ring-amber-300" : "cursor-default"
                        }`}
                        title={`${r.nombre_huesped} (${
                          propiedades.find((p) => p.id === r.propiedad_id)?.nombre ?? ""
                        })`}
                      >
                        {r.nombre_huesped.length > 12
                          ? r.nombre_huesped.slice(0, 12) + "…"
                          : r.nombre_huesped}
                      </button>
                    );
                  })}
                  {dayReservas.length > 3 && (
                    <div className="text-[8px] text-muted-foreground text-center">
                      +{dayReservas.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-muted-foreground">Exportar iCal (reservas manuales)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {propiedades.map((p) => (
            <a
              key={p.id}
              href={exportIcalUrl(p.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-sm"
            >
              <Download size={14} className="text-primary" />
              <span className="font-semibold truncate">{p.nombre}</span>
              <span className="text-xs text-muted-foreground ml-auto">.ics</span>
            </a>
          ))}
        </div>
      </div>

      <Modal
        isOpen={!!swapReserva}
        onClose={() => {
          setSwapReserva(null);
          setSwapTarget("");
        }}
        title="Reasignar Reserva"
      >
        {swapReserva && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              <p className="font-semibold text-amber-800">Reserva sincronizada (iCal)</p>
              <p className="text-amber-700 mt-1">
                <strong>{swapReserva.nombre_huesped}</strong>
              </p>
              <p className="text-amber-600 text-xs mt-0.5">
                {format(parseISO(swapReserva.fecha_inicio), "d MMM", { locale: es })} -{" "}
                {format(parseISO(swapReserva.fecha_fin), "d MMM yyyy", { locale: es })}
              </p>
              <p className="text-amber-600 text-xs">
                Propiedad actual:{" "}
                <strong>
                  {propiedades.find((p) => p.id === swapReserva.propiedad_id)?.nombre ?? "Desconocida"}
                </strong>
              </p>
            </div>

            <Select
              label="Mover a propiedad"
              value={swapTarget}
              onChange={(e) => setSwapTarget(e.target.value)}
            >
              <option value="">Seleccionar propiedad destino</option>
              {propiedades
                .filter((p) => p.id !== swapReserva.propiedad_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.pais})
                  </option>
                ))}
            </Select>

            {swapError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {swapError}
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSwap} disabled={!swapTarget || swapping} className="flex-1">
                {swapping ? (
                  <Loader2 size={16} className="animate-spin mr-1" />
                ) : (
                  <ArrowRightLeft size={16} className="mr-1" />
                )}
                {swapping ? "Moviendo..." : "Reasignar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSwapReserva(null);
                  setSwapTarget("");
                  setSwapError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
