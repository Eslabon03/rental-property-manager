import { useState, useMemo } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { format, eachDayOfInterval, parseISO, isBefore, isAfter, isSameDay, startOfDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import Calendar from "react-calendar";
import { Calendar as CalendarIcon, User, Phone, Radio, ChevronDown, AlertCircle, UserCheck, Edit3, MessageCircle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUserEmail } from "@/lib/roles";
import { Button, Card, Badge, FAB, Modal, Input, Select } from "@/components/ui";

type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
  instrucciones: string | null;
};

type Reserva = {
  id: number;
  propiedad_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_huesped: string;
  celular_huesped: string | null;
  canal_renta: string | null;
  creado_en: string;
  creado_por: string | null;
  modificado_por: string | null;
  modificado_en: string | null;
  origen: string | null;
  monto: number | null;
  monto_bruto: number | null;
  monto_neto: number | null;
};

type ReservaFormData = {
  propiedad_id: string;
  nombre_huesped: string;
  celular_huesped: string;
  canal_renta: string;
  fecha_inicio: string;
  fecha_fin: string;
  monto: string;
  monto_bruto: string;
  monto_neto: string;
};

function useSupabasePropiedadesVacacionales() {
  return useQuery<Propiedad[]>({
    queryKey: ["supabase-propiedades-vacacional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propiedades")
        .select("id, nombre, tipo, pais, instrucciones")
        .eq("tipo", "vacacional")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useSupabaseReservas(propiedadId: number | null) {
  return useQuery<Reserva[]>({
    queryKey: ["supabase-reservas", propiedadId],
    queryFn: async () => {
      let query = supabase.from("reservas").select("*").order("fecha_inicio", { ascending: true });
      if (propiedadId) {
        query = query.eq("propiedad_id", propiedadId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function getOccupiedDates(reservas: Reserva[]): Date[] {
  const dates: Date[] = [];
  for (const r of reservas) {
    const start = parseISO(r.fecha_inicio);
    const end = parseISO(r.fecha_fin);
    const days = eachDayOfInterval({ start, end });
    dates.push(...days);
  }
  return dates;
}

function isDateOccupied(date: Date, occupiedDates: Date[]): boolean {
  return occupiedDates.some(d => isSameDay(d, date));
}

function buildWhatsAppMessage(huesped: string, propiedad: string, instrucciones: string | null, fechaInicio: string, fechaFin: string): string {
  let msg = `Hola ${huesped}, bienvenido(a) a ${propiedad}.\n`;
  msg += `Su reserva es del ${format(parseISO(fechaInicio), "dd/MM/yyyy")} al ${format(parseISO(fechaFin), "dd/MM/yyyy")}.\n`;
  if (instrucciones) {
    msg += `\nInstrucciones:\n${instrucciones}\n`;
  }
  msg += `\nGracias por su reserva. Cualquier consulta, estamos a la orden.`;
  return msg;
}

function hasOverlap(inicio: string, fin: string, reservas: Reserva[]): boolean {
  const newStart = startOfDay(parseISO(inicio));
  const newEnd = startOfDay(parseISO(fin));
  for (const r of reservas) {
    const existStart = startOfDay(parseISO(r.fecha_inicio));
    const existEnd = startOfDay(parseISO(r.fecha_fin));
    if (
      (isBefore(newStart, existEnd) || isSameDay(newStart, existEnd)) &&
      (isAfter(newEnd, existStart) || isSameDay(newEnd, existStart))
    ) {
      return true;
    }
  }
  return false;
}

export default function Reservas() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState<Reserva | null>(null);
  const [selectedPropiedadId, setSelectedPropiedadId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const userEmail = useUserEmail();
  const queryClient = useQueryClient();
  const { data: propiedades, isLoading: loadingProps } = useSupabasePropiedadesVacacionales();
  const { data: reservas, isLoading: loadingReservas } = useSupabaseReservas(selectedPropiedadId);

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const resp = await fetch("/api/sync-ical", { method: "POST" });
      const data = await resp.json();
      if (resp.ok) {
        setSyncResult(`${data.synced} reserva(s) sincronizada(s)`);
        queryClient.invalidateQueries({ queryKey: ["supabase-reservas"] });
      } else {
        setSyncResult(data.error || "Error al sincronizar");
      }
    } catch {
      setSyncResult("Error de conexión");
    }
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 5000);
  };

  const occupiedDates = useMemo(() => {
    if (!reservas) return [];
    return getOccupiedDates(reservas);
  }, [reservas]);

  const selectedPropiedad = propiedades?.find(p => p.id === selectedPropiedadId);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Reservas</h2>
          <p className="text-muted-foreground text-sm mt-1">Calendario de ocupación</p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Sync iCal"}
        </button>
      </div>
      {syncResult && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {syncResult}
        </div>
      )}

      <Card className="p-4">
        <label className="text-sm font-semibold text-foreground/80 pl-1 mb-1.5 block">Seleccionar propiedad</label>
        <div className="relative">
          <select
            className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-sm appearance-none pr-10"
            value={selectedPropiedadId ?? ""}
            onChange={(e) => setSelectedPropiedadId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Todas las propiedades vacacionales</option>
            {propiedades?.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} - {p.pais}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </Card>

      <Card className="p-3 overflow-hidden">
        <div className="calendar-wrapper">
          <Calendar
            locale="es"
            tileClassName={({ date, view }) => {
              if (view === "month" && isDateOccupied(date, occupiedDates)) {
                return "occupied-date";
              }
              return null;
            }}
            tileDisabled={({ date, view }) => {
              if (view === "month") {
                return isDateOccupied(date, occupiedDates);
              }
              return false;
            }}
            minDate={new Date()}
          />
        </div>

        <div className="flex items-center gap-4 mt-4 px-2 pb-1">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-red-400/80 border border-red-500/30"></span>
            <span className="text-xs text-muted-foreground">Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-card border border-border"></span>
            <span className="text-xs text-muted-foreground">Disponible</span>
          </div>
        </div>
      </Card>

      {loadingReservas ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : reservas && reservas.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-foreground">
            {selectedPropiedad ? `Reservas - ${selectedPropiedad.nombre}` : "Todas las reservas"}
          </h3>
          {reservas.map(r => {
            const prop = propiedades?.find(p => p.id === r.propiedad_id);
            const isIcal = r.origen === "ical";
            const whatsappMsg = buildWhatsAppMessage(r.nombre_huesped, prop?.nombre ?? "", prop?.instrucciones ?? null, r.fecha_inicio, r.fecha_fin);
            return (
              <Card key={r.id} className={`p-4 ${isIcal ? "border-l-4 border-l-amber-400" : ""}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-sm">{prop?.nombre ?? `Propiedad #${r.propiedad_id}`}</h4>
                    <div className="flex items-center text-muted-foreground text-xs mt-0.5">
                      <User size={12} className="mr-1" />
                      {r.nombre_huesped}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isIcal && (
                      <Badge variant="warning" className="text-[10px]">Sync</Badge>
                    )}
                    {r.canal_renta && (
                      <Badge variant={isIcal ? "warning" : "default"} className="text-[10px]">{r.canal_renta}</Badge>
                    )}
                    <button
                      onClick={() => setEditingReserva(r)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 flex items-center justify-between border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Entrada</span>
                    <span className="font-semibold text-xs">
                      {format(parseISO(r.fecha_inicio), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-border mx-3"></div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Salida</span>
                    <span className="font-semibold text-xs">
                      {format(parseISO(r.fecha_fin), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>
                </div>

                {(r.monto_bruto || r.monto_neto || (r.monto != null && Number(r.monto) > 0)) ? (
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    {r.monto_bruto != null && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bruto</span>
                        <p className="font-semibold">L {Number(r.monto_bruto).toLocaleString("es-HN")}</p>
                      </div>
                    )}
                    {r.monto_neto != null && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Neto</span>
                        <p className="font-semibold text-emerald-600">L {Number(r.monto_neto).toLocaleString("es-HN")}</p>
                      </div>
                    )}
                    {!r.monto_bruto && !r.monto_neto && r.monto != null && Number(r.monto) > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Monto</span>
                        <p className="font-semibold">L {Number(r.monto).toLocaleString("es-HN")}</p>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {r.celular_huesped && (
                    <div className="flex items-center text-muted-foreground text-xs">
                      <Phone size={12} className="mr-1" />
                      {r.celular_huesped}
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

                <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                  {r.creado_por && (
                    <div className="flex items-center text-muted-foreground text-[11px]">
                      <UserCheck size={11} className="mr-1 shrink-0" />
                      <span>Creado por <span className="font-medium text-foreground/70">{r.creado_por}</span></span>
                    </div>
                  )}
                  {r.modificado_por && (
                    <div className="flex items-center text-muted-foreground text-[11px]">
                      <Edit3 size={11} className="mr-1 shrink-0" />
                      <span>Modificado por <span className="font-medium text-foreground/70">{r.modificado_por}</span>
                        {r.modificado_en && (
                          <span className="ml-1">({format(parseISO(r.modificado_en), "dd MMM yyyy HH:mm", { locale: es })})</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : !loadingReservas && (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
            <CalendarIcon size={28} />
          </div>
          <h3 className="text-lg font-bold mb-1">Sin reservas</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            {selectedPropiedad
              ? `No hay reservas para ${selectedPropiedad.nombre}.`
              : "Aún no hay reservas registradas."}
          </p>
        </div>
      )}

      <FAB onClick={() => setIsModalOpen(true)} />
      <ReservationFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        propiedades={propiedades ?? []}
        defaultPropiedadId={selectedPropiedadId}
        userEmail={userEmail}
      />
      {editingReserva && (
        <EditReservationModal
          isOpen={!!editingReserva}
          onClose={() => setEditingReserva(null)}
          reserva={editingReserva}
          propiedades={propiedades ?? []}
          userEmail={userEmail}
        />
      )}
    </div>
  );
}

function ReservationFormModal({
  isOpen,
  onClose,
  propiedades,
  defaultPropiedadId,
  userEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  propiedades: Propiedad[];
  defaultPropiedadId: number | null;
  userEmail: string;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, setError, clearErrors, formState: { errors } } = useForm<ReservaFormData>({
    defaultValues: {
      propiedad_id: defaultPropiedadId ? String(defaultPropiedadId) : "",
    },
  });

  const watchPropiedadId = watch("propiedad_id");
  const watchFechaInicio = watch("fecha_inicio");
  const watchFechaFin = watch("fecha_fin");
  const propIdNum = watchPropiedadId ? Number(watchPropiedadId) : null;

  const { data: reservasPropiedad } = useQuery<Reserva[]>({
    queryKey: ["supabase-reservas-form", propIdNum],
    queryFn: async () => {
      if (!propIdNum) return [];
      const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .eq("propiedad_id", propIdNum);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!propIdNum,
  });

  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ReservaFormData) => {
      if (reservasPropiedad && hasOverlap(data.fecha_inicio, data.fecha_fin, reservasPropiedad)) {
        throw new Error("OVERLAP");
      }

      const montoBruto = data.monto_bruto ? Number(data.monto_bruto) : null;
      const montoNeto = data.monto_neto ? Number(data.monto_neto) : null;
      const insertData: Record<string, unknown> = {
        propiedad_id: Number(data.propiedad_id),
        nombre_huesped: data.nombre_huesped,
        celular_huesped: data.celular_huesped || null,
        canal_renta: data.canal_renta || null,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
        monto: montoNeto ?? montoBruto ?? 0,
        creado_por: userEmail,
        origen: "manual",
      };
      if (montoBruto !== null) insertData.monto_bruto = montoBruto;
      if (montoNeto !== null) insertData.monto_neto = montoNeto;

      const { error } = await supabase.from("reservas").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-reservas"] });
      queryClient.invalidateQueries({ queryKey: ["supabase-reservas-form"] });
      setOverlapError(null);
      setGeneralError(null);
      reset();
      onClose();
    },
    onError: (err: Error) => {
      if (err.message === "OVERLAP") {
        setOverlapError("Las fechas seleccionadas se solapan con una reserva existente. Por favor, elige otras fechas.");
      } else {
        setGeneralError("Error al guardar la reserva. Intenta de nuevo.");
      }
    },
  });

  const onSubmit = (data: ReservaFormData) => {
    setOverlapError(null);
    setGeneralError(null);

    if (data.fecha_fin <= data.fecha_inicio) {
      setError("fecha_fin", { message: "La fecha de salida debe ser posterior a la de entrada" });
      return;
    }

    if (reservasPropiedad && hasOverlap(data.fecha_inicio, data.fecha_fin, reservasPropiedad)) {
      setOverlapError("Las fechas seleccionadas se solapan con una reserva existente. Por favor, elige otras fechas.");
      return;
    }

    mutate(data);
  };

  const handleClose = () => {
    setOverlapError(null);
    setGeneralError(null);
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nueva Reserva">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {generalError && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{generalError}</p>
          </div>
        )}

        {overlapError && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{overlapError}</p>
          </div>
        )}

        <Select
          label="Propiedad"
          {...register("propiedad_id", { required: "Selecciona una propiedad" })}
          error={errors.propiedad_id?.message}
        >
          <option value="">Seleccionar propiedad...</option>
          {propiedades.map(p => (
            <option key={p.id} value={p.id}>{p.nombre} - {p.pais}</option>
          ))}
        </Select>

        <Input
          label="Nombre del huésped"
          placeholder="Ej: Carlos Mendoza"
          {...register("nombre_huesped", { required: "El nombre es requerido" })}
          error={errors.nombre_huesped?.message}
        />

        <Input
          label="Celular del huésped"
          placeholder="Ej: +504 9999-1234"
          {...register("celular_huesped")}
        />

        <Select
          label="Canal de renta"
          {...register("canal_renta")}
        >
          <option value="">Seleccionar canal...</option>
          <option value="Airbnb">Airbnb</option>
          <option value="Booking">Booking</option>
          <option value="Directo">Directo</option>
          <option value="Referido">Referido</option>
          <option value="Otro">Otro</option>
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Fecha de entrada"
            type="date"
            {...register("fecha_inicio", { required: "Requerido" })}
            error={errors.fecha_inicio?.message}
          />
          <Input
            label="Fecha de salida"
            type="date"
            {...register("fecha_fin", { required: "Requerido" })}
            error={errors.fecha_fin?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monto bruto (L)"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ej: 5000"
            {...register("monto_bruto")}
          />
          <Input
            label="Monto neto (L)"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ej: 3500"
            {...register("monto_neto")}
          />
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar Reserva"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditReservationModal({
  isOpen,
  onClose,
  reserva,
  propiedades,
  userEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  reserva: Reserva;
  propiedades: Propiedad[];
  userEmail: string;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, setError, formState: { errors } } = useForm<ReservaFormData>({
    defaultValues: {
      propiedad_id: String(reserva.propiedad_id),
      nombre_huesped: reserva.nombre_huesped,
      celular_huesped: reserva.celular_huesped ?? "",
      canal_renta: reserva.canal_renta ?? "",
      fecha_inicio: reserva.fecha_inicio,
      fecha_fin: reserva.fecha_fin,
      monto: reserva.monto ? String(reserva.monto) : "",
      monto_bruto: reserva.monto_bruto ? String(reserva.monto_bruto) : "",
      monto_neto: reserva.monto_neto ? String(reserva.monto_neto) : "",
    },
  });

  const watchPropiedadId = watch("propiedad_id");
  const editPropIdNum = watchPropiedadId ? Number(watchPropiedadId) : reserva.propiedad_id;

  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { data: reservasPropiedad } = useQuery<Reserva[]>({
    queryKey: ["supabase-reservas-edit", editPropIdNum],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .eq("propiedad_id", editPropIdNum);
      if (error) throw error;
      return (data ?? []).filter(r => r.id !== reserva.id);
    },
    enabled: !!editPropIdNum,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ReservaFormData) => {
      if (reservasPropiedad && hasOverlap(data.fecha_inicio, data.fecha_fin, reservasPropiedad)) {
        throw new Error("OVERLAP");
      }

      const editMontoBruto = data.monto_bruto ? Number(data.monto_bruto) : null;
      const editMontoNeto = data.monto_neto ? Number(data.monto_neto) : null;
      const updateData: Record<string, unknown> = {
        propiedad_id: Number(data.propiedad_id),
        nombre_huesped: data.nombre_huesped,
        celular_huesped: data.celular_huesped || null,
        canal_renta: data.canal_renta || null,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
        monto: editMontoNeto ?? editMontoBruto ?? (data.monto ? Number(data.monto) : 0),
        modificado_por: userEmail,
        modificado_en: new Date().toISOString(),
      };
      if (editMontoBruto !== null || reserva.monto_bruto != null) {
        updateData.monto_bruto = editMontoBruto;
      }
      if (editMontoNeto !== null || reserva.monto_neto != null) {
        updateData.monto_neto = editMontoNeto;
      }

      const { error } = await supabase
        .from("reservas")
        .update(updateData)
        .eq("id", reserva.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-reservas"] });
      queryClient.invalidateQueries({ queryKey: ["supabase-reservas-edit"] });
      queryClient.invalidateQueries({ queryKey: ["supabase-reservas-form"] });
      setOverlapError(null);
      setGeneralError(null);
      reset();
      onClose();
    },
    onError: (err: Error) => {
      if (err.message === "OVERLAP") {
        setOverlapError("Las fechas seleccionadas se solapan con otra reserva existente.");
      } else {
        setGeneralError("Error al guardar los cambios. Intenta de nuevo.");
      }
    },
  });

  const onSubmit = (data: ReservaFormData) => {
    setOverlapError(null);
    setGeneralError(null);
    if (data.fecha_fin <= data.fecha_inicio) {
      setError("fecha_fin", { message: "La fecha de salida debe ser posterior a la de entrada" });
      return;
    }
    mutate(data);
  };

  const handleClose = () => {
    setOverlapError(null);
    setGeneralError(null);
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Editar Reserva">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {generalError && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{generalError}</p>
          </div>
        )}

        {overlapError && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{overlapError}</p>
          </div>
        )}

        <Select
          label="Propiedad"
          {...register("propiedad_id", { required: "Selecciona una propiedad" })}
          error={errors.propiedad_id?.message}
        >
          <option value="">Seleccionar propiedad...</option>
          {propiedades.map(p => (
            <option key={p.id} value={p.id}>{p.nombre} - {p.pais}</option>
          ))}
        </Select>

        <Input
          label="Nombre del huésped"
          placeholder="Ej: Carlos Mendoza"
          {...register("nombre_huesped", { required: "El nombre es requerido" })}
          error={errors.nombre_huesped?.message}
        />

        <Input
          label="Celular del huésped"
          placeholder="Ej: +504 9999-1234"
          {...register("celular_huesped")}
        />

        <Select
          label="Canal de renta"
          {...register("canal_renta")}
        >
          <option value="">Seleccionar canal...</option>
          <option value="Airbnb">Airbnb</option>
          <option value="Booking">Booking</option>
          <option value="Directo">Directo</option>
          <option value="Referido">Referido</option>
          <option value="Otro">Otro</option>
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Fecha de entrada"
            type="date"
            {...register("fecha_inicio", { required: "Requerido" })}
            error={errors.fecha_inicio?.message}
          />
          <Input
            label="Fecha de salida"
            type="date"
            {...register("fecha_fin", { required: "Requerido" })}
            error={errors.fecha_fin?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monto bruto (L)"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ej: 5000"
            {...register("monto_bruto")}
          />
          <Input
            label="Monto neto (L)"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ej: 3500"
            {...register("monto_neto")}
          />
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
