import { useState } from "react";
import { User, Bell, Shield, LogOut, ChevronRight, Moon } from "lucide-react";
import { Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";

export default function Ajustes() {
  const [cerrando, setCerrando] = useState(false);

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
      ]
    },
    {
      title: "Preferencias",
      items: [
        { icon: Bell, label: "Notificaciones", value: "Activadas" },
        { icon: Moon, label: "Apariencia", value: "Claro" },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Ajustes</h2>
          <p className="text-muted-foreground text-sm mt-1">Configura tu aplicación</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold">
          JP
        </div>
        <div>
          <h3 className="font-bold text-lg">Juan Pérez</h3>
          <p className="text-muted-foreground text-sm">Administrador</p>
        </div>
      </div>

      <div className="space-y-6">
        {settingsGroups.map((group, idx) => (
          <div key={idx}>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 ml-1">{group.title}</h4>
            <Card className="divide-y divide-border/50">
              {group.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-accent/30 cursor-pointer transition-colors active:bg-accent/50">
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

      <div className="pt-4 pb-8">
        <button
          onClick={cerrarSesion}
          disabled={cerrando}
          className="w-full flex items-center justify-center gap-2 py-4 text-destructive font-semibold bg-destructive/10 rounded-2xl hover:bg-destructive/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <LogOut size={20} />
          {cerrando ? "Cerrando..." : "Cerrar Sesión"}
        </button>
        <p className="text-center text-xs text-muted-foreground mt-6">Versión 1.0.0 (Build 42)</p>
      </div>
    </div>
  );
}
