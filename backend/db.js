// Conexión MySQL (XAMPP local / Aiven remoto en Vercel vía env).
// Local XAMPP: host 127.0.0.1, user root, sin password, db friendlygreen.
// En Vercel: DB_HOST/PORT/USER/PASSWORD/NAME de Aiven + DB_SSL=true + DB_POOL=2.
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'friendlygreen',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10), // en Vercel serverless usa 2
  charset: 'utf8mb4',
  ...(process.env.DB_SSL === 'true'
    ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false } }
    : {}),
});

async function checkDb() {
  const conn = await pool.getConnection();
  try { await conn.ping(); } finally { conn.release(); }
}

module.exports = { pool, checkDb };
