import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { MapPin, BedDouble, Bath, Home as HomeIcon } from "lucide-react";
import { useListProperties, useCreateProperty, getListPropertiesQueryKey } from "@workspace/api-client-react";
import { Button, Card, Badge, FAB, Modal, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

type PropertyFormData = {
  name: string;
  address: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  status: "available" | "occupied" | "maintenance";
};

export default function Inicio() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: properties, isLoading } = useListProperties();
  
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
            <div key={i} className="h-72 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : properties?.length === 0 ? (
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
          {properties?.map(property => (
            <Card key={property.id} className="group">
              <div className="relative h-48 overflow-hidden">
                {/* landing page hero scenic mountain landscape - using as a nice placeholder for properties */}
                <img 
                  src={property.imageUrl || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80"} 
                  alt={property.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3 flex gap-2">
                  <Badge variant={
                    property.status === 'available' ? 'success' : 
                    property.status === 'occupied' ? 'warning' : 'destructive'
                  } className="shadow-sm backdrop-blur-md bg-white/90">
                    {property.status === 'available' ? 'Disponible' : 
                     property.status === 'occupied' ? 'Ocupada' : 'Mantenimiento'}
                  </Badge>
                </div>
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-sm font-bold text-foreground">
                  {formatCurrency(property.monthlyRent)}<span className="text-xs font-normal text-muted-foreground">/mes</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-bold leading-tight">{property.name}</h3>
                  <div className="flex items-center text-muted-foreground text-sm mt-1">
                    <MapPin size={14} className="mr-1 shrink-0" />
                    <span className="truncate">{property.address}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                  <div className="flex items-center text-muted-foreground text-sm font-medium">
                    <BedDouble size={16} className="mr-1.5 text-primary" />
                    {property.bedrooms} {property.bedrooms === 1 ? 'Hab' : 'Habs'}
                  </div>
                  <div className="flex items-center text-muted-foreground text-sm font-medium">
                    <Bath size={16} className="mr-1.5 text-primary" />
                    {property.bathrooms} {property.bathrooms === 1 ? 'Baño' : 'Baños'}
                  </div>
                  <div className="ml-auto text-xs font-semibold px-2 py-1 bg-accent rounded-md">
                    {property.type}
                  </div>
                </div>
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
  
  const { mutate, isPending } = useCreateProperty({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        reset();
        onClose();
      }
    }
  });

  const onSubmit = (data: PropertyFormData) => {
    mutate({
      data: {
        ...data,
        bedrooms: Number(data.bedrooms),
        bathrooms: Number(data.bathrooms),
        monthlyRent: Number(data.monthlyRent),
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Propiedad">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input 
          label="Nombre de la propiedad" 
          placeholder="Ej: Villa Paraíso" 
          {...register("name", { required: "El nombre es requerido" })} 
          error={errors.name?.message}
        />
        
        <Input 
          label="Dirección completa" 
          placeholder="Ej: Calle 123, Colonia Centro" 
          {...register("address", { required: "La dirección es requerida" })} 
          error={errors.address?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Tipo" {...register("type")} error={errors.type?.message}>
            <option value="Casa">Casa</option>
            <option value="Departamento">Departamento</option>
            <option value="Estudio">Estudio</option>
            <option value="Local">Local Comercial</option>
          </Select>

          <Select label="Estado" {...register("status")}>
            <option value="available">Disponible</option>
            <option value="occupied">Ocupada</option>
            <option value="maintenance">Mantenimiento</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Habitaciones" 
            type="number" min="0" 
            {...register("bedrooms", { required: true, valueAsNumber: true })} 
          />
          <Input 
            label="Baños" 
            type="number" min="0" step="0.5"
            {...register("bathrooms", { required: true, valueAsNumber: true })} 
          />
        </div>

        <Input 
          label="Renta Mensual (MXN)" 
          type="number" min="0"
          placeholder="Ej: 15000"
          {...register("monthlyRent", { required: "El monto es requerido", valueAsNumber: true })} 
          error={errors.monthlyRent?.message}
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
