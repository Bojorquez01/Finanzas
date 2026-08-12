import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DebtManager({ session }) {
  const [debts, setDebts] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [relationType, setRelationType] = useState('yo_debo');
  const [otherEmail, setOtherEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  
  const [payAmounts, setPayAmounts] = useState({});
  const [correctionAmounts, setCorrectionAmounts] = useState({});

  // Estados para los Filtros de Mes y Año
  const [filterMonth, setFilterMonth] = useState('todos'); 
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString()); 

  useEffect(() => {
    if (session) {
      fetchDebts();
      fetchInvestments();
    }
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
    }
  }

  async function fetchInvestments() {
    const { data } = await supabase.from('investments').select('*');
    if (data) setInvestments(data);
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
    (d.debtor_email === userEmail || (d.debtor_id === userId && d.creditor_email !== userEmail)) &&
    d.status !== 'pagado'
  );

  const myDebtsAsCreditor = debts.filter(d => 
    d.creditor_email === userEmail && 
    d.debtor_email && 
    d.debtor_email !== userEmail &&
    d.status !== 'pagado'
  );

  const debtHistory = debts.filter(d => d.status === 'pagado');

  // --- FILTRADO INTELIGENTE POR MES Y AÑO ---
  const filterByDate = (item) => {
    const itemDate = item.last_reset_month || (item.created_at ? item.created_at.slice(0, 7) : '');
    if (!itemDate) return true;
    const [itemYear, itemMonth] = itemDate.split('-');

    const matchesYear = filterYear === 'todos' || itemYear === filterYear;
    const matchesMonth = filterMonth === 'todos' || itemMonth === filterMonth;

    return matchesYear && matchesMonth;
  };

  const filteredHistory = debtHistory.filter(filterByDate);
  const filteredInvestments = investments.filter(filterByDate);

  // --- GENERACIÓN DE PDF COMPATIBLE CON MÓVIL Y WEB (Blob URL Directo) ---
  const handleDownloadPDF = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Estado de Cuenta General - Financiero</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #333; }
            h2 { color: #2c3e50; text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }
            .info { margin-bottom: 20px; font-size: 13px; background: #f8f9fa; padding: 12px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f1f3f5; color: #333; }
            h4 { color: #495057; margin-top: 25px; border-bottom: 1px solid #dee2e6; padding-bottom: 5px; }
            .liquidado { color: #27ae60; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>ESTADO DE CUENTA GENERAL</h2>
          <div class="info">
            <p><strong>Usuario:</strong> ${userEmail}</p>
            <p><strong>Periodo Filtrado:</strong> Mes: ${filterMonth === 'todos' ? 'Todos' : filterMonth} / Año: ${filterYear}</p>
            <p><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <h4>1. Portafolio de Inversiones en el Periodo</h4>
          <table>
            <thead>
              <tr>
                <th>Plataforma / Tipo</th>
                <th>Activo</th>
                <th>Invertido</th>
                <th>Valor Actual</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInvestments.length === 0 ? '<tr><td colspan="4" style="text-align: center;">Sin inversiones en este periodo.</td></tr>' : 
                filteredInvestments.map(i => `
                  <tr>
                    <td>${i.platform} • ${i.instrument_type}</td>
                    <td><strong>${i.name}</strong></td>
                    <td>$${fmt(i.invested_amount)}</td>
                    <td>$${fmt(i.current_value)}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>

          <h4>2. Historial de Deudas y Movimientos Liquidados</h4>
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Deudor</th>
                <th>Acreedor</th>
                <th>Tipo</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${filteredHistory.length === 0 ? '<tr><td colspan="5" style="text-align: center;">No hay movimientos liquidados en este periodo.</td></tr>' : 
                filteredHistory.map(item => `
                  <tr>
                    <td>${item.description || 'Sin descripción'}</td>
                    <td>${item.debtor_email}</td>
                    <td>${item.creditor_email}</td>
                    <td>${item.is_recurring ? 'Recurrente' : 'Único'}</td>
                    <td class="liquidado">Liquidado ✓</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 400);
            }
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');

    if (!newWindow) {
      alert('Tu navegador bloqueó la ventana emergente. Por favor permite las pop-ups para descargar el reporte PDF.');
    }
  };

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
          <p style={{ fontSize: '13px', color: '#666' }}>No tienes deudas pendientes registradas.</p>
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

      {/* Por Cobrar */}
      <div style={{ marginBottom: '30px' }}>
        <h4 style={{ color: '#27ae60' }}>Por Cobrar / Notificaciones de Pagos</h4>
        {myDebtsAsCreditor.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No tienes préstamos o cuentas por cobrar pendientes.</p>
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

      {/* ESTADO DE CUENTA GENERAL Y HISTORIAL CON FILTROS Y PDF */}
      <div style={{ borderTop: '2px solid #ddd', paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
          <h4 style={{ color: '#2c3e50', margin: 0 }}>📜 Estado de Cuenta General e Historial</h4>
          
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

            <button 
              onClick={handleDownloadPDF} 
              style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
            >
              📥 Descargar Estado de Cuenta General (PDF)
            </button>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No hay movimientos liquidados en el periodo seleccionado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredHistory.map(item => (
              <div key={item.id} style={{ padding: '10px 12px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <div>
                  <strong style={{ color: '#333' }}>{item.description || 'Sin descripción'}</strong> 
                  <span style={{ color: '#666', marginLeft: '8px', fontSize: '12px' }}>
                    (Deudor: {item.debtor_email} → Acreedor: {item.creditor_email})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✓ Liquidado</span>
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