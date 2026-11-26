import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import SmartDebtOptimizer from './components/SmartDebtOptimizer';
import DebtManager from './components/DebtManager';
import InvestmentTracker from './components/InvestmentTracker';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const [cards, setCards] = useState([]);
  const [cardName, setCardName] = useState('');
  const [cutoffDay, setCutoffDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  const [editingCardId, setEditingCardId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCutoffDay, setEditCutoffDay] = useState('');
  const [editDueDay, setEditDueDay] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');

  const [uploadingExcel, setUploadingExcel] = useState(false);

  const [projections, setProjections] = useState([]);
  const [projCardId, setProjCardId] = useState('');

  const currentYear = new Date().getFullYear();
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
  const [projMonthNum, setProjMonthNum] = useState(currentMonthNum);
  const [projYear, setProjYear] = useState(String(currentYear));

  const [projAmount, setProjAmount] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const [expandedCardId, setExpandedCardId] = useState(null);
  // Guarda qué mes ("cardId-YYYY-MM") tiene desplegado su desglose individual
  const [expandedMonthKey, setExpandedMonthKey] = useState(null);

  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryFreq, setSalaryFreq] = useState('quincenal');
  const [minLiving, setMinLiving] = useState('');

  const [incomes, setIncomes] = useState([]);
  const [incDesc, setIncDesc] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incMonth, setIncMonth] = useState(new Date().toISOString().slice(0, 7));

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatMonthName = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    if (!year || !month) return dateStr;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${capitalizedMonth} ${year}`;
  };

  // Formatea la fecha límite de pago para el mes YYYY-MM usando payment_due_day de la tarjeta
  const formatDueDateLabel = (targetMonth, dueDayNum) => {
    if (!dueDayNum || !targetMonth) return null;
    const [year, month] = targetMonth.split('-').map(Number);
    if (!year || !month) return null;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const clampedDay = Math.min(parseInt(dueDayNum, 10), lastDayOfMonth);
    const dateObj = new Date(year, month - 1, clampedDay);
    const monthShort = dateObj.toLocaleString('es-ES', { month: 'short' }).replace('.', '');
    return `Vence ${String(clampedDay).padStart(2, '0')} ${monthShort}`;
  };

  // Agrupa los cargos de una tarjeta por mes (target_month) y calcula la sumatoria del mes
  const groupProjectionsByMonth = (cardProjections) => {
    const map = new Map();
    cardProjections.forEach((p) => {
      const key = p.target_month || 'Sin mes';
      if (!map.has(key)) {
        map.set(key, {
          target_month: key,
          total: 0,
          items: []
        });
      }
      const bucket = map.get(key);
      bucket.total = Number((bucket.total + Number(p.amount || 0)).toFixed(2));
      bucket.items.push(p);
    });
    return Array.from(map.values()).sort((a, b) => a.target_month.localeCompare(b.target_month));
  };

  const getSafeSheetName = (name, existingNames = []) => {
    let clean = (name || 'Tarjeta')
      .replace(/[\\/?*[\]:]/g, '')
      .trim()
      .slice(0, 28);
    if (!clean) clean = 'Tarjeta';
    let candidate = clean;
    let counter = 2;
    while (existingNames.includes(candidate.toLowerCase())) {
      candidate = `${clean.slice(0, 25)}_${counter}`;
      counter++;
    }
    existingNames.push(candidate.toLowerCase());
    return candidate;
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

  const handleDownloadExcelTemplate = () => {
    if (cards.length === 0) {
      alert('Primero registra al menos una tarjeta en "Registrar Nueva Tarjeta" antes de generar la plantilla.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const usedSheetNames = ['instrucciones'];

    const instructionsRows = [
      ['PLANTILLA DE CARGA MASIVA DE ESTADOS DE CUENTA / MESES FUTUROS'],
      [''],
      ['⚠️ AVISO IMPORTANTE:'],
      ['1. Esta plantilla se genera únicamente con las tarjetas que tienes registradas en este momento.'],
      ['2. Si te falta alguna tarjeta o te sobra alguna, créala o elimínala primero en la pantalla antes de descargar la plantilla.'],
      ['3. No cambies el nombre de cada pestaña: el sistema usa el nombre de la pestaña para saber a qué tarjeta pertenece cada fila.'],
      ['4. Llena solo los meses donde tengas monto a pagar (las filas con monto vacío o 0 se ignorarán).'],
      ['5. El Mes debe ir en formato YYYY-MM (ej. 2026-12) y Estado puede ser "pendiente" o "pagado".'],
      [''],
      ['TARJETAS INCLUIDAS:'],
      ...cards.map((c, idx) => [
        `${idx + 1}. ${c.card_name} | Corte: Día ${c.cutoff_day || 'N/A'} | Pago: Día ${c.payment_due_day || 'N/A'}${c.credit_limit ? ` | Límite: $${fmt(c.credit_limit)}` : ''}`
      ])
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsRows);
    wsInstructions['!cols'] = [{ wch: 95 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'INSTRUCCIONES');

    const now = new Date();
    const baseYear = now.getFullYear();
    const baseMonth = now.getMonth();
    const next12Months = Array.from({ length: 12 }, (_, i) => {
      const total = baseYear * 12 + baseMonth + i;
      const y = Math.floor(total / 12);
      const m = String((total % 12) + 1).padStart(2, '0');
      return `${y}-${m}`;
    });

    cards.forEach((card) => {
      const sheetName = getSafeSheetName(card.card_name, usedSheetNames);
      const sheetRows = [
        [
          `TARJETA: ${card.card_name}`,
          `Corte: Día ${card.cutoff_day || 'N/A'}`,
          `Pago: Día ${card.payment_due_day || 'N/A'}`
        ],
        ['NOTA: No renombres esta pestaña. Deja en blanco o 0 los meses sin cargo.'],
        [],
        ['Mes (YYYY-MM)', 'Monto ($)', 'Descripción', 'Estado (pendiente/pagado)'],
        ...next12Months.map((ym) => [ym, '', '', 'pendiente'])
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 36 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `Plantilla_Tarjetas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleUploadExcelTemplate = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingExcel(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const usedSheetNames = ['instrucciones'];
      const sheetToCardMap = {};
      cards.forEach((card) => {
        const safeName = getSafeSheetName(card.card_name, usedSheetNames).toLowerCase();
        sheetToCardMap[safeName] = card;
        sheetToCardMap[card.card_name.trim().toLowerCase()] = card;
      });

      const rowsToInsert = [];
      const unmatchedSheets = [];

      wb.SheetNames.forEach((sheetName) => {
        if (sheetName.trim().toLowerCase() === 'instrucciones') return;

        const targetCard = sheetToCardMap[sheetName.trim().toLowerCase()];
        if (!targetCard) {
          unmatchedSheets.push(sheetName);
          return;
        }

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let headerIdx = rows.findIndex((r) => String(r[0] || '').toLowerCase().includes('mes'));
        if (headerIdx === -1) headerIdx = 3;

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let monthVal = String(row[0] || '').trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(monthVal)) {
            monthVal = monthVal.slice(0, 7);
          } else if (/^\d+$/.test(monthVal)) {
            const parsed = XLSX.SSF.parse_date_code(Number(monthVal));
            if (parsed) {
              monthVal = `${parsed.y}-${String(parsed.m).padStart(2, '0')}`;
            }
          }

          const amtVal = parseFloat(String(row[1] || '').replace(/[$,]/g, ''));
          const descVal = String(row[2] || '').trim();

          if (!/^\d{4}-\d{2}$/.test(monthVal)) continue;
          if (isNaN(amtVal) || amtVal <= 0) continue;

          rowsToInsert.push({
            card_id: targetCard.id,
            target_month: monthVal,
            amount: amtVal,
            description: descVal || `Cargo ${monthVal}`
          });
        }
      });

      if (rowsToInsert.length === 0) {
        alert(
          'No se encontraron filas con monto mayor a 0 para importar.' +
          (unmatchedSheets.length > 0 ? `\nPestañas sin tarjeta coincidente: ${unmatchedSheets.join(', ')}` : '')
        );
        return;
      }

      const { error } = await supabase.from('card_statement_projections').insert(rowsToInsert);
      if (error) {
        alert('Error al guardar en Supabase: ' + error.message);
      } else {
        await fetchAllData();
        let message = `✅ Se cargaron ${rowsToInsert.length} registros correctamente por pestaña de tarjeta.`;
        if (unmatchedSheets.length > 0) {
          message += `\n⚠️ Pestañas omitidas por no coincidir con tarjetas registradas: ${unmatchedSheets.join(', ')}`;
        }
        alert(message);
      }
    } catch (err) {
      alert('Error al procesar el archivo Excel: ' + err.message);
    } finally {
      setUploadingExcel(false);
      e.target.value = '';
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMessage('');

    if (!email || !email.trim()) {
      setAuthMessage('⚠️ Por favor, ingresa tu correo electrónico.');
      return;
    }
    if (!password || !password.trim()) {
      setAuthMessage('⚠️ Por favor, ingresa tu contraseña.');
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthMessage('❌ Error al registrarse: ' + error.message);
      } else {
        setEmail('');
        setPassword('');
        setIsSignUp(false);
        setAuthMessage('✅ ¡Cuenta creada con éxito! Por favor inicia sesión con tus datos.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMessage('❌ Error al iniciar sesión: ' + error.message);
      }
    }
  };

  const handleForgotPassword = async () => {
    setAuthMessage('');
    if (!email || !email.trim()) {
      setAuthMessage('⚠️ Por favor, escribe primero tu correo electrónico en la casilla de arriba para enviarte las instrucciones.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setAuthMessage('❌ Error: ' + error.message);
    } else {
      setAuthMessage('✅ ¡Correo enviado con éxito! Revisa tu bandeja de entrada y spam.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!cardName) return;

    const payload = {
      card_name: cardName.trim(),
      cutoff_day: cutoffDay ? parseInt(cutoffDay, 10) : null,
      payment_due_day: dueDay ? parseInt(dueDay, 10) : null,
      user_id: session.user.id
    };
    if (creditLimit !== '') {
      payload.credit_limit = parseFloat(creditLimit);
    }

    const { error } = await supabase.from('credit_cards').insert([payload]);
    if (error) {
      alert('Error al crear tarjeta: ' + error.message);
      return;
    }
    setCardName('');
    setCutoffDay('');
    setDueDay('');
    setCreditLimit('');
    fetchAllData();
  };

  const startEditingCard = (card, e) => {
    e.stopPropagation();
    setEditingCardId(card.id);
    setEditName(card.card_name ?? '');
    setEditCutoffDay(card.cutoff_day ?? '');
    setEditDueDay(card.payment_due_day ?? '');
    setEditCreditLimit(card.credit_limit ?? '');
  };

  const handleUpdateCard = async (cardId, e) => {
    e.stopPropagation();
    if (!editName.trim()) return;

    const updatePayload = {
      card_name: editName.trim(),
      cutoff_day: editCutoffDay === '' ? null : parseInt(editCutoffDay, 10),
      payment_due_day: editDueDay === '' ? null : parseInt(editDueDay, 10)
    };
    if (editCreditLimit !== '') {
      updatePayload.credit_limit = parseFloat(editCreditLimit);
    }

    const { error } = await supabase
      .from('credit_cards')
      .update(updatePayload)
      .eq('id', cardId);

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
      <div style={{ fontFamily: 'sans-serif', maxWidth: '400px', margin: '80px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '20px' }}>
          {isSignUp ? 'Crear Cuenta Financiera' : 'Iniciar Sesión'}
        </h2>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            style={{ padding: '10px', background: isSignUp ? '#28a745' : '#007bff', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
          >
            {isSignUp ? 'Registrarse' : 'Entrar'}
          </button>
        </form>

        {authMessage && (
          <div style={{
            color: authMessage.includes('✅') ? '#155724' : '#721c24',
            background: authMessage.includes('✅') ? '#d4edda' : '#f8d7da',
            border: `1px solid ${authMessage.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
            fontSize: '13px',
            textAlign: 'center',
            marginTop: '12px',
            padding: '10px',
            borderRadius: '4px'
          }}>
            {authMessage}
          </div>
        )}

        {!isSignUp && (
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setAuthMessage(''); }}
          style={{ width: '100%', padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
        >
          {isSignUp ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿No tienes cuenta? Crear una cuenta'}
        </button>
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
        <button onClick={() => setActiveTab('investments')} style={{ padding: '9px 16px', background: activeTab === 'investments' ? '#007bff' : '#f8f9fa', color: activeTab === 'investments' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📈 Inversiones</button>
        <button onClick={() => setActiveTab('config')} style={{ padding: '9px 16px', background: activeTab === 'config' ? '#007bff' : '#f8f9fa', color: activeTab === 'config' ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>⚙️ Ingresos y Configuración</button>
      </div>

      <div>
        {activeTab === 'dashboard' && <SmartDebtOptimizer session={session} />}

        {activeTab === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <form onSubmit={handleAddCard} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <h4 style={{ width: '100%', margin: '0 0 5px 0', color: '#333' }}>Registrar Nueva Tarjeta</h4>
              <input type="text" placeholder="Nombre (ej. Nu, BBVA)" value={cardName} onChange={(e) => setCardName(e.target.value)} required style={{ flex: 2, minWidth: '160px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="number" placeholder="Día de corte" value={cutoffDay} onChange={(e) => setCutoffDay(e.target.value)} style={{ flex: 1, minWidth: '110px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="number" placeholder="Día de pago" value={dueDay} onChange={(e) => setDueDay(e.target.value)} style={{ flex: 1, minWidth: '110px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="number" step="0.01" placeholder="Límite / Monto ($)" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} style={{ flex: 1, minWidth: '130px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <button type="submit" style={{ padding: '8px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Agregar Tarjeta</button>
            </form>

            {/* PLANTILLA EXCEL POR PESTAÑA DE TARJETA */}
            <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, color: '#166534' }}>📊 Plantilla Excel por Tarjeta (Carga Masiva de Meses)</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#14532d', background: '#dcfce7', padding: '8px 10px', borderRadius: '5px' }}>
                <strong>Nota:</strong> Esta plantilla se genera con las <strong>{cards.length}</strong> tarjeta{cards.length === 1 ? '' : 's'} que tienes registradas actualmente. Si te falta o te sobra alguna tarjeta, créala o elimínala primero antes de descargar la plantilla. Al subirla, leerá cada pestaña y guardará los cargos en la tarjeta correspondiente.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  style={{ padding: '8px 14px', background: '#15803d', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  ⬇️ Descargar Plantilla ({cards.length} pestaña{cards.length === 1 ? '' : 's'})
                </button>

                <label style={{ padding: '8px 14px', background: '#0369a1', color: '#fff', borderRadius: '4px', fontWeight: 'bold', cursor: uploadingExcel ? 'wait' : 'pointer', fontSize: '13px', display: 'inline-block' }}>
                  {uploadingExcel ? '⏳ Leyendo Excel...' : '⬆️ Subir Plantilla Llena (.xlsx)'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleUploadExcelTemplate}
                    disabled={uploadingExcel}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

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
              <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>Tus Tarjetas (Haz clic para ver el resumen por fecha de pago)</h4>
              {cards.length === 0 ? <p style={{ color: '#666', fontSize: '13px' }}>No hay tarjetas registradas.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                  {cards.map(card => {
                    const cardProjections = projections.filter(p => p.card_id === card.id);
                    const totalCardDebt = cardProjections.reduce((sum, p) => sum + Number(p.amount), 0);
                    const isExpanded = expandedCardId === card.id;
                    const isEditing = editingCardId === card.id;
                    const groupedMonths = groupProjectionsByMonth(cardProjections);

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
                            <div>
                              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Límite / Monto ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editCreditLimit}
                                onChange={(e) => setEditCreditLimit(e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' }}
                                placeholder="Ej. 25000"
                              />
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
                                  {card.credit_limit ? ` | Límite: $${fmt(card.credit_limit)}` : ''}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#c0392b' }}>${Number(totalCardDebt).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
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
                            <h5 style={{ margin: '0 0 8px 0', color: '#333', fontSize: '13px' }}>📅 Totales por mes y fecha de pago:</h5>
                            {groupedMonths.length === 0 ? (
                              <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>No hay pagos futuros registrados para esta tarjeta.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {groupedMonths.map((bucket) => {
                                  const monthKey = `${card.id}-${bucket.target_month}`;
                                  const isMonthOpen = expandedMonthKey === monthKey;
                                  const dueLabel = formatDueDateLabel(bucket.target_month, card.payment_due_day);

                                  return (
                                    <div key={bucket.target_month} style={{ background: '#f8f9fa', padding: '10px', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <div>
                                          <strong style={{ fontSize: '13px', color: '#1e293b' }}>{formatMonthName(bucket.target_month)}</strong>
                                          {dueLabel && (
                                            <span style={{ marginLeft: '8px', fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                              {dueLabel}
                                            </span>
                                          )}
                                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                            {bucket.items.length} concepto{bucket.items.length === 1 ? '' : 's'}
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ color: '#c0392b', fontWeight: 'bold', fontSize: '13px' }}>
                                            ${Number(bucket.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setExpandedMonthKey(isMonthOpen ? null : monthKey)}
                                            style={{
                                              background: isMonthOpen ? '#0f172a' : '#0284c7',
                                              color: '#fff',
                                              border: 'none',
                                              padding: '4px 8px',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontSize: '11px',
                                              fontWeight: 'bold'
                                            }}
                                          >
                                            {isMonthOpen ? '▲ Ocultar detalle' : '🔍 Ver desglose'}
                                          </button>
                                        </div>
                                      </div>

                                      {isMonthOpen && (
                                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                          {bucket.items.map((p) => (
                                            <div key={p.id} style={{ background: '#ffffff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                              <span style={{ color: '#334155', paddingRight: '8px' }}>{p.description || 'Sin descripción'}</span>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                <strong style={{ color: '#b91c1c' }}>${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                <button onClick={() => handleDeleteProjection(p.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>X</button>
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

        {activeTab === 'investments' && <InvestmentTracker session={session} />}

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