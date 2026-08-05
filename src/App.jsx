import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SmartDebtOptimizer from './components/SmartDebtOptimizer';
import DebtManager from './components/DebtManager';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Estado para el login rápido por si no hay sesión activa
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Obtener sesión actual de Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuchar cambios de autenticación (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Error al iniciar sesión: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Pantalla de carga mientras verifica Supabase
  if (loading) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: '50px', textAlign: 'center' }}>
        <h3>🔄 Verificando sesión en Supabase...</h3>
      </div>
    );
  }

  // Si no hay sesión, mostramos un formulario de acceso limpio
  if (!session) {
    return (
      <div style={{ fontFamily: 'sans-serif', maxWidth: '400px', margin: '80px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
        <h2 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '20px' }}>Gestión Financiera</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input 
            type="email" 
            placeholder="Correo electrónico" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Iniciar Sesión
          </button>
        </form>
      </div>
    );
  }

  // Si ya hay sesión activa, mostramos la app organizada por pestañas
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Cabecera general */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Gestión Financiera Personal</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>{session?.user?.email}</span>
          <button 
            onClick={handleLogout}
            style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Menú de Pestañas (Navegación Superior) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #ddd', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('dashboard')} 
          style={{ padding: '8px 16px', background: activeTab === 'dashboard' ? '#007bff' : '#f8f9fa', color: activeTab === 'dashboard' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📊 Dashboard & Optimizador
        </button>
        <button 
          onClick={() => setActiveTab('cards')} 
          style={{ padding: '8px 16px', background: activeTab === 'cards' ? '#007bff' : '#f8f9fa', color: activeTab === 'cards' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          💳 Tarjetas y Gastos
        </button>
        <button 
          onClick={() => setActiveTab('debts')} 
          style={{ padding: '8px 16px', background: activeTab === 'debts' ? '#007bff' : '#f8f9fa', color: activeTab === 'debts' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🤝 Control de Deudas
        </button>
        <button 
          onClick={() => setActiveTab('config')} 
          style={{ padding: '8px 16px', background: activeTab === 'config' ? '#007bff' : '#f8f9fa', color: activeTab === 'config' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ⚙️ Ingresos y Configuración
        </button>
      </div>

      {/* Contenido Dinámico según la Pestaña Activa */}
      <div>
        {activeTab === 'dashboard' && (
          <div>
            <SmartDebtOptimizer session={session} />
          </div>
        )}

        {activeTab === 'cards' && (
          <div>
            <p style={{ color: '#666' }}>Sección de Tarjetas y Gastos...</p>
          </div>
        )}

        {activeTab === 'debts' && (
          <div>
            <DebtManager session={session} />
          </div>
        )}

        {activeTab === 'config' && (
          <div>
            <p style={{ color: '#666' }}>Configuración de Sueldo e Ingresos...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;