import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const platformInstruments = {
  'GBM+': [
    'Acción / ETF', 
    'Fibra', 
    'Fondo de Inversión (Smart Cash)', 
    'Efectivo / Cash (Disponible)'
  ],
  'Nu': [
    'Cajita de Ahorro', 
    'Cuenta Principal (Disponible)'
  ],
  'Cetesdirecto': [
    'CETES (28 días)', 
    'CETES (91 días)', 
    'CETES (182 días)', 
    'CETES (364/728 días)', 
    'Bonddia (Liquidez diaria)', 
    'Bonos / Udibonos'
  ],
  'Otro': [
    'Acción / ETF', 
    'Renta Fija', 
    'Criptomoneda', 
    'Otro'
  ]
};

export default function InvestmentTracker({ session }) {
  const [investments, setInvestments] = useState([]);
  const [platform, setPlatform] = useState('GBM+');
  const [instrumentType, setInstrumentType] = useState(platformInstruments['GBM+'][0]);
  
  // Nombre o identificador común
  const [name, setName] = useState('');
  
  // Campos específicos para Renta Variable (Acciones, Fibras, Cripto)
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentMarketPrice, setCurrentMarketPrice] = useState(''); 

  // Campos específicos para Renta Fija / Ahorro (Cajitas, Cetes, Smart Cash)
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentValue, setCurrentValue] = useState('');

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

  const handlePlatformChange = (e) => {
    const newPlatform = e.target.value;
    setPlatform(newPlatform);
    setInstrumentType(platformInstruments[newPlatform][0]);
  };

  // Detectar automáticamente si el instrumento es de renta variable o bursátil
  const isVariableIncome = [
    'Acción / ETF', 
    'Fibra', 
    'Criptomoneda', 
    'Otro'
  ].includes(instrumentType);

  const handleAddInvestment = async (e) => {
    e.preventDefault();
    setMessage('');

    let finalInvested = 0;
    let finalCurrent = 0;
    let finalShares = null;
    let finalBuyPrice = null;
    const cleanName = name.trim().toUpperCase();

    if (!cleanName) {
      setMessage('⚠️ Por favor ingresa el nombre o identificador del activo.');
      return;
    }

    if (isVariableIncome) {
      if (!shares || !purchasePrice || !currentMarketPrice) {
        setMessage('⚠️ Por favor completa todos los campos de acciones/títulos.');
        return;
      }
      finalShares = parseFloat(shares);
      finalBuyPrice = parseFloat(purchasePrice);
      const livePrice = parseFloat(currentMarketPrice);

      finalInvested = finalShares * finalBuyPrice;
      finalCurrent = finalShares * livePrice;
    } else {
      if (!investedAmount || !currentValue) {
        setMessage('⚠️ Por favor completa el monto invertido y el valor actual.');
        return;
      }
      finalInvested = parseFloat(investedAmount);
      finalCurrent = parseFloat(currentValue);
    }

    const { error } = await supabase.from('investments').insert([{
      user_id: session.user.id,
      platform,
      instrument_type: instrumentType,
      name: cleanName,
      invested_amount: finalInvested,
      current_value: finalCurrent,
      shares: finalShares,
      purchase_price: finalBuyPrice
    }]);

    if (error) {
      setMessage('❌ Error al guardar en la base de datos: ' + error.message);
      return;
    }

    // Limpiar formulario
    setName('');
    setShares('');
    setPurchasePrice('');
    setCurrentMarketPrice('');
    setInvestedAmount('');
    setCurrentValue('');
    setMessage('✅ ¡Inversión registrada con éxito!');
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
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>VALOR ACTUAL DEL PORTAFOLIO</p>
          <h3 style={{ margin: 0, color: '#007bff' }}>${totalCurrent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>GANANCIA / PÉRDIDA NETA</p>
          <h3 style={{ margin: 0, color: totalProfit >= 0 ? '#27ae60' : '#c0392b' }}>
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({totalPercentage.toFixed(2)}%)
          </h3>
        </div>
      </div>

      {/* Formulario Dinámico Inteligente */}
      <form onSubmit={handleAddInvestment} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>📈 Registrar Inversión</h4>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Plataforma */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Plataforma</label>
            <select value={platform} onChange={handlePlatformChange} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="GBM+">GBM+</option>
              <option value="Nu">Nu</option>
              <option value="Cetesdirecto">Cetesdirecto</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          {/* Tipo de Instrumento */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Tipo de Instrumento</label>
            <select value={instrumentType} onChange={(e) => setInstrumentType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              {platformInstruments[platform].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Nombre / Ticker */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>
              {isVariableIncome ? 'Ticker del Activo (Ej. AAPL, FIBRAPL.MX)' : 'Nombre / Referencia (Ej. Cajita Viaje, CETES 28)'}
            </label>
            <input 
              type="text" 
              placeholder={isVariableIncome ? "Ej. TSLA" : "Ej. Cajita Emergencia"} 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase' }} 
            />
          </div>
        </div>

        {/* CAMPOS CONDICIONALES SEGÚN EL INSTRUMENTO */}
        {isVariableIncome ? (
          /* Inputs para Acciones, ETFs, Fibras */
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Número de Títulos / Acciones</label>
              <input type="number" step="any" placeholder="Ej. 15" value={shares} onChange={(e) => setShares(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Precio de Compra Unitario ($)</label>
              <input type="number" step="0.01" placeholder="Ej. 150.50" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Precio Actual en Mercado ($)</label>
              <input type="number" step="0.01" placeholder="Ej. 165.00" value={currentMarketPrice} onChange={(e) => setCurrentMarketPrice(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
          </div>
        ) : (
          /* Inputs para Cajitas, Cetes, Smart Cash, Efectivo */
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Monto Total Invertido / Principal ($)</label>
              <input type="number" step="0.01" placeholder="Ej. 5000.00" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Valor Actual / Saldo con Rendimientos ($)</label>
              <input type="number" step="0.01" placeholder="Ej. 5150.00" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
          </div>
        )}

        {message && (
          <div style={{ fontSize: '13px', padding: '8px', borderRadius: '4px', background: message.includes('❌') || message.includes('⚠️') ? '#f8d7da' : '#d4edda', color: message.includes('❌') || message.includes('⚠️') ? '#721c24' : '#155724' }}>
            {message}
          </div>
        )}

        <button type="submit" style={{ alignSelf: 'flex-end', padding: '9px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Registrar Inversión
        </button>
      </form>

      {/* Listado de Inversiones */}
      <div>
        <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>Portafolio Activo</h4>
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
                  
                  <h3 style={{ margin: '5px 0 0 0', color: '#004085', fontSize: '16px' }}>💼 {inv.name}</h3>
                  
                  {inv.shares ? (
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Títulos: <strong>{inv.shares}</strong> | Costo Unitario: <strong>${inv.purchase_price}</strong>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Tipo: <strong>Renta Fija / Efectivo</strong>
                    </div>
                  )}

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