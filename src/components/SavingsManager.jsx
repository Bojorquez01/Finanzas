import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function SavingsManager({ session }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('ahorro');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [depositAmounts, setDepositAmounts] = useState({});

  useEffect(() => {
    fetchItems();
  }, [session]);

  async function fetchItems() {
    const { data, error } = await supabase
      .from('savings_investments')
      .select('*')
      .order('id', { ascending: false });

    if (!error) setItems(data || []);
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const { error } = await supabase.from('savings_investments').insert([{
      name: name.trim(),
      type: type,
      current_amount: parseFloat(currentAmount) || 0,
      target_amount: parseFloat(targetAmount) || 0
    }]);

    if (!error) {
      setName('');
      setCurrentAmount('');
      setTargetAmount('');
      fetchItems();
    }
  };

  const handleAddFunds = async (id, currentVal) => {
    const addVal = parseFloat(depositAmounts[id]);
    if (!addVal || addVal <= 0) return;

    const newTotal = Number(currentVal) + addVal;
    const { error } = await supabase
      .from('savings_investments')
      .update({ current_amount: newTotal })
      .eq('id', id);

    if (!error) {
      setDepositAmounts({ ...depositAmounts, [id]: '' });
      fetchItems();
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('savings_investments').delete().eq('id', id);
    if (!error) fetchItems();
  };

  const totalSavings = items.filter(i => i.type === 'ahorro').reduce((acc, curr) => acc + Number(curr.current_amount), 0);
  const totalInvestments = items.filter(i => i.type === 'inversion').reduce((acc, curr) => acc + Number(curr.current_amount), 0);

  return (
    <div style={{ marginTop: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>
        Ahorros e Inversiones 
        <span style={{ fontSize: '14px', float: 'right', color: '#007bff' }}>
          Ahorros: ${totalSavings.toFixed(2)} | Inversiones: ${totalInvestments.toFixed(2)}
        </span>
      </h3>

      {/* Formulario */}
      <form onSubmit={handleCreate} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', border: '1px solid #ddd' }}>
        <input 
          type="text" 
          placeholder="Nombre (ej. Fondo de Emergencia, CETES)" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ flex: 2, minWidth: '180px', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <select 
          value={type} 
          onChange={(e) => setType(e.target.value)}
          style={{ flex: 1, minWidth: '120px', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="ahorro">Ahorro</option>
          <option value="inversion">Inversión</option>
        </select>
        <input 
          type="number" 
          step="0.01" 
          placeholder="Monto Actual ($)" 
          value={currentAmount}
          onChange={(e) => setCurrentAmount(e.target.value)}
          style={{ width: '130px', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input 
          type="number" 
          step="0.01" 
          placeholder="Meta (Opcional)" 
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          style={{ width: '130px', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '8px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
          + Crear Meta / Cuenta
        </button>
      </form>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666' }}>No hay ahorros o inversiones registradas.</p>
        ) : (
          items.map(item => (
            <div key={item.id} style={{ padding: '12px 15px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ background: item.type === 'ahorro' ? '#d1ecf1' : '#d4edda', color: item.type === 'ahorro' ? '#0c5460' : '#155724', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginRight: '8px' }}>
                  {item.type.toUpperCase()}
                </span>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{item.name}</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#27ae60', fontWeight: 'bold' }}>
                  Acumulado: ${item.current_amount} {item.target_amount > 0 && `/ Meta: $${item.target_amount}`}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Abonar $" 
                  value={depositAmounts[item.id] || ''}
                  onChange={(e) => setDepositAmounts({ ...depositAmounts, [item.id]: e.target.value })}
                  style={{ width: '90px', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button 
                  onClick={() => handleAddFunds(item.id, item.current_amount)}
                  style={{ padding: '6px 10px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Depositar
                </button>
                <button 
                  onClick={() => handleDelete(item.id)}
                  style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  X
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SavingsManager;