import { useState } from 'react';
import SmartDebtOptimizer from './components/SmartDebtOptimizer';
import DebtManager from './components/DebtManager';
// ... importa tus otros componentes (CreditCards, Expenses, etc.)

function App({ session }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Cabecera general */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Gestión Financiera Personal</h2>
        <span style={{ fontSize: '13px', color: '#666' }}>{session.user.email}</span>
      </div>

      {/* Menú de Pestañas (Navegación Superior) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
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
            {/* Aquí pones tus tarjetas de resumen de ingresos/egresos y el optimizador */}
            <SmartDebtOptimizer session={session} />
          </div>
        )}

        {activeTab === 'cards' && (
          <div>
            {/* Aquí pones la gestión de tarjetas, gastos y proyecciones */}
            <p>Sección de Tarjetas y Gastos...</p>
          </div>
        )}

        {activeTab === 'debts' && (
          <div>
            <DebtManager session={session} />
          </div>
        )}

        {activeTab === 'config' && (
          <div>
            {/* Aquí pones configuración de sueldo, colchón e ingresos extras */}
            <p>Configuración de Sueldo e Ingresos...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;