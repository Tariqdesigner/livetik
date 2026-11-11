// PostgreSQL connection pool (DATABASE_URL from CranL) + schema migration on boot
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function createPool(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: Number(env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
  });
}

async function migrate(pool) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { createPool, migrate };
