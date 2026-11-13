// LiveDeck & TikOverlay Admin API Router
const express = require('express');
const crypto = require('crypto');
const { generateCode, normalizeCode } = require('./auth');

function adminRouter(pool, env = process.env) {
  const router = express.Router();
  const adminSecret = env.ADMIN_SECRET || env.ADMIN_KEY || env.JWT_SECRET;

  if (!adminSecret) {
    console.warn('[Admin API] WARNING: ADMIN_SECRET or JWT_SECRET is not set. Admin API is disabled.');
  }

  // Middleware للتحقق من مفتاح الإدارة
  router.use((req, res, next) => {
    if (!adminSecret) {
      return res.status(503).json({ error: 'CONFIG_ERROR', message: 'مفتاح الإدارة غير مضبوط على الخادم' });
    }
    const key = req.headers['x-admin-key'] || req.query.admin_key;
    if (!key || key !== adminSecret) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'مفتاح الإدارة غير صالح أو مفقود' });
    }
    next();
  });

  // فحص الاتصال
  router.get('/ping', (_req, res) => {
    res.json({ ok: true, message: 'Admin API Connected', timestamp: new Date().toISOString() });
  });

  // إحصائيات عامة
  router.get('/stats', async (_req, res, next) => {
    try {
      const usersRes = await pool.query(`
        SELECT 
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE subscription_status = 'active')::int AS active_users,
          COUNT(*) FILTER (WHERE subscription_status = 'trial')::int AS trial_users,
          COUNT(*) FILTER (WHERE subscription_status = 'expired')::int AS expired_users
        FROM users
      `);

      const codesRes = await pool.query(`
        SELECT 
          COUNT(*)::int AS total_codes,
          COUNT(*) FILTER (WHERE redeemed_at IS NULL)::int AS available_codes,
          COUNT(*) FILTER (WHERE redeemed_at IS NOT NULL)::int AS used_codes
        FROM activation_codes
      `);

      const devicesRes = await pool.query(`SELECT COUNT(*)::int AS total_devices FROM devices`);

      res.json({
        ok: true,
        stats: {
          users: usersRes.rows[0] || {},
          codes: codesRes.rows[0] || {},
          devices: devicesRes.rows[0]?.total_devices || 0,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  // ---- إدارة المستخدمين ----

  // جلب كافة المستخدمين
  router.get('/users', async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      let sql = `
        SELECT 
          u.id,
          u.email,
          u.device_id,
          u.subscription_status,
          u.subscription_ends_at,
          u.created_at,
          u.last_login_at,
          d.platform AS device_platform,
          d.trial_ends_at,
          (
            SELECT json_agg(json_build_object('id', s.id, 'plan', s.plan, 'source', s.source, 'starts_at', s.starts_at, 'ends_at', s.ends_at))
            FROM subscriptions s WHERE s.user_id = u.id
          ) AS subscriptions
        FROM users u
        LEFT JOIN devices d ON d.device_id = u.device_id
      `;
      const params = [];
      if (q) {
        sql += ` WHERE u.email ILIKE $1 OR u.device_id ILIKE $1`;
        params.push(`%${q}%`);
      }
      sql += ` ORDER BY u.created_at DESC LIMIT 200`;

      const { rows } = await pool.query(sql, params);
      res.json({ ok: true, users: rows });
    } catch (e) {
      next(e);
    }
  });

  // فك ارتباط الحساب بجهازه (Reset Device) لتمكينه من الدخول من كمبيوتر آخر
  router.post('/users/:id/reset-device', async (req, res, next) => {
    try {
      const userId = req.params.id;
      const { rows } = await pool.query('SELECT id, email, device_id FROM users WHERE id = $1', [userId]);
      if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      const oldDevice = rows[0].device_id;
      await pool.query('UPDATE users SET device_id = NULL WHERE id = $1', [userId]);

      res.json({
        ok: true,
        message: 'تم فك ارتباط الجهاز بنجاح! يمكن للمستخدم الآن تسجيل الدخول من جهازه الجديد فوراً.',
        user_id: userId,
        old_device_id: oldDevice,
      });
    } catch (e) {
      next(e);
    }
  });

  // تعديل أو تمديد الاشتراك لمستخدم
  router.post('/users/:id/subscription', async (req, res, next) => {
    const client = await pool.connect();
    try {
      const userId = req.params.id;
      const { status = 'active', addDays = 0, endsAt = null, plan = 'pro' } = req.body || {};

      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'المستخدم غير موجود' });
      }
      const user = rows[0];

      let newEndsAt = null;
      const now = new Date();

      if (endsAt) {
        newEndsAt = new Date(endsAt);
      } else if (Number(addDays) > 0) {
        const base = (user.subscription_ends_at && new Date(user.subscription_ends_at) > now)
          ? new Date(user.subscription_ends_at)
          : now;
        newEndsAt = new Date(base.getTime() + Number(addDays) * 86400000);
      } else if (status === 'active' && !user.subscription_ends_at) {
        newEndsAt = new Date(now.getTime() + 30 * 86400000);
      }

      await client.query(
        `UPDATE users SET subscription_status = $1, subscription_ends_at = $2 WHERE id = $3`,
        [status, newEndsAt, userId],
      );

      if (Number(addDays) > 0 && newEndsAt) {
        await client.query(
          `INSERT INTO subscriptions (id, user_id, plan, source, starts_at, ends_at, created_at)
           VALUES ($1, $2, $3, 'admin', now(), $4, now())`,
          [crypto.randomUUID(), userId, plan, newEndsAt],
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true, message: 'تم تحديث الاشتراك بنجاح', status, subscription_ends_at: newEndsAt });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      next(e);
    } finally {
      client.release();
    }
  });

  // حذف مستخدم
  router.delete('/users/:id', async (req, res, next) => {
    try {
      const userId = req.params.id;
      const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      if (!rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: 'المستخدم غير موجود' });
      res.json({ ok: true, message: 'تم حذف المستخدم بنجاح' });
    } catch (e) {
      next(e);
    }
  });

  // ---- إدارة المفاتيح والأكواد ----

  // جلب كافة الأكواد
  router.get('/codes', async (req, res, next) => {
    try {
      const filter = String(req.query.filter || 'all'); // 'all', 'available', 'used'
      const q = String(req.query.q || '').trim().toUpperCase();

      let sql = `
        SELECT 
          c.code,
          c.plan,
          c.days,
          c.created_at,
          c.redeemed_at,
          c.redeemed_by,
          u.email AS redeemed_by_email
        FROM activation_codes c
        LEFT JOIN users u ON u.id = c.redeemed_by
        WHERE 1=1
      `;
      const params = [];

      if (filter === 'available') {
        sql += ` AND c.redeemed_at IS NULL`;
      } else if (filter === 'used') {
        sql += ` AND c.redeemed_at IS NOT NULL`;
      }

      if (q) {
        params.push(`%${q}%`);
        sql += ` AND (c.code LIKE $${params.length} OR u.email ILIKE $${params.length})`;
      }

      sql += ` ORDER BY c.created_at DESC LIMIT 500`;

      const { rows } = await pool.query(sql, params);
      res.json({ ok: true, codes: rows });
    } catch (e) {
      next(e);
    }
  });

  // توليد أكواد تفعيل جديدة
  router.post('/codes/generate', async (req, res, next) => {
    try {
      const days = Number(req.body.days || 30);
      const count = Math.min(Number(req.body.count || 1), 500);
      const plan = String(req.body.plan || 'pro');

      if (!Number.isInteger(days) || days < 1) {
        return res.status(400).json({ error: 'INVALID_DAYS', message: 'عدد الأيام غير صحيح' });
      }

      const generated = [];
      while (generated.length < count) {
        const code = generateCode();
        const r = await pool.query(
          'INSERT INTO activation_codes (code, plan, days) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [code, plan, days],
        );
        if (r.rowCount) generated.push(code);
      }

      res.status(201).json({
        ok: true,
        message: `تم توليد ${generated.length} كود بنجاح`,
        codes: generated,
        days,
        plan,
      });
    } catch (e) {
      next(e);
    }
  });

  // حذف كود
  router.delete('/codes/:code', async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code) || req.params.code;
      const { rowCount } = await pool.query('DELETE FROM activation_codes WHERE code = $1', [code]);
      if (!rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: 'الكود غير موجود' });
      res.json({ ok: true, message: 'تم حذف الكود بنجاح' });
    } catch (e) {
      next(e);
    }
  });

  // ---- إدارة الأجهزة ----

  // جلب كافة الأجهزة
  router.get('/devices', async (req, res, next) => {
    try {
      const { rows } = await pool.query(`
        SELECT 
          d.device_id,
          d.platform,
          d.first_seen_at,
          d.trial_ends_at,
          u.email AS bound_user_email,
          u.id AS bound_user_id
        FROM devices d
        LEFT JOIN users u ON u.device_id = d.device_id
        ORDER BY d.first_seen_at DESC
        LIMIT 200
      `);
      res.json({ ok: true, devices: rows });
    } catch (e) {
      next(e);
    }
  });

  // إعادة ضبط الفترة التجريبية للجهاز
  router.post('/devices/:deviceId/reset-trial', async (req, res, next) => {
    try {
      const deviceId = req.params.deviceId;
      const days = Number(req.body.days || 30);
      const { rowCount } = await pool.query(
        `UPDATE devices SET trial_ends_at = now() + (interval '1 day' * $1) WHERE device_id = $2`,
        [days, deviceId],
      );
      if (!rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: 'الجهاز غير مسجل' });
      res.json({ ok: true, message: `تم تجديد الفترة التجريبية للجهاز لمدة ${days} يوم بنجاح` });
    } catch (e) {
      next(e);
    }
  });

  // حذف بصمة جهاز
  router.delete('/devices/:deviceId', async (req, res, next) => {
    try {
      const deviceId = req.params.deviceId;
      await pool.query('UPDATE users SET device_id = NULL WHERE device_id = $1', [deviceId]);
      const { rowCount } = await pool.query('DELETE FROM devices WHERE device_id = $1', [deviceId]);
      if (!rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: 'الجهاز غير موجود' });
      res.json({ ok: true, message: 'تم حذف الجهاز وفك ارتباطه بأي حساب بنجاح' });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

module.exports = { adminRouter };
