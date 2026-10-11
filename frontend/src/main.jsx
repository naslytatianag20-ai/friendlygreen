import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { api } from './api';
import Login from './Login';
import './styles.css';

const firstName = (u) => (u?.name || 'Ana').split(' ')[0];
const avatar = () => localStorage.getItem('fg_avatar') || '👩';
const isAdmin = (u) => u?.role === 'admin';

/* Fecha MySQL 'YYYY-MM-DD HH:MM:SS' o ISO -> 'DD/MM/YYYY HH:MM' */
function fmtFecha(v) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d)) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* Foto -> dataURL reducida (max 1000px, JPEG) para no saturar MySQL */
function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1000;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- Topbar fija + despliegues anclados ---------- */
function Topbar({ user, onMenu, onBell, onUser, showBell, showUser, notis, onOpenNoti, onUserGo, onClose }) {
  return (
    <div className="fg-topbar">
      {(showBell || showUser) && <div className="fg-overlay" onClick={onClose} />}
      <span className="fg-click" style={{fontSize:22}} onClick={onMenu} title="Menú">☰</span>
      <span className="logo fg-click" onClick={()=>onUserGo('inicio')}>🌿 FriendlyGreen</span>
      {isAdmin(user) && <span className="fg-pill">ADMIN</span>}
      <span className="sp" />
      <span className="fg-anchor">
        <span className="fg-bell fg-click" onClick={onBell} title="Notificaciones">🔔{notis.length ? <b style={{fontSize:11, background:'#c0392b', color:'#fff', borderRadius:10, padding:'0 6px'}}>{notis.length}</b> : null}</span>
        {showBell && (
          <div className="fg-drop">
            <b style={{fontSize:13}}>Notificaciones</b>
            {notis.length === 0 && <div className="fg-mini" style={{padding:8}}>Sin novedades 🌿</div>}
            {notis.map((n,i)=><div key={i} className="fg-drop-row" onClick={()=>{onOpenNoti(n);}}>🔔 <span>{n.text}</span></div>)}
          </div>
        )}
      </span>
      <span className="fg-anchor">
        <span className="fg-user fg-click" onClick={onUser}><span className="fg-avatar">{avatar()}</span> Hola, {firstName(user)} ⌄</span>
        {showUser && (
          <div className="fg-drop">
            <button onClick={()=>onUserGo('perfil')}>👤 Mi perfil</button>
            <button onClick={()=>onUserGo('config')}>⚙️ Configuración</button>
            <button onClick={()=>onUserGo('__exit')}>↩ Cerrar sesión</button>
          </div>
        )}
      </span>
    </div>
  );
}

const MENU_BASE = [
  ['inicio', '🏠 Inicio'],
  ['actividades', '🧾 Actividades'],
  ['retos', '🏆 Retos'],
  ['reportes', '📄 Reportes'],
  ['comunidad', '🧑‍🤝‍🧑 Comunidad'],
  ['recursos', '📚 Recursos'],
];

function Sidebar({ view, setView, onExit, open, user }) {
  if (!open) return null;
  const menu = isAdmin(user) ? [...MENU_BASE, ['admin', '🛡️ Administrar']] : MENU_BASE;
  return (
    <nav className="fg-side open">
      {menu.map(([v, l]) => (
        <button key={v} className={'fg-item' + (view === v ? ' on' : '')} onClick={() => setView(v)}>{l}</button>
      ))}
      <button className="fg-item" onClick={onExit}>↩ Salir</button>
    </nav>
  );
}

/* ---- INICIO: contadores reales ---- */
function Inicio({ user, go, notify }) {
  const [s, setS] = useState(null);
  const [acts, setActs] = useState([]);
  const [retos, setRetos] = useState([]);
  useEffect(() => {
    api.stats().then(setS).catch(() => {});
    api.actividades().then(a=>setActs(a.slice(0,3))).catch(() => {});
    api.retos().then(setRetos).catch(()=>{});
  }, []);
  const recientes = acts.length ? acts.map(a=>({ic:'🌿', t:a.titulo, f:fmtFecha(a.fecha), p:`+${a.puntos} puntos`})) : [
    { ic: '♻️', t: 'Reciclaje de plástico', f: '20/04/2026', p: '+20 puntos' },
    { ic: '🌱', t: 'Siembra de árboles', f: '18/04/2026', p: '+30 puntos' },
    { ic: '💡', t: 'Ahorro de energía', f: '15/04/2026', p: '+15 puntos' },
  ];
  const actual = retos.find(r=>!r.completado) || null;
  const pct = actual ? Math.round((actual.avance / actual.meta) * 100) : 100;
  return (
    <div>
      <h1 className="fg-h1">¡Bienvenida, {firstName(user)}! 🌱</h1>
      <div className="fg-sub">Cada acción cuenta para un mundo mejor.</div>
      <div className="fg-cards4">
        <div className="fg-stat fg-click" onClick={()=>go('actividades')} title="Ir a actividades"><div className="ic">🍃</div><b>{s?.actividadesRealizadas ?? 0}</b><span>Actividades<br/>realizadas</span></div>
        <div className="fg-stat fg-click" onClick={()=>go('retos')} title="Ir a retos"><div className="ic">🏆</div><b>{s?.retosCompletados ?? 0}</b><span>Retos<br/>completados</span></div>
        <div className="fg-stat fg-click" onClick={()=>go('perfil')} title="Ver mis puntos"><div className="ic">🌱</div><b>{s?.ecoPuntos ?? user.ecoPuntos ?? 0}</b><span>Puntos<br/>acumulados</span></div>
        <div className="fg-stat fg-click" onClick={()=>go('reportes')} title="Ver impacto"><div className="ic">🌍</div><b>{s ? (s.co2EvitadoKg / 10).toFixed(1) + ' kg' : '0 kg'}</b><span>CO₂ evitado</span></div>
      </div>
      <div className="fg-2col">
        <div className="fg-panel">
          <div style={{display:'flex'}}><h3>Actividades recientes</h3><span style={{flex:1}}/><span className="fg-link" onClick={()=>go('actividades')}>Ver todas</span></div>
          {recientes.map((r, i) => (
            <div className="fg-row fg-click" key={i} onClick={()=>{ go('actividades'); notify?.('Abriendo "'+r.t+'" en Actividades'); }}><span className="fg-dot">{r.ic}</span>
              <span><b>{r.t}</b><small>{r.f}</small></span><span className="fg-pts">{r.p}</span>
            </div>
          ))}
        </div>
        <div className="fg-reto">
          <div style={{display:'flex'}}><b>Reto actual</b><span style={{flex:1}}/>🌱</div>
          {actual ? (<>
            <p style={{fontWeight:800, margin:'10px 0 4px'}}>{actual.titulo}</p>
            <small>{actual.descripcion}</small>
            <div style={{fontSize:13, marginTop:8}}>{actual.avance} / {actual.meta} {actual.unidad}</div>
            <div className="fg-bar"><i style={{width:pct+'%'}} /></div>
          </>) : <p style={{margin:'10px 0'}}>¡Sin retos pendientes! 🎉</p>}
          <button className="fg-btn" style={{marginTop:16}} onClick={()=>go('retos')}>Ver retos</button>
        </div>
      </div>
    </div>
  );
}

