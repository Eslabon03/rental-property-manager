import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Globe, Home as HomeIcon, Building2, Check, X, Pencil, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button, Card, Badge, FAB, Modal, Input, Select } from "@/components/ui";

type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
  renta_fija_lps: number | null;
  instrucciones: string | null;
  esta_alquilada: boolean;
  creado_en: string;
};

type PropertyFormData = {
  nombre: string;
  tipo: string;
  pais: string;
  renta_fija_lps: number;
  instrucciones: string;
};

function useSupabasePropiedades() {
  return useQuery<Propiedad[]>({
    queryKey: ["supabase-propiedades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propiedades")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function Inicio() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: propiedades, isLoading } = useSupabasePropiedades();

  const vacacionales = propiedades?.filter(p => p.tipo === "vacacional") ?? [];
  const mensuales = propiedades?.filter(p => p.tipo === "mensual") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Mis Propiedades</h2>
        <p className="text-muted-foreground text-sm mt-1">Gestiona tu portafolio inmobiliario</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : propiedades?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <HomeIcon size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Sin propiedades</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Aún no has registrado ninguna propiedad.</p>
          <Button onClick={() => setIsModalOpen(true)}>Añadir Propiedad</Button>
        </div>
      ) : (
        <>
          {vacacionales.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">Propiedades Vacacionales</h3>
                <Badge variant="success" className="text-xs">{vacacionales.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vacacionales.map(p => (
                  <VacacionalCard key={p.id} propiedad={p} />
                ))}
              </div>
            </section>
          )}

          {mensuales.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">Propiedades Mensuales</h3>
                <Badge variant="warning" className="text-xs">{mensuales.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {mensuales.map(p => (
                  <MensualCard key={p.id} propiedad={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <FAB onClick={() => setIsModalOpen(true)} />
      <PropertyFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function VacacionalCard({ propiedad }: { propiedad: Propiedad }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold leading-tight truncate">{propiedad.nombre}</h4>
            <div className="flex items-center text-muted-foreground text-xs mt-0.5">
              <Globe size={11} className="mr-1 shrink-0" />
              <span className="truncate">{propiedad.pais}</span>
            </div>
          </div>
        </div>
        <Badge variant="success" className="shrink-0 text-xs">Vacacional</Badge>
      </div>
      {propiedad.renta_fija_lps != null && (
        <div className="bg-accent/50 rounded-lg px-3 py-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Renta</span>
          <span className="font-bold text-sm">L {propiedad.renta_fija_lps.toLocaleString("es-HN")}</span>
        </div>
      )}
    </Card>
  );
}

function MensualCard({ propiedad }: { propiedad: Propiedad }) {
  const queryClient = useQueryClient();
  const [editingPrecio, setEditingPrecio] = useState(false);
  const [precioTemp, setPrecioTemp] = useState(String(propiedad.renta_fija_lps ?? ""));

  const toggleAlquilada = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("propiedades")
        .update({ esta_alquilada: !propiedad.esta_alquilada })
        .eq("id", propiedad.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
    },
  });

  const guardarPrecio = useMutation({
    mutationFn: async (precio: number | null) => {
      const { error } = await supabase
        .from("propiedades")
        .update({ renta_fija_lps: precio })
        .eq("id", propiedad.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-propiedades"] });
      setEditingPrecio(false);
    },
  });

  const handleSavePrecio = () => {
    const val = precioTemp.trim();
    guardarPrecio.mutate(val ? Number(val) : null);
  };

  const alquilada = propiedad.esta_alquilada;

  return (
    <Card className="overflow-hidden">
      <div className={`h-1.5 w-full ${alquilada ? "bg-red-500" : "bg-green-500"}`} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold leading-tight truncate">{propiedad.nombre}</h4>
              <div className="flex items-center text-muted-foreground text-xs mt-0.5">
                <Globe size={11} className="mr-1 shrink-0" />
                <span className="truncate">{propiedad.pais}</span>
              </div>
            </div>
          </div>
          <Badge variant="warning" className="shrink-0 text-xs">Mensual</Badge>
        </div>

        <div className="bg-accent/50 rounded-xl px-3 py-2">
          <label className="text-xs text-muted-foreground font-medium block mb-1">Precio Mensual (L)</label>
          {editingPrecio ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={precioTemp}
                onChange={(e) => setPrecioTemp(e.target.value)}
                className="flex-1 h-9 rounded-lg border border-input bg-card px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePrecio();
                  if (e.key === "Escape") {
                    setEditingPrecio(false);
                    setPrecioTemp(String(propiedad.renta_fija_lps ?? ""));
                  }
                }}
              />
              <button
                onClick={handleSavePrecio}
                disabled={guardarPrecio.isPending}
                className="h-9 w-9 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => {
                  setEditingPrecio(false);
                  setPrecioTemp(String(propiedad.renta_fija_lps ?? ""));
                }}
                className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-bold text-base">
                {propiedad.renta_fija_lps != null
                  ? `L ${propiedad.renta_fija_lps.toLocaleString("es-HN", { minimumFractionDigits: 2 })}`
                  : "Sin definir"}
              </span>
              <button
                onClick={() => {
                  setPrecioTemp(String(propiedad.renta_fija_lps ?? ""));
                  setEditingPrecio(true);
                }}
                className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => toggleAlquilada.mutate()}
          disabled={toggleAlquilada.isPending}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all ${
            alquilada
              ? "bg-red-500/10 text-red-600 border-2 border-red-500/30 hover:bg-red-500/20"
              : "bg-green-500/10 text-green-600 border-2 border-green-500/30 hover:bg-green-500/20"
          }`}
        >
          <span>{alquilada ? "Alquilada (Ocupada)" : "Disponible"}</span>
          <div className={`relative w-12 h-7 rounded-full transition-colors ${alquilada ? "bg-red-500" : "bg-green-500"}`}>
            <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${alquilada ? "translate-x-5" : "translate-x-0.5"}`}>
              <div className="flex items-center justify-center h-full">
                {alquilada ? <X size={12} className="text-red-500" /> : <Check size={12} className="text-green-500" />}
              </div>
            </div>
          </div>
        </button>
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
