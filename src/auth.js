// Auth routes: register (device-bound 30-day trial), login, me (fresh status for the app's periodic check)
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DAY = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{16,128}$/;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Current access state for a user row joined with its device row
function accessState(row, now = new Date()) {
  const subEnds = row.subscription_ends_at ? new Date(row.subscription_ends_at) : null;
  if (row.subscription_status === 'active' && (!subEnds || subEnds > now)) {
    return { status: 'active', access: true, trial_ends_at: null, subscription_ends_at: subEnds, days_left: subEnds ? Math.ceil((subEnds - now) / DAY) : null };
  }
  const trialEnds = new Date(row.trial_ends_at);
  if (row.subscription_status === 'trial' && trialEnds > now) {
    return { status: 'trial', access: true, trial_ends_at: trialEnds, subscription_ends_at: null, days_left: Math.ceil((trialEnds - now) / DAY) };
  }
  return { status: 'expired', access: false, trial_ends_at: trialEnds, subscription_ends_at: subEnds, days_left: 0 };
}

function authRouter(pool, env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set (32+ characters)');
  const trialDays = Number(env.TRIAL_DAYS) || 30;
  const router = express.Router();

  const sign = (user) => jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: '7d' });
  const publicUser = (u) => ({ id: u.id, email: u.email, created_at: u.created_at });

  async function loadUser(where, value) {
    const { rows } = await pool.query(
      `SELECT u.*, d.trial_ends_at FROM users u JOIN devices d ON d.device_id = u.device_id WHERE ${where} = $1`,
      [value],
    );
    return rows[0] || null;
  }

  // Trial expired: persist it so reports and the dashboard see the real status
  async function syncStatus(user) {
    const st = accessState(user);
    if (st.status === 'expired' && user.subscription_status !== 'expired' && user.subscription_status !== 'canceled') {
      await pool.query(`UPDATE users SET subscription_status = 'expired' WHERE id = $1`, [user.id]);
    }
    return st;
  }

  function readBody(req) {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const password = String((req.body && req.body.password) || '');
    const deviceId = String((req.body && req.body.device_id) || '').trim();
    if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'INVALID_EMAIL', 'البريد الإلكتروني غير صالح');
    if (!DEVICE_RE.test(deviceId)) throw new HttpError(400, 'INVALID_DEVICE', 'بصمة الجهاز غير صالحة');
    return { email, password, deviceId };
  }

  router.post('/register', async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { email, password, deviceId } = readBody(req);
      if (password.length < 8 || password.length > 128) throw new HttpError(400, 'WEAK_PASSWORD', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      const platform = ['desktop', 'web', 'mobile'].includes(req.body.platform) ? req.body.platform : 'desktop';

      await client.query('BEGIN');
      const taken = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
      if (taken.rowCount) throw new HttpError(409, 'EMAIL_TAKEN', 'هذا البريد مسجل مسبقاً، سجّل الدخول بدلاً من ذلك');

      // الجهاز استخدم فترته التجريبية من قبل: لا حساب تجريبي جديد منه
      const dev = await client.query('SELECT device_id FROM devices WHERE device_id = $1 FOR UPDATE', [deviceId]);
      if (dev.rowCount) throw new HttpError(409, 'DEVICE_TRIAL_USED', 'هذا الجهاز استخدم الفترة التجريبية من قبل. سجّل الدخول بحسابك أو اشترك للمتابعة');

      const now = new Date();
      await client.query('INSERT INTO devices (device_id, platform, first_seen_at, trial_ends_at) VALUES ($1, $2, $3, $4)',
        [deviceId, platform, now, new Date(now.getTime() + trialDays * DAY)]);
      const id = crypto.randomUUID();
      const hash = await bcrypt.hash(password, 12);
      await client.query(
        `INSERT INTO users (id, email, password_hash, device_id, created_at, subscription_status, last_login_at)
         VALUES ($1, $2, $3, $4, $5, 'trial', $5)`,
        [id, email, hash, deviceId, now],
      );
      await client.query('COMMIT');

      const user = await loadUser('u.id', id);
      res.status(201).json({ token: sign(user), user: publicUser(user), subscription: accessState(user) });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      // سباق بين طلبين بنفس البصمة أو البريد في نفس اللحظة
      if (e.code === '23505') return next(new HttpError(409, 'DEVICE_TRIAL_USED', 'هذا الجهاز أو البريد مسجل مسبقاً'));
      next(e);
    } finally {
      client.release();
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = readBody(req);
      const user = await loadUser('u.email', email);
      // نفس الرسالة للبريد غير الموجود وكلمة المرور الخاطئة حتى لا يُكشف وجود الحساب
      const ok = user && (await bcrypt.compare(password, user.password_hash));
      if (!ok) throw new HttpError(401, 'BAD_CREDENTIALS', 'البريد أو كلمة المرور غير صحيحة');
      await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
      const subscription = await syncStatus(user);
      res.json({ token: sign(user), user: publicUser(user), subscription });
    } catch (e) {
      next(e);
    }
  });

  // يستدعيه التطبيق عند التشغيل وكل فترة: يعيد حالة الاشتراك الحالية
  router.get('/me', async (req, res, next) => {
    try {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
      if (!m) throw new HttpError(401, 'NO_TOKEN', 'سجّل الدخول أولاً');
      let payload;
      try { payload = jwt.verify(m[1], secret); } catch (_) { throw new HttpError(401, 'BAD_TOKEN', 'انتهت الجلسة، سجّل الدخول من جديد'); }
      const user = await loadUser('u.id', payload.sub);
      if (!user) throw new HttpError(401, 'BAD_TOKEN', 'الحساب غير موجود');
      res.json({ user: publicUser(user), subscription: await syncStatus(user) });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

module.exports = { authRouter, accessState, HttpError };
