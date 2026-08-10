import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function InvestmentTracker({ session }) {
  const [investments, setInvestments] = useState([]);
  const [platform, setPlatform] = useState('GBM+');
  const [instrumentType, setInstrumentType] = useState('Smart Cash');
  const [name, setName] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentValue, setCurrentValue] = useState('');

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

  const handleAddInvestment = async (e) => {
    e.preventDefault();
    if (!name || !investedAmount || !currentValue) return;

    const { error } = await supabase.from('investments').insert([{
      user_id: session.user.id,
      platform,
      instrument_type: instrumentType,
      name,
      invested_amount: parseFloat(investedAmount),
      current_value: parseFloat(currentValue)
    }]);

    if (error) {
      alert('Error al guardar inversión: ' + error.message);
      return;
    }

    setName('');
    setInvestedAmount('');
    setCurrentValue('');
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

  // Cálculos globales del portafolio
  const totalInvested = investments.reduce((sum, i) => sum + Number(i.invested_amount), 0);
  const totalCurrent = investments.reduce((sum, i) => sum + Number(i.current_value), 0);
  const totalProfit = totalCurrent - totalInvested;
  const totalPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', fontFamily: 'sans-serif' }}>
      
      {/* Resumen Global de Inversiones */}
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

      {/* Formulario para Registrar Inversión */}
      <form onSubmit={handleAddInvestment} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>📈 Registrar Nueva Inversión / Ahorro</h4>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Plataforma</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="GBM+">GBM+</option>
              <option value="Nu">Nu (Cajita)</option>
              <option value="Cetesdirecto">Cetesdirecto</option>
              <option value="Fintual">Fintual</option>
              <option value="Kuspit">Kuspit</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Tipo de Instrumento</label>
            <select value={instrumentType} onChange={(e) => setInstrumentType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="Smart Cash">Smart Cash / Efectivo</option>
              <option value="Smart Cash Dólares">Smart Cash Dólares</option>
              <option value="Renta Fija / Cajita">Renta Fija / Cajita</option>
              <option value="CETES">CETES</option>
              <option value="Fibras">Fibras (Bienes Raíces)</option>
              <option value="ETF">ETF (Fondos Indexados)</option>
              <option value="Acción">Acción Individual</option>
            </select>
          </div>

          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Nombre / Ticker (ej. FIBRAPL 14, AAPL, Cetes 28d)</label>
            <input type="text" placeholder="Ej. FIBRAHQ o Cajita Ahorro" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Monto Invertido Original ($)</label>
            <input type="number" step="0.01" placeholder="Ej. 5000" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Valor Actual en la App ($)</label>
            <input type="number" step="0.01" placeholder="Ej. 5350" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          </div>
        </div>

        <button type="submit" style={{ alignSelf: 'flex-end', padding: '9px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Agregar Inversión</button>
      </form>

      {/* Listado de Inversiones Registradas */}
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
                  
                  <h3 style={{ margin: '5px 0 0 0', color: '#004085', fontSize: '16px' }}>{inv.name}</h3>
                  
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