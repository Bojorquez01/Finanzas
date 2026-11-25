import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DebtManager({ session }) {
  const [debts, setDebts] = useState([]);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [relationType, setRelationType] = useState('yo_debo');
  const [otherEmail, setOtherEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const [payAmounts, setPayAmounts] = useState({});
  const [creditorPayAmounts, setCreditorPayAmounts] = useState({});
  const [correctionAmounts, setCorrectionAmounts] = useState({});

  // Estados para los Filtros de Historial
  const [filterMonth, setFilterMonth] = useState('todos');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    if (session) fetchDebts();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function fetchDebts() {
    const userEmail = session.user.email;
    const userId = session.user.id;

    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .or(`debtor_email.eq.${userEmail},creditor_email.eq.${userEmail},debtor_id.eq.${userId}`);

    if (!error && data) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      let updatedData = [...data];

      for (let debt of updatedData) {
        if (debt.is_recurring && debt.last_reset_month !== currentMonth && debt.status === 'pagado') {
          const resetAmount = debt.monthly_payment ? debt.monthly_payment * (debt.total_months || 1) : debt.amount;

          await supabase
            .from('debts')
            .update({
              status: 'pendiente',
              amount: resetAmount > 0 ? resetAmount : debt.amount,
              last_reset_month: currentMonth
            })
            .eq('id', debt.id);

          debt.status = 'pendiente';
          debt.amount = resetAmount > 0 ? resetAmount : debt.amount;
          debt.last_reset_month = currentMonth;
        }
      }

      setDebts(updatedData);

      const debtIds = updatedData.map(d => d.id);
      if (debtIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('debt_payments')
          .select('*')
          .in('debt_id', debtIds)
          .order('created_at', { ascending: false });

        if (!logsError && logsData) {
          setPaymentLogs(logsData);
        }
      } else {
        setPaymentLogs([]);
      }
    }
  }

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    if (!otherEmail || !amount) return;

    const totalAmt = parseFloat(amount);
    const months = totalMonths ? parseInt(totalMonths) : null;
    const monthlyPay = months ? totalAmt / months : totalAmt;
    const currentMonth = new Date().toISOString().slice(0, 7);

    const debtorEmail = relationType === 'yo_debo' ? session.user.email : otherEmail.trim();
    const creditorEmail = relationType === 'yo_debo' ? otherEmail.trim() : session.user.email;
    const initialStatus = relationType === 'yo_debo' ? 'pendiente' : 'por_aceptar';

    const { error } = await supabase
      .from('debts')
      .insert([{
        debtor_email: debtorEmail,
        creditor_email: creditorEmail,
        debtor_id: relationType === 'yo_debo' ? session.user.id : null,
        amount: totalAmt,
        total_months: months,
        monthly_payment: monthlyPay,
        description: description,
        is_recurring: isRecurring,
        status: initialStatus,
        priority: 2,
        last_reset_month: currentMonth
      }]);

    if (!error) {
      setOtherEmail('');
      setAmount('');
      setTotalMonths('');
      setDescription('');
      setIsRecurring(false);
      fetchDebts();
    }
  };

  const handleStopRecurring = async (debtId) => {
    const confirmStop = window.confirm('¿Dar de baja este pago recurrente? Ya no se renovará el próximo mes.');
    if (!confirmStop) return;

    const { error } = await supabase
      .from('debts')
      .update({ is_recurring: false })
      .eq('id', debtId);

    if (!error) {
      fetchDebts();
    } else {
      alert('Error al dar de baja el recurrente: ' + error.message);
    }
  };

  const handleDeleteDebt = async (debtId, label = 'este registro') => {
    const confirmDelete = window.confirm(`¿Eliminar ${label}? Esta acción borrará el registro.`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', debtId);

    if (!error) {
      fetchDebts();
    } else {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const handleAcceptNewDebt = async (debtId) => {
    const { error } = await supabase.from('debts').update({ status: 'pendiente' }).eq('id', debtId);
    if (!error) fetchDebts();
  };

  const handleRejectNewDebt = async (debtId) => {
    if (!window.confirm('¿Estás seguro de rechazar y eliminar esta deuda?')) return;
    const { error } = await supabase.from('debts').delete().eq('id', debtId);
    if (!error) fetchDebts();
  };

  const handleRequestPayment = async (debtId, currentAmount) => {
    const payVal = parseFloat(payAmounts[debtId]);
    if (!payVal || payVal <= 0 || payVal > currentAmount) {
      alert('Ingresa un monto válido para abonar.');
      return;
    }

    const { error } = await supabase.from('debts').update({ status: 'pago_solicitado', pending_amount: payVal }).eq('id', debtId);
    if (!error) fetchDebts();
  };

  const handleDirectCreditorPayment = async (debtId, currentAmount) => {
    const payVal = parseFloat(creditorPayAmounts[debtId]);
    if (!payVal || payVal <= 0 || payVal > currentAmount) {
      alert('Ingresa un monto válido de abono.');
      return;
    }

    const remaining = currentAmount - payVal;
    const newStatus = remaining <= 0 ? 'pagado' : 'pendiente';

    const { error } = await supabase
      .from('debts')
      .update({
        amount: remaining > 0 ? remaining : 0,
        status: newStatus,
        pending_amount: 0
      })
      .eq('id', debtId);

    if (!error) {
      await supabase.from('debt_payments').insert([{
        debt_id: debtId,
        amount: payVal,
        paid_by: session.user.email
      }]);

      const copy = { ...creditorPayAmounts };
      delete copy[debtId];
      setCreditorPayAmounts(copy);
      fetchDebts();
    } else {
      alert('Error al registrar el abono: ' + error.message);
    }
  };

  const handleConfirmOrCorrectPayment = async (debtId, currentAmount, originalPendingAmt, confirm) => {
    let newStatus = 'pendiente';
    let newAmount = currentAmount;
    let appliedAmount = 0;

    if (confirm) {
      const finalPaidAmount = correctionAmounts[debtId] !== undefined ? parseFloat(correctionAmounts[debtId]) : originalPendingAmt;
      if (isNaN(finalPaidAmount) || finalPaidAmount <= 0) {
        alert('Ingresa un monto válido a aplicar.');
        return;
      }
      appliedAmount = Math.min(currentAmount, finalPaidAmount);
      newAmount = currentAmount - finalPaidAmount;
      newStatus = newAmount <= 0 ? 'pagado' : 'pendiente';
    }

    const { error } = await supabase.from('debts').update({
      amount: newAmount > 0 ? newAmount : 0,
      status: newStatus,
      pending_amount: 0
    }).eq('id', debtId);

    if (!error) {
      if (confirm && appliedAmount > 0) {
        await supabase.from('debt_payments').insert([{
          debt_id: debtId,
          amount: appliedAmount,
          paid_by: session.user.email
        }]);
      }

      const copy = { ...correctionAmounts };
      delete copy[debtId];
      setCorrectionAmounts(copy);
      fetchDebts();
    }
  };

  const userEmail = session.user.email;
  const userId = session.user.id;

  const activeRecurringItems = debts.filter(d =>
    Boolean(d.is_recurring) && d.status !== 'pagado'
  );

  const myDebtsAsDebtor = debts.filter(d =>
    !d.is_recurring &&
    (d.debtor_email === userEmail || (d.debtor_id === userId && d.creditor_email !== userEmail)) &&
    d.status !== 'pagado'
  );

  const myDebtsAsCreditor = debts.filter(d =>
    !d.is_recurring &&
    d.creditor_email === userEmail &&
    d.debtor_email &&
    d.debtor_email !== userEmail &&
    d.status !== 'pagado'
  );

  const debtsById = Object.fromEntries(debts.map(d => [d.id, d]));

  // Movimientos del historial: cada abono parcial + deudas liquidadas al 100%
  const abonoHistoryEntries = paymentLogs.map(log => {
    const parentDebt = debtsById[log.debt_id] || {};
    const dateStr = log.created_at ? log.created_at.slice(0, 10) : (parentDebt.last_reset_month || '');
    return {
      id: `pay-${log.id}`,
      kind: 'abono',
      amount: log.amount,
      description: parentDebt.description || 'Abono registrado',
      debtor_email: parentDebt.debtor_email || '',
      creditor_email: parentDebt.creditor_email || '',
      is_recurring: Boolean(parentDebt.is_recurring),
      dateStr
    };
  });

  const liquidatedHistoryEntries = debts
    .filter(d => d.status === 'pagado')
    .map(d => ({
      id: `liq-${d.id}`,
      kind: 'liquidado',
      amount: d.monthly_payment || d.amount,
      description: d.description || 'Sin descripción',
      debtor_email: d.debtor_email || '',
      creditor_email: d.creditor_email || '',
      is_recurring: Boolean(d.is_recurring),
      dateStr: d.last_reset_month || (d.created_at ? d.created_at.slice(0, 7) : '')
    }));

  const combinedHistory = [...abonoHistoryEntries, ...liquidatedHistoryEntries];

  const filteredHistory = combinedHistory.filter(item => {
    if (!item.dateStr) return true;
    const [itemYear, itemMonth] = item.dateStr.split('-');

    const matchesYear = filterYear === 'todos' || itemYear === filterYear;
    const matchesMonth = filterMonth === 'todos' || itemMonth === filterMonth;

    return matchesYear && matchesMonth;
  });

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '10px' }}>

      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>Control de Deudas y Préstamos Compartidos</h3>

      <form onSubmit={handleCreateDebt} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #ddd' }}>
        <h4 style={{ margin: 0, fontSize: '15px', color: '#333' }}>Registrar Nueva Deuda o Préstamo</h4>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Tipo de registro:</label>
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value)}
            style={{ padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="yo_debo">Yo le debo a alguien (Deuda)</option>
            <option value="me_deben">Yo le presté a alguien / Me deben (Por cobrar)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder={relationType === 'yo_debo' ? "Correo del Acreedor" : "Correo del Deudor"}
            value={otherEmail}
            onChange={(e) => setOtherEmail(e.target.value)}
            required
            style={{ flex: 2, padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Monto Total ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="number"
            min="1"
            placeholder="Meses (Opcional)"
            value={totalMonths}
            onChange={(e) => setTotalMonths(e.target.value)}
            style={{ width: '130px', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <input
          type="text"
          placeholder="Descripción (ej. Spotify Familiar, Préstamo)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            🔄 Es un gasto / préstamo recurrente mensual
          </label>
          <button type="submit" style={{ padding: '8px 14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>+ Registrar</button>
        </div>
      </form>

      {/* SECCIÓN DEDICADA: PAGOS Y COBROS RECURRENTES */}
      <div style={{ marginBottom: '30px', background: '#fff8eb', padding: '15px', borderRadius: '8px', border: '1px solid #ffe69c' }}>
        <h4 style={{ color: '#856404', margin: '0 0 12px 0' }}>🔄 Pagos y Cobros Recurrentes (Suscripciones / Planes Compartidos)</h4>
        {activeRecurringItems.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>No tienes pagos o cobros recurrentes activos.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeRecurringItems.map(item => {
              const iAmDebtor = item.debtor_email === userEmail || (item.debtor_id === userId && item.creditor_email !== userEmail);
              const isPendingApproval = item.status === 'por_aceptar';

              return (
                <div key={item.id} style={{ padding: '12px', background: item.status === 'pago_solicitado' ? '#fff3cd' : '#fff', border: '1px solid #e6d39a', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>
                      {iAmDebtor ? `Debo a: ${item.creditor_email}` : `Me debe: ${item.debtor_email}`} | Restante: ${fmt(item.amount)}
                    </p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#555' }}>
                      {item.description || 'Sin descripción'}
                      <span style={{ marginLeft: '8px', background: '#d4edda', color: '#155724', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>
                        🔄 Recurrente
                      </span>
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', fontStyle: 'italic', color: '#666' }}>
                      Estado: {item.status}
                    </p>

                    {!iAmDebtor && item.status === 'pago_solicitado' && (
                      <div style={{ marginTop: '8px', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #ffeeba' }}>
                        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#856404', fontWeight: 'bold' }}>
                          ⚡ El deudor reporta haber pagado: ${fmt(item.pending_amount)}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#333' }}>Monto a aplicar:</span>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={item.pending_amount}
                            onChange={(e) => setCorrectionAmounts({ ...correctionAmounts, [item.id]: e.target.value })}
                            style={{ width: '90px', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {iAmDebtor && isPendingApproval && (
                      <>
                        <button onClick={() => handleAcceptNewDebt(item.id)} style={{ padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Aceptar</button>
                        <button onClick={() => handleRejectNewDebt(item.id)} style={{ padding: '6px 10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Rechazar</button>
                      </>
                    )}

                    {iAmDebtor && !isPendingApproval && item.status !== 'pago_solicitado' && (
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Abono"
                          value={payAmounts[item.id] || ''}
                          onChange={(e) => setPayAmounts({ ...payAmounts, [item.id]: e.target.value })}
                          style={{ width: '85px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <button onClick={() => handleRequestPayment(item.id, item.amount)} style={{ padding: '6px 10px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Abonar</button>
                      </div>
                    )}

                    {!iAmDebtor && item.status !== 'pago_solicitado' && item.amount > 0 && (
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Abono recibido"
                          value={creditorPayAmounts[item.id] || ''}
                          onChange={(e) => setCreditorPayAmounts({ ...creditorPayAmounts, [item.id]: e.target.value })}
                          style={{ width: '105px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <button onClick={() => handleDirectCreditorPayment(item.id, item.amount)} style={{ padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Registrar abono</button>
                      </div>
                    )}

                    {!iAmDebtor && item.status === 'pago_solicitado' && (
                      <>
                        <button onClick={() => handleConfirmOrCorrectPayment(item.id, item.amount, item.pending_amount, true)} style={{ padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Aceptar Pago</button>
                        <button onClick={() => handleConfirmOrCorrectPayment(item.id, item.amount, item.pending_amount, false)} style={{ padding: '6px 10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Rechazar</button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStopRecurring(item.id)}
                      style={{ padding: '6px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      Dar de baja
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDebt(item.id, item.description || 'este pago recurrente')}
                      style={{ padding: '6px 10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mis Deudas Puntuales (No recurrentes) */}
      <div style={{ marginBottom: '30px' }}>
        <h4 style={{ color: '#c0392b' }}>Mis Deudas (Lo que debo)</h4>
        {myDebtsAsDebtor.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No tienes deudas puntuales pendientes registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myDebtsAsDebtor.map(debt => {
              const isPendingApproval = debt.status === 'por_aceptar';

              return (
                <div key={debt.id} style={{ padding: '12px', background: isPendingApproval ? '#fff3cd' : '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>Acreedor: {debt.creditor_email || 'No especificado'}</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#555' }}>{debt.description || 'Sin descripción'}</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#c0392b', fontWeight: 'bold' }}>
                      Restante: ${fmt(debt.amount)}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', fontStyle: 'italic', color: isPendingApproval ? '#856404' : (debt.status === 'pago_solicitado' ? '#e67e22' : '#27ae60') }}>
                      Estado: {isPendingApproval ? '⚠️ Requiere tu aprobación' : (debt.status === 'pago_solicitado' ? `Pago de $${fmt(debt.pending_amount)} en revisión` : debt.status)}
                    </p>
                  </div>

                  {isPendingApproval ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleAcceptNewDebt(debt.id)} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Aceptar</button>
                      <button onClick={() => handleRejectNewDebt(debt.id)} style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Rechazar</button>
                    </div>
                  ) : (
                    debt.status !== 'pago_solicitado' && (
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Monto a abonar"
                          value={payAmounts[debt.id] || ''}
                          onChange={(e) => setPayAmounts({ ...payAmounts, [debt.id]: e.target.value })}
                          style={{ width: '100px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <button onClick={() => handleRequestPayment(debt.id, debt.amount)} style={{ padding: '6px 10px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Abonar</button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Por Cobrar Puntuales (No recurrentes) */}
      <div style={{ marginBottom: '30px' }}>
        <h4 style={{ color: '#27ae60' }}>Por Cobrar / Notificaciones de Pagos</h4>
        {myDebtsAsCreditor.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No tienes préstamos o cuentas por cobrar puntuales pendientes.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myDebtsAsCreditor.map(debt => (
              <div key={debt.id} style={{ padding: '12px', background: debt.status === 'pago_solicitado' ? '#fff3cd' : '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>Deudor: {debt.debtor_email || 'No especificado'} | Total Restante: ${fmt(debt.amount)}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#555' }}>{debt.description}</p>

                  {debt.status === 'por_aceptar' && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#856404', fontStyle: 'italic' }}>
                      ⏳ Esperando que el deudor acepte la deuda.
                    </p>
                  )}

                  {debt.status === 'pago_solicitado' && (
                    <div style={{ marginTop: '8px', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #ffeeba' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#856404', fontWeight: 'bold' }}>
                        ⚡ El deudor reporta haber pagado: ${fmt(debt.pending_amount)}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#333' }}>¿Deseas corregir el monto antes de aceptar?</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={debt.pending_amount}
                          onChange={(e) => setCorrectionAmounts({ ...correctionAmounts, [debt.id]: e.target.value })}
                          style={{ width: '90px', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {debt.status === 'pago_solicitado' ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleConfirmOrCorrectPayment(debt.id, debt.amount, debt.pending_amount, true)} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Aceptar Pago</button>
                    <button onClick={() => handleConfirmOrCorrectPayment(debt.id, debt.amount, debt.pending_amount, false)} style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Rechazar</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {debt.amount > 0 && (
                      <>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Abono recibido"
                          value={creditorPayAmounts[debt.id] || ''}
                          onChange={(e) => setCreditorPayAmounts({ ...creditorPayAmounts, [debt.id]: e.target.value })}
                          style={{ width: '105px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <button onClick={() => handleDirectCreditorPayment(debt.id, debt.amount)} style={{ padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Registrar abono</button>
                      </>
                    )}
                    <span style={{ fontSize: '12px', color: '#666' }}>Estado: {debt.status}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORIAL EN PANTALLA CON FILTROS */}
      <div style={{ borderTop: '2px solid #ddd', paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
          <h4 style={{ color: '#2c3e50', margin: 0 }}>📜 Historial de Pagos y Abonos</h4>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              style={{ padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="todos">📅 Todos los Meses</option>
              <option value="01">Enero</option>
              <option value="02">Febrero</option>
              <option value="03">Marzo</option>
              <option value="04">Abril</option>
              <option value="05">Mayo</option>
              <option value="06">Junio</option>
              <option value="07">Julio</option>
              <option value="08">Agosto</option>
              <option value="09">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>

            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{ padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="todos">Todos los Años</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No hay abonos ni movimientos liquidados en el periodo seleccionado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredHistory.map(item => (
              <div key={item.id} style={{ padding: '10px 12px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ color: '#333' }}>{item.description}</strong>
                  <span style={{ color: '#666', marginLeft: '8px', fontSize: '12px' }}>
                    (Deudor: {item.debtor_email} → Acreedor: {item.creditor_email})
                  </span>
                  {item.dateStr && (
                    <span style={{ color: '#888', marginLeft: '8px', fontSize: '11px' }}>
                      [{item.dateStr}]
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#1e293b' }}>${fmt(item.amount)}</span>
                  <span style={{ color: item.kind === 'abono' ? '#0284c7' : '#27ae60', fontWeight: 'bold' }}>
                    {item.kind === 'abono' ? '💵 Abono' : '✓ Liquidado'}
                  </span>
                  <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                    {item.is_recurring ? 'Recurrente' : 'Único'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}