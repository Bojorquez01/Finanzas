import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function DebtManager({ session }) {
  const [debts, setDebts] = useState([]);
  const [relationType, setRelationType] = useState('yo_debo');
  const [otherEmail, setOtherEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  
  const [payAmounts, setPayAmounts] = useState({});
  const [correctionAmounts, setCorrectionAmounts] = useState({});

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
      const currentMonth = new Date().toISOString().slice(0, 7); // Ej: '2026-08'
      let updatedData = [...data];

      // Verificar y autorenovar deudas recurrentes si estamos en un nuevo mes
      for (let debt of updatedData) {
        if (debt.is_recurring && debt.last_reset_month !== currentMonth) {
          await supabase
            .from('debts')
            .update({ 
              status: 'pendiente', 
              last_reset_month: currentMonth 
            })
            .eq('id', debt.id);

          debt.status = 'pendiente';
          debt.last_reset_month = currentMonth;
        }
      }

      setDebts(updatedData);
    }
  }

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    if (!otherEmail || !amount) return;

    const totalAmt = parseFloat(amount);
    const months = totalMonths ? parseInt(totalMonths) : null;
    const monthlyPay = months ? totalAmt / months : null;
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

  const handleConfirmOrCorrectPayment = async (debtId, currentAmount, originalPendingAmt, confirm) => {
    let newStatus = 'pendiente';
    let newAmount = currentAmount;

    if (confirm) {
      const finalPaidAmount = correctionAmounts[debtId] !== undefined ? parseFloat(correctionAmounts[debtId]) : originalPendingAmt;
      if (isNaN(finalPaidAmount) || finalPaidAmount <= 0) {
        alert('Ingresa un monto válido a aplicar.');
        return;
      }
      newAmount = currentAmount - finalPaidAmount;
      newStatus = newAmount <= 0 ? 'pagado' : 'pendiente';
    }

    const { error } = await supabase.from('debts').update({
      amount: newAmount > 0 ? newAmount : 0,
      status: newStatus,
      pending_amount: 0
    }).eq('id', debtId);

    if (!error) {
      const copy = { ...correctionAmounts };
      delete copy[debtId];
      setCorrectionAmounts(copy);
      fetchDebts();
    }
  };

  const userEmail = session.user.email;
  const userId = session.user.id;
  
  const myDebtsAsDebtor = debts.filter(d => 
    d.debtor_email === userEmail || 
    (d.debtor_id === userId && d.creditor_email !== userEmail)
  );

  const myDebtsAsCreditor = debts.filter(d => 
    d.creditor_email === userEmail && 
    d.debtor_email && 
    d.debtor_email !== userEmail
  );

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

      {/* Mis Deudas */}
      <div style={{ marginBottom: '30px' }}>
        <h4 style={{ color: '#c0392b' }}>Mis Deudas (Lo que debo)</h4>
        {myDebtsAsDebtor.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No tienes deudas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myDebtsAsDebtor.map(debt => {
              const isPendingApproval = debt.status === 'por_aceptar';

              return (
                <div key={debt.id} style={{ padding: '12px', background: isPendingApproval ? '#fff3cd' : '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>Acreedor: {debt.creditor_email || 'No especificado'}</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#555' }}>
                      {debt.description || 'Sin descripción'}
                      {debt.is_recurring && <span style={{ marginLeft: '8px', background: '#d4edda', color: '#155724', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>🔄 Recurrente</span>}
                    </p>
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
                    debt.status !== 'pagado' && debt.status !== 'pago_solicitado' && (
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

      {/* Por Cobrar */}
      <div>
        <h4 style={{ color: '#27ae60' }}>Por Cobrar / Notificaciones de Pagos</h4>
        {myDebtsAsCreditor.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No tienes préstamos o cuentas por cobrar.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myDebtsAsCreditor.map(debt => (
              <div key={debt.id} style={{ padding: '12px', background: debt.status === 'pago_solicitado' ? '#fff3cd' : '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>Deudor: {debt.debtor_email || 'No especificado'} | Total Restante: ${fmt(debt.amount)}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#555' }}>
                    {debt.description}
                    {debt.is_recurring && <span style={{ marginLeft: '8px', background: '#d4edda', color: '#155724', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>🔄 Recurrente</span>}
                  </p>
                  
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
                  <span style={{ fontSize: '12px', color: '#666' }}>Estado: {debt.status}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DebtManager;