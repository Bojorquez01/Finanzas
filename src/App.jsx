import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import PaymentPlanner from './components/PaymentPlanner';
import SmartDebtOptimizer from './components/SmartDebtOptimizer';
import IncomeManager from './components/IncomeManager';
import CreditCardManager from './components/CreditCardManager';
import SavingsManager from './components/SavingsManager';
import DebtManager from './components/DebtManager';
import { supabase } from './supabaseClient';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Auth />;
  }

  return (
    <div style={{ maxWidth: '950px', margin: '30px auto', padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Gestión Financiera Personal</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '13px', color: '#555' }}>Usuario: <strong>{session.user.email}</strong></span>
          <button 
            onClick={() => supabase.auth.signOut()} 
            style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <Dashboard session={session} />

      {/* Optimizador Inteligente con Colchón de Supervivencia */}
      <SmartDebtOptimizer session={session} />

      <PaymentPlanner session={session} />

      <IncomeManager session={session} />

      <SavingsManager session={session} />

      <CreditCardManager session={session} />

      <div style={{ marginTop: '40px' }}>
        <DebtManager session={session} />
      </div>

    </div>
  );
}

export default App;