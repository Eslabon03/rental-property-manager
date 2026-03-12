import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { MapPin, Home as HomeIcon, Building2, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button, Card, Badge, FAB, Modal, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
  renta_fija_lps: number | null;
  instrucciones: string | null;
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
        .order("creado_en", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

function getTipoBadgeVariant(tipo: string) {
  switch (tipo) {
    case "vacacional": return "success" as const;
    case "mensual": return "warning" as const;
    default: return "default" as const;
  }
}

function getTipoLabel(tipo: string) {
  switch (tipo) {
    case "vacacional": return "Vacacional";
    case "mensual": return "Mensual";
    default: return tipo;
  }
}

export default function Inicio() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: propiedades, isLoading } = useSupabasePropiedades();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Mis Propiedades</h2>
          <p className="text-muted-foreground text-sm mt-1">Gestiona tu portafolio inmobiliario</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-52 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : propiedades?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <HomeIcon size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Sin propiedades</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Aún no has registrado ninguna propiedad. Comienza añadiendo tu primer inmueble.</p>
          <Button onClick={() => setIsModalOpen(true)}>Añadir Propiedad</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {propiedades?.map(propiedad => (
            <Card key={propiedad.id} className="group">
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold leading-tight truncate">{propiedad.nombre}</h3>
                      <div className="flex items-center text-muted-foreground text-sm mt-0.5">
                        <Globe size={12} className="mr-1 shrink-0" />
                        <span className="truncate">{propiedad.pais}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={getTipoBadgeVariant(propiedad.tipo)} className="shadow-sm shrink-0">
                    {getTipoLabel(propiedad.tipo)}
                  </Badge>
                </div>

                {propiedad.renta_fija_lps != null && (
                  <div className="bg-accent/50 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Renta fija</span>
                    <span className="font-bold text-foreground">
                      L {propiedad.renta_fija_lps.toLocaleString("es-HN")}
                    </span>
                  </div>
                )}

                {propiedad.instrucciones && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{propiedad.instrucciones}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <FAB onClick={() => setIsModalOpen(true)} />

      <PropertyFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
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
          label="Renta Fija (LPS)" 
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
