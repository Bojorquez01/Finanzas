import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function SmartDebtOptimizer({ session }) {
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

    const { data: incData } = await supabase.from('incomes').select('amount');
    const extrasSum = (incData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const netIncome = salaryMonthly + extrasSum;
    setMinLiving(minExp);

    // 2. Gastos de tarjetas (mes actual + proyecciones futuras)
    const { data: expData } = await supabase.from('expenses').select('amount');
    const expSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    const { data: projData } = await supabase.from('card_statement_projections').select('amount');
    const projSum = (projData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    setTotalCardsSpent(expSum + projSum);

    // 3. Buscar ÚNICAMENTE las deudas donde TÚ eres el deudor (lo que tú debes)
    const userEmail = session.user.email;
    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .eq('debtor_email', userEmail)
      .in('status', ['pendiente', 'pago_solicitado']);

    setDebts(debtData || []);
  }

  // Cambiar prioridad de una deuda (1: Alta, 2: Media, 3: Baja)
  const handleChangePriority = async (debtId, currentPriority) => {
    const nextPriority = currentPriority >= 3 ? 1 : currentPriority + 1;

    const { error } = await supabase
      .from('debts')
      .update({ priority: nextPriority })
      .eq('id', debtId);

    if (!error) calculateOptimizer();
  };

  const totalIncome = debts.reduce(() => 0, 0); // (calculado por ingresos reales)
  // Recalcular ingresos para el flujo libre
  const [netInc, setNetInc] = useState(0);

  useEffect(() => {
    async function getInc() {
      const { data: salaryData } = await supabase.from('user_salary_config').select('*').eq('user_id', session.user.id).maybeSingle();
      const sal = salaryData ? (salaryData.frequency === 'quincenal' ? Number(salaryData.salary_amount) * 2 : Number(salaryData.salary_amount)) : 0;
      const { data: incData } = await supabase.from('incomes').select('amount');
      const ext = (incData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
      setNetInc(sal + ext);
    }
    getInc();
  }, [session]);

  const totalDebtAmount = debts.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const safeAvailableCash = netInc - minLiving - totalCardsSpent;

  // Ordenar deudas primero por prioridad (1: Alta, 2: Media, 3: Baja) y luego por monto
  const sortedDebts = [...debts].sort((a, b) => {
    const pA = a.priority || 2;
    const pB = b.priority || 2;
    if (pA !== pB) return pA - pB;
    return Number(a.amount) - Number(b.amount);
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
        Protege tu supervivencia básica y organiza tus prioridades para liquidar tus deudas reales en el orden que elijas.
      </p>

      {/* Indicadores */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COLCHÓN INTOCABLE (SUPERVIVENCIA)</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#c0392b', fontWeight: 'bold' }}>${fmt(minLiving)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COMPROMISOS TARJETAS</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#dc3545', fontWeight: 'bold' }}>-${fmt(totalCardsSpent)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>EXCEDENTE LIBRE PARA DEUDAS</p>
          <p style={{ margin: 0, fontSize: '18px', color: safeAvailableCash >= 0 ? '#27ae60' : '#c0392b', fontWeight: 'bold' }}>
            ${fmt(safeAvailableCash)}
          </p>
        </div>
      </div>

      {/* Plan de Liquidación con Prioridades */}
      <div style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #b8daff' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '15px' }}>💡 Plan de Liquidación Ordenado por Prioridad</h4>
        
        {sortedDebts.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#27ae60', fontWeight: 'bold' }}>
            🎉 ¡Felicidades! No tienes deudas personales activas que debas pagar.
          </p>
        ) : (
          <div>
            <p style={{ fontSize: '13px', color: '#333', marginBottom: '10px' }}>
              Haz clic en el botón de prioridad de cada deuda para cambiar su nivel (Alta, Media o Baja) y ajustar la estrategia de pago:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedDebts.map((debt, index) => {
                const badge = getPriorityBadge(debt.priority || 2);
                const suggestedPayment = Math.min(safeAvailableCash / sortedDebts.length, Number(debt.amount));

                return (
                  <div key={debt.id} style={{ background: '#f8f9fa', padding: '10px 12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', border: '1px solid #ddd', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button 
                        onClick={() => handleChangePriority(debt.id, debt.priority || 2)}
                        style={{ background: badge.bg, color: badge.color, border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        title="Haz clic para cambiar prioridad"
                      >
                        {badge.label} 🔄
                      </button>
                      <div>
                        <strong>Acreedor: {debt.creditor_email}</strong> ({debt.description || 'Deuda'})
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#c0392b', fontWeight: 'bold' }}>Restante: ${fmt(debt.amount)}</span>
                      <div style={{ color: '#27ae60', fontSize: '12px', fontWeight: 'bold' }}>
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