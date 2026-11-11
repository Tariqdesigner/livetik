// End-to-end auth test against an in-memory PostgreSQL (pg-mem): register, device-trial block, login, me, expiry
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');
const { createApp } = require('../src/index');

(async () => {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  const env = { JWT_SECRET: 'x'.repeat(48), TRIAL_DAYS: '30', CORS_ORIGINS: '' };
  const server = createApp(pool, env).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const DEV = 'a'.repeat(64);
  let pass = 0;
  const ok = (cond, name) => { assert.ok(cond, name); pass++; console.log('ok -', name); };

  try {
    let r = await post('/register', { email: 'Nova@Example.com', password: 'secret123', device_id: DEV });
    ok(r.status === 201 && r.body.token, 'register creates account with token');
    ok(r.body.subscription.status === 'trial' && r.body.subscription.days_left === 30, 'new account gets 30-day trial');

    r = await post('/register', { email: 'other@example.com', password: 'secret123', device_id: DEV });
    ok(r.status === 409 && r.body.error === 'DEVICE_TRIAL_USED', 'same device cannot start a second trial');

    r = await post('/register', { email: 'nova@example.com', password: 'secret123', device_id: 'b'.repeat(64) });
    ok(r.status === 409 && r.body.error === 'EMAIL_TAKEN', 'duplicate email rejected (case-insensitive)');

    r = await post('/register', { email: 'x@example.com', password: 'short', device_id: 'c'.repeat(64) });
    ok(r.status === 400 && r.body.error === 'WEAK_PASSWORD', 'weak password rejected');

    r = await post('/login', { email: 'nova@example.com', password: 'wrongpass', device_id: DEV });
    ok(r.status === 401 && r.body.error === 'BAD_CREDENTIALS', 'wrong password rejected');

    r = await post('/login', { email: 'nova@example.com', password: 'secret123', device_id: DEV });
    ok(r.status === 200 && r.body.subscription.access === true, 'login returns active trial');
    const token = r.body.token;

    let me = await fetch(base + '/me', { headers: { authorization: 'Bearer ' + token } }).then((x) => x.json());
    ok(me.subscription.status === 'trial', '/me returns trial status');

    // انتهاء الفترة: نرجع تاريخ نهاية تجربة الجهاز إلى الماضي
    await pool.query(`UPDATE devices SET trial_ends_at = now() - interval '1 day' WHERE device_id = $1`, [DEV]);
    r = await post('/login', { email: 'nova@example.com', password: 'secret123', device_id: DEV });
    ok(r.status === 200 && r.body.subscription.status === 'expired' && r.body.subscription.access === false, 'after 30 days access is blocked');
    const row = await pool.query(`SELECT subscription_status FROM users WHERE email = 'nova@example.com'`);
    ok(row.rows[0].subscription_status === 'expired', 'expired status persisted in DB');

    // الدفع: الاشتراك المفعّل يعيد الوصول
    await pool.query(`UPDATE users SET subscription_status = 'active', subscription_ends_at = now() + interval '30 days' WHERE email = 'nova@example.com'`);
    me = await fetch(base + '/me', { headers: { authorization: 'Bearer ' + token } }).then((x) => x.json());
    ok(me.subscription.status === 'active' && me.subscription.access === true, 'paid subscription restores access');

    const bad = await fetch(base + '/me', { headers: { authorization: 'Bearer nope' } });
    ok(bad.status === 401, 'invalid token rejected');
    console.log(`\n${pass} passed`);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
})();
