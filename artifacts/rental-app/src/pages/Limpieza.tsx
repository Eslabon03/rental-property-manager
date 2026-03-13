import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Camera,
  AlertTriangle,
  AlertCircle,
  User,
  Calendar,
  Building2,
  Loader2,
  Sparkles,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUserEmail, filterPropiedadesPorRol } from "@/lib/roles";
import { Button, Card, Modal } from "@/components/ui";
import { VoiceInput } from "@/components/VoiceInput";

interface Propiedad {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
}

interface ReservaCheckout {
  id: number;
  propiedad_id: number;
  fecha_fin: string;
  nombre_huesped: string;
  propiedadNombre: string;
}

interface PropiedadRow {
  nombre: string;
}

interface RawReservaRow {
  id: number;
  propiedad_id: number;
  fecha_fin: string;
  nombre_huesped: string;
  propiedades: PropiedadRow | PropiedadRow[] | null;
}

function useCheckoutsProximos() {
  return useQuery<ReservaCheckout[]>({
    queryKey: ["limpieza-checkouts"],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString().split("T")[0];
      const limit3Days = format(addDays(new Date(), 3), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("reservas")
        .select("id, propiedad_id, fecha_fin, nombre_huesped, propiedades(nombre)")
        .gte("fecha_fin", today)
        .lte("fecha_fin", limit3Days)
        .order("fecha_fin", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as RawReservaRow[]).map((r) => ({
        id: r.id,
        propiedad_id: r.propiedad_id,
        fecha_fin: r.fecha_fin,
        nombre_huesped: r.nombre_huesped,
        propiedadNombre: Array.isArray(r.propiedades)
          ? r.propiedades[0]?.nombre ?? `Propiedad #${r.propiedad_id}`
          : r.propiedades?.nombre ?? `Propiedad #${r.propiedad_id}`,
      }));
    },
  });
}

