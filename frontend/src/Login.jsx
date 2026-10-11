import { useState } from 'react';
import { api } from './api';

export default function Login({ onAuth, notify }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@friendlygreen.co');
  const [password, setPassword] = useState('admin123');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [forgot, setForgot] = useState(false);
  const [fEmail, setFEmail] = useState('');
  const [fPass, setFPass] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const data = mode === 'login'
        ? await api.login(email, password)
        : await api.register(name, email, password);
      localStorage.setItem('fg_token', data.token);
      notify?.(`¡Bienvenido, ${data.user.name}! 🌱`);
      onAuth(data.user);
    } catch (e) { setErr(e.message); }
  }

  async function doRecover(e) {
    e.preventDefault();
    try {
      const r = await api.recover(fEmail, fPass);
      notify?.(r.message || 'Clave actualizada');
      setForgot(false);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="fg-login-page">
      <div className="fg-login-card">
        <div className="fg-login-left">
          <div style={{fontSize:38}}>🌱</div>
          <div className="fg-brand">FriendlyGreen</div>
          <p className="fg-tagline">Juntos por un planeta sostenible</p>
          <div className="fg-earth">🌍</div>
          <div className="fg-motto">Cuida hoy, transforma mañana.</div>
          <div className="fg-motto-sub">Con pequeñas acciones generamos<br/>grandes cambios.</div>
        </div>
        <form className="fg-login-right" onSubmit={submit}>
          <h2>Iniciar sesión</h2>
          <div className="fg-login-sub">Bienvenido de nuevo, ingresa a tu cuenta</div>
          {mode === 'register' && (<><label>Nombre</label><div className="fg-input"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ana" required /></div></>)}
          <label>Correo electrónico</label>
          <div className="fg-input"><span>✉️</span><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="ejemplo@correo.com" required /></div>
          <label>Contraseña</label>
          <div className="fg-input">
            <input type={show ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••" required />
            <span style={{cursor:'pointer'}} onClick={()=>setShow(!show)} title="Mostrar/ocultar">👁️</span>
          </div>
          <div className="fg-forgot" onClick={()=>{ setForgot(true); setFEmail(email); }}>¿Olvidaste tu contraseña?</div>
          {err && <div className="fg-err">{err}</div>}
          <button className="fg-btn">{mode === 'login' ? 'Iniciar sesión' : 'Registrate (+50 EcoPuntos)'}</button>
          <div className="fg-switch">
            {mode === 'login' ? (<>¿No tienes cuenta? <b onClick={()=>setMode('register')}>Registrate</b></>) : (<>¿Ya tienes cuenta? <b onClick={()=>setMode('login')}>Inicia sesión</b></>)}
          </div>
          <div className="fg-switch" style={{fontSize:12}}>Admin: admin@friendlygreen.co / admin123 · o crea tu cuenta de usuario</div>
        </form>
      </div>

      {forgot && (
        <div className="fg-modal-bg" onClick={()=>setForgot(false)}>
          <form className="fg-modal" onClick={e=>e.stopPropagation()} onSubmit={doRecover}>
            <h3>Recuperar contraseña 🔑</h3>
            <p className="fg-sub">Escribe tu correo y una nueva clave (mín. 6 caracteres).</p>
            <label>Correo</label>
            <div className="fg-input"><input value={fEmail} onChange={e=>setFEmail(e.target.value)} placeholder="tu@correo.com" required /></div>
            <label>Nueva contraseña</label>
            <div className="fg-input"><input type="password" value={fPass} onChange={e=>setFPass(e.target.value)} placeholder="mín. 6 caracteres" required /></div>
            <div style={{display:'flex', gap:10, marginTop:14}}>
              <button type="button" className="fg-btn" style={{background:'#e2e8f0', color:'#14532d'}} onClick={()=>setForgot(false)}>Cancelar</button>
              <button className="fg-btn">Guardar nueva clave</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
