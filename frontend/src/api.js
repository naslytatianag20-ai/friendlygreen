const API = import.meta.env.VITE_API_URL || '';

async function req(path, opts = {}) {
  const token = localStorage.getItem('fg_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Error API');
  return data;
}

export const api = {
  login: (email, password) => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name, email, password) => req('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  recover: (email, newPassword) => req('/api/auth/recover', { method: 'POST', body: JSON.stringify({ email, newPassword }) }),
  changePassword: (current, next) => req('/api/auth/password', { method: 'PUT', body: JSON.stringify({ current, next }) }),
  me: () => req('/api/auth/me'),
  stats: () => req('/api/dashboard/stats'),
  reportes: () => req('/api/reportes'),
  crearReporte: (d) => req('/api/reportes', { method: 'POST', body: JSON.stringify(d) }),
  validar: (id) => req(`/api/reportes/${id}/validar`, { method: 'PUT' }),
  cambiarEstado: (id, estado) => req(`/api/reportes/${id}/estado`, { method: 'PUT', body: JSON.stringify({ estado }) }),
  borrarReporte: (id) => req(`/api/reportes/${id}`, { method: 'DELETE' }),
  actividades: () => req('/api/actividades'),
  crearActividad: (d) => req('/api/actividades', { method: 'POST', body: JSON.stringify(d) }),
  completar: (id) => req(`/api/actividades/${id}/completar`, { method: 'POST' }),
  misActividades: () => req('/api/mis-actividades'),
  enviarEvidencia: (id, d) => req(`/api/actividades/${id}/evidencia`, { method: 'POST', body: JSON.stringify(d) }),
  asignarActividad: (id, userIds) => req(`/api/actividades/${id}/asignar`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  retos: () => req('/api/retos'),
  crearReto: (d) => req('/api/retos', { method: 'POST', body: JSON.stringify(d) }),
  avanzarReto: (id) => req(`/api/retos/${id}/avanzar`, { method: 'POST' }),
  asignarReto: (id, userIds) => req(`/api/retos/${id}/asignar`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  validaciones: () => req('/api/admin/validaciones'),
  validarAsignacion: (actividadId, userId, accion) => req('/api/admin/asignaciones/validar', { method: 'POST', body: JSON.stringify({ actividadId, userId, accion }) }),
  adminUsers: () => req('/api/admin/users'),
  cambiarRol: (id, role) => req(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  ranking: () => req('/api/comunidad/ranking'),
  perfil: () => req('/api/perfil'),
  guardarPerfil: (d) => req('/api/perfil', { method: 'PUT', body: JSON.stringify(d) }),
  eliminarCuenta: () => req('/api/perfil', { method: 'DELETE' }),
};
