// LiveDeck API entry: express app + rate limit + CORS + error handler
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createPool, migrate } = require('./db');
const { authRouter, HttpError } = require('./auth');
const { adminRouter } = require('./admin');

function createApp(pool, env = process.env) {
  const app = express();
  app.set('trust proxy', 1); // خلف بروكسي CranL: لعدّ الطلبات حسب IP الحقيقي
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  // صفحات الأوفرلاي الثابتة على الدومين الرسمي (livedeck.live/overlay/...)
  // تتصل بالخادم المحلي للبرنامج (127.0.0.1:21213) لاستقبال الأحداث والوسائط بدون استهلاك موارد السيرفر
  const localOverlays = path.join(__dirname, '..', 'overlays');
  const rootOverlays = path.join(__dirname, '..', '..', 'overlays');
  const overlaysDir = fs.existsSync(localOverlays) ? localOverlays : rootOverlays;
  app.use('/overlay/frames', (req, res) => res.redirect(302, 'http://127.0.0.1:21213' + req.originalUrl));
  app.use('/media', (req, res) => res.redirect(302, 'http://127.0.0.1:21213' + req.originalUrl));
  if (fs.existsSync(overlaysDir)) {
    app.use('/vendor/jquery', express.static(path.join(overlaysDir, 'vendor'), { maxAge: '7d' }));
    app.use('/overlay', express.static(overlaysDir, { maxAge: '1h' }));
  }

  // الويب يحتاج CORS؛ التطبيق المكتبي يرسل بدون Origin فيُسمح له
  const origins = String(env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)) }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  // زر «اشترك الآن» في التطبيق يفتح هذا الرابط؛ يحوّل لصفحة الدفع (Moyasar/Paddle...) عند ضبط PAYMENT_URL
  // ?plan=monthly|quarterly|yearly يُمرَّر لصفحة الدفع كما هو
  app.get('/subscribe', (req, res) => {
    if (env.PAYMENT_URL) {
      const plan = ['monthly', 'quarterly', 'yearly'].includes(req.query.plan) ? req.query.plan : null;
      const url = new URL(env.PAYMENT_URL);
      if (plan) url.searchParams.set('plan', plan);
      return res.redirect(302, url.toString());
    }
    res.status(503).type('html').send('<!doctype html><meta charset="utf-8"><body dir="rtl" style="font-family:sans-serif;padding:40px">صفحة الاشتراك قيد التجهيز.</body>');
  });

  // حماية من التخمين: 20 محاولة لكل IP كل 15 دقيقة على التسجيل والدخول
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'TOO_MANY_REQUESTS', message: 'محاولات كثيرة، حاول بعد قليل' } });
  app.use('/api/auth/register', limiter);
  app.use('/api/auth/login', limiter);
  app.use('/api/auth/redeem', limiter); // يمنع تخمين الأكواد
  app.use('/api/auth', authRouter(pool, env));
  app.use('/api/admin', adminRouter(pool, env));

  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_JSON', message: 'طلب غير صالح' });
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'خطأ في الخادم' });
  });
  return app;
}

if (require.main === module) {
  (async () => {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    }
    const pool = createPool();
    await migrate(pool);
    const port = Number(process.env.PORT) || 3000;
    createApp(pool).listen(port, () => console.log(`LiveDeck API on :${port}`));
  })().catch((e) => {
    console.error('Failed to start:', e.message);
    process.exit(1);
  });
}

module.exports = { createApp };
