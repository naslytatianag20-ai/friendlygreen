// Migraciones + seed FriendlyGreen (MySQL/MariaDB XAMPP).
// Uso: npm run migrate        (crea/actualiza tablas + seed sin duplicar; deja SOLO admin)
//      npm run migrate:fresh   (borra todo y repuebla de cero)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const FRESH = process.argv.includes('--fresh');
const ADMIN_EMAIL = 'admin@friendlygreen.co';
const ADMIN_PASS = 'admin123';

async function migrate() {
  const c = await pool.getConnection();
  try {
    if (FRESH) {
      for (const t of ['progreso_retos', 'reto_asignaciones', 'actividad_asignaciones', 'actividad_participantes', 'reportes', 'actividades', 'retos', 'users']) {
        await c.query(`DROP TABLE IF EXISTS \`${t}\``);
      }
      console.log('Tablas borradas (fresh).');
    }

    await c.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      eco_puntos INT NOT NULL DEFAULT 50,
      role VARCHAR(20) NOT NULL DEFAULT 'usuario',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await c.query(`CREATE TABLE IF NOT EXISTS actividades (
      id VARCHAR(32) PRIMARY KEY,
      titulo VARCHAR(200) NOT NULL,
      descripcion TEXT NOT NULL,
      tipo VARCHAR(50) NOT NULL DEFAULT 'reciclaje',
      puntos INT NOT NULL DEFAULT 20,
      fecha DATETIME NULL,
      activa TINYINT(1) NOT NULL DEFAULT 1,
      autor VARCHAR(32) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await c.query(`CREATE TABLE IF NOT EXISTS actividad_participantes (
      actividad_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (actividad_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Asignación admin -> usuario con evidencia y validación (puntos solo al validar)
    await c.query(`CREATE TABLE IF NOT EXISTS actividad_asignaciones (
      actividad_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      estado ENUM('pendiente','enviada','validada','rechazada') NOT NULL DEFAULT 'pendiente',
      evidencia TEXT NULL,
      foto MEDIUMTEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (actividad_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await c.query(`CREATE TABLE IF NOT EXISTS reportes (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      descripcion TEXT NOT NULL,
      categoria VARCHAR(50) NOT NULL DEFAULT 'residuos',
      lat DECIMAL(10,5) NOT NULL,
      lng DECIMAL(10,5) NOT NULL,
      comuna VARCHAR(100) NOT NULL DEFAULT 'Cali',
      estado ENUM('pendiente','validado','solucionado') NOT NULL DEFAULT 'pendiente',
      validaciones INT NOT NULL DEFAULT 0,
      foto MEDIUMTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_estado (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await c.query(`CREATE TABLE IF NOT EXISTS retos (
      id VARCHAR(32) PRIMARY KEY,
      titulo VARCHAR(200) NOT NULL,
      descripcion TEXT NOT NULL,
      meta INT NOT NULL DEFAULT 5,
      unidad VARCHAR(30) NOT NULL DEFAULT 'actividades',
      puntos INT NOT NULL DEFAULT 100,
      icono VARCHAR(20) NOT NULL DEFAULT '🌱',
      fondo VARCHAR(20) NOT NULL DEFAULT '#eaf5ec'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await c.query(`CREATE TABLE IF NOT EXISTS reto_asignaciones (
      reto_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (reto_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await c.query(`CREATE TABLE IF NOT EXISTS progreso_retos (
      user_id VARCHAR(32) NOT NULL,
      reto_id VARCHAR(32) NOT NULL,
      avance INT NOT NULL DEFAULT 0,
      completado TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, reto_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Una validación por usuario y reporte
    await c.query(`CREATE TABLE IF NOT EXISTS reporte_validaciones (
      reporte_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (reporte_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Columnas nuevas en DBs existentes
    await c.query(`SELECT COUNT(*) n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reportes' AND COLUMN_NAME='foto'`).then(async ([[r]]) => {
      if (!r.n) await c.query(`ALTER TABLE reportes ADD COLUMN foto MEDIUMTEXT NULL`);
    });
    await c.query(`SELECT DATA_TYPE d FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='actividades' AND COLUMN_NAME='fecha'`).then(async ([[r]]) => {
      if (r && String(r.d).toLowerCase() !== 'datetime') await c.query(`ALTER TABLE actividades MODIFY COLUMN fecha DATETIME NULL`);
    });
    await c.query(`SELECT COUNT(*) n FROM users`).then(async () => {
      await c.query(`UPDATE users SET role='usuario' WHERE role NOT IN ('usuario','admin')`).catch(() => {});
    }).catch(() => {});

    // ---- Solo queda el admin: borra demo/usuarios de prueba ----
    await c.query(`DELETE FROM progreso_retos WHERE user_id NOT IN (SELECT id FROM users WHERE email=?)`, [ADMIN_EMAIL]).catch(() => {});
    await c.query(`DELETE FROM actividad_participantes WHERE user_id NOT IN (SELECT id FROM users WHERE email=?)`, [ADMIN_EMAIL]).catch(() => {});
    await c.query(`DELETE FROM actividad_asignaciones WHERE user_id NOT IN (SELECT id FROM users WHERE email=?)`, [ADMIN_EMAIL]).catch(() => {});
    await c.query(`DELETE FROM reto_asignaciones WHERE user_id NOT IN (SELECT id FROM users WHERE email=?)`, [ADMIN_EMAIL]).catch(() => {});
    await c.query(`DELETE FROM reportes WHERE user_id NOT IN (SELECT id FROM users WHERE email=?) AND user_id <> 'seed'`, [ADMIN_EMAIL]).catch(() => {});
    await c.query(`DELETE FROM users WHERE email <> ?`, [ADMIN_EMAIL]);

    // ---- Admin seed ----
    await c.query(
      `INSERT INTO users (id, name, email, password_hash, eco_puntos, role) VALUES ('u_admin','Administrador','${ADMIN_EMAIL}',?,0,'admin') ON DUPLICATE KEY UPDATE role='admin', name='Administrador'`,
      [bcrypt.hashSync(ADMIN_PASS, 8)]
    );

    // ---- Datos de muestra ----
    const acts = [
      ['a1', 'Recicla 5kg esta semana', 'Separa y entrega reciclaje en punto autorizado. Sube evidencia.', 'reciclaje', 100, '2026-10-18 08:00:00'],
      ['a2', 'Limpieza comunitaria sur Cali', 'Jornada de limpieza en punto crítico. Sábado 8am.', 'limpieza', 200, '2026-10-19 08:00:00'],
      ['a3', 'Reto cero papel 7 días', 'Digitaliza tus procesos y evita impresiones por 7 días.', 'reto', 150, '2026-10-25 09:00:00'],
      ['a4', 'Reforestación urbana', 'Siembra y apadrina un árbol en tu comuna.', 'reforestacion', 250, '2026-11-02 07:30:00'],
    ];
    for (const [id, titulo, descripcion, tipo, puntos, fecha] of acts) {
      await c.query(`INSERT IGNORE INTO actividades (id, titulo, descripcion, tipo, puntos, fecha) VALUES (?,?,?,?,?,?)`, [id, titulo, descripcion, tipo, puntos, fecha]);
    }
    const retos = [
      ['rt1', 'Reto Eco-Amigo', 'Realiza 5 actividades sostenibles esta semana.', 5, 'actividades', 100, '🌱', '#eaf5ec'],
      ['rt2', 'Reto Planeta Verde', 'Reduce tu huella de carbono durante 30 días.', 30, 'días', 200, '🌍', '#e8f3fd'],
      ['rt3', 'Reto Comunidad', 'Invita a 3 amigos a unirse a FriendlyGreen.', 3, 'amigos', 80, '🧑‍🤝‍🧑', '#eaf5ec'],
    ];
    for (const r of retos) {
      await c.query(`INSERT IGNORE INTO retos (id, titulo, descripcion, meta, unidad, puntos, icono, fondo) VALUES (?,?,?,?,?,?,?,?)`, r);
    }
    const reps = [
      ['r1', 'seed', 'Punto crítico de basura - El Limonar', 'Acumulación de residuos mixtos sin recoger hace 3 días.', 'residuos', 3.3769, -76.5328, 'Comuna 17', 'validado', 12],
      ['r2', 'seed', 'Poda no recogida - Ciudad Jardín', 'Restos de poda obstruyendo andén.', 'poda', 3.3696, -76.5412, 'Comuna 22', 'pendiente', 4],
      ['r3', 'seed', 'Residuos en separador - Pasoancho', 'Escombros y plásticos en separador vial.', 'residuos', 3.3978, -76.5401, 'Comuna 17', 'pendiente', 7],
      ['r4', 'seed', 'Jornada reciclaje - Unicentro', 'Punto de recolección de reciclaje validado por comunidad.', 'reciclaje', 3.3722, -76.5275, 'Comuna 17', 'solucionado', 21],
    ];
    for (const r of reps) {
      await c.query(`INSERT IGNORE INTO reportes (id, user_id, titulo, descripcion, categoria, lat, lng, comuna, estado, validaciones) VALUES (?,?,?,?,?,?,?,?,?,?)`, r);
    }

    const [[{ n }]] = await c.query(`SELECT COUNT(*) n FROM users`);
    console.log(`Migración OK. Usuarios en DB: ${n} (solo admin). Admin: ${ADMIN_EMAIL} / ${ADMIN_PASS}`);
  } finally {
    c.release();
    await pool.end();
  }
}

migrate().catch((e) => { console.error('MIGRATE_FAIL:', e.message); process.exit(1); });
