import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function PaymentPlanner({ session }) {
  const [q1Cards, setQ1Cards] = useState([]);
  const [q2Cards, setQ2Cards] = useState([]);
  const [q1Debts, setQ1Debts] = useState([]);
  const [q2Debts, setQ2Debts] = useState([]);

  useEffect(() => {
    if (session) calculatePlan();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function calculatePlan() {
    // 1. Obtener tarjetas
    const { data: cards } = await supabase.from('credit_cards').select('*');
    // 2. Obtener gastos del mes actual
    const { data: expenses } = await supabase.from('expenses').select('*');
    // 3. Obtener proyecciones futuras (por si tienen montos en meses específicos)
    const { data: projections } = await supabase.from('card_statement_projections').select('*');

    const cardDetails = (cards || []).map(card => {
      // Gastos del mes actual para esta tarjeta
      const currentSpent = (expenses || [])
        .filter(e => e.card_id === card.id)
        .reduce((sum, curr) => sum + Number(curr.amount), 0);

      // Proyecciones futuras para esta tarjeta
      const futureSpent = (projections || [])
        .filter(p => p.card_id === card.id)
        .reduce((sum, curr) => sum + Number(curr.amount), 0);

      // Total a pagar de la tarjeta (mes actual + proyecciones)
      const totalCardSpent = currentSpent + futureSpent;

      return { ...card, totalSpent: totalCardSpent };
    });

    // Separar tarjetas estrictamente por su día límite de pago (1-15 vs 16-31)
    const q1C = cardDetails.filter(c => c.payment_due_day && c.payment_due_day >= 1 && c.payment_due_day <= 15);
    const q2C = cardDetails.filter(c => c.payment_due_day && c.payment_due_day > 15 && c.payment_due_day <= 31);

    setQ1Cards(q1C);
    setQ2Cards(q2C);

    // 4. Obtener deudas activas que debo
    const { data: debts } = await supabase
      .from('debts')
      .select('*')
      .eq('debtor_email', session.user.email)
      .neq('status', 'pagado');

    const activeDebts = debts || [];
    
    // Dividir deudas de forma lógica: Si tienen mensualidad definida, la mitad en Q1 y la mitad en Q2. Si no, se asignan de forma equilibrada o libre.
    setQ1Debts(activeDebts);
    setQ2Debts(activeDebts);
  }

  const q1CardTotal = q1Cards.reduce((acc, c) => acc + c.totalSpent, 0);
  const q2CardTotal = q2Cards.reduce((acc, c) => acc + c.totalSpent, 0);

  // Para evitar duplicar la deuda total en ambas quincenas de golpe en la vista visual, 
  // si hay plazo mensual dividimos la cuota, si es deuda libre sugerimos una porción o dejamos que el usuario decida.
  const q1DebtTotal = q1Debts.reduce((acc, d) => acc + (d.monthly_payment ? Number(d.monthly_payment) / 2 : Number(d.amount) * 0.05), 0);
  const q2DebtTotal = q2Debts.reduce((acc, d) => acc + (d.monthly_payment ? Number(d.monthly_payment) / 2 : Number(d.amount) * 0.05), 0);

  return (
    <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: '20px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '18px' }}>🤖 Asistente de Pagos por Quincena</h3>
      <p style={{ fontSize: '13px', color: '#664d03', marginBottom: '15px' }}>
        Basado estrictamente en los días límite configurados en tus tarjetas y tus compromisos reales:
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
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', padding: '4px 8px', borderRadius: '4px' }}>
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
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', padding: '4px 8px', borderRadius: '4px' }}>
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