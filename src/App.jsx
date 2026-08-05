import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SmartDebtOptimizer from './components/SmartDebtOptimizer';
import DebtManager from './components/DebtManager';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [cards, setCards] = useState([]);
  const [cardName, setCardName] = useState('');
  const [cutoffDay, setCutoffDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  
  const [editingCardId, setEditingCardId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCutoffDay, setEditCutoffDay] = useState('');
  const [editDueDay, setEditDueDay] = useState('');

  const [projections, setProjections] = useState([]);
  const [projCardId, setProjCardId] = useState('');
  
  const currentYear = new Date().getFullYear();
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
  const [projMonthNum, setProjMonthNum] = useState(currentMonthNum);
  const [projYear, setProjYear] = useState(String(currentYear));
  
  const [projAmount, setProjAmount] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const [expandedCardId, setExpandedCardId] = useState(null);

  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryFreq, setSalaryFreq] = useState('quincenal');
  const [minLiving, setMinLiving] = useState('');
  
  const [incomes, setIncomes] = useState([]);
  const [incDesc, setIncDesc] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incMonth, setIncMonth] = useState(new Date().toISOString().slice(0, 7));

  const formatMonthName = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    if (!year || !month) return dateStr;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${capitalizedMonth} ${year}`;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchAllData();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session) fetchAllData();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchAllData() {
    const { data: cData } = await supabase.from('credit_cards').select('*');
    if (cData) setCards(cData);

    const { data: pData } = await supabase.from('card_statement_projections').select('*, credit_cards(card_name)');
    if (pData) setProjections(pData);

    const { data: sData } = await supabase.from('user_salary_config').select('*').maybeSingle();
    if (sData) {
      setSalaryAmount(sData.salary_amount || '');
      setSalaryFreq(sData.frequency || 'quincenal');
      setMinLiving(sData.min_living_expense || '');
    }

    const { data: iData } = await supabase.from('incomes').select('*');
    if (iData) setIncomes(iData);
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Error: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!cardName) return;
    const { error } = await supabase.from('credit_cards').insert([{ 
      card_name: cardName, 
      cutoff_day: cutoffDay ? parseInt(cutoffDay) : null,
      payment_due_day: dueDay ? parseInt(dueDay) : null, 
      user_id: session.user.id 
    }]);
    if (error) {
      alert('Error al crear tarjeta: ' + error.message);
      return;
    }
    setCardName('');
    setCutoffDay('');
    setDueDay('');
    fetchAllData();
  };

  const startEditingCard = (card, e) => {
    e.stopPropagation();
    setEditingCardId(card.id);
    setEditName(card.card_name);
    setEditCutoffDay(card.cutoff_day || '');
    setEditDueDay(card.payment_due_day || '');
  };

  const handleUpdateCard = async (cardId, e) => {
    e.stopPropagation();
    if (!editName) return;
    const { error } = await supabase.from('credit_cards').update({
      card_name: editName,
      cutoff_day: editCutoffDay ? parseInt(editCutoffDay) : null,
      payment_due_day: editDueDay ? parseInt(editDueDay) : null
    }).eq('id', cardId);
    if (error) {
      alert('Error al actualizar tarjeta: ' + error.message);
      return;
    }
    setEditingCardId(null);
    fetchAllData();
  };

  const handleDeleteCard = async (cardId, cardProjections, e) => {
    e.stopPropagation();
    if (cardProjections && cardProjections.length > 0) {
      alert('⚠️ No se puede eliminar esta tarjeta porque tiene pagos o deudas programadas pendientes. Debes eliminar sus pagos futuros primero.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;
    const { error } = await supabase.from('credit_cards').delete().eq('id', cardId);
    if (error) {
      alert('Error al eliminar tarjeta: ' + error.message);
      return;
    }
    fetchAllData();
  };

  const handleAddProjection = async (e) => {
    e.preventDefault();
    if (!projCardId || !projAmount) return;
    
    const targetMonth = `${projYear}-${projMonthNum}`;

    // Corregido: se remueve user_id ya que la tabla no lo requiere ni lo tiene
    const { error } = await supabase.from('card_statement_projections').insert([{
      card_id: projCardId,
      target_month: targetMonth,
      amount: parseFloat(projAmount),
      description: projDesc
    }]);

    if (error) {
      alert('⚠️ Error al guardar la proyección en Supabase: ' + error.message);
      return;
    }
    
    setProjAmount('');
    setProjDesc('');
    fetchAllData();
  };

  const handleDeleteProjection = async (id) => {
    const { error } = await supabase.from('card_statement_projections').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar proyección: ' + error.message);
      return;
    }
    fetchAllData();
  };

  const handleSaveSalaryConfig = async (e) => {
    e.preventDefault();
    const userId = session.user.id;
    const { data: existing } = await supabase.from('user_salary_config').select('id').eq('user_id', userId).maybeSingle();

    let error = null;
    if (existing) {
      const res = await supabase.from('user_salary_config').update({
        salary_amount: parseFloat(salaryAmount),
        frequency: salaryFreq,
        min_living_expense: parseFloat(minLiving)
      }).eq('user_id', userId);
      error = res.error;
    } else {
      const res = await supabase.from('user_salary_config').insert([{
        user_id: userId,
        salary_amount: parseFloat(salaryAmount),
        frequency: salaryFreq,
        min_living_expense: parseFloat(minLiving)
      }]);
      error = res.error;
    }

    if (error) {
      alert('Error al guardar configuración: ' + error.message);
      return;
    }

    alert('¡Configuración guardada con éxito!');
    fetchAllData();
  };

  const handleAddIncome = async (e) => {
    e.preventDefault();
    if (!incDesc || !incAmount || !incMonth) return;
    const { error } = await supabase.from('incomes').insert([{ 
      description: incDesc, 
      amount: parseFloat(incAmount), 
      target_month: incMonth,
      user_id: session.user.id 
    }]);
    if (error) {
      alert('Error al agregar ingreso: ' + error.message);
      return;
    }
    setIncDesc('');
    setIncAmount('');
    fetchAllData();
  };

  const handleDeleteIncome = async (id) => {
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar ingreso: ' + error.message);
      return;
    }
    fetchAllData();
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>🔄 Cargando sesión...</div>;

  if (!session) {
    return (
      <div style={{ fontFamily: 'sans-serif', maxWidth: '400px', margin: '80px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
        <h2 style={{ textAlign: 'center', color: '#2c3e50' }}>Gestión Financiera</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '10px' }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '10px' }} />
          <button type="submit" style={{ padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Gestión Financiera Personal</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>{session.user.email}</span>
          <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Cerrar Sesión</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #ddd', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('dashboard')} style={{ padding: '9px 16px', background: activeTab === 'dashboard' ? '#007bff' : '#f8f9fa', color: activeTab === 'dashboard' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📊 Dashboard & Optimizador</button>
        <button onClick={() => setActiveTab('cards')} style={{ padding: '9px 16px', background: activeTab === 'cards' ? '#007bff' : '#f8f9fa', color: activeTab === 'cards' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>💳 Tarjetas y Proyecciones</button>
        <button onClick={() => setActiveTab('debts')} style={{ padding: '9px 16px', background: activeTab === 'debts' ? '#007bff' : '#f8f9fa', color: activeTab === 'debts' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🤝 Control de Deudas</button>
        <button onClick={() => setActiveTab('config')} style={{ padding: '9px 16px', background: activeTab === 'config' ? '#007bff' : '#f8f9fa', color: activeTab === 'config' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>⚙️ Ingresos y Configuración</button>
      </div>

      <div>
        {activeTab === 'dashboard' && <SmartDebtOptimizer session={session} />}

        {activeTab === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <form onSubmit={handleAddCard} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <h4 style={{ width: '100%', margin: '0 0 5px 0', color: '#333' }}>Registrar Nueva Tarjeta</h4>
              <input type="text" placeholder="Nombre (ej. Nu, BBVA)" value={cardName} onChange={(e) => setCardName(e.target.value)} required style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="number" placeholder="Día de corte" value={cutoffDay} onChange={(e) => setCutoffDay(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="number" placeholder="Día de pago" value={dueDay} onChange={(e) => setDueDay(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <button type="submit" style={{ padding: '8px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Agregar Tarjeta</button>
            </form>

            <form onSubmit={handleAddProjection} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, color: '#333' }}>Registrar Estado de Cuenta Futuro / MSI</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Tarjeta</label>
                  <select value={projCardId} onChange={(e) => setProjCardId(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">Selecciona Tarjeta</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.card_name}</option>)}
                  </select>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Mes</label>
                  <select value={projMonthNum} onChange={(e) => setProjMonthNum(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
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
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Año</label>
                  <select value={projYear} onChange={(e) => setProjYear(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Monto ($)</label>
                  <input type="number" step="0.01" placeholder="Ej. 1500" value={projAmount} onChange={(e) => setProjAmount(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Descripción</label>
                <input type="text" placeholder="Ej. Mensualidad Laptop" value={projDesc} onChange={(e) => setProjDesc(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              
              <button type="submit" style={{ alignSelf: 'flex-end', padding: '8px 14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Registrar Proyección</button>
            </form>

            <div>
              <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>Tus Tarjetas (Haz clic para ver el detalle mes a mes)</h4>
              {cards.length === 0 ? <p style={{ color: '#666', fontSize: '13px' }}>No hay tarjetas registradas.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                  {cards.map(card => {
                    const cardProjections = projections.filter(p => p.card_id === card.id);
                    const totalCardDebt = cardProjections.reduce((sum, p) => sum + Number(p.amount), 0);
                    const isExpanded = expandedCardId === card.id;
                    const isEditing = editingCardId === card.id;

                    return (
                      <div 
                        key={card.id} 
                        style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => !isEditing && setExpandedCardId(isExpanded ? null : card.id)}
                      >
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                            <h4 style={{ margin: '0 0 2px 0', color: '#004085', fontSize: '15px' }}>✏️ Editar Tarjeta</h4>
                            <div>
                              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Nombre de Tarjeta</label>
                              <input 
                                type="text" 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)} 
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' }} 
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Día de Corte</label>
                                <input 
                                  type="number" 
                                  value={editCutoffDay} 
                                  onChange={(e) => setEditCutoffDay(e.target.value)} 
                                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' }} 
                                  placeholder="Ej. 18"
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Día de Pago</label>
                                <input 
                                  type="number" 
                                  value={editDueDay} 
                                  onChange={(e) => setEditDueDay(e.target.value)} 
                                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' }} 
                                  placeholder="Ej. 5"
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                              <button onClick={(e) => handleUpdateCard(card.id, e)} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Guardar Cambios</button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingCardId(null); }} style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h3 style={{ margin: '0 0 5px 0', color: '#004085', fontSize: '16px' }}>💳 {card.card_name}</h3>
                                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>
                                  {card.cutoff_day ? `Corte: Día ${card.cutoff_day}` : 'Corte: N/A'} | {card.payment_due_day ? `Pago: Día ${card.payment_due_day}` : 'Pago: N/A'}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#c0392b' }}>${totalCardDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                <div style={{ fontSize: '11px', color: '#888' }}>{isExpanded ? '▲ Ocultar' : '▼ Ver detalle'}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', borderTop: '1px solid #f1f1f1', paddingTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={(e) => startEditingCard(card, e)} style={{ background: '#ffc107', color: '#333', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✏️ Editar</button>
                              <button onClick={(e) => handleDeleteCard(card.id, cardProjections, e)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🗑️ Eliminar</button>
                            </div>
                          </>
                        )}

                        {isExpanded && !isEditing && (
                          <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                            <h5 style={{ margin: '0 0 8px 0', color: '#333', fontSize: '13px' }}>📅 Pagos futuros programados:</h5>
                            {cardProjections.length === 0 ? (
                              <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>No hay pagos futuros registrados para esta tarjeta.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {cardProjections.map(p => (
                                  <div key={p.id} style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px', border: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                    <div>
                                      <strong>{formatMonthName(p.target_month)}</strong>: {p.description || 'Sin descripción'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{ color: '#c0392b', fontWeight: 'bold' }}>${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                      <button onClick={() => handleDeleteProjection(p.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>X</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'debts' && <DebtManager session={session} />}

        {activeTab === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <form onSubmit={handleSaveSalaryConfig} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, color: '#333' }}>Configuración de Sueldo y Supervivencia</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input type="number" step="0.01" placeholder="Monto de Sueldo" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} required style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <select value={salaryFreq} onChange={(e) => setSalaryFreq(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
                <input type="number" step="0.01" placeholder="Colchón Intocable Mensual" value={minLiving} onChange={(e) => setMinLiving(e.target.value)} required style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <button type="submit" style={{ alignSelf: 'flex-end', padding: '8px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Configuración</button>
            </form>

            <form onSubmit={handleAddIncome} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <h4 style={{ width: '100%', margin: '0 0 5px 0', color: '#333' }}>Registrar Ingreso Extra (Único para un mes)</h4>
              <input type="text" placeholder="Descripción (ej. Creación de app)" value={incDesc} onChange={(e) => setIncDesc(e.target.value)} required style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="month" value={incMonth} onChange={(e) => setIncMonth(e.target.value)} required style={{ width: '150px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="number" step="0.01" placeholder="Monto ($)" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} required style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <button type="submit" style={{ padding: '8px 14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Agregar</button>
            </form>

            <div>
              <h4 style={{ color: '#2c3e50' }}>Ingresos Extras Registrados</h4>
              {incomes.length === 0 ? <p style={{ color: '#666', fontSize: '13px' }}>No hay ingresos extras registrados.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {incomes.map(i => (
                    <div key={i.id} style={{ background: '#fff', padding: '10px 15px', borderRadius: '6px', border: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{i.description}</strong> ({formatMonthName(i.target_month) || 'Sin mes'})
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>+${Number(i.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        <button onClick={() => handleDeleteIncome(i.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;