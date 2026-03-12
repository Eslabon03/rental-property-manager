import { useState, useMemo } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Calendar as CalendarIcon, Building2, User, Clock, UserCheck, Warehouse, ArrowLeft, MapPin, Home, Briefcase, ToggleLeft, ToggleRight, Link2, FileText, RefreshCw, Check, Loader2, MessageCircle } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { Button, Card, Badge, FAB, Modal, Input, Select } from "@/components/ui";

type PropiedadJoin = {
  nombre: string;
  tipo: string;
  pais: string;
  instrucciones: string | null;
};

type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
  renta_fija_lps: number | null;
  esta_alquilada: boolean;
  ical_url: string | null;
  instrucciones: string | null;
};

type ReservaConPropiedad = {
  id: number;
  propiedad_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_huesped: string;
  celular_huesped: string | null;
  canal_renta: string | null;
  creado_por: string | null;
  origen: string | null;
  propiedades: PropiedadJoin | null;
};

type PropertyFormData = {
  nombre: string;
  tipo: string;
  pais: string;
  renta_fija_lps: number;
  instrucciones: string;
};

function useReservasProximas() {
  return useQuery<ReservaConPropiedad[]>({
    queryKey: ["reservas-proximas"],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("reservas")
        .select("id, propiedad_id, fecha_inicio, fecha_fin, nombre_huesped, celular_huesped, canal_renta, creado_por, origen, propiedades(nombre, tipo, pais, instrucciones)")
        .gte("fecha_fin", today)
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        propiedad_id: r.propiedad_id,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        nombre_huesped: r.nombre_huesped,
        celular_huesped: r.celular_huesped,
        canal_renta: r.canal_renta,
        creado_por: r.creado_por,
        origen: r.origen ?? null,
        propiedades: Array.isArray(r.propiedades) ? r.propiedades[0] ?? null : r.propiedades ?? null,
      }));
    },
  });
}

