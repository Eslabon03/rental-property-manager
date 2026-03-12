import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CircleDollarSign, Wrench, Zap, FileText, Droplet } from "lucide-react";
import { useListExpenses, useListProperties, useCreateExpense, getListExpensesQueryKey } from "@workspace/api-client-react";
import { Button, Card, FAB, Modal, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

type ExpenseFormData = {
  propertyId: number;
  category: string;
  description: string;
  amount: number;
  date: string;
};

const CATEGORY_ICONS: Record<string, any> = {
  'Mantenimiento': Wrench,
  'Servicios': Zap,
  'Impuestos': FileText,
  'Limpieza': Droplet,
  'Otros': CircleDollarSign
};

export default function Gastos() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: expenses, isLoading } = useListExpenses();
  
  const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-lg shadow-primary/20 bg-gradient-to-br from-primary to-blue-700">
        <h2 className="text-primary-foreground/80 font-medium text-sm mb-1">Total Gastos (Este mes)</h2>
        <div className="text-4xl font-display font-bold">
          {formatCurrency(totalExpenses)}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-foreground">Registro de Gastos</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : expenses?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4 bg-card rounded-3xl border border-dashed border-border">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <CircleDollarSign size={28} />
          </div>
          <h3 className="text-lg font-bold mb-2">Todo en orden</h3>
          <p className="text-muted-foreground mb-6 text-sm max-w-[250px]">No has registrado gastos recientes. ¡Mantén tus finanzas al día!</p>
          <Button onClick={() => setIsModalOpen(true)} size="sm">Añadir Gasto</Button>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {expenses?.map(exp => {
            const Icon = CATEGORY_ICONS[exp.category] || CATEGORY_ICONS['Otros'];
            return (
              <Card key={exp.id} className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-primary shrink-0">
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base truncate">{exp.description}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                      {exp.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(exp.date), "dd MMM", { locale: es })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {exp.propertyName || `Propiedad #${exp.propertyId}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-destructive">-{formatCurrency(exp.amount)}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <FAB onClick={() => setIsModalOpen(true)} />
      <ExpenseFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function ExpenseFormModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseFormData>();
  const { data: properties } = useListProperties();
  
  const { mutate, isPending } = useCreateExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        reset();
        onClose();
      }
    }
  });

  const onSubmit = (data: ExpenseFormData) => {
    mutate({
      data: {
        ...data,
        propertyId: Number(data.propertyId),
        amount: Number(data.amount),
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Gasto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        <Select label="Propiedad" {...register("propertyId", { required: "Selecciona una propiedad" })} error={errors.propertyId?.message}>
          <option value="">Seleccionar...</option>
          {properties?.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Categoría" {...register("category", { required: "Requerido" })}>
            {Object.keys(CATEGORY_ICONS).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
          <Input 
            label="Fecha" 
            type="date"
            {...register("date", { required: "Requerido" })} 
            error={errors.date?.message}
          />
        </div>

        <Input 
          label="Descripción" 
          placeholder="Ej: Reparación de tubería" 
          {...register("description", { required: "Requerido" })} 
          error={errors.description?.message}
        />

        <Input 
          label="Monto (MXN)" 
          type="number" min="0" step="0.01"
          {...register("amount", { required: "Requerido", valueAsNumber: true })} 
          error={errors.amount?.message}
        />

        <div className="pt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" variant="primary" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar Gasto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
