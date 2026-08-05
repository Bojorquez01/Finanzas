import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function IncomeManager({ session }) {
  const [incomes, setIncomes] = useState([]);
  const [salaryConfig, setSalaryConfig] = useState({ salary_amount: '', frequency: 'quincenal' });
  const [isEditingSalary, setIsEditingSalary] = useState(false);

  // Estados para ingresos extras
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, [session]);

  async function fetchData() {
    // 1. Cargar configuración de sueldo fijo
    const { data: salaryData } = await supabase
      .from('user_salary_config')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (salaryData) {
      setSalaryConfig(salaryData);
    } else {
      setIsEditingSalary(true); // Si no tiene sueldo configurado, abrimos para configurarlo
    }

    // 2. Cargar ingresos extras
    const { data: incData } = await supabase
      .from('incomes')
      .select('*')
      .order('id', { ascending: false });

    if (incData) setIncomes(incData || []);
  }

  // Guardar o actualizar sueldo fijo
  const handleSaveSalary = async (e) => {
    e.preventDefault();
    const amt = parseFloat(salaryConfig.salary_amount);
    if (isNaN(amt)) return;

    // Verificar si ya existe registro
    const { data: existing } = await supabase
      .from('user_salary_config')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_salary_config')
        .update({ salary_amount: amt, frequency: salaryConfig.frequency })
        .eq('user_id', session.user.id);
    } else {
      await supabase
        .from('user_salary_config')
        .insert([{ salary_amount: amt, frequency: salaryConfig.frequency }]);
    }

    setIsEditingSalary(false);
    fetchData();
  };

  // Agregar ingreso extra
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

  // Calcular equivalente mensual para el dashboard si es quincenal (multiplicar x2) o mensual
  const monthlySalaryBase = salaryConfig.frequency === 'quincenal' 
    ? Number(salaryConfig.salary_amount || 0) * 2 
    : Number(salaryConfig.salary_amount || 0);

  const totalExtras = incomes.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div style={{ marginTop: '30px', fontFamily: 'sans-serif' }}>
      <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>
        Control de Ingresos
      </h3>

      {/* Tarjeta de Sueldo Fijo Recurrente */}
      <div style={{ background: '#f1f8e9', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #c8e6c9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#2e7d32', fontSize: '15px' }}>Sueldo Fijo Principal</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>
              {salaryConfig.salary_amount ? (
                <>Configurado como: <strong>${salaryConfig.salary_amount} ({salaryConfig.frequency})</strong></>
              ) : (
                'Aún no has configurado tu sueldo fijo.'
              )}
            </p>
          </div>
          <button 
            onClick={() => setIsEditingSalary(!isEditingSalary)}
            style={{ background: '#388e3c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {isEditingSalary ? 'Cancelar' : (salaryConfig.salary_amount ? 'Editar Sueldo / Cambiar Empleo' : 'Configurar Sueldo')}
          </button>
        </div>

        {isEditingSalary && (
          <form onSubmit={handleSaveSalary} style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', background: '#fff', padding: '12px', borderRadius: '6px' }}>
            <input 
              type="number" 
              step="0.01" 
              placeholder="Monto ($)" 
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
            <button type="submit" style={{ padding: '7px 14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              Guardar Sueldo
            </button>
          </form>
        )}
      </div>

      {/* Sección de Ingresos Extras / Ocasionales */}
      <h4 style={{ color: '#333', fontSize: '14px', marginBottom: '10px' }}>Ingresos Extras u Ocasionales</h4>
      <form onSubmit={handleAddExtraIncome} style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', border: '1px solid #ddd' }}>
        <input 
          type="text" 
          placeholder="Fuente (ej. Freelance, Venta extra)" 
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
              <span style={{ marginLeft: '15px', color: '#27ae60', fontWeight: 'bold' }}>+${inc.amount}</span>
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