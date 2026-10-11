# 🌿 FriendlyGreen - UNAD Fase 3 (202337119_122)

Plataforma web de reporte ambiental ciudadano para Cali.
Stack: React (frontend) + Node.js + Express + **MySQL/MariaDB en XAMPP** (sin MongoDB).

## Qué incluye (Figuras 1-6 del doc)
- **Login** + registro (+50 EcoPuntos) + recuperar clave
- **Dashboard**: usuarios, reportes, solucionados, EcoPuntos, CO₂
- **Actividades/Retos**: crear, completar y ganar puntos (progreso por usuario)
- **Reportes georreferenciados**: mapa OpenStreetMap Cali sur, clic para ubicar, validación comunitaria
- **Perfil**: avatar, cambiar clave, exportar datos, eliminar cuenta
- **Comunidad**: ranking EcoPuntos + validación · **Recursos** · **Configuración**

Demo admin: `admin@friendlygreen.co / admin123` (único usuario en DB; crea usuarios normales con Registrate)

## Uso en local con XAMPP
Requisitos: Node 24 + XAMPP con MySQL encendido.

1. En XAMPP Control Panel → **Start MySQL**.
2. Doble clic en `start-local.bat` (verifica MySQL, instala, migra y arranca todo) o manual:

```bat
cd backend
npm install
npm run migrate          :: crea tablas + datos de muestra (idempotente)
npm run migrate:fresh    :: SOLO si quieres borrar todo y repoblar
node server.js           :: API http://localhost:4000/api/health (db=mysql)

cd ..\frontend
npm install
npm run dev              :: Web http://localhost:5173
```

- El frontend usa proxy `/api -> localhost:4000`, nada que configurar.
- Ve tus tablas en **phpMyAdmin** → http://localhost/phpmyadmin → base `friendlygreen`
  (users, actividades, actividad_participantes, reportes, retos, progreso_retos).
- Crear usuarios: botón **Registrate** en el login (rol `usuario`, +50 EcoPuntos, clave bcrypt).

## Roles y flujo de puntos
- **Admin** (`admin@friendlygreen.co`): ve 🛡️ Administrar → crea actividades (con fecha+hora) y retos, que se **asignan solos a todos los usuarios**; valida evidencias (**puntos de asignadas SOLO al validar**) y otorga/quita admin en Usuarios.
- **Usuario normal**: reportes con foto ampliable (+20, 1 validación por usuario, solucionados no se borran), registra actividades públicas (puntos auto), envía evidencia en Mis asignadas, avanza retos asignados/públicos.
- **Inicio** muestra contadores reales (actividades validadas+registradas, retos completados). **Retos**: completados solo salen en la pestaña Completados.

## Publicarlo en Vercel (cuando local esté 100%)
Vercel hospeda el **frontend**; el backend Node + MySQL va en un host Node (Render/Railway gratis):

1. Crea un **MySQL remoto gratis** (Aiven free / PlanetScale / Railway) y copia host, puerto, usuario, clave, base.
2. Sube este repo a GitHub.
3. Backend en **Render free**: New Web Service → carpeta `backend/` → Build `npm install` → Start `node server.js` → en Environment pon `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET`. Tras el deploy entra a `https://tu-api.onrender.com/api/health` y luego ejecuta la migración contra esa base (`npm run migrate` con las env remotas) o importa el SQL desde phpMyAdmin.
4. Frontend en **Vercel**: Import repo → Root Directory `frontend/` → env `VITE_API_URL=https://tu-api.onrender.com` → Deploy → `https://friendlygreen.vercel.app`.
5. Prueba registro + login en la URL pública.

## Estructura
```
backend/server.js   → API Express + MySQL: auth JWT, dashboard, reportes, actividades, retos, comunidad, perfil
backend/db.js       → pool MySQL (env DB_*)
backend/migrate.js  → CREATE TABLEs + seed demo (npm run migrate / migrate:fresh)
backend/.env        → config local XAMPP (no se sube a git)
frontend/src/       → React Vite idéntico a mockups p.40-43, cada botón funcional
render.yaml         → deploy backend Render free
```

## Notas para el informe UNAD
- TRL pasa de 3-4 (mockups) a 4-5 (prototipo funcional con MySQL local).
- CAC piloto: 100 usuarios, $15.000 c/u según Tabla 3 — el registro da 50 EcoPuntos como incentivo.
- Sin MongoDB por decisión del equipo: MySQL XAMPP en local y MySQL remoto en producción.
