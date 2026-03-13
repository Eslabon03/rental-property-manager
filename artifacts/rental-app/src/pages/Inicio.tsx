import { useState, useMemo } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Calendar as CalendarIcon, Building2, User, Clock, UserCheck, Warehouse, ArrowLeft, MapPin, Home, Briefcase, ToggleLeft, ToggleRight, Link2, FileText, RefreshCw, Check, Loader2, MessageCircle, Upload, ExternalLink, DollarSign, Trash2 } from "lucide-react";
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
  contrato_url: string | null;
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
  monto: number | null;
  monto_bruto: number | null;
  monto_neto: number | null;
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
        .select("*, propiedades(nombre, tipo, pais, instrucciones)")
        .gte("fecha_fin", today)
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      interface RawReservaRow {
        id: number;
        propiedad_id: number;
        fecha_inicio: string;
        fecha_fin: string;
        nombre_huesped: string;
        celular_huesped: string | null;
        canal_renta: string | null;
        creado_por: string | null;
        origen: string | null;
        monto: number | null;
        monto_bruto: number | null;
        monto_neto: number | null;
        propiedades: PropiedadJoin | PropiedadJoin[] | null;
      }
      return ((data ?? []) as RawReservaRow[]).map((r) => ({
        id: r.id,
        propiedad_id: r.propiedad_id,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        nombre_huesped: r.nombre_huesped,
        celular_huesped: r.celular_huesped,
        canal_renta: r.canal_renta,
        creado_por: r.creado_por,
        origen: r.origen ?? null,
        monto: r.monto ?? null,
        monto_bruto: r.monto_bruto ?? null,
        monto_neto: r.monto_neto ?? null,
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
        .select("id, nombre, tipo, pais, renta_fija_lps, esta_alquilada, ical_url, instrucciones, contrato_url")
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
  const [rentaFija, setRentaFija] = useState(propiedad.renta_fija_lps?.toString() ?? "");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
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

  const handleSaveRenta = async () => {
    if (rentaFija && (isNaN(parseFloat(rentaFija)) || parseFloat(rentaFija) < 0)) {
      setSavedField("renta_error");
      setTimeout(() => setSavedField(null), 3000);
      return;
    }
    setSavingField("renta_fija_lps");
    try {
      const val = rentaFija ? parseFloat(rentaFija) : null;
      const { error } = await supabase
        .from("propiedades")
        .update({ renta_fija_lps: val })
        .eq("id", propiedad.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
      setSavedField("renta_fija_lps");
      setTimeout(() => setSavedField(null), 2000);
    } catch {
      setSavedField("renta_error");
      setTimeout(() => setSavedField(null), 3000);
    }
    setSavingField(null);
  };

  const handleUploadContrato = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const filePath = `propiedad-${propiedad.id}/contrato-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("contratos")
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("propiedades")
        .update({ contrato_url: filePath })
        .eq("id", propiedad.id);
      if (dbErr) throw dbErr;
      queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
      setUploadMsg("Contrato subido");
      setTimeout(() => setUploadMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir";
      setUploadMsg(message);
      setTimeout(() => setUploadMsg(null), 4000);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteContrato = async () => {
    setSavingField("contrato_url");
    try {
      if (propiedad.contrato_url) {
        await supabase.storage
          .from("contratos")
          .remove([propiedad.contrato_url]);
      }
      const { error } = await supabase
        .from("propiedades")
        .update({ contrato_url: null })
        .eq("id", propiedad.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
      setSavedField("contrato_url");
      setTimeout(() => setSavedField(null), 2000);
    } catch {
      setUploadMsg("Error al eliminar");
      setTimeout(() => setUploadMsg(null), 3000);
    }
    setSavingField(null);
  };

  const getContratoUrl = () => {
    if (!propiedad.contrato_url) return "";
    if (propiedad.contrato_url.startsWith("http")) return propiedad.contrato_url;
    const { data } = supabase.storage
      .from("contratos")
      .getPublicUrl(propiedad.contrato_url);
    return data.publicUrl;
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
  const isMensual = propiedad.tipo === "mensual";

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
              {isMensual && propiedad.contrato_url && (
                <span className="text-emerald-600">
                  <FileText size={12} />
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
            {isMensual && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <DollarSign size={12} />
                  Renta Mensual (Lempiras)
                </label>
                <input
                  type="number"
                  className="w-full text-sm p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ej: 15000"
                  value={rentaFija}
                  onChange={e => setRentaFija(e.target.value)}
                />
                <button
                  onClick={handleSaveRenta}
                  disabled={savingField === "renta_fija_lps"}
                  className="mt-1 text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  {savingField === "renta_fija_lps" ? <Loader2 size={12} className="animate-spin" /> : savedField === "renta_fija_lps" ? <Check size={12} /> : null}
                  {savedField === "renta_fija_lps" ? "Guardado" : savedField === "renta_error" ? "" : savingField === "renta_fija_lps" ? "Guardando..." : "Guardar precio"}
                </button>
                {savedField === "renta_error" && (
                  <p className="text-xs text-red-500 mt-1">Ingrese un monto válido</p>
                )}
              </div>
            )}

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

            {isMensual && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <Upload size={12} />
                  Contrato de Arrendamiento
                </label>
                {propiedad.contrato_url ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={getContratoUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 rounded-lg px-3 py-2"
                    >
                      <ExternalLink size={12} />
                      Ver contrato
                    </a>
                    <button
                      onClick={handleDeleteContrato}
                      disabled={savingField === "contrato_url"}
                      className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 rounded-lg px-3 py-2"
                    >
                      <Trash2 size={12} />
                      Eliminar
                    </button>
                    <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer bg-slate-100 rounded-lg px-3 py-2">
                      <Upload size={12} />
                      Cambiar
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleUploadContrato} />
                    </label>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer border-2 border-dashed border-border rounded-xl px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} className="text-muted-foreground" />}
                    <span className="text-muted-foreground">
                      {uploading ? "Subiendo..." : "Subir contrato (PDF, imagen o Word)"}
                    </span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleUploadContrato} />
                  </label>
                )}
                {uploadMsg && (
                  <p className="text-xs text-muted-foreground mt-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1">{uploadMsg}</p>
                )}
              </div>
            )}

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

        {(reserva.monto_bruto != null || reserva.monto_neto != null || (reserva.monto != null && Number(reserva.monto) > 0)) ? (
          <div className="flex items-center gap-3 text-xs">
            {reserva.monto_bruto != null && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bruto</span>
                <p className="font-semibold">L {Number(reserva.monto_bruto).toLocaleString("es-HN")}</p>
              </div>
            )}
            {reserva.monto_neto != null && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Neto</span>
                <p className="font-semibold text-emerald-600">L {Number(reserva.monto_neto).toLocaleString("es-HN")}</p>
              </div>
            )}
            {!reserva.monto_bruto && !reserva.monto_neto && reserva.monto != null && Number(reserva.monto) > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Monto</span>
                <p className="font-semibold">L {Number(reserva.monto).toLocaleString("es-HN")}</p>
              </div>
            )}
          </div>
        ) : null}

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
