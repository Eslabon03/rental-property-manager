import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Moon,
  Wrench,
  Package,
  CheckCircle2,
  Trash2,
  Plus,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Card, Button, Modal, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/roles";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface MantenimientoItem {
  id: number;
  propiedad_id: number;
  descripcion: string;
  foto_url: string | null;
  estado: string;
  creado_en: string;
  creado_por: string | null;
}

interface InsumoItem {
  id: number;
  nombre: string;
  cantidad_actual: number;
  cantidad_por_limpieza: number;
  unidad: string;
}

interface PropiedadBasic {
  id: number;
  nombre: string;
}

function useMantenimiento() {
  return useQuery<MantenimientoItem[]>({
    queryKey: ["admin-mantenimiento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mantenimiento_pendientes")
        .select("*")
        .order("creado_en", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
}

function useInsumos() {
  return useQuery<InsumoItem[]>({
    queryKey: ["admin-insumos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventario_insumos")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
}

function usePropiedadesBasic() {
  return useQuery<PropiedadBasic[]>({
    queryKey: ["propiedades-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propiedades")
        .select("id, nombre")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function Ajustes() {
  const [cerrando, setCerrando] = useState(false);
  const role = useRole();

  const cerrarSesion = async () => {
    setCerrando(true);
    await supabase.auth.signOut();
    setCerrando(false);
  };

  const settingsGroups = [
    {
      title: "Cuenta",
      items: [
        { icon: User, label: "Perfil personal", value: "Juan Pérez" },
        { icon: Shield, label: "Seguridad y contraseña", value: "" },
      ],
    },
    {
      title: "Preferencias",
      items: [
        { icon: Bell, label: "Notificaciones", value: "Activadas" },
        { icon: Moon, label: "Apariencia", value: "Claro" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            Ajustes
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configura tu aplicación
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold">
          JP
        </div>
        <div>
          <h3 className="font-bold text-lg">Juan Pérez</h3>
          <p className="text-muted-foreground text-sm">
            {role === "admin" ? "Administrador" : "Limpieza"}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {settingsGroups.map((group, idx) => (
          <div key={idx}>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 ml-1">
              {group.title}
            </h4>
            <Card className="divide-y divide-border/50">
              {group.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 hover:bg-accent/30 cursor-pointer transition-colors active:bg-accent/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary rounded-lg text-secondary-foreground">
                        <Icon size={18} />
                      </div>
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {item.value && <span className="text-sm">{item.value}</span>}
                      <ChevronRight size={18} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
      </div>

      {role === "admin" && <MantenimientoSection />}
      {role === "admin" && <InventarioSection />}

      <div className="pt-4 pb-8">
        <button
          onClick={cerrarSesion}
          disabled={cerrando}
          className="w-full flex items-center justify-center gap-2 py-4 text-destructive font-semibold bg-destructive/10 rounded-2xl hover:bg-destructive/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <LogOut size={20} />
          {cerrando ? "Cerrando..." : "Cerrar Sesión"}
        </button>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Versión 1.0.0 (Build 42)
        </p>
      </div>
    </div>
  );
}

function MantenimientoSection() {
  const { data: items, isError } = useMantenimiento();
  const { data: propiedades } = usePropiedadesBasic();
  const queryClient = useQueryClient();

  const resolverMut = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("mantenimiento_pendientes")
        .update({ estado: "resuelto" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-mantenimiento"] });
    },
  });

  const eliminarMut = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("mantenimiento_pendientes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-mantenimiento"] });
    },
  });

  const getPropNombre = (propId: number) =>
    propiedades?.find((p) => p.id === propId)?.nombre ?? `#${propId}`;

  const pendientes = (items ?? []).filter((i) => i.estado === "pendiente");

  if (isError) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 ml-1 flex items-center gap-2">
        <Wrench size={14} />
        Mantenimiento Pendiente ({pendientes.length})
      </h4>

      {pendientes.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay reportes de daño pendientes
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendientes.map((item) => (
            <Card key={item.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    {getPropNombre(item.propiedad_id)}
                  </p>
                  <p className="text-sm text-foreground/80 mt-1">
                    {item.descripcion}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>
                      {format(parseISO(item.creado_en), "dd MMM yyyy HH:mm", {
                        locale: es,
                      })}
                    </span>
                    {item.creado_por && (
                      <span className="truncate">por {item.creado_por}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => resolverMut.mutate(item.id)}
                    disabled={resolverMut.isPending}
                    className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Marcar como resuelto"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  <button
                    onClick={() => eliminarMut.mutate(item.id)}
                    disabled={eliminarMut.isPending}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {item.foto_url && (
                <a
                  href={item.foto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink size={12} />
                  Ver foto del daño
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InventarioSection() {
  const { data: insumos, isError } = useInsumos();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const eliminarMut = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("inventario_insumos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-insumos"] });
    },
  });

  if (isError) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 ml-1">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Package size={14} />
          Inventario de Insumos
        </h4>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {!insumos || insumos.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay insumos configurados. Agrega insumos para deducir automáticamente al completar limpiezas.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border/50">
          {insumos.map((item) => {
            const isLow = item.cantidad_actual <= item.cantidad_por_limpieza * 2;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usa {item.cantidad_por_limpieza} {item.unidad} por limpieza
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="text-right">
                    <p
                      className={`font-bold text-sm ${
                        isLow ? "text-amber-600" : "text-foreground"
                      }`}
                    >
                      {item.cantidad_actual} {item.unidad}
                    </p>
                    {isLow && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle size={10} />
                        Stock bajo
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => eliminarMut.mutate(item.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {showAddModal && (
        <AddInsumoModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

function AddInsumoModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [porLimpieza, setPorLimpieza] = useState("1");
  const [unidad, setUnidad] = useState("unidad");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg("Ingresa un nombre");
      return;
    }
    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from("inventario_insumos").insert({
        nombre: nombre.trim(),
        cantidad_actual: Number(cantidad) || 0,
        cantidad_por_limpieza: Number(porLimpieza) || 1,
        unidad: unidad.trim() || "unidad",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-insumos"] });
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al guardar";
      setErrorMsg(message);
    }
    setSaving(false);
  };

  return (
    <Modal isOpen onClose={onClose} title="Agregar Insumo">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {errorMsg}
          </div>
        )}

        <Input
          label="Nombre del insumo"
          placeholder="Ej: Cloro, Jabón, Toallas..."
          value={nombre}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNombre(e.target.value)
          }
        />

        <Input
          label="Cantidad actual"
          type="number"
          min="0"
          step="1"
          placeholder="Ej: 50"
          value={cantidad}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCantidad(e.target.value)
          }
        />

        <Input
          label="Cantidad por limpieza"
          type="number"
          min="0"
          step="0.5"
          placeholder="Ej: 1"
          value={porLimpieza}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setPorLimpieza(e.target.value)
          }
        />

        <Input
          label="Unidad"
          placeholder="Ej: unidad, litro, galón"
          value={unidad}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setUnidad(e.target.value)
          }
        />

        <div className="pt-4 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Guardando..." : "Agregar Insumo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
