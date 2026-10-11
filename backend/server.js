// FriendlyGreen API - UNAD Fase 3 (202337119_122)
// Backend: Node.js + Express + MySQL (XAMPP local). Sin MongoDB.
// Roles: admin crea actividades/retos, los asigna y valida evidencias (puntos solo al validar).
//        usuario normal: reportes con foto, actividades públicas, asignadas con evidencia, retos.
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { pool, checkDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'friendlygreen_unad_2026_secret';

app.use(cors());
app.use(express.json({ limit: '8mb' })); // fotos base64 en reportes/evidencias

const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 9999);

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Token inválido' }); }
}
async function requireAdmin(req, res, next) {
  const [[u]] = await pool.query('SELECT role FROM users WHERE id=?', [req.auth.id]);
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  next();
}
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, ecoPuntos: u.eco_puntos ?? 0, role: u.role || 'usuario', createdAt: u.created_at });

app.get('/api/health', async (req, res) => {
  try { await checkDb(); res.json({ ok: true, app: 'FriendlyGreen API', db: 'mysql' }); }
  catch (e) { res.status(500).json({ ok: false, error: 'MySQL no disponible. Enciende XAMPP MySQL. ' + e.message }); }
});

// ---------- Auth ----------
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email y password requeridos' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password mínimo 6 caracteres' });
  try {
    const [ex] = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER(?)', [email]);
    if (ex.length) return res.status(409).json({ error: 'Email ya registrado' });
    const id = uid('u');
    await pool.query("INSERT INTO users (id, name, email, password_hash, eco_puntos, role) VALUES (?,?,?,?,50,'usuario')", [id, name, email, bcrypt.hashSync(password, 8)]);
    // El nuevo usuario hereda todo lo ya asignado (actividades y retos con asignación automática)
    await pool.query(`INSERT IGNORE INTO actividad_asignaciones (actividad_id, user_id) SELECT DISTINCT actividad_id, ? FROM actividad_asignaciones`, [id]);
    await pool.query(`INSERT IGNORE INTO reto_asignaciones (reto_id, user_id) SELECT DISTINCT reto_id, ? FROM reto_asignaciones`, [id]);
    const [[u]] = await pool.query('SELECT * FROM users WHERE id=?', [id]);
    res.json({ token: sign(u), user: pub(u) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const [[u]] = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER(?)', [email || '']);
    if (!u || !bcrypt.compareSync(password || '', u.password_hash))
      return res.status(401).json({ error: 'Credenciales inválidas' });
    res.json({ token: sign(u), user: pub(u) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const [[u]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  res.json(pub(u));
});

app.post('/api/auth/recover', async (req, res) => {
  const { email, newPassword } = req.body || {};
  if (!email || !newPassword || String(newPassword).length < 6)
    return res.status(400).json({ error: 'email y newPassword (mín. 6) requeridos' });
  const [[u]] = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER(?)', [email]);
  if (!u) return res.status(404).json({ error: 'Si el correo existe, podrás entrar con tu nueva clave' });
  await pool.query('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(newPassword, 8), u.id]);
  res.json({ ok: true, message: 'Clave actualizada. Entra con tu nueva contraseña.' });
});

app.put('/api/auth/password', auth, async (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next || String(next).length < 6) return res.status(400).json({ error: 'current y next (mín. 6) requeridos' });
  const [[u]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  if (!u || !bcrypt.compareSync(current, u.password_hash)) return res.status(401).json({ error: 'Tu clave actual no coincide' });
  await pool.query('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(next, 8), u.id]);
  res.json({ ok: true });
});

// ---------- Dashboard: contadores reales por usuario ----------
app.get('/api/dashboard/stats', auth, async (req, res) => {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) total FROM reportes');
  const [[{ sol }]] = await pool.query("SELECT COUNT(*) sol FROM reportes WHERE estado='solucionado'");
  const [cats] = await pool.query('SELECT categoria, COUNT(*) n FROM reportes GROUP BY categoria');
  const [[me]] = await pool.query('SELECT eco_puntos FROM users WHERE id=?', [req.auth.id]);
  const [[{ users }]] = await pool.query('SELECT COUNT(*) users FROM users');
  const [[{ acts }]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM actividad_participantes WHERE user_id=?) +
            (SELECT COUNT(*) FROM actividad_asignaciones WHERE user_id=? AND estado='validada') acts`,
    [req.auth.id, req.auth.id]);
  const [[{ retos }]] = await pool.query(`SELECT COUNT(*) retos FROM progreso_retos WHERE user_id=? AND completado=1`, [req.auth.id]);
  const porCategoria = {}; cats.forEach(c => porCategoria[c.categoria] = c.n);
  res.json({
    usuarios: users, reportes: total, solucionados: sol, pendientes: total - sol,
    ecoPuntos: me ? me.eco_puntos : 0,
    actividadesRealizadas: acts, retosCompletados: retos,
    co2EvitadoKg: sol * 12 + total * 2,
    porCategoria, crecimiento: [100, 300, 1000, 2500, 6000, 12000]
  });
});

// ---------- Reportes (con foto opcional) ----------
const mapRep = (r) => ({ id: r.id, userId: r.user_id, titulo: r.titulo, descripcion: r.descripcion, categoria: r.categoria, lat: Number(r.lat), lng: Number(r.lng), comuna: r.comuna, estado: r.estado, validaciones: r.validaciones, foto: r.foto || null, createdAt: r.created_at });

app.get('/api/reportes', async (req, res) => {
  // Auth opcional: si viene token, marca validadoPorMi (una validación por usuario)
  let meId = null;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try { meId = jwt.verify(h.slice(7), JWT_SECRET).id; } catch {}
  }
  const [rows] = await pool.query('SELECT * FROM reportes ORDER BY created_at DESC');
  let mias = new Set();
  if (meId) {
    const [v] = await pool.query('SELECT reporte_id FROM reporte_validaciones WHERE user_id=?', [meId]);
    mias = new Set(v.map(x => x.reporte_id));
  }
  res.json(rows.map(r => ({ ...mapRep(r), validadoPorMi: mias.has(r.id) })));
});

app.post('/api/reportes', auth, async (req, res) => {
  const { titulo, descripcion, categoria, lat, lng, comuna, foto } = req.body || {};
  if (!titulo || !descripcion || lat == null || lng == null) return res.status(400).json({ error: 'titulo, descripcion, lat, lng requeridos' });
  const id = uid('r');
  await pool.query('INSERT INTO reportes (id, user_id, titulo, descripcion, categoria, lat, lng, comuna, foto) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, req.auth.id, titulo, descripcion, categoria || 'residuos', Number(lat), Number(lng), comuna || 'Cali', foto || null]);
  await pool.query('UPDATE users SET eco_puntos = eco_puntos + 20 WHERE id=?', [req.auth.id]);
  const [[r]] = await pool.query('SELECT * FROM reportes WHERE id=?', [id]);
  res.status(201).json(mapRep(r));
});

app.put('/api/reportes/:id/validar', auth, async (req, res) => {
  // Una sola validación por usuario
  const [ya] = await pool.query('SELECT * FROM reporte_validaciones WHERE reporte_id=? AND user_id=?', [req.params.id, req.auth.id]);
  if (ya.length) return res.status(400).json({ error: 'Ya validaste este reporte' });
  await pool.query('INSERT INTO reporte_validaciones (reporte_id, user_id) VALUES (?,?)', [req.params.id, req.auth.id]);
  await pool.query('UPDATE reportes SET validaciones = validaciones + 1 WHERE id=?', [req.params.id]);
  await pool.query("UPDATE reportes SET estado='validado' WHERE id=? AND estado='pendiente' AND validaciones>=10", [req.params.id]);
  const [[r]] = await pool.query('SELECT * FROM reportes WHERE id=?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ...mapRep(r), validadoPorMi: true });
});

app.put('/api/reportes/:id/estado', auth, async (req, res) => {
  const { estado } = req.body || {};
  if (!['pendiente', 'validado', 'solucionado'].includes(estado)) return res.status(400).json({ error: 'estado inválido' });
  await pool.query('UPDATE reportes SET estado=? WHERE id=?', [estado, req.params.id]);
  const [[r]] = await pool.query('SELECT * FROM reportes WHERE id=?', [req.params.id]);
  res.json(mapRep(r));
});

app.delete('/api/reportes/:id', auth, async (req, res) => {
  const [[r]] = await pool.query('SELECT user_id, estado FROM reportes WHERE id=?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.estado === 'solucionado') return res.status(400).json({ error: 'Un reporte solucionado no se puede borrar (historial)' });
  const [[me]] = await pool.query('SELECT role FROM users WHERE id=?', [req.auth.id]);
  if (r.user_id !== req.auth.id && me.role !== 'admin') return res.status(403).json({ error: 'Solo el autor o un admin' });
  await pool.query('DELETE FROM reporte_validaciones WHERE reporte_id=?', [req.params.id]);
  await pool.query('DELETE FROM reportes WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Actividades ----------
// Públicas = sin filas en actividad_asignaciones. Asignadas = visibles solo para sus usuarios (+admin).
app.get('/api/actividades', async (req, res) => {
  const [acts] = await pool.query(`SELECT a.* FROM actividades a LEFT JOIN actividad_asignaciones s ON s.actividad_id=a.id WHERE s.actividad_id IS NULL ORDER BY a.created_at DESC`);
  const [parts] = await pool.query('SELECT actividad_id, user_id FROM actividad_participantes');
  const byAct = {};
  parts.forEach(p => { (byAct[p.actividad_id] = byAct[p.actividad_id] || []).push(p.user_id); });
  res.json(acts.map(a => ({ id: a.id, titulo: a.titulo, descripcion: a.descripcion, tipo: a.tipo, puntos: a.puntos, fecha: a.fecha, participantes: byAct[a.id] || [] })));
});

app.post('/api/actividades', auth, requireAdmin, async (req, res) => {
  const { titulo, descripcion, tipo, puntos, fecha, hora } = req.body || {};
  if (!titulo || !descripcion) return res.status(400).json({ error: 'titulo y descripcion requeridos' });
  const id = uid('a');
  // fecha (YYYY-MM-DD) + hora (HH:MM) opcionales
  let cuando = null;
  if (fecha) cuando = `${fecha}${hora ? ' ' + hora + ':00' : ' 08:00:00'}`;
  await pool.query('INSERT INTO actividades (id, titulo, descripcion, tipo, puntos, fecha, autor) VALUES (?,?,?,?,?,?,?)',
    [id, titulo, descripcion, tipo || 'reciclaje', Math.max(5, Math.min(500, Number(puntos) || 20)), cuando || new Date().toISOString().slice(0, 19).replace('T', ' '), req.auth.id]);
  // Asignación automática a todos los usuarios (por eso no hay botón Asignar)
  await pool.query(`INSERT IGNORE INTO actividad_asignaciones (actividad_id, user_id) SELECT ?, id FROM users WHERE role <> 'admin'`, [id]);
  const [[a]] = await pool.query('SELECT * FROM actividades WHERE id=?', [id]);
  res.status(201).json(a);
});

app.post('/api/actividades/:id/completar', auth, async (req, res) => {
  // Solo actividades públicas (sin asignaciones): puntos automáticos
  const [as] = await pool.query('SELECT actividad_id FROM actividad_asignaciones WHERE actividad_id=? LIMIT 1', [req.params.id]);
  if (as.length) return res.status(400).json({ error: 'Actividad asignada: envía evidencia para validación del admin' });
  const [[a]] = await pool.query('SELECT * FROM actividades WHERE id=?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'No encontrada' });
  const [r] = await pool.query('INSERT IGNORE INTO actividad_participantes (actividad_id, user_id) VALUES (?,?)', [a.id, req.auth.id]);
  if (r.affectedRows > 0) await pool.query('UPDATE users SET eco_puntos = eco_puntos + ? WHERE id=?', [a.puntos, req.auth.id]);
  const [[me]] = await pool.query('SELECT eco_puntos FROM users WHERE id=?', [req.auth.id]);
  res.json({ actividad: a, ecoPuntos: me.eco_puntos });
});

// Asignadas al usuario logueado
app.get('/api/mis-actividades', auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, s.estado, s.evidencia FROM actividad_asignaciones s JOIN actividades a ON a.id=s.actividad_id WHERE s.user_id=? ORDER BY s.updated_at DESC`,
    [req.auth.id]);
  res.json(rows.map(a => ({ id: a.id, titulo: a.titulo, descripcion: a.descripcion, tipo: a.tipo, puntos: a.puntos, fecha: a.fecha, estado: a.estado, evidencia: a.evidencia || '' })));
});

app.post('/api/actividades/:id/evidencia', auth, async (req, res) => {
  const { evidencia, foto } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM actividad_asignaciones WHERE actividad_id=? AND user_id=?', [req.params.id, req.auth.id]);
  if (!rows.length) return res.status(404).json({ error: 'No tienes asignada esta actividad' });
  if (rows[0].estado === 'validada') return res.status(400).json({ error: 'Ya fue validada' });
  await pool.query(`UPDATE actividad_asignaciones SET estado='enviada', evidencia=?, foto=? WHERE actividad_id=? AND user_id=?`,
    [evidencia || '', foto || null, req.params.id, req.auth.id]);
  res.json({ ok: true, message: 'Evidencia enviada. El admin la validará.' });
});

// ---------- Retos ----------
// Públicos = sin filas en reto_asignaciones. Asignados = solo sus usuarios (+admin los ve todos).
app.get('/api/retos', auth, async (req, res) => {
  const [[me]] = await pool.query('SELECT role FROM users WHERE id=?', [req.auth.id]);
  const [retos] = me.role === 'admin'
    ? await pool.query('SELECT * FROM retos')
    : await pool.query(`SELECT DISTINCT r.* FROM retos r LEFT JOIN reto_asignaciones s ON s.reto_id=r.id WHERE s.reto_id IS NULL OR s.user_id=?`, [req.auth.id]);
  const [prog] = await pool.query('SELECT * FROM progreso_retos WHERE user_id=?', [req.auth.id]);
  res.json(retos.map(t => {
    const p = prog.find(x => x.reto_id === t.id);
    return { id: t.id, titulo: t.titulo, descripcion: t.descripcion, meta: t.meta, unidad: t.unidad, puntos: t.puntos, icono: t.icono, fondo: t.fondo, avance: p ? p.avance : 0, completado: !!(p && p.completado) };
  }));
});

app.post('/api/retos', auth, requireAdmin, async (req, res) => {
  const { titulo, descripcion, meta, unidad, puntos, icono } = req.body || {};
  if (!titulo || !descripcion) return res.status(400).json({ error: 'titulo y descripcion requeridos' });
  const id = uid('rt');
  await pool.query('INSERT INTO retos (id, titulo, descripcion, meta, unidad, puntos, icono) VALUES (?,?,?,?,?,?,?)',
    [id, titulo, descripcion, Number(meta) || 5, unidad || 'actividades', Number(puntos) || 100, icono || '🌱']);
  // Asignación automática a todos los usuarios
  await pool.query(`INSERT IGNORE INTO reto_asignaciones (reto_id, user_id) SELECT ?, id FROM users WHERE role <> 'admin'`, [id]);
  const [[t]] = await pool.query('SELECT * FROM retos WHERE id=?', [id]);
  res.status(201).json(t);
});

app.post('/api/retos/:id/avanzar', auth, async (req, res) => {
  const [[t]] = await pool.query('SELECT * FROM retos WHERE id=?', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Reto no encontrado' });
  await pool.query('INSERT IGNORE INTO progreso_retos (user_id, reto_id, avance, completado) VALUES (?,?,0,0)', [req.auth.id, t.id]);
  const [[p]] = await pool.query('SELECT * FROM progreso_retos WHERE user_id=? AND reto_id=?', [req.auth.id, t.id]);
  if (!p.completado) {
    const nav = Math.min(t.meta, p.avance + 1);
    const done = nav >= t.meta ? 1 : 0;
    await pool.query('UPDATE progreso_retos SET avance=?, completado=? WHERE user_id=? AND reto_id=?', [nav, done, req.auth.id, t.id]);
    if (done) await pool.query('UPDATE users SET eco_puntos = eco_puntos + ? WHERE id=?', [t.puntos, req.auth.id]);
  }
  const [[p2]] = await pool.query('SELECT * FROM progreso_retos WHERE user_id=? AND reto_id=?', [req.auth.id, t.id]);
  const [[me]] = await pool.query('SELECT eco_puntos FROM users WHERE id=?', [req.auth.id]);
  res.json({ reto: { ...t, avance: p2.avance, completado: !!p2.completado }, ecoPuntos: me.eco_puntos });
});

// ---------- Admin: asignar ----------
app.post('/api/actividades/:id/asignar', auth, requireAdmin, async (req, res) => {
  const { userIds } = req.body || {};
  if (!Array.isArray(userIds) || !userIds.length) return res.status(400).json({ error: 'userIds[] requerido' });
  for (const uidv of userIds) {
    await pool.query(`INSERT IGNORE INTO actividad_asignaciones (actividad_id, user_id) VALUES (?,?)`, [req.params.id, uidv]);
  }
  res.json({ ok: true, asignados: userIds.length });
});

app.post('/api/retos/:id/asignar', auth, requireAdmin, async (req, res) => {
  const { userIds } = req.body || {};
  if (!Array.isArray(userIds) || !userIds.length) return res.status(400).json({ error: 'userIds[] requerido' });
  for (const uidv of userIds) {
    await pool.query(`INSERT IGNORE INTO reto_asignaciones (reto_id, user_id) VALUES (?,?)`, [req.params.id, uidv]);
  }
  res.json({ ok: true, asignados: userIds.length });
});

// ---------- Admin: validar evidencias (puntos SOLO aquí para asignadas) ----------
app.get('/api/admin/validaciones', auth, requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.actividad_id, s.user_id, s.estado, s.evidencia, s.foto, s.updated_at,
            a.titulo, a.puntos, u.name, u.email
     FROM actividad_asignaciones s
     JOIN actividades a ON a.id=s.actividad_id
     JOIN users u ON u.id=s.user_id
     WHERE s.estado='enviada' ORDER BY s.updated_at DESC`);
  res.json(rows);
});

app.post('/api/admin/asignaciones/validar', auth, requireAdmin, async (req, res) => {
  const { actividadId, userId, accion } = req.body || {};
  if (!['validar', 'rechazar'].includes(accion)) return res.status(400).json({ error: 'accion validar|rechazar' });
  const [[s]] = await pool.query('SELECT * FROM actividad_asignaciones WHERE actividad_id=? AND user_id=?', [actividadId, userId]);
  if (!s || s.estado !== 'enviada') return res.status(400).json({ error: 'Sin evidencia pendiente' });
  if (accion === 'validar') {
    await pool.query(`UPDATE actividad_asignaciones SET estado='validada' WHERE actividad_id=? AND user_id=?`, [actividadId, userId]);
    const [[a]] = await pool.query('SELECT puntos FROM actividades WHERE id=?', [actividadId]);
    await pool.query('UPDATE users SET eco_puntos = eco_puntos + ? WHERE id=?', [a.puntos, userId]);
    res.json({ ok: true, message: `Valiada: +${a.puntos} EcoPuntos` });
  } else {
    await pool.query(`UPDATE actividad_asignaciones SET estado='rechazada' WHERE actividad_id=? AND user_id=?`, [actividadId, userId]);
    res.json({ ok: true, message: 'Rechazada: el usuario puede reenviar' });
  }
});

// ---------- Admin: usuarios y roles ----------
app.get('/api/admin/users', auth, requireAdmin, async (req, res) => {
  const [rows] = await pool.query(`SELECT u.*, (SELECT COUNT(*) FROM reportes r WHERE r.user_id=u.id) reps FROM users u ORDER BY u.created_at DESC`);
  res.json(rows.map(u => ({ ...pub(u), reportes: u.reps })));
});

app.put('/api/admin/users/:id/role', auth, requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (!['usuario', 'admin'].includes(role)) return res.status(400).json({ error: 'role usuario|admin' });
  if (req.params.id === req.auth.id && role !== 'admin') return res.status(400).json({ error: 'No puedes quitarte tu propio admin' });
  if (role !== 'admin') {
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM users WHERE role='admin'`);
    const [[t]] = await pool.query('SELECT role FROM users WHERE id=?', [req.params.id]);
    if (t && t.role === 'admin' && n <= 1) return res.status(400).json({ error: 'Debe quedar al menos un admin' });
  }
  await pool.query('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
  res.json({ ok: true });
});

// ---------- Comunidad ----------
app.get('/api/comunidad/ranking', auth, async (req, res) => {
  const [rows] = await pool.query(`SELECT u.name, u.eco_puntos, u.id,
    (SELECT COUNT(*) FROM reportes r WHERE r.user_id=u.id) reportes
    FROM users u ORDER BY u.eco_puntos DESC LIMIT 10`);
  res.json(rows.map(u => ({ name: u.name, ecoPuntos: u.eco_puntos, reportes: u.reportes, me: u.id === req.auth.id })));
});

// ---------- Perfil ----------
app.get('/api/perfil', auth, async (req, res) => {
  const [[u]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  const [reps] = await pool.query('SELECT id, titulo, estado FROM reportes WHERE user_id=? ORDER BY created_at DESC', [req.auth.id]);
  res.json({ ...pub(u), misReportes: reps.length, reportes: reps });
});

app.put('/api/perfil', auth, async (req, res) => {
  const { name } = req.body || {};
  if (name) await pool.query('UPDATE users SET name=? WHERE id=?', [name, req.auth.id]);
  const [[u]] = await pool.query('SELECT * FROM users WHERE id=?', [req.auth.id]);
  res.json(pub(u));
});

app.delete('/api/perfil', auth, async (req, res) => {
  const [[me]] = await pool.query('SELECT role FROM users WHERE id=?', [req.auth.id]);
  if (me.role === 'admin') {
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM users WHERE role='admin'`);
    if (n <= 1) return res.status(400).json({ error: 'El último admin no puede eliminar su cuenta' });
  }
  await pool.query('DELETE FROM progreso_retos WHERE user_id=?', [req.auth.id]);
  await pool.query('DELETE FROM reto_asignaciones WHERE user_id=?', [req.auth.id]);
  await pool.query('DELETE FROM actividad_participantes WHERE user_id=?', [req.auth.id]);
  await pool.query('DELETE FROM actividad_asignaciones WHERE user_id=?', [req.auth.id]);
  await pool.query('DELETE FROM reportes WHERE user_id=?', [req.auth.id]);
  await pool.query('DELETE FROM users WHERE id=?', [req.auth.id]);
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, async () => {
    try { await checkDb(); console.log(`FriendlyGreen API + MySQL en http://localhost:${PORT}`); }
    catch (e) { console.log(`API en puerto ${PORT} pero MySQL falló: ${e.message} (enciende XAMPP)`); }
  });
}
module.exports = app; // para Vercel serverless (api/index.js)
