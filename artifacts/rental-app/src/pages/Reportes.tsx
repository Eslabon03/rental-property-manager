import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Reportes() {
  const [gastosTotal, setGastosTotal] = useState(0);
  const [ocupacion, setOcupacion] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Fechas del mes actual
      const date = new Date();
      const primerDia = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
      const ultimoDia = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();

      // 1. Calcular total de gastos del mes
      const { data: gastos } = await supabase
        .from('gastos')
        .select('monto')
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia);

      const totalG = gastos?.reduce((sum, g) => sum + Number(g.monto), 0) || 0;
      setGastosTotal(totalG);

      // 2. Calcular días de ocupación (solo propiedades vacacionales)
      const { data: propiedades } = await supabase.from('propiedades').select('*');
      const { data: reservas } = await supabase
        .from('reservas')
        .select('*')
        .gte('fecha_fin', primerDia)
        .lte('fecha_inicio', ultimoDia);

      const stats = propiedades?.map(prop => {
        const reservasProp = reservas?.filter(r => r.propiedad_id === prop.id) || [];
        let diasOcupados = 0;

        reservasProp.forEach(res => {
          const inicio = new Date(Math.max(new Date(res.fecha_inicio).getTime(), new Date(primerDia).getTime()));
          const fin = new Date(Math.min(new Date(res.fecha_fin).getTime(), new Date(ultimoDia).getTime()));
          const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
          if(dias > 0) diasOcupados += dias;
        });

        return { ...prop, diasOcupados };
      }).filter(p => p.tipo === 'vacacional')
        .sort((a, b) => b.diasOcupados - a.diasOcupados); // Ordenar de mayor a menor ocupación

      setOcupacion(stats || []);
    } catch (error) {
      console.error("Error cargando reportes", error);
    } finally {
      setCargando(false);
    }
  };

  if (cargando) return <div className="p-8 text-center text-gray-500 font-bold">Calculando reportes del mes...</div>;

  return (
    <div className="p-4 max-w-md mx-auto mb-20 space-y-6">
      <h2 className="text-2xl font-extrabold text-blue-900">Reporte Mensual</h2>

      {/* Tarjeta de Gastos */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
        <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Total Gastos (Mes Actual)</p>
        <p className="text-3xl font-black text-red-600">L {gastosTotal.toLocaleString()}</p>
      </div>

      {/* Lista de Ocupación */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-3">Días de Ocupación</h3>
        <div className="space-y-2">
          {ocupacion.map(prop => (
            <div key={prop.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-gray-700">{prop.nombre}</span>
              <span className={`py-1 px-3 rounded-lg font-bold text-sm ${prop.diasOcupados > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {prop.diasOcupados} días
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}