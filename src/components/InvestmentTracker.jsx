import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function InvestmentTracker({ session }) {
  const [investments, setInvestments] = useState([]);
  const [platform, setPlatform] = useState('GBM+');
  const [instrumentType, setInstrumentType] = useState('Acción / ETF');
  const [ticker, setTicker] = useState(''); // Ej: FIBRAPL.MX, AAPL
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchInvestments();
  }, []);

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

  // Función para consultar el precio real en vivo usando Twelve Data
  const fetchCurrentMarketPrice = async (symbol) => {
    if (symbol === 'CETES') return 10.00;

    try {
      // Reemplaza 'TU_API_KEY_DE_TWELVE_DATA' con la llave gratuita que te dieron en su plataforma
      const apiKey = '008e523ad9c041cda78ed942a8ec50a5'; 
      const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      // Twelve Data regresa un JSON con el precio directamente, ej: { "price": "45.50" }
      if (!data || !data.price) {
        return null; // Ticker no encontrado o error en la API
      }
      
      return parseFloat(data.price);
    } catch (error) {
      console.error("Error al conectar con Twelve Data:", error);
      return null;
    }
  };

  const handleAddInvestment = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!ticker || !shares || !purchasePrice) {
      setMessage('⚠️ Por favor llena todos los campos.');
      return;
    }

    setLoadingPrice(true);
    setMessage('🔍 Conectando con Twelve Data para obtener el precio real en vivo...');

    const cleanTicker = ticker.trim().toUpperCase();
    
    // 1. Buscamos el precio real en la API de Twelve Data
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

    // 2. Guardamos en Supabase con el precio actual ya automatizado
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', fontFamily: 'sans-serif' }}>
      
      {/* Resumen Global */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>CAPITAL TOTAL INVERTIDO</p>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>${totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>VALOR ACTUAL EN VIVO</p>
          <h3 style={{ margin: 0, color: '#007bff' }}>${totalCurrent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>GANANCIA / PÉRDIDA NETA</p>
          <h3 style={{ margin: 0, color: totalProfit >= 0 ? '#27ae60' : '#c0392b' }}>
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({totalPercentage.toFixed(2)}%)
          </h3>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleAddInvestment} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>📈 Registrar Inversión (Twelve Data Live)</h4>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Plataforma</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="GBM+">GBM+</option>
              <option value="Nu">Nu</option>
              <option value="Cetesdirecto">Cetesdirecto</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Tipo</label>
            <select value={instrumentType} onChange={(e) => setInstrumentType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="Acción / ETF">Acción / ETF</option>
              <option value="Fibra">Fibra</option>
              <option value="Renta Fija">Renta Fija</option>
            </select>
          </div>

          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Ticker / Símbolo (ej. FIBRAPL.MX, AAPL)</label>
            <input type="text" placeholder="Ej. FIBRAPL.MX" value={ticker} onChange={(e) => setTicker(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Cantidad de Títulos / Acciones</label>
            <input type="number" step="any" placeholder="Ej. 10" value={shares} onChange={(e) => setShares(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Precio de Compra Unitario ($)</label>
            <input type="number" step="0.01" placeholder="Ej. 42.50" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>
        </div>

        {message && (
          <div style={{ fontSize: '13px', padding: '8px', borderRadius: '4px', background: message.includes('❌') || message.includes('⚠️') ? '#f8d7da' : '#d4edda', color: message.includes('❌') || message.includes('⚠️') ? '#721c24' : '#155724' }}>
            {message}
          </div>
        )}

        <button type="submit" disabled={loadingPrice} style={{ alignSelf: 'flex-end', padding: '9px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
          {loadingPrice ? '🔄 Consultando Bolsa...' : '+ Registrar con Precio en Vivo'}
        </button>
      </form>

      {/* Listado */}
      <div>
        <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>Portafolio Activo en Tiempo Real</h4>
        {investments.length === 0 ? (
          <p style={{ color: '#666', fontSize: '13px' }}>Aún no tienes inversiones registradas.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {investments.map(inv => {
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