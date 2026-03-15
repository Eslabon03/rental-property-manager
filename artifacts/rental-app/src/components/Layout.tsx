import { Link, useLocation } from "wouter";
import { Home, Calendar, CalendarDays, CircleDollarSign, Settings, BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRole } from "@/lib/roles";
import barmelLogo from "@assets/Barmel_Logo-01_1773315387886.jpg";
import { AsistenteChat } from "./AsistenteChat";

const ALL_NAV_ITEMS = [
  { path: "/", label: "Inicio", icon: Home, adminOnly: true },
  { path: "/reservas", label: "Reservas", icon: Calendar, adminOnly: true },
  { path: "/calendario", label: "Calendario", icon: CalendarDays, adminOnly: true },
  { path: "/limpieza", label: "Limpieza", icon: Sparkles, limpiezaOnly: true, adminOnly: false },
  { path: "/gastos", label: "Gastos", icon: CircleDollarSign, adminOnly: false },
  { path: "/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
  { path: "/ajustes", label: "Ajustes", icon: Settings, adminOnly: false },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const role = useRole();

  const navItems = role === "limpieza"
    ? ALL_NAV_ITEMS.filter(item => !item.adminOnly)
    : ALL_NAV_ITEMS.filter(item => !("limpiezaOnly" in item && item.limpiezaOnly));

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans relative">
      <div
        className="watermark-bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}barmel-logo.png)` }}
      />

      {/* Header */}
      <header className="fixed top-0 inset-x-0 h-16 bg-header text-header-foreground flex items-center px-5 z-50 shadow-md">
        <div className="max-w-5xl mx-auto w-full flex items-center gap-3">
          <img src={barmelLogo} alt="Barmel" className="h-9 w-9 rounded-xl object-cover shadow-inner" />
          <h1 className="text-xl font-display font-bold tracking-wide">Gestión de Rentas</h1>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-16 pb-20 overflow-x-hidden relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 w-full h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 h-20 glass-nav border-t border-border flex items-center justify-around z-50 pb-safe px-2 sm:px-6 md:max-w-md md:mx-auto md:rounded-t-3xl md:border-x md:shadow-lg">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path} className="flex-1 flex flex-col items-center justify-center gap-1 h-full relative group">
              <div className={cn(
                "relative flex items-center justify-center p-2 rounded-xl transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground group-hover:bg-accent/50"
              )}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <motion.div 
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" 
                  />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <AsistenteChat />
    </div>
  );
}