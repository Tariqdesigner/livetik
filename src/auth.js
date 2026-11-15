// Auth routes: register (device-bound 7-day trial), login, me (fresh status for the app's periodic check)
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

// Activation codes: 12 chars from an unambiguous alphabet, shown as XXXX-XXXX-XXXX
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function normalizeCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 12 || [...raw].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return raw.match(/.{4}/g).join('-');
}
function generateCode() {
  const bytes = crypto.randomBytes(12);
  return normalizeCode([...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''));
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
  const trialDays = Number(env.TRIAL_DAYS) || 7;
  const router = express.Router();

  const sign = (user) => jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: '7d' });
  const publicUser = (u) => ({ id: u.id, email: u.email, created_at: u.created_at });

  async function loadUser(where, value) {
    const { rows } = await pool.query(
      `SELECT u.*, d.trial_ends_at FROM users u LEFT JOIN devices d ON d.device_id = u.device_id WHERE ${where} = $1`,
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
      const { email, password, deviceId } = readBody(req);
      const user = await loadUser('u.email', email);
      // نفس الرسالة للبريد غير الموجود وكلمة المرور الخاطئة حتى لا يُكشف وجود الحساب
      const ok = user && (await bcrypt.compare(password, user.password_hash));
      if (!ok) throw new HttpError(401, 'BAD_CREDENTIALS', 'البريد أو كلمة المرور غير صحيحة');

      // فحص ارتباط الجهاز:
      if (!user.device_id) {
        // الحساب تم فك ارتباطه (Reset Device): يُربط فوراً بالجهاز الحالي
        const platform = ['desktop', 'web', 'mobile'].includes(req.body.platform) ? req.body.platform : 'desktop';
        await pool.query(
          `INSERT INTO devices (device_id, platform, first_seen_at, trial_ends_at)
           VALUES ($1, $2, now(), now() + interval '${trialDays} days')
           ON CONFLICT (device_id) DO NOTHING`,
          [deviceId, platform],
        );
        await pool.query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, user.id]);
        user.device_id = deviceId;
      } else if (user.device_id !== deviceId) {
        // الحساب مرتبط بجهاز آخر مختلف: يُمنع حتى يفك الأدمن الارتباط
        throw new HttpError(403, 'DEVICE_MISMATCH', 'هذا الحساب مرتبط بجهاز آخر. تواصل مع الإدارة لفك الارتباط ونقل الحساب إلى هذا الجهاز.');
      }

      await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
      const subscription = await syncStatus(user);
      res.json({ token: sign(user), user: publicUser(user), subscription });
    } catch (e) {
      next(e);
    }
  });

  async function requireUser(req) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) throw new HttpError(401, 'NO_TOKEN', 'سجّل الدخول أولاً');
    let payload;
    try { payload = jwt.verify(m[1], secret); } catch (_) { throw new HttpError(401, 'BAD_TOKEN', 'انتهت الجلسة، سجّل الدخول من جديد'); }
    const user = await loadUser('u.id', payload.sub);
    if (!user) throw new HttpError(401, 'BAD_TOKEN', 'الحساب غير موجود');
    return user;
  }

  // يستدعيه التطبيق عند التشغيل وكل فترة: يعيد حالة الاشتراك الحالية
  router.get('/me', async (req, res, next) => {
    try {
      const user = await requireUser(req);
      res.json({ user: publicUser(user), subscription: await syncStatus(user) });
    } catch (e) {
      next(e);
    }
  });

  // تفعيل كود: يبدأ من اليوم، أو يُضاف بعد نهاية الاشتراك الحالي إن كان فعّالاً (تمديد)
  router.post('/redeem', async (req, res, next) => {
    const client = await pool.connect();
    try {
      const user = await requireUser(req);
      const code = normalizeCode(req.body && req.body.code);
      if (!code) throw new HttpError(400, 'INVALID_CODE', 'صيغة الكود غير صحيحة');

      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM activation_codes WHERE code = $1 FOR UPDATE', [code]);
      const row = rows[0];
      if (!row) throw new HttpError(404, 'INVALID_CODE', 'الكود غير صحيح');
      if (row.redeemed_by) throw new HttpError(409, 'CODE_USED', 'هذا الكود مستخدم من قبل');

      const now = new Date();
      const cur = accessState(user, now);
      const start = cur.status === 'active' && cur.subscription_ends_at ? new Date(cur.subscription_ends_at) : now;
      const ends = new Date(start.getTime() + row.days * DAY);
      await client.query(`UPDATE users SET subscription_status = 'active', subscription_ends_at = $2 WHERE id = $1`, [user.id, ends]);
      await client.query('UPDATE activation_codes SET redeemed_by = $2, redeemed_at = $3 WHERE code = $1', [code, user.id, now]);
      await client.query(
        `INSERT INTO subscriptions (id, user_id, plan, source, starts_at, ends_at, created_at) VALUES ($1, $2, $3, 'code', $4, $5, $6)`,
        [crypto.randomUUID(), user.id, row.plan, start, ends, now],
      );
      await client.query('COMMIT');

      const fresh = await loadUser('u.id', user.id);
      res.json({ user: publicUser(fresh), subscription: accessState(fresh), added_days: row.days });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      next(e);
    } finally {
      client.release();
    }
  });

  // سجل الاشتراكات (الأحدث أولاً)
  router.get('/history', async (req, res, next) => {
    try {
      const user = await requireUser(req);
      const { rows } = await pool.query(
        'SELECT id, plan, source, starts_at, ends_at, created_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [user.id],
      );
      res.json({ history: rows });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

module.exports = { authRouter, accessState, HttpError, normalizeCode, generateCode };
