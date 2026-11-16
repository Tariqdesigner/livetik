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
  try {
    await pool.query('ALTER TABLE users ALTER COLUMN device_id DROP NOT NULL');
  } catch (_) { /* تجاهل إن كان بالفعل يقبل NULL */ }
  await runOnce(pool, 'trial-max-7-days-2026-11', trialMax7Days);
}

// ترحيلات تنفّذ مرة وحدة فقط (حتى لو الخادم أعاد التشغيل أو اشتغلت أكثر من نسخة منه)
async function runOnce(pool, id, fn) {
  const exists = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'app_migrations'");
  if (!exists.rowCount) await pool.query('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), note TEXT)');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const done = await client.query('SELECT 1 FROM app_migrations WHERE id = $1', [id]);
    if (done.rowCount) { await client.query('ROLLBACK'); return; }
    // لو نسختين من الخادم وصلوا هنا مع بعض: الثانية تفشل بتكرار المفتاح وتتخطّى (catch تحت)
    await client.query('INSERT INTO app_migrations (id) VALUES ($1)', [id]);
    const note = await fn(client);
    await client.query('UPDATE app_migrations SET note = $2 WHERE id = $1', [id, note || null]);
    await client.query('COMMIT');
    console.log(`migration ${id}: ${note || 'done'}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') return; // نسخة ثانية سبقتنا وطبّقته
    throw e;
  } finally {
    client.release();
  }
}

// الفترة التجريبية صارت 7 أيام للكل: أي جهاز تجربته أطول من 7 أيام من أول تشغيل تنقص لـ 7 أيام.
// المشتركين المدفوعين ما يتأثرون (حالتهم من subscription_status/subscription_ends_at مو من تاريخ التجربة).
// اللي مرّ عليهم أكثر من 7 أيام تنتهي تجربتهم فوراً، ويكملون على الأقسام المجانية.
async function trialMax7Days(client) {
  const r = await client.query(
    `UPDATE devices SET trial_ends_at = first_seen_at + interval '7 days'
     WHERE trial_ends_at > first_seen_at + interval '7 days'`,
  );
  return `trials capped to 7 days: ${r.rowCount} device(s)`;
}

module.exports = { createPool, migrate, runOnce, trialMax7Days };
