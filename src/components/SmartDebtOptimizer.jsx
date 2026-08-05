import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function SmartDebtOptimizer({ session }) {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [minLiving, setMinLiving] = useState(0);
  const [totalCardsSpent, setTotalCardsSpent] = useState(0);
  const [debts, setDebts] = useState([]);

  useEffect(() => {
    if (session) calculateOptimizer();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function calculateOptimizer() {
    // 1. Obtener sueldo y mínimo indispensable
    const { data: salaryData } = await supabase
      .from('user_salary_config')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    let salaryMonthly = 0;
    let minExp = 0;
    if (salaryData) {
      salaryMonthly = salaryData.frequency === 'quincenal' 
        ? Number(salaryData.salary_amount) * 2 
        : Number(salaryData.salary_amount);
      minExp = Number(salaryData.min_living_expense || 0);
    }

    // 2. Ingresos extras
    const { data: incData } = await supabase.from('incomes').select('amount');
    const extrasSum = (incData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    const netIncome = salaryMonthly + extrasSum;
    setTotalIncome(netIncome);
    setMinLiving(minExp);

    // 3. Gastos de tarjetas (mes actual + todas las proyecciones futuras registradas)
    const { data: expData } = await supabase.from('expenses').select('amount');
    const expSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    const { data: projData } = await supabase.from('card_statement_projections').select('amount');
    const projSum = (projData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    const totalCardCommitment = expSum + projSum;
    setTotalCardsSpent(totalCardCommitment);

    // 4. Buscar deudas activas abarcando tanto el correo como el ID de usuario para mayor compatibilidad
    const userEmail = session.user.email;
    const userId = session.user.id;

    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .or(`debtor_email.eq.${userEmail},debtor_id.eq.${userId}`)
      .neq('status', 'pagado');

    setDebts(debtData || []);
    setDataLoaded(true);
  }

  const totalDebtAmount = debts.reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  // Flujo libre seguro: Ingresos menos (Mínimo Indispensable + Compromisos de Tarjetas)
  const safeAvailableCash = totalIncome - minLiving - totalCardsSpent;

  // Ordenar deudas de menor a mayor para sugerir método bola de nieve
  const sortedDebts = [...debts].sort((a, b) => Number(a.amount) - Number(b.amount));

  return (
    <div style={{ background: '#e8f4fd', border: '1px solid #b8daff', padding: '20px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '18px' }}>🛡️ Optimizador y Red de Seguridad Financiera</h3>
      <p style={{ fontSize: '13px', color: '#0056b3', marginBottom: '15px' }}>
        Este asistente protege tu supervivencia básica antes de planificar cómo liquidar tus deudas en tiempo récord.
      </p>

      {/* Indicadores Clave de Liquidez */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        
        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COLCHÓN INTOCABLE (SUPERVIVENCIA)</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#c0392b', fontWeight: 'bold' }}>${fmt(minLiving)}</p>
          <small style={{ fontSize: '10px', color: '#888' }}>Comida, salud y transporte blindados</small>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COMPROMISOS TARJETAS</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#dc3545', fontWeight: 'bold' }}>-${fmt(totalCardsSpent)}</p>
          <small style={{ fontSize: '10px', color: '#888' }}>Mes actual y proyecciones futuras</small>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>EXCEDENTE LIBRE PARA DEUDAS</p>
          <p style={{ margin: 0, fontSize: '18px', color: safeAvailableCash >= 0 ? '#27ae60' : '#c0392b', fontWeight: 'bold' }}>
            ${fmt(safeAvailableCash)}
          </p>
          <small style={{ fontSize: '10px', color: '#888' }}>Dinero real disponible para saldar adeudos</small>
        </div>

      </div>

      {/* Estrategia Propuesta */}
      <div style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #b8daff' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '15px' }}>💡 Plan de Liquidación Acelerada Sugerido</h4>
        
        {safeAvailableCash <= 0 ? (
          <p style={{ fontSize: '13px', color: '#c0392b', fontWeight: 'bold' }}>
            ⚠️ ¡Atención! Tus gastos básicos y de tarjetas consumen todos tus ingresos. Te sugerimos revisar tus consumos o generar ingresos extras antes de adquirir nuevas deudas.
          </p>
        ) : sortedDebts.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#27ae60', fontWeight: 'bold' }}>
            🎉 ¡Felicidades! No tienes deudas personales activas registradas. Tu excedente libre se puede destinar íntegramente a tus ahorros e inversiones.
          </p>
        ) : (
          <div>
            <p style={{ fontSize: '13px', color: '#333', marginBottom: '10px' }}>
              Tienes un total de <strong>${fmt(totalDebtAmount)}</strong> en deudas pendientes. Con tu excedente libre de <strong>${fmt(safeAvailableCash)}</strong>, te sugerimos la siguiente estrategia de pago por orden de prioridad:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedDebts.map((debt, index) => {
                const suggestedPayment = Math.min(safeAvailableCash / sortedDebts.length, Number(debt.amount));

                return (
                  <div key={debt.id} style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', border: '1px solid #ddd', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ background: '#004085', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginRight: '8px' }}>
                        Prioridad #{index + 1}
                      </span>
                      <strong>Acreedor: {debt.creditor_email || 'No especificado'}</strong> ({debt.description || 'Préstamo'})
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#c0392b', fontWeight: 'bold' }}>Restante: ${fmt(debt.amount)}</span>
                      <div style={{ color: '#27ae60', fontSize: '12px', fontWeight: 'bold' }}>
                        💡 Sugerencia de abono este mes: ${fmt(suggestedPayment)}
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