/* ---- ACTIVIDADES: públicas (auto) + mis asignadas (con evidencia) ---- */
const CATS = { reciclaje:{bg:'#1d9e4b', ic:'♻️', tag:'Reciclaje'}, naturaleza:{bg:'#1d9e4b', ic:'🌱', tag:'Naturaleza'}, limpieza:{bg:'#1d9e4b', ic:'🧹', tag:'Limpieza'}, energa:{bg:'#f5b301', ic:'⚡', tag:'Energía'}, energia:{bg:'#f5b301', ic:'⚡', tag:'Energía'}, agua:{bg:'#4aa3df', ic:'💧', tag:'Agua'}, reto:{bg:'#7c3aed', ic:'🏆', tag:'Reto'}, reforestacion:{bg:'#1d9e4b', ic:'🌳', tag:'Naturaleza'} };
const catOf = (a, i) => CATS[(a.tipo||'').toLowerCase()] || [{bg:'#1d9e4b',ic:'♻️',tag:'Reciclaje'},{bg:'#1d9e4b',ic:'🌱',tag:'Naturaleza'},{bg:'#f5b301',ic:'⚡',tag:'Energía'},{bg:'#4aa3df',ic:'💧',tag:'Agua'}][i%4];
const EST = { pendiente:['⏳ Pendiente','pendiente'], enviada:['📤 Enviada a validación','validado'], validada:['✅ Validada','solucionado'], rechazada:['❌ Rechazada','pendiente'] };

