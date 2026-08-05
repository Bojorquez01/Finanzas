import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function SmartDebtOptimizer({ session }) {
  const [minLiving, setMinLiving] = useState(0);
  const [schedule, setSchedule] = useState([]);
  const [summaryData, setSummaryData] = useState({ totalDebt: 0, totalCards: 0, netInc: 0, safeCashQ: 0 });

  useEffect(() => {
    if (session) runOptimizerSimulation();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function runOptimizerSimulation() {
    const userEmail = session.user.email;
    const userId = session.user.id;

    // 1. Sueldo y mínimo indispensable mensual
    const { data: salaryData } = await supabase
      .from('user_salary_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let salaryMonthly = 0;
    let minExpMonthly = 0;
    if (salaryData) {
      salaryMonthly = salaryData.frequency === 'quincenal' 
        ? Number(salaryData.salary_amount) * 2 
        : Number(salaryData.salary_amount);
      minExpMonthly = Number(salaryData.min_living_expense || 0);
    }

    const { data: incData } = await supabase.from('incomes').select('amount');
    const extrasSum = (incData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalMonthlyIncome = salaryMonthly + extrasSum;

    // 2. Compromisos de tarjetas (Gastos + Proyecciones)
    const { data: expData } = await supabase.from('expenses').select('amount');
    const expSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    const { data: projData } = await supabase
      .from('card_statement_projections')
      .select('*, credit_cards(card_name, payment_due_day)')
      .order('target_month', { ascending: true });

    const projSum = (projData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalCardCommitments = expSum + projSum;

    // 3. Deudas personales
    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .or(`debtor_email.eq.${userEmail},debtor_id.eq.${userId}`)
      .in('status', ['pendiente', 'pago_solicitado', 'por_aceptar']);

    const validDebts = (debtData || []).filter(d => 
      d.debtor_email === userEmail || 
      (d.debtor_id === userId && d.creditor_email !== userEmail)
    );

    // Consolidar deudas y tarjetas en una lista con prioridad
    let itemsToPay = [];

    validDebts.forEach(d => {
      itemsToPay.push({
        id: `debt_${d.id}`,
        name: `Deuda: ${d.creditor_email}`,
        description: d.description || 'Préstamo personal',
        balance: Number(d.amount),
        priority: d.priority || 2,
      });
    });

    // Agrupar proyecciones de tarjetas
    const cardMap = {};
    (projData || []).forEach(p => {
      const cardName = p.credit_cards ? p.credit_cards.card_name : 'Tarjeta';
      if (!cardMap[cardName]) {
        cardMap[cardName] = {
          id: `card_${cardName}`,
          name: `Tarjeta: ${cardName}`,
          description: 'Acumulado de mensualidades / MSI',
          balance: 0,
          priority: 2,
        };
      }
      cardMap[cardName].balance += Number(p.amount);
    });

    Object.values(cardMap).forEach(c => itemsToPay.push(c));

    // Cálculos por quincena
    const quincenalIncome = totalMonthlyIncome / 2;
    const quincenalMinLiving = minExpMonthly / 2;
    // Excedente libre real por quincena (descontando supervivencia y reparto de tarjetas)
    const quincenalFreeCash = quincenalIncome - quincenalMinLiving - (totalCardCommitments / 4);

    setSummaryData({
      totalDebt: validDebts.reduce((acc, curr) => acc + Number(curr.amount), 0),
      totalCards: totalCardCommitments,
      netInc: totalMonthlyIncome,
      safeCashQ: quincenalFreeCash > 0 ? quincenalFreeCash : 0
    });

    // 4. Motor de Simulación Quincenal (Simula hasta 12 quincenas o hasta saldar todo)
    let simulatedItems = itemsToPay.map(i => ({ ...i }));
    let timeline = [];
    let qIndex = 1;

    while (simulatedItems.some(i => i.balance > 1) && qIndex <= 10) {
      let availableCashForDebts = quincenalFreeCash > 0 ? quincenalFreeCash : 0;
      
      // Ordenar por prioridad (1: Alta, 2: Media, 3: Baja) y luego por menor monto (bola de nieve)
      simulatedItems.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.balance - b.balance;
      });

      let quincenaPayments = [];

      for (let item of simulatedItems) {
        if (item.balance <= 0) continue;

        if (availableCashForDebts <= 0) {
          // Ya no queda dinero libre en esta quincena para más abonos
          quincenaPayments.push({
            name: item.name,
            description: item.description,
            paid: 0,
            remaining: item.balance
          });
          continue;
        }

        // Cuánto podemos abonar a este ítem en esta quincena
        let payment = Math.min(availableCashForDebts, item.balance);
        item.balance -= payment;
        availableCashForDebts -= payment;

        quincenaPayments.push({
          name: item.name,
          description: item.description,
          paid: payment,
          remaining: item.balance
        });
      }

      timeline.push({
        quincenaNum: qIndex,
        label: `Quincena ${qIndex} (Mes ${Math.ceil(qIndex / 2)})`,
        payments: quincenaPayments,
        leftoverCash: availableCashForDebts
      });

      qIndex++;
    }

    setSchedule(timeline);
  }

  return (
    <div style={{ background: '#e8f4fd', border: '1px solid #b8daff', padding: '20px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '18px' }}>🛡️ Optimizador y Red de Seguridad Financiera</h3>
      <p style={{ fontSize: '13px', color: '#0056b3', marginBottom: '15px' }}>
        Planificador inteligente que calcula tus pagos quincena tras quincena respetando tu colchón de supervivencia y tus prioridades.
      </p>

      {/* Indicadores */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COLCHÓN QUINCENAL (SUPERVIVENCIA)</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#c0392b', fontWeight: 'bold' }}>${fmt(minLiving / 2)}</p>
          <small style={{ fontSize: '10px', color: '#888' }}>Mitad del mínimo mensual intocable</small>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COMPROMISOS TOTALES TARJETAS</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#dc3545', fontWeight: 'bold' }}>-${fmt(summaryData.totalCards)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>EXCEDENTE LIBRE QUINCENAL</p>
          <p style={{ margin: 0, fontSize: '18px', color: summaryData.safeCashQ >= 0 ? '#27ae60' : '#c0392b', fontWeight: 'bold' }}>
            ${fmt(summaryData.safeCashQ)}
          </p>
          <small style={{ fontSize: '10px', color: '#888' }}>Disponible por quincena para abonos</small>
        </div>
      </div>

      {/* Tabla de Proyección de Pagos Quincenales */}
      <div style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #b8daff' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '15px' }}>📅 Tabla de Proyección y Pagos por Quincena</h4>
        
        {schedule.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#27ae60', fontWeight: 'bold' }}>
            🎉 ¡Felicidades! No tienes deudas ni compromisos pendientes por cubrir.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
              A continuación se muestra la recomendación paso a paso de cómo se irán liquidando tus deudas y tarjetas quincena tras quincena con tu excedente libre:
            </p>

            {schedule.map((q) => (
              <div key={q.quincenaNum} style={{ background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '6px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '8px' }}>
                  <strong style={{ color: '#004085', fontSize: '14px' }}>{q.label}</strong>
                  <span style={{ fontSize: '12px', color: '#666' }}>Efectivo libre restante tras abonos: <strong>${fmt(q.leftoverCash)}</strong></span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#e9ecef', color: '#333' }}>
                        <th style={{ padding: '6px', borderBottom: '1px solid #ccc' }}>Concepto</th>
                        <th style={{ padding: '6px', borderBottom: '1px solid #ccc' }}>Descripción</th>
                        <th style={{ padding: '6px', borderBottom: '1px solid #ccc', textAlign: 'right' }}>Pago Sugerido</th>
                        <th style={{ padding: '6px', borderBottom: '1px solid #ccc', textAlign: 'right' }}>Saldo Restante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.payments.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px', fontWeight: 'bold', color: '#2c3e50' }}>{p.name}</td>
                          <td style={{ padding: '6px', color: '#555' }}>{p.description}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: p.paid > 0 ? '#27ae60' : '#888', fontWeight: 'bold' }}>
                            ${fmt(p.paid)}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#c0392b', fontWeight: 'bold' }}>
                            ${fmt(p.remaining)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SmartDebtOptimizer;