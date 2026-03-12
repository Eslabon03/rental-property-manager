import { useState } from 'react';
import { supabase } from './lib/supabase';
import barmelLogo from "@assets/Barmel_Logo-01_1773315387886.jpg";

export default function Login({ onLoginSuccess }: { onLoginSuccess: (session: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setError('Correo o contraseña incorrectos.');
    } else {
      onLoginSuccess(data.session);
    }
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={barmelLogo} alt="Barmel" className="h-20 w-20 rounded-2xl object-cover mb-3 shadow-md" />
          <h1 className="text-2xl font-bold text-center text-blue-900">Gestión de Rentas</h1>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={iniciarSesion} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Usuario (Correo)</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={cargando}
            className="w-full bg-blue-700 text-white font-bold py-2 px-4 rounded hover:bg-blue-800 transition duration-200 mt-4"
          >
            {cargando ? 'Verificando...' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}