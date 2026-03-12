import { useState, useMemo, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Zap, Droplets, Sparkles, Wrench, HelpCircle, Receipt, ChevronDown, Landmark, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button, Card, FAB, Modal, Input, Select } from "@/components/ui";

type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
};

type Gasto = {
  id: number;
  propiedad_id: number;
  categoria: string;
  monto: number;
  fecha: string;
  comprobante_url: string | null;
  creado_en: string;
};

type GastoFormData = {
  propiedad_id: string;
  categoria: string;
  monto: number;
  fecha: string;
  comprobante_url: string;
};

const CATEGORIAS = [
  { value: "Luz", label: "Luz", icon: Zap, color: "text-yellow-500" },
  { value: "Agua", label: "Agua", icon: Droplets, color: "text-blue-500" },
  { value: "Roa", label: "Roa", icon: Landmark, color: "text-purple-500" },
  { value: "Limpieza", label: "Limpieza", icon: Sparkles, color: "text-green-500" },
  { value: "Mantenimiento", label: "Mantenimiento", icon: Wrench, color: "text-orange-500" },
  { value: "Otro", label: "Otro", icon: HelpCircle, color: "text-gray-500" },
];

function getCategoriaConfig(categoria: string) {
  return CATEGORIAS.find(c => c.value === categoria) ?? CATEGORIAS[CATEGORIAS.length - 1];
}

function useSupabasePropiedades() {
  return useQuery<Propiedad[]>({
    queryKey: ["supabase-propiedades-all"],
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

function useSupabaseGastos(propiedadId: number | null) {
  return useQuery<Gasto[]>({
    queryKey: ["supabase-gastos", propiedadId],
    queryFn: async () => {
      let query = supabase.from("gastos").select("*").order("fecha", { ascending: false });
      if (propiedadId) {
        query = query.eq("propiedad_id", propiedadId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function Gastos() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterPropiedadId, setFilterPropiedadId] = useState<number | null>(null);
  const { data: propiedades } = useSupabasePropiedades();
  const { data: gastos, isLoading, isError } = useSupabaseGastos(filterPropiedadId);

  const totalMes = useMemo(() => {
    if (!gastos) return 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return gastos
      .filter(g => {
        const d = parseISO(g.fecha);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, g) => sum + g.monto, 0);
  }, [gastos]);

  const getPropiedadNombre = (propiedadId: number) => {
    return propiedades?.find(p => p.id === propiedadId)?.nombre ?? `Propiedad #${propiedadId}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Gastos</h2>
        <p className="text-muted-foreground text-sm mt-1">Control de gastos por propiedad</p>
      </div>

      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground shadow-lg">
        <p className="text-sm opacity-90 font-medium">Total Gastos (Este mes)</p>
        <p className="text-3xl font-bold mt-1">L {totalMes.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</p>
        {filterPropiedadId && propiedades && (
          <p className="text-xs mt-2 opacity-80">
            {getPropiedadNombre(filterPropiedadId)}
          </p>
        )}
      </div>

      <Card className="p-4">
        <label className="text-sm font-semibold text-foreground/80 pl-1 mb-1.5 block">Filtrar por propiedad</label>
        <div className="relative">
          <select
            className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-sm appearance-none pr-10"
            value={filterPropiedadId ?? ""}
            onChange={(e) => setFilterPropiedadId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Todas las propiedades</option>
            {propiedades?.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} - {p.pais}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </Card>

      <h3 className="text-lg font-bold text-foreground">Registro de Gastos</h3>

      {isError ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">Error al cargar los gastos. Verifica tu conexión e intenta de nuevo.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : gastos && gastos.length > 0 ? (
        <div className="space-y-3">
          {gastos.map(gasto => {
            const cat = getCategoriaConfig(gasto.categoria);
            const CatIcon = cat.icon;
            return (
              <Card key={gasto.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <CatIcon size={20} className={cat.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate">{gasto.categoria}</h4>
                        <p className="text-xs text-muted-foreground truncate">{getPropiedadNombre(gasto.propiedad_id)}</p>
                      </div>
                      <span className="font-bold text-red-500 shrink-0 text-sm">
                        -L {gasto.monto.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(gasto.fecha), "dd MMM yyyy", { locale: es })}
                      </span>
                      {gasto.comprobante_url && (
                        /^https?:\/\//i.test(gasto.comprobante_url) ? (
                          <a
                            href={gasto.comprobante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Receipt size={12} />
                            Ver recibo
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic truncate max-w-[120px]">
                            {gasto.comprobante_url}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
            <Receipt size={28} />
          </div>
          <h3 className="text-lg font-bold mb-1">Sin gastos registrados</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Comienza registrando tus gastos para llevar un mejor control.
          </p>
        </div>
      )}

      <FAB onClick={() => setIsModalOpen(true)} />
      <GastoFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        propiedades={propiedades ?? []}
        defaultPropiedadId={filterPropiedadId}
      />
    </div>
  );
}

function GastoFormModal({
  isOpen,
  onClose,
  propiedades,
  defaultPropiedadId,
}: {
  isOpen: boolean;
  onClose: () => void;
  propiedades: Propiedad[];
  defaultPropiedadId: number | null;
}) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GastoFormData>({
    defaultValues: {
      propiedad_id: defaultPropiedadId ? String(defaultPropiedadId) : "",
      fecha: format(new Date(), "yyyy-MM-dd"),
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        propiedad_id: defaultPropiedadId ? String(defaultPropiedadId) : "",
        fecha: format(new Date(), "yyyy-MM-dd"),
        categoria: "",
        monto: undefined as any,
        comprobante_url: "",
      });
      setErrorMsg(null);
    }
  }, [isOpen, defaultPropiedadId, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: GastoFormData) => {
      const { error } = await supabase.from("gastos").insert({
        propiedad_id: Number(data.propiedad_id),
        categoria: data.categoria,
        monto: Number(data.monto),
        fecha: data.fecha,
        comprobante_url: data.comprobante_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-gastos"] });
      reset();
      onClose();
    },
    onError: () => {
      setErrorMsg("Error al guardar el gasto. Intenta de nuevo.");
    },
  });

  const onSubmit = (data: GastoFormData) => {
    mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar Nuevo Gasto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {errorMsg}
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

        <Select
          label="Categoría"
          {...register("categoria", { required: "Selecciona una categoría" })}
          error={errors.categoria?.message}
        >
          <option value="">Seleccionar categoría...</option>
          {CATEGORIAS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>

        <Input
          label="Monto (LPS)"
          type="number"
          min="0"
          step="0.01"
          placeholder="Ej: 1500.00"
          {...register("monto", { required: "El monto es requerido", valueAsNumber: true, min: { value: 0.01, message: "El monto debe ser mayor a 0" } })}
          error={errors.monto?.message}
        />

        <Input
          label="Fecha del gasto"
          type="date"
          {...register("fecha", { required: "La fecha es requerida" })}
          error={errors.fecha?.message}
        />

        <Input
          label="Notas / URL del recibo (opcional)"
          placeholder="Ej: https://drive.google.com/recibo.pdf o notas"
          {...register("comprobante_url")}
        />

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Guardando..." : "Registrar Gasto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
