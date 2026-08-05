import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function CreditCardManager({ session }) {
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [cardName, setCardName] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentDueDay, setPaymentDueDay] = useState('');
  
  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editPaymentDueDay, setEditPaymentDueDay] = useState('');

  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  // Estados para MSI (Meses sin intereses / Cuotas futuras estilo Nu o BBVA)
  const [isMsi, setIsMsi] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('');
  const [currentInstallment, setCurrentInstallment] = useState('');

  useEffect(() => {
    fetchData();
  }, [session]);

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
      payment_due_day: parseInt(paymentDueDay) || null
    }]);

    if (!error) {
      setCardName('');
      setCreditLimit('');
      setPaymentDueDay('');
      fetchData();
    }
  };

  const startEditingCard = (card) => {
    setEditingCardId(card.id);
    setEditCardName(card.card_name);
    setEditCreditLimit(card.credit_limit || '');
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
      monthlyAmt = totalAmt / tInst; // Cuota del mes actual
    }

    const { error } = await supabase.from('expenses').insert([{
      card_id: selectedCardId,
      category_id: selectedCatId ? parseInt(selectedCatId) : null,
      amount: monthlyAmt, // Guardamos la mensualidad del mes actual en el total activo
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

  return (
    <div style={{ marginTop: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>
        Tarjetas de Crédito, Suscripciones y MSI (Meses sin intereses)
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
        <div style={{ flex: 1, minWidth: '250px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
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
            <div style={{ display: 'flex', gap: '8px' }}>
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
                placeholder="Día límite (1-31)" 
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(e.target.value)}
                style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <button type="submit" style={{ padding: '6px 10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ Registrar Tarjeta</button>
          </form>
        </div>

      </div>

      {/* Registrar Gasto con opción de MSI */}
      <div style={{ background: '#e8f4fd', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #b8daff' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#004085' }}>Registrar Gasto o Compra a Meses (MSI)</h4>
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
              placeholder={isMsi ? "Monto Total de la Compra ($)" : "Monto del Gasto ($)"} 
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              required
              style={{ width: '170px', padding: '7px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />

            <input 
              type="text" 
              placeholder="Descripción (ej. Pantalla, Seguro)" 
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              style={{ flex: 2, minWidth: '150px', padding: '7px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          {/* Opciones de MSI y Recurrente */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '10px', borderRadius: '6px' }}>
            <label style={{ fontSize: '12px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
              🔄 Gasto recurrente mensual (Spotify, etc.)
            </label>

            <label style={{ fontSize: '12px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isMsi} onChange={(e) => setIsMsi(e.target.checked)} />
              💳 Compra a Meses Sin Intereses (MSI)
            </label>

            {isMsi && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  min="2" 
                  placeholder="Total Meses (ej. 12)" 
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                  style={{ width: '110px', padding: '5px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  required
                />
                <input 
                  type="number" 
                  min="1" 
                  placeholder="Mes actual (ej. 3)" 
                  value={currentInstallment}
                  onChange={(e) => setCurrentInstallment(e.target.value)}
                  style={{ width: '110px', padding: '5px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  required
                />
              </div>
            )}

            <button type="submit" style={{ marginLeft: 'auto', padding: '7px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>+ Registrar Gasto</button>
          </div>
        </form>
      </div>

      {/* Listado */}
      <div>
        <h4 style={{ color: '#333' }}>Mis Tarjetas y Consumos</h4>
        {cards.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No hay tarjetas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {cards.map(card => {
              const cardExpenses = expenses.filter(exp => exp.card_id === card.id);
              const totalCardSpent = cardExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
              const isEditing = editingCardId === card.id;

              return (
                <div key={card.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px' }}>
                  {isEditing ? (
                    <form onSubmit={(e) => handleUpdateCard(e, card.id)} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px', background: '#f8f9fa', padding: '10px', borderRadius: '6px' }}>
                      <input type="text" value={editCardName} onChange={(e) => setEditCardName(e.target.value)} required style={{ flex: 2, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <input type="number" step="0.01" placeholder="Límite" value={editCreditLimit} onChange={(e) => setEditCreditLimit(e.target.value)} style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <input type="number" min="1" max="31" placeholder="Día límite" value={editPaymentDueDay} onChange={(e) => setEditPaymentDueDay(e.target.value)} style={{ width: '90px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <button type="submit" style={{ padding: '6px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Guardar</button>
                      <button type="button" onClick={() => setEditingCardId(null)} style={{ padding: '6px 10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#0056b3' }}>💳 {card.card_name}</span>
                        {card.payment_due_day ? (
                          <span style={{ marginLeft: '12px', fontSize: '12px', background: '#fff3cd', color: '#856404', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Día límite: Día {card.payment_due_day}</span>
                        ) : (
                          <span style={{ marginLeft: '12px', fontSize: '12px', background: '#f8d7da', color: '#721c24', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Sin día límite</span>
                        )}
                        <button onClick={() => startEditingCard(card)} style={{ marginLeft: '10px', background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Editar</button>
                      </div>
                      <span style={{ fontSize: '13px', color: '#dc3545', fontWeight: 'bold' }}>Total Mensual a Pagar: ${totalCardSpent.toFixed(2)}</span>
                    </div>
                  )}

                  {cardExpenses.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Sin consumos registrados.</p>
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
                            {exp.is_msi && <span style={{ marginLeft: '8px', background: '#fff3cd', color: '#856404', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>💳 MSI (Mes {exp.current_installment} de {exp.total_installments})</span>}
                          </div>
                          <div>
                            <span style={{ fontWeight: 'bold', color: '#dc3545', marginRight: '10px' }}>-${exp.amount}</span>
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
    </div>
  );
}

export default CreditCardManager;