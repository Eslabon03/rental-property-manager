import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "./components/Layout";
import Inicio from "./pages/Inicio";
import Reservas from "./pages/Reservas";
import Gastos from "./pages/Gastos";
import Reportes from "./pages/Reportes"; // Aquí está la nueva conexión
import Ajustes from "./pages/Ajustes";

import { supabase } from "./lib/supabase";
import Login from "./Login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Inicio} />
        <Route path="/reservas" component={Reservas} />
        <Route path="/gastos" component={Gastos} />
        <Route path="/reportes" component={Reportes} />
        <Route path="/ajustes" component={Ajustes} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargando(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Cargando seguridad...</div>;
  }

  if (!session) {
    return <Login onLoginSuccess={setSession} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;