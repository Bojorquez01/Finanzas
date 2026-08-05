import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function Dashboard({ session }) {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);

  useEffect(() => {
    if (session) fetchDashboardData();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function fetchDashboardData() {
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
    }

    const { data: incData } = await supabase.from('incomes').select('amount');
    const extrasSum = (incData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    setTotalIncome(salaryMonthly + extrasSum);

    const { data: expData } = await supabase.from('expenses').select('amount');
    const expenseSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    setTotalExpenses(expenseSum);

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

  return (
    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px' }}>Resumen Financiero Mensual</h3>
      
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
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
    </div>
  );
}

export default Dashboard;