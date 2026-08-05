import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function PaymentPlanner({ session }) {
  // Mes seleccionado para consultar la quincena (por defecto el mes actual YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [q1Cards, setQ1Cards] = useState([]);
  const [q2Cards, setQ2Cards] = useState([]);
  const [q1Debts, setQ1Debts] = useState([]);
  const [q2Debts, setQ2Debts] = useState([]);

  useEffect(() => {
    if (session) calculatePlan();
  }, [session, selectedMonth]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function calculatePlan() {
    // 1. Obtener tarjetas
    const { data: cards } = await supabase.from('credit_cards').select('*');
    
    // 2. Obtener gastos del mes actual
    const { data: expenses } = await supabase.from('expenses').select('*');
    
    // 3. Obtener proyecciones futuras
    const { data: projections } = await supabase.from('card_statement_projections').select('*');

    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const isCurrentMonth = selectedMonth === currentMonthStr;

    const cardDetails = (cards || []).map(card => {
      // Si consultamos el mes actual, sumamos gastos directos registrados este mes
      const currentExpensesSpent = isCurrentMonth
        ? (expenses || [])
            .filter(e => e.card_id === card.id)
            .reduce((sum, curr) => sum + Number(curr.amount), 0)
        : 0;

      // Sumar ÚNICAMENTE las proyecciones que pertenecen exactamente al mes seleccionado
      const monthProjectionSpent = (projections || [])
        .filter(p => p.card_id === card.id && p.target_month === selectedMonth)
        .reduce((sum, curr) => sum + Number(curr.amount), 0);

      // Total correspondiente A ESTE MES ESPECÍFICO
      const totalDueThisMonth = currentExpensesSpent + monthProjectionSpent;

      return { ...card, totalSpent: totalDueThisMonth };
    });

    // Separar tarjetas por su día límite de pago (1-15 para Quincena 1, 16-31 para Quincena 2)
    const q1C = cardDetails.filter(c => c.payment_due_day && c.payment_due_day >= 1 && c.payment_due_day <= 15);
    const q2C = cardDetails.filter(c => c.payment_due_day && c.payment_due_day > 15 && c.payment_due_day <= 31);

    setQ1Cards(q1C);
    setQ2Cards(q2C);

    // 4. Obtener deudas activas que debo con cuotas fijas
    const { data: debts } = await supabase
      .from('debts')
      .select('*')
      .eq('debtor_email', session.user.email)
      .neq('status', 'pagado');

    const activeDebts = debts || [];
    
    // Solo tomamos en cuenta cuotas fijas divididas si tienen cuota asignada
    setQ1Debts(activeDebts);
    setQ2Debts(activeDebts);
  }

  const q1CardTotal = q1Cards.reduce((acc, c) => acc + c.totalSpent, 0);
  const q2CardTotal = q2Cards.reduce((acc, c) => acc + c.totalSpent, 0);

  // Deudas con cuota mensual asignada divididas entre quincenas
  const q1DebtTotal = q1Debts.reduce((acc, d) => acc + (d.monthly_payment ? Number(d.monthly_payment) / 2 : 0), 0);
  const q2DebtTotal = q2Debts.reduce((acc, d) => acc + (d.monthly_payment ? Number(d.monthly_payment) / 2 : 0), 0);

  return (
    <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: '20px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, color: '#856404', fontSize: '18px' }}>🤖 Asistente de Pagos por Quincena</h3>
        
        {/* Selector de Mes para Planificar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#856404' }}>Consultar Mes:</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ffeeba' }}
          />
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#664d03', marginBottom: '15px' }}>
        Mostrando los cobros correspondientes a <strong>{selectedMonth}</strong> desglosados por fecha límite de pago:
      </p>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Quincena 1 */}
        <div style={{ flex: 1, minWidth: '280px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ffe8a1' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#b7791f', fontSize: '15px' }}>📅 Quincena 1 (Días 1 al 15)</h4>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>
            Total sugerido a pagar: <span style={{ color: '#d97706' }}>${fmt(q1CardTotal + q1DebtTotal)}</span>
          </p>

          <div style={{ fontSize: '12px', color: '#555', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <strong>Tarjetas que vencen en esta quincena:</strong>
            {q1Cards.length === 0 ? <span style={{ color: '#888' }}>Ninguna tarjeta vence entre el día 1 y 15.</span> : (
              q1Cards.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', padding: '6px 10px', borderRadius: '4px' }}>
                  <span>• {c.card_name} (Día {c.payment_due_day})</span>
                  <strong style={{ color: c.totalSpent > 0 ? '#dc3545' : '#666' }}>${fmt(c.totalSpent)}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quincena 2 */}
        <div style={{ flex: 1, minWidth: '280px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ffe8a1' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#b7791f', fontSize: '15px' }}>📅 Quincena 2 (Días 16 al 31)</h4>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>
            Total sugerido a pagar: <span style={{ color: '#d97706' }}>${fmt(q2CardTotal + q2DebtTotal)}</span>
          </p>

          <div style={{ fontSize: '12px', color: '#555', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <strong>Tarjetas que vencen en esta quincena:</strong>
            {q2Cards.length === 0 ? <span style={{ color: '#888' }}>Ninguna tarjeta vence entre el día 16 y 31.</span> : (
              q2Cards.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', padding: '6px 10px', borderRadius: '4px' }}>
                  <span>• {c.card_name} (Día {c.payment_due_day})</span>
                  <strong style={{ color: c.totalSpent > 0 ? '#dc3545' : '#666' }}>${fmt(c.totalSpent)}</strong>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default PaymentPlanner;