import { useState } from 'react';
import { supabase } from '../supabaseClient';

function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage('¡Registro exitoso! Por favor inicia sesión.');
        setEmail('');
        setPassword('');
        setIsSignUp(false); // Cambia automáticamente a la pantalla de Login
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage('Error al iniciar sesión: ' + error.message);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '380px', margin: '60px auto', padding: '25px', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '20px' }}>
        {isSignUp ? 'Crear Cuenta Financiera' : 'Iniciar Sesión'}
      </h2>

      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc' }}
        />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', paddingRight: '60px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {showPassword ? 'Ocultar' : 'Ver'}
          </button>
        </div>

        <button type="submit" disabled={loading} style={{ padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          {loading ? 'Procesando...' : (isSignUp ? 'Registrarse' : 'Entrar')}
        </button>
      </form>

      {message && <p style={{ color: message.includes('exitoso') ? 'green' : 'red', fontSize: '13px', textAlign: 'center', marginTop: '10px' }}>{message}</p>}

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      {/* Botón claro para alternar entre Iniciar sesión y Crear cuenta */}
      <button
        type="button"
        onClick={() => { setIsSignUp(!isSignUp); setEmail(''); setPassword(''); setMessage(''); }}
        style={{ width: '100%', padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
      >
        {isSignUp ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿No tienes cuenta? Crear una cuenta'}
      </button>
    </div>
  );
}

export default Auth;