import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function DebtManager({ session }) {
  const [debts, setDebts] = useState([]);
  const [creditorEmail, setCreditorEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [totalMonths, setTotalMonths] = useState('1');
  const [description, setDescription] = useState('');
  const [payAmounts, setPayAmounts] = useState({});

  useEffect(() => {
    fetchDebts();
  }, [session]);

  async function fetchDebts() {
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .or(`debtor_id.eq.${session.user.id},creditor_email.eq.${session.user.email}`);

    if (!error) setDebts(data || []);
  }

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    if (!creditorEmail || !amount) return;

    const totalAmt = parseFloat(amount);
    const months = parseInt(totalMonths) || 1;
    const monthlyPay = totalAmt / months;

    const { error } = await supabase
      .from('debts')
      .insert([{
        creditor_email: creditorEmail.trim(),
        amount: totalAmt,
        total_months: months,
        monthly_payment: monthlyPay,
        description: description,
        status: 'pendiente'
      }]);

    if (!error) {
      setCreditorEmail('');
      setAmount('');
      setTotalMonths('1');
      setDescription('');
      fetchDebts();
    }
  };

  const handleRequestPayment = async (debtId, currentAmount) => {
    const payVal = parseFloat(payAmounts[debtId]);
    if (!payVal || payVal <= 0 || payVal > currentAmount) {
      alert('Ingresa un monto válido para el pago.');
      return;
    }

    const { error } = await supabase
      .from('debts')
      .update({ status: 'pago_solicitado', pending_amount: payVal })
      .eq('id', debtId);

    if (!error) fetchDebts();
  };

  const handleConfirmPayment = async (debtId, currentAmount, pendingAmt, confirm) => {
    let newStatus = 'pendiente';
    let newAmount = currentAmount;

    if (confirm) {
      newAmount = currentAmount - pendingAmt;
      newStatus = newAmount <= 0 ? 'pagado' : 'pendiente';
    }

    const { error } = await supabase
      .from('debts')
      .update({
        amount: newAmount > 0 ? newAmount : 0,
        status: newStatus,
        pending_amount: 0
      })
      .eq('id', debtId);

    if (!error) fetchDebts();
  };

  const myDebtsAsDebtor = debts.filter(d => d.debtor_id === session.user.id);
  const myDebtsAsCreditor = debts.filter(d => d.creditor_email === session.user.email);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '10px' }}>
      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>Control de Deudas y Plazos</h3>

      {/* Formulario de Deuda con Meses */}
      <form onSubmit={handleCreateDebt} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #ddd' }}>
        <h4 style={{ margin: 0, fontSize: '15px', color: '#333' }}>Registrar Nueva Deuda</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input 
            type="email" 
            placeholder="Correo del acreedor (A quien se debe)" 
            value={creditorEmail}
            onChange={(e) => setCreditorEmail(e.target.value)}
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
            placeholder="Plazo en Meses" 
            value={totalMonths}
            onChange={(e) => setTotalMonths(e.target.value)}
            required
            style={{ width: '110px', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <input 
          type="text" 
          placeholder="Descripción (ej. Préstamo personal a 6 meses)" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '8px 14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', alignSelf: 'flex-start' }}>
          + Agregar Deuda
        </button>
      </form>

      {/* Mis Deudas */}
      <div style={{ marginBottom: '30px' }}>
        <h4 style={{ color: '#c0392b' }}>Mis Deudas (Lo que debo)</h4>
        {myDebtsAsDebtor.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No tienes deudas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myDebtsAsDebtor.map(debt => (
              <div key={debt.id} style={{ padding: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>Acreedor: {debt.creditor_email}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#555' }}>{debt.description || 'Sin descripción'}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#c0392b', fontWeight: 'bold' }}>
                    Restante: ${debt.amount} {debt.total_months > 1 && `(Plazo: ${debt.total_months} meses | Aprox. $${Number(debt.monthly_payment).toFixed(2)}/mes)`}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', fontStyle: 'italic', color: debt.status === 'pago_solicitado' ? '#e67e22' : '#27ae60' }}>
                    Estado: {debt.status === 'pago_solicitado' ? `Pago de $${debt.pending_amount} en revisión` : debt.status}
                  </p>
                </div>

                {debt.status !== 'pagado' && debt.status !== 'pago_solicitado' && (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="Monto a abonar" 
                      value={payAmounts[debt.id] || ''}
                      onChange={(e) => setPayAmounts({ ...payAmounts, [debt.id]: e.target.value })}
                      style={{ width: '100px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button onClick={() => handleRequestPayment(debt.id, debt.amount)} style={{ padding: '6px 10px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      Abonar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Por Cobrar */}
      <div>
        <h4 style={{ color: '#27ae60' }}>Por Cobrar / Notificaciones de Pagos</h4>
        {myDebtsAsCreditor.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>Nadie te debe.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {myDebtsAsCreditor.map(debt => (
              <div key={debt.id} style={{ padding: '12px', background: debt.status === 'pago_solicitado' ? '#fff3cd' : '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>Deuda Total: ${debt.amount} ({debt.total_months} meses)</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#555' }}>{debt.description}</p>
                  {debt.status === 'pago_solicitado' && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#856404', fontWeight: 'bold' }}>
                      ⚡ El deudor solicita abonar: ${debt.pending_amount}
                    </p>
                  )}
                </div>

                {debt.status === 'pago_solicitado' ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleConfirmPayment(debt.id, debt.amount, debt.pending_amount, true)} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Sí, aceptar</button>
                    <button onClick={() => handleConfirmPayment(debt.id, debt.amount, debt.pending_amount, false)} style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>No, rechazar</button>
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