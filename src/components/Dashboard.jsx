import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

function Dashboard({ session }) {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [minLivingExpense, setMinLivingExpense] = useState(0);

  // Estados para las listas de datos generales
  const [incomesList, setIncomesList] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [debtsList, setDebtsList] = useState([]);
  const [investmentsList, setInvestmentsList] = useState([]);
  const [salaryConfig, setSalaryConfig] = useState(null);

  // Estados para los Filtros de Mes y Año del Estado de Cuenta General
  const [filterMonth, setFilterMonth] = useState('todos'); 
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString()); 

  useEffect(() => {
    if (session) fetchDashboardData();
  }, [session]);

  const fmt = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function fetchDashboardData() {
    // 1. Obtener sueldo y colchón intocable
    const { data: salaryData } = await supabase
      .from('user_salary_config')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    let salaryMonthly = 0;
    if (salaryData) {
      setSalaryConfig(salaryData);
      salaryMonthly = salaryData.frequency === 'quincenal' 
        ? Number(salaryData.salary_amount) * 2 
        : Number(salaryData.salary_amount);
      
      setMinLivingExpense(Number(salaryData.min_living_expense || 0));
    }

    // 2. Ingresos extras
    const { data: incData } = await supabase.from('incomes').select('*').eq('user_id', session.user.id);
    const extrasSum = (incData || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    setIncomesList(incData || []);
    setTotalIncome(salaryMonthly + extrasSum);

    // 3. Gastos de tarjetas
    const { data: expData } = await supabase.from('expenses').select('*');
    const expenseSum = (expData || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    setExpensesList(expData || []);
    setTotalExpenses(expenseSum);

    // 4. Deudas
    const { data: debtData } = await supabase
      .from('debts')
      .select('*')
      .or(`debtor_id.eq.${session.user.id},debtor_email.eq.${session.user.email},creditor_email.eq.${session.user.email}`);

    if (debtData) {
      setDebtsList(debtData);
      const debtSum = debtData
        .filter(d => d.status !== 'pagado' && d.debtor_id === session.user.id)
        .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      setTotalDebt(debtSum);
    }

    // 5. Inversiones
    const { data: invData } = await supabase.from('investments').select('*');
    if (invData) setInvestmentsList(invData);
  }

  const netBalance = totalIncome - totalExpenses - totalDebt;

  // Cálculo de meses de supervivencia (Runway)
  const monthlyBurnRate = totalExpenses + totalDebt;
  const runwayMonths = minLivingExpense > 0 && monthlyBurnRate > 0 
    ? (minLivingExpense / monthlyBurnRate).toFixed(1) 
    : 'N/A';

  const chartData = [
    {
      name: 'Flujo Financiero',
      Ingresos: totalIncome,
      'Gastos Tarjetas': totalExpenses,
      'Deudas Activas': totalDebt,
    },
  ];

  // Datos para la Gráfica Circular (PieChart)
  const pieData = [
    { name: 'Ingresos', value: totalIncome, color: '#27ae60' },
    { name: 'Gastos Tarjetas', value: totalExpenses, color: '#dc3545' },
    { name: 'Deudas Activas', value: totalDebt, color: '#e67e22' },
  ].filter(item => item.value > 0); // Solo muestra los que tienen valor mayor a 0

  // --- FILTRADO INTELIGENTE PARA EL ESTADO DE CUENTA GENERAL ---
  const filterByDate = (item) => {
    const itemDate = item.last_reset_month || item.created_at || '';
    if (!itemDate) return true;
    const [itemYear, itemMonth] = itemDate.slice(0, 7).split('-');

    const matchesYear = filterYear === 'todos' || itemYear === filterYear;
    const matchesMonth = filterMonth === 'todos' || itemMonth === filterMonth;

    return matchesYear && matchesMonth;
  };

  const filteredIncomes = incomesList.filter(filterByDate);
  const filteredExpenses = expensesList.filter(filterByDate);
  const filteredDebts = debtsList.filter(filterByDate);
  const filteredInvestments = investmentsList.filter(filterByDate);

  // --- FUNCIÓN DE DESCARGA DIRECTA DEL ESTADO DE CUENTA GENERAL (PDF / HTML) ---
  const handleDownloadGeneralPDF = () => {
    const periodText = `Mes: ${filterMonth === 'todos' ? 'Todos' : filterMonth} / Año: ${filterYear}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Estado de Cuenta General - Financiero</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h2 { color: #2c3e50; text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }
            .info { margin-bottom: 20px; font-size: 13px; background: #f8f9fa; padding: 12px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 25px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f1f3f5; color: #333; }
            h4 { color: #2c3e50; margin-top: 25px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          </style>
        </head>
        <body>
          <h2>ESTADO DE CUENTA FINANCIERO GENERAL</h2>
          <div class="info">
            <p><strong>Usuario:</strong> ${session.user.email}</p>
            <p><strong>Periodo del Reporte:</strong> ${periodText}</p>
            <p><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <h4>1. Ingresos del Periodo</h4>
          <table>
            <thead>
              <tr><th>Concepto / Tipo</th><th>Monto</th></tr>
            </thead>
            <tbody>
              ${salaryConfig ? `<tr><td>Sueldo (${salaryConfig.frequency})</td><td>$${fmt(salaryConfig.frequency === 'quincenal' ? Number(salaryConfig.salary_amount) * 2 : Number(salaryConfig.salary_amount))}</td></tr>` : ''}
              ${filteredIncomes.length === 0 && !salaryConfig ? '<tr><td colspan="2" style="text-align: center;">Sin ingresos registrados en este periodo.</td></tr>' : 
                filteredIncomes.map(inc => `<tr><td>Ingreso Extra</td><td>$${fmt(inc.amount)}</td></tr>`).join('')}
            </tbody>
          </table>

          <h4>2. Egresos y Gastos de Tarjetas</h4>
          <table>
            <thead>
              <tr><th>Concepto / Gasto</th><th>Monto</th></tr>
            </thead>
            <tbody>
              ${filteredExpenses.length === 0 ? '<tr><td colspan="2" style="text-align: center;">Sin gastos registrados en este periodo.</td></tr>' : 
                filteredExpenses.map(exp => `<tr><td>${exp.description || exp.name || 'Gasto General'}</td><td>$${fmt(exp.amount)}</td></tr>`).join('')}
            </tbody>
          </table>

          <h4>3. Deudas y Pagos (Activos / Liquidados)</h4>
          <table>
            <thead>
              <tr><th>Descripción</th><th>Estatus</th><th>Monto</th></tr>
            </thead>
            <tbody>
              ${filteredDebts.length === 0 ? '<tr><td colspan="3" style="text-align: center;">Sin movimientos de deudas en este periodo.</td></tr>' : 
                filteredDebts.map(d => `<tr><td>${d.description || 'Deuda Compartida'}</td><td>${d.status.toUpperCase()}</td><td>$${fmt(d.amount)}</td></tr>`).join('')}
            </tbody>
          </table>

          <h4>4. Inversiones Realizadas en el Mes</h4>
          <table>
            <thead>
              <tr><th>Plataforma / Instrumento</th><th>Activo</th><th>Monto Invertido</th></tr>
            </thead>
            <tbody>
              ${filteredInvestments.length === 0 ? '<tr><td colspan="3" style="text-align: center;">Sin inversiones registradas en este periodo.</td></tr>' : 
                filteredInvestments.map(inv => `<tr><td>${inv.platform} (${inv.instrument_type})</td><td>${inv.name}</td><td>$${fmt(inv.invested_amount)}</td></tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Estado_de_Cuenta_General_${filterYear}_${filterMonth}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '30px', fontFamily: 'sans-serif' }}>
      
      {/* APARTADO VISIBLE DEL ESTADO DE CUENTA GENERAL Y SUS FILTROS */}
      <div style={{ background: '#fff', padding: '18px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '16px' }}>📄 Generador de Estado de Cuenta General</h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Filtra por mes y año para descargar tu reporte financiero consolidado.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            style={{ padding: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="todos">📅 Todos los Meses</option>
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

          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(e.target.value)}
            style={{ padding: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="todos">Todos los Años</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>

          <button 
            onClick={handleDownloadGeneralPDF} 
            style={{ padding: '9px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            📥 Descargar Estado de Cuenta General
          </button>
        </div>
      </div>

      <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px' }}>Resumen Financiero Mensual</h3>
      
      {/* Tarjetas de Indicadores */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: 1, minWidth: '180px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>INGRESOS</p>
          <p style={{ margin: 0, fontSize: '20px', color: '#27ae60', fontWeight: 'bold' }}>+${fmt(totalIncome)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '180px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>GASTOS TARJETAS</p>
          <p style={{ margin: 0, fontSize: '20px', color: '#dc3545', fontWeight: 'bold' }}>-${fmt(totalExpenses)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '180px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>DEUDAS PENDIENTES</p>
          <p style={{ margin: 0, fontSize: '20px', color: '#e67e22', fontWeight: 'bold' }}>-${fmt(totalDebt)}</p>
        </div>

        <div style={{ flex: 1, minWidth: '180px', background: netBalance >= 0 ? '#e8f8f5' : '#fdedec', padding: '15px', borderRadius: '6px', border: `1px solid ${netBalance >= 0 ? '#a3e4d7' : '#f5b7b1'}` }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#2c3e50', fontWeight: 'bold' }}>BALANCE NETO</p>
          <p style={{ margin: 0, fontSize: '20px', color: netBalance >= 0 ? '#117a65' : '#c0392b', fontWeight: 'bold' }}>${fmt(netBalance)}</p>
        </div>
      </div>

      {/* Contenedor de Gráficas en Cuadrícula */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        
        {/* Gráfica de Barras de Flujo de Caja */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '15px' }}>📈 Comparativa de Flujo de Caja</h4>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${fmt(value)}`} />
                <Legend />
                <Bar dataKey="Ingresos" fill="#27ae60" />
                <Bar dataKey="Gastos Tarjetas" fill="#dc3545" />
                <Bar dataKey="Deudas Activas" fill="#e67e22" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Nueva Gráfica de Pastel (Distribución) */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '15px' }}>🥧 Distribución de Movimientos</h4>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${fmt(value)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Calculadora de Runway / Meses de Supervivencia */}
      <div style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '14px' }}>🛡️ Salud de Colchón Financiero (Runway)</h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Basado en tu colchón intocable configurado frente a tus salidas de dinero mensuales.</p>
        </div>
        <div style={{ background: '#f1f5f9', padding: '8px 15px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{runwayMonths} meses de respaldo</span>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;