function usePropiedadesLimpieza() {
  return useQuery<Propiedad[]>({
    queryKey: ["limpieza-propiedades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propiedades")
        .select("id, nombre, tipo, pais")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function Limpieza() {
  const userEmail = useUserEmail();
  const queryClient = useQueryClient();
  const { data: checkoutsRaw, isLoading, isError: checkoutsError } = useCheckoutsProximos();
  const { data: propiedadesRaw } = usePropiedadesLimpieza();

  const propiedades = useMemo(
    () => filterPropiedadesPorRol(propiedadesRaw ?? [], "limpieza"),
    [propiedadesRaw]
  );
  const allowedIds = useMemo(() => new Set(propiedades.map((p) => p.id)), [propiedades]);

  const checkouts = useMemo(
    () => (checkoutsRaw ?? []).filter((c) => allowedIds.has(c.propiedad_id)),
    [checkoutsRaw, allowedIds]
  );

  const [damageModal, setDamageModal] = useState<ReservaCheckout | null>(null);
  const [evidenceModal, setEvidenceModal] = useState<ReservaCheckout | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const handleComplete = useCallback(
    async (checkout: ReservaCheckout) => {
      setCompletingId(checkout.id);
      setCompleteError(null);

      try {
        const { data: insumos, error: fetchErr } = await supabase
          .from("inventario_insumos")
          .select("id, cantidad_actual, cantidad_por_limpieza");

        if (!fetchErr && insumos && insumos.length > 0) {
          for (const item of insumos) {
            const nuevaCantidad = Math.max(
              0,
              Number(item.cantidad_actual) - Number(item.cantidad_por_limpieza)
            );
            const { error: updateErr } = await supabase
              .from("inventario_insumos")
              .update({ cantidad_actual: nuevaCantidad })
              .eq("id", item.id);
            if (updateErr) throw updateErr;
          }
        }
      } catch {
        // inventario_insumos table may not exist yet — continue silently
      }

      setCompletedIds((prev) => new Set(prev).add(checkout.id));
      setCompletingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-insumos"] });
    },
    [queryClient]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">
          Limpieza
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Check-outs próximos (3 días)
        </p>
      </div>

      {completeError && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">{completeError}</p>
        </div>
      )}

      {checkoutsError ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">Error al cargar los check-outs. Verifica tu conexión e intenta de nuevo.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 bg-card rounded-2xl animate-pulse border border-border"
            />
          ))}
        </div>
      ) : checkouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <Sparkles size={36} />
          </div>
          <h3 className="text-xl font-bold mb-2">Todo limpio</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            No hay check-outs próximos para tus propiedades.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {checkouts.map((checkout) => {
            const isCompleted = completedIds.has(checkout.id);
            const isCompleting = completingId === checkout.id;
            return (
              <Card
                key={checkout.id}
                className={`overflow-hidden ${isCompleted ? "opacity-60" : ""}`}
              >
                <div
                  className={`h-1.5 w-full ${isCompleted ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 size={24} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base leading-tight truncate">
                        {checkout.propiedadNombre}
                      </h3>
                      <div className="flex items-center text-muted-foreground text-sm mt-1 gap-3">
                        <div className="flex items-center gap-1">
                          <User size={14} />
                          <span className="truncate">
                            {checkout.nombre_huesped}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center text-muted-foreground text-sm mt-0.5 gap-1">
                        <Calendar size={14} />
                        <span>
                          Check-out:{" "}
                          {format(parseISO(checkout.fecha_fin), "dd MMM yyyy", {
                            locale: es,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isCompleted && (
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        onClick={() => setEvidenceModal(checkout)}
                        className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 active:scale-[0.98] transition-all"
                      >
                        <Camera size={20} />
                        Subir Evidencia (Limpio)
                      </button>

                      <button
                        onClick={() => setDamageModal(checkout)}
                        className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 active:scale-[0.98] transition-all"
                      >
                        <AlertTriangle size={20} />
                        Reportar Daño
                      </button>

                      <button
                        onClick={() => handleComplete(checkout)}
                        disabled={isCompleting}
                        className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {isCompleting ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={20} />
                        )}
                        {isCompleting
                          ? "Procesando..."
                          : "Marcar Limpieza Completada"}
                      </button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 font-bold text-sm">
                      <CheckCircle2 size={20} />
                      Limpieza completada
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {evidenceModal && (
        <EvidenceUploadModal
          checkout={evidenceModal}
          userEmail={userEmail}
          onClose={() => setEvidenceModal(null)}
        />
      )}

      {damageModal && (
        <DamageReportModal
          checkout={damageModal}
          userEmail={userEmail}
          onClose={() => setDamageModal(null)}
        />
      )}
    </div>
  );
}

function EvidenceUploadModal({
  checkout,
  userEmail,
  onClose,
}: {
  checkout: ReservaCheckout;
  userEmail: string;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `propiedad-${checkout.propiedad_id}/evidencia-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("evidencias")
        .upload(filePath, file, { upsert: true });

      if (upErr) throw upErr;
      setUploaded(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir";
      setErrorMsg(message);
    }

    setUploading(false);
  };

  return (
    <Modal isOpen onClose={onClose} title="Subir Evidencia de Limpieza">
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            {checkout.propiedadNombre}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            Huésped: {checkout.nombre_huesped}
          </p>
        </div>

        {uploaded ? (
          <div className="flex flex-col items-center py-6 text-emerald-600">
            <CheckCircle2 size={48} />
            <p className="font-bold mt-2">Evidencia subida correctamente</p>
            <Button className="mt-4" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <label
              className={`flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                uploading
                  ? "border-blue-300 bg-blue-50/50 pointer-events-none"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {uploading ? (
                <Loader2 size={36} className="text-blue-500 animate-spin" />
              ) : (
                <ImageIcon size={36} className="text-muted-foreground" />
              )}
              <span className="text-sm font-semibold text-muted-foreground">
                {uploading ? "Subiendo foto..." : "Tomar foto o seleccionar archivo"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>

            {errorMsg && (
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function DamageReportModal({
  checkout,
  userEmail,
  onClose,
}: {
  checkout: ReservaCheckout;
  userEmail: string;
  onClose: () => void;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleVoiceResult = useCallback((text: string) => {
    setDescripcion((prev) => (prev ? prev + " " + text : text));
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `danos/propiedad-${checkout.propiedad_id}/dano-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("evidencias")
        .upload(filePath, file, { upsert: true });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("evidencias")
        .getPublicUrl(filePath);

      setFotoUrl(urlData.publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir foto";
      setErrorMsg(message);
    }

    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!descripcion.trim()) {
      setErrorMsg("Ingresa una descripción del daño");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from("mantenimiento_pendientes").insert({
        propiedad_id: checkout.propiedad_id,
        descripcion: descripcion.trim(),
        foto_url: fotoUrl,
        estado: "pendiente",
        creado_por: userEmail,
      });

      if (error) throw error;

      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["admin-mantenimiento"] });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al guardar el reporte";
      setErrorMsg(message);
    }

    setSaving(false);
  };

  return (
    <Modal isOpen onClose={onClose} title="Reportar Daño">
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            {checkout.propiedadNombre}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
            Huésped: {checkout.nombre_huesped}
          </p>
        </div>

        {saved ? (
          <div className="flex flex-col items-center py-6 text-emerald-600">
            <CheckCircle2 size={48} />
            <p className="font-bold mt-2">Daño reportado correctamente</p>
            <Button className="mt-4" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm font-semibold text-foreground/80 mb-1.5 block">
                Descripción del daño
              </label>
              <div className="flex gap-2">
                <textarea
                  className="flex-1 text-sm p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  rows={3}
                  placeholder="Describe el daño encontrado..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
                <VoiceInput onResult={handleVoiceResult} className="shrink-0 self-start" />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground/80 mb-1.5 block">
                Foto del daño (opcional)
              </label>
              {fotoUrl ? (
                <div className="relative">
                  <img
                    src={fotoUrl}
                    alt="Foto del daño"
                    className="w-full h-40 object-cover rounded-xl border border-border"
                  />
                  <label className="absolute bottom-2 right-2 bg-white/90 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-white transition-colors">
                    Cambiar foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </label>
                </div>
              ) : (
                <label
                  className={`flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    uploading
                      ? "border-amber-300 bg-amber-50/50 pointer-events-none"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  {uploading ? (
                    <Loader2 size={28} className="text-amber-500 animate-spin" />
                  ) : (
                    <Camera size={28} className="text-muted-foreground" />
                  )}
                  <span className="text-xs font-semibold text-muted-foreground">
                    {uploading ? "Subiendo..." : "Tomar foto del daño"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
            )}

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={saving || !descripcion.trim()}
              >
                {saving ? "Guardando..." : "Enviar Reporte"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
