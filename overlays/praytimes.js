// حساب مواقيت الصلاة محلياً (بدون إنترنت) من موقع الشمس — نفس المعادلات الفلكية المعتمدة عند جهات الحساب.
// كل وقت يطلع كلحظة زمنية مطلقة (Date)، ويُعرض بتوقيت المدينة نفسها مهما كان توقيت الكمبيوتر.
(function (root) {
  const D2R = Math.PI / 180;
  const sin = (d) => Math.sin(d * D2R), cos = (d) => Math.cos(d * D2R), tan = (d) => Math.tan(d * D2R);
  const asin = (x) => Math.asin(x) / D2R, acos = (x) => Math.acos(x) / D2R, atan2 = (y, x) => Math.atan2(y, x) / D2R;
  const acot = (x) => Math.atan(1 / x) / D2R;
  const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };

  // موقع الشمس ليوم جولياني: الميل ومعادلة الزمن
  function sun(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
  }
  const julian = (y, m, d) => {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  };

  // التاريخ اليوم في منطقة زمنية معيّنة
  function ymdIn(tz, date) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const g = (t) => +p.find((x) => x.type === t).value;
    return { y: g('year'), m: g('month'), d: g('day') };
  }

  // الشهر الهجري (أم القرى) — لرمضان (عشاء أم القرى ساعتين بعد المغرب)
  function hijriMonth(date, tz) {
    try { return +new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: tz, month: 'numeric' }).format(date).replace(/\D/g, ''); } catch (_) { return 0; }
  }

  // المواقيت الفلكية الدقيقة ليوم (y,m,d بتوقيت المدينة) → ميلي ثانية (بدون تقريب) — تستخدمها compute واختبارات المعايرة
  function raw(y, m, d, place, method, asrSchool, tz) {
    const { lat, lng } = place;
    const jd0 = julian(y, m, d) - lng / (15 * 24);
    const at = (t) => sun(jd0 + t / 24);
    const noon = (t) => fix(12 - at(t).eqt, 24);
    const angleTime = (angle, t, before) => {
      const decl = at(t).decl;
      const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (x > 1 || x < -1) return NaN; // الشمس ما توصل هالزاوية (عروض عالية)
      const T = acos(x) / 15;
      return noon(t) + (before ? -T : T);
    };
    const asrTime = (factor, t) => {
      const decl = at(t).decl;
      return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t);
    };
    // بالساعات (توقيت شمسي محلي على خط الطول) — نكرر مرتين لدقة أعلى
    let T = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    // لحظة حساب موقع الشمس لصلاة معيّنة: 'noon' = الزوال، رقم = ساعة شمسية محلية ثابتة، وإلا لحظة الصلاة نفسها
    const declT = (key, own) => { const v = (method.declAt || {})[key]; return v === 'noon' ? T.dhuhr : typeof v === 'number' ? v : own; };
    for (let i = 0; i < 4; i++) {
      T = {
        // declAt: 'noon' = موقع الشمس عند الزوال (أسلوب بعض الجهات الرسمية مثل أم القرى) بدل لحظة الفجر نفسها
        fajr: angleTime(method.fajr, declT('fajr', T.fajr), true),
        sunrise: angleTime(method.rise || 0.833, T.sunrise, true),
        dhuhr: noon(T.dhuhr),
        asr: asrTime(asrSchool === 'hanafi' ? 2 : 1, T.asr),
        sunset: angleTime(method.set || 0.833, T.sunset),
        isha: method.isha ? angleTime(method.isha, T.isha) : T.isha,
      };
    }
    const day = { y, m, d };
    // العشاء بالدقائق (أم القرى/قطر): بعد المغرب، وفي رمضان ساعتين في أم القرى
    let ishaMin = method.ishaMin;
    if (ishaMin && method.ramadanIshaMin && hijriMonth(new Date(Date.UTC(y, m - 1, d, 12)), tz) === 9) ishaMin = method.ramadanIshaMin;
    if (ishaMin) T.isha = T.sunset + ishaMin / 60;
    // العروض العالية: الفجر والعشاء ما يبعدون عن الشروق/الغروب أكثر من نسبة الزاوية من الليل
    const night = 24 - (T.sunset - T.sunrise);
    const portion = (a) => (a / 60) * night;
    if (!(T.sunrise - T.fajr <= portion(method.fajr))) T.fajr = T.sunrise - portion(method.fajr);
    if (!ishaMin && !(T.isha - T.sunset <= portion(method.isha))) T.isha = T.sunset + portion(method.isha);

    // ساعات شمسية محلية → توقيت عالمي → لحظة (بدون تقريب ولا تعديلات)
    const ms = (h) => Date.UTC(day.y, day.m - 1, day.d) + (h - lng / 15) * 3600000;
    return { fajr: ms(T.fajr), sunrise: ms(T.sunrise), dhuhr: ms(T.dhuhr), asr: ms(T.asr), maghrib: ms(T.sunset), isha: ms(T.isha) };
  }

  // التقريب للدقيقة حسب الجهة الرسمية: لأقرب دقيقة، أو للأعلى (احتياطاً: الأذان ما يسبق الوقت)، أو للأسفل
  const ROUND = { nearest: Math.round, up: Math.ceil, down: Math.floor };
  function roundMode(method, key) {
    const r = method.round;
    return ROUND[(r && typeof r === 'object' ? r[key] : r) || 'nearest'] || Math.round;
  }

  // مواقيت يوم (y,m,d بتوقيت المدينة) → لحظات: تعديلات الجهة الرسمية + تعديلات المستخدم، ثم التقريب
  function compute(y, m, d, place, method, asrSchool, offsets, tz) {
    const R = raw(y, m, d, place, method, asrSchool, tz);
    const adj = method.adj || {};
    const off = offsets || {};
    const out = {};
    for (const key of Object.keys(R)) {
      const t = R[key] + ((adj[key] || 0) + (off[key] || 0)) * 60000;
      out[key] = new Date(roundMode(method, key)(t / 60000 - 1e-9 * Math.sign(t)) * 60000);
    }
    return out;
  }

  const ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const NAMES = {
    ar: { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
    en: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  };

  // وقت «HH:MM» بتوقيت مدينة ليوم معيّن → لحظة مطلقة (مع مراعاة التوقيت الصيفي)
  function tzOffsetMin(tz, ms) {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
    const g = (k) => +p.find((x) => x.type === k).value;
    return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000) / 60000;
  }
  function zoned(y, m, d, hhmm, tz) {
    const [h, mi] = String(hhmm).split(':').map(Number);
    const wall = Date.UTC(y, m - 1, d, h, mi);
    let ms = wall - tzOffsetMin(tz, wall) * 60000;
    ms = wall - tzOffsetMin(tz, ms) * 60000; // تصحيح ثاني عند حدود التوقيت الصيفي
    return ms;
  }

  // الحالة الكاملة للحظة الحالية: مواقيت اليوم، الصلاة الحالية (آخر أذان)، والجاية مع الوقت المتبقي
  // official: جدول رسمي اختياري { 'YYYY-MM-DD': { fajr: 'HH:MM', ... } } — إذا فيه اليوم نستخدمه كما هو
  function state(loc, offsets, now, official) {
    now = now || new Date();
    const tz = loc.city.tz;
    const t = ymdIn(tz, now);
    let usedOfficial = false;
    const day = (shift) => {
      const base = new Date(Date.UTC(t.y, t.m - 1, t.d + shift, 12));
      const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
      const row = official && official[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`];
      if (row) {
        if (!shift) usedOfficial = true;
        const off = offsets || {};
        const out = {};
        for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) out[k] = new Date(zoned(y, m, d, row[k], tz) + (off[k] || 0) * 60000);
        return out;
      }
      return compute(y, m, d, loc.city, loc.method, loc.asr, offsets, tz);
    };
    const today = day(0);
    let current = null, next = null;
    for (const k of ORDER) { if (today[k] <= now) current = k; else if (!next) next = k; }
    const prevDay = current ? null : day(-1);
    const nextAt = next ? today[next] : day(1).fajr;
    return {
      times: today,
      current: current || 'isha', // قبل الفجر: الصلاة الحالية عشاء أمس
      currentAt: current ? today[current] : prevDay.isha,
      next: next || 'fajr',
      nextAt,
      remainingMs: nextAt - now,
      tz,
      official: usedOfficial, // مواقيت اليوم من الجدول الرسمي؟
    };
  }

  // تنسيق وقت بتوقيت المدينة: 12 ساعة (ص/م أو AM/PM) أو 24 ساعة
  function fmt(date, tz, h12, lang) {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: !!h12 }).formatToParts(date);
    const g = (k) => (p.find((x) => x.type === k) || {}).value || '';
    const hh = g('hour') === '24' ? '00' : g('hour');
    if (!h12) return { time: `${hh.padStart(2, '0')}:${g('minute')}`, ampm: '' };
    const am = /am/i.test(g('dayPeriod'));
    return { time: `${hh}:${g('minute')}`, ampm: lang === 'en' ? (am ? 'AM' : 'PM') : (am ? 'ص' : 'م') };
  }
  const countdown = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const two = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
  };
  function hijri(date, tz, lang) {
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-u-ca-islamic-umalqura' : 'ar-SA-u-ca-islamic-umalqura', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    } catch (_) { return ''; }
  }

  // لون «حان وقت الصلاة» التلقائي: أخضر بنفس تشبّع وإضاءة اللون الأساسي (يتناسق معه مهما كان)
  function autoActive(hex) {
    const n = parseInt(String(hex || '#f2c14e').slice(1), 16);
    let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
    // أخضر واضح حتى لو اللون الأساسي باهت أو رمادي
    const S = Math.max(0.55, s), L = Math.min(0.62, Math.max(0.42, l)), H = 145 / 360;
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q;
    const ch = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return '#' + [ch(H + 1 / 3), ch(H), ch(H - 1 / 3)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }

  const api = { compute, raw, state, fmt, countdown, hijri, ymdIn, autoActive, ORDER, NAMES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PrayTimes = api;
})(typeof window !== 'undefined' ? window : globalThis);
