import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

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
    const currentMonth = new Date().toISOString().slice(0, 7); // '2026-08'

    // 1. Sueldo y mínimo indispensable
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

    // Ingresos extras filtrados estrictamente por el mes actual
    const { data: incData } = await supabase
      .from('incomes')
      .select('amount, target_month');

    const extrasSum = (incData || [])
      .filter(inc => !inc.target_month || inc.target_month === currentMonth)
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const totalMonthlyIncome = salaryMonthly + extrasSum;

    // 2. Compromisos de tarjetas
    const { data: expData } = await supabase.from('expenses').select('amount');
    const expSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

    const { data: projData } = await supabase
      .from('card_statement_projections')
      .select('*, credit_cards(card_name)')
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

    const quincenalIncome = totalMonthlyIncome / 2;
    const quincenalMinLiving = minExpMonthly / 2;
    const quincenalFreeCash = quincenalIncome - quincenalMinLiving - (totalCardCommitments / 4);

    setMinLiving(minExpMonthly);
    setSummaryData({
      totalDebt: validDebts.reduce((acc, curr) => acc + Number(curr.amount), 0),
      totalCards: totalCardCommitments,
      netInc: totalMonthlyIncome,
      safeCashQ: quincenalFreeCash > 0 ? quincenalFreeCash : 0
    });

    // 4. Simulación Quincenal
    let simulatedItems = itemsToPay.map(i => ({ ...i }));
    let timeline = [];
    let qIndex = 1;

    while (simulatedItems.some(i => i.balance > 1) && qIndex <= 12) {
      let availableCashForDebts = quincenalFreeCash > 0 ? quincenalFreeCash : 0;
      
      simulatedItems.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.balance - b.balance;
      });

      let quincenaPayments = [];

      for (let item of simulatedItems) {
        if (item.balance <= 0) continue;

        if (availableCashForDebts <= 0) {
          quincenaPayments.push({
            name: item.name,
            description: item.description,
            paid: 0,
            remaining: item.balance
          });
          continue;
        }

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

  // Exportar a Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      ["Concepto", "Monto Mensual", "Monto Quincenal"],
      ["Ingresos Totales (Sueldo + Extras)", summaryData.netInc, summaryData.netInc / 2],
      ["Colchón Intocable (Supervivencia)", minLiving, minLiving / 2],
      ["Compromisos Totales de Tarjetas", summaryData.totalCards, summaryData.totalCards / 2],
      ["Excedente Libre para Deudas", summaryData.netInc - minLiving - summaryData.totalCards, summaryData.safeCashQ]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Financiero");

    const projRows = [
      ["Quincena", "Concepto", "Descripción", "Pago Sugerido", "Saldo Restante", "Efectivo Libre Restante"]
    ];

    schedule.forEach(q => {
      q.payments.forEach(p => {
        projRows.push([
          q.label,
          p.name,
          p.description,
          p.paid,
          p.remaining,
          q.leftoverCash
        ]);
      });
    });

    const wsProj = XLSX.utils.aoa_to_sheet(projRows);
    XLSX.utils.book_append_sheet(wb, wsProj, "Proyección Quincenal");

    XLSX.writeFile(wb, "plan_liquidador_deudas.xlsx");
  };

  return (
    <div style={{ background: '#e8f4fd', border: '1px solid #b8daff', padding: '20px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', color: '#004085', fontSize: '18px' }}>🛡️ Optimizador y Red de Seguridad Financiera</h3>
          <p style={{ fontSize: '13px', color: '#0056b3', margin: 0 }}>
            Protege tu supervivencia básica y exporta tu plan de liquidación detallado a Excel.
          </p>
        </div>
        <button 
          onClick={exportToExcel}
          style={{ background: '#27ae60', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          📥 Descargar Plan en Excel (.xlsx)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COLCHÓN QUINCENAL</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#c0392b', fontWeight: 'bold' }}>${fmt(minLiving / 2)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>COMPROMISOS TARJETAS</p>
          <p style={{ margin: 0, fontSize: '18px', color: '#dc3545', fontWeight: 'bold' }}>-${fmt(summaryData.totalCards)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cce5ff' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>EXCEDENTE LIBRE QUINCENAL</p>
          <p style={{ margin: 0, fontSize: '18px', color: summaryData.safeCashQ >= 0 ? '#27ae60' : '#c0392b', fontWeight: 'bold' }}>
            ${fmt(summaryData.safeCashQ)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default SmartDebtOptimizer;