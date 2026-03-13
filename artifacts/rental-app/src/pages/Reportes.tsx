import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Building2, TrendingUp, Home, Briefcase, DollarSign, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, Badge } from "@/components/ui";

type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  pais: string;
  renta_fija_lps: number | null;
  esta_alquilada: boolean;
};

type Reserva = {
  id: number;
  propiedad_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  nombre_huesped: string;
  monto: number | null;
  monto_bruto: number | null;
  monto_neto: number | null;
  canal_renta: string | null;
  origen: string | null;
};

type Gasto = {
  id: number;
  propiedad_id: number;
  monto: number;
  fecha: string;
  categoria: string;
};

function usePropiedades() {
  return useQuery<Propiedad[]>({
    queryKey: ["reportes-propiedades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propiedades")
        .select("id, nombre, tipo, pais, renta_fija_lps, esta_alquilada")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useReservasMes(mesInicio: string, mesFin: string) {
  return useQuery<Reserva[]>({
    queryKey: ["reportes-reservas", mesInicio, mesFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .gte("fecha_fin", mesInicio)
        .lte("fecha_inicio", mesFin)
        .order("fecha_inicio");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useGastosMes(mesInicio: string, mesFin: string) {
  return useQuery<Gasto[]>({
    queryKey: ["reportes-gastos", mesInicio, mesFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gastos")
        .select("id, propiedad_id, monto, fecha, categoria")
        .gte("fecha", mesInicio)
        .lte("fecha", mesFin);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function Reportes() {
  const [mesActual, setMesActual] = useState(new Date());

  const inicio = startOfMonth(mesActual);
  const fin = endOfMonth(mesActual);
  const mesInicioStr = format(inicio, "yyyy-MM-dd");
  const mesFinStr = format(fin, "yyyy-MM-dd");

  const { data: propiedades, isLoading: loadingProps } = usePropiedades();
  const { data: reservas, isLoading: loadingRes } = useReservasMes(mesInicioStr, mesFinStr);
  const { data: gastos, isLoading: loadingGastos } = useGastosMes(mesInicioStr, mesFinStr);

  const isLoading = loadingProps || loadingRes || loadingGastos;

  const reporte = useMemo(() => {
    if (!propiedades || !reservas) return null;

    const vacacionales: Array<{
      propiedad: Propiedad;
      reservas: Reserva[];
      ingresos: number;
      diasOcupados: number;
    }> = [];

    const mensuales: Array<{
      propiedad: Propiedad;
      ingreso: number;
    }> = [];

    for (const prop of propiedades) {
      if (prop.tipo === "vacacional") {
        const reservasProp = reservas.filter(r => r.propiedad_id === prop.id);
        const ingresos = reservasProp.reduce((sum, r) => {
          const neto = r.monto_neto != null ? Number(r.monto_neto) : null;
          const fallback = Number(r.monto) || 0;
          return sum + (neto ?? fallback);
        }, 0);

        let diasOcupados = 0;
        for (const r of reservasProp) {
          const rInicio = new Date(Math.max(new Date(r.fecha_inicio).getTime(), inicio.getTime()));
          const rFin = new Date(Math.min(new Date(r.fecha_fin).getTime(), fin.getTime()));
          const dias = Math.ceil((rFin.getTime() - rInicio.getTime()) / (1000 * 60 * 60 * 24));
          if (dias > 0) diasOcupados += dias;
        }

        vacacionales.push({ propiedad: prop, reservas: reservasProp, ingresos, diasOcupados });
      } else if (prop.tipo === "mensual") {
        const ingreso = prop.esta_alquilada && prop.renta_fija_lps ? prop.renta_fija_lps : 0;
        mensuales.push({ propiedad: prop, ingreso });
      }
    }

    vacacionales.sort((a, b) => b.ingresos - a.ingresos);
    mensuales.sort((a, b) => b.ingreso - a.ingreso);

    const totalVacacionales = vacacionales.reduce((sum, v) => sum + v.ingresos, 0);
    const totalMensuales = mensuales.reduce((sum, m) => sum + m.ingreso, 0);
    const totalGeneral = totalVacacionales + totalMensuales;
    const totalGastos = gastos?.reduce((sum, g) => sum + Number(g.monto), 0) ?? 0;

    return { vacacionales, mensuales, totalVacacionales, totalMensuales, totalGeneral, totalGastos };
  }, [propiedades, reservas, gastos, inicio, fin]);

  const mesAnterior = () => setMesActual(prev => subMonths(prev, 1));
  const mesSiguiente = () => setMesActual(prev => addMonths(prev, 1));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Reportes</h2>
        <p className="text-muted-foreground text-sm mt-1">Ingresos y gastos por mes</p>
      </div>

      <Card className="p-3">
        <div className="flex items-center justify-between">
          <button onClick={mesAnterior} className="p-2 rounded-xl hover:bg-accent transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-lg font-bold capitalize">
              {format(mesActual, "MMMM yyyy", { locale: es })}
            </p>
          </div>
          <button onClick={mesSiguiente} className="p-2 rounded-xl hover:bg-accent transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : reporte ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-emerald-500" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ingresos</span>
              </div>
              <p className="text-xl font-black text-emerald-600">L {reporte.totalGeneral.toLocaleString("es-HN")}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} className="text-red-500" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gastos</span>
              </div>
              <p className="text-xl font-black text-red-600">L {reporte.totalGastos.toLocaleString("es-HN")}</p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp size={16} className="text-emerald-600" />
                </div>
                <span className="text-sm font-bold">Balance Neto</span>
              </div>
              <span className={`text-lg font-black ${(reporte.totalGeneral - reporte.totalGastos) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                L {(reporte.totalGeneral - reporte.totalGastos).toLocaleString("es-HN")}
              </span>
            </div>
          </Card>

          {reporte.vacacionales.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Home size={16} className="text-primary" />
                <h3 className="text-lg font-bold text-foreground">Vacacionales</h3>
                <Badge variant="default" className="text-xs ml-auto">
                  L {reporte.totalVacacionales.toLocaleString("es-HN")}
                </Badge>
              </div>

              {reporte.vacacionales.map(v => (
                <Card key={v.propiedad.id} className="overflow-hidden">
                  <div className={`h-1 w-full ${v.ingresos > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold leading-tight truncate">{v.propiedad.nombre}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.propiedad.pais}</p>
                      </div>
                      <span className="text-sm font-black text-emerald-600 shrink-0">
                        L {v.ingresos.toLocaleString("es-HN")}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{v.diasOcupados} días ocupados</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 size={12} />
                        <span>{v.reservas.length} reserva(s)</span>
                      </div>
                    </div>

                    {v.reservas.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                        {v.reservas.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate text-muted-foreground">{r.nombre_huesped}</span>
                              {r.canal_renta && (
                                <Badge variant={r.origen === "ical" ? "warning" : "default"} className="text-[9px] shrink-0">{r.canal_renta}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {r.monto_bruto != null && (
                                <span className="text-muted-foreground">
                                  L {Number(r.monto_bruto).toLocaleString("es-HN")}
                                </span>
                              )}
                              <span className="font-semibold text-emerald-600">
                                L {(r.monto_neto != null ? Number(r.monto_neto) : (Number(r.monto) || 0)).toLocaleString("es-HN")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {reporte.mensuales.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-primary" />
                <h3 className="text-lg font-bold text-foreground">Mensuales (Renta Fija)</h3>
                <Badge variant="default" className="text-xs ml-auto">
                  L {reporte.totalMensuales.toLocaleString("es-HN")}
                </Badge>
              </div>

              {reporte.mensuales.map(m => (
                <Card key={m.propiedad.id} className="overflow-hidden">
                  <div className={`h-1 w-full ${m.ingreso > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold leading-tight truncate">{m.propiedad.nombre}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.propiedad.pais}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-sm font-black ${m.ingreso > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          L {m.ingreso.toLocaleString("es-HN")}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {m.propiedad.esta_alquilada ? "Alquilada" : "Disponible"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
