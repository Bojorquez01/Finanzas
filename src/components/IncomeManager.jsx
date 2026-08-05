import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function IncomeManager({ session }) {
  const [incomes, setIncomes] = useState([]);
  const [salaryConfig, setSalaryConfig] = useState({ salary_amount: '', frequency: 'quincenal', min_living_expense: '' });
  const [isEditingSalary, setIsEditingSalary] = useState(false);

  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function fetchData() {
    const { data: salaryData } = await supabase
      .from('user_salary_config')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (salaryData) {
      setSalaryConfig(salaryData);
    } else {
      setIsEditingSalary(true);
    }

    const { data: incData } = await supabase
      .from('incomes')
      .select('*')
      .order('id', { ascending: false });

    if (incData) setIncomes(incData || []);
  }

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    const amt = parseFloat(salaryConfig.salary_amount);
    const minExp = parseFloat(salaryConfig.min_living_expense) || 0;
    if (isNaN(amt)) return;

    const { data: existing } = await supabase
      .from('user_salary_config')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_salary_config')
        .update({ 
          salary_amount: amt, 
          frequency: salaryConfig.frequency,
          min_living_expense: minExp
        })
        .eq('user_id', session.user.id);
    } else {
      await supabase
        .from('user_salary_config')
        .insert([{ 
          salary_amount: amt, 
          frequency: salaryConfig.frequency,
          min_living_expense: minExp
        }]);
    }

    setIsEditingSalary(false);
    fetchData();
  };

  const handleAddExtraIncome = async (e) => {
    e.preventDefault();
    if (!source || !amount) return;

    const { error } = await supabase
      .from('incomes')
      .insert([{ source, amount: parseFloat(amount) }]);

    if (!error) {
      setSource('');
      setAmount('');
      fetchData();
    }
  };

  const handleDeleteIncome = async (id) => {
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (!error) fetchData();
  };

  return (
    <div style={{ marginTop: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>
        Control de Ingresos y Presupuesto Base
      </h3>

      {/* Tarjeta de Sueldo y Mínimo Indispensable */}
      <div style={{ background: '#f1f8e9', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #c8e6c9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#2e7d32', fontSize: '15px' }}>Sueldo Fijo y Colchón de Supervivencia</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>
              {salaryConfig.salary_amount ? (
                <>
                  Sueldo: <strong>${fmt(salaryConfig.salary_amount)} ({salaryConfig.frequency})</strong> | 
                  Mínimo Indispensable (Comida/Salud): <strong style={{ color: '#c0392b' }}>${fmt(salaryConfig.min_living_expense)}</strong>
                </>
              ) : (
                'Configura tu sueldo y tu mínimo indispensable intocable.'
              )}
            </p>
          </div>
          <button 
            onClick={() => setIsEditingSalary(!isEditingSalary)}
            style={{ background: '#388e3c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {isEditingSalary ? 'Cancelar' : 'Configurar Sueldo y Gastos Básicos'}
          </button>
        </div>

        {isEditingSalary && (
          <form onSubmit={handleSaveSalary} style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', background: '#fff', padding: '12px', borderRadius: '6px' }}>
            <input 
              type="number" 
              step="0.01" 
              placeholder="Sueldo monto ($)" 
              value={salaryConfig.salary_amount}
              onChange={(e) => setSalaryConfig({ ...salaryConfig, salary_amount: e.target.value })}
              required
              style={{ flex: 2, padding: '7px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <select 
              value={salaryConfig.frequency}
              onChange={(e) => setSalaryConfig({ ...salaryConfig, frequency: e.target.value })}
              style={{ flex: 1, padding: '7px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
            <input 
              type="number" 
              step="0.01" 
              placeholder="Mínimo indispensable mensual (Comida, salud) $" 
              value={salaryConfig.min_living_expense}
              onChange={(e) => setSalaryConfig({ ...salaryConfig, min_living_expense: e.target.value })}
              required
              style={{ flex: 2, padding: '7px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button type="submit" style={{ padding: '7px 14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              Guardar Configuración
            </button>
          </form>
        )}
      </div>

      {/* Ingresos Extras */}
      <h4 style={{ color: '#333', fontSize: '14px', marginBottom: '10px' }}>Ingresos Extras / Ocasionales</h4>
      <form onSubmit={handleAddExtraIncome} style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', border: '1px solid #ddd' }}>
        <input 
          type="text" 
          placeholder="Fuente (ej. Freelance, Venta)" 
          value={source}
          onChange={(e) => setSource(e.target.value)}
          required
          style={{ flex: 2, padding: '7px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input 
          type="number" 
          step="0.01" 
          placeholder="Monto ($)" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          style={{ flex: 1, padding: '7px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '7px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
          + Agregar Extra
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {incomes.map(inc => (
          <div key={inc.id} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <div>
              <span style={{ fontWeight: 'bold', color: '#333' }}>{inc.source}</span>
              <span style={{ marginLeft: '15px', color: '#27ae60', fontWeight: 'bold' }}>+${fmt(inc.amount)}</span>
            </div>
            <button onClick={() => handleDeleteIncome(inc.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IncomeManager;