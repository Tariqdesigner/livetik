// ترحيل «التجربة 7 أيام للكل»: يقصّر التجارب الطويلة، ما يلمس المشتركين، وما يتكرر
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');
const { runOnce, trialMax7Days } = require('../src/db');
const { createApp } = require('../src/index');

(async () => {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  let pass = 0;
  const ok = (c, n) => { assert.ok(c, n); pass++; console.log('ok -', n); };
  const DAY = 86400000;
  const now = Date.now();
  const at = (days) => new Date(now + days * DAY);
  // أجهزة: [معرّف، أول تشغيل قبل كم يوم، نهاية التجربة بعد كم يوم من الحين]
  const devices = [
    ['old30', -20, 10], // سجّل قبل 20 يوم بتجربة 30 → لازم تنتهي الحين (20 > 7)
    ['new30', -2, 28], // سجّل قبل يومين بتجربة 30 → تصير 5 أيام باقية
    ['new7', -1, 6], // أصلاً 7 أيام → ما يتغيّر
    ['paid', -40, -10], // تجربته خلصت لكنه مشترك مدفوع
  ];
  for (const [id, first, ends] of devices) {
    await pool.query('INSERT INTO devices (device_id, platform, first_seen_at, trial_ends_at) VALUES ($1, $2, $3, $4)', [id.padEnd(64, '0'), 'desktop', at(first), at(ends)]);
  }
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('secret123', 4);
  const users = { old30: 'trial', new30: 'trial', new7: 'trial', paid: 'active' };
  for (const [id, st] of Object.entries(users)) {
    await pool.query('INSERT INTO users (id, email, password_hash, device_id, subscription_status, subscription_ends_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [require('crypto').randomUUID(), id + '@x.com', hash, id.padEnd(64, '0'), st, st === 'active' ? at(20) : null]);
  }

  await runOnce(pool, 'trial-max-7-days-2026-11', trialMax7Days);
  const row = async (id) => (await pool.query('SELECT first_seen_at, trial_ends_at FROM devices WHERE device_id = $1', [id.padEnd(64, '0')])).rows[0];
  const len = async (id) => { const r = await row(id); return Math.round((new Date(r.trial_ends_at) - new Date(r.first_seen_at)) / DAY); };
  ok((await len('old30')) === 7 && (await len('new30')) === 7, 'long trials capped to 7 days from first start');
  ok((await len('new7')) === 7, '7-day trial unchanged');
  const mark = await pool.query("SELECT note FROM app_migrations WHERE id = 'trial-max-7-days-2026-11'");
  ok(mark.rowCount === 1 && /3 device/.test(mark.rows[0].note), 'migration recorded once: ' + mark.rows[0].note);

  // إعادة تشغيل الخادم: ما يتكرر (تمديد يدوي من الأدمن بعدها يبقى)
  await pool.query("UPDATE devices SET trial_ends_at = now() + interval '20 days' WHERE device_id = $1", ['new7'.padEnd(64, '0')]);
  await runOnce(pool, 'trial-max-7-days-2026-11', trialMax7Days);
  ok((await len('new7')) > 7, 'second boot does not run again (admin extensions kept)');

  // من التطبيق: حالة كل حساب بعد الترحيل
  const env = { JWT_SECRET: 'x'.repeat(48), TRIAL_DAYS: '7', CORS_ORIGINS: '' };
  const server = createApp(pool, env).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const login = (id) => fetch(base + '/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: id + '@x.com', password: 'secret123', device_id: id.padEnd(64, '0') }) }).then((r) => r.json());
  try {
    const a = await login('old30');
    ok(a.subscription.status === 'expired' && a.subscription.access === false, 'old account (20 days ago) → expired, free sections only');
    const b = await login('new30');
    ok(b.subscription.status === 'trial' && b.subscription.access === true && b.subscription.days_left === 5, 'account from 2 days ago → trial with 5 days left');
    const c = await login('paid');
    ok(c.subscription.status === 'active' && c.subscription.access === true, 'paid subscriber unaffected');
    // تسجيل جديد ياخذ 7 أيام
    const r = await fetch(base + '/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'fresh@x.com', password: 'secret123', device_id: 'f'.repeat(64) }) }).then((x) => x.json());
    ok(r.subscription.status === 'trial' && r.subscription.days_left === 7, 'new account gets 7 days');
  } finally {
    server.close();
  }
  console.log(`\n${pass} passed`);
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