function usePropiedades() {
  return useQuery<Propiedad[]>({
    queryKey: ["supabase-propiedades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propiedades")
        .select("id, nombre, tipo, pais, renta_fija_lps, esta_alquilada, ical_url, instrucciones")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function getReservationStatus(fechaInicio: string, fechaFin: string): { label: string; variant: "success" | "warning" | "default" } {
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(fechaInicio));
  const end = startOfDay(parseISO(fechaFin));

  if (isBefore(today, start)) {
    return { label: "Próxima", variant: "warning" };
  }
  if (!isBefore(today, start) && !isBefore(end, today)) {
    return { label: "En curso", variant: "success" };
  }
  return { label: "Reserva", variant: "default" };
}

export default function Inicio() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInventario, setShowInventario] = useState(false);
  const { data: reservas, isLoading, isError, refetch } = useReservasProximas();

  if (showInventario) {
    return <InventarioPropiedades onBack={() => setShowInventario(false)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Reservas Próximas</h2>
        <p className="text-muted-foreground text-sm mt-1">Propiedades con huéspedes por llegar o en estadía</p>
      </div>

      <button
        onClick={() => setShowInventario(true)}
        className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all shadow-sm group"
      >
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Warehouse size={20} className="text-primary" />
        </div>
        <div className="text-left flex-1">
          <span className="text-sm font-bold text-foreground">Inventario de Propiedades</span>
          <p className="text-xs text-muted-foreground">Ver todas las propiedades vacacionales y mensuales</p>
        </div>
        <ArrowLeft size={16} className="text-muted-foreground rotate-180" />
      </button>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-card rounded-3xl border border-dashed border-destructive/30">
          <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
            <CalendarIcon size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Error al cargar</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">No se pudieron cargar las reservas. Intenta de nuevo.</p>
          <Button onClick={() => refetch()}>Reintentar</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : reservas?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <CalendarIcon size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Sin reservas próximas</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">No hay reservas activas o por venir en este momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservas?.map(r => (
            <ReservaCard key={r.id} reserva={r} />
          ))}
        </div>
      )}

      <FAB onClick={() => setIsModalOpen(true)} />
      <PropertyFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function InventarioPropiedades({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: propiedades, isLoading } = usePropiedades();

  const vacacionales = useMemo(() => propiedades?.filter(p => p.tipo === "vacacional") ?? [], [propiedades]);
  const mensuales = useMemo(() => propiedades?.filter(p => p.tipo === "mensual") ?? [], [propiedades]);

  const toggleAlquilada = async (id: number, value: boolean) => {
    const { error } = await supabase.from("propiedades").update({ esta_alquilada: value }).eq("id", id);
    if (error) { console.error("Error updating property:", error); return; }
    queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
  };

  const saveField = async (id: number, field: string, value: string | null) => {
    const { error } = await supabase.from("propiedades").update({ [field]: value }).eq("id", id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Inventario de Propiedades</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{propiedades?.length ?? 0} propiedades registradas</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : (
        <>
          {vacacionales.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Home size={16} className="text-primary" />
                <h3 className="text-lg font-bold text-foreground">Vacacionales</h3>
                <Badge variant="default" className="text-xs ml-auto">{vacacionales.length}</Badge>
              </div>
              {vacacionales.map(p => (
                <PropiedadCard key={p.id} propiedad={p} onToggle={toggleAlquilada} onSaveField={saveField} />
              ))}
            </div>
          )}

          {mensuales.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-primary" />
                <h3 className="text-lg font-bold text-foreground">Mensuales</h3>
                <Badge variant="default" className="text-xs ml-auto">{mensuales.length}</Badge>
              </div>
              {mensuales.map(p => (
                <PropiedadCard key={p.id} propiedad={p} onToggle={toggleAlquilada} onSaveField={saveField} showRenta />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PropiedadCard({ propiedad, onToggle, onSaveField, showRenta }: {
  propiedad: Propiedad;
  onToggle: (id: number, val: boolean) => void;
  onSaveField: (id: number, field: string, value: string | null) => Promise<void>;
  showRenta?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [icalUrl, setIcalUrl] = useState(propiedad.ical_url ?? "");
  const [instrucciones, setInstrucciones] = useState(propiedad.instrucciones ?? "");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleSave = async (field: string, value: string) => {
    setSavingField(field);
    try {
      await onSaveField(propiedad.id, field, value || null);
      setSavedField(field);
      setTimeout(() => setSavedField(null), 2000);
    } catch {
      setSavedField(null);
    }
    setSavingField(null);
  };

  const handleSync = async () => {
    if (!propiedad.ical_url) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const base = import.meta.env.BASE_URL;
      const resp = await fetch(`${base}api/sync-ical/${propiedad.id}`, { method: "POST" });
      const data = await resp.json();
      if (resp.ok) {
        setSyncMsg(`${data.synced} nueva(s) reserva(s) sincronizada(s)`);
        queryClient.invalidateQueries({ queryKey: ["reservas-proximas"] });
      } else {
        setSyncMsg(data.error || "Error al sincronizar");
      }
    } catch {
      setSyncMsg("Error de conexión");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  const isVacacional = propiedad.tipo === "vacacional";

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full ${propiedad.esta_alquilada ? "bg-emerald-500" : "bg-slate-300"}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <h4 className="text-sm font-bold leading-tight truncate">{propiedad.nombre}</h4>
            <div className="flex items-center text-muted-foreground text-xs mt-1 gap-2">
              <div className="flex items-center">
                <MapPin size={12} className="mr-0.5" />
                {propiedad.pais}
              </div>
              {showRenta && propiedad.renta_fija_lps && (
                <span className="font-semibold text-foreground/70">L {propiedad.renta_fija_lps.toLocaleString("es-HN")}</span>
              )}
              {isVacacional && propiedad.ical_url && (
                <span className="text-primary">
                  <Link2 size={12} />
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => onToggle(propiedad.id, !propiedad.esta_alquilada)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
              propiedad.esta_alquilada
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {propiedad.esta_alquilada ? (
              <>
                <ToggleRight size={14} />
                Alquilada
              </>
            ) : (
              <>
                <ToggleLeft size={14} />
                Disponible
              </>
            )}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <FileText size={12} />
                Instrucciones
              </label>
              <textarea
                className="w-full text-sm p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                rows={3}
                placeholder="Instrucciones para el huésped..."
                value={instrucciones}
                onChange={e => setInstrucciones(e.target.value)}
              />
              <button
                onClick={() => handleSave("instrucciones", instrucciones)}
                disabled={savingField === "instrucciones"}
                className="mt-1 text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
              >
                {savingField === "instrucciones" ? <Loader2 size={12} className="animate-spin" /> : savedField === "instrucciones" ? <Check size={12} /> : null}
                {savedField === "instrucciones" ? "Guardado" : savingField === "instrucciones" ? "Guardando..." : "Guardar instrucciones"}
              </button>
            </div>

            {isVacacional && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <Link2 size={12} />
                  URL iCal (Airbnb / Expedia)
                </label>
                <input
                  type="url"
                  className="w-full text-sm p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  value={icalUrl}
                  onChange={e => setIcalUrl(e.target.value)}
                />
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleSave("ical_url", icalUrl)}
                    disabled={savingField === "ical_url"}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    {savingField === "ical_url" ? <Loader2 size={12} className="animate-spin" /> : savedField === "ical_url" ? <Check size={12} /> : null}
                    {savedField === "ical_url" ? "Guardado" : savingField === "ical_url" ? "Guardando..." : "Guardar URL"}
                  </button>
                  {propiedad.ical_url && (
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
                      {syncing ? "Sincronizando..." : "Sincronizar ahora"}
                    </button>
                  )}
                </div>
                {syncMsg && (
                  <p className="text-xs text-muted-foreground mt-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1">{syncMsg}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ReservaCard({ reserva }: { reserva: ReservaConPropiedad }) {
  const status = getReservationStatus(reserva.fecha_inicio, reserva.fecha_fin);
  const propNombre = reserva.propiedades?.nombre ?? `Propiedad #${reserva.propiedad_id}`;
  const isIcal = reserva.origen === "ical";
  const instrucciones = reserva.propiedades?.instrucciones ?? null;

  const whatsappMsg = (() => {
    let msg = `Hola ${reserva.nombre_huesped}, bienvenido(a) a ${propNombre}.\n`;
    msg += `Su reserva es del ${format(parseISO(reserva.fecha_inicio), "dd/MM/yyyy")} al ${format(parseISO(reserva.fecha_fin), "dd/MM/yyyy")}.\n`;
    if (instrucciones) {
      msg += `\nInstrucciones:\n${instrucciones}\n`;
    }
    msg += `\nGracias por su reserva. Cualquier consulta, estamos a la orden.`;
    return msg;
  })();

  return (
    <Card className={`overflow-hidden ${isIcal ? "border-l-4 border-l-amber-400" : ""}`}>
      <div className={`h-1.5 w-full ${status.variant === "success" ? "bg-emerald-500" : status.variant === "warning" ? "bg-amber-500" : "bg-slate-400"}`} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold leading-tight truncate">{propNombre}</h4>
              <div className="flex items-center text-muted-foreground text-xs mt-0.5">
                <User size={12} className="mr-1 shrink-0" />
                <span className="truncate">{reserva.nombre_huesped}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isIcal && <Badge variant="warning" className="text-[10px]">Sync</Badge>}
            <Badge variant={status.variant} className="shrink-0 text-xs">{status.label}</Badge>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 flex items-center justify-between border border-border/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Check-in</span>
            <span className="font-semibold text-xs">
              {format(parseISO(reserva.fecha_inicio), "dd MMM yyyy", { locale: es })}
            </span>
          </div>
          <div className="h-6 w-px bg-border mx-3"></div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Check-out</span>
            <span className="font-semibold text-xs">
              {format(parseISO(reserva.fecha_fin), "dd MMM yyyy", { locale: es })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {reserva.canal_renta && (
            <div className="flex items-center text-muted-foreground text-xs">
              <Clock size={12} className="mr-1 shrink-0" />
              <span>{reserva.canal_renta}</span>
            </div>
          )}
          {reserva.creado_por && (
            <div className="flex items-center text-muted-foreground text-xs">
              <UserCheck size={12} className="mr-1 shrink-0" />
              <span>{reserva.creado_por}</span>
            </div>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors ml-auto"
          >
            <MessageCircle size={12} />
            WhatsApp
          </a>
        </div>
      </div>
    </Card>
  );
}

function PropertyFormModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PropertyFormData>();

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: PropertyFormData) => {
      const { error } = await supabase.from("propiedades").insert({
        nombre: data.nombre,
        tipo: data.tipo,
        pais: data.pais,
        renta_fija_lps: data.renta_fija_lps ? Number(data.renta_fija_lps) : null,
        instrucciones: data.instrucciones || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
      reset();
      onClose();
    },
  });

  const onSubmit = (data: PropertyFormData) => {
    mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Propiedad">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Nombre de la propiedad"
          placeholder="Ej: Apartamento Roatán"
          {...register("nombre", { required: "El nombre es requerido" })}
          error={errors.nombre?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Tipo" {...register("tipo", { required: "El tipo es requerido" })} error={errors.tipo?.message}>
            <option value="vacacional">Vacacional</option>
            <option value="mensual">Mensual</option>
          </Select>

          <Input
            label="País"
            placeholder="Ej: Honduras"
            {...register("pais", { required: "El país es requerido" })}
            error={errors.pais?.message}
          />
        </div>

        <Input
          label="Renta / Precio Mensual (LPS)"
          type="number" min="0"
          placeholder="Ej: 17000 (opcional)"
          {...register("renta_fija_lps", { valueAsNumber: true })}
        />

        <Input
          label="Instrucciones"
          placeholder="Notas o instrucciones (opcional)"
          {...register("instrucciones")}
        />

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar Propiedad"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
