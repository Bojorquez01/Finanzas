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

  async function calculatePlan() {
    // 1. Obtener tarjetas y sus gastos totales
    const { data: cards } = await supabase.from('credit_cards').select('*');
    const { data: expenses } = await supabase.from('expenses').select('*');

    const cardDetails = (cards || []).map(card => {
      const spent = (expenses || [])
        .filter(e => e.card_id === card.id)
        .reduce((sum, curr) => sum + Number(curr.amount), 0);
      return { ...card, totalSpent: spent };
    });

    // Separar tarjetas por quincena según su día límite de pago (1-15 vs 16-31)
    const q1C = cardDetails.filter(c => c.payment_due_day && c.payment_due_day >= 1 && c.payment_due_day <= 15);
    const q2C = cardDetails.filter(c => c.payment_due_day && c.payment_due_day > 15 && c.payment_due_day <= 31);

    setQ1Cards(q1C);
    setQ2Cards(q2C);

    // 2. Obtener deudas activas que debo
    const { data: debts } = await supabase
      .from('debts')
      .select('*')
      .eq('debtor_id', session.user.id)
      .neq('status', 'pagado');

    // Dividir cuotas de deudas entre Q1 y Q2 si tienen pago mensual, o sugerir la mitad en cada una
    const activeDebts = debts || [];
    setQ1Debts(activeDebts);
    setQ2Debts(activeDebts);
  }

  const q1CardTotal = q1Cards.reduce((acc, c) => acc + c.totalSpent, 0);
  const q2CardTotal = q2Cards.reduce((acc, c) => acc + c.totalSpent, 0);

  const q1DebtTotal = q1Debts.reduce((acc, d) => acc + (d.monthly_payment ? Number(d.monthly_payment) / 2 : Number(d.amount) * 0.1), 0);
  const q2DebtTotal = q2Debts.reduce((acc, d) => acc + (d.monthly_payment ? Number(d.monthly_payment) / 2 : Number(d.amount) * 0.1), 0);

  return (
    <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: '20px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '18px' }}>🤖 Asistente de Pagos por Quincena</h3>
      <p style={{ fontSize: '13px', color: '#664d03', marginBottom: '15px' }}>
        Basado en los días límite configurados en tus tarjetas y tus deudas pendientes, aquí tienes la recomendación de pago para cada quincena:
      </p>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Quincena 1 */}
        <div style={{ flex: 1, minWidth: '280px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ffe8a1' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#b7791f', fontSize: '15px' }}>📅 Quincena 1 (Días 1 al 15)</h4>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>
            Total sugerido a pagar: <span style={{ color: '#d97706' }}>${(q1CardTotal + q1DebtTotal).toFixed(2)}</span>
          </p>

          <div style={{ fontSize: '12px', color: '#555', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <strong>Tarjetas a pagar en esta quincena:</strong>
            {q1Cards.length === 0 ? <span style={{ color: '#888' }}>Ninguna tarjeta vence en esta quincena.</span> : (
              q1Cards.map(c => <div key={c.id}>• {c.card_name} (Vence día {c.payment_due_day}): <strong>${c.totalSpent.toFixed(2)}</strong></div>)
            )}
          </div>
        </div>

        {/* Quincena 2 */}
        <div style={{ flex: 1, minWidth: '280px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ffe8a1' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#b7791f', fontSize: '15px' }}>📅 Quincena 2 (Días 16 al 31)</h4>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>
            Total sugerido a pagar: <span style={{ color: '#d97706' }}>${(q2CardTotal + q2DebtTotal).toFixed(2)}</span>
          </p>

          <div style={{ fontSize: '12px', color: '#555', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <strong>Tarjetas a pagar en esta quincena:</strong>
            {q2Cards.length === 0 ? <span style={{ color: '#888' }}>Ninguna tarjeta vence en esta quincena.</span> : (
              q2Cards.map(c => <div key={c.id}>• {c.card_name} (Vence día {c.payment_due_day}): <strong>${c.totalSpent.toFixed(2)}</strong></div>)
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default PaymentPlanner;