function Actividades({ user, notify, refreshUser, go }) {
  const [list, setList] = useState([]);
  const [mias, setMias] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todas');
  const [done, setDone] = useState(() => JSON.parse(localStorage.getItem('fg_done_act') || '[]'));
  const [ev, setEv] = useState(null); // actividad asignada a evidenciar
  const [evText, setEvText] = useState('');
  const [evFoto, setEvFoto] = useState(null);
  const load = async () => {
    setList(await api.actividades().catch(()=>[]));
    setMias(await api.misActividades().catch(()=>[]));
  };
  useEffect(()=>{ load(); }, []);
  const rows = list
    .filter(r => (cat==='todas' || (r.tipo||'').toLowerCase()===cat))
    .filter(r => (r.titulo+r.descripcion).toLowerCase().includes(q.toLowerCase()));

  async function completar(a) {
    if (done.includes(a.id)) { notify?.('Ya registraste esta actividad 🌿'); return; }
    const r = await api.completar(a.id).catch(err=>{ notify?.(err.message); return null; });
    if (!r) return;
    const d = [...done, a.id]; setDone(d); localStorage.setItem('fg_done_act', JSON.stringify(d));
    notify?.(`¡${r.ecoPuntos} EcoPuntos! (+${a.puntos}) 🎉`); refreshUser?.(); load();
  }
  async function enviarEvidencia(e) {
    e.preventDefault();
    const r = await api.enviarEvidencia(ev.id, { evidencia: evText, foto: evFoto }).catch(err=>{ notify?.(err.message); return null; });
    if (!r) return;
    setEv(null); setEvText(''); setEvFoto(null);
    notify?.('Evidencia enviada. El admin la validará 📤'); load();
  }
  return (
    <div>
      <div className="fg-head"><div><h1 className="fg-h1">Actividades</h1><div className="fg-sub">Descubre y registra acciones que ayudan al planeta.</div></div>
        {isAdmin(user) && <button className="fg-new" onClick={()=>go('admin')}>🛡️ Crear en Administrar</button>}</div>

      {mias.length > 0 && (
        <div className="fg-panel" style={{borderLeft:'6px solid var(--green)'}}>
          <h3>📌 Mis actividades asignadas ({mias.filter(m=>m.estado!=='validada').length} pendientes)</h3>
          <div className="fg-mini">Completa, envía evidencia y el admin valida tus puntos.</div>
          {mias.map((m,i)=>{ const st = catOf(m,i); const [lbl, cls] = EST[m.estado] || EST.pendiente; return (
            <div className="fg-act" key={m.id}>
              <span className="fg-circle" style={{background:st.bg}}>{st.ic}</span>
              <span style={{flex:1}}><b style={{fontSize:15}}>{m.titulo}</b> <span className={`fg-pill ${cls}`}>{lbl}</span><br/><small style={{color:'#5c6b5c'}}>{m.descripcion}</small></span>
              <span style={{textAlign:'right'}}><b style={{color:'var(--green)'}}>+{m.puntos} <small>puntos</small></b><br/>
              {m.estado!=='validada' && <button className="fg-btn sm" onClick={()=>{setEv(m); setEvText(m.evidencia||''); setEvFoto(null);}}>{m.estado==='enviada'?'Reenviar evidencia':'Enviar evidencia'}</button>}</span>
            </div>);})}
        </div>
      )}

      <div className="fg-search">
        <div className="fg-input">🔍<input placeholder="Buscar actividad..." value={q} onChange={e=>setQ(e.target.value)} />{q && <span className="fg-click" onClick={()=>setQ('')}>✖</span>}</div>
        <select className="fg-sel" value={cat} onChange={e=>setCat(e.target.value)}>
          <option value="todas">Todas las categorías</option><option value="reciclaje">Reciclaje</option><option value="limpieza">Limpieza</option><option value="energia">Energía</option><option value="agua">Agua</option><option value="reto">Reto</option>
        </select>
      </div>
      <div className="fg-mini">{rows.length} actividades públicas (puntos automáticos)</div>
      {rows.map((r, i) => { const st = catOf(r,i); const ya = done.includes(r.id); return (
        <div className="fg-act" key={r.id || i}>
          <span className="fg-circle" style={{background:st.bg}}>{st.ic}</span>
          <span style={{flex:1}}><b style={{fontSize:15}}>{r.titulo}</b><br/><small style={{color:'#5c6b5c'}}>{r.descripcion}</small><br/><span className="fg-pill">{st.tag}</span> <small className="fg-mini">· {r.participantes?.length||0} participantes</small></span>
          <span style={{textAlign:'right'}}><b style={{color:'var(--green)'}}>+{r.puntos} <small>puntos</small></b><br/>
          <button className="fg-btn sm" style={ya?{background:'#e2e8f0',color:'#666'}:{}} onClick={()=>completar(r)}>{ya?'Registrada ✓':'Registrar'}</button></span>
        </div>);})}

      {ev && (
        <div className="fg-modal-bg" onClick={()=>setEv(null)}>
          <form className="fg-modal fg-form" onClick={e=>e.stopPropagation()} onSubmit={enviarEvidencia}>
            <h3>Evidencia: {ev.titulo} 📸</h3>
            <label>Describe lo que hiciste</label>
            <input value={evText} onChange={e=>setEvText(e.target.value)} placeholder="Ej: Reciclé 5kg en..." required />
            <label>Foto (opcional)</label>
            <input type="file" accept="image/*" onChange={async e=>{ const f=e.target.files[0]; if(f) setEvFoto(await fileToPhoto(f)); }} />
            {evFoto && <img src={evFoto} alt="evidencia" style={{width:'100%', borderRadius:10, marginTop:8}} />}
            <div style={{display:'flex', gap:10, marginTop:12}}><button type="button" className="fg-btn ghost" onClick={()=>setEv(null)}>Cancelar</button><button className="fg-btn">Enviar al admin</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---- RETOS: se crean en Administrar; completados NO aparecen en activos ---- */
function Retos({ notify, refreshUser }) {
  const [tab, setTab] = useState('activos');
  const [retos, setRetos] = useState([]);
  const load = async()=>setRetos(await api.retos().catch(()=>[]));
  useEffect(()=>{ load(); }, []);
  const activos = retos.filter(r=>!r.completado);
  const comp = retos.filter(r=>r.completado);
  const show = tab==='activos' ? activos : comp;
  async function avanzar(r) {
    const res = await api.avanzarReto(r.id).catch(e=>{ notify?.(e.message); return null; });
    if (!res) return;
    if (res.reto.completado && !r.completado) notify?.(`¡Reto "${r.titulo}" completado! +${r.puntos} EcoPuntos 🏆`);
    else notify?.(`Avance: ${res.reto.avance}/${r.meta} ${r.unidad}`);
    refreshUser?.(); load();
  }
  return (
    <div>
      <div className="fg-head"><div><h1 className="fg-h1">Retos</h1><div className="fg-sub">Acepta desafíos y gana puntos ayudando al planeta.</div></div></div>
      <div className="fg-tabs">
        <button className={'fg-tab'+(tab==='activos'?' on':'')} onClick={()=>setTab('activos')}>Activos ({activos.length})</button>
        <button className={'fg-tab'+(tab==='comp'?' on':'')} onClick={()=>setTab('comp')}>Completados ({comp.length})</button>
      </div>
      {show.length===0 && <div className="fg-panel">{tab==='activos' ? '🎉 ¡Sin retos pendientes! El admin puede asignarte nuevos.' : 'Aún no completas retos. ¡Ánimo! 💪'}</div>}
      {show.map((r)=>(
        <div className="fg-act" key={r.id}>
          <span className="fg-circle" style={{background:r.fondo || '#eaf5ec', color:'#1c2b1c'}}>{r.icono || '🌱'}</span>
          <span style={{flex:1}}><b>{r.titulo}</b><br/><small>{r.descripcion}</small><br/><small>{r.avance} / {r.meta} {r.unidad}</small><div className="fg-bar"><i style={{width:Math.round(r.avance/r.meta*100)+'%'}}/></div></span>
          <span style={{textAlign:'right'}}><b style={{color:'var(--green)'}}>+{r.puntos}<br/><small>puntos</small></b><br/>
          {!r.completado
            ? <button className="fg-btn sm" onClick={()=>avanzar(r)}>Avanzar +1</button>
            : <span className="fg-pill">Completado 🏆</span>}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- REPORTES con foto ---- */
function ClickPicker({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng); } });
  return null;
}
function Chart({ data }) {
  const max = Math.max(4, ...data);
  const pts = data.map((v,i)=>`${(i*(480/(Math.max(1,data.length-1)))).toFixed(0)},${(190-(v/max)*160).toFixed(0)}`).join(' ');
  return (
    <svg className="fg-chart" viewBox="0 0 500 210">
      {[40,80,120,160].map(y=><line key={y} x1="30" x2="500" y1={y} y2={y} stroke="#eef2ee" />)}
      {[0,2,4,6,8].map((v,i)=><text key={v} x="0" y={190-i*38} fontSize="11" fill="#8a978a">{Math.round(max/4*v)}</text>)}
      {['S-4','S-3','S-2','S-1','Ahora'].map((d,i)=><text key={d} x={60+i*100} y="208" fontSize="11" fill="#8a978a">{d}</text>)}
      {data.length > 1 && <><polyline points={pts} fill="none" stroke="#0e7a2f" strokeWidth="2.5" /><polygon points={'0,190 '+pts+' 480,210 0,210'} fill="rgba(14,122,47,.10)" /></>}
      {pts.split(' ').map((p,i)=><circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r="3.5" fill="#0e7a2f" />)}
    </svg>
  );
}
function Reportes({ user, notify, refreshUser, zoom }) {
  const [list, setList] = useState([]);
  const [period, setPeriod] = useState('mes');
  const [form, setForm] = useState({ titulo:'', descripcion:'', categoria:'residuos', lat:3.3769, lng:-76.5328, comuna:'Comuna 17' });
  const [foto, setFoto] = useState(null);
  const load = async()=>setList(await api.reportes().catch(()=>[]));
  useEffect(()=>{ load(); }, []);
  const filtered = useMemo(()=>{
    const now = Date.now();
    const lim = period==='mes' ? 30*864e5 : period==='ano' ? 365*864e5 : Infinity;
    return list.filter(r => now - new Date(r.createdAt).getTime() <= lim);
  }, [list, period]);
  const buckets = useMemo(()=>{
    const b=[0,0,0,0,0]; const now=Date.now();
    filtered.forEach(r=>{ const d=(now-new Date(r.createdAt).getTime())/864e5; const i=d<7?4:d<14?3:d<21?2:d<28?1:0; b[i]++; });
    return b;
  }, [filtered]);
  const co2 = (filtered.filter(r=>r.estado==='solucionado').length*12 + filtered.length*2) / 10;
  return (
    <div>
      <div className="fg-head"><div><h1 className="fg-h1">Reportes</h1><div className="fg-sub">Consulta tu impacto ambiental.</div></div>
        <select className="fg-sel" style={{marginLeft:'auto', height:38}} value={period} onChange={e=>{setPeriod(e.target.value); notify?.('Filtro: '+e.target.selectedOptions[0].text);}}>
          <option value="mes">Este mes</option><option value="ano">Este año</option><option value="todo">Todos</option>
        </select></div>
      <div className="fg-cards4" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="fg-stat" style={{textAlign:'left'}}><span>Reportes<br/>en periodo</span><b>{filtered.length}</b></div>
        <div className="fg-stat" style={{textAlign:'left'}}><span>Mis puntos<br/>acumulados</span><b>{user.ecoPuntos || 0}</b></div>
        <div className="fg-stat" style={{textAlign:'left'}}><span>CO₂ evitado</span><b>{co2.toFixed(1)} <small>kg</small> 🌱</b></div>
      </div>
      <div className="fg-panel"><div style={{display:'flex'}}><h3>Impacto ambiental</h3><span style={{flex:1}}/><button className="fg-btn sm ghost" onClick={()=>{load(); notify?.('Gráfica actualizada 📊');}}>Actualizar</button></div><small style={{color:'#8a978a'}}>reportes por semana</small><Chart data={buckets} /></div>
      <div className="fg-panel">
        <h3>Mapa de reportes — Cali sur 🗺️</h3>
        <div className="fg-sub">Clic en el mapa para fijar ubicación + adjunta foto como evidencia.</div>
        <div className="fg-map">
          <MapContainer center={[3.3769,-76.5328]} zoom={13} style={{height:'100%',width:'100%'}}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickPicker onPick={(ll)=>setForm(f=>({...f, lat:+ll.lat.toFixed(5), lng:+ll.lng.toFixed(5)}))} />
            {filtered.map(r=>(<Marker key={r.id} position={[r.lat,r.lng]}><Popup><b>{r.titulo}</b><br/>{r.estado}{r.foto && <><br/><img src={r.foto} alt="tocar para ampliar" title="Tocar para ampliar" style={{width:140, borderRadius:8, marginTop:4, cursor:'zoom-in'}} onClick={()=>zoom?.(r.foto)} /></>}</Popup></Marker>))}
          </MapContainer>
        </div>
        <form className="fg-form" style={{marginTop:12}} onSubmit={async e=>{
          e.preventDefault();
          const r = await api.crearReporte({...form, foto}).catch(err=>{notify?.(err.message); return null;});
          if(!r) return;
          setForm({...form,titulo:'',descripcion:''}); setFoto(null); load(); refreshUser?.(); notify?.('Reporte creado +20 EcoPuntos 🌿');
        }}>
          <div style={{display:'flex', gap:10}}>
            <input placeholder="Título del reporte" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} required />
            <select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} style={{maxWidth:150}}>
              <option value="residuos">Residuos</option><option value="poda">Poda</option><option value="reciclaje">Reciclaje</option><option value="rio">Río</option><option value="ruido">Ruido</option>
            </select>
          </div>
          <input placeholder="Descripción" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} required />
          <label>📸 Foto del reporte (opcional)</label>
          <input type="file" accept="image/*" onChange={async e=>{ const fl=e.target.files[0]; if(fl) setFoto(await fileToPhoto(fl)); }} />
          {foto && <img src={foto} alt="reporte" title="Tocar para ampliar" style={{width:'100%', maxHeight:220, objectFit:'cover', borderRadius:10, cursor:'zoom-in'}} onClick={()=>zoom?.(foto)} />}
          <button className="fg-btn" style={{width:'auto', padding:'10px 26px', marginTop:8}}>Enviar reporte ({form.lat}, {form.lng})</button>
        </form>
      </div>
      {filtered.map(r=>(
        <div className="fg-act" key={r.id}>
          {r.foto ? <img src={r.foto} alt="tocar para ampliar" title="Tocar para ampliar" style={{width:56, height:56, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in'}} onClick={()=>zoom?.(r.foto)} /> : <span className="fg-circle" style={{background:r.estado==='solucionado'?'#1d9e4b':'#f5b301'}}>📍</span>}
          <span style={{flex:1}}><b>{r.titulo}</b> <span className="fg-pill">{r.estado}</span><br/><small>{r.descripcion} — {r.comuna} · {r.validaciones} validaciones</small></span>
          <span style={{display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end'}}>
            {r.validadoPorMi
              ? <span className="fg-pill">Validado ✓</span>
              : <button className="fg-btn sm ghost" onClick={async()=>{ try { await api.validar(r.id); notify?.('¡Validación sumada! ✅'); } catch(e){ notify?.(e.message); } load(); }}>Validar</button>}
            {r.estado!=='solucionado' && <button className="fg-btn sm" onClick={async()=>{ await api.cambiarEstado(r.id,'solucionado'); load(); notify?.('Marcado como solucionado 🎉'); }}>Solucionar</button>}
            {r.estado!=='solucionado' && (r.userId===user.id || isAdmin(user)) && <button className="fg-btn sm danger" onClick={async()=>{ if(!confirm('¿Borrar este reporte?')) return; try { await api.borrarReporte(r.id); notify?.('Reporte borrado'); } catch(e){ notify?.(e.message); } load(); }}>Borrar</button>}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---- COMUNIDAD ---- */
function Comunidad({ notify }) {
  const [rank, setRank] = useState([]);
  const [pend, setPend] = useState([]);
  useEffect(()=>{ api.ranking().then(setRank).catch(()=>{}); api.reportes().then(r=>setPend(r.filter(x=>x.estado==='pendiente').slice(0,5))).catch(()=>{}); }, []);
  function invitar() {
    try { navigator.clipboard.writeText('Únete a FriendlyGreen Cali: ' + location.href); notify?.('¡Enlace de invitación copiado! 💌'); }
    catch { prompt('Copia tu enlace de invitación:', location.href); }
  }
  return (
    <div>
      <div className="fg-head"><div><h1 className="fg-h1">Comunidad</h1><div className="fg-sub">Validación comunitaria y ranking EcoPuntos.</div></div>
        <button className="fg-new" onClick={invitar}>＋ Invitar amigos</button></div>
      <div className="fg-panel"><h3>🏆 Ranking EcoPuntos</h3>
        {rank.map((u,i)=><div className="fg-row" key={i}><b style={{width:26}}>{i+1}.</b><span className="fg-dot">{['🥇','🥈','🥉','🌱','🌿'][Math.min(i,4)]}</span><span><b>{u.name} {u.me?'(tú)':''}</b><small>{u.reportes} reportes</small></span><span className="fg-pts">{u.ecoPuntos} pts</span></div>)}
      </div>
      <div className="fg-panel"><h3>Reportes por validar</h3>
        {pend.length===0 && <div className="fg-mini">No hay pendientes. ¡Buen trabajo! 🎉</div>}
        {pend.map(r=><div className="fg-row" key={r.id}><span style={{flex:1}}><b>{r.titulo}</b><small>{r.comuna} · {r.validaciones} validaciones</small></span>{r.validadoPorMi ? <span className="fg-pill">Validado ✓</span> : <button className="fg-btn sm" onClick={async()=>{ try { await api.validar(r.id); notify?.('Validaste "'+r.titulo+'" ✅'); } catch(e){ notify?.(e.message); } setPend(pend.filter(x=>x.id!==r.id)); }}>Validar</button>}</div>)}
      </div>
    </div>
  );
}

/* ---- RECURSOS ---- */
const RECS = [
  { t:'Guía de reciclaje DAGMA', d:'Cómo separar en la fuente en Cali.', tag:'PDF · DAGMA', url:'https://www.cali.gov.co/dagma/' },
  { t:'Puntos limpios zona sur', d:'Ubica contenedores y jornadas.', tag:'Mapa', url:'https://www.cali.gov.co/' },
  { t:'Ley 99 de 1993 resumida', d:'Marco ambiental colombiano.', tag:'Legal', url:'https://www.minambiente.gov.co/' },
  { t:'Habeas Data Ley 1581', d:'Tus datos en FriendlyGreen.', tag:'Legal', url:'https://www.sic.gov.co/' },
];
function Recursos({ notify }) {
  const [q, setQ] = useState('');
  function descargar(r) {
    const blob = new Blob([`${r.t}\n\n${r.d}\n\nFuente: ${r.url}\nFriendlyGreen UNAD 202337119_122`], {type:'text/plain'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = r.t.replace(/\s+/g,'_') + '.txt'; a.click();
    notify?.('Guía "'+r.t+'" descargada 📥');
  }
  return (
    <div>
      <h1 className="fg-h1">Recursos</h1><div className="fg-sub">Educación ambiental y normativa.</div>
      <div className="fg-search"><div className="fg-input">🔍<input placeholder="Buscar guía..." value={q} onChange={e=>setQ(e.target.value)} /></div></div>
      {RECS.filter(r=>(r.t+r.d).toLowerCase().includes(q.toLowerCase())).map((r,i)=>(
        <div className="fg-act" key={i}><span className="fg-circle" style={{background:'#0e7a2f'}}>📚</span>
          <span style={{flex:1}}><b>{r.t}</b><br/><small>{r.d}</small><br/><span className="fg-pill">{r.tag}</span></span>
          <span style={{display:'flex', gap:6}}><button className="fg-btn sm ghost" onClick={()=>descargar(r)}>Descargar</button><button className="fg-btn sm" onClick={()=>{ window.open(r.url,'_blank'); notify?.('Abriendo '+r.t+' 🔗'); }}>Abrir</button></span>
        </div>
      ))}
    </div>
  );
}

/* ---- PERFIL ---- */
function Perfil({ user, setUser, notify, onExit }) {
  const [p, setP] = useState(null);
  const [name, setName] = useState(user.name);
  const [av, setAv] = useState(avatar());
  const [pw, setPw] = useState(false);
  const [cur, setCur] = useState(''); const [nxt, setNxt] = useState('');
  const load = async()=>setP(await api.perfil().catch(()=>null));
  useEffect(()=>{ load(); }, []);
  function pick(a){ setAv(a); localStorage.setItem('fg_avatar', a); notify?.('Avatar actualizado '+a); }
  async function save(){ const u=await api.guardarPerfil({name}).catch(e=>{notify?.(e.message); return null;}); if(u){ setUser(u); notify?.('Perfil guardado ✅'); } }
  async function exportar(){
    const data = await api.perfil().catch(()=>null);
    const blob = new Blob([JSON.stringify(data || user, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mis_datos_friendlygreen.json'; a.click();
    notify?.('Datos exportados (Habeas Data) 📦');
  }
  return (
    <div className="fg-panel fg-form">
      <h1 className="fg-h1">Ajuste de perfil {isAdmin(user) && <span className="fg-pill">ADMIN</span>}</h1>
      <div className="fg-sub">{user.email} · 🌿 {p?.ecoPuntos ?? user.ecoPuntos} EcoPuntos</div>
      <label>Avatar</label>
      <div style={{display:'flex', gap:8, fontSize:26}}>{['👩','🧑','👨','🧓','🦸','🐢'].map(a=><span key={a} className="fg-click" style={av===a?{outline:'3px solid #0e7a2f', borderRadius:'50%'}:{}} onClick={()=>pick(a)}>{a}</span>)}</div>
      <label>Nombre</label><input value={name} onChange={e=>setName(e.target.value)} />
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <button className="fg-btn sm" onClick={save}>Guardar cambios</button>
        <button className="fg-btn sm ghost" onClick={()=>setPw(true)}>Cambiar contraseña</button>
        <button className="fg-btn sm ghost" onClick={exportar}>Exportar mis datos</button>
        <button className="fg-btn sm danger" onClick={async()=>{ if(!confirm('¿Eliminar tu cuenta y tus reportes?')) return; const r = await api.eliminarCuenta().catch(e=>{notify?.(e.message); return null;}); if(r){ onExit(); notify?.('Cuenta eliminada'); } }}>Eliminar cuenta</button>
      </div>
      <h3 style={{marginTop:18}}>Mis reportes ({(p?.reportes||[]).length})</h3>
      {(p?.reportes||[]).map(r=><div className="fg-row" key={r.id}><span style={{flex:1}}><b>{r.titulo}</b><small>{r.estado}</small></span>{r.estado!=='solucionado' && <button className="fg-btn sm danger" onClick={async()=>{ if(!confirm('¿Borrar?')) return; try { await api.borrarReporte(r.id); notify?.('Reporte borrado'); } catch(e){ notify?.(e.message); } load(); }}>Borrar</button>}</div>)}
      {pw && (
        <div className="fg-modal-bg" onClick={()=>setPw(false)}>
          <form className="fg-modal fg-form" onClick={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault(); try { await api.changePassword(cur,nxt); } catch(err){ notify?.(err.message); return; } setPw(false); setCur(''); setNxt(''); notify?.('Contraseña actualizada 🔒');}}>
            <h3>Cambiar contraseña</h3>
            <label>Actual</label><input type="password" value={cur} onChange={e=>setCur(e.target.value)} required />
            <label>Nueva (mín. 6)</label><input type="password" value={nxt} onChange={e=>setNxt(e.target.value)} required />
            <div style={{display:'flex', gap:10}}><button type="button" className="fg-btn ghost" onClick={()=>setPw(false)}>Cancelar</button><button className="fg-btn">Guardar</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---- CONFIG ---- */
function Config({ notify }) {
  const [cfg, setCfg] = useState(() => JSON.parse(localStorage.getItem('fg_cfg') || '{"noti":true,"ubi":true,"pub":false}'));
  function set(k,v){ const c={...cfg,[k]:v}; setCfg(c); localStorage.setItem('fg_cfg', JSON.stringify(c)); }
  return (
    <div className="fg-panel">
      <h1 className="fg-h1">Configuración</h1><div className="fg-sub">Notificaciones y privacidad (Ley 1581 de 2012).</div>
      <div className="fg-toggle"><span>🔔 Notificaciones de retos y reportes</span><input type="checkbox" checked={cfg.noti} onChange={e=>set('noti',e.target.checked)} /></div>
      <div className="fg-toggle"><span>📍 Compartir mi ubicación en reportes</span><input type="checkbox" checked={cfg.ubi} onChange={e=>set('ubi',e.target.checked)} /></div>
      <div className="fg-toggle"><span>🌍 Perfil público en ranking</span><input type="checkbox" checked={cfg.pub} onChange={e=>set('pub',e.target.checked)} /></div>
      <div style={{display:'flex', gap:8, marginTop:14}}>
        <button className="fg-btn sm" onClick={()=>notify?.(cfg.noti?'Notificaciones activadas 🔔':'Notificaciones pausadas 🔕')}>Probar notificación</button>
        <button className="fg-btn sm ghost" onClick={()=>{ localStorage.removeItem('fg_cfg'); localStorage.removeItem('fg_done_act'); notify?.('Preferencias restablecidas ♻️'); }}>Restablecer</button>
      </div>
      <p className="fg-mini" style={{marginTop:14}}>Tus datos se usan solo para el piloto UNAD (100 usuarios). Puedes exportarlos o eliminarlos desde Perfil.</p>
    </div>
  );
}

/* ---- ADMINISTRAR (solo admin) ---- */
function Administrar({ notify, refreshUser, zoom }) {
  const [tab, setTab] = useState('validaciones');
  const [pend, setPend] = useState([]);
  const [acts, setActs] = useState([]);
  const [retos, setRetos] = useState([]);
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ titulo:'', descripcion:'', tipo:'reciclaje', puntos:50, fecha:'', hora:'' });
  const [fr, setFr] = useState({ titulo:'', descripcion:'', meta:5, unidad:'actividades', puntos:100 });
  const load = async () => {
    setPend(await api.validaciones().catch(()=>[]));
    setActs(await api.actividades().catch(()=>[]));
    // admin ve todos los retos (asignados o no)
    setRetos(await api.retos().catch(()=>[]));
    setUsers(await api.adminUsers().catch(()=>[]));
  };
  useEffect(()=>{ load(); }, []);
  return (
    <div>
      <h1 className="fg-h1">🛡️ Administrar</h1>
      <div className="fg-sub">Crea actividades/retos (se asignan solos a todos), valida evidencias y gestiona roles.</div>
      <div className="fg-tabs">
        {[['validaciones','Validaciones'+(pend.length?` (${pend.length})`:'')],['actividades','Actividades'],['retos','Retos'],['usuarios','Usuarios']].map(([v,l])=>(
          <button key={v} className={'fg-tab'+(tab===v?' on':'')} onClick={()=>{setTab(v); load();}}>{l}</button>
        ))}
      </div>

      {tab==='validaciones' && (<div className="fg-panel">
        <h3>Evidencias pendientes ({pend.length})</h3>
        <div className="fg-mini">Al validar se otorgan los puntos al usuario. Al rechazar puede reenviar.</div>
        {pend.length===0 && <p className="fg-mini">Sin pendientes 🎉</p>}
        {pend.map((p,i)=>(
          <div className="fg-act" key={i}>
            <span className="fg-circle" style={{background:'#f5b301'}}>📤</span>
            <span style={{flex:1}}><b>{p.titulo}</b> <span className="fg-pill">+{p.puntos} pts</span><br/>
              <small>{p.name} ({p.email})</small><br/><small>“{p.evidencia}”</small>
              {p.foto && <><br/><img src={p.foto} alt="tocar para ampliar" title="Tocar para ampliar" style={{width:120, borderRadius:8, marginTop:6, cursor:'zoom-in'}} onClick={()=>zoom?.(p.foto)} /></>}</span>
            <span style={{display:'flex', gap:6}}>
              <button className="fg-btn sm" onClick={async()=>{ const r=await api.validarAsignacion(p.actividad_id, p.user_id, 'validar'); notify?.(r.message||'Validada ✅'); load(); }}>Validar</button>
              <button className="fg-btn sm danger" onClick={async()=>{ await api.validarAsignacion(p.actividad_id, p.user_id, 'rechazar'); notify?.('Rechazada'); load(); }}>Rechazar</button>
            </span>
          </div>
        ))}
      </div>)}

      {tab==='actividades' && (<>
        <div className="fg-panel fg-form">
          <h3>Crear actividad (se asigna sola a todos los usuarios) 🌱</h3>
          <form onSubmit={async e=>{e.preventDefault(); await api.crearActividad(f); setF({ titulo:'', descripcion:'', tipo:'reciclaje', puntos:50, fecha:'', hora:'' }); notify?.('Actividad creada y asignada ✅'); load();}}>
            <div style={{display:'flex', gap:10}}>
              <span style={{flex:2}}><label>Título</label><input value={f.titulo} onChange={e=>setF({...f,titulo:e.target.value})} required /></span>
              <span style={{flex:1}}><label>Puntos</label><input type="number" min="5" max="500" value={f.puntos} onChange={e=>setF({...f,puntos:e.target.value})} /></span>
            </div>
            <label>Descripción</label><input value={f.descripcion} onChange={e=>setF({...f,descripcion:e.target.value})} required />
            <div style={{display:'flex', gap:10}}>
              <span style={{flex:1}}><label>Categoría</label><select value={f.tipo} onChange={e=>setF({...f,tipo:e.target.value})}><option value="reciclaje">Reciclaje</option><option value="limpieza">Limpieza</option><option value="energia">Energía</option><option value="agua">Agua</option><option value="reto">Reto</option></select></span>
              <span style={{flex:1}}><label>Fecha</label><input type="date" value={f.fecha} onChange={e=>setF({...f,fecha:e.target.value})} /></span>
              <span style={{flex:1}}><label>Hora</label><input type="time" value={f.hora} onChange={e=>setF({...f,hora:e.target.value})} /></span>
            </div>
            <button className="fg-btn" style={{width:'auto', padding:'10px 26px'}}>Publicar y asignar actividad</button>
          </form>
        </div>
        {acts.map(a=>(
          <div className="fg-act" key={a.id}><span className="fg-circle" style={{background:'#1d9e4b'}}>🌱</span>
            <span style={{flex:1}}><b>{a.titulo}</b> <span className="fg-pill">+{a.puntos}</span><br/><small>{a.descripcion} · {fmtFecha(a.fecha)} · {a.participantes?.length||0} registros</small></span>
          </div>
        ))}
      </>)}

      {tab==='retos' && (<>
        <div className="fg-panel fg-form">
          <h3>Crear reto (se asigna solo a todos los usuarios) 🏆</h3>
          <form onSubmit={async e=>{e.preventDefault(); await api.crearReto(fr); setFr({ titulo:'', descripcion:'', meta:5, unidad:'actividades', puntos:100 }); notify?.('Reto creado y asignado ✅'); load();}}>
            <label>Título</label><input value={fr.titulo} onChange={e=>setFr({...fr,titulo:e.target.value})} required />
            <label>Descripción</label><input value={fr.descripcion} onChange={e=>setFr({...fr,descripcion:e.target.value})} required />
            <div style={{display:'flex', gap:10}}>
              <span style={{flex:1}}><label>Meta</label><input type="number" min="1" value={fr.meta} onChange={e=>setFr({...fr,meta:e.target.value})} /></span>
              <span style={{flex:1}}><label>Puntos</label><input type="number" min="5" value={fr.puntos} onChange={e=>setFr({...fr,puntos:e.target.value})} /></span>
              <span style={{flex:1}}><label>Unidad</label><input value={fr.unidad} onChange={e=>setFr({...fr,unidad:e.target.value})} placeholder="actividades, días..." /></span>
            </div>
            <button className="fg-btn" style={{width:'auto', padding:'10px 26px'}}>Publicar y asignar reto</button>
          </form>
        </div>
        {retos.map(t=>(
          <div className="fg-act" key={t.id}><span className="fg-circle" style={{background:t.fondo || '#eaf5ec', color:'#1c2b1c'}}>{t.icono || '🌱'}</span>
            <span style={{flex:1}}><b>{t.titulo}</b> <span className="fg-pill">+{t.puntos}</span><br/><small>{t.descripcion} · meta {t.meta} {t.unidad}</small></span>
          </div>
        ))}
      </>)}

      {tab==='usuarios' && (<div className="fg-panel">
        <h3>Usuarios registrados ({users.length})</h3>
        {users.map(u=>(
          <div className="fg-row" key={u.id}>
            <span className="fg-dot">{u.role==='admin'?'🛡️':'👤'}</span>
            <span style={{flex:1}}><b>{u.name} {u.role==='admin' && <span className="fg-pill">ADMIN</span>}</b><small>{u.email} · 🌿 {u.ecoPuntos} pts · {u.reportes} reportes</small></span>
            {u.role!=='admin'
              ? <button className="fg-btn sm" onClick={async()=>{ await api.cambiarRol(u.id,'admin'); notify?.(`${u.name} ahora es admin 🛡️`); load(); refreshUser?.(); }}>Hacer admin</button>
              : <button className="fg-btn sm ghost" onClick={async()=>{ try { await api.cambiarRol(u.id,'usuario'); notify?.(`${u.name} vuelve a usuario`); } catch(e){ notify?.(e.message); return; } load(); refreshUser?.(); }}>Quitar admin</button>}
          </div>
        ))}
      </div>)}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('inicio');
  const [side, setSide] = useState(true);
  const [bell, setBell] = useState(false);
  const [umenu, setUmenu] = useState(false);
  const [toast, setToast] = useState('');
  const notify = (m) => { setToast(m); clearTimeout(window.__fg_t); window.__fg_t = setTimeout(()=>setToast(''), 2600); };
  const refreshUser = async () => { try { setUser(await api.me()); } catch {} };
  const [notis, setNotis] = useState([]);
  const [light, setLight] = useState(null); // foto ampliada (lightbox)

  useEffect(()=>{
    if (localStorage.getItem('fg_token')) api.me().then(setUser).catch(()=>localStorage.removeItem('fg_token'));
  }, []);
  useEffect(()=>{
    if (!user) return;
    Promise.all([api.reportes().catch(()=>[]), api.retos().catch(()=>[])]).then(([reps, retos])=>{
      const n = [];
      reps.filter(r=>r.estado==='pendiente').slice(0,2).forEach(r=>n.push({text:`"${r.titulo}" espera validación`, go:'reportes'}));
      retos.filter(r=>!r.completado).slice(0,1).forEach(r=>n.push({text:`${r.titulo}: ${r.avance}/${r.meta}`, go:'retos'}));
      setNotis(n);
    });
  }, [user, view]);

  const exit = () => { localStorage.removeItem('fg_token'); setUser(null); setView('inicio'); };
  if (!user) return (<><Login onAuth={setUser} notify={notify} />{toast && <div className="fg-toast">{toast}</div>}</>);
  const go = (v) => { if (v==='__exit') { exit(); return; } setView(v); setBell(false); setUmenu(false); };
  const v = (view==='admin' && !isAdmin(user)) ? 'inicio' : view;
  return (
    <div className="fg-app">
      <Topbar user={user} onMenu={()=>setSide(!side)} onBell={()=>{setBell(!bell); setUmenu(false);}} onUser={()=>{setUmenu(!umenu); setBell(false);}}
        showBell={bell} showUser={umenu} notis={notis}
        onOpenNoti={(n)=>{ setBell(false); go(n.go); }} onUserGo={go} onClose={()=>{setBell(false); setUmenu(false);}} />
      <div className={'fg-body' + (side ? '' : ' noside')}>
        <Sidebar view={v} setView={(x)=>{setView(x);}} onExit={exit} open={side} user={user} />
        <main className="fg-main">
          {v==='inicio' && <Inicio user={user} go={go} notify={notify} />}
          {v==='actividades' && <Actividades user={user} notify={notify} refreshUser={refreshUser} go={go} />}
          {v==='retos' && <Retos user={user} notify={notify} refreshUser={refreshUser} />}
          {v==='reportes' && <Reportes user={user} notify={notify} refreshUser={refreshUser} zoom={setLight} />}
          {v==='comunidad' && <Comunidad notify={notify} />}
          {v==='recursos' && <Recursos notify={notify} />}
          {v==='perfil' && <Perfil user={user} setUser={setUser} notify={notify} onExit={exit} />}
          {v==='config' && <Config notify={notify} />}
          {v==='admin' && isAdmin(user) && <Administrar notify={notify} refreshUser={refreshUser} zoom={setLight} />}
        </main>
      </div>
      {light && (
        <div className="fg-modal-bg" onClick={()=>setLight(null)} style={{zIndex:70}}>
          <img src={light} alt="ampliada" style={{maxWidth:'92vw', maxHeight:'88vh', borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,.4)'}} onClick={e=>e.stopPropagation()} />
        </div>
      )}
      {toast && <div className="fg-toast">{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
