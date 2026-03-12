import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, User, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useListReservations, useListProperties, useCreateReservation, getListReservationsQueryKey } from "@workspace/api-client-react";
import { Button, Card, Badge, FAB, Modal, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

type ReservationFormData = {
  propertyId: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  status: "confirmed" | "pending" | "cancelled" | "completed";
};

export default function Reservas() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: reservations, isLoading } = useListReservations();
  
  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'confirmed': return { color: 'success' as const, label: 'Confirmada', icon: CheckCircle2 };
      case 'pending': return { color: 'warning' as const, label: 'Pendiente', icon: Clock };
      case 'cancelled': return { color: 'destructive' as const, label: 'Cancelada', icon: XCircle };
      case 'completed': return { color: 'default' as const, label: 'Completada', icon: CheckCircle2 };
      default: return { color: 'default' as const, label: status, icon: Clock };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Reservas</h2>
          <p className="text-muted-foreground text-sm mt-1">Historial de ocupaciones</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : reservations?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <CalendarIcon size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">No hay reservas</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Registra tu primera reserva para llevar el control de tus fechas.</p>
          <Button onClick={() => setIsModalOpen(true)}>Crear Reserva</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations?.map(res => {
            const statusConfig = getStatusConfig(res.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card key={res.id} className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{res.propertyName || `Propiedad #${res.propertyId}`}</h3>
                    <div className="flex items-center text-muted-foreground mt-1">
                      <User size={14} className="mr-1.5" />
                      <span className="font-medium text-sm text-foreground/80">{res.guestName}</span>
                    </div>
                  </div>
                  <Badge variant={statusConfig.color} className="flex items-center gap-1 pl-1.5 pr-2.5 py-1">
                    <StatusIcon size={12} />
                    {statusConfig.label}
                  </Badge>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-center justify-between mb-4 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Check-in</span>
                    <span className="font-semibold text-sm">
                      {format(parseISO(res.checkIn), "dd MMM, yyyy", { locale: es })}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-border mx-4"></div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Check-out</span>
                    <span className="font-semibold text-sm">
                      {format(parseISO(res.checkOut), "dd MMM, yyyy", { locale: es })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-bold text-lg text-primary">{formatCurrency(res.totalAmount)}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <FAB onClick={() => setIsModalOpen(true)} />
      <ReservationFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function ReservationFormModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReservationFormData>();
  const { data: properties } = useListProperties();
  
  const { mutate, isPending } = useCreateReservation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
        reset();
        onClose();
      }
    }
  });

  const onSubmit = (data: ReservationFormData) => {
    mutate({
      data: {
        ...data,
        propertyId: Number(data.propertyId),
        totalAmount: Number(data.totalAmount),
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Reserva">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        <Select label="Propiedad" {...register("propertyId", { required: "Selecciona una propiedad" })} error={errors.propertyId?.message}>
          <option value="">Seleccionar...</option>
          {properties?.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>

        <Input 
          label="Nombre del Huésped" 
          placeholder="Ej: Juan Pérez" 
          {...register("guestName", { required: "El nombre es requerido" })} 
          error={errors.guestName?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Check-in" 
            type="date"
            {...register("checkIn", { required: "Requerido" })} 
            error={errors.checkIn?.message}
          />
          <Input 
            label="Check-out" 
            type="date"
            {...register("checkOut", { required: "Requerido" })} 
            error={errors.checkOut?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Total a cobrar (MXN)" 
            type="number" min="0"
            {...register("totalAmount", { required: "Requerido", valueAsNumber: true })} 
            error={errors.totalAmount?.message}
          />
          <Select label="Estado" {...register("status")}>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmada</option>
            <option value="completed">Completada</option>
          </Select>
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
