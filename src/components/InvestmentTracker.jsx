import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function InvestmentTracker({ session }) {
  const [investments, setInvestments] = useState([]);
  const [platform, setPlatform] = useState('Cetesdirecto');
  const [instrumentType, setInstrumentType] = useState('CETES');

  // Campos para Acción / ETF / Fibra
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  // Campos específicos para CETES
  const [cetesAmount, setCetesAmount] = useState('');
  const [cetesTermValue, setCetesTermValue] = useState('6');
  const [cetesTermUnit, setCetesTermUnit] = useState('meses'); // 'meses' | 'anos'
  const [cetesRate, setCetesRate] = useState('6.66');
  const [cetesStartDate, setCetesStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [cetesLabel, setCetesLabel] = useState('CETES');

  const [loadingPrice, setLoadingPrice] = useState(false);
  const [message, setMessage] = useState('');

  const isCetesMode = instrumentType === 'CETES';

  useEffect(() => {
    fetchInvestments();
  }, []);

  // Cuando el usuario elige CETES, sugiere la plataforma Cetesdirecto si estaba en otro valor inicial
  const handleInstrumentChange = (newType) => {
    setInstrumentType(newType);
    setMessage('');
    if (newType === 'CETES' && platform === 'GBM+') {
      setPlatform('Cetesdirecto');
    } else if (newType !== 'CETES' && platform === 'Cetesdirecto') {
      setPlatform('GBM+');
    }
  };

  async function fetchInvestments() {
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al cargar inversiones:', error.message);
    } else if (data) {
      setInvestments(data);
    }
  }

  // Serializa metadatos de CETES dentro de `notes` para que funcione sin requerir migraciones obligatorias
  const encodeCetesNotes = ({ termValue, termUnit, rate, startDate, maturityDate, label }) => {
    return JSON.stringify({
      kind: 'cetes',
      termValue: Number(termValue),
      termUnit,
      rate: Number(rate),
      startDate,
      maturityDate,
      label: label || 'CETES'
    });
  };

  const parseCetesMeta = (inv) => {
    if (inv.notes) {
      try {
        const parsed = typeof inv.notes === 'string' ? JSON.parse(inv.notes) : inv.notes;
        if (parsed && parsed.kind === 'cetes') return parsed;
      } catch {
        // Si no es JSON válido, continúa con respaldo
      }
    }
    if (inv.instrument_type === 'CETES' || String(inv.name || '').toUpperCase().includes('CETES')) {
      const startDate = (inv.created_at || new Date().toISOString()).slice(0, 10);
      return {
        kind: 'cetes',
        termValue: 6,
        termUnit: 'meses',
        rate: 6.66,
        startDate,
        maturityDate: computeMaturityDate(startDate, 6, 'meses'),
        label: inv.name || 'CETES'
      };
    }
    return null;
  };

  const computeMaturityDate = (startDateStr, termVal, termUnit) => {
    const [y, m, d] = (startDateStr || new Date().toISOString().slice(0, 10)).split('-').map(Number);
    const monthsToAdd = termUnit === 'anos' ? Number(termVal) * 12 : Number(termVal);
    const targetMonthIndex = (y * 12) + (m - 1) + monthsToAdd;
    const targetYear = Math.floor(targetMonthIndex / 12);
    const targetMonthZero = targetMonthIndex % 12;
    const maxDay = new Date(targetYear, targetMonthZero + 1, 0).getDate();
    const safeDay = Math.min(d || 1, maxDay);
    const dt = new Date(targetYear, targetMonthZero, safeDay);
    return dt.toISOString().slice(0, 10);
  };

  const getDaysRemaining = (maturityDateStr) => {
    if (!maturityDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = maturityDateStr.split('-').map(Number);
    const maturity = new Date(y, m - 1, d);
    maturity.setHours(0, 0, 0, 0);
    const diffMs = maturity.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const formatCountdown = (daysLeft) => {
    if (daysLeft <= 0) {
      return { text: '¡Listo para cobrar / Vencido!', urgent: true, ready: true };
    }
    if (daysLeft === 1) {
      return { text: 'Queda 1 día para cobrar', urgent: true, ready: false };
    }
    if (daysLeft < 30) {
      return { text: `Quedan ${daysLeft} días para cobrar`, urgent: true, ready: false };
    }
    const approxMonths = Math.floor(daysLeft / 30);
    const remDays = daysLeft % 30;
    const monthWord = approxMonths === 1 ? 'mes' : 'meses';
    const dayWord = remDays === 1 ? 'día' : 'días';
    const detail = remDays > 0 ? ` y ${remDays} ${dayWord}` : '';
    return { text: `Quedan ~${approxMonths} ${monthWord}${detail} (${daysLeft} días)`, urgent: false, ready: false };
  };

  const computeCetesProjection = (principal, ratePct, termVal, termUnit) => {
    const cap = Number(principal || 0);
    const rateDecimal = Number(ratePct || 0) / 100;
    const yearsFraction = termUnit === 'anos' ? Number(termVal || 0) : Number(termVal || 0) / 12;
    const grossInterest = cap * rateDecimal * yearsFraction;
    const maturityTotal = cap + grossInterest;
    return { grossInterest, maturityTotal };
  };

  // Función para consultar el precio real en vivo usando Twelve Data (acciones/fibras)
  const fetchCurrentMarketPrice = async (symbol) => {
    try {
      const apiKey = '008e523ad9c041cda78ed942a8ec50a5';
      const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data || !data.price) {
        return null;
      }

      return parseFloat(data.price);
    } catch (error) {
      console.error('Error al conectar con Twelve Data:', error);
      return null;
    }
  };

  const handleAddInvestment = async (e) => {
    e.preventDefault();
    setMessage('');

    if (isCetesMode) {
      const principal = parseFloat(cetesAmount);
      const termNum = parseFloat(cetesTermValue);
      const rateNum = parseFloat(cetesRate);

      if (!principal || principal <= 0 || !termNum || termNum <= 0 || isNaN(rateNum) || rateNum < 0) {
        setMessage('⚠️ Completa el monto, el plazo (en meses o años) y la tasa de interés de CETES.');
        return;
      }

      const maturityDate = computeMaturityDate(cetesStartDate, termNum, cetesTermUnit);
      const { maturityTotal } = computeCetesProjection(principal, rateNum, termNum, cetesTermUnit);
      const unitLabel = cetesTermUnit === 'anos'
        ? `${termNum} ${termNum === 1 ? 'año' : 'años'}`
        : `${termNum} ${termNum === 1 ? 'mes' : 'meses'}`;
      const displayName = `${(cetesLabel || 'CETES').trim()} (${unitLabel} @ ${rateNum}%)`;

      setLoadingPrice(true);
      const { error } = await supabase.from('investments').insert([{
        user_id: session.user.id,
        platform,
        instrument_type: 'CETES',
        name: displayName,
        invested_amount: principal,
        current_value: Number(maturityTotal.toFixed(2)),
        shares: termNum,
        purchase_price: principal,
        notes: encodeCetesNotes({
          termValue: termNum,
          termUnit: cetesTermUnit,
          rate: rateNum,
          startDate: cetesStartDate,
          maturityDate,
          label: (cetesLabel || 'CETES').trim()
        })
      }]);
      setLoadingPrice(false);

      if (error) {
        setMessage('❌ Error al guardar CETES en la base de datos: ' + error.message);
        return;
      }

      setCetesAmount('');
      setMessage(`✅ ¡CETES registrado! Vence el ${maturityDate} (estimado al vencimiento: $${maturityTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}).`);
      fetchInvestments();
      return;
    }

    if (!ticker || !shares || !purchasePrice) {
      setMessage('⚠️ Por favor llena todos los campos.');
      return;
    }

    setLoadingPrice(true);
    setMessage('🔍 Conectando con Twelve Data para obtener el precio real en vivo...');

    const cleanTicker = ticker.trim().toUpperCase();
    const currentMarketPrice = await fetchCurrentMarketPrice(cleanTicker);

    if (currentMarketPrice === null) {
      setLoadingPrice(false);
      setMessage(`❌ No se encontró el ticker "${cleanTicker}". Verifica que esté bien escrito (ej. FIBRAPL.MX, AAPL).`);
      return;
    }

    const qty = parseFloat(shares);
    const buyPrice = parseFloat(purchasePrice);
    const investedTotal = qty * buyPrice;
    const currentTotal = qty * currentMarketPrice;

    const { error } = await supabase.from('investments').insert([{
      user_id: session.user.id,
      platform,
      instrument_type: instrumentType,
      name: cleanTicker,
      invested_amount: investedTotal,
      current_value: currentTotal,
      shares: qty,
      purchase_price: buyPrice
    }]);

    setLoadingPrice(false);

    if (error) {
      setMessage('❌ Error al guardar en la base de datos: ' + error.message);
      return;
    }

    setTicker('');
    setShares('');
    setPurchasePrice('');
    setMessage(`✅ ¡Inversión registrada con éxito! Precio actual en mercado: $${currentMarketPrice}`);
    fetchInvestments();
  };

  const handleDeleteInvestment = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta inversión?')) return;
    const { error } = await supabase.from('investments').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
      return;
    }
    fetchInvestments();
  };

  const totalInvested = investments.reduce((sum, i) => sum + Number(i.invested_amount), 0);
  const totalCurrent = investments.reduce((sum, i) => sum + Number(i.current_value), 0);
  const totalProfit = totalCurrent - totalInvested;
  const totalPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Próximo vencimiento de CETES para mostrar en el resumen
  const cetesList = investments
    .map((inv) => {
      const meta = parseCetesMeta(inv);
      if (!meta) return null;
      const daysLeft = getDaysRemaining(meta.maturityDate);
      return { inv, meta, daysLeft };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const nextCetes = cetesList[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', fontFamily: 'sans-serif' }}>

      {/* Resumen Global */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>CAPITAL TOTAL INVERTIDO</p>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>${totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>VALOR ACTUAL / PROYECTADO</p>
          <h3 style={{ margin: 0, color: '#007bff' }}>${totalCurrent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>GANANCIA / RENDIMIENTO ESTIMADO</p>
          <h3 style={{ margin: 0, color: totalProfit >= 0 ? '#27ae60' : '#c0392b' }}>
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({totalPercentage.toFixed(2)}%)
          </h3>
        </div>
        {nextCetes && (
          <div style={{ background: '#fffbeb', padding: '15px', borderRadius: '8px', border: '1px solid #fcd34d' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#92400e', fontWeight: 'bold' }}>PRÓXIMO COBRO CETES</p>
            <h3 style={{ margin: '0 0 4px 0', color: '#b45309', fontSize: '16px' }}>
              {formatCountdown(nextCetes.daysLeft).text}
            </h3>
            <span style={{ fontSize: '11px', color: '#78350f' }}>
              {nextCetes.meta.label} • Vence {nextCetes.meta.maturityDate}
            </span>
          </div>
        )}
      </div>

      {/* Formulario */}
      <form onSubmit={handleAddInvestment} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>
          {isCetesMode ? '🏛️ Registrar Inversión en CETES (Monto, Plazo y Tasa)' : '📈 Registrar Inversión (Twelve Data Live)'}
        </h4>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Plataforma</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="Cetesdirecto">Cetesdirecto</option>
              <option value="GBM+">GBM+</option>
              <option value="Nu">Nu</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Tipo</label>
            <select value={instrumentType} onChange={(e) => handleInstrumentChange(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="CETES">CETES</option>
              <option value="Acción / ETF">Acción / ETF</option>
              <option value="Fibra">Fibra</option>
              <option value="Renta Fija">Renta Fija</option>
            </select>
          </div>

          {isCetesMode ? (
            <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Etiqueta / Referencia (opcional)</label>
              <input
                type="text"
                placeholder="Ej. CETES Reserva / Ahorro"
                value={cetesLabel}
                onChange={(e) => setCetesLabel(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
          ) : (
            <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Ticker / Símbolo (ej. FIBRAPL.MX, AAPL)</label>
              <input
                type="text"
                placeholder="Ej. FIBRAPL.MX"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase' }}
              />
            </div>
          )}
        </div>

        {isCetesMode ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Monto Invertido ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 10000"
                value={cetesAmount}
                onChange={(e) => setCetesAmount(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Plazo</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ej. 6"
                value={cetesTermValue}
                onChange={(e) => setCetesTermValue(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Unidad</label>
              <select
                value={cetesTermUnit}
                onChange={(e) => setCetesTermUnit(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="meses">Meses</option>
                <option value="anos">Años</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Interés Anual (%)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 6.66"
                value={cetesRate}
                onChange={(e) => setCetesRate(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Fecha de Inicio</label>
              <input
                type="date"
                value={cetesStartDate}
                onChange={(e) => setCetesStartDate(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Cantidad de Títulos / Acciones</label>
              <input
                type="number"
                step="any"
                placeholder="Ej. 10"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Precio de Compra Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 42.50"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
          </div>
        )}

        {message && (
          <div style={{ fontSize: '13px', padding: '8px', borderRadius: '4px', background: message.includes('❌') || message.includes('⚠️') ? '#f8d7da' : '#d4edda', color: message.includes('❌') || message.includes('⚠️') ? '#721c24' : '#155724' }}>
            {message}
          </div>
        )}

        <button type="submit" disabled={loadingPrice} style={{ alignSelf: 'flex-end', padding: '9px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
          {loadingPrice
            ? '🔄 Guardando...'
            : isCetesMode
              ? '+ Registrar Inversión CETES'
              : '+ Registrar con Precio en Vivo'}
        </button>
      </form>

      {/* Listado */}
      <div>
        <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>Portafolio Activo</h4>
        {investments.length === 0 ? (
          <p style={{ color: '#666', fontSize: '13px' }}>Aún no tienes inversiones registradas.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {investments.map((inv) => {
              const cetesMeta = parseCetesMeta(inv);

              if (cetesMeta) {
                const daysLeft = getDaysRemaining(cetesMeta.maturityDate);
                const countdown = formatCountdown(daysLeft);
                const { grossInterest, maturityTotal } = computeCetesProjection(
                  inv.invested_amount,
                  cetesMeta.rate,
                  cetesMeta.termValue,
                  cetesMeta.termUnit
                );
                const termText = cetesMeta.termUnit === 'anos'
                  ? `${cetesMeta.termValue} ${cetesMeta.termValue === 1 ? 'año' : 'años'}`
                  : `${cetesMeta.termValue} ${cetesMeta.termValue === 1 ? 'mes' : 'meses'}`;

                return (
                  <div key={inv.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                        {inv.platform} • CETES
                      </span>
                      <button onClick={() => handleDeleteInvestment(inv.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Eliminar</button>
                    </div>

                    <h3 style={{ margin: '5px 0 0 0', color: '#004085', fontSize: '16px' }}>🏛️ {cetesMeta.label}</h3>

                    <div style={{ background: countdown.urgent ? '#fef2f2' : '#eff6ff', border: `1px solid ${countdown.urgent ? '#fecaca' : '#bfdbfe'}`, color: countdown.urgent ? '#991b1b' : '#1e40af', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                      ⏳ {countdown.text}
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      Plazo: <strong>{termText}</strong> | Tasa: <strong>{cetesMeta.rate}% anual</strong> | Vence: <strong>{cetesMeta.maturityDate}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                      <span>Monto: <strong>${Number(inv.invested_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                      <span>Al vencer: <strong style={{ color: '#007bff' }}>${maturityTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                    </div>

                    <div style={{ borderTop: '1px solid #f1f1f1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Interés estimado:</span>
                      <strong style={{ color: '#27ae60' }}>+${grossInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                );
              }

              const profit = Number(inv.current_value) - Number(inv.invested_amount);
              const percent = Number(inv.invested_amount) > 0 ? (profit / Number(inv.invested_amount)) * 100 : 0;

              return (
                <div key={inv.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      {inv.platform} • {inv.instrument_type}
                    </span>
                    <button onClick={() => handleDeleteInvestment(inv.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Eliminar</button>
                  </div>

                  <h3 style={{ margin: '5px 0 0 0', color: '#004085', fontSize: '16px' }}>📈 {inv.name}</h3>

                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Títulos: <strong>{inv.shares}</strong> | Compra: <strong>${inv.purchase_price}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#555', marginTop: '5px' }}>
                    <span>Invertido: <strong>${Number(inv.invested_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                    <span>Actual: <strong style={{ color: '#007bff' }}>${Number(inv.current_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f1f1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>Rendimiento:</span>
                    <strong style={{ color: profit >= 0 ? '#27ae60' : '#c0392b' }}>
                      {profit >= 0 ? '+' : ''}${profit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({percent.toFixed(2)}%)
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}