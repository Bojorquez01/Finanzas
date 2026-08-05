import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function SmartDebtOptimizer({ session }) {
  const [minLiving, setMinLiving] = useState(0);
  const [totalCardsSpent, setTotalCardsSpent] = useState(0);
  const [groupedItems, setGroupedItems] = useState([]);
  const [netInc, setNetInc] = useState(0);

  useEffect(() => {
    if (session) calculateOptimizer();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function calculateOptimizer() {
    const userEmail = session.user.email;
    const userId = session.user.id;

    // 1. Sueldo y mínimo indispensable
    const { data: salaryData } = await supabase
      .from('user_salary_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let salaryMonthly = 0;
    let minExp = 0;
    if (salaryData) {
      salaryMonthly = salaryData.frequency === 'quincenal' 
        ? Number(salaryData.salary_amount) * 2 
        : Number(salaryData.salary_amount);
      minExp = Number(salaryData.min_living_expense || 0);
    }

    const { data: incData } = await supabase.from('incomes').select('amount');
    const extrasSum = (incData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    setNetInc(salaryMonthly + extrasSum);
    setMinLiving(minExp);

    // 2. Gastos de tarjetas (mes actual)
    const { data: expData } = await supabase.from('expenses').select('amount');
    const expSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    // 3. Proyecciones futuras de tarjetas
    const { data: projData } = await supabase
      .from('card_statement_projections')
      .select('*, credit_cards(card_name)')
      .order('target_month', { ascending: true });

    const projSum = (projData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    setTotalCardsSpent(expSum + projSum);

    // 4. Deudas personales
    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .or(`debtor_email.eq.${userEmail},debtor_id.eq.${userId}`)
      .in('status', ['pendiente', 'pago_solicitado', 'por_aceptar']);

    const validDebts = (debtData || []).filter(d => 
      d.debtor_email === userEmail || 
      (d.debtor_id === userId && d.creditor_email !== userEmail)
    );

    // 5. Mapear deudas personales
    const formattedPersonalDebts = validDebts.map(d => ({
      id: `debt_${d.id}`,
      realId: d.id,
      type: 'personal_debt',
      name: `Deuda con: ${d.creditor_email}`,
      subtitle: d.description || 'Préstamo personal',
      amount: Number(d.amount),
      priority: d.priority || 2,
    }));

    // 6. Agrupar proyecciones de tarjetas por tarjeta (para no mostrar mes por mes)
    const cardMap = {};
    (projData || []).forEach(p => {
      const cardName = p.credit_cards ? p.credit_cards.card_name : 'Tarjeta';
      if (!cardMap[cardName]) {
        cardMap[cardName] = {
          id: `card_group_${cardName}`,
          realId: p.id,
          type: 'card_group',
          name: `Tarjeta: ${cardName}`,
          subtitle: 'Acumulado de mensualidades / MSI futuras',
          amount: 0,
          priority: p.priority || 2,
        };
      }
      cardMap[cardName].amount += Number(p.amount);
    });

    const formattedCardGroups = Object.values(cardMap);

    setGroupedItems([...formattedPersonalDebts, ...formattedCardGroups]);
  }

  const handleChangePriority = async (item) => {
    const nextPriority = item.priority >= 3 ? 1 : item.priority + 1;

    if (item.type === 'personal_debt') {
      await supabase.from('debts').update({ priority: nextPriority }).eq('id', item.realId);
    } else {
      // Si es grupo de tarjeta, actualizamos las proyecciones asociadas
      await supabase.from('card_statement_projections').update({ priority: nextPriority }).eq('card_id', item.realId);
    }

    calculateOptimizer();
  };

  const safeAvailableCash = netInc - minLiving - totalCardsSpent;

  // Ordenar por prioridad y monto
  const sortedItems = [...groupedItems].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.amount - a.amount;
  });

  const getPriorityBadge = (p) => {
    if (p === 1) return { label: '🔴 Alta', bg: '#f8d7da', color: '#721c24' };
    if (p === 2) return { label: '🟡 Media', bg: '#fff3cd', color: '#856404' };
    return { label: '🟢 Baja', bg: '#d4edda', color: '#155724' };
  };

  return (
    <div style={{ background: '#e8f4fd', border: '1px solid #b8daff', padding: '20px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '18px' }}>🛡️ Optimizador y Red de Seguridad Financiera</h3>
      <p style={{ fontSize: '13px', color: '#0056b3', marginBottom: '15px' }}>
        Vista limpia y consolidada de tus compromisos de tarjetas y deudas personales organizados por prioridad.
      </p>

      {/* Indicadores */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COLCHÓN INTOCABLE (SUPERVIVENCIA)</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#c0392b', fontWeight: 'bold' }}>${fmt(minLiving)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COMPROMISOS TOTALES</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#dc3545', fontWeight: 'bold' }}>-${fmt(totalCardsSpent)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>EXCEDENTE LIBRE</p>
          <p style={{ margin: 0, fontSize: '18px', color: safeAvailableCash >= 0 ? '#27ae60' : '#c0392b', fontWeight: 'bold' }}>
            ${fmt(safeAvailableCash)}
          </p>
        </div>
      </div>

      {/* Plan Consolidado por Mes y Quincena */}
      <div style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #b8daff' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '15px' }}>💡 Plan de Liquidación Consolidado</h4>
        
        {sortedItems.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#27ae60', fontWeight: 'bold' }}>
            🎉 ¡Felicidades! No tienes compromisos ni deudas pendientes registradas.
          </p>
        ) : (
          <div>
            <p style={{ fontSize: '13px', color: '#333', marginBottom: '10px' }}>
              Resumen general de pagos agrupados por tarjeta y deuda. El excedente libre se distribuye de manera sugerida:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedItems.map((item) => {
                const badge = getPriorityBadge(item.priority);
                const suggestedPayment = Math.min(safeAvailableCash / sortedItems.length, item.amount);

                return (
                  <div key={item.id} style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', border: '1px solid #ddd', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={() => handleChangePriority(item)}
                        style={{ background: badge.bg, color: badge.color, border: '1px solid #ccc', padding: '5px 9px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        title="Haz clic para cambiar prioridad"
                      >
                        {badge.label} 🔄
                      </button>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#2c3e50' }}>{item.name}</strong>
                        <div style={{ color: '#555', fontSize: '12px' }}>{item.subtitle}</div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#c0392b', fontWeight: 'bold', fontSize: '14px' }}>Total: ${fmt(item.amount)}</span>
                      <div style={{ color: '#27ae60', fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>
                        💡 Sugerencia de abono: ${fmt(safeAvailableCash > 0 ? suggestedPayment : 0)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SmartDebtOptimizer;