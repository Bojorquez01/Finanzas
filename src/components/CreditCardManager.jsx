import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function CreditCardManager({ session }) {
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [projections, setProjections] = useState([]);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [cardName, setCardName] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [cutoffDay, setCutoffDay] = useState('');
  const [paymentDueDay, setPaymentDueDay] = useState('');
  
  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editCutoffDay, setEditCutoffDay] = useState('');
  const [editPaymentDueDay, setEditPaymentDueDay] = useState('');

  const [activeCardDetail, setActiveCardDetail] = useState(null);
  const [projMonth, setProjMonth] = useState('');
  const [projAmount, setProjAmount] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const [isMsi, setIsMsi] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('');
  const [currentInstallment, setCurrentInstallment] = useState('');

  useEffect(() => {
    fetchData();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function fetchData() {
    const { data: catData } = await supabase.from('expense_categories').select('*').order('id', { ascending: false });
    if (catData) setCategories(catData);

    const { data: cardData } = await supabase.from('credit_cards').select('*').order('id', { ascending: false });
    if (cardData) {
      setCards(cardData);
      if (cardData.length > 0 && !selectedCardId) setSelectedCardId(cardData[0].id);
    }

    const { data: expData } = await supabase.from('expenses').select('*, credit_cards(card_name), expense_categories(name)').order('id', { ascending: false });
    if (expData) setExpenses(expData);

    const { data: projData } = await supabase.from('card_statement_projections').select('*').order('target_month', { ascending: true });
    if (projData) setProjections(projData);
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const { error } = await supabase.from('expense_categories').insert([{ name: newCategoryName }]);
    if (!error) { setNewCategoryName(''); fetchData(); }
  };

  const handleCreateCard = async (e) => {
    e.preventDefault();
    if (!cardName.trim()) return;

    const { error } = await supabase.from('credit_cards').insert([{ 
      card_name: cardName, 
      credit_limit: parseFloat(creditLimit) || 0,
      cutoff_day: parseInt(cutoffDay) || null,
      payment_due_day: parseInt(paymentDueDay) || null
    }]);

    if (!error) {
      setCardName('');
      setCreditLimit('');
      setCutoffDay('');
      setPaymentDueDay('');
      fetchData();
    }
  };

  const startEditingCard = (card) => {
    setEditingCardId(card.id);
    setEditCardName(card.card_name);
    setEditCreditLimit(card.credit_limit || '');
    setEditCutoffDay(card.cutoff_day || '');
    setEditPaymentDueDay(card.payment_due_day || '');
  };

  const handleUpdateCard = async (e, cardId) => {
    e.preventDefault();
    if (!editCardName.trim()) return;

    const { error } = await supabase
      .from('credit_cards')
      .update({
        card_name: editCardName,
        credit_limit: parseFloat(editCreditLimit) || 0,
        cutoff_day: parseInt(editCutoffDay) || null,
        payment_due_day: parseInt(editPaymentDueDay) || null
      })
      .eq('id', cardId);

    if (!error) {
      setEditingCardId(null);
      fetchData();
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!selectedCardId || !expenseAmount) return;

    const totalAmt = parseFloat(expenseAmount);
    let monthlyAmt = totalAmt;
    let tInst = 1;
    let cInst = 1;

    if (isMsi && totalInstallments) {
      tInst = parseInt(totalInstallments) || 1;
      cInst = parseInt(currentInstallment) || 1;
      monthlyAmt = totalAmt / tInst;
    }

    const { error } = await supabase.from('expenses').insert([{
      card_id: selectedCardId,
      category_id: selectedCatId ? parseInt(selectedCatId) : null,
      amount: monthlyAmt,
      description: expenseDesc,
      is_recurring: isRecurring,
      is_msi: isMsi,
      total_installments: tInst,
      current_installment: cInst,
      monthly_installment_amount: monthlyAmt
    }]);

    if (!error) {
      setExpenseAmount('');
      setExpenseDesc('');
      setIsRecurring(false);
      setIsMsi(false);
      setTotalInstallments('');
      setCurrentInstallment('');
      fetchData();
    }
  };

  const handleDeleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) fetchData();
  };

  const handleAddProjection = async (e) => {
    e.preventDefault();
    if (!activeCardDetail || !projMonth || !projAmount) return;

    const { error } = await supabase.from('card_statement_projections').insert([{
      card_id: activeCardDetail.id,
      target_month: projMonth,
      amount: parseFloat(projAmount),
      description: projDesc
    }]);

    if (!error) {
      setProjAmount('');
      setProjDesc('');
      fetchData();
    }
  };

  const handleDeleteProjection = async (id) => {
    const { error } = await supabase.from('card_statement_projections').delete().eq('id', id);
    if (!error) fetchData();
  };

  // Día actual del mes para verificar si el estado de cuenta ya está listo
  const currentDayOfMonth = new Date().getDate();

  return (
    <div style={{ marginTop: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>
        Tarjetas de Crédito, Crédito Disponible y Estados de Cuenta
      </h3>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px' }}>
        
        {/* Categorías */}
        <div style={{ flex: 1, minWidth: '250px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Categorías de Gasto</h4>
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Ej. Streaming, Ropa" 
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              required
              style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button type="submit" style={{ padding: '6px 10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ Crear</button>
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
            {categories.map(cat => (
              <span key={cat.id} style={{ background: '#e2e3e5', padding: '3px 8px', borderRadius: '12px', fontSize: '11px' }}>{cat.name}</span>
            ))}
          </div>
        </div>

        {/* Tarjetas */}
        <div style={{ flex: 1, minWidth: '280px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Agregar Tarjeta (Nu, BBVA, etc.)</h4>
          <form onSubmit={handleCreateCard} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Nombre (ej. Nu, BBVA Oro)" 
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              required
              style={{ padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <input 
                type="number" 
                step="0.01" 
                placeholder="Límite ($)" 
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input 
                type="number" 
                min="1" 
                max="31" 
                placeholder="Día corte" 
                value={cutoffDay}
                onChange={(e) => setCutoffDay(e.target.value)}
                style={{ width: '80px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input 
                type="number" 
                min="1" 
                max="31" 
                placeholder="Día pago" 
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(e.target.value)}
                style={{ width: '80px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <button type="submit" style={{ padding: '6px 10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ Registrar Tarjeta</button>
          </form>
        </div>

      </div>

      {/* Registrar Gasto del Mes Actual */}
      <div style={{ background: '#e8f4fd', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #b8daff' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#004085' }}>Registrar Gasto del Mes Actual</h4>
        <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select 
              value={selectedCardId} 
              onChange={(e) => setSelectedCardId(e.target.value)}
              required
              style={{ flex: 1, minWidth: '130px', padding: '7px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Selecciona Tarjeta</option>
              {cards.map(card => (
                <option key={card.id} value={card.id}>{card.card_name}</option>
              ))}
            </select>

            <select 
              value={selectedCatId} 
              onChange={(e) => setSelectedCatId(e.target.value)}
              style={{ flex: 1, minWidth: '130px', padding: '7px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Sin Categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <input 
              type="number" 
              step="0.01" 
              placeholder="Monto del Gasto ($)" 
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              required
              style={{ width: '170px', padding: '7px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />

            <input 
              type="text" 
              placeholder="Descripción (ej. Súper, Gasolina)" 
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              style={{ flex: 2, minWidth: '150px', padding: '7px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
              🔄 Gasto recurrente mensual (Spotify, etc.)
            </label>
            <button type="submit" style={{ padding: '7px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>+ Registrar Gasto Actual</button>
          </div>
        </form>
      </div>

      {/* Listado de Tarjetas */}
      <div>
        <h4 style={{ color: '#333' }}>Mis Tarjetas y Crédito Disponible</h4>
        {cards.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No hay tarjetas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {cards.map(card => {
              const cardExpenses = expenses.filter(exp => exp.card_id === card.id);
              const totalCardSpent = cardExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
              const availableCredit = card.credit_limit > 0 ? card.credit_limit - totalCardSpent : null;
              
              // Ver si el estado de cuenta ya está listo (si hoy el día actual >= día de corte)
              const isStatementReady = card.cutoff_day && currentDayOfMonth >= card.cutoff_day;
              const isEditing = editingCardId === card.id;

              return (
                <div key={card.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                  
                  {/* Alerta de Estado de Cuenta Listo */}
                  {isStatementReady && (
                    <div style={{ background: '#d4edda', color: '#155724', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📢 ¡Tu estado de cuenta ya se puede consultar en la app de tu banco! (Día de corte: {card.cutoff_day})
                    </div>
                  )}

                  {isEditing ? (
                    <form onSubmit={(e) => handleUpdateCard(e, card.id)} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px', background: '#f8f9fa', padding: '10px', borderRadius: '6px' }}>
                      <input type="text" value={editCardName} onChange={(e) => setEditCardName(e.target.value)} required style={{ flex: 2, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <input type="number" step="0.01" placeholder="Límite" value={editCreditLimit} onChange={(e) => setEditCreditLimit(e.target.value)} style={{ width: '90px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <input type="number" min="1" max="31" placeholder="Corte" value={editCutoffDay} onChange={(e) => setEditCutoffDay(e.target.value)} style={{ width: '80px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <input type="number" min="1" max="31" placeholder="Pago" value={editPaymentDueDay} onChange={(e) => setEditPaymentDueDay(e.target.value)} style={{ width: '80px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <button type="submit" style={{ padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Guardar</button>
                      <button type="button" onClick={() => setEditingCardId(null)} style={{ padding: '6px 10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#0056b3' }}>💳 {card.card_name}</span>
                        <span style={{ marginLeft: '10px', fontSize: '11px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                          Corte: Día {card.cutoff_day || 'N/A'} | Pago: Día {card.payment_due_day || 'N/A'}
                        </span>
                        <button onClick={() => startEditingCard(card)} style={{ marginLeft: '8px', background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Editar</button>
                      </div>

                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {availableCredit !== null && (
                          <span style={{ fontSize: '12px', color: '#27ae60', fontWeight: 'bold' }}>
                            Disponible: ${fmt(availableCredit)}
                          </span>
                        )}
                        <button 
                          onClick={() => setActiveCardDetail(card)}
                          style={{ padding: '4px 10px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          👁️ Ver Detalle y Meses Futuros
                        </button>
                        <span style={{ fontSize: '13px', color: '#dc3545', fontWeight: 'bold' }}>Consumido: ${fmt(totalCardSpent)}</span>
                      </div>
                    </div>
                  )}

                  {cardExpenses.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Sin consumos este mes.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {cardExpenses.map(exp => (
                        <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}>
                          <div>
                            <span style={{ background: '#d1ecf1', color: '#0c5460', padding: '2px 6px', borderRadius: '4px', marginRight: '8px', fontWeight: 'bold' }}>
                              {exp.expense_categories ? exp.expense_categories.name : 'General'}
                            </span>
                            <span>{exp.description || 'Sin descripción'}</span>
                            {exp.is_recurring && <span style={{ marginLeft: '8px', background: '#d4edda', color: '#155724', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>🔄 Recurrente</span>}
                          </div>
                          <div>
                            <span style={{ fontWeight: 'bold', color: '#dc3545', marginRight: '10px' }}>-${fmt(exp.amount)}</span>
                            <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>X</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalle y Meses Futuros con formato */}
      {activeCardDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '8px', width: '500px', maxWidth: '90%', fontFamily: 'sans-serif', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#0056b3' }}>Detalle de Tarjeta: {activeCardDetail.card_name}</h3>
              <button onClick={() => setActiveCardDetail(null)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
            </div>

            <p style={{ fontSize: '13px', color: '#555', marginBottom: '15px' }}>
              Día de corte: <strong>{activeCardDetail.cutoff_day || 'N/A'}</strong> | Día límite de pago: <strong>{activeCardDetail.payment_due_day || 'N/A'}</strong>
            </p>

            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #ddd' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#333' }}>Registrar Gasto o Monto para un Mes Futuro</h4>
              <form onSubmit={handleAddProjection} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="month" 
                    value={projMonth}
                    onChange={(e) => setProjMonth(e.target.value)}
                    required
                    style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="Monto ($)" 
                    value={projAmount}
                    onChange={(e) => setProjAmount(e.target.value)}
                    required
                    style={{ width: '100px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Descripción (ej. Compra diferida, Mensualidad X)" 
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  style={{ padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button type="submit" style={{ padding: '6px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  + Agregar al Estado Futuro
                </button>
              </form>
            </div>

            <h4 style={{ fontSize: '14px', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Cargos Registrados en Meses Futuros:</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {projections.filter(p => p.card_id === activeCardDetail.id).length === 0 ? (
                <p style={{ fontSize: '12px', color: '#666' }}>No hay cargos registrados para meses futuros en esta tarjeta.</p>
              ) : (
                projections.filter(p => p.card_id === activeCardDetail.id).map(proj => (
                  <div key={proj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e8f4fd', padding: '8px 10px', borderRadius: '4px', fontSize: '12px', border: '1px solid #b8daff' }}>
                    <div>
                      <span style={{ background: '#004085', color: '#fff', padding: '2px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', marginRight: '8px' }}>
                        {proj.target_month}
                      </span>
                      <span>{proj.description || 'Sin descripción'}</span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#dc3545', marginRight: '10px' }}>${fmt(proj.amount)}</span>
                      <button onClick={() => handleDeleteProjection(proj.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 5px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>X</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button onClick={() => setActiveCardDetail(null)} style={{ width: '100%', padding: '8px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreditCardManager;