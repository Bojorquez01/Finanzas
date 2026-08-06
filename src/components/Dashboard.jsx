import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

function Dashboard({ session }) {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [minLivingExpense, setMinLivingExpense] = useState(0);

  useEffect(() => {
    if (session) fetchDashboardData();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function fetchDashboardData() {
    // 1. Obtener sueldo y colchón intocable (min_living_expense)
    const { data: salaryData } = await supabase
      .from('user_salary_config')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    let salaryMonthly = 0;
    if (salaryData) {
      salaryMonthly = salaryData.frequency === 'quincenal' 
        ? Number(salaryData.salary_amount) * 2 
        : Number(salaryData.salary_amount);
      
      setMinLivingExpense(Number(salaryData.min_living_expense || 0));
    }

    // 2. Ingresos extras
    const { data: incData } = await supabase.from('incomes').select('amount').eq('user_id', session.user.id);
    const extrasSum = (incData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    setTotalIncome(salaryMonthly + extrasSum);

    // 3. Gastos de tarjetas
    const { data: expData } = await supabase.from('expenses').select('amount');
    const expenseSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    setTotalExpenses(expenseSum);

    // 4. Deudas pendientes
    const { data: debtData } = await supabase
      .from('debts')
      .select('amount, debtor_id, status')
      .eq('debtor_id', session.user.id);

    const debtSum = (debtData || [])
      .filter(d => d.status !== 'pagado')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    setTotalDebt(debtSum);
  }

  const netBalance = totalIncome - totalExpenses - totalDebt;

  // Cálculo de meses de supervivencia (Runway)
  const monthlyBurnRate = totalExpenses + totalDebt;
  const runwayMonths = minLivingExpense > 0 && monthlyBurnRate > 0 
    ? (minLivingExpense / monthlyBurnRate).toFixed(1) 
    : 'N/A';

  // Datos para la gráfica de barras de Recharts
  const chartData = [
    {
      name: 'Flujo Financiero',
      Ingresos: totalIncome,
      'Gastos Tarjetas': totalExpenses,
      'Deudas Activas': totalDebt,
    },
  ];

  return (
    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px' }}>Resumen Financiero Mensual</h3>
      
      {/* Tarjetas de Indicadores */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: 1, minWidth: '180px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>INGRESOS</p>
          <p style={{ margin: 0, fontSize: '20px', color: '#27ae60', fontWeight: 'bold' }}>+${fmt(totalIncome)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '180px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>GASTOS TARJETAS</p>
          <p style={{ margin: 0, fontSize: '20px', color: '#dc3545', fontWeight: 'bold' }}>-${fmt(totalExpenses)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '180px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>DEUDAS PENDIENTES</p>
          <p style={{ margin: 0, fontSize: '20px', color: '#e67e22', fontWeight: 'bold' }}>-${fmt(totalDebt)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '180px', background: netBalance >= 0 ? '#e8f8f5' : '#fdedec', padding: '15px', borderRadius: '6px', border: `1px solid ${netBalance >= 0 ? '#a3e4d7' : '#f5b7b1'}` }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#2c3e50', fontWeight: 'bold' }}>BALANCE NETO</p>
          <p style={{ margin: 0, fontSize: '20px', color: netBalance >= 0 ? '#117a65' : '#c0392b', fontWeight: 'bold' }}>${fmt(netBalance)}</p>
        </div>
      </div>

      {/* Gráfica de Barras de Flujo de Caja (Punto 3) */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '15px' }}>📈 Comparativa Visual de Flujo de Caja</h4>
        <div style={{ width: '100%', height: '260px' }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `$${fmt(value)}`} />
              <Legend />
              <Bar dataKey="Ingresos" fill="#27ae60" />
              <Bar dataKey="Gastos Tarjetas" fill="#dc3545" />
              <Bar dataKey="Deudas Activas" fill="#e67e22" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Calculadora de Runway / Meses de Supervivencia (Punto 4) */}
      <div style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '14px' }}>🛡️ Salud de Colchón Financiero (Runway)</h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Basado en tu colchón intocable configurado frente a tus salidas de dinero mensuales.</p>
        </div>
        <div style={{ background: '#f1f5f9', padding: '8px 15px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{runwayMonths} meses de respaldo</span>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;